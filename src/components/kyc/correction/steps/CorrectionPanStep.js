"use client";
import { useState } from "react";
import { useCorrection } from "@/context/CorrectionContext";

/**
 * CorrectionPanStep — PAN re-verification correction wrapper.
 */
export default function CorrectionPanStep({ stepId, rejectedStep }) {
  const {
    applicationData,
    drafts,
    saveDraft,
    nextCorrectionStep,
    prevCorrectionStep,
    currentStepIndex,
    addToast,
  } = useCorrection();

  const existingPan = applicationData?.identityDetails?.pan || "";
  const [panNumber, setPanNumber] = useState(drafts[stepId]?.pan || "");
  const [panName, setPanName] = useState(drafts[stepId]?.panName || "");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const newErrors = {};
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panNumber.trim()) newErrors.panNumber = "PAN number is required";
    else if (!panRegex.test(panNumber.toUpperCase())) newErrors.panNumber = "Invalid PAN format (e.g., ABCDE1234F)";
    if (!panName.trim()) newErrors.panName = "Name as per PAN is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const success = await saveDraft(stepId, {
      pan: panNumber.toUpperCase(),
      panName: panName.trim(),
    });
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
          ⚠️ Reason: {rejectedStep.reason || "PAN verification needs correction"}
        </p>
      </div>

      <h2 style={{ color: "var(--text-primary)", fontSize: "1.15rem", fontWeight: 800, marginBottom: 8 }}>
        PAN Verification Correction
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 24 }}>
        Please re-enter your PAN details for verification.
      </p>

      {existingPan && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", margin: 0 }}>
            Previous PAN: <span style={{ textDecoration: "line-through", color: "#ef4444" }}>{existingPan}</span>
          </p>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
          PAN Number <span style={{ color: "var(--wise-danger)" }}>*</span>
        </label>
        <input
          type="text"
          value={panNumber}
          onChange={(e) => { setPanNumber(e.target.value.toUpperCase()); if (errors.panNumber) setErrors(prev => ({ ...prev, panNumber: "" })); }}
          placeholder="ABCDE1234F"
          maxLength={10}
          className="input-field"
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 12,
            background: "var(--input-bg)", border: `1.5px solid ${errors.panNumber ? "var(--wise-danger)" : "var(--border-color)"}`,
            color: "var(--text-primary)", fontSize: "1rem", fontWeight: 700,
            letterSpacing: 2, textTransform: "uppercase", outline: "none",
          }}
        />
        {errors.panNumber && <p style={{ color: "var(--wise-danger)", fontSize: "0.75rem", marginTop: 4 }}>{errors.panNumber}</p>}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
          Name as per PAN <span style={{ color: "var(--wise-danger)" }}>*</span>
        </label>
        <input
          type="text"
          value={panName}
          onChange={(e) => { setPanName(e.target.value); if (errors.panName) setErrors(prev => ({ ...prev, panName: "" })); }}
          placeholder="Enter name exactly as on PAN card"
          className="input-field"
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 12,
            background: "var(--input-bg)", border: `1.5px solid ${errors.panName ? "var(--wise-danger)" : "var(--border-color)"}`,
            color: "var(--text-primary)", fontSize: "0.95rem", fontWeight: 700, outline: "none",
          }}
        />
        {errors.panName && <p style={{ color: "var(--wise-danger)", fontSize: "0.75rem", marginTop: 4 }}>{errors.panName}</p>}
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
        {currentStepIndex > 0 && (
          <button onClick={prevCorrectionStep} style={{
            flex: 1, padding: "14px", borderRadius: 14,
            background: "var(--bg-elevated)", border: "1.5px solid var(--border-color)",
            color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
          }}>Back</button>
        )}
        <button onClick={handleSave} disabled={saving} style={{
          flex: 2, padding: "14px", borderRadius: 14,
          background: "var(--wise-green)", border: "none",
          color: "#1a1a2e", fontSize: "0.95rem", fontWeight: 800,
          cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
        }}>
          {saving ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </div>
  );
}
