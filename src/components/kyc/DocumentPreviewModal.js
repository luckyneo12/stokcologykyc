import React from "react";
import { X as CloseIcon, ExternalLink } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function DocumentPreviewModal({ isOpen, onClose, documentUrl, documentType }) {
  if (!isOpen || !documentUrl) return null;

  const isPdf = documentUrl.toLowerCase().endsWith(".pdf") || documentType === "application/pdf" || documentUrl.startsWith("data:application/pdf");

  // For Cloudinary PDFs, route through our backend proxy so the iframe loads same-origin
  let iframeSrc = documentUrl;
  if (isPdf && documentUrl.startsWith("https://res.cloudinary.com/")) {
    const token = typeof window !== "undefined"
      ? (sessionStorage.getItem("kycToken") || sessionStorage.getItem("adminToken") || sessionStorage.getItem("token"))
      : null;
    iframeSrc = `${API_BASE}/api/kyc/proxy-pdf?url=${encodeURIComponent(documentUrl)}&token=${encodeURIComponent(token || "")}`;
  }

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.75)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      backdropFilter: "blur(4px)"
    }}>
      <div style={{
        background: "var(--bg-primary)",
        borderRadius: "16px",
        width: "100%",
        maxWidth: "800px",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
        animation: "slideUp 0.3s ease-out"
      }}>
        <div style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--bg-elevated)"
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>Document Preview</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {isPdf && (
              <a 
                href={documentUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", color: "var(--primary-color)", textDecoration: "none", fontWeight: 600, padding: "6px 12px", background: "var(--bg-secondary)", borderRadius: "6px" }}
              >
                <ExternalLink size={16} /> Open Full PDF
              </a>
            )}
            <button 
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "6px",
                borderRadius: "8px",
                transition: "background 0.2s"
              }}
              onMouseOver={(e) => e.currentTarget.style.background = "var(--bg-secondary)"}
              onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
            >
              <CloseIcon size={20} />
            </button>
          </div>
        </div>

        <div style={{
          padding: "24px",
          flex: 1,
          overflow: "auto",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "var(--bg-secondary)",
          position: "relative",
          minHeight: "200px"
        }}>
          {isPdf ? (
            <iframe 
              src={iframeSrc} 
              style={{ width: "100%", height: "60vh", border: "none", borderRadius: "8px", background: "#fff" }}
              title="PDF Preview"
            />
          ) : (
            <img 
              src={documentUrl} 
              alt="Document Preview" 
              style={{ maxWidth: "100%", maxHeight: "60vh", objectFit: "contain", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", background: "#fff" }} 
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; gap:12px; color:var(--text-secondary);"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><p style="margin:0; font-weight:500;">Failed to load image preview.</p><p style="margin:0; font-size:0.85rem;">The file might have been moved or deleted.</p></div>';
              }}
            />
          )}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
