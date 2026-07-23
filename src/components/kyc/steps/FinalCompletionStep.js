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
      <style>{`
        .success-checkmark {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: block;
          stroke-width: 4;
          stroke: var(--wise-green, #22c55e);
          stroke-miterlimit: 10;
          margin: 0 auto 24px auto;
          box-shadow: inset 0px 0px 0px var(--wise-green, #22c55e);
          animation: fill 0.4s ease-in-out 0.4s forwards, scale 0.3s ease-in-out 0.9s both;
        }
        .success-checkmark__circle {
          stroke-dasharray: 166;
          stroke-dashoffset: 166;
          stroke-width: 4;
          stroke-miterlimit: 10;
          stroke: var(--wise-green, #22c55e);
          fill: none;
          animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }
        .success-checkmark__check {
          transform-origin: 50% 50%;
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
        }
        @keyframes stroke { 100% { stroke-dashoffset: 0; } }
        @keyframes scale { 0%, 100% { transform: none; } 50% { transform: scale3d(1.1, 1.1, 1); } }
        @keyframes fill { 100% { box-shadow: inset 0px 0px 0px 30px rgba(34, 197, 94, 0.1); } }
        
        .glass-card {
          background: var(--bg-card);
          border-radius: 32px;
          padding: 64px 40px;
          border: 1px solid var(--border-color);
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.08);
          max-width: 500px;
          width: 100%;
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .glass-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 40px 80px rgba(0, 0, 0, 0.12);
        }
        
        .btn-interactive {
          transition: all 0.2s ease-in-out;
        }
        .btn-interactive:hover:not(:disabled) {
          transform: scale(1.03);
        }
        .btn-interactive:active:not(:disabled) {
          transform: scale(0.97);
        }
      `}</style>

      <div className="glass-card animate-slide-up text-center">
        
        {/* Animated SVG Checkmark */}
        <svg className="success-checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
          <circle className="success-checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
          <path className="success-checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
        </svg>

        <h1 className="text-section" style={{ marginBottom: 16, fontSize: "2.4rem", color: "var(--text-primary)", fontWeight: 900, letterSpacing: "-0.5px" }}>
          e-Sign Successful
        </h1>

        <div style={{ width: "60px", height: "4px", background: "var(--wise-green)", borderRadius: "4px", margin: "0 auto 24px" }}></div>

        {/* Description */}
        <p className="text-body" style={{ marginBottom: 16, fontSize: "1.2rem", fontWeight: 700, color: "var(--text-secondary)" }}>
          Your KYC journey is complete!
        </p>

        <p className="text-body" style={{ marginBottom: 32, fontSize: "1.05rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
          Our team will verify your documents shortly. You'll receive a confirmation email once your account is fully active.
        </p>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
          <button 
            onClick={() => handleDownloadPdf(false)}
            disabled={isDownloading}
            className="btn-interactive"
            style={{ 
              padding: "16px 40px", 
              borderRadius: "16px", 
              fontSize: "1.1rem", 
              fontWeight: 800,
              width: "100%",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              border: "1.5px solid var(--border-color)",
              cursor: isDownloading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              opacity: isDownloading ? 0.7 : 1
            }}
          >
            {isDownloading ? (
              <>
                <div className="loader" style={{ width: "20px", height: "20px", border: "3px solid var(--border-color)", borderTop: "3px solid var(--text-primary)" }}></div>
                Downloading...
              </>
            ) : (
              <>Download PDF ↓</>
            )}
          </button>

          <button 
            onClick={() => {
              resetKYC();
              window.location.href = "/";
            }}
            className="btn-interactive"
            style={{ 
              padding: "16px 40px", 
              borderRadius: "16px", 
              fontSize: "1.1rem", 
              fontWeight: 800,
              background: "var(--text-primary)",
              color: "var(--bg-primary)",
              border: "none",
              cursor: "pointer",
              width: "100%",
            }}
          >
            Logout Session
          </button>
        </div>
      </div>
    </div>
  );
}
