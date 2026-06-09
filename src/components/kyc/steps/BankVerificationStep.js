"use client";
import { useState, useEffect } from "react";
import { useKYC } from "@/context/KYCContext";
import Logo from "../Logo";
import { Eye, EyeOff } from "lucide-react";

import { initializeDigio, createDigioRequest, fetchDigioRequestResponse, verifyBank, verifyIfsc } from "@/utils/digio";

export default function BankVerificationStep() {
  const { nomineeDetails, currentStep, goToStep, bankDetails, updateNested, nextStep, prevStep, addToast, setApplicationId } = useKYC();
  
  // Local state for the dropdown selection
  const [method, setMethod] = useState(bankDetails.method || "");
  const [form, setForm] = useState({
    accountNumber: bankDetails.accountNumber || "",
    ifsc: bankDetails.ifsc || "",
    bankName: bankDetails.bankName || "",
    upiId: bankDetails.upiId || "",
    micr: bankDetails.micr || "",
    accountType: bankDetails.accountType || "",
    confirmAccountNumber: ""
  });
  const [showAccountNumber, setShowAccountNumber] = useState(false);

  const [verificationState, setVerificationState] = useState("idle");
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isFetchingIfsc, setIsFetchingIfsc] = useState(false);

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
            
            setForm(prev => ({
              ...prev,
              ...(micr ? { micr } : {}),
              ...(bankName ? { bankName } : {})
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
          accountType: prev.accountType
        }) !== JSON.stringify({
          accountNumber: bankDetails.accountNumber || prev.accountNumber,
          ifsc: bankDetails.ifsc || prev.ifsc,
          bankName: bankDetails.bankName || prev.bankName,
          upiId: bankDetails.upiId || prev.upiId,
          micr: bankDetails.micr || prev.micr,
          accountType: bankDetails.accountType || prev.accountType
        });

        if (isDifferent) {
          return {
            accountNumber: bankDetails.accountNumber || prev.accountNumber,
            ifsc: bankDetails.ifsc || prev.ifsc,
            bankName: bankDetails.bankName || prev.bankName,
            upiId: bankDetails.upiId || prev.upiId,
            micr: bankDetails.micr || prev.micr,
            accountType: bankDetails.accountType || prev.accountType,
            confirmAccountNumber: prev.confirmAccountNumber
          };
        }
        return prev;
      });
      if (bankDetails.method && bankDetails.method !== method) {
        setMethod(bankDetails.method);
      }
    }
  }, [bankDetails]);

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const validateBankDetails = () => {
    if (!method) {
      addToast("Please select a verification method", "error");
      return false;
    }

    if (method === "Manual Data Entry") {
      if (!form.accountNumber || !form.ifsc || !form.accountType) {
        addToast("Please fill all bank details", "error");
        return false;
      }
      if (form.accountNumber !== form.confirmAccountNumber) {
        addToast("Account numbers do not match", "error");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validateBankDetails()) return;
    setShowSubmitConfirm(true);
  };

  const handleVerifyAndProceed = async () => {
    setShowSubmitConfirm(false);

    // Start verification
    setVerificationState("verifying");
    
    try {
      const result = await verifyBank(form.accountNumber, form.ifsc, null);

      if (result.success) {
        setVerificationState("idle");
        addToast("Bank details verified successfully", "success");
        if (result.data.beneficiary_name_with_bank) {
          update("accountHolderName", result.data.beneficiary_name_with_bank);
        }
        nextStep({ bankDetails: { ...form, method } });
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
      
      {/* If no method selected, show the dropdown */}
      {!method ? (
        <>
          <div className="text-center animate-slide-up" style={{ marginBottom: 30 }}>
            
            <h2 className="text-title" style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)" }}>Bank Verification</h2>
            <p className="text-body" style={{ color: "var(--text-secondary)", marginTop: "12px", fontSize: "0.95rem", lineHeight: 1.5, padding: "0 20px" }}>
              Please provide your bank account details for verification and future fund transfers.
            </p>
          </div>

          <div className="card animate-slide-up" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "24px" }}>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 600, marginBottom: "8px", display: "block" }}>
                Want to continue with <span style={{ color: "var(--wise-danger)" }}>*</span>
              </label>
              <select 
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="input-field"
                style={{ background: "var(--input-bg)", color: "var(--text-primary)", border: "1.5px solid var(--border-color)", height: "56px", borderRadius: "16px" }}
              >
                <option value="">--Select--</option>
                <option value="Manual Data Entry">Manual Data Entry</option>
              </select>
            </div>
             <button 
               onClick={() => nomineeDetails.opted === 'No' ? goToStep(currentStep - 3) : prevStep()} 
               className="btn-back"
               style={{ width: "100%", justifyContent: "center", color: "var(--text-secondary)" }}
             >
               Back
             </button>
          </div>
        </>
      ) : method === "Manual Data Entry" ? (
        <>
          <div className="text-center animate-slide-up" style={{ marginBottom: 32 }}>
            
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
              <select 
                value={form.accountType} 
                onChange={e => update("accountType", e.target.value)} 
                className="input-field"
                style={{ background: "var(--input-bg)", color: "var(--text-primary)", border: "1.5px solid var(--border-color)", height: "56px", borderRadius: "16px" }}
              >
                <option value="">Choose</option>
                <option value="Saving Account">Saving Account</option>
                <option value="Current Account">Current Account</option>
              </select>
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
                  onChange={e => update("confirmAccountNumber", e.target.value)} 
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
                {verificationState === "verifying" ? "Verifying..." : "Submit"}
              </button>

              <button 
                onClick={() => setMethod("")} 
                className="btn-back"
                style={{ color: "var(--text-secondary)" }}
              >
                Back
              </button>
            </div>

          </div>
        </>
      ) : (
        <>
          <div className="text-center animate-slide-up" style={{ marginBottom: 30 }}>
            <h2 className="text-title" style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)" }}>Bank Verification</h2>
          </div>
          <div className="glass-card animate-slide-up" style={{ padding: "32px", borderRadius: "24px", background: "var(--bg-card)", border: "1px solid var(--border-color)", filter: showSubmitConfirm ? "blur(2px)" : "none", pointerEvents: showSubmitConfirm ? "none" : "auto" }}>
            <div style={{ marginBottom: "32px" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--text-primary)", fontWeight: 600, marginBottom: "6px", display: "block" }}>
                UPI ID <span style={{ color: "var(--wise-danger)" }}>*</span>
              </label>
              <input 
                placeholder="e.g. yourname@okaxis" 
                value={form.upiId} 
                onChange={e => update("upiId", e.target.value)} 
                style={{ ...inputStyle, background: "var(--input-bg)", color: "var(--text-primary)", border: "1.5px solid var(--border-color)", height: "56px", borderRadius: "16px" }} 
              />
            </div>
            <div>
              <button 
                className="btn-primary" 
                onClick={handleSubmit} 
                style={{ width: "100%", height: "60px", borderRadius: "16px", fontSize: "1.1rem", fontWeight: 800 }}
              >
                {verificationState === "verifying" ? "Verifying..." : "Submit"}
              </button>
              <button 
                onClick={() => setMethod("")} 
                className="btn-back"
                style={{ width: "100%", justifyContent: "center", marginTop: "12px", color: "var(--text-secondary)" }}
              >
                Back to Methods
              </button>
            </div>
          </div>
        </>
      )}

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
    </div>
  );
}
