"use client";
import { useState, useEffect } from "react";
import { useKYC } from "@/context/KYCContext";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import Logo from "../Logo";

export default function NomineeChoiceStep() {
  const { nomineeDetails, updateNested, nextStep, prevStep, goToStep, currentStep } = useKYC();
  const [opted, setOpted, clearOptedDraft] = useLocalDraft("nomineeOpted", nomineeDetails?.opted || "No");
  const [confirmed, setConfirmed, clearConfirmedDraft] = useLocalDraft("nomineeConfirmed", false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (nomineeDetails.opted && nomineeDetails.opted !== opted) {
      setOpted(nomineeDetails.opted);
    }
  }, [nomineeDetails.opted]);

  const handleNext = () => {
    if (opted === "No" && !confirmed) return;

    clearOptedDraft();
    clearConfirmedDraft();
    const updates = { nomineeDetails: { ...nomineeDetails, opted } };
    if (opted === "No") {
      // Skip Nominee and Allocation steps
      goToStep(currentStep + 3, updates);
    } else {
      nextStep(updates);
    }
  };

  if (!mounted) return null;

  return (
    <div className="container-sm" style={{ paddingTop: "6vh", paddingBottom: "6vh", maxWidth: 500 }}>
      <div className="text-center animate-slide-up" style={{ marginBottom: 32 }}>
        <h1 className="text-section" style={{ fontSize: "2.2rem", marginBottom: 8 }}>Add Nominee</h1>
      </div>

      <div className="animate-slide-up" style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", gap: "20px" }}>
          <div 
            onClick={() => setOpted("Yes")}
            style={{ 
              flex: 1, display: "flex", alignItems: "center", gap: "16px", padding: "20px", 
              borderRadius: "16px", border: `1.5px solid ${opted === "Yes" ? "var(--text-primary)" : "var(--border-color)"}`, 
              background: "var(--bg-elevated)", cursor: "pointer", transition: "all var(--transition-fast)"
            }}
            className="hover-scale"
          >
            <div style={{ 
              width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--text-primary)", 
              display: "flex", alignItems: "center", justifyContent: "center" 
            }}>
              {opted === "Yes" && <div style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--text-primary)" }} />}
            </div>
            <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>Yes</span>
          </div>

          <div 
            onClick={() => setOpted("No")}
            style={{ 
              flex: 1, display: "flex", alignItems: "center", gap: "16px", padding: "20px", 
              borderRadius: "16px", border: `1.5px solid ${opted === "No" ? "var(--text-primary)" : "var(--border-color)"}`, 
              background: "var(--bg-elevated)", cursor: "pointer", transition: "all var(--transition-fast)"
            }}
            className="hover-scale"
          >
            <div style={{ 
              width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--border-color)", 
              display: "flex", alignItems: "center", justifyContent: "center" 
            }}>
              {opted === "No" && <div style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--text-primary)" }} />}
            </div>
            <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)" }}>No</span>
          </div>
        </div>

        {opted === "No" && (
          <div className="animate-slide-up" style={{ 
            padding: "24px", 
            borderRadius: "16px", 
            background: "var(--input-bg)", 
            border: "1px solid var(--border-color)",
            marginTop: "24px"
          }}>
            <label style={{ display: "flex", gap: "16px", cursor: "pointer" }}>
              <input 
                type="checkbox" 
                checked={confirmed} 
                onChange={(e) => setConfirmed(e.target.checked)}
                style={{ marginTop: "4px", minWidth: "20px", width: "20px", height: "20px", accentColor: "black" }}
              />
              <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5, fontWeight: 500 }}>
                I/We hereby confirm that I/We do not wish to appoint any nominee(s) in my demat/trading account and understand the issues involved in non-appointment of nominee(s) and further are aware that in case of death of all the account holder(s), my/our legal heirs would need to submit all the requisite documents/information for claiming of assets held in my/our demat/trading account, which may also include documents issued by court or other such competent authority, based on the value of assets held in the demat/trading account.
              </span>
            </label>
          </div>
        )}
      </div>

      <div className="animate-slide-up" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <button 
          className="btn btn-primary"
          onClick={handleNext}
          disabled={opted === "No" && !confirmed}
          style={{ 
            width: "320px", 
            minHeight: "56px",
            padding: "16px", 
            fontSize: "1.1rem",
            backgroundColor: "var(--wise-green)",
            color: "var(--wise-black)",
            borderRadius: "100px",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: (opted === "No" && !confirmed) ? "not-allowed" : "pointer"
          }}
        >
          Submit
        </button>
        <button onClick={prevStep} className="btn-back">
          Back
        </button>
      </div>
    </div>
  );
}
