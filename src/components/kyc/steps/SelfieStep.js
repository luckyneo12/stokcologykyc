"use client";
import { useEffect, useRef, useState } from "react";
import { useKYC } from "@/context/KYCContext";
import { ArrowRightIcon } from "../Icons";
import { initializeDigio, createDigioRequest, fetchDigioRequestResponse } from "@/utils/digio";
import { QRCode } from "react-qrcode-logo";

export default function SelfieStep() {
  const { nextStep, prevStep, addToast, setApplicationId, applicationId, updateState } = useKYC();
  const [phase, setPhase] = useState("intro"); // intro | processing | done
  const [matchScore, setMatchScore] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [resumeUrl, setResumeUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem("kycToken") || sessionStorage.getItem("token");
      if (token && applicationId) {
        setResumeUrl(`${window.location.origin}/resume?token=${token}&appId=${applicationId}`);
      }
    }
  }, [applicationId]);

  const handleDigioSuccess = async (requestId) => {
    try {
      const result = await fetchDigioRequestResponse(requestId, "SELFIE");
      if (result?.success) {
        setMatchScore(result.score || result.faceMatchScore || 0);
        updateState({ 
          selfieDetails: { 
            preview: result.selfiePath, 
            matchScore: result.score 
          },
          selfie: { preview: result.selfiePath }
        });
      }
      addToast("Selfie verification completed", "success");
      setPhase("done");
      nextStep();
    } catch (error) {
      addToast("Error fetching verification results", "error");
      setPhase("intro");
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const documentId = searchParams.get("document_id") || searchParams.get("digio_doc_id");
    const status = searchParams.get("message") || searchParams.get("status");
    
    if (documentId && status) {
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // If opened in a popup/new tab, notify opener and close
      if (window.opener && window.opener !== window) {
        window.opener.postMessage({ type: 'DIGIO_SUCCESS', documentId, step: 'SELFIE', status }, window.location.origin);
        window.close();
        return;
      }

      setPhase("processing");
      if (status.toLowerCase().includes("success") || status === "Sign completed") {
        handleDigioSuccess(documentId);
      } else {
        setPhase("intro");
        addToast(`Selfie verification failed: ${status}`, "error");
      }
    }

    // Listen for messages from popup
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'DIGIO_SUCCESS' && event.data?.step === 'SELFIE') {
        setPhase("processing");
        if (event.data.status.toLowerCase().includes("success") || event.data.status === "Sign completed") {
          handleDigioSuccess(event.data.documentId);
        } else {
          setPhase("intro");
          addToast(`Selfie verification failed: ${event.data.status}`, "error");
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const startVerification = async () => {
    setPhase("processing");

    try {
      // Capture geolocation if possible
      let coords = { lat: null, lng: null };
      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          coords.lat = pos.coords.latitude;
          coords.lng = pos.coords.longitude;
        } catch(err) {
          console.warn("Geolocation skipped:", err.message);
        }
      }

      const requestData = await createDigioRequest("SELFIE", coords);
      const { requestId, customerIdentifier, applicationId } = requestData;
      if (applicationId) setApplicationId(applicationId);


      const digio = initializeDigio({
        callback: async (response) => {
          if (response.error_code) {
            addToast(`Selfie verification failed: ${response.message}`, "error");
            setPhase("intro");
            return;
          }
          handleDigioSuccess(response.digio_doc_id || response.id);
        },
      });

      if (!digio || !requestId) {
        addToast("Unable to initialize selfie verification flow", "error");
        setPhase("intro");
        return;
      }

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
                  <QRCode value={resumeUrl} size={180} />
                </div>
              )}
              <p className="text-caption" style={{ color: "var(--text-muted)" }}>
                This will resume your KYC journey exactly at this step on your phone. This screen will automatically update once you finish.
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
          <button className="btn btn-primary" onClick={nextStep} style={{ width: "100%" }}>
            Continue <ArrowRightIcon size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
