import { useKYC } from "@/context/KYCContext";
import { useState, useEffect } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import Logo from "../Logo";

export default function EsignPreviewStep() {
  const { user, identityDetails, identityMethod, personalDetails, selfie, signature, nextStep, prevStep, address, bankDetails, ocrData, applicationId, nomineeDetails, selfieDetails, financialProof, panUpload, documents } = useKYC();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  
  const getFullUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http") || path.startsWith("data:") || path.startsWith("blob:")) return path;
    return `${API_URL}${path}`;
  };

  const photoUrl = getFullUrl(selfie?.preview || selfieDetails?.preview || ocrData?.selfie_path);
  const sigUrl = getFullUrl(signature?.filePreview || signature?.preview);

  useEffect(() => {
    generatePdf();
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, []);

  const generatePdf = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = typeof window !== "undefined" ? (sessionStorage.getItem("kycToken") || sessionStorage.getItem("adminToken") || localStorage.getItem("token")) : "";
      
      const res = await fetch(`${API_URL}/api/kyc/preview-pdf`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          personalDetails, identityDetails, address, bankDetails, nomineeDetails, ocrData, selfieDetails, documents, panUpload, financialProof
        })
      });
      
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to generate PDF");
      
      const byteCharacters = atob(data.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      
      setPdfUrl(URL.createObjectURL(blob));
      setLoading(false);
    } catch (err) {
      console.error("Preview error:", err);
      setError(err.message);
      setLoading(false);
    }
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
        overflow: "hidden", 
        minHeight: "70vh", 
        position: "relative",
        boxShadow: "0 20px 40px rgba(0,0,0,0.1)"
      }}>
        {loading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg-card)", zIndex: 10 }}>
            <div className="loader" style={{ marginBottom: 24, width: "48px", height: "48px", border: "4px solid var(--border-color)", borderTop: "4px solid var(--wise-green)" }}></div>
            <p style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "1.2rem" }}>Preparing Documents...</p>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginTop: "8px", fontWeight: 600 }}>Merging 55 Pages + Annexure</p>
          </div>
        )}

        {error && (
          <div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "var(--wise-danger)", fontSize: "3rem", marginBottom: 20 }}>!</div>
            <p style={{ color: "var(--text-primary)", fontWeight: 800, fontSize: "1.2rem" }}>Failed to generate preview</p>
            <p style={{ color: "var(--text-secondary)", marginTop: 8, marginBottom: 32 }}>{error}</p>
            <button 
              onClick={generatePdf} 
              className="btn-primary" 
              style={{ padding: "14px 40px", borderRadius: "16px", fontWeight: 800 }}
            >
              Retry Generation
            </button>
          </div>
        )}

        {pdfUrl && (
          <iframe 
            src={`${pdfUrl}#toolbar=0`} 
            style={{ width: "100%", height: "70vh", border: "none" }} 
            title="KYC Preview" 
          />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 32, maxWidth: "480px", marginLeft: "auto", marginRight: "auto" }}>
        {pdfUrl && (
          <a 
            href={pdfUrl}
            download={`KYC_Application_${personalDetails?.fullName ? personalDetails.fullName.replace(/\s+/g, '_') : 'Form'}.pdf`}
            className="btn-secondary"
            style={{ height: "60px", borderRadius: "16px", fontSize: "1.1rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "var(--bg-elevated)", border: "1.5px solid var(--border-color)", color: "var(--text-primary)", textDecoration: "none" }}
          >
            Download PDF ↓
          </a>
        )}

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
