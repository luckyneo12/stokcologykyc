"use client";
import { useState, useEffect } from "react";
import { useKYC } from "@/context/KYCContext";

export default function NomineeAllocationStep() {
  const { nomineeDetails, nomineeAllocation, updateNested, nextStep, prevStep, addToast } = useKYC();
  
  const nominees = nomineeDetails.nominees || [];
  // Function to calculate equal split
  const getEqualSplit = (count) => {
    if (count === 1) return [100];
    if (count === 2) return [50, 50];
    if (count === 3) return [34, 33, 33];
    return Array(count).fill(Math.floor(100 / count));
  };

  const [percentages, setPercentages] = useState(() => {
    const existing = nomineeAllocation?.percentages || [];
    const totalExisting = existing.reduce((sum, v) => sum + (parseInt(v) || 0), 0);
    
    // Use existing only if it matches count AND is valid 100%
    if (existing.length === nominees.length && totalExisting === 100) {
      return existing;
    }

    if (nominees.length === 1) {
      return [100];
    }
    
    return Array(nominees.length).fill("");
  });

  // Re-calculate if nominees count changes
  useEffect(() => {
    if (percentages.length !== nominees.length) {
      setPercentages(nominees.length === 1 ? [100] : Array(nominees.length).fill(""));
    }
  }, [nominees.length]);

  const total = percentages.reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  const isValid = total === 100;

  const update = (idx, value) => {
    const rawVal = value.replace(/[^0-9]/g, "");
    if (rawVal.length > 3) return;
    
    let val = rawVal === "" ? "" : parseInt(rawVal, 10);
    if (val !== "" && val > 100) val = 100;
    
    const updated = [...percentages];
    updated[idx] = val;

    if (val !== "") {
      if (nominees.length === 2) {
        const otherIdx = idx === 0 ? 1 : 0;
        updated[otherIdx] = 100 - val;
      } else if (nominees.length === 3) {
        // Proportional adjustment for 3 nominees
        const others = [0, 1, 2].filter(i => i !== idx);
        const remaining = 100 - val;
        const currentOthersSum = (parseInt(percentages[others[0]]) || 0) + (parseInt(percentages[others[1]]) || 0);
        
        if (currentOthersSum > 0) {
          updated[others[0]] = Math.round(((parseInt(percentages[others[0]]) || 0) / currentOthersSum) * remaining);
          updated[others[1]] = remaining - updated[others[0]];
        } else {
          updated[others[0]] = Math.floor(remaining / 2);
          updated[others[1]] = remaining - updated[others[0]];
        }
      }
    }

    setPercentages(updated);
  };

  const distributeEqually = () => {
    if (nominees.length === 1) setPercentages([100]);
    else if (nominees.length === 2) setPercentages([50, 50]);
    else if (nominees.length === 3) setPercentages([34, 33, 33]);
  };

  const handleNext = () => {
    if (!isValid) {
      addToast(`Total allocation must be exactly 100% (Current: ${total}%)`, "error");
      return;
    }
    nextStep({ nomineeAllocation: { percentages } });
  };

  if (nomineeDetails.opted === "No") {
    return (
      <div className="container-sm" style={{ paddingTop: "6vh", paddingBottom: "6vh", maxWidth: "500px" }}>
        <div className="text-center animate-slide-up" style={{ marginBottom: 32 }}>
          <h1 className="text-section" style={{ fontSize: "2rem", fontWeight: 900 }}>Nominee Allocation</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontWeight: 600 }}>Proceed to continue</p>
        </div>
        <div className="card animate-slide-up" style={{ padding: "40px", borderRadius: "32px", textAlign: "center", border: "1.5px solid var(--border-color)" }}>
          <p style={{ marginBottom: "32px", color: "var(--text-primary)", fontWeight: 700, fontSize: "1rem" }}>No allocation required for opted-out nominees.</p>
          <button className="btn btn-primary" onClick={handleNext} style={{ width: "100%", borderRadius: "16px", height: "56px" }}>Continue</button>
          <button className="btn btn-secondary" onClick={prevStep} style={{ width: "100%", borderRadius: "16px", height: "56px", marginTop: "12px" }}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-sm" style={{ paddingTop: "2vh", paddingBottom: "4vh", maxWidth: "500px" }}>
      <div className="text-center animate-slide-up" style={{ marginBottom: 32 }}>
        <h1 className="text-section" style={{ fontSize: "2.4rem", fontWeight: 900, letterSpacing: "-1px" }}>Nominee Allocation</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontSize: "0.95rem", fontWeight: 600, lineHeight: 1.4 }}>
          Distribute your investment among nominees by assigning percentages.
        </p>
      </div>

      <div className="card animate-slide-up" style={{ padding: "32px", borderRadius: "32px", border: "1.5px solid var(--border-color)", background: "var(--bg-card)" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)" }}>Nominee Distribution</span>
          {nominees.length > 1 && (
            <button 
              onClick={distributeEqually}
              style={{ background: "transparent", border: "none", color: "var(--wise-positive)", fontSize: "0.8rem", fontWeight: 800, cursor: "pointer", textDecoration: "underline" }}
            >
              Distribute Equally
            </button>
          )}
        </div>

        {nominees.map((nom, idx) => (
          <div key={idx} style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "0.75rem", color: "var(--text-primary)", fontWeight: 700, marginBottom: "8px", display: "block", opacity: 0.8 }}>
              {nom.name || `Nominee ${idx + 1}`}
            </label>
            <div style={{ position: "relative" }}>
              <input 
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={percentages[idx]}
                onChange={(e) => update(idx, e.target.value)}
                style={{ 
                  width: "100%", height: "48px", padding: "0 40px 0 16px", fontSize: "1.1rem", fontWeight: 800,
                  border: "1.5px solid", 
                  borderColor: isValid ? "var(--border-color)" : total > 100 ? "var(--wise-danger)" : "var(--border-color)",
                  borderRadius: "12px", outline: "none", background: "var(--input-bg)", color: "var(--text-primary)",
                  transition: "all 0.2s"
                }}
                onFocus={e => e.target.style.borderColor = "var(--wise-green)"}
                onBlur={e => e.target.style.borderColor = isValid ? "var(--border-color)" : total > 100 ? "var(--wise-danger)" : "var(--border-color)"}
              />
              <span style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", fontSize: "1rem", fontWeight: 800 }}>%</span>
            </div>
          </div>
        ))}

        <div style={{ 
          background: isValid ? "var(--wise-light-mint)" : total > 100 ? "rgba(208, 50, 56, 0.05)" : "rgba(255, 209, 26, 0.05)", 
          border: "1.2px solid",
          borderColor: isValid ? "var(--wise-green)" : total > 100 ? "var(--wise-danger)" : "var(--wise-warning)",
          borderRadius: "16px", padding: "16px", marginBottom: "24px", textAlign: "center",
          transition: "all 0.3s ease"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            {!isValid && (
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: total > 100 ? "var(--wise-danger)" : "var(--wise-warning)" }}>
                 <circle cx="12" cy="12" r="10"></circle>
                 <line x1="12" y1="8" x2="12" y2="12"></line>
                 <line x1="12" y1="16" x2="12.01" y2="16"></line>
               </svg>
            )}
            <span style={{ 
              color: isValid ? "var(--wise-dark-green)" : "var(--text-primary)", 
              fontSize: "0.85rem", fontWeight: 800 
            }}>
              {isValid ? "Correctly Allocated" : `Total must be 100% (Current: ${total}%)`}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button 
            className="btn btn-primary" 
            onClick={handleNext} 
            style={{ 
              width: "100%", height: "56px", borderRadius: "16px", fontSize: "1.1rem", fontWeight: 900
            }}
          >
            Submit
          </button>
          
          <button className="btn btn-secondary" onClick={prevStep} style={{ width: "100%", height: "56px", borderRadius: "16px", fontSize: "1.1rem", fontWeight: 900 }}>
            Back
          </button>
        </div>

      </div>
    </div>
  );
}
