"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Mandatory-location gate for the in-house selfie.
 *
 * status:
 *   checking     → reading the current permission state
 *   prompt       → permission not decided yet; user must press "Allow location"
 *   requesting   → browser prompt open / waiting for the first GPS fix
 *   granted      → we have coordinates (kept fresh with watchPosition)
 *   denied       → user blocked (reason "blocked") or closed the prompt (reason "dismissed")
 *   unavailable  → permission OK but device location (GPS) is off / no fix
 *   timeout      → could not get a fix in time
 *   unsupported  → browser has no geolocation API
 *
 * Reacts live to permission changes (Permissions API "change" event) and re-checks whenever
 * the tab becomes visible again, so enabling location from browser/OS settings is picked up
 * without a refresh, and revoking it mid-capture immediately blocks the selfie.
 */
const WATCH_OPTIONS = { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 };
// At upload: a brand-new reading (no cached position), high accuracy (GPS on phones)
const FRESH_FIX_OPTIONS = { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 };
const MAX_COORDS_AGE_MS = 10 * 60 * 1000;
// The most accurate reading of the last 2 minutes is kept and used if it beats the fresh one
const BEST_FIX_MAX_AGE_MS = 2 * 60 * 1000;
// Location is tracked the whole time the camera is open; a reading this recent is reused at
// upload instead of waiting for a brand-new one (speed only — still live and required)
const REUSE_FIX_MAX_AGE_MS = 30 * 1000;

function isRecent(fix, maxAge) {
  return Boolean(fix && Date.now() - fix.timestamp < maxAge);
}

/** The more accurate of two readings (smaller accuracy radius wins). */
function moreAccurate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (b.accuracy ?? Infinity) < (a.accuracy ?? Infinity) ? b : a;
}

function toCoords(pos) {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    timestamp: pos.timestamp || Date.now(),
  };
}

function statusFromError(err) {
  if (err?.code === 1) return "denied";
  if (err?.code === 3) return "timeout";
  return "unavailable";
}

export default function useLocationGate() {
  const [status, setStatus] = useState("checking");
  const [coords, setCoords] = useState(null);
  const [deniedReason, setDeniedReason] = useState(null); // "blocked" | "dismissed"
  const dismissedRef = useRef(false);
  const watchIdRef = useRef(null);
  const coordsRef = useRef(null);
  const bestRef = useRef(null); // most accurate recent reading
  const permStatusRef = useRef(null);
  const mountedRef = useRef(true);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
  }, []);

  const startWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    if (watchIdRef.current !== null) return;
    if (!coordsRef.current) setStatus("requesting");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (!mountedRef.current) return;
        const next = toCoords(pos);
        coordsRef.current = next;
        bestRef.current = isRecent(bestRef.current, BEST_FIX_MAX_AGE_MS) ? moreAccurate(bestRef.current, next) : next;
        setCoords(next);
        setStatus("granted");
      },
      (err) => {
        if (!mountedRef.current) return;
        const nextStatus = statusFromError(err);
        if (nextStatus === "denied") {
          // Permission blocked or prompt closed — nothing usable any more.
          // If the permission is still "prompt", the user dismissed the dialog.
          stopWatch();
          coordsRef.current = null;
          bestRef.current = null;
          setCoords(null);
          const permState = permStatusRef.current?.state;
          const dismissed = permState === "prompt";
          dismissedRef.current = dismissed;
          setDeniedReason(dismissed ? "dismissed" : "blocked");
          setStatus("denied");
          return;
        }
        // Transient GPS problems: keep a recent fix if we already have one
        const recent = coordsRef.current && Date.now() - coordsRef.current.timestamp < MAX_COORDS_AGE_MS;
        if (!recent) {
          stopWatch();
          coordsRef.current = null;
          bestRef.current = null;
          setCoords(null);
          setStatus(nextStatus);
        }
      },
      WATCH_OPTIONS,
    );
  }, [stopWatch]);

  const applyPermissionState = useCallback((state) => {
    if (!mountedRef.current) return;
    if (state === "granted") {
      dismissedRef.current = false;
      setDeniedReason(null);
      startWatch();
    } else if (state === "denied") {
      stopWatch();
      coordsRef.current = null;
      bestRef.current = null;
      setCoords(null);
      dismissedRef.current = false;
      setDeniedReason("blocked");
      setStatus("denied");
    } else if (dismissedRef.current) {
      // User closed the prompt without answering — keep showing "permission cancelled"
      stopWatch();
      coordsRef.current = null;
      bestRef.current = null;
      setCoords(null);
      setDeniedReason("dismissed");
      setStatus("denied");
    } else {
      // "prompt" — e.g. permission reset from site settings; ask again via the button
      stopWatch();
      coordsRef.current = null;
      bestRef.current = null;
      setCoords(null);
      setStatus("prompt");
    }
  }, [startWatch, stopWatch]);

  /** Read the permission state (where supported) and act on it. */
  const recheck = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    if (navigator.permissions?.query) {
      try {
        const perm = await navigator.permissions.query({ name: "geolocation" });
        if (permStatusRef.current !== perm) {
          if (permStatusRef.current) permStatusRef.current.onchange = null;
          permStatusRef.current = perm;
          perm.onchange = () => applyPermissionState(perm.state);
        }
        applyPermissionState(perm.state);
        return;
      } catch (e) {
        // Some browsers (older Safari) reject the query — fall through
      }
    }
    // No Permissions API: we cannot know silently. Keep a live watch if we have one,
    // otherwise ask the user to press the button (which triggers the real prompt).
    if (watchIdRef.current === null && !coordsRef.current) {
      setStatus((prev) => (prev === "checking" ? "prompt" : prev));
    }
  }, [applyPermissionState]);

  /** User pressed "Allow location" / "Retry" — triggers the browser prompt if needed. */
  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    dismissedRef.current = false;
    setDeniedReason(null);
    stopWatch();
    startWatch();
  }, [startWatch, stopWatch]);

  /**
   * Location for the moment of upload: a brand-new high-accuracy reading, or the most accurate
   * reading of the last 2 minutes if that one is more precise. Falls back to a recent watched
   * reading on GPS hiccups.
   */
  const getFreshPosition = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        reject({ status: "unsupported" });
        return;
      }
      // Permission revoked → never reuse an old reading
      if (permStatusRef.current?.state === "denied") {
        reject({ status: "denied" });
        return;
      }
      // Most accurate reading of the last 30 s → use it straight away
      const recentFix = [bestRef.current, coordsRef.current]
        .filter((fix) => isRecent(fix, REUSE_FIX_MAX_AGE_MS))
        .reduce((acc, fix) => moreAccurate(acc, fix), null);
      if (recentFix) {
        resolve(recentFix);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next = toCoords(pos);
          coordsRef.current = next;
          const best = isRecent(bestRef.current, BEST_FIX_MAX_AGE_MS) ? moreAccurate(bestRef.current, next) : next;
          bestRef.current = best;
          if (mountedRef.current) setCoords(next);
          resolve(best);
        },
        (err) => {
          const nextStatus = statusFromError(err);
          if (nextStatus !== "denied") {
            if (isRecent(bestRef.current, BEST_FIX_MAX_AGE_MS)) {
              resolve(bestRef.current);
              return;
            }
            if (isRecent(coordsRef.current, MAX_COORDS_AGE_MS)) {
              resolve(coordsRef.current);
              return;
            }
          }
          if (nextStatus === "denied" && mountedRef.current) {
            stopWatch();
            coordsRef.current = null;
            bestRef.current = null;
            setCoords(null);
            setDeniedReason(permStatusRef.current?.state === "prompt" ? "dismissed" : "blocked");
            setStatus("denied");
          }
          reject({ status: nextStatus });
        },
        FRESH_FIX_OPTIONS,
      );
    });
  }, [stopWatch]);

  useEffect(() => {
    mountedRef.current = true;
    recheck();

    const onVisible = () => {
      if (document.visibilityState === "visible") recheck();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (permStatusRef.current) permStatusRef.current.onchange = null;
      stopWatch();
    };
  }, [recheck, stopWatch]);

  return { status, deniedReason, coords, granted: status === "granted" && !!coords, request, recheck, getFreshPosition };
}
