"use client";
import { useState } from "react";
import { useCorrection } from "@/context/CorrectionContext";

/**
 * CorrectionPricingStep — Pricing selection correction wrapper.
 */
export default function CorrectionPricingStep({ stepId, rejectedStep }) {
  const {
    applicationData,
    drafts,
    saveDraft,
    nextCorrectionStep,
    prevCorrectionStep,
    currentStepIndex,
    addToast,
  } = useCorrection();

  const existingSegments = applicationData?.segments || {};
  const existingBsda = applicationData?.bsda !== undefined ? applicationData.bsda : false;
  const draft = drafts[stepId] || {};

  const [segments, setSegments] = useState(draft.segments || {
    cash: existingSegments.cash !== false,
    mutualFund: existingSegments.mutualFund !== false,
    fno: existingSegments.fno || false,
    currency: existingSegments.currency || false,
    commodity: existingSegments.commodity || false,
  });

  const [bsda, setBsda] = useState(draft.bsda !== undefined ? draft.bsda : existingBsda);
  const [saving, setSaving] = useState(false);

  const toggleSegment = (key) => {
    setSegments(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    // Validate
    if (!segments.cash && !segments.mutualFund && !segments.fno && !segments.currency && !segments.commodity) {
      addToast("Please select at least one segment", "error");
      return;
    }

    setSaving(true);
    const success = await saveDraft(stepId, { segments, bsda });
    setSaving(false);
    if (success) nextCorrectionStep();
  };

  const segmentOptions = [
    { key: "cash", label: "Cash / Equities", alwaysOn: true },
    { key: "mutualFund", label: "Mutual Funds", alwaysOn: true },
    { key: "fno", label: "Futures & Options (F&O)" },
    { key: "currency", label: "Currency" },
    { key: "commodity", label: "Commodity" },
  ];

  return (
    <div className="step-card" style={{ maxWidth: 560, margin: "0 auto", padding: "32px 28px" }}>
      <div style={{
        background: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.2)",
        borderRadius: 12, padding: "14px 18px", marginBottom: 24,
      }}>
        <p style={{ color: "#ef4444", fontSize: "0.8rem", fontWeight: 700, margin: 0 }}>
          ⚠️ Reason: {rejectedStep.reason || "Pricing / Segments selection needs correction"}
        </p>
      </div>

      <h2 style={{ color: "var(--text-primary)", fontSize: "1.15rem", fontWeight: 800, marginBottom: 8 }}>
        Pricing & Segments Correction
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 24 }}>
        Please select the segments you wish to trade in.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {segmentOptions.map((seg) => (
          <label key={seg.key} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "16px 20px", borderRadius: 12, cursor: "pointer",
            background: segments[seg.key] ? "rgba(159,232,112,0.06)" : "var(--bg-elevated)",
            border: `1.5px solid ${segments[seg.key] ? "var(--wise-green)" : "var(--border-color)"}`,
            transition: "all 0.2s ease"
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 6,
              background: segments[seg.key] ? "var(--wise-green)" : "transparent",
              border: `2px solid ${segments[seg.key] ? "var(--wise-green)" : "var(--border-color)"}`,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              {segments[seg.key] && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span style={{ color: "var(--text-primary)", fontSize: "0.95rem", fontWeight: 700 }}>
              {seg.label}
            </span>
            {seg.alwaysOn && (
              <span style={{
                marginLeft: "auto", fontSize: "0.7rem", fontWeight: 800,
                color: "var(--text-muted)", background: "var(--input-bg)", padding: "4px 8px", borderRadius: 6
              }}>DEFAULT</span>
            )}
          </label>
        ))}
      </div>

      <div style={{
        padding: "16px 20px", borderRadius: 12, background: "var(--bg-elevated)",
        border: "1.5px solid var(--border-color)", marginBottom: 32
      }}>
        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <div style={{
            width: 20, height: 20, borderRadius: 4,
            background: bsda ? "var(--wise-green)" : "transparent",
            border: `2px solid ${bsda ? "var(--wise-green)" : "var(--border-color)"}`,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            {bsda && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <div>
            <span style={{ color: "var(--text-primary)", fontSize: "0.95rem", fontWeight: 700, display: "block" }}>
              Opt-in for BSDA
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
              Basic Services Demat Account facility
            </span>
          </div>
          <input type="checkbox" checked={bsda} onChange={(e) => setBsda(e.target.checked)} style={{ display: "none" }} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
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
