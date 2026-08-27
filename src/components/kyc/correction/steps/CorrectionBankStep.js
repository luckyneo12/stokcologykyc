"use client";
import { useState } from "react";
import { useCorrection } from "@/context/CorrectionContext";

/**
 * CorrectionBankStep — Bank re-verification correction wrapper.
 */
export default function CorrectionBankStep({ stepId, rejectedStep }) {
  const {
    applicationData,
    drafts,
    saveDraft,
    nextCorrectionStep,
    prevCorrectionStep,
    currentStepIndex,
    addToast,
  } = useCorrection();

  const existingBank = applicationData?.bankDetails || {};
  const draft = drafts[stepId] || {};

  const [form, setForm] = useState({
    accountNumber: draft.accountNumber || "",
    confirmAccountNumber: draft.confirmAccountNumber || "",
    ifscCode: draft.ifscCode || "",
    bankName: draft.bankName || "",
    branchName: draft.branchName || "",
    accountType: draft.accountType || "Savings",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const update = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.accountNumber.trim()) e.accountNumber = "Required";
    if (form.accountNumber !== form.confirmAccountNumber) e.confirmAccountNumber = "Account numbers don't match";
    if (!form.ifscCode.trim()) e.ifscCode = "Required";
    else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode.toUpperCase())) e.ifscCode = "Invalid IFSC format";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      addToast("Please fix the errors", "error");
      return;
    }
    setSaving(true);
    const success = await saveDraft(stepId, {
      ...form,
      ifscCode: form.ifscCode.toUpperCase(),
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
          ⚠️ Reason: {rejectedStep.reason || "Bank details need correction"}
        </p>
      </div>

      <h2 style={{ color: "var(--text-primary)", fontSize: "1.15rem", fontWeight: 800, marginBottom: 8 }}>
        Bank Details Correction
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 24 }}>
        Please re-enter your bank account details.
      </p>

      {existingBank.accountNumber && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", margin: 0 }}>
            Previous A/C: <span style={{ textDecoration: "line-through", color: "#ef4444" }}>
              ****{(existingBank.accountNumber || "").slice(-4)}
            </span>
            {existingBank.bankName && <> | {existingBank.bankName}</>}
          </p>
        </div>
      )}

      {[
        { key: "accountNumber", label: "Account Number", type: "text", placeholder: "Enter account number" },
        { key: "confirmAccountNumber", label: "Confirm Account Number", type: "text", placeholder: "Re-enter account number" },
        { key: "ifscCode", label: "IFSC Code", type: "text", placeholder: "e.g., SBIN0001234" },
        { key: "bankName", label: "Bank Name", type: "text", placeholder: "Bank name" },
        { key: "branchName", label: "Branch Name", type: "text", placeholder: "Branch name" },
      ].map(({ key, label, type, placeholder }) => (
        <div key={key} style={{ marginBottom: 16 }}>
          <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
            {label} <span style={{ color: "var(--wise-danger)" }}>*</span>
          </label>
          <input
            type={type}
            value={form[key]}
            onChange={(e) => update(key, key === "ifscCode" ? e.target.value.toUpperCase() : e.target.value)}
            placeholder={placeholder}
            className="input-field"
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 12,
              background: "var(--input-bg)",
              border: `1.5px solid ${errors[key] ? "var(--wise-danger)" : "var(--border-color)"}`,
              color: "var(--text-primary)", fontSize: "0.95rem", fontWeight: 700, outline: "none",
            }}
          />
          {errors[key] && <p style={{ color: "var(--wise-danger)", fontSize: "0.75rem", marginTop: 4 }}>{errors[key]}</p>}
        </div>
      ))}

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>Account Type</label>
        <select value={form.accountType} onChange={(e) => update("accountType", e.target.value)}
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 12,
            background: "var(--input-bg)", border: "1.5px solid var(--border-color)",
            color: "var(--text-primary)", fontSize: "0.95rem", fontWeight: 700, outline: "none",
          }}>
          <option value="Savings">Savings</option>
          <option value="Current">Current</option>
        </select>
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
