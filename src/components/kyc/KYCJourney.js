"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useKYC } from "@/context/KYCContext";
import PhoneStep from "./steps/PhoneStep";
import EmailStep from "./steps/EmailStep";
import PricingStep from "./steps/PricingStep";
import PanStep from "./steps/PanStep";
import DigilockerStep from "./steps/DigilockerStep";
import DetailsStep from "./steps/DetailsStep";
import AddressStep from "./steps/AddressStep";
import NomineeChoiceStep from "./steps/NomineeChoiceStep";
import NomineeStep from "./steps/NomineeStep";
import NomineeAllocationStep from "./steps/NomineeAllocationStep";
import BankVerificationStep from "./steps/BankVerificationStep";
import DocumentUploadStep from "./steps/DocumentUploadStep";
import EsignPreviewStep from "./steps/EsignPreviewStep";
import AadhaarEsignStep from "./steps/AadhaarEsignStep";
import FinalCompletionStep from "./steps/FinalCompletionStep";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

export default function KYCJourney() {
  const { currentStep, steps, isRestoring, prevStep, STEPS, stepStatuses, rejectionReason, submittedAt, isResubmitted } = useKYC();
  const router = useRouter();
  const TOTAL_STEPS = (steps.length > 0 ? steps.length : STEPS.length) - 1;

  const hasStepStatuses = stepStatuses && Object.keys(stepStatuses).length > 0;
  const hasAnyRejected = hasStepStatuses && Object.values(stepStatuses).some(s => s?.status === "rejected");
  const isResubmission = !!rejectionReason || !!submittedAt || !!isResubmitted || hasAnyRejected;
  const progressStep = isResubmission ? TOTAL_STEPS : currentStep;

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Capture AP Code from URL
    const urlParams = new URLSearchParams(window.location.search);
    const apcode = urlParams.get('apcode');
    if (apcode) {
      sessionStorage.setItem('apCode', apcode);
    }
  }, []);

  // Synchronize URL with currentStep
  useEffect(() => {
    if (mounted && currentStep >= 0) {
      const stepId = (steps.length > 0 ? steps : STEPS)[currentStep]?.id;
      if (stepId) {
        const currentPath = window.location.pathname;
        const targetPath = stepId === "phone" ? "/" : `/${stepId}`;
        
        if (currentPath !== targetPath) {
          router.replace(targetPath, { scroll: false });
        }
      }
    }
  }, [currentStep, mounted, steps, STEPS]);

  if (!mounted || isRestoring) {
    return (
      <div style={{ 
        height: "100vh", display: "flex", flexDirection: "column", 
        alignItems: "center", justifyContent: "center", gap: 20,
        background: "var(--bg-primary)" 
      }}>
        <Logo width={180} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div className="spinner" style={{ width: 40, height: 40, border: "3px solid var(--border-color)", borderTopColor: "var(--wise-green)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <p className="text-body-bold" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Resuming your application...</p>
        </div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin { to { transform: rotate(360deg); } }
        `}} />
      </div>
    );
  }

  return (
    <main className="portal-container">
      {/* LEFT SIDE: Branding & Progress Sidebar / TOP NAVBAR on Mobile */}
      <aside className="portal-sidebar">
        {/* Background Bull Graphic - Centered Watermark */}
        <div className="bull-graphic" style={{ 
          position: "absolute", 
          top: "50%", 
          left: "50%", 
          transform: "translate(-50%, -50%)", 
          opacity: 0.04, 
          pointerEvents: "none",
          width: "100%",
          display: "flex",
          justifyContent: "center"
        }}>
           <Logo variant="bull" width={500} height={500} />
        </div>

        <div className="sidebar-header">
          <div className="logo-section">
            <Logo width={130} height={38} className="mb-0" />
          </div>
          
          {currentStep > 0 && (
            <div className="progress-section" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              {/* Desktop-only Stage Name */}
              <div className="desktop-only" style={{ marginBottom: 16 }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 900, color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" }}>CURRENT STAGE</span>
                <h3 style={{ color: "white", fontSize: "1.25rem", marginTop: 4, fontWeight: 800, letterSpacing: "-0.3px" }}>
                   {steps[currentStep]?.label || "Processing"}
                </h3>
              </div>

              <div className="progress-bar-container" style={{ width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, whiteSpace: "nowrap" }}>
                   <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--wise-green)", opacity: 0.9 }}>PROGRESS</span>
                   <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "white" }}>{Math.round((progressStep/TOTAL_STEPS)*100)}%</span>
                </div>
                <div style={{ width: "100%", height: 5, background: "rgba(255,255,255,0.12)", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ width: `${(progressStep/TOTAL_STEPS)*100}%`, height: "100%", background: "var(--wise-green)", transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)" }}></div>
                </div>
              </div>
            </div>
          )}

          <div className="theme-toggle-section" style={{ display: "flex", alignItems: "center" }}>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* RIGHT SIDE: Main Journey Content */}
      <div className="portal-content">
        <div className="w-full" style={{ position: "relative" }}>
          {currentStep === 1 && <PhoneStep />}
          {currentStep === 2 && <EmailStep />}
          {currentStep === 3 && <PricingStep />}
          {currentStep === 4 && <PanStep />}
          {currentStep === 5 && <DigilockerStep />}
          {currentStep === 6 && <DetailsStep />}
          {currentStep === 7 && <NomineeChoiceStep />}
          {currentStep === 8 && <NomineeStep />}
          {currentStep === 9 && <NomineeAllocationStep />}
          {currentStep === 10 && <BankVerificationStep />}
          {currentStep === 11 && <DocumentUploadStep />}
          {currentStep === 12 && <EsignPreviewStep />}
          {currentStep === 13 && <AadhaarEsignStep />}
          {currentStep === 14 && <FinalCompletionStep />}
        </div>
        
        {/* Abstract shapes moved to the right side background */}
        <div style={{ position: "fixed", top: "-10%", right: "-10%", width: "40vw", height: "40vw", background: "rgba(159, 232, 112, 0.03)", filter: "blur(100px)", borderRadius: "50%", zIndex: -1 }} />
        <div style={{ position: "fixed", bottom: "-10%", right: "10%", width: "30vw", height: "30vw", background: "rgba(0, 145, 255, 0.02)", filter: "blur(100px)", borderRadius: "50%", zIndex: -1 }} />
      </div>
    </main>
  );
}
