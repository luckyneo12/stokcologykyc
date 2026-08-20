"use client";
import { useState, useEffect } from "react";
import { useKYC } from "@/context/KYCContext";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { verifyPanDirect } from "@/utils/digio";
import Logo from "../Logo";
import DateInput from "../DateInput";

const formatPanValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.toUpperCase().match(/[A-Z]{5}[0-9]{4}[A-Z]/);
    return match ? match[0] : value.toUpperCase();
  }
  if (typeof value !== "object") return String(value).toUpperCase();

  const preferredKeys = ["pan", "pan_no", "pan_number", "panNo", "id_no", "id_number", "number", "document_number"];
  for (const key of preferredKeys) {
    const formatted = formatPanValue(value[key]);
    if (formatted && formatted !== "[OBJECT OBJECT]") return formatted;
  }

  for (const nested of Object.values(value)) {
    const formatted = formatPanValue(nested);
    if (formatted && formatted !== "[OBJECT OBJECT]") return formatted;
  }

  return "";
};

export default function PanStep() {
  const { personalDetails, identityDetails, panVerified, updateNested, updateState, nextStep, prevStep, addToast, setApplicationId, markStepVerified } = useKYC();
  const [pan, setPan, clearPanDraft] = useLocalDraft("pan", formatPanValue(identityDetails.pan));
  const [fullName, setFullName, clearFullNameDraft] = useLocalDraft("panFullName", personalDetails.fullName || "");
  const [dob, setDob, clearDobDraft] = useLocalDraft("panDob", personalDetails.dob || "");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [digioLoading, setDigioLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isAlreadyVerified = panVerified && pan === identityDetails?.pan && fullName === personalDetails?.fullName && dob === personalDetails?.dob;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const normalizedPan = formatPanValue(identityDetails.pan);
    if (normalizedPan && normalizedPan !== pan) {
      setPan(normalizedPan);
    }
  }, [identityDetails.pan]);

  const handleVerify = async () => {
    // Validation
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(pan.toUpperCase())) {
      addToast("Please enter a valid PAN number", "error");
      setFieldErrors({ pan: true });
      return;
    }
    if (!fullName || fullName.length < 3) {
      addToast("Please enter your full name as per PAN", "error");
      setFieldErrors({ fullName: true });
      return;
    }
    if (!dob) {
      addToast("Please enter your Date of Birth", "error");
      setFieldErrors({ dob: true });
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const result = await verifyPanDirect(pan.toUpperCase(), fullName.toUpperCase(), dob);
      
      if (result.success) {
        if (result.applicationId) setApplicationId(result.applicationId);
        
        const extractedFatherName = result.data?.father_name || result.data?.parent_name || result.data?.fathers_name || result.data?.fatherName || result.data?.relative_name || "";
        
        addToast("PAN verified successfully!", "success");
        // Record verification fingerprint so this step auto-skips on re-navigation
        markStepVerified(4, `${pan.toUpperCase()}|${fullName.toUpperCase()}|${dob}`);
        
        clearPanDraft();
        clearFullNameDraft();
        clearDobDraft();
        
        nextStep({
          identityDetails: { ...identityDetails, pan: pan.toUpperCase(), manualPan: pan.toUpperCase() },
          personalDetails: { 
            ...personalDetails, 
            dob, 
            fullName: fullName.toUpperCase(), 
            ...(extractedFatherName ? { fatherName: extractedFatherName } : {}) 
          },
          panVerified: true
        });
      } else {
        const msg = result.message || "PAN verification failed";
        addToast(msg, "error");
        setLoading(false);
        const newErrors = {};
        const lowerMsg = msg.toLowerCase();
        if (lowerMsg.includes("dob") || lowerMsg.includes("date of birth") || lowerMsg.includes("year")) {
          newErrors.dob = true;
        }
        if (lowerMsg.includes("name")) {
          newErrors.fullName = true;
        }
        if (lowerMsg.includes("invalid pan") || Object.keys(newErrors).length === 0) {
          newErrors.pan = true;
        }
        setFieldErrors(newErrors);
      }
    } catch (err) {
      const msg = err?.message || "PAN verification service is unavailable";
      setLoading(false);
      addToast(msg, "error");
      const newErrors = {};
      const lowerMsg = msg.toLowerCase();
      if (lowerMsg.includes("dob") || lowerMsg.includes("date of birth") || lowerMsg.includes("year")) {
        newErrors.dob = true;
      }
      if (lowerMsg.includes("name")) {
        newErrors.fullName = true;
      }
      if (lowerMsg.includes("invalid pan") || Object.keys(newErrors).length === 0) {
        newErrors.pan = true;
      }
      setFieldErrors(newErrors);
    }
  };

  if (!mounted) return null;

  return (
    <div className="container-sm" style={{ paddingTop: "2vh", paddingBottom: "4vh", maxWidth: "480px" }}>
      <div className="text-center animate-slide-up" style={{ marginBottom: 32 }}>
        <h1 style={{ 
          fontSize: "clamp(2.2rem, 9vw, 3.2rem)", fontWeight: 900, letterSpacing: "-1px", 
          background: "linear-gradient(135deg, #054d28 0%, #163300 40%, #9fe870 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          textShadow: "0 10px 30px rgba(159, 232, 112, 0.15)",
          whiteSpace: "nowrap"
        }}>PAN Verification</h1>
        <p style={{ fontSize: "clamp(0.85rem, 3vw, 1rem)", color: "var(--text-secondary)", marginTop: "12px", fontWeight: 600 }}>Enter your details exactly as they appear on your PAN card.</p>
      </div>

      <div className="card animate-slide-up" style={{ 
        padding: "32px", 
        borderRadius: "32px", 
        border: "1px solid var(--border-color)", 
        background: "var(--bg-card)",
        boxShadow: "none"
      }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 700, marginBottom: "8px", display: "block" }}>
            PAN Number <span style={{ color: "var(--wise-danger)" }}>*</span>
          </label>
          <input 
            type="text" 
            className="input-field" 
            placeholder="ABCDE1234F" 
            style={{ 
              height: "56px", 
              borderRadius: "16px", 
              border: `1.5px solid ${fieldErrors.pan ? "var(--wise-danger)" : "var(--border-color)"}`,
              fontSize: "1.1rem", 
              fontWeight: 700, 
              textTransform: "uppercase",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
              padding: "0 20px",
              outline: "none"
            }}
            value={pan} 
            onChange={e => { setPan(e.target.value); setFieldErrors(prev => ({...prev, pan: false})); }}
            maxLength={10}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 700, marginBottom: "8px", display: "block" }}>
            Full Name (As per PAN) <span style={{ color: "var(--wise-danger)" }}>*</span>
          </label>
          <input 
            type="text" 
            className="input-field" 
            placeholder="FULL NAME" 
            style={{ 
              height: "56px", 
              borderRadius: "16px", 
              border: `1.5px solid ${fieldErrors.fullName ? "var(--wise-danger)" : "var(--border-color)"}`,
              fontSize: "1.1rem", 
              fontWeight: 700,
              textTransform: "uppercase",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
              padding: "0 20px",
              outline: "none"
            }}
            value={fullName} 
            onChange={e => { setFullName(e.target.value); setFieldErrors(prev => ({...prev, fullName: false})); }}
          />
        </div>

        <div style={{ marginBottom: 32 }}>
          <label style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 700, marginBottom: "8px", display: "block" }}>
            Date of Birth <span style={{ color: "var(--wise-danger)" }}>*</span>
          </label>
          <DateInput 
            className="input-field" 
            style={{ 
              height: "56px", 
              borderRadius: "16px", 
              border: `1.5px solid ${fieldErrors.dob ? "var(--wise-danger)" : "var(--border-color)"}`,
              fontSize: "1.1rem", 
              fontWeight: 700,
              background: "var(--input-bg)",
              color: "var(--text-primary)",
              padding: "0 20px",
              outline: "none"
            }}
            value={dob} 
            onChange={e => { setDob(e.target.value); setFieldErrors(prev => ({...prev, dob: false})); }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button 
            type="button" 
            className="btn btn-primary" 
            disabled={loading || digioLoading} 
            onClick={isAlreadyVerified ? () => nextStep() : handleVerify}
            style={{ height: "60px", borderRadius: "16px", fontSize: "1.1rem", fontWeight: 800 }}
          >
            {digioLoading ? "Connecting..." : loading ? "Verifying..." : isAlreadyVerified ? "Verified - Continue" : "Verify & Continue"}
          </button>
          
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={prevStep} 
            style={{ height: "56px", borderRadius: "16px", fontWeight: 700, background: "var(--bg-card)", border: "1.5px solid var(--border-color)", color: "var(--text-primary)" }}
          >
            Back
          </button>
        </div>
        
        <p className="text-caption text-center" style={{ marginTop: 24, fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>
          By continuing, you authorize us to verify your PAN details with official records.
        </p>
      </div>
    </div>
  );
}
