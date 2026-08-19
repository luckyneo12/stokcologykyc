"use client";
import { useState, useEffect, useRef } from "react";
import { useKYC } from "@/context/KYCContext";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import Logo from "../Logo";
import { Eye, EyeOff } from "lucide-react";

const CustomSelect = ({ value, onChange, options, placeholder, error, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} style={{ position: "relative", width: "100%" }}>
      <div 
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIsOpen(!isOpen); } 
          else if (e.key === "Escape") { setIsOpen(false); }
        }}
        className="input-field"
        style={{ 
          cursor: disabled ? "not-allowed" : "pointer",
          borderColor: error ? "var(--wise-danger)" : isOpen ? "var(--wise-green)" : "var(--border-color)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          opacity: disabled ? 0.6 : 1, padding: "0 16px"
        }}
      >
        <span style={{ color: value ? "var(--text-primary)" : "var(--text-muted)", fontSize: "0.85rem", fontWeight: 700 }}>
          {value || placeholder}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", opacity: 0.5 }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      
      {isOpen && (
        <div style={{ 
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000, 
          background: "var(--bg-elevated)", border: "1.5px solid var(--border-color)", 
          borderRadius: "12px", marginTop: "4px", 
          boxShadow: "0 20px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)",
          maxHeight: "220px", overflowY: "auto", padding: "6px"
        }}>
          {options.map((opt) => (
            <div 
              key={opt} tabIndex={0}
              onClick={() => { onChange(opt); setIsOpen(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(opt); setIsOpen(false); } 
                else if (e.key === "Escape") { setIsOpen(false); }
              }}
              style={{ 
                padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 700,
                background: value === opt ? "var(--wise-green)" : "transparent",
                color: value === opt ? "var(--wise-dark-green)" : "var(--text-primary)",
                transition: "all 0.2s", marginBottom: "1px"
              }}
              onMouseOver={e => { if (value !== opt) e.currentTarget.style.background = "rgba(159, 232, 112, 0.15)"; }}
              onMouseOut={e => { if (value !== opt) e.currentTarget.style.background = "transparent"; }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import { initializeDigio, createDigioRequest, fetchDigioRequestResponse, verifyBank, verifyIfsc } from "@/utils/digio";

export default function BankVerificationStep() {
  const { nomineeDetails, currentStep, goToStep, bankDetails, updateNested, nextStep, prevStep, addToast, setApplicationId, markStepVerified, personalDetails, ocrData } = useKYC();
  
  // Local state for the dropdown selection
    const [form, setForm, clearFormDraft] = useLocalDraft("bankForm", {
    accountNumber: bankDetails.accountNumber || "",
    ifsc: bankDetails.ifsc || "",
    bankName: bankDetails.bankName || "",
    upiId: bankDetails.upiId || "",
    micr: bankDetails.micr || "",
    accountType: bankDetails.accountType || "",
    branch: bankDetails.branch || "",
    address: bankDetails.address || "",
    city: bankDetails.city || "",
    district: bankDetails.district || "",
    state: bankDetails.state || "",
    confirmAccountNumber: bankDetails.accountNumber || ""
  });
  const [showAccountNumber, setShowAccountNumber] = useState(false);

  const [verificationState, setVerificationState] = useState("idle");
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showMismatchModal, setShowMismatchModal] = useState(null);
  const [isFetchingIfsc, setIsFetchingIfsc] = useState(false);

  const isAlreadyProcessed = !!bankDetails?.accountHolderName && form.accountNumber === bankDetails.accountNumber && form.ifsc === bankDetails.ifsc;
  
  const handleReset = () => {
    clearFormDraft();
    setForm({
      accountNumber: "",
      ifsc: "",
      bankName: "",
      upiId: "",
      micr: "",
      accountType: "",
      branch: "",
      address: "",
      city: "",
      district: "",
      state: "",
      confirmAccountNumber: ""
    });
    updateNested("bankDetails", {
      method: "Manual Data Entry",
      accountNumber: "",
      ifsc: "",
      bankName: "",
      upiId: "",
      micr: "",
      accountType: "",
      branch: "",
      address: "",
      city: "",
      district: "",
      state: "",
      accountHolderName: "",
      verified: false
    });
    setVerificationState("idle");
    addToast("Bank form reset for testing.", "success");
  };

  useEffect(() => {
    const fetchBankDetails = async () => {
      const ifsc = form.ifsc?.trim().toUpperCase();
      
      // Clear details if IFSC is not complete
      if (!ifsc || ifsc.length < 11) {
        if (form.micr || form.bankName) {
          setForm(prev => ({ ...prev, micr: "", bankName: "" }));
        }
        return;
      }

      if (ifsc.length === 11) {
        setIsFetchingIfsc(true);
        try {
          const result = await verifyIfsc(ifsc);
          if (result.success && result.data) {
            const root = result.data;
            const bankInfo = root.data || root.result || root;
            
            const micr = bankInfo.micr || bankInfo.MICR || bankInfo.micr_code;
            const bankName = bankInfo.bank || bankInfo.bank_name || bankInfo.name;
            const branch = bankInfo.branch;
            const address = bankInfo.address;
            const city = bankInfo.city;
            const district = bankInfo.district;
            const state = bankInfo.state;
            
            setForm(prev => ({
              ...prev,
              ...(micr ? { micr } : {}),
              ...(bankName ? { bankName } : {}),
              ...(branch ? { branch } : {}),
              ...(address ? { address } : {}),
              ...(city ? { city } : {}),
              ...(district ? { district } : {}),
              ...(state ? { state } : {})
            }));
          }
        } catch (error) {
          console.error("IFSC fetch error:", error);
        } finally {
          setIsFetchingIfsc(false);
        }
      }
    };
    fetchBankDetails();
  }, [form.ifsc]);

  // Sync with global context state
  useEffect(() => {
    if (bankDetails) {
      setForm(prev => {
        const isDifferent = JSON.stringify({
          accountNumber: prev.accountNumber,
          ifsc: prev.ifsc,
          bankName: prev.bankName,
          upiId: prev.upiId,
          micr: prev.micr,
          accountType: prev.accountType,
          branch: prev.branch,
          address: prev.address,
          city: prev.city,
          district: prev.district,
          state: prev.state
        }) !== JSON.stringify({
          accountNumber: bankDetails.accountNumber || prev.accountNumber,
          ifsc: bankDetails.ifsc || prev.ifsc,
          bankName: bankDetails.bankName || prev.bankName,
          upiId: bankDetails.upiId || prev.upiId,
          micr: bankDetails.micr || prev.micr,
          accountType: bankDetails.accountType || prev.accountType,
          branch: bankDetails.branch || prev.branch,
          address: bankDetails.address || prev.address,
          city: bankDetails.city || prev.city,
          district: bankDetails.district || prev.district,
          state: bankDetails.state || prev.state
        });

        if (isDifferent) {
          return {
            accountNumber: bankDetails.accountNumber || prev.accountNumber,
            ifsc: bankDetails.ifsc || prev.ifsc,
            bankName: bankDetails.bankName || prev.bankName,
            upiId: bankDetails.upiId || prev.upiId,
            micr: bankDetails.micr || prev.micr,
            accountType: bankDetails.accountType || prev.accountType,
            branch: bankDetails.branch || prev.branch,
            address: bankDetails.address || prev.address,
            city: bankDetails.city || prev.city,
            district: bankDetails.district || prev.district,
            state: bankDetails.state || prev.state,
            confirmAccountNumber: bankDetails.accountNumber || prev.confirmAccountNumber
          };
        }
        return prev;
      });
      
    }
  }, [bankDetails]);

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const validateBankDetails = () => {
    if (!form.accountNumber || !form.ifsc || !form.accountType) {
      addToast("Please fill all bank details", "error");
      return false;
    }
    if (form.accountNumber !== form.confirmAccountNumber) {
      addToast("Account numbers do not match", "error");
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validateBankDetails()) return;
    if (isAlreadyProcessed) {
       clearFormDraft();
       nextStep({ bankDetails: { ...bankDetails, ...form, method: "Manual Data Entry" } });
       return;
    }
    
    setShowSubmitConfirm(true);
  };

  const handleVerifyAndProceed = async () => {
    setShowSubmitConfirm(false);

    // Start verification
    setVerificationState("verifying");
    
    try {
      const result = await verifyBank(form.accountNumber, form.ifsc, null, form.accountType);

      if (result.success) {
        setVerificationState("idle");
        const accountHolder = result.data.beneficiary_name_with_bank || form.accountHolderName;

        if (result.nameMismatch) {
          const kycName = personalDetails?.fullName || ocrData?.name || "Unknown";
          
          const hashName = (name) => {
            if (!name) return "";
            return name.split(" ").map(word => {
              if (word.length <= 2) return word + "***";
              return word.substring(0, 2) + "***";
            }).join(" ");
          };
          
          setShowMismatchModal({
             kycName,
             bankName: hashName(accountHolder),
             accountHolder
          });
        } else {
          addToast("Name matched. Penny drop verified.", "success");
          update("accountHolderName", accountHolder);
          // Record verification fingerprint so this step auto-skips on re-navigation
          markStepVerified(10, `${form.accountNumber}|${form.ifsc}`);
          clearFormDraft();
          nextStep({ bankDetails: { ...form, method: "Manual Data Entry", accountHolderName: accountHolder, verified: true } });
        }
      } else {
        setVerificationState("idle");
        addToast(result.error || "Bank verification failed", "error");
      }
    } catch (error) {
      addToast(error.message || "Error connecting to bank verification service", "error");
      setVerificationState("idle");
    }
  };

  const inputStyle = {
    width: "100%", 
    padding: "10px 14px", 
    fontSize: "0.95rem", 
    height: "44px",
    border: "1px solid var(--border-color)", 
    borderRadius: "12px",
    outline: "none", 
    color: "var(--text-primary)",
    background: "var(--bg-elevated)",
    fontWeight: 600,
    transition: "all var(--transition-fast)"
  };

  // Payment Successful Screen (Removed as requested)

  return (
    <div className="container-sm">
      
      
          <div className="text-center animate-slide-up" style={{ marginBottom: 32, position: "relative" }}>
            <button 
              onClick={handleReset} 
              style={{ position: "absolute", right: 0, top: 0, color: "var(--wise-danger)", background: "transparent", border: "none", cursor: "pointer", fontSize: "0.9rem", fontWeight: 700, padding: "4px 8px", borderRadius: "8px" }}
            >
              Reset Test
            </button>

            
            <h1 className="text-section" style={{ fontSize: "2.4rem", marginBottom: 16, color: "var(--text-primary)" }}>Bank Details</h1>
          </div>

          <div className="card animate-slide-up" style={{ 
            background: "var(--bg-card)", 
            border: "1px solid var(--border-color)", 
            borderRadius: "24px",
            filter: showSubmitConfirm ? "blur(2px)" : "none", 
            pointerEvents: showSubmitConfirm ? "none" : "auto" 
          }}>
            
            <div className="form-grid-2" style={{ marginBottom: "20px" }}>
              <div>
                <label style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 700, marginBottom: "8px", display: "block" }}>
                  IFSC <span style={{ color: "var(--wise-danger)" }}>*</span>
                </label>
                <input 
                  placeholder="IFSC" 
                  value={form.ifsc} 
                  onChange={e => update("ifsc", e.target.value.toUpperCase())} 
                  className="input-field"
                  style={{ textTransform: "uppercase", background: "var(--input-bg)", color: "var(--text-primary)", border: "1.5px solid var(--border-color)", height: "56px", borderRadius: "16px" }} 
                />
              </div>
              <div>
                <label style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 700, marginBottom: "8px", display: "block" }}>
                  MICR
                </label>
                <input 
                  placeholder={isFetchingIfsc ? "Loading..." : "MICR"} 
                  value={isFetchingIfsc ? "Fetching..." : form.micr} 
                  readOnly={isFetchingIfsc}
                  onChange={e => update("micr", e.target.value)} 
                  className="input-field"
                  style={{ 
                    opacity: isFetchingIfsc ? 0.7 : 1,
                    fontStyle: isFetchingIfsc ? "italic" : "normal",
                    background: "var(--input-bg)", color: "var(--text-primary)", border: "1.5px solid var(--border-color)", height: "56px", borderRadius: "16px"
                  }} 
                />
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 700, marginBottom: "8px", display: "block" }}>
                Account Type <span style={{ color: "var(--wise-danger)" }}>*</span>
              </label>
              <CustomSelect 
                value={
                  form.accountType === "10" || form.accountType === 10 ? "Saving Account" : 
                  form.accountType === "11" || form.accountType === 11 ? "Current Account" : 
                  (form.accountType === "Savings" ? "Saving Account" : 
                   form.accountType === "Current" ? "Current Account" : form.accountType)
                }
                onChange={val => update("accountType", val)}
                options={["Saving Account", "Current Account"]}
                placeholder="--Select--"
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 700, marginBottom: "8px", display: "block" }}>
                Account Number <span style={{ color: "var(--wise-danger)" }}>*</span>
              </label>
              <input 
                placeholder="Enter Account Number" 
                value={form.accountNumber} 
                onChange={e => update("accountNumber", e.target.value)} 
                className="input-field" 
                style={{ background: "var(--input-bg)", color: "var(--text-primary)", border: "1.5px solid var(--border-color)", height: "56px", borderRadius: "16px" }}
              />
            </div>

            <div style={{ marginBottom: "32px" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 700, marginBottom: "8px", display: "block" }}>
                Confirm Account Number <span style={{ color: "var(--wise-danger)" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <input 
                  type={showAccountNumber ? "text" : "password"}
                  placeholder="Confirm Account Number" 
                  value={form.confirmAccountNumber} 
                  onChange={e => {
                    update("confirmAccountNumber", e.target.value);
                    if (showAccountNumber) setShowAccountNumber(false);
                  }}
                  className="input-field" 
                  style={{ 
                    background: "var(--input-bg)", 
                    color: "var(--text-primary)", 
                    border: `1.5px solid ${form.confirmAccountNumber && form.accountNumber !== form.confirmAccountNumber ? "var(--wise-danger)" : "var(--border-color)"}`, 
                    height: "56px", 
                    borderRadius: "16px", 
                    paddingRight: "50px" 
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowAccountNumber(!showAccountNumber)}
                  style={{
                    position: "absolute",
                    right: "16px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  {showAccountNumber ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {form.confirmAccountNumber && form.accountNumber !== form.confirmAccountNumber && (
                <p style={{ fontSize: "0.75rem", color: "var(--wise-danger)", marginTop: "6px", fontWeight: 700 }}>
                  Account numbers do not match
                </p>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
              <button 
                className="btn-primary" 
                onClick={handleSubmit} 
                style={{ width: "100%", height: "60px", borderRadius: "16px", fontSize: "1.1rem", fontWeight: 800 }}
              >
               {verificationState === "verifying" ? "Verifying..." : isAlreadyProcessed ? (bankDetails?.verified ? "Verified - Continue" : "Mismatched - Continue") : "Submit"}
              </button>

              <button 
                onClick={() => nomineeDetails?.opted === 'No' ? goToStep(currentStep - 3) : prevStep()} 
                className="btn-back"
                style={{ color: "var(--text-secondary)", background: "transparent", border: "none", cursor: "pointer", fontSize: "1rem", fontWeight: 700, marginTop: "8px" }}
              >
                Back
              </button>
            </div>
          </div>

      {/* Penny Drop Verified Modal Overlay */}
      {showSubmitConfirm && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          display: "flex", alignItems: "center", justifyContent: "center",
          paddingBottom: "40px",
          zIndex: 1000, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)"
        }}>
          <div className="animate-slide-up" style={{ 
            background: "var(--bg-card)", padding: "32px", borderRadius: "24px", 
            width: "90%", maxWidth: "380px", textAlign: "center",
            boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
            border: "1px solid var(--border-color)"
          }}>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "4px" }}>Confirm Bank Verification</p>
            <h3 style={{ color: "var(--text-primary)", fontSize: "1.5rem", fontWeight: 800, marginBottom: "32px" }}>
              Proceed with Penny Drop?
            </h3>
            
            <button 
              onClick={() => setShowSubmitConfirm(false)} 
              className="btn-secondary"
              style={{ 
                width: "100%", marginBottom: "12px", height: "56px", borderRadius: "16px",
                fontWeight: 700, fontSize: "1rem"
              }}
            >
              Modify
            </button>
            
            <button 
              onClick={handleVerifyAndProceed}
              disabled={verificationState === "verifying"}
              className="btn-primary"
              style={{ 
                width: "100%", height: "56px", borderRadius: "16px",
                fontWeight: 800, fontSize: "1.1rem"
              }}
            >
              {verificationState === "verifying" ? "Verifying..." : "Proceed"}
            </button>
          </div>
        </div>
      )}

      {/* Name Mismatch Modal */}
      {showMismatchModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          display: "flex", alignItems: "center", justifyContent: "center",
          paddingBottom: "40px",
          zIndex: 1000, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)"
        }}>
          <div className="animate-slide-up" style={{ 
            background: "var(--bg-card)", padding: "32px", borderRadius: "24px", 
            width: "90%", maxWidth: "380px", textAlign: "center",
            boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
            border: "1px solid var(--border-color)"
          }}>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "8px" }}>Penny Drop</p>
            <h3 style={{ color: "var(--text-primary)", fontSize: "1.1rem", fontWeight: 700, marginBottom: "32px", lineHeight: 1.5 }}>
              Your name ({showMismatchModal.kycName}) does not match with your Bank Account Name ({showMismatchModal.bankName})
            </h3>
            
            <button 
              onClick={() => setShowMismatchModal(null)} 
              className="btn-secondary"
              style={{ 
                width: "100%", marginBottom: "12px", height: "56px", borderRadius: "16px",
                fontWeight: 700, fontSize: "1rem"
              }}
            >
              Modify
            </button>
            
            <button 
              onClick={() => {
                const accountHolder = showMismatchModal.accountHolder;
                setShowMismatchModal(null);
                addToast("Name not matched penny drop not verified. Proceeding to upload bank proof.", "warning");
                update("accountHolderName", accountHolder);
                markStepVerified(10, `${form.accountNumber}|${form.ifsc}`);
                clearFormDraft();
                nextStep({ bankDetails: { ...form, method: "Manual Data Entry", accountHolderName: accountHolder, verified: false } });
              }}
              className="btn-primary"
              style={{ 
                width: "100%", height: "56px", borderRadius: "16px",
                fontWeight: 800, fontSize: "1.1rem"
              }}
            >
              Proceed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
