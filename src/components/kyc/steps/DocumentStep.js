"use client";
import { useState, useRef } from "react";
import { useKYC } from "@/context/KYCContext";
import { FileTextIcon, ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon } from "../Icons";
import Logo from "../Logo";

export default function DocumentStep() {
  const { identityMethod, documents, ocrData, updateState, updateNested, nextStep, prevStep, addToast } = useKYC();
  const [frontPreview, setFrontPreview] = useState(documents.frontPreview || null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(ocrData.extractedAt ? ocrData : null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    
    const reader = new FileReader();
    reader.onload = (event) => {
      setFrontPreview(event.target.result);
      // Simulate OCR
      setExtracting(true);
      setTimeout(() => {
        const mock = { name: "John Doe", dob: "1990-01-01", idNumber: "ABCDE1234F", extractedAt: new Date().toISOString() };
        setExtracted(mock);
        setExtracting(false);
        addToast("Document data extracted successfully", "success");
      }, 2000);
    };
    reader.readAsDataURL(file);
  };

  const handleNext = () => {
    if (!frontPreview) { addToast("Please upload your document", "error"); return; }
    updateState({ documents: { ...documents, frontPreview } });
    updateNested("ocrData", extracted);
    nextStep();
  };

  return (
    <div className="container-sm" style={{ paddingTop: "6vh" }}>
      <div className="text-center animate-slide-up" style={{ marginBottom: 40 }}>
        
        <h2 className="text-title" style={{ fontSize: "2rem", marginBottom: 12 }}>Document Upload</h2>
        <p className="text-body">Upload a clear photo of the front side of your {identityMethod.toUpperCase()}.</p>
      </div>

      <div className="glass-card animate-slide-up" style={{ padding: 40, marginBottom: 32, textAlign: "center" }}>
        {!frontPreview ? (
          <div 
            onClick={() => fileInputRef.current.click()}
            style={{ 
              border: "2px dashed var(--border-color)", borderRadius: "var(--radius-md)", 
              padding: "60px 20px", cursor: "pointer", transition: "all 0.3s ease"
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = "var(--wise-green)"}
            onMouseOut={e => e.currentTarget.style.borderColor = "var(--border-color)"}
          >
            <div style={{ color: "var(--text-muted)", marginBottom: 16 }}><FileTextIcon size={48} /></div>
            <p className="text-body-bold">Click to upload or drag & drop</p>
            <p className="text-caption">High resolution JPG, PNG or PDF (max 5MB)</p>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: "none" }} accept="image/*,application/pdf" />
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <img src={frontPreview} alt="Preview" style={{ width: "100%", borderRadius: "var(--radius-md)", maxHeight: 300, objectFit: "cover" }} />
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => { setFrontPreview(null); setExtracted(null); }}
              style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.9)", border: "none" }}
            >
              Replace
            </button>
            {extracting && (
              <div style={{ 
                position: "absolute", inset: 0, background: "rgba(255,255,255,0.7)", 
                borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", 
                alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" 
              }}>
                <div className="animate-spin" style={{ width: 40, height: 40, border: "3px solid var(--wise-green)", borderTopColor: "transparent", borderRadius: "50%", marginBottom: 16 }}></div>
                <p className="text-body-bold">Analyzing document...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {extracted && !extracting && (
        <div className="card animate-slide-up" style={{ padding: 24, marginBottom: 32, borderLeft: "4px solid var(--wise-green)" }}>
          <div className="flex items-center gap-sm" style={{ marginBottom: 16, color: "var(--wise-positive)" }}>
            <CheckCircleIcon size={20} />
            <span className="text-body-bold" style={{ fontSize: "0.9rem" }}>Information Extracted</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <p className="text-caption">Name</p>
              <p className="text-body-bold" style={{ fontSize: "0.95rem" }}>{extracted.name}</p>
            </div>
            <div>
              <p className="text-caption">ID Number</p>
              <p className="text-body-bold" style={{ fontSize: "0.95rem" }}>{extracted.idNumber}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-md">
        <button className="btn btn-secondary" onClick={prevStep} style={{ flex: 1, padding: "16px" }}>
          <ArrowLeftIcon size={20} /> Back
        </button>
        <button className="btn btn-primary" onClick={handleNext} disabled={extracting} style={{ flex: 2, padding: "16px" }}>
          Continue <ArrowRightIcon size={20} />
        </button>
      </div>
    </div>
  );
}
