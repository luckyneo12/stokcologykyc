"use client";
import { useState } from "react";
import { useCorrection } from "@/context/CorrectionContext";

/**
 * CorrectionNomineeStep — Handles nomineeChoice, nomineeDetails, and nomineeAllocation corrections.
 */
export default function CorrectionNomineeStep({ stepId, rejectedStep }) {
  const {
    applicationData,
    drafts,
    saveDraft,
    nextCorrectionStep,
    prevCorrectionStep,
    currentStepIndex,
    addToast,
  } = useCorrection();

  const existingNominee = applicationData?.nomineeDetails || {};
  const existingAllocation = applicationData?.nomineeAllocation || {};
  const draft = drafts[stepId] || {};

  // Determine which sub-section we're correcting
  const isChoiceStep = stepId === "nomineeChoice";
  const isAllocationStep = stepId === "nomineeAllocation";
  const isDetailsStep = stepId === "nomineeDetails";

  // Nominee choice state
  const [wantNominee, setWantNominee] = useState(
    draft.wantNominee ?? existingNominee.wantNominee ?? "yes"
  );

  // Nominee details state (simplified for correction)
  const existingNominees = Array.isArray(existingNominee.nominees) ? existingNominee.nominees : [];
  const [nominees, setNominees] = useState(
    draft.nominees || existingNominees.map(n => ({
      name: "",
      relation: "",
      dob: "",
      ...n, // Keep existing fields, user can modify
    }))
  );

  // Allocation state
  const [allocations, setAllocations] = useState(
    draft.allocations || (existingAllocation.allocations || existingNominees.map((_, i) => ({
      nomineeIndex: i,
      percentage: Math.floor(100 / Math.max(existingNominees.length, 1)),
    })))
  );

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const updateNominee = (idx, key, value) => {
    setNominees(prev => prev.map((n, i) => i === idx ? { ...n, [key]: value } : n));
  };

  const validate = () => {
    const e = {};
    if (isDetailsStep) {
      nominees.forEach((n, i) => {
        if (!n.name?.trim()) e[`nominee_${i}_name`] = "Required";
        if (!n.relation?.trim()) e[`nominee_${i}_relation`] = "Required";
        if (!n.dob) e[`nominee_${i}_dob`] = "Required";
      });
    }
    if (isAllocationStep) {
      const total = allocations.reduce((sum, a) => sum + (parseInt(a.percentage) || 0), 0);
      if (total !== 100) e.allocation = "Allocations must sum to 100%";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      addToast("Please fix the errors", "error");
      return;
    }

    let draftData = {};
    if (isChoiceStep) {
      draftData = { wantNominee };
    } else if (isDetailsStep) {
      draftData = { nominees };
    } else if (isAllocationStep) {
      draftData = { allocations };
    }

    setSaving(true);
    const success = await saveDraft(stepId, draftData);
    setSaving(false);
    if (success) nextCorrectionStep();
  };

  const RELATIONS = ["Spouse", "Son", "Daughter", "Father", "Mother", "Brother", "Sister", "Other"];

  return (
    <div className="step-card" style={{ maxWidth: 600, margin: "0 auto", padding: "32px 28px" }}>
      <div style={{
        background: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.2)",
        borderRadius: 12, padding: "14px 18px", marginBottom: 24,
      }}>
        <p style={{ color: "#ef4444", fontSize: "0.8rem", fontWeight: 700, margin: 0 }}>
          ⚠️ Reason: {rejectedStep.reason || "Nominee details need correction"}
        </p>
      </div>

      <h2 style={{ color: "var(--text-primary)", fontSize: "1.15rem", fontWeight: 800, marginBottom: 8 }}>
        {isChoiceStep ? "Nominee Choice Correction" : isAllocationStep ? "Nominee Allocation Correction" : "Nominee Details Correction"}
      </h2>

      {/* Nominee Choice */}
      {isChoiceStep && (
        <div style={{ marginTop: 24 }}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 16 }}>Do you want to add nominees?</p>
          <div style={{ display: "flex", gap: 12 }}>
            {["yes", "no"].map(opt => (
              <button key={opt} onClick={() => setWantNominee(opt)} style={{
                flex: 1, padding: "14px", borderRadius: 12,
                background: wantNominee === opt ? "var(--wise-green)" : "var(--bg-elevated)",
                border: `1.5px solid ${wantNominee === opt ? "var(--wise-green)" : "var(--border-color)"}`,
                color: wantNominee === opt ? "#1a1a2e" : "var(--text-primary)",
                fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
                textTransform: "capitalize",
              }}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nominee Details */}
      {isDetailsStep && nominees.map((nominee, idx) => (
        <div key={idx} style={{
          padding: 20, borderRadius: 14,
          border: "1px solid var(--border-color)",
          background: "var(--bg-elevated)",
          marginBottom: 16, marginTop: idx === 0 ? 16 : 0,
        }}>
          <h4 style={{ color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 700, marginBottom: 14, margin: "0 0 14px 0" }}>
            Nominee {idx + 1}
          </h4>
          {[
            { key: "name", label: "Full Name", type: "text", placeholder: "Nominee name" },
            { key: "dob", label: "Date of Birth", type: "date", placeholder: "" },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                {label} <span style={{ color: "var(--wise-danger)" }}>*</span>
              </label>
              <input type={type} value={nominee[key] || ""} onChange={(e) => updateNominee(idx, key, e.target.value)}
                placeholder={placeholder}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10,
                  background: "var(--input-bg)",
                  border: `1.5px solid ${errors[`nominee_${idx}_${key}`] ? "var(--wise-danger)" : "var(--border-color)"}`,
                  color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 700, outline: "none",
                }} />
              {errors[`nominee_${idx}_${key}`] && <p style={{ color: "var(--wise-danger)", fontSize: "0.7rem", marginTop: 2 }}>{errors[`nominee_${idx}_${key}`]}</p>}
            </div>
          ))}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Relation <span style={{ color: "var(--wise-danger)" }}>*</span>
            </label>
            <select value={nominee.relation || ""} onChange={(e) => updateNominee(idx, "relation", e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                background: "var(--input-bg)",
                border: `1.5px solid ${errors[`nominee_${idx}_relation`] ? "var(--wise-danger)" : "var(--border-color)"}`,
                color: nominee.relation ? "var(--text-primary)" : "var(--text-muted)",
                fontSize: "0.9rem", fontWeight: 700, outline: "none",
              }}>
              <option value="">Select relation</option>
              {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {errors[`nominee_${idx}_relation`] && <p style={{ color: "var(--wise-danger)", fontSize: "0.7rem", marginTop: 2 }}>{errors[`nominee_${idx}_relation`]}</p>}
          </div>
        </div>
      ))}

      {/* Nominee Allocation */}
      {isAllocationStep && (
        <div style={{ marginTop: 16 }}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 16 }}>
            Set the allocation percentage for each nominee. Total must equal 100%.
          </p>
          {allocations.map((alloc, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span style={{ color: "var(--text-primary)", fontSize: "0.85rem", fontWeight: 700, minWidth: 100 }}>
                Nominee {idx + 1}
              </span>
              <input
                type="number"
                min="0" max="100"
                value={alloc.percentage || ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setAllocations(prev => prev.map((a, i) => i === idx ? { ...a, percentage: val } : a));
                }}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 10,
                  background: "var(--input-bg)", border: "1.5px solid var(--border-color)",
                  color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 700, outline: "none",
                }}
              />
              <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 700 }}>%</span>
            </div>
          ))}
          <p style={{
            color: allocations.reduce((s, a) => s + (parseInt(a.percentage) || 0), 0) === 100 ? "var(--wise-green)" : "#ef4444",
            fontSize: "0.8rem", fontWeight: 700, marginTop: 8,
          }}>
            Total: {allocations.reduce((s, a) => s + (parseInt(a.percentage) || 0), 0)}%
          </p>
          {errors.allocation && <p style={{ color: "var(--wise-danger)", fontSize: "0.75rem", marginTop: 4 }}>{errors.allocation}</p>}
        </div>
      )}

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
