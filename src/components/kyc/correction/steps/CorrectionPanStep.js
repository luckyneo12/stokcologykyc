"use client";
import { useState, useEffect } from "react";
import { useCorrection } from "@/context/CorrectionContext";
import { verifyPanDirect } from "@/utils/digio";
import DateInput from "@/components/kyc/DateInput";

/**
 * CorrectionPanStep — PAN re-verification correction wrapper.
 * Exact same verification flow as the normal PAN step:
 * verifies PAN number, Name as per PAN, and Date of Birth with Digio / NSDL.
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

  const existingPan = applicationData?.identityDetails?.manualPan || applicationData?.identityDetails?.pan || applicationData?.personalDetails?.pan || "";
  const existingName = applicationData?.personalDetails?.manualFullName || applicationData?.personalDetails?.fullName || applicationData?.identityDetails?.pan_name || applicationData?.identityDetails?.name || "";
  const existingDob = applicationData?.personalDetails?.manualDob || applicationData?.personalDetails?.dob || applicationData?.identityDetails?.dob || "";
  
  // Field-level rejection data from Admin Maker-Checker
  const rejectedFields = rejectedStep?.rejectedFields || [];
  const rejectEntireModule = rejectedStep?.rejectEntireModule === true;
  const hasFieldLevelRejection = rejectedFields.length > 0 && !rejectEntireModule;

  const ADMIN_LABEL_TO_FORM_KEY = {
    "PAN number": "panNumber",
    "Name as per PAN": "panName",
    "Date of birth": "dob",
  };

  const rejectedFormKeys = new Set(
    rejectedFields.map(label => ADMIN_LABEL_TO_FORM_KEY[label]).filter(Boolean)
  );

  const isFieldRejected = (formKey) => {
    if (rejectEntireModule) return true;
    if (!hasFieldLevelRejection) return true;
    return rejectedFormKeys.has(formKey);
  };

  const draft = drafts[stepId] || {};
  const [panNumber, setPanNumber] = useState(
    draft.pan || draft.manualPan || (isFieldRejected("panNumber") ? "" : existingPan)
  );
  const [panName, setPanName] = useState(
    draft.fullName || draft.panName || (isFieldRejected("panName") ? "" : existingName)
  );
  const [dob, setDob] = useState(
    draft.dob || draft.manualDob || (isFieldRejected("dob") ? "" : existingDob)
  );

  const [errors, setErrors] = useState({});
  const [verifying, setVerifying] = useState(false);

  // Keep sessionStorage in sync with applicationId so Digio requests find the draft
  useEffect(() => {
    if (applicationData?.applicationId && typeof window !== "undefined") {
      sessionStorage.setItem("kycApplicationId", applicationData.applicationId);
      localStorage.setItem("kycApplicationId", applicationData.applicationId);
    }
  }, [applicationData?.applicationId]);

  const validate = () => {
    const newErrors = {};
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    
    if (!panNumber.trim()) {
      newErrors.panNumber = "PAN number is required";
    } else if (!panRegex.test(panNumber.toUpperCase())) {
      newErrors.panNumber = "Invalid PAN format (e.g., ABCDE1234F)";
    }

    if (!panName.trim()) {
      newErrors.panName = "Name as per PAN is required";
    } else if (panName.trim().length < 3) {
      newErrors.panName = "Full Name must be at least 3 characters";
    }

    if (!dob) {
      newErrors.dob = "Date of Birth is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleVerify = async () => {
    if (!validate()) {
      addToast("Please fill in all required PAN fields properly", "error");
      return;
    }

    setVerifying(true);
    setErrors({});

    try {
      const result = await verifyPanDirect(
        panNumber.toUpperCase(),
        panName.trim().toUpperCase(),
        dob,
        applicationData?.applicationId
      );

      if (result.success) {
        const extractedFatherName = 
          result.data?.father_name || 
          result.data?.parent_name || 
          result.data?.fathers_name || 
          result.data?.fatherName || 
          result.data?.relative_name || 
          "";
        const verifiedName = result.data?.name_at_pan || panName.trim().toUpperCase();

        addToast("PAN verified successfully!", "success");

        const success = await saveDraft(stepId, {
          pan: panNumber.toUpperCase(),
          manualPan: panNumber.toUpperCase(),
          panName: verifiedName,
          fullName: verifiedName,
          dob,
          manualDob: dob,
          verified: true,
          fatherName: extractedFatherName || undefined,
          verificationData: result.data || undefined,
        });

        if (success) {
          nextCorrectionStep();
        }
      } else {
        const msg = result.message || result.error || "PAN verification failed";
        addToast(msg, "error");

        const newErrors = {};
        const lowerMsg = msg.toLowerCase();
        if (lowerMsg.includes("dob") || lowerMsg.includes("date of birth") || lowerMsg.includes("year")) {
          newErrors.dob = "Date of Birth does not match PAN records";
        }
        if (lowerMsg.includes("name")) {
          newErrors.panName = "Name does not match PAN records";
        }
        if (lowerMsg.includes("invalid pan") || Object.keys(newErrors).length === 0) {
          newErrors.panNumber = "Invalid PAN number";
        }
        setErrors(newErrors);
      }
    } catch (err) {
      const msg = err?.message || "PAN verification service is unavailable";
      addToast(msg, "error");

      const newErrors = {};
      const lowerMsg = msg.toLowerCase();
      if (lowerMsg.includes("dob") || lowerMsg.includes("date of birth") || lowerMsg.includes("year")) {
        newErrors.dob = "Date of Birth does not match PAN records";
      } else if (lowerMsg.includes("name")) {
        newErrors.panName = "Name does not match PAN records";
      } else {
        newErrors.panNumber = msg;
      }
      setErrors(newErrors);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="step-card" style={{ maxWidth: 560, margin: "0 auto", padding: "32px 28px" }}>
      {/* Rejection Banner */}
      <div style={{
        background: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.2)",
        borderRadius: 12, padding: "14px 18px", marginBottom: 24,
      }}>
        <p style={{ color: "#ef4444", fontSize: "0.8rem", fontWeight: 700, margin: 0 }}>
          ⚠️ Reason: {rejectedStep?.reason || "PAN verification needs correction"}
        </p>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 700, margin: "4px 0 0" }}>
          {rejectEntireModule ? "Please re-fill all fields in this module." : 
           rejectedFields.length > 0 ? `Fields to correct: ${rejectedFields.join(', ')}` :
           "Please fill in your correct details and proceed."}
        </p>
      </div>

      <h2 style={{ color: "var(--text-primary)", fontSize: "1.15rem", fontWeight: 800, marginBottom: 8 }}>
        PAN Verification Correction
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 24 }}>
        Enter your details exactly as they appear on your PAN card for verification.
      </p>

      {/* Previous Values Strikethrough Banners */}
      {existingPan && isFieldRejected("panNumber") && (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", margin: 0 }}>
            Previous PAN: <span style={{ textDecoration: "line-through", color: "#ef4444", fontWeight: 700 }}>{existingPan}</span>
          </p>
        </div>
      )}

      {existingName && isFieldRejected("panName") && (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", margin: 0 }}>
            Previous Name: <span style={{ textDecoration: "line-through", color: "#ef4444", fontWeight: 700 }}>{existingName}</span>
          </p>
        </div>
      )}

      {existingDob && isFieldRejected("dob") && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", margin: 0 }}>
            Previous Date of Birth: <span style={{ textDecoration: "line-through", color: "#ef4444", fontWeight: 700 }}>{existingDob}</span>
          </p>
        </div>
      )}

      {/* PAN Number */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
          PAN Number {isFieldRejected("panNumber") && <span style={{ color: "var(--wise-danger)" }}>*</span>}
        </label>
        <input
          type="text"
          value={panNumber}
          onChange={(e) => { 
            setPanNumber(e.target.value.toUpperCase()); 
            if (errors.panNumber) setErrors(prev => ({ ...prev, panNumber: "" })); 
          }}
          placeholder="ABCDE1234F"
          maxLength={10}
          disabled={!isFieldRejected("panNumber") || verifying}
          className="input-field"
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 12,
            background: isFieldRejected("panNumber") ? "var(--input-bg)" : "var(--bg-secondary)", 
            border: `1.5px solid ${errors.panNumber ? "var(--wise-danger)" : isFieldRejected("panNumber") && hasFieldLevelRejection ? "#ef4444" : "var(--border-color)"}`,
            color: isFieldRejected("panNumber") ? "var(--text-primary)" : "var(--text-muted)", fontSize: "1rem", fontWeight: 700,
            letterSpacing: 2, textTransform: "uppercase", outline: "none",
            opacity: isFieldRejected("panNumber") ? 1 : 0.7,
            cursor: isFieldRejected("panNumber") ? "text" : "not-allowed"
          }}
        />
        {errors.panNumber && <p style={{ color: "var(--wise-danger)", fontSize: "0.75rem", marginTop: 4 }}>{errors.panNumber}</p>}
      </div>

      {/* Name as per PAN */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
          Full Name (As per PAN) {isFieldRejected("panName") && <span style={{ color: "var(--wise-danger)" }}>*</span>}
        </label>
        <input
          type="text"
          value={panName}
          onChange={(e) => { 
            setPanName(e.target.value.toUpperCase()); 
            if (errors.panName) setErrors(prev => ({ ...prev, panName: "" })); 
          }}
          placeholder="FULL NAME AS PER PAN"
          disabled={!isFieldRejected("panName") || verifying}
          className="input-field"
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 12,
            background: isFieldRejected("panName") ? "var(--input-bg)" : "var(--bg-secondary)", 
            border: `1.5px solid ${errors.panName ? "var(--wise-danger)" : isFieldRejected("panName") && hasFieldLevelRejection ? "#ef4444" : "var(--border-color)"}`,
            color: isFieldRejected("panName") ? "var(--text-primary)" : "var(--text-muted)", fontSize: "0.95rem", fontWeight: 700, outline: "none",
            textTransform: "uppercase",
            opacity: isFieldRejected("panName") ? 1 : 0.7,
            cursor: isFieldRejected("panName") ? "text" : "not-allowed"
          }}
        />
        {errors.panName && <p style={{ color: "var(--wise-danger)", fontSize: "0.75rem", marginTop: 4 }}>{errors.panName}</p>}
      </div>

      {/* Date of Birth */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
          Date of Birth {isFieldRejected("dob") && <span style={{ color: "var(--wise-danger)" }}>*</span>}
        </label>
        <DateInput
          value={dob}
          onChange={(e) => {
            setDob(e.target.value);
            if (errors.dob) setErrors(prev => ({ ...prev, dob: "" }));
          }}
          disabled={!isFieldRejected("dob") || verifying}
          className="input-field"
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 12,
            background: isFieldRejected("dob") ? "var(--input-bg)" : "var(--bg-secondary)",
            border: `1.5px solid ${errors.dob ? "var(--wise-danger)" : isFieldRejected("dob") && hasFieldLevelRejection ? "#ef4444" : "var(--border-color)"}`,
            color: isFieldRejected("dob") ? "var(--text-primary)" : "var(--text-muted)", fontSize: "0.95rem", fontWeight: 700, outline: "none",
            opacity: isFieldRejected("dob") ? 1 : 0.7,
            cursor: isFieldRejected("dob") ? "text" : "not-allowed"
          }}
        />
        {errors.dob && <p style={{ color: "var(--wise-danger)", fontSize: "0.75rem", marginTop: 4 }}>{errors.dob}</p>}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
        {currentStepIndex > 0 && (
          <button 
            type="button"
            onClick={prevCorrectionStep} 
            disabled={verifying}
            style={{
              flex: 1, padding: "14px", borderRadius: 14,
              background: "var(--bg-elevated)", border: "1.5px solid var(--border-color)",
              color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 700, cursor: verifying ? "not-allowed" : "pointer",
            }}
          >
            Back
          </button>
        )}
        <button 
          type="button"
          onClick={handleVerify} 
          disabled={verifying} 
          style={{
            flex: 2, padding: "14px", borderRadius: 14,
            background: "var(--wise-green)", border: "none",
            color: "#1a1a2e", fontSize: "0.95rem", fontWeight: 800,
            cursor: verifying ? "wait" : "pointer", opacity: verifying ? 0.7 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8
          }}
        >
          {verifying ? "Verifying PAN with NSDL..." : "Verify & Continue"}
        </button>
      </div>
    </div>
  );
}
