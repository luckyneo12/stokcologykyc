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
} from "./faceChecks";

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
const ANALYSIS_WIDTH = 240;
const STABLE_MS = 900; // blocking checks must pass continuously this long before the liveness actions start
const STEP_TIMEOUT_MS = 12000;
const LOST_ABORT_MS = 1500;
const RESTART_COOLDOWN_MS = 2500; // pause before auto-restarting the liveness actions after a failure
const CHALLENGE_MAX_AGE_MS = 150000; // server token lives 180s; redo the actions a little before that
const MAX_CAPTURE_SIDE = 1280;
const SESSION_EXPIRED_MSG = "Your session has expired. Please refresh the page (or scan the QR code again) and retry.";
const LOOP_STAGES = ["live", "challenge", "ready"];
// Only these disable the "Click Selfie" button: one face, no goggles, no cap.
const BLOCKING_ISSUES = ["noFace", "multipleFaces", "sunglasses", "headwear"];
// After the liveness actions the head must also face the camera (no left/right selfies).
// "needBlink": a natural blink is required shortly before clicking (a printed photo can't blink).
const READY_BLOCKING_ISSUES = [...BLOCKING_ISSUES, "turned", "needBlink"];
// Shown as tips only — they never disable the button.
// Lighting is a tip only: it is measured on skin (not beard) and never disables the button.
const TIP_ISSUES = ["tooDark", "backlit", "tooFar", "tooClose", "notCentered", "notStraight", "eyesClosed"];
// While turning/blinking only presence is enforced (a turned face skews appearance checks);
// the "ready" stage re-enforces every blocking check before the button enables.
const CRITICAL_DURING_CHALLENGE = ["noFace", "multipleFaces"];
// Re-checked on the exact photo after the button is pressed
const FINAL_PHOTO_CHECKS = ["noFace", "multipleFaces", "turned", "eyesClosed"];
// Server rejections where the user only needs to click the selfie again (liveness stays valid)
const RETAKE_CODES = ["FACE_MATCH_FAILED", "FACE_MATCH_LOW", "FACE_MATCH_UNAVAILABLE", "LIVENESS_FAILED", "LIVENESS_UNAVAILABLE", "NO_FACE", "MULTIPLE_FACES"];

// ── Anti-swap (someone doing the actions live, then holding up a photo) ──
const CLICK_WINDOW_MS = 30000; // the selfie must be clicked within this time after the actions
const BLINK_RECENT_MS = 6000; // …and a natural blink must have happened this recently
const CONTINUITY_LOST_MS = 700; // face may vanish only this long between the actions and the click
const CONTINUITY_MAX_JUMP = 0.35; // max face-centre move per analysis, as a fraction of face width
const CONTINUITY_MAX_SCALE = 1.35; // max face-size change per analysis
// The loop keeps watching the face during review / upload so a swap before a retake is caught
const RUN_STAGES = [...LOOP_STAGES, "review", "submitting"];
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

  const [stage, setStage] = useState("location"); // location | starting | live | challengeLoading | challenge | ready | verifying | review | submitting | done | error
  const [fatal, setFatal] = useState(null); // { kind, title, message, help }
  const [engineState, setEngineState] = useState("loading"); // loading | ready | failed
  const [view, setView] = useState({ issues: ["noFace"], ready: false });
  const [challengeView, setChallengeView] = useState(null); // { steps, index, done }
  const [banner, setBanner] = useState(null);
  const [captured, setCaptured] = useState(null);
  const [videoDims, setVideoDims] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const engineRef = useRef(null);
  const analysisCanvasRef = useRef(null);
  const rafRef = useRef(null);
  const stageRef = useRef("location");
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
  const locationRef = useRef(location);
  locationRef.current = location;

  const goto = useCallback((next) => {
    stageRef.current = next;
    setStage(next);
  }, []);

  // ─── Camera ───────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
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
      if (!mountedRef.current) {
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
      if (!mountedRef.current) return;
      if (!video.videoWidth) throw Object.assign(new Error("no frames"), { name: "AbortError" });

      setVideoDims({ w: video.videoWidth, h: video.videoHeight });
      smootherRef.current.reset();
      stableSinceRef.current = null;
      prevNoseRef.current = null;
      goto("live");
    } catch (err) {
      if (!mountedRef.current) return;
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
          } else if (p.state === "granted" && stageRef.current === "error" && locationRef.current.granted) {
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
      loadEngine(); // downloads in the background while the user handles the location prompt
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

  // Location granted → start camera (also covers "already granted" after a refresh)
  useEffect(() => {
    if (stage === "location" && location.granted) startCamera();
  }, [stage, location.granted, startCamera]);

  // Location revoked mid-capture → abort anything in progress; button stays disabled
  useEffect(() => {
    if (location.granted) return;
    if (["challengeLoading", "challenge", "ready", "review"].includes(stageRef.current)) {
      challengeRef.current = null;
      setChallengeView(null);
      setCaptured(null);
      setBanner({ type: "error", text: "Location access was turned off. The selfie can't be taken without your location." });
      goto("live");
    }
  }, [location.granted, goto]);

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
    if (rec.state === "recording") {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 800);
        rec.addEventListener("dataavailable", () => { clearTimeout(timer); setTimeout(resolve, 0); }, { once: true });
        try { rec.requestData(); } catch (e) { clearTimeout(timer); resolve(); }
      });
    }
    if (!videoChunksRef.current.length) return null;
    const blob = new Blob(videoChunksRef.current, { type: videoMimeRef.current.split(";")[0] });
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

  const abortToLive = useCallback((message) => {
    stopRecording();
    challengeRef.current = null;
    stableSinceRef.current = null;
    cooldownUntilRef.current = performance.now() + RESTART_COOLDOWN_MS;
    setChallengeView(null);
    if (message) setBanner({ type: "error", text: message });
    goto("live");
  }, [goto, stopRecording]);

  const captureFrame = () => {
    const video = videoRef.current;
    const engine = engineRef.current;
    if (!video || !engine) return;
    goto("verifying");

    // Save exactly what the user sees: the 3:4 preview window, centre-cropped from the frame
    const { crop } = getOvalGeometry(video.videoWidth, video.videoHeight);
    const scale = Math.min(1, MAX_CAPTURE_SIDE / Math.max(crop.sw, crop.sh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(crop.sw * scale);
    canvas.height = Math.round(crop.sh * scale);
    canvas.getContext("2d").drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);

    // Re-check the exact photo that will be uploaded
    let analysis;
    try {
      const result = engine.landmarker.detectForVideo(canvas, nextTimestamp());
      analysis = analyzeFrame(result, grabPixels(canvas, canvas.width, canvas.height), canvas.width, canvas.height, null);
    } catch (e) {
      analysis = null;
    }
    const failed = analysis ? FINAL_PHOTO_CHECKS.find((k) => analysis.flags[k]) : "noFace";
    if (failed) {
      // Liveness stays valid — let the user simply click again
      setBanner({ type: "error", text: `Photo not clear: ${ISSUE_MESSAGES[failed]}. Please click again.` });
      viewKeyRef.current = "";
      goto("ready");
      return;
    }

    lastMetricsRef.current = {
      ...analysis.metrics,
      delegate: engine.delegate,
      analysisMs: Math.round(emaRef.current),
      videoW: video.videoWidth,
      videoH: video.videoHeight,
    };
    // The live preview is mirrored (like a mirror); save the photo the same way so it looks
    // exactly as the user saw it. Checks above ran on the un-mirrored frame.
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const octx = out.getContext("2d");
    octx.translate(out.width, 0);
    octx.scale(-1, 1);
    octx.drawImage(canvas, 0, 0);

    setBanner(null);
    setCaptured(out.toDataURL("image/jpeg", 0.9));
    goto("review");
  };

  const runAnalysis = (now) => {
    const video = videoRef.current;
    const engine = engineRef.current;
    if (!video || !engine || video.readyState < 2 || !video.videoWidth) return;

    const t0 = performance.now();
    let result;
    try {
      result = engine.landmarker.detectForVideo(video, nextTimestamp());
    } catch (e) {
      return; // transient frame error
    }
    const analysis = analyzeFrame(result, grabPixels(video, video.videoWidth, video.videoHeight), video.videoWidth, video.videoHeight, prevNoseRef.current);
    prevNoseRef.current = analysis.nose;
    const st = stageRef.current;

    // Natural blink tracking (eyes closed → open again)
    if (analysis.faceCount === 1) {
      const b = blinkRef.current;
      const l = analysis.blend.eyeBlinkLeft ?? 0;
      const r = analysis.blend.eyeBlinkRight ?? 0;
      if (l > 0.5 && r > 0.5) b.closed = true;
      else if (b.closed && l < 0.3 && r < 0.3) {
        b.closed = false;
        b.lastBlinkAt = now;
      }
    }

    // While reviewing / uploading only keep watching the face: a swap marks the actions as broken
    if (st === "review" || st === "submitting") {
      const c = challengeRef.current;
      if (c && !trackContinuity(c, analysis, now)) c.broken = true;
      return;
    }

    const flags = smootherRef.current.push(analysis.flags);
    const allIssues = orderedIssues(flags);
    const blockingSet = st === "ready" ? READY_BLOCKING_ISSUES : BLOCKING_ISSUES;
    const issues = allIssues.filter((k) => blockingSet.includes(k));
    const tips = allIssues.filter((k) => TIP_ISSUES.includes(k) && !(st === "ready" && k === "notStraight"));

    // Adaptive rate: slower devices analyse less often so the preview stays smooth
    const dt = performance.now() - t0;
    emaRef.current = emaRef.current * 0.8 + dt * 0.2;
    intervalRef.current = Math.min(320, Math.max(90, emaRef.current * 3));

    if (st === "live") {
      if (issues.length === 0) {
        if (stableSinceRef.current === null) stableSinceRef.current = now;
      } else {
        stableSinceRef.current = null;
      }
      publishView(issues, false, tips);
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
    }
  };

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

  const startChallenge = async () => {
    if (stageRef.current !== "live") return;
    setBanner(null);
    goto("challengeLoading");
    try {
      const appId = resolveAppId(applicationId) || "";
      const res = await fetch(`${API_BASE_URL}/api/digio/selfie-challenge?applicationId=${encodeURIComponent(appId)}`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error(SESSION_EXPIRED_MSG);
      if (!res.ok || !data.success || !Array.isArray(data.steps)) throw new Error(data.error || "Could not start the liveness check. Please try again.");
      if (!mountedRef.current || stageRef.current !== "challengeLoading") return;

      challengeRef.current = {
        token: data.challengeToken,
        steps: data.steps,
        index: 0,
        stepState: {},
        issuedAt: performance.now(),
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
    if (!canClickSelfie) return;
    captureFrame();
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

    const sessionVideo = await snapshotVideo().catch(() => null);
    if (!mountedRef.current) return;

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
          video: sessionVideo,
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
        setBanner({ type: "error", text: msg });
        viewKeyRef.current = "";
        goto("ready");
        return;
      }
      abortToLive(msg);
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
    if (!location.granted) {
      setFatal(null);
      goto("location");
      return;
    }
    startCamera();
  };

  // ─── Render helpers ───────────────────────────────────────────────────
  const issues = view.issues;
  const primaryIssue = issues[0];
  const locationBlocked = !location.granted && stage !== "location";
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
  if (!location.granted) buttonLabel = "Location required";
  else if (engineState === "loading" || stage === "starting") buttonLabel = "Getting ready…";
  else if (engineState === "failed") buttonLabel = "Face detection unavailable";
  else if (stage === "live" || stage === "challengeLoading" || stage === "challenge") buttonLabel = "Complete the quick check first";
  else if (stage === "verifying") buttonLabel = "Checking photo…";
  else if (!view.ready) buttonLabel = issues.length === 1 && issues[0] === "needBlink" ? "Blink once to enable" : "Fix the highlighted items";

  const checklistState = (item) => {
    if (engineState !== "ready" || !LOOP_STAGES.includes(stage)) return "pending";
    if (item.key !== "single" && issues.includes("noFace")) return "pending";
    return item.issues.some((k) => issues.includes(k)) ? "bad" : "ok";
  };
  const livenessState = stage === "ready" || stage === "verifying" ? "ok" : stage === "challenge" ? "active" : "pending";

  const content = (
    <div className={`lsc-root lsc-${variant}`} role="dialog" aria-modal={variant === "modal"} aria-label="Selfie capture">
      <style>{STYLES}</style>
      <div className="lsc-panel">
        <div className="lsc-header">
          <div>
            <h2 className="lsc-title">Live Selfie</h2>
            <p className="lsc-sub">Real-time checks keep your KYC photo clear and valid.</p>
          </div>
          {onCancel && stage !== "submitting" && stage !== "done" && (
            <button type="button" className="lsc-close" onClick={cancel} aria-label="Close selfie capture">×</button>
          )}
        </div>

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
          <div className="lsc-camera" style={cameraBoxStyle}>
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
                <ellipse
                  cx={oval.overlay.cx}
                  cy={oval.overlay.cy}
                  rx={oval.overlay.rx}
                  ry={oval.overlay.ry}
                  fill="none"
                  stroke={ovalColor}
                  strokeWidth="4"
                  vectorEffect="non-scaling-stroke"
                  style={{ transition: "stroke 0.25s" }}
                />
              </svg>
            )}

            {statusText && (
              <div className={`lsc-status lsc-status-${statusTone}`} aria-live="polite">{statusText}</div>
            )}

            {challengeView && (stage === "challenge" || stage === "ready") && (
              <div className="lsc-steps">
                {challengeView.steps.map((s, i) => (
                  <span key={s} className={`lsc-dot ${i < challengeView.index ? "done" : i === challengeView.index ? "active" : ""}`} />
                ))}
                <span className="lsc-steps-label">
                  {challengeView.done ? `Liveness confirmed${view.secondsLeft ? ` · click within ${view.secondsLeft}s` : ""}` : challengeView.centering ? "Look straight" : `Step ${challengeView.index + 1} of ${challengeView.steps.length}`}
                </span>
              </div>
            )}

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
            <li className={`lsc-check ${location.granted ? "ok" : "bad"}`}>
              <span className="lsc-check-icon">{location.granted ? "✓" : "✕"}</span>Location on
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
          <p className="lsc-footnote">First do two quick actions shown on the camera (like turning your head or blinking). Then tap Click Selfie.</p>
        )}
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
.lsc-root { font-family: inherit; color: var(--text-primary, #111); }
.lsc-modal { position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.72); display: flex; align-items: center; justify-content: center; padding: 16px; overflow-y: auto; }
.lsc-modal .lsc-panel { width: 100%; max-width: 360px; max-height: calc(100vh - 32px); overflow-y: auto; background: var(--bg-primary, #fff); border-radius: 18px; padding: 14px 16px; box-shadow: 0 24px 60px rgba(0,0,0,0.35); }
.lsc-page .lsc-panel { width: 100%; max-width: 560px; margin: 0 auto; padding: 16px; }
@media (max-width: 600px) {
  .lsc-modal { padding: 0; align-items: stretch; }
  .lsc-modal .lsc-panel { max-width: none; max-height: none; min-height: 100%; border-radius: 0; padding: 16px; }
}
.lsc-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.lsc-title { font-size: 1.05rem; font-weight: 800; margin: 0; color: var(--text-primary, #111); }
.lsc-sub { margin: 2px 0 0; font-size: 0.75rem; color: var(--text-muted, #666); }
.lsc-close { background: var(--bg-secondary, #f1f1f1); border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 1.4rem; line-height: 1; cursor: pointer; color: var(--text-primary, #111); flex-shrink: 0; }
.lsc-card { background: var(--bg-secondary, #f6f6f6); border-radius: 16px; padding: 24px 20px; }
.lsc-card.lsc-compact { background: transparent; padding: 12px; color: #fff; }
.lsc-card.lsc-compact .lsc-text, .lsc-card.lsc-compact .lsc-h3 { color: #fff; }
.lsc-card.lsc-compact .lsc-help { color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.08); }
.lsc-center { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.lsc-h3 { margin: 4px 0 0; font-size: 1.05rem; font-weight: 800; color: var(--text-primary, #111); }
.lsc-text { margin: 0; font-size: 0.9rem; line-height: 1.5; color: var(--text-secondary, #444); max-width: 420px; }
.lsc-help { margin: 4px 0 0; font-size: 0.8rem; line-height: 1.5; color: var(--text-muted, #666); background: var(--bg-primary, #fff); border-radius: 10px; padding: 10px 12px; text-align: left; max-width: 440px; }
.lsc-icon { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.3rem; }
.lsc-icon-ok { background: #9fe870; color: #1a1a1a; }
.lsc-done-img { width: 120px; height: 160px; object-fit: cover; border-radius: 12px; border: 2px solid #9fe870; margin-top: 4px; }
.lsc-icon-bad { background: rgba(239,68,68,0.12); color: #ef4444; }
.lsc-icon-info { background: rgba(77,163,255,0.14); color: #2f7fd8; }
.lsc-camera-wrap { justify-content: center; }
.lsc-camera { position: relative; background: #000; border-radius: 18px; overflow: hidden; margin: 0 auto; }
.lsc-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
.lsc-review-img { transform: none; }
.lsc-overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.lsc-status { position: absolute; left: 50%; top: 10px; transform: translateX(-50%); max-width: calc(100% - 20px); padding: 6px 12px; border-radius: 999px; font-size: 0.78rem; font-weight: 700; text-align: center; background: rgba(0,0,0,0.65); color: #fff; backdrop-filter: blur(4px); }
.lsc-status-warn { background: rgba(245,166,35,0.95); color: #1a1a1a; }
.lsc-status-ok { background: rgba(159,232,112,0.95); color: #1a1a1a; }
.lsc-status-action { background: rgba(47,127,216,0.95); color: #fff; font-size: 1rem; }
.lsc-steps { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.6); padding: 6px 12px; border-radius: 999px; }
.lsc-dot { width: 9px; height: 9px; border-radius: 50%; background: rgba(255,255,255,0.35); }
.lsc-dot.active { background: #4da3ff; }
.lsc-dot.done { background: #9fe870; }
.lsc-steps-label { color: #fff; font-size: 0.75rem; font-weight: 700; margin-left: 4px; }
.lsc-veil { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: rgba(0,0,0,0.35); }
.lsc-veil-solid { background: rgba(0,0,0,0.82); overflow-y: auto; }
.lsc-veil-text { color: #fff; font-weight: 700; margin: 0; }
.lsc-spinner { width: 34px; height: 34px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.3); border-top-color: #fff; animation: lsc-spin 0.8s linear infinite; }
.lsc-spinner-dark { border-color: var(--border-color, #ddd); border-top-color: var(--wise-green, #9fe870); }
@keyframes lsc-spin { to { transform: rotate(360deg); } }
.lsc-banner { margin-top: 12px; padding: 10px 14px; border-radius: 12px; font-size: 0.85rem; font-weight: 600; line-height: 1.45; }
.lsc-alerts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.lsc-alert-chip { background: #dc2626; color: #fff; font-weight: 800; font-size: 0.85rem; padding: 7px 12px; border-radius: 999px; }
.lsc-banner-error { background: rgba(239,68,68,0.1); color: #dc2626; border: 1px solid rgba(239,68,68,0.3); }
.lsc-link { background: none; border: none; padding: 0; color: inherit; text-decoration: underline; font: inherit; cursor: pointer; }
.lsc-checklist { list-style: none; padding: 0; margin: 10px 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; }
.lsc-check { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 600; color: var(--text-muted, #777); }
.lsc-check-icon { width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800; background: var(--bg-secondary, #eee); flex-shrink: 0; }
.lsc-check.ok { color: var(--text-primary, #111); }
.lsc-check.ok .lsc-check-icon { background: #9fe870; color: #1a1a1a; }
.lsc-check.bad { color: #dc2626; }
.lsc-check.bad .lsc-check-icon { background: rgba(239,68,68,0.15); color: #dc2626; }
.lsc-actions { display: flex; gap: 10px; justify-content: center; margin-top: 12px; width: 100%; flex-wrap: wrap; }
.lsc-btn { height: 46px; padding: 0 20px; border-radius: 12px; font-weight: 800; font-size: 0.92rem; cursor: pointer; border: none; transition: opacity 0.2s, transform 0.1s; }
.lsc-btn:active:not(:disabled) { transform: scale(0.98); }
.lsc-btn-primary { background: var(--wise-green, #9fe870); color: #000; }
.lsc-btn-primary:disabled { background: var(--bg-secondary, #e5e5e5); color: var(--text-muted, #888); cursor: not-allowed; }
.lsc-btn-ghost { background: var(--bg-secondary, #eee); color: var(--text-primary, #111); }
.lsc-btn-wide { width: 100%; }
.lsc-actions .lsc-btn:not(.lsc-btn-wide) { flex: 1 1 140px; }
.lsc-footnote { margin: 8px 0 0; font-size: 0.7rem; color: var(--text-muted, #777); text-align: center; line-height: 1.45; }
`;
