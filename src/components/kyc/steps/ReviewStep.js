"use client";
import { useState } from "react";
import { useKYC } from "@/context/KYCContext";
import { ShieldIcon, ArrowLeftIcon, CheckCircleIcon } from "../Icons";
import Logo from "../Logo";

export default function ReviewStep() {
  const { personalDetails, identityMethod, identityDetails, address, selfie, updateState, nextStep, prevStep, addToast } = useKYC();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const sections = [
    { title: "Personal Details", data: [
      { label: "Full Name", value: personalDetails.fullName },
      { label: "Date of Birth", value: personalDetails.dob },
      { label: "Gender", value: personalDetails.gender === "1" ? "Male" : personalDetails.gender === "2" ? "Female" : "Other" }
    ]},
    { title: "Identity", data: [
      { label: "Document Type", value: identityMethod.toUpperCase() },
      { label: "Document Number", value: identityDetails.pan || identityDetails.aadhaar || identityDetails.passportNo || identityDetails.dlNo }
    ]},
    { title: "Address", data: [
      { label: "Primary Address", value: `${address.line1}, ${address.city}, ${address.state} ${address.pincode}` }
    ]}
  ];

  const handleSubmit = () => {
    if (!agreed) { addToast("Please accept the declaration", "error"); return; }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      updateState({ status: "verified", submittedAt: new Date().toISOString() });
      nextStep();
    }, 3000);
  };

  return (
    <div className="container-md" style={{ paddingTop: "6vh" }}>
      <div className="text-center animate-slide-up" style={{ marginBottom: 40 }}>
        
        <h2 className="text-title" style={{ fontSize: "2rem", marginBottom: 12 }}>Final Confirmation</h2>
        <p className="text-body">Review your information before secure submission.</p>
      </div>

      <div className="flex" style={{ gap: 32, flexWrap: "wrap", marginBottom: 48 }}>
        <div style={{ flex: "2 1 400px" }}>
          {sections.map((section, idx) => (
            <div key={idx} className="glass-card animate-slide-up" style={{ padding: 32, marginBottom: 24, animationDelay: `${idx * 0.1}s` }}>
              <h3 className="text-body-bold" style={{ fontSize: "1.1rem", marginBottom: 20, color: "var(--wise-green)" }}>{section.title}</h3>
              <div style={{ display: "grid", gap: 16 }}>
                {section.data.map((item, i) => (
                  <div key={i} className="flex justify-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border-color)" }}>
                    <span className="text-caption" style={{ fontWeight: 600 }}>{item.label}</span>
                    <span className="text-body-bold" style={{ fontSize: "0.95rem" }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ flex: "1 1 300px" }}>
          <div className="glass-card animate-slide-up" style={{ padding: 32, textAlign: "center", position: "sticky", top: 24 }}>
            {selfie.videoPath ? (
              <div style={{ width: "100%", borderRadius: "16px", overflow: "hidden", margin: "0 auto 24px", border: "4px solid var(--wise-green)" }}>
                <video src={selfie.videoPath} autoPlay loop muted playsInline style={{ width: "100%", display: "block" }} />
              </div>
            ) : (
              <div style={{ width: 120, height: 120, borderRadius: "50%", overflow: "hidden", margin: "0 auto 24px", border: "4px solid var(--wise-green)" }}>
                <img src={selfie.preview} alt="Selfie" style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
              </div>
            )}
            <p className="text-body-bold" style={{ marginBottom: 8 }}>Identity Authenticated</p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--wise-positive)", fontSize: "0.85rem", fontWeight: 700 }}>
              <CheckCircleIcon size={16} /> 92% Match Score
            </div>

            <hr style={{ margin: "24px 0", border: "none", borderTop: "1px solid var(--border-color)" }} />

            <div className="flex gap-sm items-start" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => setAgreed(!agreed)}>
              <div style={{ 
                width: 20, height: 20, borderRadius: 4, border: "2px solid var(--wise-green)", 
                flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center",
                background: agreed ? "var(--wise-green)" : "transparent"
              }}>
                {agreed && <CheckCircleIcon size={14} color="var(--wise-dark-green)" />}
              </div>
              <p className="text-caption" style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}>
                I hereby declare that the information provided is true and correct to the best of my knowledge.
              </p>
            </div>

            <button className="btn btn-primary w-full" onClick={handleSubmit} disabled={submitting} style={{ marginTop: 24, padding: "18px" }}>
              {submitting ? "Securing Data..." : "Finalize & Submit"}
            </button>
            <button className="btn btn-ghost w-full" onClick={prevStep} style={{ marginTop: 12, fontSize: "0.9rem" }}>Go Back</button>
          </div>
        </div>
      </div>
    </div>
  );
}
