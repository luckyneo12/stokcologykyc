"use client";
import { useState, useEffect, useRef } from "react";
import { useKYC } from "@/context/KYCContext";
import { SmartphoneIcon, ArrowRightIcon, ArrowLeftIcon, CheckCircleIcon, EditIcon } from "../Icons";
import Logo from "../Logo";
import { sendOtp, verifyOtp, startKycApplication, getStorage } from "@/utils/kycApi";

const CheckIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--bg-primary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function PhoneStep() {
  const { phone, personalDetails = {}, updateState, nextStep, prevStep, goToStep, refreshProgress, addToast, setApplicationId, resetKYC } = useKYC();
  const [phoneNumber, setPhoneNumber] = useState(phone || "");
  // Defaults to "--Select--" (nothing chosen). "Child Dependent 2" / "Parent Dependent 2" are no longer offered — a saved one must be re-selected
  const [phoneDependency, setPhoneDependency] = useState(
    ["Child Dependent 2", "Parent Dependent 2"].includes(personalDetails.phoneDependency) ? "" : (personalDetails.phoneDependency || "")
  );
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isOtpMode, setIsOtpMode] = useState(false);
  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [showEditTip, setShowEditTip] = useState(false);
  const phoneErrorTimer = useRef(null);
  useEffect(() => () => clearTimeout(phoneErrorTimer.current), []);

  const [showPreAgreement, setShowPreAgreement] = useState(() => {
    if (typeof window !== "undefined") {
      return !sessionStorage.getItem("kyc-pre-agreement-accepted");
    }
    return true;
  });

  const handleAcceptPreAgreement = () => {
    setShowPreAgreement(false);
    sessionStorage.setItem("kyc-pre-agreement-accepted", "true");
  };

  // Ensure component is mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let interval;
    if (isOtpMode && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isOtpMode, timer]);

  const handleSendOtp = async () => {
    if (phoneNumber.length !== 10) {
      addToast("Enter 10 digits", "error");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
      addToast("Mobile number must start with 6, 7, 8 or 9", "error");
      return;
    }
    if (!phoneDependency) {
      addToast("Please select dependency", "error");
      return;
    }
    if (!acceptedTerms) {
      addToast("Please accept Terms & Conditions", "error");
      return;
    }
    try {
      setLoading(true);
      const apCode = sessionStorage.getItem('apCode') || undefined;
      await sendOtp(phoneNumber, apCode);
      setOtp(["", "", "", "", "", ""]); // new OTP sent (incl. resend) — clear the old digits
      setOtpError("");
      setIsOtpMode(true);
      setTimer(60);
      setTimeout(() => document.getElementById("otp-0")?.focus(), 0);
      addToast("OTP sent!", "success");
    } catch (error) {
      console.error("[PhoneStep] Send OTP error:", error);
      if (error.code === "ALREADY_EXISTS" || error.message?.includes("already exists")) {
        addToast("A verified account already exists for this mobile number.", "error");
      } else {
        addToast(error.message || "Failed to send OTP. Please try again.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (e) => {
    if (isOtpMode) return;
    const val = e.target.value;
    // Check if user typed a non-digit
    if (val !== "" && /\D/.test(val)) {
      addToast("Enter digit only", "error");
    }
    const numericVal = val.replace(/\D/g, "");

    // Real-time rules: must start with 6/7/8/9 and can't go beyond 10 digits — invalid input is not accepted.
    // The input is rejected (field keeps its valid value), so the alert is temporary and clears itself.
    if (numericVal && !/^[6-9]/.test(numericVal)) {
      showPhoneError("Mobile number must start with 6, 7, 8 or 9");
      return;
    }
    if (numericVal.length > 10) {
      showPhoneError("Mobile number cannot be more than 10 digits");
      return;
    }
    setPhoneNumber(numericVal);
    clearTimeout(phoneErrorTimer.current);
    setPhoneError("");
  };

  const showPhoneError = (msg) => {
    setPhoneError(msg);
    clearTimeout(phoneErrorTimer.current);
    phoneErrorTimer.current = setTimeout(() => setPhoneError(""), 3000);
  };

  const handlePhoneBlur = () => {
    clearTimeout(phoneErrorTimer.current);
    setPhoneError("");
    if (phoneNumber.length > 0 && phoneNumber.length < 10) {
      addToast("Enter 10 digits", "error");
    }
  };

  const handleOtpChange = (index, value) => {
    if (verifying) return;
    const val = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);
    if (otpError) setOtpError("");

    if (val && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`);
      if (next) next.focus();
    }

    // Auto-verify as soon as all 6 digits are entered
    const code = newOtp.join("");
    if (code.length === 6) handleVerifyOtp(code);
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        // Current box is empty, move focus back and clear that digit
        const prev = document.getElementById(`otp-${index - 1}`);
        if (prev) {
          prev.focus();
          const newOtp = [...otp];
          newOtp[index - 1] = "";
          setOtp(newOtp);
        }
      }
    } else if (e.key === "Enter") {
      if (otp.join("").length === 6 && !verifying) {
        handleVerifyOtp();
      }
    }
  };

  const handleVerifyOtp = async (code) => {
    const otpValue = typeof code === "string" ? code : otp.join("");
    if (otpValue.length < 6) {
      addToast("Enter 6-digit OTP", "error");
      return;
    }
    if (verifying) return;
    let failed = false;
    try {
      setLoading(true);
      setVerifying(true);
      setOtpError("");
      const apCode = sessionStorage.getItem('apCode') || undefined;
      
      const authResult = await verifyOtp(phoneNumber, otpValue, apCode);
      getStorage().setItem("kycToken", authResult.token);
      getStorage().setItem("kycUser", JSON.stringify(authResult.user));

      const startResult = await startKycApplication();
      getStorage().setItem("kycApplicationId", startResult.applicationId);

      // Fetch the full application state to decide where to go
      let fullApp = null;
      try {
        fullApp = await refreshProgress(startResult.applicationId, authResult.token, false);
      } catch (e) {
        console.warn("[PhoneStep] Progress refresh failed:", e.message);
      }
      
      const serverStep = fullApp?.currentStep || startResult.currentStep || 1;
      console.log(`[PhoneStep] Server says step is: ${serverStep}`);

      addToast(startResult.isNew ? "Mobile number verified" : "Welcome back! Resuming your application.", "success");
      
      if (startResult.isNew) {
        // Aggressively clear all kyc-drafts to prevent stale data from a previously deleted application
        if (typeof window !== "undefined") {
          localStorage.removeItem("kyc-progress");
          sessionStorage.removeItem("kyc-progress");
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("kyc-draft-")) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));
        }
      }

      const updates = { 
        applicationId: startResult.applicationId, 
        phone: phoneNumber, 
        otpVerified: true,
        personalDetails: { ...personalDetails, phoneDependency: phoneDependency }
      };

      if (serverStep > 1) {
        await goToStep(serverStep, updates);
      } else {
        await nextStep(updates);
      }
    } catch (error) {
      console.error("[PhoneStep] OTP Verification Error:", error);
      failed = true;
      if (error.code === "ALREADY_EXISTS" || error.message?.includes("already exists")) {
        addToast("A verified account already exists for this mobile number.", "error");
        setOtpError("A verified account already exists for this mobile number.");
      } else {
        addToast(error?.message || "OTP verification failed", "error");
        setOtpError(error?.message || "Invalid OTP. Please try again.");
      }
      // Wrong OTP — clear the boxes so a fresh code can be typed
      setOtp(["", "", "", "", "", ""]);
    } finally {
      setLoading(false);
      setVerifying(false);
      if (failed) setTimeout(() => document.getElementById("otp-0")?.focus(), 50);
    }
  };

  // "9155061725" -> "XXXXXX1725"
  const maskedPhone = phoneNumber.length > 4 ? "X".repeat(phoneNumber.length - 4) + phoneNumber.slice(-4) : phoneNumber;

  // Prevent rendering until mounted to solve hydration issues
  if (!mounted) return null;

  return (
    <div className="container-sm">
      <div className="text-center animate-slide-up" style={{ marginBottom: 40 }}>
        <h2 className="text-section" style={{ marginBottom: 16 }}>Verification</h2>
        <p className="text-body" style={{ fontWeight: 600 }}>Secure your KYC journey with mobile verification.</p>
      </div>

      <div className="card animate-slide-up">
        
        {/* Phone Input Section */}
        <div style={{ marginBottom: isOtpMode ? 20 : 28, transition: "all 0.3s ease" }}>
          <label className="text-body-bold" style={{ display: "block", marginBottom: 8, fontSize: "0.9rem", opacity: isOtpMode ? 0.6 : 1, transition: "all 0.3s ease" }}>Mobile Number</label>
          <div className="input-field" style={{ position: "relative", display: "flex", alignItems: "baseline", paddingLeft: "16px", paddingRight: isOtpMode ? "60px" : "24px", cursor: isOtpMode ? "default" : "text", borderColor: phoneError ? "var(--wise-danger)" : "var(--border-color)" }}>
            <span style={{ fontWeight: 700, color: "var(--text-muted)", fontSize: "1.1rem", marginRight: "8px", pointerEvents: "none", opacity: isOtpMode ? 0.6 : 1 }}>+91</span>
            <input
              type="tel" inputMode="numeric" placeholder="00000 00000"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontWeight: 700, fontSize: "1.1rem", color: "var(--text-primary)", padding: 0, height: "100%", opacity: isOtpMode ? 0.6 : 1 }}
              value={phoneNumber} onChange={handlePhoneChange} onBlur={handlePhoneBlur}
              onKeyDown={(e) => e.key === "Enter" && phoneNumber.length === 10 && !isOtpMode && handleSendOtp()}
              readOnly={isOtpMode}
            />
            {isOtpMode && (
              <button
                onClick={() => { setShowEditTip(false); setIsOtpMode(false); }}
                onMouseEnter={() => setShowEditTip(true)}
                onMouseLeave={() => setShowEditTip(false)}
                aria-label="Edit mobile number"
                style={{
                  position: "absolute", right: 15, top: "50%", transform: "translateY(-50%)",
                  background: "var(--wise-green)", border: "none", borderRadius: "10px",
                  padding: "8px", cursor: "pointer", color: "var(--wise-dark-green)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s ease"
                }}
                className="hover-scale"
              >
                <EditIcon size={18} />
                {showEditTip && (
                  <span style={{
                    position: "absolute", bottom: "calc(100% + 8px)", right: 0,
                    background: "var(--text-primary)", color: "var(--bg-primary)",
                    fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap",
                    padding: "6px 10px", borderRadius: "8px", pointerEvents: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 10
                  }}>
                    Edit mobile number
                  </span>
                )}
              </button>
            )}
          </div>
          {phoneError && (
            <p style={{ fontSize: "0.7rem", color: "var(--wise-danger)", marginTop: "4px", fontWeight: 700 }}>{phoneError}</p>
          )}
        </div>

        {/* Phone Dependency Section */}
        <div style={{ marginBottom: isOtpMode ? 20 : 28, opacity: isOtpMode ? 0.6 : 1, transition: "all 0.3s ease" }}>
          <label className="text-body-bold" style={{ display: "block", marginBottom: 8, fontSize: "0.9rem" }}>Select Dependency <span style={{ color: "var(--wise-danger)" }}>*</span></label>
          <select 
            className="input-field" 
            value={phoneDependency} 
            onChange={e => setPhoneDependency(e.target.value)}
            disabled={isOtpMode}
            style={{ 
              fontWeight: 700, 
              color: phoneDependency ? "var(--text-primary)" : "var(--text-muted)",
              cursor: isOtpMode ? "not-allowed" : "pointer" 
            }}
          >
            <option value="" disabled>--Select--</option>
            <option value="Self">Self</option>
            <option value="Spouse">Spouse</option>
            <option value="Child Dependent">Child Dependent</option>
            <option value="Parents Dependent">Parents Dependent</option>
          </select>
        </div>

        {/* Terms and Conditions */}
        <div style={{ display: isOtpMode ? "none" : "flex", marginBottom: 28, alignItems: "flex-start", gap: 12, position: "relative" }}>
          <div 
            style={{
              marginTop: 2, minWidth: 20, width: 20, height: 20, borderRadius: 4, cursor: "pointer",
              border: "1px solid var(--border-color)", background: acceptedTerms ? "var(--text-primary)" : "var(--input-bg)",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s"
            }}
            onClick={() => setAcceptedTerms(!acceptedTerms)}
          >
            {acceptedTerms && <CheckIcon size={14} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.95rem", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0, position: "relative" }}>
              I've read and accept the 
              <span 
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                <span style={{ cursor: "pointer", color: "var(--text-primary)", fontWeight: 600 }}> Terms & Conditions</span>
                
                {showTooltip && (
                  <div 
                    style={{ 
                      position: "absolute", bottom: "100%", left: 0, right: 0, paddingBottom: 8, zIndex: 10,
                      cursor: "auto"
                    }}
                  >
                    <div style={{
                      background: "var(--bg-elevated)", border: "1px solid var(--border-color)",
                      borderRadius: "12px", padding: 20, boxShadow: "var(--ring-shadow)",
                      animation: "slideUp 0.2s ease"
                    }}>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 10, lineHeight: 1.5 }}>
                        <li>I voluntarily provide my mobile number for communication related to my Trading Account and Demat Account.</li>
                        <li>I give my explicit consent to receive transactional, regulatory, service-related, and promotional communications through call, SMS, WhatsApp, or other electronic modes on this number.</li>
                        <li>I understand that my Trading Account will be opened and maintained with Stockology Securities Private Limited.</li>
                        <li>I further understand that my Demat Account will be opened and maintained with Globe Capital Market Limited, in accordance with applicable SEBI and Depository regulations.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </span>
              <button 
                onClick={() => setShowPdfModal(true)}
                style={{ 
                  background: "none", border: "none", color: "var(--text-primary)", 
                  fontWeight: 700, textDecoration: "underline", cursor: "pointer", marginLeft: 6, fontSize: "0.95rem"
                }}
              >
                more
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: isOtpMode ? "none" : "flex" }}>
          <button className="btn btn-primary" onClick={handleSendOtp} disabled={loading} style={{ width: "100%" }}>
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </div>

        {/* OTP Section - Always in DOM, controlled by display */}
        <div style={{ 
          display: isOtpMode ? "block" : "none", 
          borderTop: "1px solid var(--border-color)", 
          marginTop: 24, 
          paddingTop: 28,
          animation: "slideUp 0.5s ease forwards"
        }}>
          <div className="text-center" style={{ marginBottom: 24 }}>
            <div style={{ 
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, 
              color: "var(--wise-positive)", fontWeight: 800, fontSize: "0.85rem", 
              marginBottom: 12, flexWrap: "wrap", lineHeight: 1.3
            }}>
              <CheckCircleIcon size={18} /> 
              <span>OTP SENT TO +91 {maskedPhone}</span>
            </div>
          </div>

          <div className="flex justify-center" style={{ marginBottom: (verifying || otpError) ? 12 : 32, gap: "6px" }}>
            {otp.map((digit, i) => (
              <input
                key={`otp-input-${i}`}
                id={`otp-${i}`}
                type="tel"
                className="otp-input"
                style={{
                  borderColor: otpError ? "var(--wise-danger)" : digit ? "var(--wise-green)" : "rgba(0,0,0,0.1)",
                  background: digit ? "#fff" : "var(--bg-card)",
                  opacity: verifying ? 0.6 : 1,
                  cursor: verifying ? "not-allowed" : "text"
                }}
                value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                maxLength={1}
                readOnly={verifying}
                disabled={verifying}
                autoFocus={isOtpMode && i === 0}
              />
            ))}
          </div>

          {verifying && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24, color: "var(--text-secondary)", fontWeight: 700, fontSize: "0.9rem" }}>
              <style>{`@keyframes otpSpin { to { transform: rotate(360deg); } }`}</style>
              <span style={{ width: 18, height: 18, border: "2.5px solid var(--border-color)", borderTopColor: "var(--wise-green)", borderRadius: "50%", display: "inline-block", animation: "otpSpin 0.8s linear infinite" }} />
              Verifying OTP...
            </div>
          )}
          {!verifying && otpError && (
            <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--wise-danger)", fontWeight: 700, margin: "0 0 24px" }}>{otpError}</p>
          )}

          <div className="text-center" style={{ marginBottom: 20 }}>
            {timer > 0 ? (
              <p className="text-caption" style={{ fontSize: "1rem" }}>Resend OTP in <span style={{ fontWeight: 800, color: "var(--text-primary)" }}>{timer}s</span></p>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={handleSendOtp} disabled={loading} style={{ background: "var(--wise-green)", color: "var(--wise-dark-green)", fontWeight: 800, fontSize: "0.95rem", padding: "10px 24px", borderRadius: "100px", border: "none" }}>Resend OTP</button>
            )}
          </div>

          <div className="flex gap-md">
            <button className="btn btn-secondary" onClick={() => setIsOtpMode(false)} disabled={verifying} style={{ flex: 1, padding: "14px", fontSize: "1rem" }}>Cancel</button>
          </div>
        </div>
        {/* PDF Modal */}
        {showPdfModal && (
          <div style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "var(--overlay-bg)", backdropFilter: "blur(4px)",
              zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "flex-end",
              paddingBottom: "40px"
            }}>
            <div className="glass-card animate-slide-up" style={{ 
              width: "100%", maxWidth: 800, height: "80vh", borderRadius: "16px",
              display: "flex", flexDirection: "column", overflow: "hidden"
            }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card)" }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Terms & Conditions</h3>
                <button 
                  onClick={() => setShowPdfModal(false)} 
                  style={{ background: "none", border: "none", fontSize: "1.8rem", cursor: "pointer", color: "var(--text-secondary)", lineHeight: 1 }}
                >
                  &times;
                </button>
              </div>
              <div style={{ flex: 1, background: "#f0f2f5" }}>
                <iframe 
                  src="/final_terms.pdf" 
                  style={{ width: "100%", height: "100%", border: "none" }} 
                  title="Terms and Conditions PDF"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pre-Agreement Modal */}
      {showPreAgreement && (
        <div style={{ 
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(16px)",
          zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px"
        }}>
          <div className="animate-slide-up" style={{ 
            maxWidth: 480, 
            width: "90%", 
            textAlign: "center", 
            padding: "40px 32px",
            boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
            border: "1.5px solid var(--border-color)",
            borderRadius: "32px",
            background: "var(--bg-card)",
            height: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <p style={{ 
              marginBottom: 32, 
              lineHeight: 1.4, 
              fontSize: "clamp(1.1rem, 5vw, 1.4rem)", 
              fontWeight: 800,
              color: "var(--text-primary)",
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.5px"
            }}>
              Trading Account open with Stockology Securities Private Limited and Demat Account open with Globe Capital Market Limited
            </p>
            <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
              <button 
                className="btn btn-primary" 
                onClick={handleAcceptPreAgreement} 
                style={{ 
                  width: "100%",
                  maxWidth: 260,
                  padding: "16px 32px",
                  borderRadius: "100px",
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  boxShadow: "0 8px 16px rgba(159, 232, 112, 0.2)"
                }}
              >
                I Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
