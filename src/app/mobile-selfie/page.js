"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { initializeDigio, createDigioRequest, fetchDigioRequestResponse } from "@/utils/digio";

function MobileSelfieContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("loading"); // loading, ready, processing, success, error, expired
  const [errorMessage, setErrorMessage] = useState("");
  const hasProcessedRedirect = useRef(false);

  useEffect(() => {
    const token = searchParams.get("token");
    const appId = searchParams.get("appId");
    
    // Check for Digio Redirect Return
    const documentId = searchParams.get("document_id") || searchParams.get("digio_doc_id");
    const digioMessage = searchParams.get("message") || searchParams.get("status");

    if (!token || !appId) {
      setStatus("error");
      setErrorMessage("Invalid link. Please scan the QR code again.");
      return;
    }

    // Set token for digio.js utility
    sessionStorage.setItem("kycToken", token);
    sessionStorage.setItem("kycApplicationId", appId);

    if (documentId && digioMessage && !hasProcessedRedirect.current) {
      hasProcessedRedirect.current = true;
      setStatus("processing");
      
      if (digioMessage.toLowerCase().includes("success") || digioMessage === "Sign completed") {
        fetchDigioRequestResponse(documentId, "SELFIE")
          .then((res) => {
             if (res?.success) {
                setStatus("success");
             } else {
                setStatus("error");
                setErrorMessage("Failed to fetch verification results.");
             }
          })
          .catch((err) => {
             setStatus("error");
             setErrorMessage("Error verifying selfie.");
          });
      } else {
        setStatus("error");
        setErrorMessage(`Selfie verification failed: ${digioMessage}`);
      }
    } else if (status === "loading") {
       setStatus("ready");
    }
  }, [searchParams, status]);

  const startVerification = async () => {
    setStatus("processing");
    try {
      let coords = { lat: null, lng: null };
      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          coords.lat = pos.coords.latitude;
          coords.lng = pos.coords.longitude;
        } catch (err) {
          console.warn("Geolocation skipped:", err.message);
        }
      }

      const requestData = await createDigioRequest("SELFIE", coords);
      const { requestId, customerIdentifier, accessToken } = requestData;

      const digio = initializeDigio({
        is_redirection_approach: true,
        redirect_url: window.location.href, // Redirect back to this same URL with token/appId intact
      });

      if (!digio || !requestId) {
        setStatus("error");
        setErrorMessage("Unable to initialize selfie verification flow");
        return;
      }

      if (accessToken) {
        digio.submit(requestId, customerIdentifier, accessToken);
      } else {
        digio.submit(requestId, customerIdentifier);
      }
    } catch (error) {
       setStatus("error");
       setErrorMessage(error?.message || "Error connecting to verification service");
    }
  };

  if (status === "loading") {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
         <div className="loader" style={{ width: 40, height: 40 }}></div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)', padding: 24, textAlign: 'center' }}>
         <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--wise-green)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 style={{ fontSize: "1.5rem", marginBottom: 12, color: "var(--text-primary)" }}>Selfie Captured!</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1rem", lineHeight: 1.5 }}>
            Your selfie has been successfully captured and synced. You can now close this window and return to your computer to continue.
          </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: 24, display: 'flex', flexDirection: 'column' }}>
       <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 400, margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h1 style={{ fontSize: "1.8rem", marginBottom: 8, color: "var(--text-primary)", fontWeight: 800 }}>Selfie Verification</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Please complete the live face capture to verify your identity.
            </p>
          </div>

          {status === "error" && (
            <div style={{ padding: 16, background: "rgba(247, 85, 85, 0.1)", border: "1px solid var(--wise-danger)", borderRadius: 12, marginBottom: 24, textAlign: "center" }}>
              <p style={{ color: "var(--wise-danger)", margin: 0, fontWeight: 600 }}>{errorMessage}</p>
            </div>
          )}

          {status === "processing" ? (
             <div style={{ textAlign: 'center', padding: 32 }}>
                <div className="loader" style={{ margin: '0 auto 20px', width: 32, height: 32 }}></div>
                <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>Starting secure capture...</p>
             </div>
          ) : (
            <button 
              onClick={startVerification}
              style={{
                width: "100%", height: "56px", borderRadius: "12px", 
                background: "var(--wise-green)", color: "#000",
                fontSize: "1.1rem", fontWeight: 800, border: "none",
                cursor: "pointer", boxShadow: "0 4px 14px rgba(159, 232, 112, 0.4)"
              }}
            >
              Start Camera
            </button>
          )}
       </div>
    </div>
  );
}

export default function MobileSelfiePage() {
  return (
    <Suspense fallback={<div style={{height: '100vh', background: 'var(--bg-primary)'}} />}>
      <MobileSelfieContent />
    </Suspense>
  );
}
