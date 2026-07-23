"use client";
import { useState, useEffect } from "react";
import { useKYC } from "@/context/KYCContext";
import { MailIcon, ArrowRightIcon, ArrowLeftIcon, CheckCircleIcon, EditIcon } from "../Icons";
import { sendEmailOtp, verifyEmailOtp } from "@/utils/kycApi";
import Logo from "../Logo";

const CheckIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--bg-primary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function EmailStep() {
  const { personalDetails, updateState, updateNested, nextStep, prevStep, addToast } = useKYC();
  const [email, setEmail] = useState(personalDetails.email || "");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isOtpMode, setIsOtpMode] = useState(false);
  const [timer, setTimer] = useState(30);
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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      addToast("Please enter a valid email address", "error");
      return;
    }
    
    setLoading(true);
    try {
      await sendEmailOtp(email);
      setIsOtpMode(true);
      setTimer(30);
      addToast("Verification code sent to your email!", "success");
    } catch (error) {
      addToast(error.message || "Failed to send OTP", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const val = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);
    
    if (val && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`);
      if (next) next.focus();
    }
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
      if (otp.join("").length === 6) {
        verifyOtp();
      }
    }
  };

  const verifyOtp = async () => {
    const otpValue = otp.join("");
    if (otpValue.length < 6) {
      addToast("Enter 6-digit OTP", "error");
      return;
    }
    
    setLoading(true);
    try {
      await verifyEmailOtp(email, otpValue);
      addToast("Email verified successfully!", "success");
      nextStep({ 
        personalDetails: { ...personalDetails, email: email }, 
        emailVerified: true 
      });
    } catch (error) {
      addToast(error.message || "Invalid OTP", "error");
    } finally {
      setLoading(false);
    }
  };

  // Prevent rendering until mounted to solve hydration issues
  if (!mounted) return null;

  return (
    <div className="container-sm">
      <div className="text-center animate-slide-up" style={{ marginBottom: 40 }}>
        <h2 className="text-section" style={{ marginBottom: 16 }}>Email Identity</h2>
        <p className="text-body" style={{ fontWeight: 600 }}>We'll send a verification code to your email address.</p>
      </div>

      <div className="card animate-slide-up">
        
        {/* Email Input Section */}
        <div style={{ marginBottom: isOtpMode ? 20 : 28, opacity: isOtpMode ? 0.6 : 1, transition: "all 0.3s ease" }}>
          <label className="text-body-bold" style={{ display: "block", marginBottom: 8, fontSize: "0.9rem" }}>Email Address</label>
          <div style={{ position: "relative" }}>
            <input 
              type="email" className="input-field" placeholder="name@example.com" 
              style={{ fontWeight: 700, paddingRight: isOtpMode ? "60px" : "24px" }}
              value={email} onChange={e => !isOtpMode && setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && email && !isOtpMode && handleSendOtp()}
              readOnly={isOtpMode}
            />
            {isOtpMode && (
              <button 
                onClick={() => setIsOtpMode(false)}
                style={{ 
                  position: "absolute", right: 15, top: "50%", transform: "translateY(-50%)",
                  background: "var(--wise-green-light)", border: "none", borderRadius: "8px",
                  padding: "8px", cursor: "pointer", color: "var(--wise-green)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s ease"
                }}
                className="hover-scale"
                title="Edit Email"
              >
                <EditIcon size={18} />
              </button>
            )}
          </div>
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
                        <li>I confirm that the Email Id provided belongs exclusively to me.</li>
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

        {/* Action Button for Email */}
        <div style={{ display: isOtpMode ? "none" : "flex", gap: "16px" }}>
          <button className="btn btn-secondary" onClick={prevStep} style={{ flex: 1 }}>
            Back
          </button>
          <button className="btn btn-primary" onClick={handleSendOtp} disabled={!email || !acceptedTerms || loading} style={{ flex: 1.5 }}>
            {loading ? "Sending..." : "Send Code"}
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
              <span>CODE SENT TO {email}</span>
            </div>
            <div>
              <button className="btn-pill" onClick={() => setIsOtpMode(false)}>Edit Email</button>
            </div>
          </div>

          <div className="flex justify-center" style={{ marginBottom: 32, gap: "6px" }}>
            {otp.map((digit, i) => (
              <input 
                key={`otp-input-${i}`} 
                id={`otp-${i}`} 
                type="tel" 
                className="otp-input" 
                style={{ 
                  borderColor: digit ? "var(--wise-green)" : "rgba(0,0,0,0.1)",
                  background: digit ? "#fff" : "var(--bg-card)"
                }}
                value={digit} 
                onChange={e => handleOtpChange(i, e.target.value)} 
                onKeyDown={e => handleKeyDown(i, e)}
                maxLength={1}
                autoFocus={isOtpMode && i === 0}
              />
            ))}
          </div>

          <div className="flex gap-md">
            <button className="btn btn-secondary" onClick={() => setIsOtpMode(false)} style={{ flex: 1, padding: "14px", fontSize: "1rem" }}>Cancel</button>
            <button className="btn btn-primary" onClick={verifyOtp} disabled={loading || otp.join("").length < 6} style={{ flex: 2, padding: "14px", fontSize: "1rem" }}>
              {loading ? "Verifying..." : "Verify & Continue"}
            </button>
          </div>
          
          <div className="text-center" style={{ marginTop: 28 }}>
            {timer > 0 ? (
              <p className="text-caption" style={{ fontSize: "1rem" }}>Resend code in <span style={{ fontWeight: 800, color: "var(--text-primary)" }}>{timer}s</span></p>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={handleSendOtp} style={{ color: "var(--wise-green)", fontWeight: 800 }}>Resend Verification Email</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
