"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useKYC } from "@/context/KYCContext";
import { ArrowLeftIcon } from "../Icons";
import ImageCropper from "@/components/ui/ImageCropper";
import { initializeDigio, createDigioRequest, fetchDigioRequestResponse } from "@/utils/digio";
import { QRCode } from "react-qrcode-logo";
import { io } from "socket.io-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/** Detect if the current device is a mobile/tablet */
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16V4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M20 20H4" />
  </svg>
);

const CustomSelect = ({ value, onChange, options, placeholder, error, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} style={{ position: "relative", width: "100%" }}>
      <div 
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIsOpen(!isOpen); } 
          else if (e.key === "Escape") { setIsOpen(false); }
        }}
        className="input-field"
        style={{ 
          cursor: disabled ? "not-allowed" : "pointer",
          borderColor: error ? "var(--wise-danger)" : isOpen ? "var(--wise-green)" : "var(--border-color)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          opacity: disabled ? 0.6 : 1, padding: "0 16px", height: "56px", borderRadius: "12px",
          background: "var(--input-bg)", transition: "all 0.2s"
        }}
      >
        <span style={{ color: value ? "var(--text-primary)" : "var(--text-muted)", fontSize: "0.95rem", fontWeight: 600 }}>
          {value || placeholder}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", opacity: 0.7 }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      
      {isOpen && (
        <div style={{ 
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000, 
          background: "var(--bg-elevated)", border: "1.5px solid var(--border-color)", 
          borderRadius: "12px", marginTop: "4px", 
          boxShadow: "0 20px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)",
          maxHeight: "220px", overflowY: "auto", padding: "6px"
        }}>
          {options.map((opt) => (
            <div 
              key={opt} tabIndex={0}
              onClick={() => { onChange(opt); setIsOpen(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(opt); setIsOpen(false); } 
                else if (e.key === "Escape") { setIsOpen(false); }
              }}
              style={{ 
                padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 700,
                background: value === opt ? "var(--wise-green)" : "transparent",
                color: value === opt ? "var(--wise-dark-green)" : "var(--text-primary)",
                transition: "all 0.2s", marginBottom: "1px"
              }}
              onMouseOver={e => { if (value !== opt) e.currentTarget.style.background = "rgba(159, 232, 112, 0.15)"; }}
              onMouseOut={e => { if (value !== opt) e.currentTarget.style.background = "transparent"; }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function DocumentUploadStep() {
  const { 
    financialProof, signature, panUpload, selfie, personalDetails, 
    segments, bankDetails, updateState, nextStep, prevStep, addToast, 
    applicationId, setApplicationId, syncProgress,
    preGeneratePdf
  } = useKYC();
  
  // Helper to ensure relative URLs load from backend on port 5000
  const getFullUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Financial Proof State
  const [finType, setFinType] = useState(financialProof?.type || "");
  const [finPreview, setFinPreview] = useState(getFullUrl(financialProof?.filePreview));
  const finInputRef = useRef(null);

  // Bank Proof State
  const needsBankProof = bankDetails?.verified === false;
  const [bankProofPreview, setBankProofPreview] = useState(getFullUrl(bankDetails?.proofPreview || bankDetails?.proof));
  const [bankProofType, setBankProofType] = useState(bankDetails?.proofType || "");
  const bankOptions = ["Bank Statement", "Cancelled Cheque", "Passbook"];
  const bankProofInputRef = useRef(null);

  // Signature State
  const [sigPreview, setSigPreview] = useState(getFullUrl(signature?.filePreview));
  const [isCroppingSig, setIsCroppingSig] = useState(false);
  const [rawSigImage, setRawSigImage] = useState(null);
  const sigInputRef = useRef(null);

  // PAN Upload State
  const [panPreview, setPanPreview] = useState(getFullUrl(panUpload?.filePreview));
  const [isCroppingPan, setIsCroppingPan] = useState(false);
  const [rawPanImage, setRawPanImage] = useState(null);
  const panInputRef = useRef(null);

  // Selfie State
  const isSelfieDone = Boolean(selfie?.preview || (selfie?.matchScore !== null && selfie?.matchScore !== undefined && selfie?.matchScore !== 0));
  const [selfiePhase, setSelfiePhase] = useState(isSelfieDone ? "done" : "intro"); // intro, processing, done
  const [matchScore, setMatchScore] = useState(selfie?.matchScore || null);
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState(getFullUrl(selfie?.preview));
  const [selfieError, setSelfieError] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [resumeUrl, setResumeUrl] = useState("");
  const selfiePollRef = useRef(null);
  const selfieSocketRef = useRef(null);
  const hasProcessedSelfieRedirect = useRef(false);
  const pendingSelfieRequestId = useRef(null);

  const [submitting, setSubmitting] = useState(false);

  // --- Sync from Context (for cross-device updates) ---
  useEffect(() => {
    if (panUpload?.filePreview) {
      const full = getFullUrl(panUpload.filePreview);
      if (full !== panPreview) setPanPreview(full);
    }
    if (signature?.filePreview) {
      const full = getFullUrl(signature.filePreview);
      if (full !== sigPreview) setSigPreview(full);
    }
    if (financialProof?.filePreview) {
      const full = getFullUrl(financialProof.filePreview);
      if (full !== finPreview) setFinPreview(full);
      if (financialProof.type) setFinType(financialProof.type);
    }
    if (bankDetails?.proofPreview || bankDetails?.proof) {
      const full = getFullUrl(bankDetails.proofPreview || bankDetails.proof);
      if (full !== bankProofPreview) setBankProofPreview(full);
    }
    if (selfie?.preview || (selfie?.matchScore !== null && selfie?.matchScore !== undefined && selfie?.matchScore !== 0)) {
      setSelfiePhase("done");
      if (selfie.preview) {
        const full = getFullUrl(selfie.preview);
        if (full !== selfiePreviewUrl) {
          setSelfiePreviewUrl(full);
          setSelfieError(false);
        }
      }
      if (selfie.matchScore !== undefined && selfie.matchScore !== matchScore) setMatchScore(selfie.matchScore);
    }
  }, [panUpload, signature, financialProof, selfie]);

  // --- Cross-device selfie polling via Socket.IO + fallback ---
  const checkSelfieStatus = useCallback(async () => {
    const activeAppId = applicationId || sessionStorage.getItem("kycApplicationId");
    const token = sessionStorage.getItem("kycToken") || sessionStorage.getItem("token");
    if (!activeAppId || !token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/kyc/status/${activeAppId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      if (!data.success || !data.application) return;
      const app = data.application;
      const sd = typeof app.selfieDetails === "string" ? JSON.parse(app.selfieDetails) : app.selfieDetails;
      if (sd?.preview) {
        console.log("[DocUpload] Selfie detected from another device! Updating...");
        const fullUrl = getFullUrl(sd.preview);
        setSelfiePreviewUrl(fullUrl);
        setSelfieError(false);
        setMatchScore(sd.matchScore || null);
        setSelfiePhase("done");
        updateState({
          selfie: { preview: sd.preview, matchScore: sd.matchScore },
          selfieDetails: { preview: sd.preview, matchScore: sd.matchScore },
        });
        addToast("Selfie captured on your mobile device!", "success");
        stopSelfieCrossDevicePolling();
      }
    } catch (err) {
      console.warn("[DocUpload] Selfie status check failed:", err.message);
    }
  }, [applicationId, addToast, updateState]);

  const startSelfieCrossDevicePolling = useCallback(() => {
    const activeAppId = applicationId || sessionStorage.getItem("kycApplicationId");
    const token = sessionStorage.getItem("kycToken") || sessionStorage.getItem("token");
    if (!activeAppId || !token) return;

    const socket = io(API_BASE_URL, { withCredentials: true });
    selfieSocketRef.current = socket;
    socket.on("connect", () => {
      console.log("[DocUpload Socket.IO] Connected, joining room:", activeAppId);
      socket.emit("join_application", activeAppId);
    });
    socket.on("kyc_updated", () => {
      console.log("[DocUpload Socket.IO] kyc_updated — checking selfie...");
      checkSelfieStatus();
    });

    // Fallback poll every 5 seconds
    selfiePollRef.current = setInterval(() => checkSelfieStatus(), 5000);
    console.log("[DocUpload] Cross-device selfie polling started");
  }, [applicationId, checkSelfieStatus]);

  const stopSelfieCrossDevicePolling = useCallback(() => {
    if (selfiePollRef.current) {
      clearInterval(selfiePollRef.current);
      selfiePollRef.current = null;
    }
    if (selfieSocketRef.current) {
      selfieSocketRef.current.disconnect();
      selfieSocketRef.current = null;
    }
  }, []);

  // Start/stop cross-device polling when QR is shown/hidden
  useEffect(() => {
    if (showQR && selfiePhase === "intro") {
      startSelfieCrossDevicePolling();
    }
    return () => stopSelfieCrossDevicePolling();
  }, [showQR, selfiePhase, startSelfieCrossDevicePolling, stopSelfieCrossDevicePolling]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => stopSelfieCrossDevicePolling();
  }, [stopSelfieCrossDevicePolling]);

  // --- Selfie Logic ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem("kycToken") || sessionStorage.getItem("token");
      if (token && applicationId) {
        const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://stokcologykyc.vercel.app";
        setResumeUrl(`${baseUrl}/resume?token=${token}&appId=${applicationId}`);
      }
    }
  }, [applicationId]);

  const handleDigioSuccess = async (requestId) => {
    try {
      let result;
      let retries = 5;
      
      while (retries > 0) {
        result = await fetchDigioRequestResponse(requestId, "SELFIE");
        if (result?.success && result.updates?.selfieDetails?.preview) {
          break; // Got the selfie!
        }
        // Wait 2 seconds before polling again
        await new Promise(res => setTimeout(res, 2000));
        retries--;
      }

      if (result?.success) {
        setMatchScore(result.score || result.faceMatchScore || 0);
        if (result.updates?.selfieDetails?.preview) {
          const preview = result.updates.selfieDetails.preview;
          setSelfiePreviewUrl(getFullUrl(preview));
          setSelfieError(false);
          addToast("Selfie verification completed", "success");
          setSelfiePhase("done");
          // Clear pending request
          pendingSelfieRequestId.current = null;
          sessionStorage.removeItem("pendingSelfieRequestId");
          // Update context so desktop also picks it up
          updateState({
            selfie: { preview, matchScore: result.score || result.faceMatchScore || 0 },
            selfieDetails: { preview, matchScore: result.score || result.faceMatchScore || 0 },
          });
        } else {
          addToast("Selfie is still processing. Please wait or try again.", "error");
          setSelfiePhase("intro");
        }
      } else {
        addToast("Failed to verify selfie", "error");
        setSelfiePhase("intro");
      }
    } catch (error) {
      addToast("Error fetching verification results", "error");
      setSelfiePhase("intro");
    }
  };

  // --- Visibility change: detect when user returns to tab after Digio popup/tab ---
  // On mobile, the Digio callback often doesn't fire because the browser suspends
  // the original tab. This listener catches the user coming back and auto-checks.
  useEffect(() => {
    // Restore any pending selfie request from a previous session/page load
    const savedPending = sessionStorage.getItem("pendingSelfieRequestId");
    if (savedPending && selfiePhase !== "done") {
      pendingSelfieRequestId.current = savedPending;
      // Auto-check immediately in case the selfie completed while we were away
      setSelfiePhase("processing");
      handleDigioSuccess(savedPending);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && pendingSelfieRequestId.current) {
        console.log("[DocUpload] Tab became visible — checking pending selfie:", pendingSelfieRequestId.current);
        setSelfiePhase("processing");
        handleDigioSuccess(pendingSelfieRequestId.current);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [selfiePhase]);

  useEffect(() => {
    if (hasProcessedSelfieRedirect.current) return;

    const searchParams = new URLSearchParams(window.location.search);
    const documentId = searchParams.get("document_id") || searchParams.get("digio_doc_id");
    const status = searchParams.get("message") || searchParams.get("status");
    
    if (documentId && status) {
      hasProcessedSelfieRedirect.current = true;
      window.history.replaceState({}, document.title, window.location.pathname);
      
      if (window.opener && window.opener !== window) {
        window.opener.postMessage({ type: 'DIGIO_SUCCESS', documentId, step: 'SELFIE', status }, window.location.origin);
        window.close();
        return;
      }

      setSelfiePhase("processing");
      if (status.toLowerCase().includes("success") || status === "Sign completed") {
        handleDigioSuccess(documentId);
      } else {
        setSelfiePhase("intro");
        addToast(`Selfie verification failed: ${status}`, "error");
      }
    }

    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'DIGIO_SUCCESS' && event.data?.step === 'SELFIE') {
        setSelfiePhase("processing");
        if (event.data.status.toLowerCase().includes("success") || event.data.status === "Sign completed") {
          handleDigioSuccess(event.data.documentId);
        } else {
          setSelfiePhase("intro");
          addToast(`Selfie verification failed: ${event.data.status}`, "error");
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const startVerification = async () => {
    const isMobile = isMobileDevice();
    const digio = initializeDigio({
      is_redirection_approach: isMobile,
      redirect_url: window.location.href,
      callback: async (response) => {
        if (response.error_code) {
          addToast(`Selfie verification failed: ${response.message}`, "error");
          setSelfiePhase("intro");
          pendingSelfieRequestId.current = null;
          sessionStorage.removeItem("pendingSelfieRequestId");
          return;
        }
        handleDigioSuccess(response.digio_doc_id || response.id);
      },
    });

    if (!digio) {
      addToast("Unable to initialize selfie verification flow", "error");
      setSelfiePhase("intro");
      return;
    }

    if (!digio.is_redirection_approach) {
      digio.init();
    }

    setSelfiePhase("processing");
    try {
      const requestData = await createDigioRequest("SELFIE", {});
      const { requestId, customerIdentifier, applicationId: newAppId } = requestData;
      if (newAppId) setApplicationId(newAppId);

      if (!requestId) {
        addToast("Unable to create selfie request", "error");
        setSelfiePhase("intro");
        return;
      }

      // Save the request ID so visibilitychange can pick it up on mobile
      pendingSelfieRequestId.current = requestId;
      sessionStorage.setItem("pendingSelfieRequestId", requestId);

      if (requestData.accessToken) {
        digio.submit(requestId, customerIdentifier, requestData.accessToken);
      } else {
        digio.submit(requestId, customerIdentifier);
      }
    } catch (error) {
      if (digio.cancel) digio.cancel();
      addToast(error?.message || "Error connecting to selfie verification service", "error");
      setSelfiePhase("intro");
      pendingSelfieRequestId.current = null;
      sessionStorage.removeItem("pendingSelfieRequestId");
    }
  };

  // --- Document Logic ---
  const handleFinChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.match('image.*') && file.type !== 'application/pdf') {
      addToast("Please upload an image or PDF for Financial Proof", "error");
      return;
    }

    
    const reader = new FileReader();
    reader.onload = async (event) => {
      setFinPreview(event.target.result);
      addToast("Financial proof attached", "success");
      updateState({ financialProof: { type: finType, filePreview: event.target.result } });
      await syncProgress({ financialProof: { type: finType, filePreview: event.target.result } }, false, "documentUpload");
    };
    reader.readAsDataURL(file);
  };

  const handleBankProofChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.match('image.*') && file.type !== 'application/pdf') {
      addToast("Please upload an image or PDF for Bank Proof", "error");
      return;
    }

    
    const reader = new FileReader();
    reader.onload = async (event) => {
      setBankProofPreview(event.target.result);
      addToast("Bank proof attached", "success");
      const updatedBankDetails = { ...(bankDetails || {}), proofPreview: event.target.result, proofType: bankProofType || "Bank Proof" };
      updateState({ bankDetails: updatedBankDetails });
      await syncProgress({ bankDetails: updatedBankDetails }, false, "documentUpload");
    };
    reader.readAsDataURL(file);
  };

  const handleSigChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.match('image/jpeg') && !file.type.match('image/png')) {
      addToast("Please upload a JPEG or PNG for Signature", "error");
      return;
    }

    
    const reader = new FileReader();
    reader.onload = (event) => {
      setRawSigImage(event.target.result);
      setIsCroppingSig(true);
    };
    reader.readAsDataURL(file);
  };

  const handlePanChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.match('image.*')) {
      addToast("Please upload an image (JPEG or PNG) for PAN", "error");
      return;
    }

    
    const reader = new FileReader();
    reader.onload = (event) => {
      setRawPanImage(event.target.result);
      setIsCroppingPan(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!panPreview) {
      addToast("Please upload your PAN card", "error");
      return;
    }
    if (!sigPreview) {
      addToast("Please upload your Signature", "error");
      return;
    }
    if (selfiePhase !== "done") {
      addToast("Please complete the Selfie Verification", "error");
      return;
    }
    if (needsBankProof && !bankProofPreview) {
      addToast("Name mismatch on bank account. Please upload a Bank Proof (Cancelled Cheque / Statement)", "error");
      return;
    }
    
    const isHighIncome = personalDetails?.annualIncome === "More Than 25 Lac";
    const isDerivatives = segments?.derivatives;
    const requiresFinProof = isHighIncome || isDerivatives;

    if (requiresFinProof && (!finType || !finPreview)) {
      let reason = "";
      if (isDerivatives && isHighIncome) reason = "opted for F&O trading and reported High Income";
      else if (isDerivatives) reason = "opted for F&O (Derivatives) trading";
      else if (isHighIncome) reason = "reported an Annual Income above 25 Lacs";

      addToast(`Financial Proof is mandatory because you ${reason}`, "error");
      return;
    }

    if (finPreview && !finType) {
      addToast("Please select the type of Financial Proof uploaded", "error");
      return;
    }

    setSubmitting(true);
    try {
      nextStep({
        financialProof: { type: finType, filePreview: finPreview },
        signature: { filePreview: sigPreview },
        panUpload: { filePreview: panPreview },
        selfie: { matchScore: matchScore, preview: selfiePreviewUrl }
      });
    } catch (err) {
      setSubmitting(false);
      addToast("Failed to save documents", "error");
    }
  };

  const finOptions = [
    "Bank account statement of latest 6 months",
    "Salary Slip (latest 3 months)",
    "Copy of Form 16",
    "Copy of ITR Acknowledgement",
    "Copy of Annual Accounts",
    "Net worth certificate"
  ];

  return (
    <div className="container-sm" style={{ paddingTop: "4vh", paddingBottom: "6vh", maxWidth: "900px" }}>
      <style>{`
        .doc-row {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .doc-row:hover {
          background: rgba(0, 0, 0, 0.015);
        }
        .doc-row.completed {
          background: rgba(159, 232, 112, 0.04);
        }
        .doc-row.completed:hover {
          background: rgba(159, 232, 112, 0.07);
        }
        .doc-number {
          transition: all 0.3s ease;
        }
        .doc-row.completed .doc-number {
          background: var(--wise-green) !important;
          color: #000 !important;
          box-shadow: 0 0 12px rgba(159, 232, 112, 0.5);
        }
        .btn-premium {
          background: linear-gradient(135deg, var(--wise-green) 0%, #87df55 100%);
          box-shadow: 0 8px 24px rgba(159, 232, 112, 0.25);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: none;
        }
        .btn-premium:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(159, 232, 112, 0.4);
        }
        .btn-premium:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
      <div className="text-center animate-slide-up" style={{ marginBottom: 32 }}>
        <h1 className="text-section" style={{ fontSize: "2.5rem", marginBottom: 12 }}>Document Upload</h1>
        <p className="text-body" style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>
          Please provide the required documents and selfie to complete your KYC.
        </p>
      </div>

      <div className="card animate-slide-up" style={{ padding: "0", borderRadius: "24px", border: "1px solid var(--border-color)", background: "var(--bg-card)", display: "flex", flexDirection: "column", boxShadow: "0 10px 40px rgba(0,0,0,0.03)" }}>
        
        {/* PAN Section */}
        <div className={`doc-row ${panPreview ? "completed" : ""}`} style={{ padding: "32px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "24px" }}>
            <div style={{ flex: "1 1 300px" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px", color: "var(--text-primary)" }}>
                <span className="doc-number" style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: 700 }}>1</span>
                PAN Card <span style={{ color: "var(--wise-danger)" }}>*</span>
              </h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", margin: 0, paddingLeft: "40px", lineHeight: 1.5 }}>Upload a clear picture of your PAN card.</p>
            </div>
            
            <div style={{ flex: "0 0 auto", width: "100%", maxWidth: "320px" }}>
              <input type="file" ref={panInputRef} onChange={handlePanChange} style={{ display: "none" }} accept="image/*" />
              {panPreview ? (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--bg-elevated)", padding: "10px", borderRadius: "14px", border: "1px solid var(--border-color)" }}>
                  <img src={panPreview} alt="PAN Preview" style={{ height: "56px", width: "86px", objectFit: "contain", borderRadius: "8px", background: "var(--bg-secondary)" }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                     <p style={{ fontSize: "0.85rem", color: "var(--wise-green)", fontWeight: 700, margin: 0 }}>✓ Attached</p>
                  </div>
                  <button onClick={() => panInputRef.current.click()} style={{ background: "var(--bg-secondary)", border: "none", padding: "10px 16px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "var(--border-color)"} onMouseOut={e => e.currentTarget.style.background = "var(--bg-secondary)"}>Replace</button>
                </div>
              ) : (
                <button onClick={() => panInputRef.current.click()} style={{ width: "100%", background: "var(--bg-elevated)", color: "var(--text-primary)", height: "56px", padding: "0 20px", borderRadius: "14px", fontWeight: "700", fontSize: "0.95rem", cursor: "pointer", border: "1.5px dashed var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "all 0.2s" }} onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--wise-green)"} onMouseOut={(e) => e.currentTarget.style.borderColor = "var(--border-color)"}>
                  <UploadIcon /> Upload PAN
                </button>
              )}
            </div>
          </div>
          
          {isCroppingPan && (
            <div style={{ marginTop: "12px" }}>
              <ImageCropper 
                filePreview={rawPanImage} 
                setFilePreview={setRawPanImage} 
                cropLabel="Crop Your PAN Card"
                onCropApply={async (res) => { 
                  setPanPreview(res); 
                  setIsCroppingPan(false); 
                  addToast("PAN cropped successfully", "success");
                  updateState({ panUpload: { filePreview: res } });
                  await syncProgress({ panUpload: { filePreview: res } }, false, "documentUpload");
                }}
                onCancel={() => { setIsCroppingPan(false); if (panInputRef.current) panInputRef.current.value = ""; }}
              />
            </div>
          )}
        </div>

        {/* Signature Section */}
        <div className={`doc-row ${sigPreview ? "completed" : ""}`} style={{ padding: "32px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "24px" }}>
            <div style={{ flex: "1 1 300px" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px", color: "var(--text-primary)" }}>
                <span className="doc-number" style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: 700 }}>2</span>
                Signature <span style={{ color: "var(--wise-danger)" }}>*</span>
              </h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", margin: 0, paddingLeft: "40px", lineHeight: 1.5 }}>Upload a clear image of your signature on blank white paper.</p>
            </div>
            
            <div style={{ flex: "0 0 auto", width: "100%", maxWidth: "320px" }}>
              <input type="file" ref={sigInputRef} onChange={handleSigChange} style={{ display: "none" }} accept="image/jpeg,image/png" />
              {sigPreview ? (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--bg-elevated)", padding: "10px", borderRadius: "14px", border: "1px solid var(--border-color)" }}>
                  <img src={sigPreview} alt="Signature Preview" style={{ height: "56px", width: "86px", objectFit: "contain", borderRadius: "8px", background: "#fff", border: "1px solid var(--border-color)" }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                     <p style={{ fontSize: "0.85rem", color: "var(--wise-green)", fontWeight: 700, margin: 0 }}>✓ Attached</p>
                  </div>
                  <button onClick={() => sigInputRef.current.click()} style={{ background: "var(--bg-secondary)", border: "none", padding: "10px 16px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "var(--border-color)"} onMouseOut={e => e.currentTarget.style.background = "var(--bg-secondary)"}>Replace</button>
                </div>
              ) : (
                <button onClick={() => sigInputRef.current.click()} style={{ width: "100%", background: "var(--bg-elevated)", color: "var(--text-primary)", height: "56px", padding: "0 20px", borderRadius: "14px", fontWeight: "700", fontSize: "0.95rem", cursor: "pointer", border: "1.5px dashed var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "all 0.2s" }} onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--wise-green)"} onMouseOut={(e) => e.currentTarget.style.borderColor = "var(--border-color)"}>
                  <UploadIcon /> Upload Signature
                </button>
              )}
            </div>
          </div>
          
          {isCroppingSig && (
            <div style={{ marginTop: "12px" }}>
              <ImageCropper 
                filePreview={rawSigImage} 
                setFilePreview={setRawSigImage} 
                cropLabel="Crop Your Signature"
                onCropApply={async (res) => { 
                  setSigPreview(res); 
                  setIsCroppingSig(false); 
                  addToast("Signature cropped successfully", "success");
                  updateState({ signature: { filePreview: res } });
                  await syncProgress({ signature: { filePreview: res } }, false, "documentUpload");
                }}
                onCancel={() => { setIsCroppingSig(false); if (sigInputRef.current) sigInputRef.current.value = ""; }}
              />
            </div>
          )}
        </div>

        {/* Selfie Section */}
        <div className={`doc-row ${selfiePhase === "done" ? "completed" : ""}`} style={{ padding: "32px 24px", borderBottom: needsBankProof ? "1px solid var(--border-color)" : "none", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "24px" }}>
            <div style={{ flex: "1 1 300px" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px", color: "var(--text-primary)" }}>
                <span className="doc-number" style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: 700 }}>3</span>
                Selfie Verification <span style={{ color: "var(--wise-danger)" }}>*</span>
              </h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", margin: 0, paddingLeft: "40px", lineHeight: 1.5 }}>Complete a live face verification securely via Digio.</p>
            </div>
            
            <div style={{ flex: "0 0 auto", width: "100%", maxWidth: "320px" }}>
              {selfiePhase === "intro" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {!showQR ? (
                    <>
                      <button className="btn btn-premium" onClick={startVerification} style={{ width: "100%", height: "56px", padding: "0 20px", borderRadius: "14px", fontWeight: "800", fontSize: "0.95rem", color: "#000" }}>
                        Start Selfie Capture
                      </button>
                      <button onClick={() => setShowQR(true)} style={{ width: "100%", background: "transparent", border: "1.5px solid var(--border-color)", color: "var(--text-secondary)", height: "48px", padding: "0 16px", borderRadius: "12px", fontSize: "0.85rem", fontWeight: "700", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.borderColor="var(--text-secondary)"} onMouseOut={e => e.currentTarget.style.borderColor="var(--border-color)"}>
                        Or scan QR on mobile
                      </button>
                    </>
                  ) : (
                    <div style={{ padding: "20px", background: "var(--bg-elevated)", borderRadius: "16px", textAlign: "center", border: "1px solid var(--border-color)" }}>
                      <p style={{ fontSize: "0.85rem", marginBottom: "16px", fontWeight: 600, color: "var(--text-primary)" }}>Scan with your mobile camera</p>
                      {resumeUrl && (
                        <div style={{ background: "white", padding: "10px", borderRadius: "12px", display: "inline-block", marginBottom: "16px", border: "1px solid #e1e1e1", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                          <QRCode value={resumeUrl} size={256} ecLevel="L" />
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 10 }}>
                        <div className="loader" style={{ width: 14, height: 14, borderWidth: 2 }}></div>
                        <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--wise-green)", margin: 0 }}>Waiting for selfie from your mobile...</p>
                      </div>
                      <button onClick={() => setShowQR(false)} style={{ width: "100%", background: "var(--bg-secondary)", border: "none", color: "var(--text-primary)", height: "44px", borderRadius: "10px", fontSize: "0.85rem", fontWeight: "700", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background="var(--border-color)"} onMouseOut={e => e.currentTarget.style.background="var(--bg-secondary)"}>
                        Hide QR Code
                      </button>
                    </div>
                  )}
                </div>
              )}

              {selfiePhase === "processing" && (
                <div style={{ textAlign: "center", padding: "24px", background: "var(--bg-elevated)", borderRadius: "16px", border: "1px solid var(--border-color)" }}>
                  <div className="loader" style={{ margin: "0 auto 16px", width: "24px", height: "24px" }}></div>
                  <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" }}>Launching Capture...</p>
                  <button onClick={() => setSelfiePhase("intro")} style={{ marginTop: "12px", background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>Cancel</button>
                </div>
              )}

              {selfiePhase === "done" && (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--bg-elevated)", padding: "10px", borderRadius: "14px", border: "1px solid var(--border-color)" }}>
                  {selfiePreviewUrl && !selfieError ? (
                    <img 
                      src={selfiePreviewUrl} 
                      alt="Selfie" 
                      style={{ height: "48px", width: "48px", objectFit: "cover", borderRadius: "50%", background: "var(--bg-secondary)", border: "2px solid var(--wise-green)" }} 
                      onError={() => setSelfieError(true)}
                    />
                  ) : (
                    <div style={{ height: "48px", width: "48px", borderRadius: "50%", background: "var(--wise-green)", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontSize: "1.2rem", fontWeight: 800 }}>✓</div>
                  )}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <p style={{ fontSize: "0.85rem", color: "var(--wise-green)", fontWeight: 700, margin: 0 }}>✓ Verified</p>
                  </div>
                  <button onClick={() => setSelfiePhase("intro")} style={{ background: "var(--bg-secondary)", border: "none", padding: "10px 16px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "var(--border-color)"} onMouseOut={e => e.currentTarget.style.background = "var(--bg-secondary)"}>Retake</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bank Proof Section (Conditional) */}
        {needsBankProof && (
          <div className={`doc-row ${bankProofPreview ? "completed" : ""}`} style={{ padding: "32px 24px", borderTop: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)", background: "rgba(247, 85, 85, 0.02)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "24px" }}>
              <div style={{ flex: "1 1 300px" }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px", color: "var(--text-primary)" }}>
                  <span className="doc-number" style={{ background: "var(--wise-danger)", color: "#fff", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: 700 }}>!</span>
                  Bank Proof Required <span style={{ color: "var(--wise-danger)" }}>*</span>
                </h3>
                <p style={{ fontSize: "0.9rem", color: "var(--wise-danger)", margin: 0, paddingLeft: "40px", fontWeight: 500, lineHeight: 1.5 }}>
                  Since your bank could not be electronically verified, please upload a cancelled cheque, bank statement, or passbook.
                </p>
              </div>
              
              <div style={{ flex: "0 0 auto", width: "100%", maxWidth: "320px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <CustomSelect 
                  value={bankProofType}
                  onChange={async (val) => {
                    setBankProofType(val);
                    if (bankProofPreview) {
                      const updatedBankDetails = { ...(bankDetails || {}), proofType: val };
                      updateState({ bankDetails: updatedBankDetails });
                      await syncProgress({ bankDetails: updatedBankDetails }, false, "documentUpload");
                    }
                  }}
                  options={bankOptions}
                  placeholder="-- Select Bank Proof --"
                />
                <input type="file" ref={bankProofInputRef} onChange={handleBankProofChange} style={{ display: "none" }} accept="image/*,application/pdf" />
                
                {bankProofPreview ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--bg-elevated)", padding: "10px", borderRadius: "14px", border: "1px solid var(--border-color)" }}>
                    <div style={{ height: "48px", width: "48px", borderRadius: "8px", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 800 }}>DOC</div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                       <p style={{ fontSize: "0.85rem", color: "var(--wise-green)", fontWeight: 700, margin: 0 }}>✓ Attached</p>
                    </div>
                    <button onClick={() => bankProofInputRef.current.click()} style={{ background: "var(--bg-secondary)", border: "none", padding: "10px 16px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "var(--border-color)"} onMouseOut={e => e.currentTarget.style.background = "var(--bg-secondary)"}>Replace</button>
                  </div>
                ) : (
                  <button onClick={() => bankProofInputRef.current.click()} style={{ width: "100%", background: "var(--bg-elevated)", color: "var(--wise-danger)", height: "56px", padding: "0 20px", borderRadius: "14px", fontWeight: "700", fontSize: "0.95rem", cursor: "pointer", border: "1.5px dashed var(--wise-danger)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "all 0.2s" }} onMouseOver={(e) => e.currentTarget.style.background = "rgba(247, 85, 85, 0.05)"} onMouseOut={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}>
                    <UploadIcon /> Upload Proof
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Financial Proof Section */}
        <div className={`doc-row ${finPreview ? "completed" : ""}`} style={{ padding: "32px 24px", borderTop: needsBankProof ? "none" : "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "24px" }}>
            <div style={{ flex: "1 1 300px" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px", color: "var(--text-primary)" }}>
                <span className="doc-number" style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: 700 }}>4</span>
                Financial Proof 
                { (personalDetails?.annualIncome === "More Than 25 Lac" || segments?.derivatives) ? (
                  <span style={{ color: "var(--wise-danger)" }}>*</span>
                ) : (
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, background: "var(--bg-secondary)", padding: "4px 10px", borderRadius: "14px" }}>Optional</span>
                )}
              </h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", margin: 0, paddingLeft: "40px", lineHeight: 1.5 }}>Required for F&O Trading or High Income categories.</p>
            </div>
            
            <div style={{ flex: "0 0 auto", width: "100%", maxWidth: "320px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <CustomSelect 
                value={finType}
                onChange={async (val) => {
                  setFinType(val);
                  updateState({ financialProof: { type: val, filePreview: finPreview } });
                  await syncProgress({ financialProof: { type: val, filePreview: finPreview } }, false, "documentUpload");
                }}
                options={finOptions}
                placeholder="-- Select Income Proof --"
              />
              <input type="file" ref={finInputRef} onChange={handleFinChange} style={{ display: "none" }} accept="image/*,application/pdf" />
              
              {finPreview ? (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--bg-elevated)", padding: "10px", borderRadius: "14px", border: "1px solid var(--border-color)" }}>
                  <div style={{ height: "48px", width: "48px", borderRadius: "8px", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 800 }}>DOC</div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                     <p style={{ fontSize: "0.85rem", color: "var(--wise-green)", fontWeight: 700, margin: 0 }}>✓ Attached</p>
                  </div>
                  <button onClick={() => finInputRef.current.click()} style={{ background: "var(--bg-secondary)", border: "none", padding: "10px 16px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "var(--border-color)"} onMouseOut={e => e.currentTarget.style.background = "var(--bg-secondary)"}>Replace</button>
                </div>
              ) : (
                <button onClick={() => finInputRef.current.click()} style={{ width: "100%", background: "var(--bg-elevated)", color: "var(--text-primary)", height: "56px", padding: "0 20px", borderRadius: "14px", fontWeight: "700", fontSize: "0.95rem", cursor: "pointer", border: "1.5px dashed var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "all 0.2s" }} onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--wise-green)"} onMouseOut={(e) => e.currentTarget.style.borderColor = "var(--border-color)"}>
                  <UploadIcon /> Upload Proof
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: "40px" }}>
        <button 
          className="btn btn-premium" 
          onClick={handleSubmit} 
          disabled={submitting || isCroppingPan || isCroppingSig}
          style={{ width: "100%", height: "64px", padding: "0 16px", borderRadius: "16px", fontWeight: 800, fontSize: "1.15rem", color: "#000" }}
        >
          {submitting ? "Saving..." : "Continue"}
        </button>
        <button onClick={prevStep} className="btn-back" disabled={submitting} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "12px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          <ArrowLeftIcon size={18} /> Back
        </button>
      </div>
    </div>
  );
}
