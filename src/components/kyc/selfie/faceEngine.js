"use client";
/**
 * Lazy, shared MediaPipe Face Landmarker instance for the in-house selfie capture.
 * Model + WASM are served locally from /public/mediapipe (no CDN dependency at runtime).
 */

const WASM_BASE_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/models/face_landmarker.task";

let enginePromise = null;

// MediaPipe's WASM prints routine info lines (e.g. "INFO: Created TensorFlow Lite XNNPACK
// delegate for CPU.") through console.error, which the Next.js dev overlay shows as errors.
// The WASM runtime keeps its own reference to console.error/warn from the moment it loads, so
// the filter is installed once, BEFORE MediaPipe is loaded. Only lines matching the
// MediaPipe/TFLite log pattern are dropped; every other message passes through unchanged.
const MEDIAPIPE_LOG_PATTERN = /^(INFO:|[IW]\d{4} |.*TensorFlow Lite XNNPACK delegate)/;
let logFilterInstalled = false;

function installMediapipeLogFilter() {
  if (logFilterInstalled || typeof console === "undefined") return;
  logFilterInstalled = true;
  for (const method of ["error", "warn"]) {
    const original = console[method];
    console[method] = function filteredConsole(...args) {
      if (typeof args[0] === "string" && MEDIAPIPE_LOG_PATTERN.test(args[0])) return;
      return original.apply(this, args);
    };
  }
}

async function createEngine() {
  installMediapipeLogFilter();
  const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);

  const baseOptions = {
    runningMode: "VIDEO",
    // Up to 3 so we can detect (and block) extra people in the frame
    numFaces: 3,
    minFaceDetectionConfidence: 0.5,
    // Slightly stricter than the defaults so a person who left the frame is dropped quickly
    // instead of lingering as a "ghost" second face
    minFacePresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: false,
  };

  // GPU first (fast and smooth); fall back to CPU on devices without usable WebGL
  try {
    const landmarker = await FaceLandmarker.createFromOptions(fileset, {
      ...baseOptions,
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
    });
    return { landmarker, delegate: "GPU" };
  } catch (gpuError) {
    console.warn("[FaceEngine] GPU delegate unavailable, using CPU:", gpuError?.message);
    const landmarker = await FaceLandmarker.createFromOptions(fileset, {
      ...baseOptions,
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" },
    });
    return { landmarker, delegate: "CPU" };
  }
}

/**
 * Second landmarker in IMAGE mode, used only to look for extra people in zoomed-in parts of the
 * frame. The live (VIDEO) landmarker's detector misses small faces further back in the room; a
 * fresh detection on a cropped tile makes those faces big enough to be found. A separate instance
 * keeps the live landmarker's face tracking untouched.
 */
let scannerPromise = null;

async function createScanner() {
  installMediapipeLogFilter();
  const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
  const options = {
    runningMode: "IMAGE",
    numFaces: 4,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  };
  try {
    return await FaceLandmarker.createFromOptions(fileset, {
      ...options,
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
    });
  } catch (gpuError) {
    return FaceLandmarker.createFromOptions(fileset, {
      ...options,
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" },
    });
  }
}

/** Returns the shared extra-face scanner, loading it on first call. A failed load can be retried. */
export function loadFaceScanner() {
  if (!scannerPromise) {
    scannerPromise = createScanner().catch((err) => {
      scannerPromise = null;
      throw err;
    });
  }
  return scannerPromise;
}

/** Returns the shared engine, loading it on first call. A failed load can be retried. */
export function loadFaceEngine() {
  if (!enginePromise) {
    enginePromise = createEngine().catch((err) => {
      enginePromise = null;
      throw err;
    });
  }
  return enginePromise;
}

/** Start downloading the model in the background (safe to call repeatedly). */
export function preloadFaceEngine() {
  if (typeof window === "undefined") return;
  loadFaceEngine().catch(() => {});
}

/** True when the browser has what the capture needs (WebAssembly + camera API + secure origin). */
export function getBrowserSupport() {
  if (typeof window === "undefined") return { ok: false, reason: "server" };
  if (!window.isSecureContext) return { ok: false, reason: "insecure" };
  if (typeof WebAssembly !== "object") return { ok: false, reason: "wasm" };
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: "camera_api" };
  return { ok: true };
}
