"use client";
import { useState, useEffect } from "react";
import { useCorrection } from "@/context/CorrectionContext";
import PdfMobileViewer from "../../PdfMobileViewer";
import { initializeDigio, fetchDigioRequestResponse, createDigioRequest } from "@/utils/digio";

export default function CorrectionEsignStep() {
  const { applicationData, drafts, token, addToast } = useCorrection();
  
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState("preview"); // preview, digio, processing, success, error

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  useEffect(() => {
    fetchLatestDataAndGeneratePdf();
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, []);

  const fetchLatestDataAndGeneratePdf = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 1. Use the application data from the correction context
      const app = applicationData;
      if (!app) throw new Error("Application data not available");

      // 2. Generate PDF with the latest data and merged drafts
      const safeParse = (val) => {
        if (typeof val !== 'string') return val;
        try { return JSON.parse(val || "{}"); } catch(e) { return val; }
      };

      const mergedApp = {
        personalDetails: safeParse(app.personalDetails),
        identityDetails: safeParse(app.identityDetails),
        address: safeParse(app.address),
        bankDetails: safeParse(app.bankDetails),
        nomineeDetails: safeParse(app.nomineeDetails),
        ocrData: safeParse(app.ocrData),
        selfieDetails: safeParse(app.selfieDetails),
        documents: safeParse(app.documents),
        panUpload: app.panUpload,
        financialProof: app.financialProof,
        selfie: app.selfie,
        signature: app.signature,
        applicationId: app.applicationId,
      };

      Object.entries(drafts || {}).forEach(([stepId, draftData]) => {
         if (!draftData) return;
         if (stepId === 'digilocker') {
            if (draftData.identityDetails) mergedApp.identityDetails = { ...mergedApp.identityDetails, ...draftData.identityDetails };
            if (draftData.address) mergedApp.address = { ...mergedApp.address, ...draftData.address };
            if (draftData.personalDetails) mergedApp.personalDetails = { ...mergedApp.personalDetails, ...draftData.personalDetails };
         } else if (stepId === 'pricingSelection') {
            mergedApp.segments = draftData.segments;
            mergedApp.bsda = draftData.bsda;
         } else if (stepId === 'personalDetails' || stepId === 'pepProof') {
            mergedApp.personalDetails = { ...mergedApp.personalDetails, ...draftData };
         } else if (stepId === 'bankVerification') {
            mergedApp.bankDetails = { ...mergedApp.bankDetails, ...draftData };
         } else if (stepId === 'nomineeChoice' || stepId === 'nomineeDetails' || stepId.startsWith('nominee') || stepId.startsWith('guardian')) {
            if (stepId === 'nomineeAllocation') mergedApp.nomineeAllocation = draftData;
            else mergedApp.nomineeDetails = { ...mergedApp.nomineeDetails, ...draftData };
         } else if (stepId === 'panVerification') {
            mergedApp.identityDetails = { ...mergedApp.identityDetails, ...draftData };
         } else if (stepId === 'financialProof') {
            mergedApp.financialProof = draftData;
         } else if (stepId === 'signature') {
            mergedApp.signature = draftData;
         } else if (stepId === 'panUpload') {
            mergedApp.panUpload = draftData;
         } else if (stepId === 'ipv') {
            mergedApp.selfieDetails = { ...mergedApp.selfieDetails, ...draftData };
            // Ensure old photo fields don't override the new selfie preview
            if (draftData.preview) {
               delete mergedApp.selfieDetails.filePreview;
               delete mergedApp.selfieDetails.path;
            }
         }
      });

      mergedApp.previewOnly = true;

      const pdfRes = await fetch(`${API_URL}/api/kyc/preview-pdf`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(mergedApp)
      });
      
      const pdfData = await pdfRes.json();
      if (!pdfData.success) throw new Error(pdfData.error || "Failed to generate PDF");
      
      const byteCharacters = atob(pdfData.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      setPdfUrl(objectUrl);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load PDF preview");
      setLoading(false);
    }
  };

  const handleDigioSuccess = async (requestId) => {
    setPhase("processing");
    try {
      const result = await fetchDigioRequestResponse(requestId, "ESIGN", applicationData?.applicationId);
      if (!result) throw new Error("Could not verify eSign response. Please try again.");
      
      // Hit submit to finalize
      const submitRes = await fetch(`${API_URL}/api/kyc/correction/complete`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ esignCompleted: true })
      });
      const submitData = await submitRes.json();
      
      if (!submitData.success) {
        throw new Error("Failed to finalize application");
      }
      
      setPhase("success");
    } catch (err) {
      addToast(err.message || "e-Sign verification failed", "error");
      setPhase("error");
    }
  };

  const startDigioEsign = async () => {
    setPhase("digio");
    try {
      let currentDigioDocumentId = null;

      const digio = initializeDigio({
        environment: process.env.NEXT_PUBLIC_DIGIO_ENV || "production",
        logoUrl: "https://stockologysecurities.com/images/logo.png",
        theme: { primaryColor: "#9fe870", secondaryColor: "#1a1a2e" },
        callback: (response) => {
          if (response.hasOwnProperty("error_code") || response.message === "cancelled") {
            addToast(response.message || "e-Sign failed or cancelled", "error");
            setPhase("error");
            return;
          }
          handleDigioSuccess(response.digio_doc_id || response.id || currentDigioDocumentId);
        }
      });
      
      if (!digio) throw new Error("Digio SDK not loaded.");

      if (!digio.is_redirection_approach) {
        digio.init();
      }

      const requestData = await createDigioRequest("ESIGN", { lat: null, lng: null }, applicationData?.applicationId);
      if (!requestData?.id && !requestData?.requestId) {
        throw new Error("Failed to initialize e-Sign request");
      }

      const digioDocumentId = requestData.id || requestData.requestId;
      currentDigioDocumentId = digioDocumentId;

      const email = typeof applicationData?.personalDetails === 'string' ? JSON.parse(applicationData.personalDetails)?.email : applicationData?.personalDetails?.email;
      const phone = typeof applicationData?.personalDetails === 'string' ? JSON.parse(applicationData.personalDetails)?.phone : applicationData?.personalDetails?.phone;
      
      let rawIdentifier = phone || email || "user@example.com";
      const fallbackIdentifier = rawIdentifier.replace(/\D/g, '').length >= 10 
        ? rawIdentifier.replace(/\D/g, '').slice(-10) 
        : rawIdentifier;

      const identifier = requestData.customerIdentifier || fallbackIdentifier;
        
      if (requestData.accessToken) {
        digio.submit(digioDocumentId, identifier, requestData.accessToken);
      } else {
        digio.submit(digioDocumentId, identifier);
      }
    } catch (err) {
      addToast(err.message || "Failed to connect to Digio", "error");
      setPhase("error");
    }
  };

  if (phase === "success") {
    return (
      <div className="step-card" style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", padding: "48px 36px" }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--wise-green), #6fcf97)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px", boxShadow: "0 8px 32px rgba(159, 232, 112, 0.3)"
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 style={{ color: "var(--text-primary)", fontSize: "1.3rem", fontWeight: 800, marginBottom: 12 }}>
          e-Sign Completed Successfully!
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
          Your application with all the updated details has been successfully signed and submitted. 
          Our team will review your application shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="container-lg" style={{ paddingTop: "2vh", paddingBottom: "4vh", maxWidth: "1000px", margin: "0 auto", paddingLeft: "24px", paddingRight: "24px" }}>
      <div className="text-center animate-slide-up" style={{ marginBottom: 32 }}>
        <h1 className="text-section" style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-1px", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          e-Sign Updated Application
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontWeight: 600 }}>
          Review your new PDF and sign it with Aadhaar to finalize your corrections.
        </p>
      </div>

      <div className="step-card" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px", alignItems: "center" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <div className="loading-spinner" style={{ margin: "0 auto 16px" }}></div>
            <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>Generating your updated PDF...</p>
          </div>
        ) : error && !pdfUrl ? (
          <div style={{ textAlign: "center", padding: "32px", background: "rgba(239, 68, 68, 0.05)", borderRadius: 12, border: "1px solid rgba(239, 68, 68, 0.2)", width: "100%" }}>
            <p style={{ color: "#ef4444", fontWeight: 700, marginBottom: 16 }}>{error}</p>
            <button onClick={fetchLatestDataAndGeneratePdf} className="btn-primary" style={{ padding: "10px 20px" }}>Retry</button>
          </div>
        ) : (
          <>
            <div style={{ width: "100%", maxWidth: "800px", height: "65vh", border: "1px solid var(--border-color)", borderRadius: 12, overflowY: "auto", background: "#f8f9fa", position: "relative" }}>
              <PdfMobileViewer url={pdfUrl} hideActions={true} />
            </div>

            {(phase === "digio" || phase === "processing") ? (
              <div style={{ textAlign: "center", width: "100%", padding: 24, background: "rgba(159, 232, 112, 0.1)", borderRadius: 12 }}>
                <div className="loading-spinner" style={{ margin: "0 auto 16px" }}></div>
                <p style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {phase === "digio" ? "Waiting for Digio e-Sign completion..." : "Verifying your e-Sign and submitting..."}
                </p>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: 8 }}>Please do not close this window.</p>
              </div>
            ) : (
              <button 
                onClick={startDigioEsign}
                className="btn-primary"
                style={{
                  width: "100%", maxWidth: "400px", padding: "16px", borderRadius: 12,
                  fontSize: "1.05rem", fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  boxShadow: "0 8px 24px rgba(159,232,112,0.25)"
                }}
              >
                Proceed to Aadhaar e-Sign
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
