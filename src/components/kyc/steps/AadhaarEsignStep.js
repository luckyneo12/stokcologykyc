"use client";
import { useState, useEffect } from "react";

import { useKYC } from "@/context/KYCContext";
import Logo from "../Logo";

import { initializeDigio, createDigioRequest, fetchDigioRequestResponse } from "@/utils/digio";
import { submitKyc } from "@/utils/kycApi";
import { PenLine, Check, AppWindow, ShieldCheck } from "lucide-react";
import "../esign-launch.css";

// Waiting screen for the "processing" (Digio window opening / open) and "verifying" phases
function SigningProgress({ phase, launchStage }) {
  const verifying = phase === "verifying";
  const windowOpen = !verifying && launchStage === "open";
  // 0: form ready, 1: connecting to Digio, 2: signing in Digio, 3: verifying & submitting
  const current = verifying ? 3 : windowOpen ? 2 : 1;
  const steps = [
    { label: "Application form ready", note: "Your filled form has been prepared for signing." },
    { label: "Opening the secure Digio window", note: "Digio is the registered eSign service we use." },
    { label: "Sign with Aadhaar OTP", note: "Done by you, in the Digio window." },
    { label: "Verify & submit application", note: "We check the signature and submit your application." },
  ];

  const title = verifying ? "Verifying your signature" : windowOpen ? "Sign in the Digio window" : "Preparing your signing window";
  const sub = verifying
    ? "Almost done! We are securely downloading your signed form and submitting your application. Please don't close this page."
    : windowOpen
    ? "Complete your signature in the Digio window. This page updates by itself once you're done."
    : "Setting up a secure session with Digio. The signing window will open in a moment.";

  return (
    <div className="esl-card animate-fade-in">
      <div className="esl-visual" aria-hidden="true">
        <span className="esl-ring" />
        <span className="esl-ring r2" />
        <span className="esl-badge">{verifying ? <ShieldCheck size={34} strokeWidth={2.2} /> : <PenLine size={32} strokeWidth={2.2} />}</span>
      </div>

      <div role="status" aria-live="polite">
        <p className="esl-title">{title}</p>
        <p key={title} className="esl-sub">{sub}</p>
      </div>

      <ol className="esl-steps">
        {steps.map((s, i) => {
          const state = i < current ? "done" : i === current ? "active" : "pending";
          return (
            <li key={s.label} className={`esl-step ${state}`} aria-current={state === "active" ? "step" : undefined}>
              <span className="esl-dot">{state === "done" ? <Check size={15} strokeWidth={3.2} /> : i + 1}</span>
              <span className="esl-step-text">
                <span className="esl-step-label">{s.label}</span>
                {state !== "pending" && <span className="esl-step-note">{s.note}</span>}
              </span>
            </li>
          );
        })}
      </ol>

      {windowOpen && (
        <p className="esl-hint">
          <AppWindow size={16} strokeWidth={2.2} aria-hidden="true" />
          <span>Keep this page open. Can&apos;t see the Digio window? It may have opened behind this page, or your browser may have blocked the pop-up.</span>
        </p>
      )}

      <span className="esl-secure"><ShieldCheck size={15} strokeWidth={2.4} aria-hidden="true" /> Secured by Digio &middot; Aadhaar eSign</span>
    </div>
  );
}

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
  const [aadhaarMismatch, setAadhaarMismatch] = useState(null); // message when eSign used another Aadhaar
  const [launchStage, setLaunchStage] = useState("connecting"); // display only: "connecting" → "open" (Digio window)


  const handleDigioSuccess = async (requestId) => {
    setLoading(true);
    setPhase("verifying");
    try {
      const result = await fetchDigioRequestResponse(requestId, "ESIGN");
      // Signed with a different Aadhaar: nothing was saved — back to the sign step with the reason
      if (result?.code === "ESIGN_AADHAAR_MISMATCH") {
        setAadhaarMismatch(result.error);
        setPhase("failed");
        setLoading(false);
        addToast("Aadhaar did not match — please eSign again with your own Aadhaar.", "error");
        return;
      }
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
    setAadhaarMismatch(null);
    let rawIdentifier = personalDetails?.phone || personalDetails?.email || "user@example.com";
    const identifier = rawIdentifier.replace(/\D/g, '').length >= 10 
      ? rawIdentifier.replace(/\D/g, '').slice(-10) 
      : rawIdentifier;
      
    const digio = initializeDigio({
      environment: process.env.NEXT_PUBLIC_DIGIO_ENV || "production",
      logoUrl: "/logo120.png",
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
    setLaunchStage("connecting");
    setPhase("processing");

    try {
      const { requestId, customerIdentifier, accessToken, applicationId: requestApplicationId } = await createDigioRequest("ESIGN", {
        customerIdentifier: identifier,
        fullName: personalDetails?.fullName || "KYC Applicant",
      });
      if (requestApplicationId) setApplicationId(requestApplicationId);
      if (accessToken) {
        digio.submit(requestId, customerIdentifier, accessToken);
      } else {
        digio.submit(requestId, customerIdentifier);
      }
      setLaunchStage("open");
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
            {aadhaarMismatch ? "Aadhaar Did Not Match" : phase === "failed" ? "Sign Attempt Interrupted" : "Sign Application Form"}
          </h2>
          <p className="text-body" role={aadhaarMismatch ? "alert" : undefined} style={{ marginBottom: 40, fontWeight: 600, color: aadhaarMismatch ? "var(--wise-danger)" : "var(--text-secondary)", lineHeight: 1.6 }}>
            {aadhaarMismatch
              ? aadhaarMismatch
              : phase === "failed"
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
              {loading ? "Preparing Portal..." : aadhaarMismatch ? "eSign Again with Your Aadhaar ➔" : (phase === "failed" ? "Try Signing Again ➔" : "Sign with Aadhaar OTP ➔")}
            </button>
            
            <p style={{ marginTop: 20, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              <span style={{ color: "var(--wise-positive)", marginRight: 6 }}>✓</span> Powered by Digio Secure eSign
            </p>
          </div>
        </div>
      )}

      {(phase === "processing" || phase === "verifying") && (
        <SigningProgress phase={phase} launchStage={launchStage} />
      )}

    </div>
  );
}
