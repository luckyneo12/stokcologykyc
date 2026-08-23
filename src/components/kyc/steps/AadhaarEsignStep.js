"use client";
import { useState, useEffect } from "react";

import { useKYC } from "@/context/KYCContext";
import Logo from "../Logo";

import { initializeDigio, createDigioRequest, fetchDigioRequestResponse } from "@/utils/digio";
import { submitKyc } from "@/utils/kycApi";

export default function AadhaarEsignStep() {
  const {
    nextStep,
    addToast,
    setApplicationId,
    updateState,
    applicationId: kycApplicationId,
    personalDetails,
    identityMethod,
    identityDetails,
    ocrData,
    address,
    bankDetails,
    consent,
    getBackendPayload,
    nomineeDetails,
    nomineeAllocation,
    segments,
    bsda,
    generatedPdfBase64
  } = useKYC();
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("intro"); // intro, processing, done, failed

  
  const handleDigioSuccess = async (requestId) => {
    setLoading(true);
    setPhase("verifying");
    try {
      const result = await fetchDigioRequestResponse(requestId, "ESIGN");
      if (!result) {
        throw new Error("Could not verify eSign response. Please try again.");
      }
      
      const activeApplicationId = kycApplicationId;
      if (activeApplicationId) {
        const payload = getBackendPayload({ 
          personalDetails, identityDetails, address, bankDetails, consent, segments, bsda, nomineeDetails, nomineeAllocation, ocrData,
          selfie: { matchScore: ocrData?.matchScore || 0, preview: null },
          currentStep: 14 
        }, "aadhaarEsign");
        await submitKyc({ applicationId: activeApplicationId, data: payload });
      }
      
      updateState({ status: "under_review", submittedAt: new Date().toISOString() });
      addToast("Document eSigned successfully!", "success");
      nextStep({ status: "under_review", submittedAt: new Date().toISOString() });
    } catch (error) {
      console.error("Post-eSign error:", error);
      setPhase("failed");
      setLoading(false);
      addToast("Signature verified, but failed to update application. Our team will review this manually.", "warning");
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const documentId = searchParams.get("document_id") || searchParams.get("digio_doc_id");
    const status = searchParams.get("message") || searchParams.get("status");
    
    if (documentId && status && !loading) {
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // If opened in a popup/new tab, notify opener and close
      if (window.opener && window.opener !== window) {
        window.opener.postMessage({ type: 'DIGIO_SUCCESS', documentId, step: 'ESIGN', status }, window.location.origin);
        window.close();
        return;
      }

      if (status === "Sign completed" || status.toLowerCase() === "success") {
        handleDigioSuccess(documentId);
      } else {
        setPhase("failed");
        addToast(`eSign failed: ${status}`, "error");
      }
    }

    // Listen for messages from popup
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'DIGIO_SUCCESS' && event.data?.step === 'ESIGN') {
        const popupStatus = event.data.status;
        if (popupStatus === "Sign completed" || popupStatus.toLowerCase() === "success") {
          handleDigioSuccess(event.data.documentId);
        } else {
          setPhase("failed");
          addToast(`eSign failed: ${popupStatus}`, "error");
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const startESign = async () => {
    // ... cleaned up for brevity in thought, but applying full logic in replacement ...
    let rawIdentifier = personalDetails?.phone || personalDetails?.email || "user@example.com";
    const identifier = rawIdentifier.replace(/\D/g, '').length >= 10 
      ? rawIdentifier.replace(/\D/g, '').slice(-10) 
      : rawIdentifier;
      
    const digio = initializeDigio({
      environment: process.env.NEXT_PUBLIC_DIGIO_ENV || "production",
      logoUrl: "/logo120.png",
      is_redirection_approach: true,
      redirect_url: typeof window !== "undefined" ? window.location.href : "",
      callback: async (response) => {
        if (response.error_code || response.message === "cancelled" || !response.digio_doc_id) {
          console.error("Digio Error/Cancel:", response);
          if (response.error_code === "CANCELLED" || response.message === "cancelled" || !response.digio_doc_id) {
            addToast("eSign cancelled by user", "info");
          } else {
            addToast(`eSign failed: ${response.message || 'Unknown error'}`, "error");
          }
          setLoading(false);
          setPhase("failed");
          return;
        }
        handleDigioSuccess(response.digio_doc_id || response.id);
        
        // Force close the SDK overlay in case mobile browsers get stuck
        try {
          if (digio && typeof digio.cancel === 'function') {
            digio.cancel();
          }
        } catch(e) {}
      }
    });


    if (!digio) {
      addToast("Digio SDK not loaded. Please refresh the page.", "error");
      return;
    }

    
    if (!digio.is_redirection_approach) {
      digio.init();
    }
    setLoading(true);
    setPhase("processing");
    
    try {
      // Capture geolocation if possible
      let coords = { lat: null, lng: null };
      try {
        if ("geolocation" in navigator) {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          coords.lat = pos.coords.latitude;
          coords.lng = pos.coords.longitude;
        }
      } catch(err) {
        console.warn("Geolocation skipped/failed:", err.message);
      }
      
      // Fallback to IP-based location if browser geolocation fails or is denied
      if (!coords.lat || !coords.lng) {
        try {
          const res = await fetch("https://get.geojs.io/v1/ip/geo.json");
          const data = await res.json();
          if (data.latitude && data.longitude) {
            coords.lat = parseFloat(data.latitude);
            coords.lng = parseFloat(data.longitude);
          }
        } catch(e) {
          console.warn("IP location fallback failed:", e.message);
        }
      }

      const { requestId, customerIdentifier, accessToken, applicationId: requestApplicationId } = await createDigioRequest("ESIGN", {
        customerIdentifier: identifier,
        fullName: personalDetails?.fullName || "KYC Applicant",
        ...coords
      });
      if (requestApplicationId) setApplicationId(requestApplicationId);
      if (accessToken) {
        digio.submit(requestId, customerIdentifier, accessToken);
      } else {
        digio.submit(requestId, customerIdentifier);
      }
    } catch (error) {
      console.error("eSign Request Error:", error);
      digio.cancel();
      setLoading(false);
      setPhase("failed");
      addToast(error?.message || "Error connecting to eSign service", "error");
    }
  };

  return (
    <div className="container-sm" style={{ paddingTop: "8vh", paddingBottom: "8vh", maxWidth: "600px" }}>


      {(phase === "intro" || phase === "failed") && (
        <div className="card animate-slide-up" style={{ padding: "48px", textAlign: "center", borderRadius: "32px", border: phase === "failed" ? "2px solid var(--wise-danger)" : "1.5px solid var(--border-color)", background: "var(--bg-card)" }}>

          <h2 className="text-section" style={{ marginBottom: 16, fontSize: "1.8rem" }}>
            {phase === "failed" ? "Sign Attempt Interrupted" : "Sign Application Form"}
          </h2>
          <p className="text-body" style={{ marginBottom: 40, fontWeight: 600, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {phase === "failed" 
              ? "It seems the signing process was cancelled or failed. Please try again to complete your application." 
              : "We've prepared your final KYC application. Digitally sign it using your Aadhaar OTP to complete your onboarding securely."}
          </p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button 
              className="btn-primary" 
              onClick={startESign} 
              style={{ height: "64px", borderRadius: "16px", fontSize: "1.1rem", fontWeight: 800, width: "100%" }} 
              disabled={loading}
            >
              {loading ? "Preparing Portal..." : (phase === "failed" ? "Try Signing Again ➔" : "Sign with Aadhaar OTP ➔")}
            </button>
            
            <p style={{ marginTop: 20, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              <span style={{ color: "var(--wise-positive)", marginRight: 6 }}>✓</span> Powered by Digio Secure eSign
            </p>
          </div>
        </div>
      )}

      {phase === "processing" && (
        <div className="card animate-fade-in" style={{ padding: "64px 40px", textAlign: "center", borderRadius: "32px", background: "var(--bg-card)", border: "1.5px solid var(--border-color)" }}>
          <div className="loader" style={{ margin: '0 auto 32px', width: "56px", height: "56px", border: "4px solid var(--border-color)", borderTop: "4px solid var(--wise-green)" }}></div>
          <p style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text-primary)" }}>Launching Signing Portal</p>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: 12, fontWeight: 600 }}>
            Please wait while we establish a secure connection.
          </p>
        </div>
      )}

      {phase === "verifying" && (
        <div className="card animate-fade-in" style={{ padding: "64px 40px", textAlign: "center", borderRadius: "32px", background: "var(--bg-card)", border: "1.5px solid var(--border-color)" }}>
          <div className="loader" style={{ margin: '0 auto 32px', width: "56px", height: "56px", border: "4px solid var(--border-color)", borderTop: "4px solid var(--wise-green)" }}></div>
          <p style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text-primary)" }}>Verifying Signature & Finalizing</p>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: 12, fontWeight: 600 }}>
            Almost done! We are securely downloading your signed document.
          </p>
        </div>
      )}

    </div>
  );
}
