"use client";
import { useState, useRef, useEffect } from "react";
import { useKYC } from "@/context/KYCContext";
import { ArrowLeftIcon } from "../Icons";
import Logo from "../Logo";

export default function FinancialProofStep() {
  const { financialProof, personalDetails, updateNested, nextStep, prevStep, addToast } = useKYC();
  const [type, setType] = useState(financialProof?.type || "");
  const [filePreview, setFilePreview] = useState(financialProof?.filePreview || null);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  // Sync with context if it updates (e.g. after server sync)
  useEffect(() => {
    if (financialProof?.type && !type) setType(financialProof.type);
    if (financialProof?.filePreview && !filePreview) setFilePreview(financialProof.filePreview);
  }, [financialProof]);

  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file type (allow images and pdf)
    if (!file.type.match('image.*') && file.type !== 'application/pdf') {
      addToast("Please upload an image or PDF", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) { 
      addToast("File size too large (max 5MB)", "error"); 
      return; 
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setFilePreview(event.target.result);
      addToast("Document attached successfully", "success");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!type) {
      addToast("Please select an income proof type", "error");
      return;
    }
    if (!filePreview) {
      addToast("Please upload the document", "error");
      return;
    }
    
    updateNested("financialProof", { type, filePreview });
    nextStep();
  };

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

  const options = [
    "Bank account statement of latest 6 months",
    "Salary Slip (latest 3 months)",
    "Copy of Form 16",
    "Copy of ITR Acknowledgement",
    "Copy of Annual Accounts",
    "Net worth certificate"
  ];

  return (
    <div className="container-sm" style={{ paddingTop: "2vh", paddingBottom: "4vh" }}>
      <style>{`
        @media (max-width: 600px) {
          .financial-title { font-size: 1.8rem !important; }
          .financial-card { padding: 20px !important; border-radius: 24px !important; }
          .financial-label { font-size: 0.75rem !important; }
          .dropdown-trigger { height: 48px !important; font-size: 0.9rem !important; padding: 0 16px !important; }
          .upload-btn { height: 48px !important; font-size: 0.85rem !important; padding: 0 12px !important; }
          .submit-btn { height: 54px !important; font-size: 1rem !important; }
          .skip-btn { height: 48px !important; font-size: 0.9rem !important; }
          .back-btn { font-size: 0.85rem !important; }
        }
      `}</style>

      <div className="text-center animate-slide-up" style={{ marginBottom: 24 }}>
        <h1 className="text-section financial-title" style={{ fontSize: "2.5rem", fontWeight: 900, letterSpacing: "-0.5px", color: "var(--text-primary)" }}>Financial Proof</h1>
      </div>

      <div className="card animate-slide-up financial-card" style={{ 
        padding: "32px", 
        borderRadius: "32px", 
        border: "1px solid var(--border-color)", 
        background: "var(--bg-card)",
        boxShadow: "none",
        overflow: "visible"
      }}>
        
        <div style={{ marginBottom: "16px", position: "relative" }} ref={dropdownRef}>
          <label className="financial-label" style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 700, marginBottom: "8px", display: "block" }}>
            Select Income proof type <span style={{ color: "var(--wise-danger)" }}>*</span>
          </label>
          
          <div 
            onClick={() => setIsOpen(!isOpen)}
            className="dropdown-trigger"
            style={{ 
              height: "56px", 
              borderRadius: "28px", 
              border: "1.5px solid var(--border-color)",
              fontSize: "1rem",
              fontWeight: 700,
              padding: "0 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {type || "--Select--"}
            </span>
            <span style={{ transition: "transform 0.3s", transform: isOpen ? "rotate(180deg)" : "none", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              ▼
            </span>
          </div>

          {isOpen && (
            <div style={{ 
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-color)",
              borderRadius: "16px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              zIndex: 100,
              maxHeight: "200px",
              overflowY: "auto"
            }}>
              {options.map((opt) => (
                <div 
                  key={opt}
                  onClick={() => {
                    setType(opt);
                    setIsOpen(false);
                  }}
                  style={{ 
                    padding: "12px 16px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    borderBottom: "1px solid var(--border-color)",
                    transition: "background 0.2s",
                    color: "var(--text-primary)"
                  }}
                  onMouseOver={(e) => e.target.style.background = "var(--wise-cyan-tint)"}
                  onMouseOut={(e) => e.target.style.background = "transparent"}
                >
                  {opt}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: "16px" }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ position: "absolute", width: 0, height: 0, opacity: 0, overflow: "hidden" }} 
            accept="image/*,application/pdf" 
          />
          
          <button 
            onClick={() => fileInputRef.current.click()}
            className="btn-secondary w-full upload-btn"
            style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              gap: "8px",
              height: "56px",
              borderRadius: "12px",
              border: "1.5px solid var(--border-color)",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              fontSize: "1rem",
              fontWeight: 700,
              lineHeight: 1.2
            }}
          >
            <span style={{ fontSize: "1.2rem", fontWeight: 400 }}>↑</span> 
            {filePreview ? "Document Attached (Click to Replace)" : "Upload Financial Proof *"}
          </button>
          {filePreview && (
            <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--wise-green)", marginTop: "8px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              ✓ Document Attached
            </p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", marginTop: "16px" }}>
          <button 
            className="btn-primary w-full submit-btn" 
            style={{ 
              height: "60px", 
              borderRadius: "12px", 
              background: "var(--wise-green)", 
              color: "#000", 
              fontSize: "1.1rem", 
              fontWeight: 800,
              border: "none"
            }}
            onClick={handleSubmit} 
          >
            Submit
          </button>

          {personalDetails?.annualIncome !== "More Than 25 Lac" && (
            <button 
              onClick={() => setShowSkipConfirm(true)} 
              className="btn-secondary w-full skip-btn"
              style={{ 
                height: "56px", 
                borderRadius: "12px", 
                border: "1.5px solid var(--border-color)", 
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                fontSize: "1rem", 
                fontWeight: 700 
              }}
            >
              Skip this step
            </button>
          )}
          
          <button 
            onClick={prevStep} 
            className="btn-back back-btn"
            style={{ 
              marginTop: "8px", 
              color: "var(--text-muted)", 
              fontSize: "0.95rem", 
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "none",
              border: "none",
              cursor: "pointer"
            }}
          >
            <ArrowLeftIcon size={18} /> Back
          </button>
        </div>

      </div>

      {/* Skip Confirmation Modal */}
      {showSkipConfirm && (
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
            <h3 style={{ color: "var(--text-primary)", fontSize: "1.5rem", fontWeight: 800, marginBottom: "16px" }}>
              Skip Financial Proof?
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "32px", lineHeight: "1.5" }}>
              Are you sure you want to skip? You will not be able to trade in derivatives (F&O) without submitting a financial proof.
            </p>
            
            <button 
              onClick={() => {
                setShowSkipConfirm(false);
                nextStep();
                addToast("Financial proof skipped", "info");
              }}
              className="btn-primary"
              style={{ 
                width: "100%", marginBottom: "12px", height: "56px", borderRadius: "16px",
                fontWeight: 800, fontSize: "1.1rem"
              }}
            >
              Yes, Skip
            </button>
            
            <button 
              onClick={() => setShowSkipConfirm(false)} 
              className="btn-secondary"
              style={{ 
                width: "100%", height: "56px", borderRadius: "16px",
                fontWeight: 700, fontSize: "1rem"
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
