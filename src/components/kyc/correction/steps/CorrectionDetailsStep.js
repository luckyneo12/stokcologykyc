"use client";
import { useState, useEffect, useRef } from "react";
import { useCorrection } from "@/context/CorrectionContext";
import { uploadDocument, resolveAssetUrl } from "@/utils/kycApi";

/**
 * CorrectionDetailsStep — Correction wrapper for Personal Details module.
 *
 * When personalDetails is rejected (module-level):
 *   - DigiLocker/API fields (fullName, dob, email, fatherName, gender) are shown as READ-ONLY
 *   - Dropdowns reset to default values
 *   - User-editable fields are blanked for re-entry
 *
 * When pepProof is rejected (document-level):
 *   - Only the PEP proof upload area is cleared
 *   - All other fields remain read-only
 */
export default function CorrectionDetailsStep({ stepId, rejectedStep }) {
  const {
    applicationData,
    drafts,
    saveDraft,
    nextCorrectionStep,
    prevCorrectionStep,
    currentStepIndex,
    addToast,
  } = useCorrection();

  const existingDetails = applicationData?.personalDetails || {};
  const isModuleRejection = rejectedStep.type === "module";
  const isPepOnly = stepId === "pepProof";

  // Build initial form state based on rejection type
  const buildInitialForm = () => {
    // If we already have a draft saved, use it
    if (drafts[stepId]) return { ...drafts[stepId] };

    if (isPepOnly) {
      // Only PEP proof was rejected — keep everything, blank the proof
      return { ...existingDetails, pepProof: "" };
    }

    if (isModuleRejection) {
      // Module rejection — preserve API data, blank user-editable fields, default dropdowns
      return {
        // Preserved read-only fields (from DigiLocker/API)
        fullName: existingDetails.fullName || "",
        dob: existingDetails.dob || "",
        email: existingDetails.email || "",
        fatherName: existingDetails.fatherName || "",
        gender: existingDetails.gender || "",

        // Dropdowns reset to defaults
        citizenOfIndia: "Yes",
        politicallyExposed: "No",
        taxResidencyOutside: "No",
        taxExempt: "No",
        ddpiOptIn: "Yes",

        // Blanked user-editable fields
        prefix: "",
        motherName: "",
        maritalStatus: "",
        education: "",
        occupation: "",
        annualIncome: "",
        experience: "",
        pepType: "",
        pepProof: "",
        countryOfBirth: "",
        citizenship: "",
        taxResidence1: "",
        taxId1: "",
        taxResidence2: "",
        taxId2: "",
        placeOfBirth: "",
        taxExemptReason: "",
      };
    }

    return { ...existingDetails };
  };

  const [form, setForm] = useState(buildInitialForm);
  const [errors, setErrors] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: "" }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadDocument(file);
      if (result.success) {
        update("pepProof", result.path);
        addToast("PEP proof uploaded successfully");
      }
    } catch (error) {
      addToast(error.message || "Failed to upload document", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (isModuleRejection || !isPepOnly) {
      if (!form.prefix) newErrors.prefix = "Required";
      if (!form.motherName?.trim()) newErrors.motherName = "Required";
      if (!form.maritalStatus) newErrors.maritalStatus = "Required";
      if (!form.education) newErrors.education = "Required";
      if (!form.occupation) newErrors.occupation = "Required";
      if (!form.annualIncome) newErrors.annualIncome = "Required";
    }
    if (isPepOnly) {
      if (form.politicallyExposed === "Yes" && !form.pepProof) {
        newErrors.pepProof = "PEP proof is required";
      }
    }
    if (form.politicallyExposed === "Yes" && isModuleRejection) {
      if (!form.pepProof) newErrors.pepProof = "PEP proof is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      addToast("Please fill all required fields", "error");
      return;
    }
    setSaving(true);
    const success = await saveDraft(stepId, form);
    setSaving(false);
    if (success) {
      nextCorrectionStep();
    }
  };

  // Read-only field renderer
  const ReadOnlyField = ({ label, value }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>{label}</label>
      <div className="input-field" style={{
        padding: "12px 16px", borderRadius: 12, background: "var(--input-bg)",
        border: "1.5px solid var(--border-color)", opacity: 0.6,
        color: "var(--text-primary)", fontSize: "0.95rem", fontWeight: 700,
      }}>
        {value || "—"}
      </div>
    </div>
  );

  // Editable field renderer
  const EditableField = ({ label, value, onChange, placeholder, error, type = "text", required }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
        {label} {required && <span style={{ color: "var(--wise-danger)" }}>*</span>}
      </label>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field"
        style={{
          width: "100%", padding: "12px 16px", borderRadius: 12,
          background: "var(--input-bg)",
          border: `1.5px solid ${error ? "var(--wise-danger)" : "var(--border-color)"}`,
          color: "var(--text-primary)", fontSize: "0.95rem", fontWeight: 700,
          outline: "none",
        }}
      />
      {error && <p style={{ color: "var(--wise-danger)", fontSize: "0.75rem", marginTop: 4 }}>{error}</p>}
    </div>
  );

  // Dropdown renderer
  const SelectField = ({ label, value, onChange, options, placeholder, error, required, disabled }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
        {label} {required && <span style={{ color: "var(--wise-danger)" }}>*</span>}
      </label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: "100%", padding: "12px 16px", borderRadius: 12,
          background: "var(--input-bg)",
          border: `1.5px solid ${error ? "var(--wise-danger)" : "var(--border-color)"}`,
          color: value ? "var(--text-primary)" : "var(--text-muted)",
          fontSize: "0.95rem", fontWeight: 700, outline: "none",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <option value="">{placeholder || "Select..."}</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      {error && <p style={{ color: "var(--wise-danger)", fontSize: "0.75rem", marginTop: 4 }}>{error}</p>}
    </div>
  );

  return (
    <div className="step-card" style={{ maxWidth: 600, margin: "0 auto", padding: "32px 28px" }}>
      {/* Rejection reason banner */}
      <div style={{
        background: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.2)",
        borderRadius: 12, padding: "14px 18px", marginBottom: 24,
      }}>
        <p style={{ color: "#ef4444", fontSize: "0.8rem", fontWeight: 700, margin: 0 }}>
          ⚠️ Reason for rejection: {rejectedStep.reason || "Please correct this section"}
        </p>
      </div>

      <h2 style={{ color: "var(--text-primary)", fontSize: "1.15rem", fontWeight: 800, marginBottom: 4 }}>
        {isPepOnly ? "PEP Proof Correction" : "Personal Details Correction"}
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 28 }}>
        {isPepOnly
          ? "Please upload a new PEP proof document."
          : "Fields from DigiLocker are read-only. Please re-enter your editable details."}
      </p>

      {/* Read-only DigiLocker fields */}
      {!isPepOnly && (
        <>
          <ReadOnlyField label="Full Name (from DigiLocker)" value={form.fullName} />
          <ReadOnlyField label="Date of Birth" value={form.dob} />
          <ReadOnlyField label="Email" value={form.email} />
          <ReadOnlyField label="Father's Name" value={form.fatherName} />
          <ReadOnlyField label="Gender" value={form.gender} />

          <div style={{ height: 1, background: "var(--border-color)", margin: "24px 0" }} />

          {/* Editable fields */}
          <SelectField label="Prefix" value={form.prefix} onChange={(v) => update("prefix", v)}
            options={["Mr.", "Mrs.", "Ms.", "Dr."]} placeholder="Select prefix" error={errors.prefix} required />
          <EditableField label="Mother's Name" value={form.motherName} onChange={(v) => update("motherName", v)}
            placeholder="Enter mother's name" error={errors.motherName} required />
          <SelectField label="Marital Status" value={form.maritalStatus} onChange={(v) => update("maritalStatus", v)}
            options={["Single", "Married", "Divorced", "Widowed"]} error={errors.maritalStatus} required />
          <SelectField label="Education" value={form.education} onChange={(v) => update("education", v)}
            options={["High School", "Graduate", "Post Graduate", "Doctorate", "Professional", "Under Graduate", "Others"]}
            error={errors.education} required />
          <SelectField label="Occupation" value={form.occupation} onChange={(v) => update("occupation", v)}
            options={["Salaried", "Self Employed", "Business", "Professional", "Retired", "Housewife", "Student", "Others"]}
            error={errors.occupation} required />
          <SelectField label="Annual Income" value={form.annualIncome} onChange={(v) => update("annualIncome", v)}
            options={["Below 1 Lac", "1 Lac to 5 Lac", "5 Lac to 10 Lac", "10 Lac to 25 Lac", "More Than 25 Lac"]}
            error={errors.annualIncome} required />
          <SelectField label="Trading Experience" value={form.experience} onChange={(v) => update("experience", v)}
            options={["Less than 1 year", "1-2 years", "2-5 years", "More than 5 years"]} />
          <SelectField label="Are you a Citizen of India?" value={form.citizenOfIndia} onChange={(v) => update("citizenOfIndia", v)}
            options={["Yes", "No"]} />
          <SelectField label="Are you Politically Exposed?" value={form.politicallyExposed} onChange={(v) => update("politicallyExposed", v)}
            options={["Yes", "No"]} />
          <SelectField label="DDPI Opt-In" value={form.ddpiOptIn} onChange={(v) => update("ddpiOptIn", v)}
            options={["Yes", "No"]} />
        </>
      )}

      {/* PEP Proof upload */}
      {(form.politicallyExposed === "Yes" || isPepOnly) && (
        <div style={{ marginTop: isPepOnly ? 0 : 16 }}>
          <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, display: "block" }}>
            PEP Proof Document <span style={{ color: "var(--wise-danger)" }}>*</span>
          </label>
          {form.pepProof ? (
            <div style={{
              padding: 16, borderRadius: 12, background: "rgba(159,232,112,0.06)",
              border: "1px solid rgba(159,232,112,0.2)", display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ color: "var(--wise-green)", fontWeight: 700, fontSize: "0.85rem" }}>✓ Document uploaded</span>
              <button onClick={() => update("pepProof", "")} style={{
                marginLeft: "auto", background: "none", border: "none", color: "#ef4444",
                fontSize: "0.8rem", fontWeight: 700, cursor: "pointer",
              }}>Re-upload</button>
            </div>
          ) : (
            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              padding: 24, borderRadius: 12, border: "2px dashed var(--border-color)",
              cursor: isUploading ? "wait" : "pointer", background: "var(--input-bg)",
            }}>
              <input type="file" accept="image/*,.pdf" onChange={handleFileChange} style={{ display: "none" }} />
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)" }}>
                {isUploading ? "Uploading..." : "Click to upload PEP proof"}
              </span>
            </label>
          )}
          {errors.pepProof && <p style={{ color: "var(--wise-danger)", fontSize: "0.75rem", marginTop: 4 }}>{errors.pepProof}</p>}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
        {currentStepIndex > 0 && (
          <button onClick={prevCorrectionStep} style={{
            flex: 1, padding: "14px", borderRadius: 14,
            background: "var(--bg-elevated)", border: "1.5px solid var(--border-color)",
            color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
          }}>
            Back
          </button>
        )}
        <button onClick={handleSave} disabled={saving} style={{
          flex: 2, padding: "14px", borderRadius: 14,
          background: "var(--wise-green)", border: "none",
          color: "#1a1a2e", fontSize: "0.95rem", fontWeight: 800, cursor: saving ? "wait" : "pointer",
          opacity: saving ? 0.7 : 1,
        }}>
          {saving ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </div>
  );
}
