"use client";
import { useState } from "react";
import { useKYC } from "@/context/KYCContext";
import { IdCardIcon, ArrowLeftIcon, ArrowRightIcon } from "../Icons";
import Logo from "../Logo";

const methods = [
  { id: "pan", title: "PAN Card", desc: "Permanent Account Number" },
  { id: "aadhaar", title: "Aadhaar Card", desc: "12-digit Unique Identity" },
  { id: "passport", title: "Passport", desc: "Indian Passport" },
  { id: "dl", title: "Driving License", desc: "Valid Driving License" },
];

export default function IdentityStep() {
  const { identityMethod, identityDetails, updateState, updateNested, nextStep, prevStep, addToast } = useKYC();
  const [selected, setSelected] = useState(identityMethod || "");
  const [details, setDetails] = useState(identityDetails);
  const [errors, setErrors] = useState({});

  const handleSubmit = () => {
    if (!selected) { addToast("Please select an identity document", "error"); return; }
    // Basic validation
    if (selected === "pan" && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(details.pan.toUpperCase())) {
      setErrors({ pan: "Invalid PAN format" }); return;
    }
    if (selected === "aadhaar" && details.aadhaar.length !== 12) {
      setErrors({ aadhaar: "Aadhaar must be 12 digits" }); return;
    }

    updateState({ identityMethod: selected });
    updateNested("identityDetails", details);
    nextStep();
  };

  return (
    <div className="container-sm" style={{ paddingTop: "2vh", paddingBottom: "4vh", maxWidth: "520px" }}>
      <div className="text-center animate-slide-up" style={{ marginBottom: 32 }}>
        <h1 className="text-section" style={{ fontSize: "2.4rem", fontWeight: 900, letterSpacing: "-0.5px", color: "var(--text-primary)" }}>Identity Document</h1>
        <p className="text-body" style={{ color: "var(--text-secondary)", marginTop: "12px", fontWeight: 600 }}>Select the document you'll use for verification.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
        {methods.map(m => (
          <div 
            key={m.id} 
            className={`card animate-slide-up ${selected === m.id ? "card-selected" : ""}`}
            onClick={() => setSelected(m.id)} 
            style={{ 
              textAlign: "center", 
              padding: "24px 16px",
              cursor: "pointer",
              borderRadius: "24px",
              border: selected === m.id ? "2.5px solid var(--wise-green)" : "1.5px solid var(--border-color)",
              background: selected === m.id ? "var(--wise-cyan-tint)" : "var(--bg-card)",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: "none"
            }}
          >
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 6, color: "var(--text-primary)" }}>{m.title}</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 500 }}>{m.desc}</p>
          </div>
        ))}
      </div>

      {selected && (
        <div className="card animate-slide-up" style={{ 
          padding: 32, 
          marginBottom: 32,
          borderRadius: "32px",
          border: "1.5px solid var(--border-color)",
          background: "var(--bg-card)",
          boxShadow: "none"
        }}>
          {selected === "pan" && (
            <div className="input-group">
              <label style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 700, marginBottom: "8px", display: "block" }}>
                PAN Number <span style={{ color: "var(--wise-danger)" }}>*</span>
              </label>
              <input 
                className="input-field" 
                placeholder="ABCDE1234F" 
                style={{ 
                  textTransform: "uppercase", 
                  letterSpacing: "2px", 
                  fontWeight: 700,
                  height: "56px",
                  borderRadius: "16px",
                  border: "1.5px solid var(--border-color)",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  padding: "0 20px"
                }} 
                value={details.pan} 
                onChange={e => { setDetails(p => ({ ...p, pan: e.target.value.toUpperCase() })); setErrors({}); }} 
                maxLength={10} 
              />
              {errors.pan && <p className="input-error" style={{ color: "var(--wise-danger)", fontSize: "0.85rem", marginTop: 8, fontWeight: 600 }}>{errors.pan}</p>}
            </div>
          )}
          {selected === "aadhaar" && (
            <div className="input-group">
              <label style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 700, marginBottom: "8px", display: "block" }}>
                Aadhaar Number <span style={{ color: "var(--wise-danger)" }}>*</span>
              </label>
              <input 
                className="input-field" 
                placeholder="0000 0000 0000" 
                style={{ 
                  letterSpacing: "4px", 
                  fontWeight: 700,
                  height: "56px",
                  borderRadius: "16px",
                  border: "1.5px solid var(--border-color)",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  padding: "0 20px"
                }} 
                value={details.aadhaar} 
                onChange={e => { setDetails(p => ({ ...p, aadhaar: e.target.value.replace(/\D/g, "") })); setErrors({}); }} 
                maxLength={12} 
              />
              {errors.aadhaar && <p className="input-error" style={{ color: "var(--wise-danger)", fontSize: "0.85rem", marginTop: 8, fontWeight: 600 }}>{errors.aadhaar}</p>}
            </div>
          )}
          {["passport", "dl"].includes(selected) && (
            <div className="input-group">
              <label style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 700, marginBottom: "8px", display: "block" }}>
                Document Number <span style={{ color: "var(--wise-danger)" }}>*</span>
              </label>
              <input 
                className="input-field" 
                placeholder="Enter number" 
                style={{ 
                  textTransform: "uppercase", 
                  fontWeight: 700,
                  height: "56px",
                  borderRadius: "16px",
                  border: "1.5px solid var(--border-color)",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  padding: "0 20px"
                }} 
                value={selected === "passport" ? details.passportNo : details.dlNo} 
                onChange={e => setDetails(p => ({ ...p, [selected === "passport" ? "passportNo" : "dlNo"]: e.target.value.toUpperCase() }))} 
              />
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button 
          className="btn-primary" 
          onClick={handleSubmit} 
          disabled={!selected} 
          style={{ height: "60px", borderRadius: "16px", fontSize: "1.1rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
        >
          Continue <ArrowRightIcon size={20} />
        </button>

        <button 
          className="btn-secondary" 
          onClick={prevStep} 
          style={{ height: "56px", borderRadius: "16px", fontWeight: 700, background: "var(--bg-card)", border: "1.5px solid var(--border-color)", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
        >
          <ArrowLeftIcon size={20} /> Back
        </button>
      </div>
    </div>
  );
}
