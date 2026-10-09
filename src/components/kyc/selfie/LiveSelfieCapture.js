"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useLocationGate from "./useLocationGate";
import { loadFaceEngine, getBrowserSupport } from "./faceEngine";
import {
  analyzeFrame,
  createFlagSmoother,
  orderedIssues,
  ISSUE_MESSAGES,
  DETECTED_LABELS,
  CHECKLIST,
  CHALLENGE_TEXT,
  LOOK_STRAIGHT_TEXT,
  isFacingStraight,
  updateChallengeStep,
  getOvalGeometry,
  THRESHOLDS,
} from "./faceChecks";
import { GuideHeadCoin, GuideCaption, GuideArrows, GUIDE_STYLES, getGuideCue, useGuidePrefs, useGuideVoice } from "./SelfieGuide";

/**
 * In-house live selfie capture (replaces the Digio selfie SDK; see src/config/selfieConfig.js).
 *
 * Flow: location gate → camera → real-time checks (button disabled until every check passes
 * steadily) → random liveness challenge (server-issued) → auto-capture of a straight, clear frame
 * → re-check of the captured photo → review → upload to /api/digio/selfie-capture, which runs
 * passive liveness + face match and stores selfieDetails (incl. lat/lng) in the existing shape.
 *
 * Props:
 *   applicationId  KYC application id (falls back to session storage)
 *   authToken      bearer token override (correction portal / QR mobile token)
 *   onSuccess(res) called with the server response { selfiePath, score, livenessScore, selfieDetails }
 *   onCancel()     user closed the capture
 *   variant        "modal" (overlay, default) | "page" (full page, used by /mobile-selfie)
 *   noCameraHint   extra hint shown when no camera is available (e.g. "use the QR option")
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const VIRTUAL_CAMERA_PATTERN = /obs|virtual|manycam|xsplit|snap camera|camtwist|vcam|droidcam|epoccam|ndi|splitcam|youcam/i;
// The eyewear / cap thresholds in faceChecks.js are calibrated at this width — keep them in sync
const ANALYSIS_WIDTH = 240;
const STABLE_MS = 600; // blocking checks must pass continuously this long before the liveness actions start
const STEP_TIMEOUT_MS = 12000;
const LOST_ABORT_MS = 1500;
const RESTART_COOLDOWN_MS = 2500; // pause before auto-restarting the liveness actions after a failure
const CHALLENGE_MAX_AGE_MS = 150000; // server token lives 180s; redo the actions a little before that
const MAX_CAPTURE_SIDE = 1280;
const SESSION_EXPIRED_MSG = "Your session has expired. Please refresh the page (or scan the QR code again) and retry.";
const LOOP_STAGES = ["live", "challenge", "ready"];
// Only these disable the "Click Selfie" button: one face, no goggles / glasses, no cap.
const BLOCKING_ISSUES = ["noFace", "multipleFaces", "sunglasses", "glasses", "headwear"];
// After the liveness actions the head must also face the camera (no left/right selfies).
// "needBlink": a natural blink is required shortly before clicking (a printed photo can't blink).
const READY_BLOCKING_ISSUES = [...BLOCKING_ISSUES, "turned", "needBlink"];
// Shown as tips only — they never disable the button.
// Lighting is a tip only: it is measured on skin (not beard) and never disables the button.
const TIP_ISSUES = ["tooDark", "backlit", "tooFar", "tooClose", "notCentered", "notStraight", "eyesClosed"];
// While turning/blinking only presence is enforced (a turned face skews appearance checks);
// the "ready" stage re-enforces every blocking check before the button enables.
const CRITICAL_DURING_CHALLENGE = ["noFace", "multipleFaces"];
// Re-checked on the exact photo after the button is pressed. The photo is taken from the first
// live frame that passes these (within CAPTURE_WAIT_MS), so a blink or a passing glance just
// delays the shot by a few frames instead of failing it.
const FINAL_PHOTO_CHECKS = ["noFace", "multipleFaces", "turned", "eyesClosed"];
const CAPTURE_WAIT_MS = 2000;
// Ready + every check passing this long → the selfie is taken automatically
const AUTO_CAPTURE_MS = 1000;
// Glasses / goggles / cap at the moment of the click. The on-screen warning waits ~1–1.5 s before
// it appears (so noise never flashes it), which would let glasses put on just before clicking slip
// through. So the photo also needs: this exact frame clean, and the item seen in under
// RECENT_APPEARANCE_MAX of the frames of the last RECENT_APPEARANCE_MS.
const APPEARANCE_PHOTO_CHECKS = ["sunglasses", "glasses", "headwear"];
const RECENT_APPEARANCE_MS = 1200;
const RECENT_APPEARANCE_MAX = 0.3;
// Messages under the camera disappear on their own; server verdicts stay a little longer
const BANNER_MS = 6000;
const SERVER_BANNER_MS = 12000;
// The liveness challenge is fetched in the background while the user settles in the oval, so
// the actions start instantly. A prefetched challenge older than this is fetched again.
const CHALLENGE_PREFETCH_MAX_AGE_MS = 60000;
// Server rejections where the user only needs to click the selfie again (liveness stays valid)
const RETAKE_CODES = ["FACE_MATCH_FAILED", "FACE_MATCH_LOW", "FACE_MATCH_UNAVAILABLE", "LIVENESS_FAILED", "LIVENESS_UNAVAILABLE", "NO_FACE", "MULTIPLE_FACES"];

// ── Anti-swap (someone doing the actions live, then holding up a photo) ──
const CLICK_WINDOW_MS = 30000; // the selfie must be clicked within this time after the actions
const BLINK_RECENT_MS = 10000; // …and a natural blink must have happened this recently
const CONTINUITY_LOST_MS = 700; // face may vanish only this long between the actions and the click
const CONTINUITY_MAX_JUMP = 0.35; // max face-centre move per analysis, as a fraction of face width
const CONTINUITY_MAX_SCALE = 1.35; // max face-size change per analysis
// The loop keeps watching the face during review / upload so a swap before a retake is caught
const RUN_STAGES = [...LOOP_STAGES, "verifying", "review", "submitting"];
const KEYFRAME_SIDE = 480; // frame grabbed at the end of the actions (compared with the photo on the server)
const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

/**
 * Same-face continuity from the liveness actions until the click. Returns false when the face
 * left the camera, a second face stayed in view, or the face jumped / changed size abruptly
 * (what happens when a photo is pushed in front of the camera).
 */
function trackContinuity(c, analysis, now) {
  const t = c.track || (c.track = { lastBox: null, lostSince: null, multiSince: null });
  if (analysis.faceCount === 0) {
    if (t.lostSince === null) t.lostSince = now;
    return now - t.lostSince <= CONTINUITY_LOST_MS;
  }
  t.lostSince = null;
  if (analysis.faceCount > 1) {
    if (t.multiSince === null) t.multiSince = now;
    if (now - t.multiSince > CONTINUITY_LOST_MS) return false;
  } else {
    t.multiSince = null;
  }
  const box = analysis.box;
  if (box && t.lastBox) {
    const jump = Math.hypot(box.cx - t.lastBox.cx, box.cy - t.lastBox.cy) / Math.max(1e-6, t.lastBox.w);
    const scale = box.w / Math.max(1e-6, t.lastBox.w);
    if (jump > CONTINUITY_MAX_JUMP || scale > CONTINUITY_MAX_SCALE || scale < 1 / CONTINUITY_MAX_SCALE) return false;
  }
  if (box) t.lastBox = box;
  return true;
}

// detectForVideo needs strictly increasing timestamps on the shared landmarker
let lastVideoTimestamp = 0;
function nextTimestamp() {
  lastVideoTimestamp = Math.max(performance.now(), lastVideoTimestamp + 1);
  return lastVideoTimestamp;
}

function resolveToken(explicit) {
  if (explicit) return explicit;
  if (typeof window === "undefined") return null;
  return (
    sessionStorage.getItem("correctionToken") ||
    sessionStorage.getItem("kycToken") ||
    localStorage.getItem("kycToken") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("token")
  );
}

function resolveAppId(explicit) {
  if (explicit) return explicit;
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("kycApplicationId") || localStorage.getItem("kycApplicationId");
}

function getPlatform() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

const LOCATION_HELP = {
  ios: "On iPhone: Settings → Privacy & Security → Location Services → turn ON, and set your browser (Safari Websites / Chrome) to “While Using”. In Safari you can also tap “aA” → Website Settings → Location → Allow.",
  android: "On Android: tap the lock / ⓘ icon next to the address bar → Permissions → Location → Allow. Also make sure Location is turned ON in your phone's quick settings.",
  desktop: "Click the lock / settings icon left of the address bar → Location → Allow. On Windows also check Settings → Privacy & security → Location is ON; on Mac: System Settings → Privacy & Security → Location Services → enable your browser.",
};

const CAMERA_HELP = {
  ios: "On iPhone: Settings → your browser (Safari / Chrome) → Camera → Allow. In Safari you can also tap “aA” → Website Settings → Camera → Allow.",
  android: "On Android: tap the lock / ⓘ icon next to the address bar → Permissions → Camera → Allow.",
  desktop: "Click the lock / settings icon left of the address bar → Camera → Allow. On Windows also check Settings → Privacy & security → Camera is ON.",
};

export default function LiveSelfieCapture({
  applicationId,
  authToken,
  onSuccess,
  onCancel,
  variant = "modal",
  noCameraHint = "",
}) {
  const location = useLocationGate();
  const platform = getPlatform();

  // The camera starts right away, in parallel with the location request (location is still required
  // before the liveness actions and the click — until then it is shown over the camera).
  const [stage, setStage] = useState("starting"); // location | starting | live | challengeLoading | challenge | ready | verifying | review | submitting | done | error
  const [fatal, setFatal] = useState(null); // { kind, title, message, help }
  const [engineState, setEngineState] = useState("loading"); // loading | ready | failed
  const [view, setView] = useState({ issues: ["noFace"], ready: false });
  const [challengeView, setChallengeView] = useState(null); // { steps, index, done }
  const [banner, setBanner] = useState(null);
  const [captured, setCaptured] = useState(null);
  const [videoDims, setVideoDims] = useState(null);
  // Guide only: which way the face sits off the oval (null when centred) — never used by any check
  const [nudge, setNudge] = useState(null);
  const nudgeRef = useRef(null);
  const [guidePrefs, setGuidePrefs] = useGuidePrefs();

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraGenRef = useRef(0); // bumped by every stop/start; stale camera requests are discarded
  const engineRef = useRef(null);
  const analysisCanvasRef = useRef(null);
  const rafRef = useRef(null);
  const stageRef = useRef("starting");
  const mountedRef = useRef(true);
  const smootherRef = useRef(createFlagSmoother());
  const prevNoseRef = useRef(null);
  const stableSinceRef = useRef(null);
  const lastRunRef = useRef(0);
  const intervalRef = useRef(100);
  const emaRef = useRef(20);
  const viewKeyRef = useRef("");
  const challengeRef = useRef(null);
  const cooldownUntilRef = useRef(0);
  const savedResultRef = useRef(null);
  const recorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const videoBytesRef = useRef(0);
  const videoMimeRef = useRef("video/webm");
  const blinkRef = useRef({ closed: false, lastBlinkAt: -Infinity });
  const finishedRef = useRef(false);
  const finishRef = useRef(null);
  const lastMetricsRef = useRef({});
  const runAnalysisRef = useRef(null);
  const captureReqRef = useRef(null); // { startedAt, lastIssue } while waiting for a clean frame
  const appearanceHistoryRef = useRef([]); // [{ t, sunglasses, glasses, headwear }] of judged frames
  const frameCanvasRef = useRef(null);
  const prefetchRef = useRef(null); // { promise, at } — challenge fetched ahead of time
  const locationRef = useRef(location);
  locationRef.current = location;

  const goto = useCallback((next) => {
    stageRef.current = next;
    setStage(next);
  }, []);

  // ─── Camera ───────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    // Any camera request still in flight is now outdated — its stream is stopped on arrival
    cameraGenRef.current += 1;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const failCamera = useCallback((err) => {
    const name = err?.name || "";
    let next;
    if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
      next = { kind: "camera_denied", title: "Camera permission denied", message: "The selfie can't be taken without camera access.", help: CAMERA_HELP[platform] };
    } else if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
      next = { kind: "no_camera", title: "No camera found", message: "We couldn't find a camera on this device.", help: noCameraHint };
    } else if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
      next = { kind: "camera_busy", title: "Camera is busy", message: "Another app (Zoom, Teams, WhatsApp…) may be using the camera. Close it and retry.", help: "" };
    } else {
      next = { kind: "camera_error", title: "Camera error", message: "We couldn't start your camera. Please retry.", help: "" };
    }
    stopCamera();
    setFatal(next);
    goto("error");
  }, [goto, noCameraHint, platform, stopCamera]);

  const startCamera = useCallback(async () => {
    stopCamera();
    const gen = cameraGenRef.current;
    setFatal(null);
    goto("starting");
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err) {
        if (err?.name !== "OverconstrainedError") throw err;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      // Closed meanwhile, or a newer start replaced this one (e.g. React dev double-mount, double
      // Retry): stop this stream, otherwise it stays open and the camera light never goes off
      if (!mountedRef.current || gen !== cameraGenRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const track = stream.getVideoTracks()[0];
      if (track && VIRTUAL_CAMERA_PATTERN.test(track.label || "")) {
        stream.getTracks().forEach((t) => t.stop());
        setFatal({ kind: "virtual_camera", title: "Virtual camera detected", message: "Please use your device's real camera. Virtual / software cameras are not allowed for KYC.", help: "" });
        goto("error");
        return;
      }
      if (track) {
        track.onended = () => {
          if (!mountedRef.current || ["done", "submitting"].includes(stageRef.current)) return;
          failCamera({ name: "AbortError" });
        };
      }

      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play().catch(() => {});
      await new Promise((resolve) => {
        if (video.readyState >= 2 && video.videoWidth) return resolve();
        const done = () => {
          video.removeEventListener("loadeddata", done);
          resolve();
        };
        video.addEventListener("loadeddata", done);
        setTimeout(done, 8000);
      });
      if (!mountedRef.current || gen !== cameraGenRef.current) return;
      if (!video.videoWidth) throw Object.assign(new Error("no frames"), { name: "AbortError" });

      setVideoDims({ w: video.videoWidth, h: video.videoHeight });
      smootherRef.current.reset();
      stableSinceRef.current = null;
      prevNoseRef.current = null;
      goto("live");
    } catch (err) {
      if (!mountedRef.current || gen !== cameraGenRef.current) return;
      console.warn("[LiveSelfie] Camera error:", err?.name, err?.message);
      failCamera(err);
    }
  }, [failCamera, goto, stopCamera]);

  // Keep overlay geometry in sync if the camera changes resolution (e.g. phone rotation)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onResize = () => {
      if (video.videoWidth) setVideoDims({ w: video.videoWidth, h: video.videoHeight });
    };
    video.addEventListener("resize", onResize);
    return () => video.removeEventListener("resize", onResize);
  }, []);

  // React to the camera permission being revoked / re-granted (Chromium supports this)
  useEffect(() => {
    let permStatus = null;
    let cancelled = false;
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: "camera" }).then((p) => {
        if (cancelled) return;
        permStatus = p;
        p.onchange = () => {
          if (!mountedRef.current) return;
          if (p.state === "denied" && !["done", "submitting"].includes(stageRef.current)) {
            failCamera({ name: "NotAllowedError" });
          } else if (p.state === "granted" && stageRef.current === "error") {
            startCamera();
          }
        };
      }).catch(() => {});
    }
    return () => {
      cancelled = true;
      if (permStatus) permStatus.onchange = null;
    };
  }, [failCamera, startCamera]);

  // ─── Face engine ──────────────────────────────────────────────────────
  const loadEngine = useCallback(() => {
    setEngineState("loading");
    loadFaceEngine()
      .then((engine) => {
        if (!mountedRef.current) return;
        engineRef.current = engine;
        setEngineState("ready");
      })
      .catch((err) => {
        console.error("[LiveSelfie] Face engine failed to load:", err);
        if (mountedRef.current) setEngineState("failed");
      });
  }, []);

  // ─── Mount / unmount ──────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    const support = getBrowserSupport();
    if (!support.ok) {
      setFatal(
        support.reason === "insecure"
          ? { kind: "unsupported", title: "Secure connection required", message: "Camera and location only work over a secure (https) connection. Please open this page using https.", help: "" }
          : { kind: "unsupported", title: "Browser not supported", message: "This browser can't run the live selfie check. Please use the latest Chrome or Safari.", help: noCameraHint },
      );
      goto("error");
    } else {
      // Face detection, camera and location all start at once (each takes a few seconds)
      loadEngine();
      startCamera();
    }

    let prevOverflow;
    if (variant === "modal") {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafRef.current);
      const rec = recorderRef.current;
      recorderRef.current = null;
      if (rec && rec.state !== "inactive") {
        try { rec.stop(); } catch (e) {}
      }
      stopCamera();
      if (variant === "modal") document.body.style.overflow = prevOverflow || "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Location revoked mid-capture → abort anything in progress; button stays disabled
  useEffect(() => {
    if (location.granted) return;
    if (["challengeLoading", "challenge", "ready", "verifying", "review"].includes(stageRef.current)) {
      captureReqRef.current = null;
      challengeRef.current = null;
      setChallengeView(null);
      setCaptured(null);
      setBanner({ type: "error", text: "Location access was turned off. The selfie can't be taken without your location." });
      goto("live");
    }
  }, [location.granted, goto]);

  // Messages clear themselves, so a fixed problem never keeps showing an old warning
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner((cur) => (cur === banner ? null : cur)), banner.ttl || BANNER_MS);
    return () => clearTimeout(t);
  }, [banner]);

  // After a successful save, show the confirmation briefly, then continue automatically
  useEffect(() => {
    if (stage !== "done") return;
    const t = setTimeout(() => finishRef.current?.(), 2200);
    return () => clearTimeout(t);
  }, [stage]);

  // ─── Analysis loop ────────────────────────────────────────────────────
  const grabPixels = (source, srcW, srcH) => {
    let canvas = analysisCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      analysisCanvasRef.current = canvas;
    }
    const w = ANALYSIS_WIDTH;
    const h = Math.max(1, Math.round((ANALYSIS_WIDTH * srcH) / srcW));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  };

  const publishView = (issues, ready, tips = [], secondsLeft = null) => {
    const key = issues.join(",") + "|" + ready + "|" + tips.join(",") + "|" + secondsLeft;
    if (key === viewKeyRef.current) return;
    viewKeyRef.current = key;
    setView({ issues, ready, tips, secondsLeft });
  };

  /** Guide arrows: direction to move when the face is outside the oval (display only). */
  const publishNudge = (analysis, video) => {
    let dir = null;
    if (analysis?.box && video?.videoWidth) {
      const oval = getOvalGeometry(video.videoWidth, video.videoHeight);
      const dx = (analysis.box.cx - oval.cx) / oval.w;
      const dy = (analysis.box.cy - oval.cy) / oval.h;
      // The preview is mirrored: a face right of centre in the frame shows on the left of the screen
      if (Math.abs(dx) >= Math.abs(dy)) dir = dx > 0 ? "right" : "left";
      else dir = dy > 0 ? "up" : "down";
    }
    if (dir !== nudgeRef.current) {
      nudgeRef.current = dir;
      setNudge(dir);
    }
  };

  // ─── Session video (from the start of the actions until the selfie is submitted) ───
  // Recorded locally; it is sent with the selfie and the server stores it on Cloudinary only
  // when the selfie passes every check. Abandoned attempts are simply discarded.
  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec && rec.state !== "inactive") {
      try {
        rec.ondataavailable = null;
        rec.stop();
      } catch (e) {}
    }
    videoChunksRef.current = [];
    videoBytesRef.current = 0;
  }, []);

  const startRecording = () => {
    stopRecording();
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") return;
    const types = ["video/webm;codecs=vp8", "video/webm", "video/mp4"];
    const mime = types.find((t) => MediaRecorder.isTypeSupported?.(t));
    try {
      const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 500000 });
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size && videoBytesRef.current + e.data.size <= MAX_VIDEO_BYTES) {
          videoChunksRef.current.push(e.data);
          videoBytesRef.current += e.data.size;
        }
      };
      rec.start(500);
      recorderRef.current = rec;
      videoMimeRef.current = rec.mimeType || mime || "video/webm";
    } catch (e) {
      console.warn("[LiveSelfie] Video recording unavailable:", e?.message);
      recorderRef.current = null;
    }
  };

  /** Everything recorded so far as a data URL (recording continues in case of a retake). */
  const snapshotVideo = async () => {
    const rec = recorderRef.current;
    if (!rec) return null;
    // Keep this session's chunk list even if recording is stopped / reset meanwhile
    const chunks = videoChunksRef.current;
    if (rec.state === "recording") {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 800);
        rec.addEventListener("dataavailable", () => { clearTimeout(timer); setTimeout(resolve, 0); }, { once: true });
        try { rec.requestData(); } catch (e) { clearTimeout(timer); resolve(); }
      });
    }
    if (!chunks.length) return null;
    const blob = new Blob(chunks, { type: videoMimeRef.current.split(";")[0] });
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  };

  /** Mirrored JPEG of the visible window, used as the "action frame" for the server's anti-swap check. */
  const grabKeyframe = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const { crop } = getOvalGeometry(video.videoWidth, video.videoHeight);
    const scale = Math.min(1, KEYFRAME_SIDE / Math.max(crop.sw, crop.sh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(crop.sw * scale);
    canvas.height = Math.round(crop.sh * scale);
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  };

  const abortToLive = useCallback((message, ttl = BANNER_MS) => {
    stopRecording();
    captureReqRef.current = null;
    challengeRef.current = null;
    stableSinceRef.current = null;
    cooldownUntilRef.current = performance.now() + RESTART_COOLDOWN_MS;
    setChallengeView(null);
    if (message) setBanner({ type: "error", text: message, ttl });
    goto("live");
  }, [goto, stopRecording]);

  /**
   * Full-size copy of the current camera frame. While capturing, the face engine analyses this
   * copy (same size as the video, so its face tracking stays consistent) and the photo is cut
   * from the very same pixels — the checked frame and the saved photo are identical.
   */
  const grabFullFrame = (video) => {
    let canvas = frameCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      frameCanvasRef.current = canvas;
    }
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  /** Saves the checked frame as the selfie: the 3:4 preview window, mirrored like the preview. */
  const finalizeCapture = (frame, analysis) => {
    const engine = engineRef.current;
    const { crop } = getOvalGeometry(frame.width, frame.height);
    const scale = Math.min(1, MAX_CAPTURE_SIDE / Math.max(crop.sw, crop.sh));
    const out = document.createElement("canvas");
    out.width = Math.round(crop.sw * scale);
    out.height = Math.round(crop.sh * scale);
    const octx = out.getContext("2d");
    // The live preview is mirrored (like a mirror); save the photo the same way so it looks
    // exactly as the user saw it. Checks ran on the un-mirrored frame.
    octx.translate(out.width, 0);
    octx.scale(-1, 1);
    octx.drawImage(frame, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, out.width, out.height);

    lastMetricsRef.current = {
      ...analysis.metrics,
      delegate: engine?.delegate,
      analysisMs: Math.round(emaRef.current),
      videoW: frame.width,
      videoH: frame.height,
    };
    captureReqRef.current = null;
    setBanner(null);
    setCaptured(out.toDataURL("image/jpeg", 0.9));
    goto("review");
  };

  const runAnalysis = (now) => {
    const video = videoRef.current;
    const engine = engineRef.current;
    if (!video || !engine || video.readyState < 2 || !video.videoWidth) return;

    const t0 = performance.now();
    const st = stageRef.current;
    // While capturing, analyse a still copy of the frame so the photo is exactly the checked frame
    const source = st === "verifying" ? grabFullFrame(video) : video;
    let result;
    try {
      result = engine.landmarker.detectForVideo(source, nextTimestamp());
    } catch (e) {
      return; // transient frame error
    }
    const analysis = analyzeFrame(result, grabPixels(source, video.videoWidth, video.videoHeight), video.videoWidth, video.videoHeight, prevNoseRef.current);
    prevNoseRef.current = analysis.nose;

    // Natural blink tracking (eyes closed → open again)
    if (analysis.faceCount === 1) {
      const b = blinkRef.current;
      const l = analysis.blend.eyeBlinkLeft ?? 0;
      const r = analysis.blend.eyeBlinkRight ?? 0;
      if (l > THRESHOLDS.blinkClosed && r > THRESHOLDS.blinkClosed) b.closed = true;
      else if (b.closed && l < THRESHOLDS.blinkOpen && r < THRESHOLDS.blinkOpen) {
        b.closed = false;
        b.lastBlinkAt = now;
      }
    }

    // Raw eyewear / cap verdicts of recent judged frames (used at the click, see recentAppearanceIssue)
    if (analysis.faceCount === 1 && analysis.appearanceChecked) {
      const hist = appearanceHistoryRef.current;
      hist.push({ t: now, sunglasses: !!analysis.flags.sunglasses, glasses: !!analysis.flags.glasses, headwear: !!analysis.flags.headwear });
      while (hist.length && hist[0].t < now - RECENT_APPEARANCE_MS) hist.shift();
    }

    // While reviewing / uploading only keep watching the face: a swap marks the actions as broken
    if (st === "review" || st === "submitting") {
      const c = challengeRef.current;
      if (c && !trackContinuity(c, analysis, now)) c.broken = true;
      return;
    }

    // "Click Selfie" pressed: take the first frame that passes the photo checks
    if (st === "verifying") {
      const c = challengeRef.current;
      const req = captureReqRef.current;
      if (!c || !req) return;
      if (!trackContinuity(c, analysis, now)) {
        captureReqRef.current = null;
        abortToLive("We lost track of your face. Keep your face in the oval and repeat the quick actions.");
        return;
      }
      const failed =
        FINAL_PHOTO_CHECKS.find((k) => analysis.flags[k]) ||
        // The photo's own frame must be judged (frontal, lit) and free of eyewear / cap…
        (!analysis.appearanceChecked ? "notStraight" : APPEARANCE_PHOTO_CHECKS.find((k) => analysis.flags[k])) ||
        // …and so must the last moments before it (catches glasses put on just before the click)
        recentAppearanceIssue(now);
      if (!failed) {
        finalizeCapture(source, analysis);
        return;
      }
      req.lastIssue = failed;
      if (now - req.startedAt > CAPTURE_WAIT_MS) {
        // Liveness stays valid — let the user simply click again
        captureReqRef.current = null;
        setBanner({ type: "error", text: `Photo not clear: ${ISSUE_MESSAGES[failed]}. Please click again.` });
        viewKeyRef.current = "";
        goto("ready");
      }
      return;
    }

    const flags = smootherRef.current.push(analysis.flags, now, analysis.appearanceChecked !== false);
    const allIssues = orderedIssues(flags);
    const blockingSet = st === "ready" ? READY_BLOCKING_ISSUES : BLOCKING_ISSUES;
    const issues = allIssues.filter((k) => blockingSet.includes(k));
    const tips = allIssues.filter((k) => TIP_ISSUES.includes(k) && !(st === "ready" && k === "notStraight"));

    // Adaptive rate: slower devices analyse less often so the preview stays smooth
    const dt = performance.now() - t0;
    emaRef.current = emaRef.current * 0.8 + dt * 0.2;
    intervalRef.current = Math.min(320, Math.max(90, emaRef.current * 3));

    if (st === "live") {
      // Exactly one face in THIS frame too (the smoothed flags lag a few hundred ms)
      if (issues.length === 0 && analysis.faceCount === 1) {
        if (stableSinceRef.current === null) stableSinceRef.current = now;
      } else {
        stableSinceRef.current = null;
      }
      // Fetch the liveness challenge in the background so the actions start without a wait
      if (analysis.faceCount >= 1 && locationRef.current.granted) prefetchChallenge();
      publishView(issues, false, tips);
      publishNudge(tips.includes("notCentered") ? analysis : null, video);
      // Blocking checks steady → start the quick liveness actions automatically
      const steady = stableSinceRef.current !== null && now - stableSinceRef.current >= STABLE_MS;
      if (steady && now >= cooldownUntilRef.current && locationRef.current.granted) startChallenge();
      return;
    }

    if (st === "challenge") {
      const c = challengeRef.current;
      if (!c) return;
      if (!trackContinuity(c, analysis, now)) {
        abortToLive("We lost track of your face. Keep your face in the oval and repeat the quick actions.");
        return;
      }
      publishView(issues.filter((k) => CRITICAL_DURING_CHALLENGE.includes(k)), false);

      const critical = CRITICAL_DURING_CHALLENGE.find((k) => flags[k]);
      if (critical) {
        if (c.lostSince === null) c.lostSince = now;
        if (now - c.lostSince > LOST_ABORT_MS) abortToLive(`Liveness check stopped: ${ISSUE_MESSAGES[critical]}.`);
        return;
      }
      c.lostSince = null;

      if (now - c.stepStartedAt > STEP_TIMEOUT_MS) {
        abortToLive("We couldn't detect the movement in time. Let's try again — follow the instruction on the camera.");
        return;
      }

      // After a left/right turn the user must face the camera again before continuing
      if (c.centering) {
        c.straightFrames = isFacingStraight(analysis) ? (c.straightFrames || 0) + 1 : 0;
        if (c.straightFrames < 2) return;
        c.centering = false;
        c.straightFrames = 0;
        c.stepStartedAt = now;
        if (c.index >= c.steps.length) {
          finishChallenge(c, now);
        } else {
          setChallengeView({ steps: c.steps, index: c.index, done: false, centering: false });
        }
        return;
      }

      const step = c.steps[c.index];
      if (updateChallengeStep(step, analysis, c.stepState)) {
        c.completed.push(step);
        c.completedAt.push(new Date().toISOString());
        c.index += 1;
        c.stepState = {};
        c.stepStartedAt = now;
        if (step === "turn_left" || step === "turn_right") {
          c.centering = true;
          c.straightFrames = 0;
          setChallengeView({ steps: c.steps, index: c.index, done: false, centering: true });
        } else if (c.index >= c.steps.length) {
          finishChallenge(c, now);
        } else {
          setChallengeView({ steps: c.steps, index: c.index, done: false, centering: false });
        }
      }
      return;
    }

    if (st === "ready") {
      const c = challengeRef.current;
      if (!c) return;
      if (!trackContinuity(c, analysis, now)) {
        abortToLive("We lost track of your face. Keep your face in the oval and repeat the quick actions.");
        return;
      }
      const msLeft = Math.min(CLICK_WINDOW_MS - (now - c.doneAt), CHALLENGE_MAX_AGE_MS - (now - c.issuedAt));
      if (msLeft <= 0) {
        abortToLive("Time's up — please repeat the quick actions, then click the selfie within 30 seconds.");
        return;
      }
      // A natural blink must have happened recently (a printed photo can't blink)
      const readyIssues = now - blinkRef.current.lastBlinkAt > BLINK_RECENT_MS ? [...issues, "needBlink"] : issues;
      // "Click Selfie" is enabled only while every blocking check passes
      publishView(readyIssues, readyIssues.length === 0, tips, Math.ceil(msLeft / 1000));
      publishNudge(tips.includes("notCentered") ? analysis : null, video);
    }
  };

  /** Eyewear / cap seen in too many of the last RECENT_APPEARANCE_MS of judged frames, or null. */
  function recentAppearanceIssue(now) {
    const recent = appearanceHistoryRef.current.filter((h) => h.t >= now - RECENT_APPEARANCE_MS);
    if (!recent.length) return null;
    return APPEARANCE_PHOTO_CHECKS.find((k) => recent.filter((h) => h[k]).length / recent.length >= RECENT_APPEARANCE_MAX) || null;
  }

  /** Actions completed: grab the action frame, start the click window, enable the button stage. */
  function finishChallenge(c, now) {
    c.keyframe = grabKeyframe();
    c.doneAt = now;
    if (!c.keyframe) {
      abortToLive("Couldn't record the liveness check. Please repeat the quick actions.");
      return;
    }
    setChallengeView({ steps: c.steps, index: c.index, done: true, centering: false });
    viewKeyRef.current = "";
    goto("ready");
  }
  runAnalysisRef.current = runAnalysis;

  useEffect(() => {
    if (engineState !== "ready" || !videoDims) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      rafRef.current = requestAnimationFrame(tick);
      if (!RUN_STAGES.includes(stageRef.current)) return;
      const now = performance.now();
      if (now - lastRunRef.current < intervalRef.current) return;
      lastRunRef.current = now;
      runAnalysisRef.current?.(now);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [engineState, videoDims]);

  // ─── Actions ──────────────────────────────────────────────────────────
  const authHeaders = () => {
    const token = resolveToken(authToken);
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };

  const canClickSelfie = stage === "ready" && engineState === "ready" && location.granted && view.ready;

  const fetchChallenge = async () => {
    const appId = resolveAppId(applicationId) || "";
    const res = await fetch(`${API_BASE_URL}/api/digio/selfie-challenge?applicationId=${encodeURIComponent(appId)}`, {
      headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error(SESSION_EXPIRED_MSG);
    if (!res.ok || !data.success || !Array.isArray(data.steps)) throw new Error(data.error || "Could not start the liveness check. Please try again.");
    return data;
  };

  /** Starts fetching a challenge in the background unless a fresh one is already on its way. */
  function prefetchChallenge() {
    const p = prefetchRef.current;
    if (p && performance.now() - p.at < CHALLENGE_PREFETCH_MAX_AGE_MS) return;
    const entry = { at: performance.now(), promise: fetchChallenge() };
    entry.promise.catch(() => {
      if (prefetchRef.current === entry) prefetchRef.current = null;
    });
    prefetchRef.current = entry;
  }

  const startChallenge = async () => {
    if (stageRef.current !== "live") return;
    setBanner(null);
    goto("challengeLoading");
    try {
      // Use the prefetched challenge when it is fresh (each challenge is used only once)
      let entry = prefetchRef.current;
      prefetchRef.current = null;
      if (!entry || performance.now() - entry.at >= CHALLENGE_PREFETCH_MAX_AGE_MS) {
        entry = { at: performance.now(), promise: fetchChallenge() };
      }
      const data = await entry.promise;
      if (!mountedRef.current || stageRef.current !== "challengeLoading") return;

      challengeRef.current = {
        token: data.challengeToken,
        steps: data.steps,
        index: 0,
        stepState: {},
        // Counted from when the server issued it, so the token never expires mid-capture
        issuedAt: entry.at,
        stepStartedAt: performance.now(),
        completed: [],
        completedAt: [],
        lostSince: null,
      };
      setChallengeView({ steps: data.steps, index: 0, done: false });
      startRecording();
      goto("challenge");
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err?.name === "TypeError" ? "Network error. Check your internet connection and try again." : err.message;
      abortToLive(msg);
      cooldownUntilRef.current = performance.now() + 5000;
    }
  };

  const clickSelfie = () => {
    if (!canClickSelfie || !engineRef.current) return;
    captureReqRef.current = { startedAt: performance.now(), lastIssue: null };
    setBanner(null);
    goto("verifying");
  };

  // Auto-capture: once the liveness actions are done and every check keeps passing for
  // AUTO_CAPTURE_MS, the photo is taken by itself (same path as pressing "Click Selfie").
  // Any check failing in between (canClickSelfie → false) restarts the wait.
  const clickSelfieRef = useRef(null);
  clickSelfieRef.current = clickSelfie;
  useEffect(() => {
    if (!canClickSelfie) return;
    const timer = setTimeout(() => clickSelfieRef.current?.(), AUTO_CAPTURE_MS);
    return () => clearTimeout(timer);
  }, [canClickSelfie]);

  /** Sends the session video of a saved selfie in the background (never blocks the user). */
  const uploadSessionVideo = (videoToken, videoPromise) => {
    if (!videoToken) return;
    const headers = authHeaders();
    videoPromise
      .then((video) => {
        if (!video) return null;
        return fetch(`${API_BASE_URL}/api/digio/selfie-video`, {
          method: "POST",
          headers,
          body: JSON.stringify({ videoToken, video }),
        });
      })
      .catch((e) => console.warn("[LiveSelfie] Session video upload failed:", e?.message));
  };

  /** The completed actions can be reused only if the same face stayed in view and time is left. */
  const actionsStillValid = (c) => {
    if (!c || c.broken || !c.doneAt) return false;
    const now = performance.now();
    return now - c.doneAt < CLICK_WINDOW_MS && now - c.issuedAt < CHALLENGE_MAX_AGE_MS;
  };

  // Retake keeps the completed liveness check while it is still valid
  const retake = () => {
    setCaptured(null);
    setBanner(null);
    if (actionsStillValid(challengeRef.current)) {
      viewKeyRef.current = "";
      goto("ready");
    } else {
      abortToLive("Please repeat the quick actions, then click the selfie.");
    }
  };

  const submit = async () => {
    const c = challengeRef.current;
    if (!captured || !c) return;
    setBanner(null);
    goto("submitting");

    let coords;
    try {
      coords = await location.getFreshPosition();
    } catch (e) {
      if (!mountedRef.current) return;
      setCaptured(null);
      abortToLive(
        e?.status === "denied"
          ? "Location permission was turned off. The selfie can't be taken without your location."
          : "Couldn't read your location. Please make sure Location/GPS is on and try again.",
      );
      return;
    }

    // The session video is NOT sent with the selfie (a large upload would delay verification);
    // it is snapshotted now and uploaded in the background once the selfie is saved.
    const videoSnapshot = snapshotVideo().catch(() => null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/digio/selfie-capture`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          applicationId: resolveAppId(applicationId),
          selfie: captured,
          location: { lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy },
          challengeToken: c.token,
          challenge: { completed: c.completed, completedAt: c.completedAt },
          challengeFrame: c.keyframe,
          clientChecks: lastMetricsRef.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error(SESSION_EXPIRED_MSG);
      if (!res.ok || !data.success) {
        throw Object.assign(new Error(data.error || "Selfie verification failed. Please try again."), { code: data.code });
      }
      if (!mountedRef.current) return;

      savedResultRef.current = data;
      uploadSessionVideo(data.videoToken, videoSnapshot);
      cancelAnimationFrame(rafRef.current);
      stopRecording();
      stopCamera();
      goto("done"); // shows "Selfie saved successfully", then hands the result to the parent
    } catch (err) {
      if (!mountedRef.current) return;
      setCaptured(null);
      const msg = err?.name === "TypeError" ? "Network error. Check your internet connection and try again." : err.message;
      // Photo-quality failures: keep the completed liveness actions and let the user click again
      const live = challengeRef.current;
      if (RETAKE_CODES.includes(err?.code) && actionsStillValid(live)) {
        setBanner({ type: "error", text: msg, ttl: SERVER_BANNER_MS });
        viewKeyRef.current = "";
        goto("ready");
        return;
      }
      abortToLive(msg, SERVER_BANNER_MS);
    }
  };

  // Hand the saved result to the parent exactly once (Continue button or auto after a moment)
  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onSuccess?.(savedResultRef.current);
  };
  finishRef.current = finish;

  const cancel = () => {
    cancelAnimationFrame(rafRef.current);
    stopRecording();
    stopCamera();
    onCancel?.();
  };

  const retryFatal = () => {
    if (fatal?.kind === "unsupported") return;
    startCamera();
  };

  // ─── Render helpers ───────────────────────────────────────────────────
  const issues = view.issues;
  const primaryIssue = issues[0];
  // Still fetching the first location fix: the camera stays visible (with a short note); only a
  // real problem (blocked / off / failed / needs a tap) covers it with the location panel.
  const locationPending = !location.granted && ["checking", "requesting"].includes(location.status);
  const locationBlocked = !location.granted && !locationPending && stage !== "location";
  const cameraStages = ["starting", "live", "challengeLoading", "challenge", "ready", "verifying"];
  const firstTip = view.tips?.[0];
  const showCamera = cameraStages.includes(stage);

  let statusText = "";
  let statusTone = "info";
  if (stage === "starting") statusText = "Starting camera…";
  else if (engineState === "loading") statusText = "Loading face detection…";
  else if (engineState === "failed") {
    statusText = "Face detection unavailable";
    statusTone = "warn";
  }
  else if (locationPending && (stage === "live" || stage === "ready")) statusText = "Getting your location…";
  else if (stage === "challengeLoading") statusText = "Get ready for a quick check…";
  else if (stage === "challenge" && challengeView) {
    if (primaryIssue) {
      statusText = ISSUE_MESSAGES[primaryIssue];
      statusTone = "warn";
    } else if (challengeView.centering) {
      statusText = LOOK_STRAIGHT_TEXT;
      statusTone = "action";
    } else {
      statusText = CHALLENGE_TEXT[challengeView.steps[challengeView.index]] || "";
      statusTone = "action";
    }
  } else if (stage === "verifying") statusText = "Checking photo…";
  else if (stage === "live" || stage === "ready") {
    if (primaryIssue) {
      statusText = ISSUE_MESSAGES[primaryIssue];
      statusTone = "warn";
    } else if (firstTip) {
      statusText = `Tip: ${ISSUE_MESSAGES[firstTip]}`;
    } else if (stage === "live") {
      statusText = "Hold still…";
    } else {
      statusText = "All good — tap Click Selfie";
      statusTone = "ok";
    }
  }

  const ovalColor =
    stage === "challenge" ? "#4da3ff"
      : primaryIssue && (stage === "live" || stage === "ready") ? "#f5a623"
      : stage === "ready" ? "#9fe870"
      : "rgba(255,255,255,0.7)";

  const oval = videoDims ? getOvalGeometry(videoDims.w, videoDims.h) : null;
  // Compact portrait preview, similar in size to the Digio selfie window
  const cameraBoxStyle = { width: `min(100%, ${variant === "page" ? 320 : 280}px)`, aspectRatio: "3 / 4" };

  let buttonLabel = "📸 Click Selfie";
  if (locationPending) buttonLabel = "Getting your location…";
  else if (!location.granted) buttonLabel = "Location required";
  else if (engineState === "loading" || stage === "starting") buttonLabel = "Getting ready…";
  else if (engineState === "failed") buttonLabel = "Face detection unavailable";
  else if (stage === "live" || stage === "challengeLoading" || stage === "challenge") buttonLabel = "Complete the quick check first";
  else if (stage === "verifying") buttonLabel = "Checking photo…";
  else if (!view.ready) buttonLabel = issues.length === 1 && issues[0] === "needBlink" ? "Blink once to enable" : "Fix the highlighted items";
  else if (canClickSelfie) buttonLabel = "📸 Hold still — capturing…";

  const checklistState = (item) => {
    if (engineState !== "ready" || !LOOP_STAGES.includes(stage)) return "pending";
    if (item.key !== "single" && issues.includes("noFace")) return "pending";
    return item.issues.some((k) => issues.includes(k)) ? "bad" : "ok";
  };
  const livenessState = stage === "ready" || stage === "verifying" ? "ok" : stage === "challenge" ? "active" : "pending";

  // Visual + voice guide (display only — follows the checks above, never changes them)
  const guideCue = !showCamera || locationBlocked ? null
    : locationPending ? "location"
    : getGuideCue({
        stage,
        engineState,
        locationGranted: location.granted,
        challengeView,
        issues,
        tips: view.tips,
        nudge,
        ready: view.ready,
      });
  const guideVoice = useGuideVoice(guideCue, guidePrefs.lang, guidePrefs.muted);
  // Wide layout (camera | guide) while the camera or the captured photo is shown
  const twoColumn = showCamera || stage === "review" || stage === "submitting";

  const content = (
    <div
      className={`lsc-root lsc-${variant}`}
      role="dialog"
      aria-modal={variant === "modal"}
      aria-label="Selfie capture"
      onPointerDownCapture={guideVoice.prime}
    >
      <style>{STYLES + GUIDE_STYLES}</style>
      <div className={`lsc-panel ${twoColumn ? "lsc-panel-wide" : ""}`}>
        <div className="lsc-header">
          <div className="lsc-header-main">
            <span className="lsc-header-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
                <circle cx="12" cy="11" r="3" />
                <path d="M7.5 17.5c1-2 2.6-3 4.5-3s3.5 1 4.5 3" />
              </svg>
            </span>
            <div>
              <h2 className="lsc-title">
                Live Selfie
                {showCamera && <span className="lsc-live"><span className="lsc-live-dot" />Live</span>}
              </h2>
              <p className="lsc-sub">Real-time checks keep your KYC photo clear and valid.</p>
            </div>
          </div>
          {onCancel && stage !== "submitting" && stage !== "done" && (
            <button type="button" className="lsc-close" onClick={cancel} aria-label="Close selfie capture">×</button>
          )}
        </div>

        <div className={`lsc-body ${twoColumn ? "lsc-two" : ""}`}>
        <div className="lsc-main">
        {/* ── Location gate ── */}
        {stage === "location" && (
          <LocationPanel location={location} platform={platform} />
        )}

        {/* ── Fatal errors (camera / browser) ── */}
        {stage === "error" && fatal && (
          <div className="lsc-card lsc-center">
            <div className="lsc-icon lsc-icon-bad">!</div>
            <h3 className="lsc-h3">{fatal.title}</h3>
            <p className="lsc-text">{fatal.message}</p>
            {fatal.help && <p className="lsc-help">{fatal.help}</p>}
            {fatal.kind === "camera_denied" && <p className="lsc-help">This screen continues automatically once camera access is allowed.</p>}
            <div className="lsc-actions">
              {fatal.kind !== "unsupported" && fatal.kind !== "no_camera" && (
                <button type="button" className="lsc-btn lsc-btn-primary" onClick={retryFatal}>Retry</button>
              )}
              {onCancel && <button type="button" className="lsc-btn lsc-btn-ghost" onClick={cancel}>Close</button>}
            </div>
          </div>
        )}

        {/* ── Camera (kept mounted so the video element always exists) ── */}
        <div className="lsc-camera-wrap" style={{ display: showCamera ? "flex" : "none" }}>
          <div className="lsc-stage" style={{ width: cameraBoxStyle.width }}>
          <div className={`lsc-camera lsc-cam-${stage}`} style={{ ...cameraBoxStyle, width: "100%" }}>
            <video ref={videoRef} className="lsc-video" playsInline muted autoPlay />
            {oval && (
              <svg className="lsc-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <mask id="lsc-oval-mask">
                    <rect x="0" y="0" width="100" height="100" fill="white" />
                    <ellipse cx={oval.overlay.cx} cy={oval.overlay.cy} rx={oval.overlay.rx} ry={oval.overlay.ry} fill="black" />
                  </mask>
                </defs>
                <rect x="0" y="0" width="100" height="100" fill="rgba(0,0,0,0.45)" mask="url(#lsc-oval-mask)" />
                {/* Soft glow under the oval line */}
                <ellipse
                  className="lsc-oval-glow"
                  cx={oval.overlay.cx}
                  cy={oval.overlay.cy}
                  rx={oval.overlay.rx}
                  ry={oval.overlay.ry}
                  fill="none"
                  stroke={ovalColor}
                  strokeWidth="10"
                  vectorEffect="non-scaling-stroke"
                />
                <ellipse
                  className="lsc-oval-line"
                  cx={oval.overlay.cx}
                  cy={oval.overlay.cy}
                  rx={oval.overlay.rx}
                  ry={oval.overlay.ry}
                  fill="none"
                  stroke={ovalColor}
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                  style={{ transition: "stroke 0.25s" }}
                />
              </svg>
            )}

            {/* Auto-capture countdown + shutter flash (visual only) */}
            {canClickSelfie && (
              <div className="lsc-auto" aria-hidden="true">
                <span className="lsc-auto-label">Hold still…</span>
                <span className="lsc-auto-bar"><span style={{ animationDuration: `${AUTO_CAPTURE_MS}ms` }} /></span>
              </div>
            )}
            {stage === "verifying" && <span className="lsc-flash" aria-hidden="true" />}

            <GuideArrows cue={guideCue} />

            {(stage === "starting" || engineState === "loading") && (
              <div className="lsc-veil"><div className="lsc-spinner" /></div>
            )}

            {locationBlocked && (
              <div className="lsc-veil lsc-veil-solid">
                <LocationPanel location={location} platform={platform} compact />
              </div>
            )}
          </div>
          </div>
        </div>

        {/* ── Saved confirmation ── */}
        {stage === "done" && (
          <div className="lsc-card lsc-center">
            <div className="lsc-icon lsc-icon-ok">✓</div>
            <h3 className="lsc-h3">Selfie saved successfully</h3>
            <p className="lsc-text">Your selfie and location have been captured and saved.</p>
            {captured && <img src={captured} alt="Saved selfie" className="lsc-done-img" />}
            <div className="lsc-actions">
              <button type="button" className="lsc-btn lsc-btn-primary lsc-btn-wide" onClick={finish}>Continue</button>
            </div>
          </div>
        )}

        {/* ── Review / submitting ── */}
        {(stage === "review" || stage === "submitting") && captured && (
          <div className="lsc-camera-wrap" style={{ display: "flex" }}>
            <div className="lsc-camera" style={cameraBoxStyle}>
              <img src={captured} alt="Captured selfie" className="lsc-video lsc-review-img" />
              {stage === "submitting" && (
                <div className="lsc-veil lsc-veil-solid">
                  <div className="lsc-spinner" />
                  <p className="lsc-veil-text">Verifying liveness &amp; face match…</p>
                </div>
              )}
            </div>
          </div>
        )}
        </div>

        <div className="lsc-side">
        {/* ── Guide: head on its own + instruction, voice controls and progress ── */}
        {showCamera && (
          <div className="lsc-guide-card">
            <GuideHeadCoin cue={guideCue} />
            <GuideCaption
              cue={guideCue}
              fallbackText={statusText}
              fallbackTone={statusTone}
              prefs={guidePrefs}
              setPrefs={setGuidePrefs}
              voice={guideVoice}
              progress={challengeView && (stage === "challenge" || stage === "ready")
                ? { steps: challengeView.steps, index: challengeView.index, done: challengeView.done, centering: challengeView.centering, secondsLeft: view.secondsLeft }
                : null}
            />
          </div>
        )}
        {stage === "review" && (
          <div className="lsc-review-note">
            <h3 className="lsc-h3">Looks good?</h3>
            <p className="lsc-text">Check that your face is clear, well-lit and fully visible. Submit it, or retake if you are not happy with it.</p>
          </div>
        )}
        {stage === "submitting" && (
          <div className="lsc-review-note">
            <h3 className="lsc-h3">Submitting…</h3>
            <p className="lsc-text">Verifying liveness and face match. This takes a few seconds.</p>
          </div>
        )}

        {showCamera && engineState === "ready" && LOOP_STAGES.includes(stage) && issues.some((k) => DETECTED_LABELS[k]) && (
          <div className="lsc-alerts" role="alert" aria-live="assertive">
            {issues.filter((k) => DETECTED_LABELS[k]).map((k) => (
              <span key={k} className="lsc-alert-chip">⚠ {DETECTED_LABELS[k]}</span>
            ))}
          </div>
        )}

        {banner && <div className={`lsc-banner lsc-banner-${banner.type}`} role="alert">{banner.text}</div>}

        {engineState === "failed" && showCamera && (
          <div className="lsc-banner lsc-banner-error" role="alert">
            Face detection couldn't load. Check your connection and{" "}
            <button type="button" className="lsc-link" onClick={loadEngine}>retry</button>.
          </div>
        )}

        {/* ── Checklist ── */}
        {showCamera && (
          <ul className="lsc-checklist">
            <li className={`lsc-check ${location.granted ? "ok" : locationPending ? "" : "bad"}`}>
              <span className="lsc-check-icon">{location.granted ? "✓" : locationPending ? "…" : "✕"}</span>Location on
            </li>
            {CHECKLIST.map((item) => {
              const st = checklistState(item);
              return (
                <li key={item.key} className={`lsc-check ${st}`}>
                  <span className="lsc-check-icon">{st === "ok" ? "✓" : st === "bad" ? "✕" : "•"}</span>
                  {st === "bad" ? DETECTED_LABELS[item.issues.find((k) => issues.includes(k))] || item.label : item.label}
                </li>
              );
            })}
            <li className={`lsc-check ${livenessState === "ok" ? "ok" : ""}`}>
              <span className="lsc-check-icon">{livenessState === "ok" ? "✓" : livenessState === "active" ? "…" : "•"}</span>
              Liveness check
            </li>
          </ul>
        )}

        {/* ── Actions ── */}
        {showCamera && (
          <div className="lsc-actions">
            <button
              type="button"
              className="lsc-btn lsc-btn-primary lsc-btn-wide"
              onClick={clickSelfie}
              disabled={!canClickSelfie}
              aria-disabled={!canClickSelfie}
            >
              {buttonLabel}
            </button>
          </div>
        )}
        {stage === "review" && (
          <div className="lsc-actions">
            <button type="button" className="lsc-btn lsc-btn-ghost" onClick={retake}>Retake</button>
            <button type="button" className="lsc-btn lsc-btn-primary" onClick={submit}>Submit Selfie</button>
          </div>
        )}
        {stage === "live" && (
          <p className="lsc-footnote">First do two quick actions shown on the camera (like turning your head or blinking). Your photo is then taken automatically.</p>
        )}
        </div>
        </div>
      </div>
    </div>
  );

  if (variant === "modal" && typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}

// ─── Location panel ─────────────────────────────────────────────────────
function LocationPanel({ location, platform, compact = false }) {
  const { status, deniedReason, request } = location;
  const help = LOCATION_HELP[platform];

  if (status === "checking" || status === "requesting") {
    return (
      <div className={`lsc-card lsc-center ${compact ? "lsc-compact" : ""}`}>
        <div className="lsc-spinner lsc-spinner-dark" />
        <p className="lsc-text">
          {status === "checking" ? "Checking location permission…" : "Getting your location… If your browser asks, tap “Allow”."}
        </p>
      </div>
    );
  }

  let title = "Location access needed";
  let message = "As per KYC regulations your live location is recorded with your selfie. Please allow location access when your browser asks.";
  let showHelp = false;
  let buttonText = "Allow Location";

  if (status === "denied" && deniedReason === "dismissed") {
    title = "Location permission cancelled";
    message = "You closed the location request. The selfie can't be taken without your location.";
    buttonText = "Allow Location";
  } else if (status === "denied") {
    title = "Location permission blocked";
    message = "Location is blocked for this site, so the selfie can't be taken. Enable it in your settings — this screen continues automatically once it's allowed.";
    showHelp = true;
    buttonText = "I've enabled it — Retry";
  } else if (status === "unavailable") {
    title = "Couldn't get your location";
    message = "Location permission is allowed, but your device location (GPS) seems to be off. Turn it on and retry.";
    showHelp = true;
    buttonText = "Retry";
  } else if (status === "timeout") {
    title = "Location is taking too long";
    message = "We couldn't get your location in time. Move near a window or check that GPS / Wi-Fi is on, then retry.";
    buttonText = "Retry";
  } else if (status === "unsupported") {
    title = "Location not supported";
    message = "This browser doesn't support location. Please use the latest Chrome or Safari.";
    buttonText = null;
  }

  return (
    <div className={`lsc-card lsc-center ${compact ? "lsc-compact" : ""}`}>
      <div className={`lsc-icon ${status === "prompt" ? "lsc-icon-info" : "lsc-icon-bad"}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </div>
      <h3 className="lsc-h3">{title}</h3>
      <p className="lsc-text">{message}</p>
      {showHelp && <p className="lsc-help">{help}</p>}
      {buttonText && (
        <div className="lsc-actions">
          <button type="button" className="lsc-btn lsc-btn-primary" onClick={request}>{buttonText}</button>
        </div>
      )}
    </div>
  );
}

// ─── Styles (scoped by the lsc- prefix) ─────────────────────────────────
const STYLES = `
.lsc-root { font-family: inherit; color: var(--text-primary, #0e0f0c);
  --lsc-surface: var(--bg-primary, #ffffff); --lsc-soft: var(--bg-secondary, #f4f6f3); --lsc-line: var(--border-color, #e5e7eb);
  --lsc-text: var(--text-primary, #0e0f0c); --lsc-muted: var(--text-muted, #6b7280); --lsc-green: var(--wise-green, #9fe870); --lsc-forest: var(--wise-dark-green, #163300); }
.lsc-modal { position: fixed; inset: 0; z-index: 10000; background: rgba(14,15,12,0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto; }
.lsc-panel { position: relative; background: var(--lsc-surface); color: var(--lsc-text); }
.lsc-modal .lsc-panel { width: 100%; max-width: 400px; max-height: calc(100vh - 40px); overflow-y: auto; border-radius: 28px; padding: 20px; box-shadow: 0 30px 80px rgba(14,15,12,0.28); animation: lsc-in 0.35s cubic-bezier(.2,.9,.3,1); transition: max-width 0.3s ease; }
.lsc-modal .lsc-panel.lsc-panel-wide { max-width: 780px; }
.lsc-page .lsc-panel { width: 100%; max-width: 780px; margin: 0 auto; padding: 20px 16px; border-radius: 24px; }
@media (max-width: 760px) {
  .lsc-modal .lsc-panel.lsc-panel-wide { max-width: 420px; }
}
@media (max-width: 600px) {
  .lsc-modal { padding: 0; align-items: stretch; }
  .lsc-modal .lsc-panel, .lsc-modal .lsc-panel.lsc-panel-wide { max-width: none; max-height: none; min-height: 100%; border-radius: 0; padding: 16px; animation: none; }
}

/* Header */
.lsc-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.lsc-header-main { display: flex; align-items: center; gap: 12px; min-width: 0; }
.lsc-header-icon { width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--lsc-green); color: var(--lsc-forest); }
.lsc-title { display: flex; align-items: center; gap: 8px; font-size: 1.15rem; font-weight: 800; letter-spacing: -0.2px; margin: 0; color: var(--lsc-text); }
.lsc-live { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px 3px 8px; border-radius: 999px; font-size: 0.66rem; font-weight: 800; color: #dc2626; background: rgba(239,68,68,0.1); }
.lsc-live-dot { width: 6px; height: 6px; border-radius: 50%; background: #ef4444; animation: lsc-live 1.4s ease-in-out infinite; }
.lsc-sub { margin: 3px 0 0; font-size: 0.78rem; color: var(--lsc-muted); }
.lsc-close { background: var(--lsc-soft); border: none; width: 36px; height: 36px; border-radius: 50%; font-size: 1.35rem; line-height: 1; cursor: pointer; color: var(--lsc-text); flex-shrink: 0; transition: background 0.2s, transform 0.15s; }
.lsc-close:hover { background: var(--lsc-line); }
.lsc-close:active { transform: scale(0.92); }

/* Layout: camera | guide */
.lsc-body { display: flex; flex-direction: column; }
.lsc-two { display: grid; grid-template-columns: minmax(0, 340px) minmax(0, 1fr); gap: 22px; align-items: start; }
.lsc-main, .lsc-side { min-width: 0; }
@media (max-width: 760px) { .lsc-two { display: flex; flex-direction: column; align-items: stretch; gap: 0; } }
.lsc-guide-card { padding: 18px 16px 16px; border-radius: 22px; background: linear-gradient(180deg, rgba(159,232,112,0.16) 0%, rgba(159,232,112,0) 55%), var(--lsc-surface); border: 1px solid var(--lsc-line); }
@media (max-width: 760px) { .lsc-guide-card { margin-top: 14px; } }
.lsc-review-note { padding: 18px; border-radius: 20px; background: var(--lsc-soft); }
@media (max-width: 760px) { .lsc-review-note { margin-top: 14px; } }

/* Cards: location / errors / saved */
.lsc-card { background: var(--lsc-soft); border-radius: 22px; padding: 26px 20px; }
.lsc-card.lsc-compact { background: transparent; padding: 12px; color: #fff; }
.lsc-card.lsc-compact .lsc-text, .lsc-card.lsc-compact .lsc-h3 { color: #fff; }
.lsc-card.lsc-compact .lsc-help { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.1); }
.lsc-center { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.lsc-h3 { margin: 4px 0 0; font-size: 1.08rem; font-weight: 800; color: var(--lsc-text); }
.lsc-text { margin: 6px 0 0; font-size: 0.88rem; line-height: 1.55; color: var(--lsc-muted); max-width: 440px; }
.lsc-help { margin: 4px 0 0; font-size: 0.8rem; line-height: 1.55; color: var(--lsc-muted); background: var(--lsc-surface); border-radius: 14px; padding: 10px 12px; text-align: left; max-width: 440px; }
.lsc-icon { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.4rem; }
.lsc-icon-ok { background: var(--lsc-green); color: var(--lsc-forest); box-shadow: 0 0 0 8px rgba(159,232,112,0.22); animation: lsc-pop 0.5s cubic-bezier(.2,1.5,.4,1); }
.lsc-icon-bad { background: rgba(239,68,68,0.12); color: #dc2626; }
.lsc-icon-info { background: rgba(77,163,255,0.14); color: #2f7fd8; }
.lsc-done-img { width: 128px; height: 170px; object-fit: cover; border-radius: 18px; border: 3px solid var(--lsc-green); margin-top: 6px; }

/* Camera */
.lsc-camera-wrap { justify-content: center; }
.lsc-stage { margin: 0 auto; }
.lsc-camera { position: relative; background: #0e0f0c; border-radius: 26px; overflow: hidden; margin: 0 auto; box-shadow: 0 16px 40px rgba(14,15,12,0.22); }
.lsc-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
.lsc-review-img { transform: none; }
.lsc-overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.lsc-oval-glow { opacity: 0.2; transition: stroke 0.25s; }
.lsc-cam-challenge .lsc-oval-glow, .lsc-cam-ready .lsc-oval-glow { animation: lsc-glow 1.6s ease-in-out infinite; }
.lsc-auto { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 4; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; background: rgba(255,255,255,0.95); box-shadow: 0 6px 18px rgba(0,0,0,0.25); animation: lsc-rise 0.25s ease-out; }
.lsc-auto-label { font-size: 0.74rem; font-weight: 800; color: var(--lsc-forest); white-space: nowrap; }
.lsc-auto-bar { width: 96px; height: 5px; border-radius: 999px; background: rgba(22,51,0,0.15); overflow: hidden; }
.lsc-auto-bar span { display: block; height: 100%; width: 100%; border-radius: inherit; background: #30a46c; transform-origin: left; animation-name: lsc-fill; animation-timing-function: linear; animation-fill-mode: both; }
.lsc-flash { position: absolute; inset: 0; z-index: 5; pointer-events: none; background: #fff; animation: lsc-flash 0.55s ease-out forwards; }
.lsc-veil { position: absolute; inset: 0; z-index: 6; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: rgba(14,15,12,0.4); }
.lsc-veil-solid { background: rgba(14,15,12,0.85); overflow-y: auto; }
.lsc-veil-text { color: #fff; font-weight: 700; margin: 0; font-size: 0.9rem; }
.lsc-spinner { width: 38px; height: 38px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.3); border-top-color: var(--lsc-green); animation: lsc-spin 0.8s linear infinite; }
.lsc-spinner-dark { border-color: var(--lsc-line); border-top-color: #30a46c; }

/* Messages */
.lsc-banner { margin-top: 12px; padding: 11px 14px; border-radius: 14px; font-size: 0.85rem; font-weight: 600; line-height: 1.45; animation: lsc-rise 0.3s ease-out; }
.lsc-banner-error { background: rgba(239,68,68,0.08); color: #dc2626; border: 1px solid rgba(239,68,68,0.25); }
.lsc-banner-info { background: rgba(77,163,255,0.08); color: #2f7fd8; border: 1px solid rgba(77,163,255,0.25); }
.lsc-banner-success { background: rgba(48,164,108,0.1); color: #1f7a4f; border: 1px solid rgba(48,164,108,0.3); }
.lsc-alerts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.lsc-alert-chip { background: #dc2626; color: #fff; font-weight: 800; font-size: 0.8rem; padding: 7px 12px; border-radius: 999px; animation: lsc-rise 0.3s ease-out; }
.lsc-link { background: none; border: none; padding: 0; color: inherit; text-decoration: underline; font: inherit; cursor: pointer; }

/* Checklist */
.lsc-checklist { list-style: none; padding: 0; margin: 14px 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.lsc-check { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px; font-size: 0.76rem; font-weight: 600; color: var(--lsc-muted); background: var(--lsc-soft); transition: background 0.3s, color 0.3s; }
.lsc-check-icon { width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.66rem; font-weight: 900; background: var(--lsc-line); color: var(--lsc-muted); flex-shrink: 0; transition: background 0.3s, transform 0.3s; }
.lsc-check.ok { color: var(--lsc-text); }
.lsc-check.ok .lsc-check-icon { background: var(--lsc-green); color: var(--lsc-forest); animation: lsc-pop 0.35s ease-out; }
.lsc-check.bad { color: #dc2626; background: rgba(239,68,68,0.07); }
.lsc-check.bad .lsc-check-icon { background: rgba(239,68,68,0.15); color: #dc2626; }

/* Buttons */
.lsc-actions { display: flex; gap: 10px; justify-content: center; margin-top: 16px; width: 100%; flex-wrap: wrap; }
.lsc-btn { height: 52px; padding: 0 22px; border-radius: 999px; font-weight: 800; font-size: 0.95rem; cursor: pointer; border: none; transition: opacity 0.2s, transform 0.12s, background 0.25s, box-shadow 0.25s; }
.lsc-btn:active:not(:disabled) { transform: scale(0.97); }
.lsc-btn-primary { background: var(--lsc-green); color: var(--lsc-forest); box-shadow: 0 8px 20px rgba(159,232,112,0.45); }
.lsc-btn-primary:hover:not(:disabled) { box-shadow: 0 10px 26px rgba(159,232,112,0.6); }
.lsc-btn-primary:disabled { background: var(--lsc-soft); color: var(--lsc-muted); box-shadow: none; cursor: not-allowed; }
.lsc-btn-ghost { background: var(--lsc-soft); color: var(--lsc-text); }
.lsc-btn-ghost:hover { background: var(--lsc-line); }
.lsc-btn-wide { width: 100%; }
.lsc-actions .lsc-btn:not(.lsc-btn-wide) { flex: 1 1 140px; }
.lsc-footnote { margin: 12px 0 0; font-size: 0.74rem; color: var(--lsc-muted); text-align: center; line-height: 1.5; }

@keyframes lsc-spin { to { transform: rotate(360deg); } }
@keyframes lsc-in { 0% { opacity: 0; transform: translateY(12px) scale(0.98); } 100% { opacity: 1; transform: none; } }
@keyframes lsc-live { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes lsc-flash { 0% { opacity: 0.85; } 100% { opacity: 0; } }
@keyframes lsc-glow { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.45; } }
@keyframes lsc-fill { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }
@keyframes lsc-pop { 0% { transform: scale(0.6); } 70% { transform: scale(1.12); } 100% { transform: scale(1); } }
@keyframes lsc-rise { 0% { transform: translateY(6px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
.lsc-auto { transform: translateX(-50%); }
@media (prefers-reduced-motion: reduce) {
  .lsc-live-dot, .lsc-oval-glow, .lsc-panel { animation: none !important; }
}
`;
