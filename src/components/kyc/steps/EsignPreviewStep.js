import { useKYC } from "@/context/KYCContext";
import { useState, useEffect } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import Logo from "../Logo";

export default function EsignPreviewStep() {
  const { identityDetails, identityMethod, personalDetails, selfie, signature, nextStep, prevStep, address, bankDetails, ocrData, applicationId, nomineeDetails, selfieDetails, financialProof, panUpload, documents } = useKYC();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  
  const getFullUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http") || path.startsWith("data:")) return path;
    return `${API_URL}${path}`;
  };

  const photoUrl = getFullUrl(selfie?.preview || selfieDetails?.preview || ocrData?.selfie_path);
  const sigUrl = getFullUrl(signature?.filePreview || signature?.preview);

  useEffect(() => {
    // PDF Generation has been removed as per user request.
    // The dummy form will no longer be visible.
    setLoading(false);
  }, []);

  const generatePdf = async () => {
    // Disabled PDF preview generation
  };

  return (
    <div className="container-md" style={{ paddingTop: "2vh", paddingBottom: "4vh", maxWidth: "1000px" }}>
      <div className="text-center animate-slide-up" style={{ marginBottom: 32 }}>
        <h1 className="text-section" style={{ fontSize: "2.4rem", fontWeight: 900, letterSpacing: "-0.5px", color: "var(--text-primary)" }}>Full Application Review</h1>
        <p className="text-body" style={{ color: "var(--text-secondary)", marginTop: "12px", fontWeight: 600 }}>Please review your generated application form before e-signing.</p>
      </div>

      <div className="pdf-container animate-slide-up" style={{ 
        background: "var(--bg-elevated)", 
        borderRadius: "32px", 
        border: "1.5px solid var(--border-color)", 
        padding: "40px",
        position: "relative",
        boxShadow: "0 20px 40px rgba(0,0,0,0.1)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "16px" }}>📄</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>Application Ready for eSign</h2>
          <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>Your details have been successfully recorded and your final application form has been generated securely on our servers.</p>
        </div>
        
        <div style={{ background: "var(--bg-card)", borderRadius: "16px", padding: "24px", border: "1px solid var(--border-color)" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "16px", color: "var(--text-primary)" }}>Verified Information</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "12px" }}>
            <li style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-secondary)", fontWeight: 600 }}>
              <span style={{ color: "var(--wise-positive)" }}>✓</span> Personal & Identity Details
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-secondary)", fontWeight: 600 }}>
              <span style={{ color: "var(--wise-positive)" }}>✓</span> Contact & Address
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-secondary)", fontWeight: 600 }}>
              <span style={{ color: "var(--wise-positive)" }}>✓</span> Bank & Nominee Information
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-secondary)", fontWeight: 600 }}>
              <span style={{ color: "var(--wise-positive)" }}>✓</span> Uploaded Documents & Signatures
            </li>
          </ul>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 32, maxWidth: "480px", marginLeft: "auto", marginRight: "auto" }}>
        <button 
          onClick={nextStep} 
          className="btn-primary" 
          style={{ height: "60px", borderRadius: "16px", fontSize: "1.1rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
        >
          Confirm & Proceed ➔
        </button>
        
        <button 
          onClick={prevStep} 
          className="btn-secondary" 
          style={{ height: "56px", borderRadius: "16px", fontWeight: 700, background: "var(--bg-card)", border: "1.5px solid var(--border-color)", color: "var(--text-secondary)" }}
        >
          Back
        </button>
      </div>
    </div>
  );
}
