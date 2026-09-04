"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useKYC } from "@/context/KYCContext";
import { ArrowRightIcon } from "../Icons";
import { initializeDigio, createDigioRequest, fetchDigioRequestResponse } from "@/utils/digio";
import { QRCode } from "react-qrcode-logo";
import { io } from "socket.io-client";

/** Wait for Digio SDK to be available (up to maxWait ms) */
async function waitForDigioSDK(maxWait = 3000) {
  if (typeof window === "undefined") return false;
  if (window.Digio) return true;
  let waited = 0;
  while (!window.Digio && waited < maxWait) {
    await new Promise(r => setTimeout(r, 200));
    waited += 200;
  }
  return !!window.Digio;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/** Detect if the current device is a mobile/tablet */
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export default function SelfieStep() {
  const { nextStep, prevStep, addToast, setApplicationId, applicationId, updateState, updateNested, correctionDraft, rejectionMode, stepStatuses, rejectedStepsList, selfie, selfieDetails } = useKYC();
  
  const isRejection = Boolean(rejectionMode);
  const isSelfieRejected = isRejection && (
    rejectedStepsList?.some(r => r.stepId === "ipv" || r.stepId === "selfie") ||
    stepStatuses?.ipv?.status === "rejected" ||
    stepStatuses?.selfie?.status === "rejected"
  );
  const [phase, setPhase] = useState("intro"); // intro | processing | done | mobileCompleted
  const [matchScore, setMatchScore] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [resumeUrl, setResumeUrl] = useState("");
  const pollRef = useRef(null);
  const socketRef = useRef(null);
  const hasProcessedRedirect = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem("kycToken") || localStorage.getItem("kycToken") || sessionStorage.getItem("token");
      if (token && applicationId) {
        const rejectionParam = isRejection ? "&rejectionMode=true" : "";
        setResumeUrl(`${window.location.origin}/resume?token=${token}&appId=${applicationId}${rejectionParam}`);
      }
    }
  }, [applicationId, isRejection]);

  // ─── Handle successful Digio selfie completion ───────────────────────
  const handleDigioSuccess = useCallback(async (requestId, opts = {}) => {
    const { isMobileRedirectReturn = false } = opts;
    try {
      const result = await fetchDigioRequestResponse(requestId, "SELFIE");
      if (result?.success) {
        setMatchScore(result.score || result.faceMatchScore || 0);
        const payloadData = {
          preview: result.selfiePath,
          matchScore: result.score,
        };
        
        if (isSelfieRejected) {
          updateNested("correctionDraft", { selfieDetails: payloadData, selfie: { preview: result.selfiePath } });
        } else {
          updateState({
            selfieDetails: payloadData,
            selfie: { preview: result.selfiePath },
          });
        }
      }
      addToast("Selfie verification completed", "success");

      setPhase("done");
    } catch (error) {
      addToast("Error fetching verification results", "error");
      setPhase("intro");
    }
  }, [addToast, nextStep, updateState]);

  // Use a ref to always call the latest checkSelfieStatus (avoids stale closures in socket/interval callbacks)
  const checkSelfieStatusRef = useRef(null);

  // ─── Socket.IO + Polling: watch for cross-device selfie completion ──
  // Activated when QR code is shown on desktop
  const ignoredPreviewRef = useRef(null);

  const startCrossDevicePolling = useCallback(async () => {
    const activeAppId = applicationId || sessionStorage.getItem("kycApplicationId");
    const token = sessionStorage.getItem("kycToken") || localStorage.getItem("kycToken") || sessionStorage.getItem("token");
    if (!activeAppId || !token) return;

    // Fetch baseline selfie so we don't instantly auto-advance on an already-existing preview
    try {
      const resp = await fetch(`${API_BASE_URL}/api/kyc/status/${activeAppId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const d = await resp.json();
        if (d.success && d.application) {
          let sDetails = typeof d.application.selfieDetails === "string" ? JSON.parse(d.application.selfieDetails) : d.application.selfieDetails;
          if (isSelfieRejected) {
            let draftObj = {};
            if (d.application.correctionDraft) {
              try { draftObj = typeof d.application.correctionDraft === "string" ? JSON.parse(d.application.correctionDraft) : d.application.correctionDraft; } catch (e) {}
            }
            sDetails = draftObj?.selfieDetails || null;
          }
          ignoredPreviewRef.current = (sDetails?.preview && sDetails.preview !== "__DIGIO_SUCCESS__")
            ? sDetails.preview
            : (sDetails?.path && sDetails.path !== "__DIGIO_SUCCESS__" ? sDetails.path : null);
        }
      }
    } catch (e) {}

    // Connect to Socket.IO and join the application room
    const socket = io(API_BASE_URL, { withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[SelfieStep Socket.IO] Connected, joining room:", activeAppId);
      socket.emit("join_application", activeAppId);
    });

    // When the server emits kyc_updated (after mobile completes selfie),
    // fetch the latest status and check if selfie is done
    socket.on("kyc_updated", async () => {
      console.log("[SelfieStep Socket.IO] Received kyc_updated — checking selfie status...");
      if (checkSelfieStatusRef.current) await checkSelfieStatusRef.current(activeAppId, token);
    });

    // Also set up a fallback polling interval (every 5s) in case Socket.IO events are missed
    pollRef.current = setInterval(async () => {
      if (checkSelfieStatusRef.current) await checkSelfieStatusRef.current(activeAppId, token);
    }, 5000);

    console.log("[SelfieStep] Cross-device polling started (Socket.IO + 5s fallback)");
  }, [applicationId, isSelfieRejected]);

  const checkSelfieStatus = async (appId, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/kyc/status/${appId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;

      const data = await response.json();
      if (!data.success || !data.application) return;

      const app = data.application;
      let selfieDetails =
        typeof app.selfieDetails === "string"
          ? JSON.parse(app.selfieDetails)
          : app.selfieDetails;

      let draftObj = {};
      if (app.correctionDraft) {
        try { draftObj = typeof app.correctionDraft === "string" ? JSON.parse(app.correctionDraft) : app.correctionDraft; } catch (e) {}
      }

      if (isSelfieRejected) {
        if (draftObj?.selfieDetails) {
          selfieDetails = draftObj.selfieDetails;
        } else {
          selfieDetails = null; // Do not use the old rejected selfie
        }
      }

      // If selfie has been captured (preview path exists and is a real URL), auto-advance
      const selfiePreview = (selfieDetails?.preview && selfieDetails.preview !== "__DIGIO_SUCCESS__")
        ? selfieDetails.preview
        : (selfieDetails?.path && selfieDetails.path !== "__DIGIO_SUCCESS__" ? selfieDetails.path : null);
        
      if (selfiePreview && selfiePreview !== ignoredPreviewRef.current) {
        console.log("[SelfieStep] Selfie detected from another device! Auto-advancing...");
        setMatchScore(selfieDetails.matchScore || null);
        
        const payloadData = {
          preview: selfiePreview,
          matchScore: selfieDetails.matchScore,
        };
        
        if (isSelfieRejected) {
          updateNested("correctionDraft", { selfieDetails: payloadData, selfie: { preview: selfiePreview } });
        } else {
          updateState({
            selfieDetails: payloadData,
            selfie: { preview: selfiePreview },
          });
        }
        
        addToast("Selfie captured on your mobile device!", "success");
        stopCrossDevicePolling();
        setShowQR(false);
        setPhase("done");
      }
    } catch (err) {
      console.warn("[SelfieStep] Status check failed:", err.message);
    }
  };

  // Keep the ref updated on every render so socket/interval callbacks use the latest version
  checkSelfieStatusRef.current = checkSelfieStatus;

  const stopCrossDevicePolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  // Start/stop polling when QR visibility changes
  useEffect(() => {
    if (showQR && phase === "intro") {
      startCrossDevicePolling();
    }
    return () => stopCrossDevicePolling();
  }, [showQR, phase, startCrossDevicePolling, stopCrossDevicePolling]);

  // Clean up on unmount
  useEffect(() => {
    return () => stopCrossDevicePolling();
  }, [stopCrossDevicePolling]);

  // ─── Handle Digio redirect return (URL params) ──────────────────────
  useEffect(() => {
    if (hasProcessedRedirect.current) return;

    const searchParams = new URLSearchParams(window.location.search);
    const documentId = searchParams.get("document_id") || searchParams.get("digio_doc_id");
    const status = searchParams.get("message") || searchParams.get("status");

    if (documentId && status) {
      hasProcessedRedirect.current = true;
      window.history.replaceState({}, document.title, window.location.pathname);

      // If opened in a popup/new tab, notify opener and close
      if (window.opener && window.opener !== window) {
        window.opener.postMessage(
          { type: "DIGIO_SUCCESS", documentId, step: "SELFIE", status },
          window.location.origin
        );
        window.close();
        return;
      }

      // Determine if this is a mobile redirect return
      const isMobile = isMobileDevice();

      setPhase("processing");
      if (status.toLowerCase().includes("success") || status === "Sign completed") {
        handleDigioSuccess(documentId, { isMobileRedirectReturn: isMobile });
      } else {
        setPhase("intro");
        addToast(`Selfie verification failed: ${status}`, "error");
      }
    }

    // Listen for messages from popup (desktop popup flow)
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "DIGIO_SUCCESS" && event.data?.step === "SELFIE") {
        setPhase("processing");
        if (
          event.data.status.toLowerCase().includes("success") ||
          event.data.status === "Sign completed"
        ) {
          handleDigioSuccess(event.data.documentId);
        } else {
          setPhase("intro");
          addToast(`Selfie verification failed: ${event.data.status}`, "error");
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [addToast, handleDigioSuccess]);

  // ─── Start selfie verification ───────────────────────────────────────
  const startVerification = async () => {
    setPhase("processing");

    // Wait for Digio SDK to be available (may not be loaded on first attempt on mobile)
    const sdkReady = await waitForDigioSDK(3000);
    if (!sdkReady) {
      addToast("Verification SDK is still loading. Please try again in a moment.", "error");
      setPhase("intro");
      return;
    }

    try {
      const requestData = await createDigioRequest("SELFIE");
      const { requestId, customerIdentifier, applicationId: appId } = requestData;
      if (appId) setApplicationId(appId);

      const isMobile = isMobileDevice();

      const digioOptions = {
        callback: async (response) => {
          if (response.error_code && response.error_code !== "success") {
            addToast(`Selfie verification failed: ${response.message}`, "error");
            setPhase("intro");
            return;
          }
          handleDigioSuccess(response.digio_doc_id || response.id, {});
        },
      };

      // On mobile, use redirection approach to avoid popup blocking
      if (isMobile) {
        digioOptions.is_redirection_approach = true;
        digioOptions.redirect_url = window.location.origin + window.location.pathname;
      }

      const digio = initializeDigio(digioOptions);

      if (!digio || !requestId) {
        addToast("Unable to initialize selfie verification flow", "error");
        setPhase("intro");
        return;
      }

      // Always call init() before submit() — required for proper SDK setup
      digio.init();

      // Small delay to let SDK UI initialize before submitting
      await new Promise(r => setTimeout(r, 300));

      if (requestData.accessToken) {
        digio.submit(requestId, customerIdentifier, requestData.accessToken);
      } else {
        digio.submit(requestId, customerIdentifier);
      }
    } catch (error) {
      addToast(error?.message || "Error connecting to selfie verification service", "error");
      setPhase("intro");
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="container-sm" style={{ paddingTop: "8vh", paddingBottom: "4vh" }}>
      <div className="text-center" style={{ marginBottom: 28 }}>
        <h1 className="text-section" style={{ fontSize: "2rem", marginBottom: 8 }}>Selfie Verification</h1>
        <p className="text-body" style={{ fontWeight: 600 }}>Live face capture for identity verification.</p>
      </div>

      {phase === "intro" && (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <p className="text-body" style={{ marginBottom: 32, fontWeight: 600, color: "var(--text-secondary)" }}>
            We need to capture a live selfie video to verify your identity. Please ensure you are in a well-lit area and not wearing glasses or a hat.
          </p>
          <button className="btn btn-primary" onClick={startVerification} style={{ width: "100%", height: "56px", fontSize: "1.1rem", marginBottom: 16 }}>
            Start Selfie Capture
          </button>
          
          <div style={{ margin: "24px 0", borderTop: "1px solid var(--border-color)", position: "relative" }}>
            <span style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "var(--bg-primary)", padding: "0 12px", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600 }}>OR</span>
          </div>

          {!showQR ? (
            <button className="btn btn-secondary" onClick={() => setShowQR(true)} style={{ width: "100%", height: "56px", marginBottom: 16 }}>
              No Camera? Continue on Mobile
            </button>
          ) : (
            <div style={{ marginBottom: 24, padding: 24, background: "var(--bg-secondary)", borderRadius: 12 }}>
              <p className="text-body-bold" style={{ marginBottom: 16 }}>Scan with your mobile camera</p>
              {resumeUrl && (
                <div style={{ background: "white", padding: 16, borderRadius: 8, display: "inline-block", marginBottom: 16 }}>
                  <QRCode value={resumeUrl} size={256} ecLevel="L" />
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
                <div className="loader" style={{ width: 16, height: 16, borderWidth: 2 }}></div>
                <p className="text-caption" style={{ color: "var(--wise-green)", fontWeight: 700, margin: 0 }}>
                  Waiting for selfie from your mobile...
                </p>
              </div>
              <p className="text-caption" style={{ color: "var(--text-muted)" }}>
                This screen will automatically advance once you complete the selfie on your phone.
              </p>
              <button className="btn btn-text" onClick={() => setShowQR(false)} style={{ marginTop: 12 }}>
                Hide QR Code
              </button>
            </div>
          )}

          <button className="btn btn-secondary" onClick={prevStep} style={{ width: "100%", height: "56px" }}>
            Back
          </button>
        </div>
      )}

      {phase === "processing" && (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div className="loader" style={{ margin: "0 auto 24px" }}></div>
          <p className="text-body-bold">Launching Digio Secure Capture...</p>
          <p className="text-body" style={{ fontSize: "0.9rem", color: "#666" }}>
            Please complete the selfie flow in the Digio popup.
          </p>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
            <button className="btn btn-secondary" onClick={() => setPhase("intro")} style={{ padding: "12px 24px" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <h2 className="text-section" style={{ marginBottom: 16 }}>Verification Complete</h2>
          <p className="text-body" style={{ marginBottom: 8 }}>
            Your selfie and liveness check have been successfully verified.
          </p>
          {matchScore !== null && (
            <p style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--wise-primary)", marginBottom: 24 }}>
              Match Confidence: {matchScore}%
            </p>
          )}
          
          {(selfie?.preview || selfieDetails?.preview) && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <img 
                src={selfie?.preview || selfieDetails?.preview} 
                alt="Captured Selfie" 
                style={{ 
                  maxWidth: "200px", 
                  maxHeight: "200px",
                  objectFit: "cover",
                  borderRadius: "16px", 
                  border: "2px solid var(--border-color)",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.1)"
                }} 
              />
            </div>
          )}

          <button className="btn btn-primary" onClick={() => nextStep()} style={{ width: "100%" }}>
            Continue <ArrowRightIcon size={18} />
          </button>
        </div>
      )}

      {/* Mobile completion screen — shown on the QR-scanned device after selfie is done */}
      {phase === "mobileCompleted" && (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--wise-green)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-section" style={{ marginBottom: 12 }}>Selfie Captured Successfully!</h2>
          <p className="text-body" style={{ marginBottom: 8, color: "var(--text-secondary)" }}>
            Your selfie has been verified and synced. You can now safely close this tab and continue on your original device.
          </p>
          {matchScore !== null && (
            <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--wise-green)", marginBottom: 16 }}>
              Match Score: {matchScore}%
            </p>
          )}
          <p className="text-caption" style={{ color: "var(--text-muted)", marginTop: 16 }}>
            Your desktop/laptop screen will automatically advance to the next step.
          </p>
        </div>
      )}
    </div>
  );
}
