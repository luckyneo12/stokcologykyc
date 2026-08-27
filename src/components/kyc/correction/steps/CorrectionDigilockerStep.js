"use client";
import { useState } from "react";
import { useCorrection } from "@/context/CorrectionContext";

/**
 * CorrectionDigilockerStep — User must redo the DigiLocker verification.
 * Shows a simple UI explaining they need to re-verify via DigiLocker.
 * The actual DigiLocker SDK flow is triggered here.
 */
export default function CorrectionDigilockerStep({ stepId, rejectedStep }) {
  const {
    applicationData,
    drafts,
    saveDraft,
    nextCorrectionStep,
    prevCorrectionStep,
    currentStepIndex,
    addToast,
  } = useCorrection();

  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(!!drafts[stepId]);
  const [saving, setSaving] = useState(false);

  const handleStartVerification = async () => {
    setVerifying(true);
    addToast("DigiLocker re-verification flow will be integrated with your existing DigiLocker SDK", "info");
    // NOTE: In a full integration, this would trigger the DigiLocker SDK
    // For now, we provide a placeholder that the user/dev can wire up to the existing DigiLocker flow
    setVerifying(false);
  };

  const handleSave = async () => {
    if (!verified && !drafts[stepId]) {
      addToast("Please complete DigiLocker verification first", "error");
      return;
    }
    setSaving(true);
    const success = await saveDraft(stepId, drafts[stepId] || { reVerified: true });
    setSaving(false);
    if (success) nextCorrectionStep();
  };

  return (
    <div className="step-card" style={{ maxWidth: 560, margin: "0 auto", padding: "32px 28px" }}>
      <div style={{
        background: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.2)",
        borderRadius: 12, padding: "14px 18px", marginBottom: 24,
      }}>
        <p style={{ color: "#ef4444", fontSize: "0.8rem", fontWeight: 700, margin: 0 }}>
          ⚠️ Reason: {rejectedStep.reason || "DigiLocker verification needs to be redone"}
        </p>
      </div>

      <h2 style={{ color: "var(--text-primary)", fontSize: "1.15rem", fontWeight: 800, marginBottom: 8 }}>
        DigiLocker Re-Verification
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 28 }}>
        Your previous DigiLocker data needs to be re-verified. Please complete the DigiLocker flow again.
        Your existing data will be replaced with the new verification only after you complete all corrections.
      </p>

      {verified ? (
        <div style={{
          padding: 20, borderRadius: 14,
          background: "rgba(159,232,112,0.06)", border: "1px solid rgba(159,232,112,0.2)",
          textAlign: "center", marginBottom: 24,
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
          <p style={{ color: "var(--wise-green)", fontWeight: 700, fontSize: "0.9rem" }}>
            DigiLocker verification completed
          </p>
        </div>
      ) : (
        <button
          onClick={handleStartVerification}
          disabled={verifying}
          style={{
            width: "100%", padding: "18px", borderRadius: 14,
            background: "linear-gradient(135deg, #667eea, #764ba2)",
            border: "none", color: "#fff", fontSize: "0.95rem", fontWeight: 800,
            cursor: verifying ? "wait" : "pointer",
            marginBottom: 24,
          }}
        >
          {verifying ? "Connecting to DigiLocker..." : "Start DigiLocker Verification"}
        </button>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        {currentStepIndex > 0 && (
          <button onClick={prevCorrectionStep} style={{
            flex: 1, padding: "14px", borderRadius: 14,
            background: "var(--bg-elevated)", border: "1.5px solid var(--border-color)",
            color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
          }}>Back</button>
        )}
        <button onClick={handleSave} disabled={saving || (!verified && !drafts[stepId])} style={{
          flex: 2, padding: "14px", borderRadius: 14,
          background: (verified || drafts[stepId]) ? "var(--wise-green)" : "var(--border-color)",
          border: "none", color: (verified || drafts[stepId]) ? "#1a1a2e" : "var(--text-muted)",
          fontSize: "0.95rem", fontWeight: 800,
          cursor: (verified || drafts[stepId]) ? "pointer" : "not-allowed",
          opacity: saving ? 0.7 : 1,
        }}>
          {saving ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </div>
  );
}
