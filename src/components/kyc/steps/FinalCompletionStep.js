"use client";
import { useEffect, useState } from "react";
import { useKYC } from "@/context/KYCContext";
import Logo from "../Logo";

export default function FinalCompletionStep() {
  const { resetKYC, applicationId } = useKYC();
  const [downloaded, setDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPdf = async (isAuto = false) => {
    if (!applicationId) return;
    
    const downloadKey = `kyc_pdf_downloaded_${applicationId}`;
    if (isAuto) {
      if (downloaded || sessionStorage.getItem(downloadKey)) return;
      setDownloaded(true);
      sessionStorage.setItem(downloadKey, "true");
    } else {
      setIsDownloading(true);
    }
    
    try {
      const token = sessionStorage.getItem("kycToken") || sessionStorage.getItem("token");
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const response = await fetch(`${API_BASE_URL}/api/kyc/download-pdf/${applicationId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `KYC_Application_${applicationId}_Signed.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("PDF download failed:", err);
    } finally {
      if (!isAuto) setIsDownloading(false);
    }
  };

  useEffect(() => {
    handleDownloadPdf(true);
  }, [applicationId, downloaded]);

  return (
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      padding: 24,
      background: "var(--bg-primary)"
    }}>
      <div className="card animate-slide-up text-center">
        
        {/* Success Banner */}
        <div style={{ fontSize: '4.5rem', marginBottom: 16 }}>✅</div>
        <h1 className="text-section" style={{ marginBottom: 24, fontSize: "2.2rem", color: "var(--wise-dark-green)" }}>
          e-Sign Successful!
        </h1>

        {/* Description */}
        <p className="text-body" style={{ marginBottom: 16, fontSize: "1.25rem", fontWeight: 600 }}>
          Your KYC journey is complete.
        </p>

        <p className="text-body" style={{ marginBottom: 24, fontSize: "1.1rem" }}>
          Our team will verify your documents shortly. You'll receive a confirmation email once your account is active.
        </p>
        
        <p className="text-body" style={{ marginBottom: 40, fontSize: "0.95rem", color: "var(--text-secondary)" }}>
          Your signed application PDF should download automatically.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
          <button 
            onClick={() => handleDownloadPdf(false)}
            disabled={isDownloading}
            className="btn-secondary"
            style={{ 
              padding: "16px 40px", 
              borderRadius: "16px", 
              fontSize: "1.1rem", 
              fontWeight: 800,
              width: "100%",
              maxWidth: "280px"
            }}
          >
            {isDownloading ? "Downloading..." : "Download PDF"}
          </button>

          <button 
            onClick={() => {
              resetKYC();
              window.location.href = "/";
            }}
            className="btn-primary"
            style={{ 
              padding: "16px 40px", 
              borderRadius: "16px", 
              fontSize: "1.1rem", 
              fontWeight: 800,
              background: "var(--text-primary)",
              color: "var(--bg-primary)",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
              width: "100%",
              maxWidth: "280px"
            }}
          >
            Logout Session
          </button>
        </div>
      </div>
    </div>
  );
}
