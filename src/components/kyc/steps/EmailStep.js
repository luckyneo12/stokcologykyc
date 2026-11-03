"use client";
import { useState, useEffect } from "react";
import { useKYC } from "@/context/KYCContext";
import { MailIcon, ArrowRightIcon, ArrowLeftIcon, CheckCircleIcon, EditIcon } from "../Icons";
import { sendEmailOtp, verifyEmailOtp } from "@/utils/kycApi";
import { getEmailTypoSuggestion } from "@/utils/emailTypo";
import Logo from "../Logo";

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const EMAIL_DOMAIN_ERROR = "Please check and enter your correct email address.";

const CheckIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--bg-primary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function EmailStep() {
  const { personalDetails, updateState, updateNested, nextStep, prevStep, addToast } = useKYC();
  const [email, setEmail] = useState(personalDetails.email || "");
  // Defaults to "--Select--" (nothing chosen). "Child Dependent 2" / "Parent Dependent 2" are no longer offered — a saved one must be re-selected
  const [emailDependency, setEmailDependency] = useState(
    ["Child Dependent 2", "Parent Dependent 2"].includes(personalDetails.emailDependency) ? "" : (personalDetails.emailDependency || "")
  );
  const [emailError, setEmailError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [showEditTip, setShowEditTip] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isOtpMode, setIsOtpMode] = useState(false);
  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

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
    if (!email) {
      addToast("Please enter email address", "error");
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      addToast("Please enter a valid email address", "error");
      return;
    }
    // Blocked until a mistyped domain is fixed (also covers an email pre-filled from saved data)
    if (getEmailTypoSuggestion(email)) {
      setEmailError(EMAIL_DOMAIN_ERROR);
      addToast(EMAIL_DOMAIN_ERROR, "error");
      return;
    }
    if (!emailDependency) {
      addToast("Please select email dependency", "error");
      return;
    }
    if (!acceptedTerms) {
      addToast("Please accept Terms & Conditions", "error");
      return;
    }
    
    setLoading(true);
    try {
      await sendEmailOtp(email);
      setOtp(["", "", "", "", "", ""]); // new OTP sent (incl. resend) — clear the old digits
      setOtpError("");
      setIsOtpMode(true);
      setTimer(60);
      setTimeout(() => document.getElementById("otp-0")?.focus(), 0);
      addToast("OTP sent to your email!", "success");
    } catch (error) {
      addToast(error.message || "Failed to send OTP", "error");
    } finally {
      setLoading(false);
    }
  };

  // Real-time checks: format alert + mistyped domain ("gmail.co"). No corrected address is suggested —
  // the applicant must type their own email themselves.
  const validateEmail = (val, hadBadChars = false) => {
    const isValidFormat = !!val && EMAIL_REGEX.test(val);
    if (hadBadChars) {
      setEmailError("Only letters, numbers and . _ % + - @ are allowed in an email address");
    } else if (val && !isValidFormat) {
      setEmailError("Enter a valid email address (e.g. name@example.com)");
    } else if (isValidFormat && getEmailTypoSuggestion(val)) {
      setEmailError(EMAIL_DOMAIN_ERROR);
    } else {
      setEmailError("");
    }
  };

  // Email field accepts only email characters
  const handleEmailChange = (e) => {
    if (isOtpMode) return;
    const raw = e.target.value;
    let val = raw.replace(/[^A-Za-z0-9._%+\-@]/g, "");
    // Only one "@" allowed
    const at = val.indexOf("@");
    if (at !== -1) val = val.slice(0, at + 1) + val.slice(at + 1).replace(/@/g, "");
    setEmail(val);
    validateEmail(val, val !== raw);
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
    if (code.length === 6) verifyOtp(code);
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
        verifyOtp();
      }
    }
  };

  const verifyOtp = async (code) => {
    const otpValue = typeof code === "string" ? code : otp.join("");
    if (otpValue.length < 6) {
      addToast("Enter 6-digit OTP", "error");
      return;
    }
    if (verifying) return;

    let failed = false;
    setLoading(true);
    setVerifying(true);
    setOtpError("");
    try {
      await verifyEmailOtp(email, otpValue);
      addToast("Email verified successfully!", "success");
      await nextStep({
        personalDetails: { ...personalDetails, email: email, emailDependency: emailDependency },
        emailVerified: true
      });
    } catch (error) {
      failed = true;
      addToast(error.message || "Invalid OTP", "error");
      setOtpError(error.message || "Invalid OTP. Please try again.");
      // Wrong OTP — clear the boxes so a fresh code can be typed
      setOtp(["", "", "", "", "", ""]);
    } finally {
      setLoading(false);
      setVerifying(false);
      if (failed) setTimeout(() => document.getElementById("otp-0")?.focus(), 50);
    }
  };

  // Prevent rendering until mounted to solve hydration issues
  if (!mounted) return null;

  return (
    <div className="container-sm">
      <div className="text-center animate-slide-up" style={{ marginBottom: 40 }}>
        <h2 className="text-section" style={{ marginBottom: 16 }}>Email Identity</h2>
        <p className="text-body" style={{ fontWeight: 600 }}>We'll send an OTP to your email address.</p>
      </div>

      <div className="card animate-slide-up">
        
        {/* Email Input Section */}
        <div style={{ marginBottom: isOtpMode ? 20 : 28, transition: "all 0.3s ease" }}>
          <label className="text-body-bold" style={{ display: "block", marginBottom: 8, fontSize: "0.9rem", opacity: isOtpMode ? 0.6 : 1, transition: "all 0.3s ease" }}>Email Address</label>
          <div style={{ position: "relative" }}>
            <input
              type="email" className="input-field" placeholder="name@example.com"
              style={{ fontWeight: 700, paddingRight: isOtpMode ? "60px" : "24px", borderColor: emailError ? "var(--wise-danger)" : undefined, opacity: isOtpMode ? 0.6 : 1, transition: "all 0.3s ease" }}
              inputMode="email" autoComplete="email"
              value={email} onChange={handleEmailChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (email && !isOtpMode) handleSendOtp();
                }
              }}
              readOnly={isOtpMode}
            />
            {isOtpMode && (
              <button 
                type="button"
                onClick={() => { setShowEditTip(false); setIsOtpMode(false); }}
                onMouseEnter={() => setShowEditTip(true)}
                onMouseLeave={() => setShowEditTip(false)}
                aria-label="Edit email address"
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
                    Edit email address
                  </span>
                )}
              </button>
            )}
          </div>
          {emailError && (
            <p style={{ fontSize: "0.7rem", color: "var(--wise-danger)", marginTop: "4px", fontWeight: 700 }}>{emailError}</p>
          )}
        </div>

        {/* Email Dependency Section */}
        <div style={{ marginBottom: isOtpMode ? 20 : 28, opacity: isOtpMode ? 0.6 : 1, transition: "all 0.3s ease" }}>
          <label className="text-body-bold" style={{ display: "block", marginBottom: 8, fontSize: "0.9rem" }}>Select Dependency <span style={{ color: "var(--wise-danger)" }}>*</span></label>
          <select 
            className="input-field" 
            value={emailDependency} 
            onChange={e => setEmailDependency(e.target.value)}
            disabled={isOtpMode}
            style={{ 
              fontWeight: 700, 
              color: emailDependency ? "var(--text-primary)" : "var(--text-muted)",
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
              background: acceptedTerms ? "var(--text-primary)" : "transparent",
              border: `2px solid ${acceptedTerms ? "var(--text-primary)" : "var(--border-color)"}`,
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
                        <li>I voluntarily provide my Email Id for communication related to my Trading Account and Demat Account.</li>
                        <li>I give my explicit consent to receive transactional, regulatory, service-related, and promotional communications through Email or other electronic modes on this email address.</li>
                        <li>I understand that my Trading Account will be opened and maintained with Stockology Securities Private Limited.</li>
                        <li>I further understand that my Demat Account will be opened and maintained with Globe Capital Market Limited, in accordance with applicable SEBI and Depository regulations.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: isOtpMode ? "none" : "flex", gap: "16px" }}>
          <button type="button" className="btn btn-secondary" onClick={prevStep} style={{ flex: 1 }}>
            Back
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSendOtp} disabled={loading} style={{ flex: 1.5 }}>
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </div>

        {/* OTP Section */}
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
              <span>OTP SENT TO {email}</span>
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
              <button className="btn btn-ghost btn-sm" onClick={handleSendOtp} style={{ background: "var(--wise-green)", color: "var(--wise-dark-green)", fontWeight: 800, fontSize: "0.95rem", padding: "10px 24px", borderRadius: "100px", border: "none" }}>Resend OTP</button>
            )}
          </div>

          <div className="flex gap-md">
            <button className="btn btn-secondary" onClick={() => setIsOtpMode(false)} disabled={verifying} style={{ flex: 1, padding: "14px", fontSize: "1rem" }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
