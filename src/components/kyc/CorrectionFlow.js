"use client";
import { useState, useEffect } from "react";
import { useCorrection } from "@/context/CorrectionContext";
import CorrectionDetailsStep from "./correction/steps/CorrectionDetailsStep";
import CorrectionDocumentStep from "./correction/steps/CorrectionDocumentStep";
import CorrectionDigilockerStep from "./correction/steps/CorrectionDigilockerStep";
import CorrectionPanStep from "./correction/steps/CorrectionPanStep";
import CorrectionBankStep from "./correction/steps/CorrectionBankStep";
import CorrectionNomineeStep from "./correction/steps/CorrectionNomineeStep";
import CorrectionPricingStep from "./correction/steps/CorrectionPricingStep";
import CorrectionEsignStep from "./correction/steps/CorrectionEsignStep";
import CorrectionSelfieStep from "./correction/steps/CorrectionSelfieStep";

import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import { motion, AnimatePresence } from "framer-motion";

// Map stepId to the component that handles its correction
const STEP_COMPONENT_MAP = {
  personalDetails: CorrectionDetailsStep,
  pricingSelection: CorrectionPricingStep,
  panVerification: CorrectionPanStep,
  digilocker: CorrectionDigilockerStep,
  nomineeChoice: CorrectionNomineeStep,
  nomineeDetails: CorrectionNomineeStep,
  nomineeAllocation: CorrectionNomineeStep,
  bankVerification: CorrectionBankStep,
  // Document-type steps all use CorrectionDocumentStep
  financialProof: CorrectionDocumentStep,
  signature: CorrectionDocumentStep,
  panUpload: CorrectionDocumentStep,
  ipv: CorrectionSelfieStep,
  pepProof: CorrectionDetailsStep, // PEP proof is in the DetailsStep page
  nominee1Proof: CorrectionNomineeStep,
  nominee2Proof: CorrectionNomineeStep,
  nominee3Proof: CorrectionNomineeStep,
  guardian1Proof: CorrectionNomineeStep,
  guardian2Proof: CorrectionNomineeStep,
  guardian3Proof: CorrectionNomineeStep,
};

// Document-type steps that should be grouped on a single document page
const DOCUMENT_STEP_IDS = new Set([
  "financialProof", "signature", "panUpload", "ipv",
  "pepProof", "nominee1Proof", "nominee2Proof", "nominee3Proof",
  "guardian1Proof", "guardian2Proof", "guardian3Proof",
]);

export default function CorrectionFlow() {
  const {
    isLoading,
    error,
    isStaleSession,
    staleMessage,
    rejectedSteps,
    currentStepIndex,
    allStepsComplete,
    applicationData,
    drafts,
    toasts,
    submitting,
    alreadySubmitted,
    goToCorrectionStep,
    submitCorrections,
    stepTitleMap,
  } = useCorrection();

  const [mounted, setMounted] = useState(false);
  const [completionShown, setCompletionShown] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Loading state
  if (!mounted || isLoading) {
    return (
      <div style={{
        height: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 20,
        background: "var(--bg-primary)"
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: 40, height: 40, border: "3px solid var(--border-color)", borderTopColor: "var(--wise-green)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontWeight: 700 }}>Loading correction session...</p>
        </div>
        <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{
        height: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 24,
        background: "var(--bg-primary)", padding: "2rem"
      }}>
        <div style={{
          background: "var(--bg-elevated)", borderRadius: 20, padding: "40px 36px",
          maxWidth: 480, width: "100%", textAlign: "center",
          border: "1px solid var(--border-color)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: "var(--text-primary)", fontSize: "1.2rem", fontWeight: 800, marginBottom: 12 }}>
            Unable to Load Corrections
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>{error}</p>
        </div>
      </div>
    );
  }

  // Stale session state
  if (isStaleSession) {
    return (
      <div style={{
        height: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 24,
        background: "var(--bg-primary)", padding: "2rem"
      }}>
        <div style={{
          background: "var(--bg-elevated)", borderRadius: 20, padding: "40px 36px",
          maxWidth: 520, width: "100%", textAlign: "center",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <h2 style={{ color: "var(--text-primary)", fontSize: "1.2rem", fontWeight: 800, marginBottom: 12 }}>
            New Correction Email Sent
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
            {staleMessage || "A new correction email has been sent to you. Please use the link from the latest email to complete your KYC corrections."}
          </p>
          <div style={{
            marginTop: 24, padding: "12px 20px",
            background: "rgba(239, 68, 68, 0.08)",
            borderRadius: 12,
            border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "#ef4444",
            fontSize: "0.85rem",
            fontWeight: 700,
          }}>
            This link is no longer valid. Please check your inbox for the latest email.
          </div>
        </div>
      </div>
    );
  }

  // Completion state
  if (completionShown || alreadySubmitted) {
    return (
      <div style={{
        height: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 24,
        background: "var(--bg-primary)", padding: "2rem"
      }}>
        <div style={{
          background: "var(--bg-elevated)", borderRadius: 20, padding: "40px 36px",
          maxWidth: 520, width: "100%", textAlign: "center",
          border: "1px solid rgba(159, 232, 112, 0.3)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.1)"
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--wise-green), #6fcf97)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", boxShadow: "0 8px 32px rgba(159, 232, 112, 0.3)"
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ color: "var(--text-primary)", fontSize: "1.3rem", fontWeight: 800, marginBottom: 12 }}>
            Corrections Submitted Successfully!
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
            Your corrected details have been submitted for review. Our team will verify your updates and get back to you.
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: 16 }}>
            You can close this page now.
          </p>
        </div>
      </div>
    );
  }

  // Build the step flow: rejected steps + eSign (if required)
  const totalCorrectionSteps = rejectedSteps.length;
  const currentRejectedStep = rejectedSteps[currentStepIndex];
  const isOnRejectedStep = currentStepIndex < totalCorrectionSteps;

  // Get the component for the current step
  const getStepComponent = () => {
    if (!isOnRejectedStep) {
      // We're past all rejected steps — show the completion/submit screen
      return <CorrectionCompletionStep />;
    }

    const stepId = currentRejectedStep.stepId;
    const Component = STEP_COMPONENT_MAP[stepId];

    if (!Component) {
      return (
        <div style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)" }}>
            Unsupported correction step: <strong>{stepId}</strong>
          </p>
        </div>
      );
    }

    return <Component stepId={stepId} rejectedStep={currentRejectedStep} />;
  };

  return (
    <main className="portal-container">
      {/* LEFT SIDE: Correction Sidebar */}
      <aside className="portal-sidebar">
        <div className="sidebar-header" style={{ position: "relative", zIndex: 2 }}>
          <div className="logo-section logo-section-container" style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" }}>
            <Logo width={180} height={180} className="mb-2 logo-img" />
            <h1 style={{
              fontSize: "1.25rem", fontWeight: 900, letterSpacing: "1.5px",
              color: "#ffffff", textTransform: "uppercase",
              textShadow: "0 2px 10px rgba(0,0,0,0.2)",
              marginTop: "8px", textAlign: "center"
            }}>
              Stockology Securities
            </h1>
            <div style={{ width: 40, height: 3, background: "#ef4444", borderRadius: 2, marginTop: 12 }} />
          </div>

          {/* Correction Mode Badge */}
          <div style={{
            background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)",
            borderRadius: 12, padding: "10px 16px", marginBottom: 20, textAlign: "center",
          }}>
            <span style={{ color: "#ef4444", fontSize: "0.7rem", fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>
              CORRECTION MODE
            </span>
          </div>

          {/* Step Checklist */}
          <div className="desktop-only" style={{ marginBottom: 24, width: "100%" }}>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
              ITEMS TO CORRECT
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {rejectedSteps.map((step, idx) => {
                const isActive = idx === currentStepIndex;
                const isComplete = step.completed;
                return (
                  <div
                    key={step.stepId}
                    onClick={() => goToCorrectionStep(idx)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 12px", borderRadius: 10,
                      cursor: "pointer",
                      background: isActive ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.03)",
                      border: isActive ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid transparent",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.7rem", fontWeight: 800, flexShrink: 0,
                      background: isComplete ? "var(--wise-green)" : isActive ? "rgba(239, 68, 68, 0.3)" : "rgba(255,255,255,0.1)",
                      color: isComplete ? "#1a1a2e" : isActive ? "#ef4444" : "rgba(255,255,255,0.5)",
                    }}>
                      {isComplete ? "✓" : idx + 1}
                    </div>
                    <span style={{
                      fontSize: "0.8rem", fontWeight: 700,
                      color: isActive ? "#ffffff" : isComplete ? "rgba(159,232,112,0.8)" : "rgba(255,255,255,0.5)",
                    }}>
                      {stepTitleMap[step.stepId] || step.stepId}
                    </span>
                  </div>
                );
              })}

              {/* Completion step */}
              <div
                onClick={() => allStepsComplete && goToCorrectionStep(totalCorrectionSteps)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", borderRadius: 10,
                  cursor: allStepsComplete ? "pointer" : "default",
                  opacity: allStepsComplete ? 1 : 0.4,
                  background: currentStepIndex === totalCorrectionSteps ? "rgba(159,232,112,0.15)" : "rgba(255,255,255,0.03)",
                  border: currentStepIndex === totalCorrectionSteps ? "1px solid rgba(159,232,112,0.3)" : "1px solid transparent",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.7rem", fontWeight: 800, flexShrink: 0,
                  background: currentStepIndex === totalCorrectionSteps ? "rgba(159,232,112,0.3)" : "rgba(255,255,255,0.1)",
                  color: currentStepIndex === totalCorrectionSteps ? "var(--wise-green)" : "rgba(255,255,255,0.4)",
                }}>
                  ✦
                </div>
                <span style={{
                  fontSize: "0.8rem", fontWeight: 700,
                  color: currentStepIndex === totalCorrectionSteps ? "#ffffff" : "rgba(255,255,255,0.4)",
                }}>
                  Submit Corrections
                </span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="progress-bar-container mobile-progress-line" style={{ marginTop: "auto" }}>
            <div className="progress-stats desktop-only">
              <span className="progress-label">PROGRESS</span>
              <span className="progress-percent">
                {Math.round((rejectedSteps.filter(s => s.completed).length / Math.max(totalCorrectionSteps, 1)) * 100)}%
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${(rejectedSteps.filter(s => s.completed).length / Math.max(totalCorrectionSteps, 1)) * 100}%`,
                  background: "#ef4444",
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", marginTop: 16 }}>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* RIGHT SIDE: Correction Step Content */}
      <div className="portal-content">
        <div className="w-full" style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepIndex}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              style={{ width: "100%", display: "flex", justifyContent: "center" }}
            >
              {getStepComponent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Background shapes */}
        <div className="content-bg-shape shape-1" />
        <div className="content-bg-shape shape-2" />
      </div>

      {/* Toast notifications */}
      <div style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              padding: "12px 20px", borderRadius: 12,
              background: t.type === "error" ? "rgba(239, 68, 68, 0.9)" : "rgba(159, 232, 112, 0.9)",
              color: t.type === "error" ? "#fff" : "#1a1a2e",
              fontSize: "0.85rem", fontWeight: 700,
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            {t.message}
          </motion.div>
        ))}
      </div>
    </main>
  );
}

/**
 * Completion step shown when all rejected steps are corrected.
 * Shows a summary and submit button.
 */
function CorrectionCompletionStep() {
  const {
    rejectedSteps,
    allStepsComplete,
    submitting,
    submitCorrections,
    stepTitleMap,
    goToCorrectionStep,
    addToast,
  } = useCorrection();

  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return <CorrectionEsignStep />;
  }

  const handleSubmit = async () => {
    if (!allStepsComplete) {
      addToast("Please complete all correction steps first.", "error");
      return;
    }
    const success = await submitCorrections();
    if (success) {
      setSubmitted(true);
    }
  };

  return (
    <div className="step-card" style={{ maxWidth: 560, margin: "0 auto", padding: "36px 32px" }}>
      <h2 style={{ color: "var(--text-primary)", fontSize: "1.2rem", fontWeight: 800, marginBottom: 8, textAlign: "center" }}>
        Review & Submit Corrections
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 28, textAlign: "center" }}>
        Please review all your corrections below before submitting.
      </p>

      {/* Summary of corrected steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
        {rejectedSteps.map((step, idx) => (
          <div
            key={step.stepId}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px", borderRadius: 12,
              background: step.completed ? "rgba(159,232,112,0.06)" : "rgba(239,68,68,0.06)",
              border: `1px solid ${step.completed ? "rgba(159,232,112,0.2)" : "rgba(239,68,68,0.2)"}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: step.completed ? "var(--wise-green)" : "rgba(239,68,68,0.2)",
                color: step.completed ? "#1a1a2e" : "#ef4444",
                fontSize: "0.75rem", fontWeight: 800,
              }}>
                {step.completed ? "✓" : "!"}
              </div>
              <div>
                <p style={{ color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>
                  {stepTitleMap[step.stepId] || step.stepId}
                </p>
                <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", margin: 0, marginTop: 2 }}>
                  {step.type === "document" ? "Document correction" : "Module correction"}
                </p>
              </div>
            </div>
            {!step.completed && (
              <button
                onClick={() => goToCorrectionStep(idx)}
                style={{
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                  color: "#ef4444", borderRadius: 8, padding: "6px 14px",
                  fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
                }}
              >
                Fix Now
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!allStepsComplete || submitting}
        style={{
          width: "100%", padding: "16px", borderRadius: 14,
          background: allStepsComplete ? "var(--wise-green)" : "var(--border-color)",
          color: allStepsComplete ? "#1a1a2e" : "var(--text-muted)",
          border: "none", fontSize: "1rem", fontWeight: 800,
          cursor: allStepsComplete ? "pointer" : "not-allowed",
          opacity: submitting ? 0.7 : 1,
          transition: "all 0.2s ease",
        }}
      >
        {submitting ? "Submitting..." : allStepsComplete ? "Submit All Corrections" : "Complete all steps to submit"}
      </button>
    </div>
  );
}
