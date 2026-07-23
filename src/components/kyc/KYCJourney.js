"use client";
import { useState, useEffect, useRef } from "react";
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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const sidebarRef = useRef(null);

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

  const handleMouseMove = (e) => {
    if (sidebarRef.current) {
      const rect = sidebarRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  if (!mounted || isRestoring) {
    return (
      <div style={{ 
        height: "100vh", display: "flex", flexDirection: "column", 
        alignItems: "center", justifyContent: "center", gap: 20,
        background: "var(--bg-primary)" 
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div className="spinner" style={{ width: 40, height: 40, border: "3px solid var(--border-color)", borderTopColor: "var(--wise-green)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <p className="text-body-bold" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Loading...</p>
        </div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin { to { transform: rotate(360deg); } }
        `}} />
      </div>
    );
  }

  return (
    <main className="portal-container">
      {/* LEFT SIDE: Interactive Beautiful Sidebar */}
      <aside 
        className="portal-sidebar" 
        ref={sidebarRef}
        onMouseMove={handleMouseMove}
      >
        {/* Interactive Spotlight Element */}
        <div 
          className="spotlight-effect"
          style={{
            position: 'absolute',
            top: mousePos.y,
            left: mousePos.x,
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, rgba(159, 232, 112, 0.15) 0%, rgba(0,0,0,0) 60%)',
            pointerEvents: 'none',
            transition: 'opacity 0.3s ease',
            zIndex: 1,
            opacity: mounted ? 1 : 0,
          }}
        />

        {/* Ambient background particles/blobs for extra visual appeal */}
        <div className="ambient-blob blob-1" />
        <div className="ambient-blob blob-2" />

        <div className="sidebar-header" style={{ position: 'relative', zIndex: 2 }}>
          {/* Logo Section */}
          <div className="logo-section logo-section-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
            <Logo width={180} height={180} className="mb-2 logo-img" />
            <h1 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '900', 
              letterSpacing: '1.5px', 
              color: '#ffffff', 
              textTransform: 'uppercase',
              textShadow: '0 2px 10px rgba(0,0,0,0.2)',
              marginTop: '8px',
              textAlign: 'center'
            }}>
              Stockology Securities
            </h1>
            <div className="accent-line" style={{ width: '40px', height: '3px', background: 'var(--wise-green)', borderRadius: '2px', marginTop: '12px' }}></div>
          </div>
          
          {currentStep > 0 && (
            <div className="progress-section glass-progress">
              {/* Sleek Interactive Step Indicator */}
              <div 
                className="step-indicator-wrapper"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  marginBottom: '28px',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  const circle = e.currentTarget.children[0];
                  circle.style.transform = 'scale(1.15) rotate(5deg)';
                  circle.style.boxShadow = '0 0 20px rgba(159,232,112,0.8)';
                  e.currentTarget.children[1].style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  const circle = e.currentTarget.children[0];
                  circle.style.transform = 'scale(1) rotate(0deg)';
                  circle.style.boxShadow = '0 0 10px rgba(159,232,112,0.4)';
                  e.currentTarget.children[1].style.color = 'rgba(255,255,255,0.5)';
                }}
              >
                <div 
                  className="step-circle"
                  style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'var(--wise-green)',
                  color: 'var(--wise-dark-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '900',
                  fontSize: '1rem',
                  boxShadow: '0 0 10px rgba(159,232,112,0.4)',
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}>
                  {currentStep}
                </div>
                <span style={{
                  color: 'rgba(255,255,255,0.5)',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  transition: 'color 0.3s ease'
                }}>
                  Out of {TOTAL_STEPS}
                </span>
              </div>

              <div className="desktop-only" style={{ marginBottom: 24 }}>
                <span className="stage-badge">CURRENT STAGE</span>
                <h3 className="stage-title text-glow">
                   {steps[currentStep]?.label || "Processing"}
                </h3>
              </div>

              <div className="progress-bar-container mobile-progress-line">
                <div className="progress-stats desktop-only">
                   <span className="progress-label">PROGRESS</span>
                   <span className="progress-percent">{Math.round((progressStep/TOTAL_STEPS)*100)}%</span>
                </div>
                <div className="progress-track">
                  <div 
                    className="progress-fill glow-effect" 
                    style={{ width: `${(progressStep/TOTAL_STEPS)*100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="theme-toggle-section" style={{ display: "flex", alignItems: "center", marginTop: 'auto' }}>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* RIGHT SIDE: Main Journey Content */}
      <div className="portal-content">
        <div className="w-full" style={{ position: "relative", zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
        
        {/* Abstract shapes moved to the right side background for the content area */}
        <div className="content-bg-shape shape-1" />
        <div className="content-bg-shape shape-2" />
      </div>
    </main>
  );
}
