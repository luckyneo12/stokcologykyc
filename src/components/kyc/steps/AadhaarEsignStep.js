"use client";
import { useState } from "react";
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

  const startESign = async () => {
    // ... cleaned up for brevity in thought, but applying full logic in replacement ...
    let rawIdentifier = personalDetails?.phone || personalDetails?.email || "user@example.com";
    const identifier = rawIdentifier.replace(/\D/g, '').length >= 10 
      ? rawIdentifier.replace(/\D/g, '').slice(-10) 
      : rawIdentifier;
      
    const digio = initializeDigio({
      environment: process.env.NEXT_PUBLIC_DIGIO_ENV || "production",
      logoUrl: "/logo120.png",
      callback: async (response) => {
        if (response.error_code) {
          console.error("Digio Error:", response);
          if (response.error_code === "CANCELLED") {
            addToast("eSign cancelled by user", "info");
          } else {
            addToast(`eSign failed: ${response.message}`, "error");
          }
          setLoading(false);
          setPhase("failed");
          return;
        }
        
        setLoading(true);
        try {
          await fetchDigioRequestResponse(response.digio_doc_id || response.id, "ESIGN");
          
          const activeApplicationId = kycApplicationId;
          if (activeApplicationId) {
            const payload = getBackendPayload({ 
              personalDetails, identityDetails, address, bankDetails, consent, segments, bsda, nomineeDetails, nomineeAllocation, ocrData,
              selfie: { matchScore: ocrData?.matchScore || 0, preview: null },
              currentStep: 14 // Completion step
            }, "aadhaarEsign");
            await submitKyc({ applicationId: activeApplicationId, data: payload });
          }
          
          updateState({ status: "under_review", submittedAt: new Date().toISOString() });
          setPhase("done");
          addToast("Document eSigned successfully!", "success");
          // Immediate transition to ensure "Thank you" screen appears as soon as window closes
          nextStep();
        } catch (error) {
          console.error("Post-eSign error:", error);
          setPhase("failed");
          setLoading(false);
          addToast("Signature verified, but failed to update application. Our team will review this manually.", "warning");
        }
      }
    });

    if (!digio) {
      addToast("Digio SDK not loaded. Please refresh the page.", "error");
      return;
    }

    digio.init();
    setLoading(true);
    setPhase("processing");
    
    try {
      const { requestId, customerIdentifier, accessToken, applicationId: requestApplicationId } = await createDigioRequest("ESIGN", {
        customerIdentifier: identifier,
        fullName: personalDetails?.fullName || "KYC Applicant"
      });
      if (requestApplicationId) setApplicationId(requestApplicationId);
      digio.submit(requestId, customerIdentifier, accessToken);
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
      <div className="text-center animate-slide-up" style={{ marginBottom: 40 }}>
        <Logo width={160} height={50} style={{ marginBottom: 32, marginInline: "auto" }} />
        <h1 className="text-section" style={{ fontSize: "2.4rem", fontWeight: 900, letterSpacing: "-0.5px", color: "var(--text-primary)" }}>Final Step</h1>
      </div>

      {(phase === "intro" || phase === "failed") && (
        <div className="card animate-slide-up" style={{ padding: "48px", textAlign: "center", borderRadius: "32px", border: phase === "failed" ? "2px solid var(--wise-danger)" : "1.5px solid var(--border-color)", background: "var(--bg-card)" }}>
          <div style={{ fontSize: '4.5rem', marginBottom: 24, filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.1))" }}>
            {phase === "failed" ? "⚠️" : "✍️"}
          </div>
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

      {phase === "done" && (
        <div className="card animate-scale-in" style={{ padding: "64px 40px", textAlign: "center", borderRadius: "32px", background: "var(--bg-card)", border: "1.5px solid var(--wise-green)" }}>
          <div style={{ fontSize: '5rem', marginBottom: 24 }}>🎉</div>
          <h2 className="text-section" style={{ marginBottom: 16, fontSize: "2rem" }}>Submission Successful!</h2>
          <p className="text-body" style={{ marginBottom: 40, fontWeight: 600, color: "var(--text-secondary)" }}>
            Your signed application is being processed. You will be redirected to the dashboard in a moment.
          </p>
          <div className="loader" style={{ margin: '0 auto', width: "32px", height: "32px", border: "3px solid var(--border-color)", borderTop: "3px solid var(--wise-green)" }}></div>
        </div>
      )}
    </div>
  );
}
