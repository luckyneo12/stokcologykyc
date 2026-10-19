import { useKYC } from "@/context/KYCContext";
import { useState, useEffect } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import Logo from "../Logo";
// Continuous-scroll viewer; falls back to the previous PdfMobileViewer by itself on any failure
import PdfScrollViewer from "../PdfScrollViewer";
import { Check } from "lucide-react";
import "../pdf-preview.css";

// Shown one after another while the form is being built (just messages, not real progress)
const MERGE_STEPS = [
  "Collecting your details…",
  "Filling in your application form…",
  "Adding your documents…",
  "Merging everything into one PDF…",
  "Almost ready…",
];

export default function EsignPreviewStep() {
  const { user, identityDetails, identityMethod, personalDetails, selfie, signature, nextStep, prevStep, address, bankDetails, ocrData, applicationId, nomineeDetails, selfieDetails, financialProof, panUpload, documents, preGeneratedPdf, generatedPdfBase64 } = useKYC();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mergeStep, setMergeStep] = useState(0);

  // Rotate the waiting messages while the PDF is being prepared (stays on the last one)
  useEffect(() => {
    if (!loading) return;
    setMergeStep(0);
    const t = setInterval(() => setMergeStep((i) => Math.min(i + 1, MERGE_STEPS.length - 1)), 2800);
    return () => clearInterval(t);
  }, [loading]);

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

      let pdfBase64 = null; // FORCE FRESH PDF GENERATION FOR TESTING (generatedPdfBase64 || preGeneratedPdf);

      if (!pdfBase64) {
        console.log("[EsignPreview] No pre-generated PDF found, generating now...");
        const token = typeof window !== "undefined" ? (sessionStorage.getItem("kycToken") || localStorage.getItem("kycToken") || sessionStorage.getItem("adminToken") || localStorage.getItem("token")) : "";
        
        const res = await fetch(`${API_URL}/api/kyc/preview-pdf`, {
          method: 'POST',
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            personalDetails, identityDetails, address, bankDetails, nomineeDetails, ocrData, selfieDetails, documents, panUpload, financialProof, selfie, signature
          })
        });
        
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to generate PDF");
        pdfBase64 = data.pdfBase64;
      } else {
        console.log("[EsignPreview] Using instantly loaded pre-generated PDF!");
      }
      
      const byteCharacters = atob(pdfBase64);
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
        minHeight: "max(70vh, 500px)", 
        position: "relative",
        boxShadow: "0 20px 40px rgba(0,0,0,0.1)"
      }}>
        {loading && (
          <div className="pv-loading" role="status" aria-live="polite">
            <div className="pv-docs" aria-hidden="true">
              <div className="pv-sheet s1"><i /><i /><i /><i /></div>
              <div className="pv-sheet s3"><i /><i /><i /><i /></div>
              <div className="pv-sheet s2"><i /><i /><i /><i /></div>
              <span className="pv-docs-tick"><Check size={16} strokeWidth={3} /></span>
            </div>
            <p className="pv-loading-title">Merging your documents</p>
            <p key={mergeStep} className="pv-loading-step">{MERGE_STEPS[mergeStep]}</p>
            <div className="pv-bar" aria-hidden="true" />
            <p className="pv-loading-hint">Please wait a few seconds. Large uploads, like a long bank statement, can take a little longer.</p>
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

        {pdfUrl && <PdfScrollViewer url={pdfUrl} />}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 32, maxWidth: "480px", marginLeft: "auto", marginRight: "auto" }}>
        {pdfUrl && (
          <a 
            href={pdfUrl}
            download={`KYC_Application_${personalDetails?.fullName ? personalDetails.fullName.replace(/\s+/g, '_') : 'Form'}_${applicationId || ''}.pdf`}
            className="btn-secondary"
            style={{ height: "60px", borderRadius: "16px", fontSize: "1.1rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "var(--bg-elevated)", border: "1.5px solid var(--border-color)", color: "var(--text-primary)", textDecoration: "none" }}
          >
            Download PDF ↓
          </a>
        )}

        <button 
          onClick={() => nextStep()} 
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
