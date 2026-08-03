"use client";
import { useEffect, useRef, useState, useCallback } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * SelfieCaptureInline — Custom browser-based selfie capture with robust Face-API validation
 */
export default function SelfieCaptureInline({ onSuccess, onCancel, applicationId }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const isMounted = useRef(true);

  const [status, setStatus] = useState("initializing"); // initializing | ready | capturing | submitting | error
  const [validationState, setValidationState] = useState({ ok: false, msg: "Starting camera...", type: "info" });
  const [errorMsg, setErrorMsg] = useState("");
  const [capturedImage, setCapturedImage] = useState(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showFlash, setShowFlash] = useState(false);
  const [locationData, setLocationData] = useState(null);
  
  // Keep faceapi reference so we don't need to load it repeatedly
  const faceapiRef = useRef(null);

  // ─── Initialize camera and location ──────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      setValidationState({ ok: false, msg: "Please click 'Allow' for Camera and Location prompts", type: "warning" });

      // 1. Get Location concurrently (don't await it to block camera)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (isMounted.current) setLocationData({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          (err) => console.warn("[SelfieCapture] Location denied/failed", err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }

      // 2. Get Camera immediately
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("error");
        setErrorMsg("Your browser doesn't support camera access. Please use a modern browser.");
        return;
      }

      const constraints = {
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!isMounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setStatus("ready");
          setValidationState(prev => {
            if (prev.msg !== "Please click 'Allow' for Camera and Location prompts") return prev;
            return { ok: false, msg: "Loading AI face detection...", type: "info" };
          });
        };
      }
    } catch (err) {
      if (!isMounted.current) return;
      console.error("[SelfieCapture] Camera error:", err);
      setStatus("error");
      setErrorMsg("Camera or Location access denied. Please check your browser permissions and allow access.");
    }
  }, []);

  // ─── Load Local Face API Models ──────────────────────────────────────
  const loadModel = useCallback(async () => {
    try {
      if (!isMounted.current) return;
      const faceapi = await import("@vladmandic/face-api");
      faceapiRef.current = faceapi;
      
      // Load strictly from our local static files - completely impervious to network/firewall blocks
      await faceapi.nets.tinyFaceDetector.loadFromUri('/face-api-models');
      
      if (!isMounted.current) return;
      setModelLoaded(true);
      setValidationState({ ok: false, msg: "Position your face inside the oval", type: "info" });
    } catch (err) {
      if (!isMounted.current) return;
      console.error("[SelfieCapture] Face API load failed:", err);
      setModelLoaded(false);
      setValidationState({ ok: true, msg: "AI unavailable — capture manually", type: "warning" });
    }
  }, []);

  // ─── Real-time validation ───────────────────────────────────────────
  const runDetection = useCallback(async () => {
    if (!videoRef.current || status !== "ready" || !isMounted.current) return;

    const video = videoRef.current;
    if (video.readyState < 2) return;

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      
      // 1. Basic lighting check
      canvas.width = 64;
      canvas.height = 48;
      ctx.drawImage(video, 0, 0, 64, 48);
      
      const imgData = ctx.getImageData(0, 0, 64, 48).data;
      let totalBrightness = 0;
      for (let i = 0; i < imgData.length; i += 4) {
        totalBrightness += (imgData[i] * 299 + imgData[i + 1] * 587 + imgData[i + 2] * 114) / 1000;
      }
      const avgBrightness = totalBrightness / (64 * 48);
      
      if (avgBrightness < 45) {
        setValidationState({ ok: false, msg: "Too dark. Move to a well-lit area.", type: "error" });
        return;
      }
      if (avgBrightness > 220) {
        setValidationState({ ok: false, msg: "Too bright. Avoid direct backlight.", type: "error" });
        return;
      }

      // 2. Strict AI Face Detection & Oval bounds checking
      if (modelLoaded && faceapiRef.current) {
        const faceapi = faceapiRef.current;
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 });
        const detections = await faceapi.detectAllFaces(video, options);
        
        if (!isMounted.current) return;

        if (detections.length === 0) {
          setValidationState({ ok: false, msg: "No face detected in frame", type: "error" });
          return;
        }

        if (detections.length > 1) {
          setValidationState({ ok: false, msg: "Multiple faces detected. Only you should be in frame.", type: "error" });
          return;
        }

        const faceBox = detections[0].box;
        const vidW = video.videoWidth;
        const vidH = video.videoHeight;
        
        // The oval is visually positioned in the center, about 65% width and 70% height
        // Since we mirrored the video (transform: scaleX(-1)), we must flip X coordinates for boundary check
        // face-api returns coordinates based on the unmirrored video source.
        const flippedX = vidW - faceBox.x - faceBox.width;
        
        // Define oval boundaries (approximate)
        const ovalX = vidW * 0.175; // (1 - 0.65) / 2
        const ovalW = vidW * 0.65;
        const ovalY = vidH * 0.15; // (1 - 0.70) / 2
        const ovalH = vidH * 0.70;
        
        // Check if face is fully inside the oval
        if (
          flippedX < ovalX ||
          flippedX + faceBox.width > ovalX + ovalW ||
          faceBox.y < ovalY ||
          faceBox.y + faceBox.height > ovalY + ovalH
        ) {
          setValidationState({ ok: false, msg: "Please position your face strictly inside the oval", type: "error" });
          return;
        }

        // Check if face is too small (far away) or too big (too close)
        const faceArea = (faceBox.width * faceBox.height) / (vidW * vidH);
        if (faceArea < 0.08) {
          setValidationState({ ok: false, msg: "Move closer to the camera", type: "error" });
          return;
        }
        if (faceArea > 0.5) {
          setValidationState({ ok: false, msg: "Move back a little", type: "error" });
          return;
        }
        
        // (Glasses/Objects would require facial landmarks which are heavy, so we rely on the backend for strict object/mask checks, but position is perfect now)
      }

      setValidationState({ ok: true, msg: "Perfect! Click capture", type: "success" });
    } catch (err) {
      // Ignore intermittent frame drops
    }
  }, [status, modelLoaded]);

  // ─── Loops ──────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    startCamera();
    loadModel();
    return () => {
      isMounted.current = false;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      clearInterval(detectionIntervalRef.current);
    };
  }, [startCamera, loadModel]);

  useEffect(() => {
    if (status === "ready") { // Run interval regardless of modelLoaded so brightness checks always work
      detectionIntervalRef.current = setInterval(runDetection, 300);
    }
    return () => clearInterval(detectionIntervalRef.current);
  }, [status, runDetection]);

  // ─── Actions ────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    isMounted.current = false;
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    onCancel();
  }, [onCancel]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    
    // Draw mirrored to match the live video preview
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    setCapturedImage(canvas.toDataURL("image/jpeg", 0.92));
    setStatus("capturing");
    clearInterval(detectionIntervalRef.current);
  }, []);

  const submitSelfie = useCallback(async () => {
    if (!capturedImage) return;
    setStatus("submitting");
    setSubmitError("");

    try {
      const token = sessionStorage.getItem("kycToken") || sessionStorage.getItem("token") || localStorage.getItem("kycToken");
      const appId = applicationId || sessionStorage.getItem("kycApplicationId");

      const response = await fetch(`${API_BASE_URL}/api/digio/face-match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ 
          selfie: capturedImage, 
          applicationId: appId,
          location: locationData 
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Face verification failed");

      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      onSuccess({ score: result.score, selfiePath: result.selfiePath, localPreview: capturedImage });
    } catch (err) {
      if (!isMounted.current) return;
      setSubmitError(err.message || "Failed to verify. Please try again.");
      setStatus("capturing");
    }
  }, [capturedImage, applicationId, onSuccess, locationData]);

  // ─── Render ─────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(247, 85, 85, 0.15)", margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}></div>
        <h3 style={{ margin: "0 0 10px 0", color: "#fff" }}>Camera Error</h3>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", marginBottom: 24 }}>{errorMsg}</p>
        <button onClick={handleCancel} style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", padding: "12px 24px", borderRadius: "12px", cursor: "pointer", fontWeight: "bold" }}>Go Back</button>
      </div>
    );
  }

  const getBorderColor = () => {
    if (status === "capturing" || status === "submitting") return "rgba(255,255,255,0.2)";
    if (validationState.type === "success") return "#9fe870";
    if (validationState.type === "error") return "#f75555";
    if (validationState.type === "warning") return "#f5a623";
    return "rgba(255,255,255,0.4)";
  };

  const getMessageBg = () => {
    if (validationState.type === "success") return "rgba(159, 232, 112, 0.15)";
    if (validationState.type === "error") return "rgba(247, 85, 85, 0.15)";
    if (validationState.type === "warning") return "rgba(245, 166, 35, 0.15)";
    return "rgba(255, 255, 255, 0.08)";
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0a0a0a" }}>
      
      {/* Video Container */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "3/4", background: "#000", overflow: "hidden" }}>
        
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", filter: "contrast(1.05) saturate(1.1)" }}
        />
        
        {status !== "capturing" && status !== "submitting" ? (
          <>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              pointerEvents: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.6) 70%)"
            }}>
              <div style={{
                width: "65%", height: "70%",
                borderRadius: "50%",
                border: `3px solid ${getBorderColor()}`,
                boxShadow: `0 0 20px ${getBorderColor()}40`,
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative"
              }}>
                {status === "ready" && !validationState.ok && validationState.type !== "warning" && (
                  <div style={{
                    position: "absolute", left: 0, right: 0, height: "2px",
                    background: "rgba(255,255,255,0.5)",
                    boxShadow: "0 0 8px rgba(255,255,255,0.8)",
                    animation: "scan 2s infinite ease-in-out",
                  }} />
                )}
              </div>
            </div>

            <style>{`
              @keyframes scan {
                0% { top: 10%; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { top: 90%; opacity: 0; }
              }
            `}</style>
          </>
        ) : (
          <img src={capturedImage} alt="Captured" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 10 }} />
        )}

        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          background: "#fff", opacity: showFlash ? 1 : 0,
          pointerEvents: "none", transition: "opacity 0.15s ease-out", zIndex: 20
        }} />

        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

      {/* Validation Message Box */}
      <div style={{
        padding: "16px 20px",
        background: getMessageBg(),
        borderTop: `1px solid ${getBorderColor()}30`,
        borderBottom: `1px solid ${getBorderColor()}30`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        transition: "all 0.3s ease"
      }}>
        <p style={{
          margin: 0, fontSize: "0.95rem", fontWeight: 600,
          color: status === "capturing" || status === "submitting" ? "#fff" : getBorderColor(),
        }}>
          {status === "submitting" ? "Verifying with Aadhaar..." : 
           status === "capturing" ? "Review your photo" : 
           validationState.msg}
        </p>
      </div>

      {/* Error Banner */}
      {submitError && (
        <div style={{ background: "#f75555", padding: "10px", textAlign: "center" }}>
          <p style={{ margin: 0, color: "#fff", fontSize: "0.85rem", fontWeight: 600 }}>{submitError}</p>
        </div>
      )}

      {/* Controls */}
      <div style={{ padding: "20px", display: "flex", gap: "16px", background: "#111", flex: 1, alignItems: "center" }}>
        {(status === "ready" || status === "initializing") && (
          <>
            <button onClick={handleCancel} style={{
              flex: 1, padding: "16px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: "1rem", fontWeight: 600, cursor: "pointer"
            }}>
              Cancel
            </button>
            <button
              onClick={capturePhoto}
              disabled={!validationState.ok && modelLoaded}
              style={{
                flex: 2, padding: "16px", borderRadius: "14px", border: "none",
                background: validationState.ok || !modelLoaded ? "#9fe870" : "rgba(159, 232, 112, 0.2)",
                color: validationState.ok || !modelLoaded ? "#000" : "rgba(255,255,255,0.3)",
                fontSize: "1rem", fontWeight: 800,
                cursor: validationState.ok || !modelLoaded ? "pointer" : "not-allowed",
                transition: "all 0.2s ease"
              }}
            >
              Take Photo
            </button>
          </>
        )}

        {status === "capturing" && (
          <>
            <button onClick={() => { setStatus("ready"); setCapturedImage(null); setSubmitError(""); setValidationState({ ok: false, msg: "Position your face inside the oval", type: "info" }); }} style={{
              flex: 1, padding: "16px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent", color: "#fff", fontSize: "1rem", fontWeight: 600, cursor: "pointer"
            }}>
              Retake
            </button>
            <button onClick={submitSelfie} style={{
              flex: 2, padding: "16px", borderRadius: "14px", border: "none",
              background: "#9fe870", color: "#000", fontSize: "1rem", fontWeight: 800, cursor: "pointer"
            }}>
              Confirm & Verify
            </button>
          </>
        )}

        {status === "submitting" && (
          <div style={{ flex: 1, textAlign: "center", padding: "16px" }}>
            <div className="loader" style={{ width: 24, height: 24, borderWidth: 3, margin: "0 auto" }}></div>
          </div>
        )}
      </div>
    </div>
  );
}
