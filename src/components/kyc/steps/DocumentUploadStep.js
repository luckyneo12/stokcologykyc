"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useKYC } from "@/context/KYCContext";
import { ArrowLeftIcon } from "../Icons";
import ImageCropper from "@/components/ui/ImageCropper";
import { initializeDigio, createDigioRequest, fetchDigioRequestResponse } from "@/utils/digio";
import { QRCode } from "react-qrcode-logo";
import { uploadDocument } from "@/utils/kycApi";
import { io } from "socket.io-client";
import { Eye } from "lucide-react";
import DocumentPreviewModal from "../DocumentPreviewModal";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/** Detect if the current device is a mobile/tablet */
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

function dataURLtoFile(dataurl, filename) {
  var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, {type:mime});
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

  // Derived states for Financial Proof Requirements
  const isHighIncome = personalDetails?.annualIncome === "More Than 25 Lac";
  const isDerivatives = segments?.derivatives;
  const isFinProofRequired = isHighIncome || isDerivatives;

  // Selfie State
  const isSelfieDone = Boolean(
    (selfie?.preview && selfie.preview !== "__CLEARED__") || 
    (selfie?.matchScore !== null && selfie?.matchScore !== undefined && selfie?.matchScore !== 0)
  );
  
  const [selfiePhase, setSelfiePhase] = useState(isSelfieDone ? "done" : "intro"); // intro, processing, done
  const [matchScore, setMatchScore] = useState(selfie?.matchScore || null);
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState(getFullUrl(selfie?.preview));
  const [selfieError, setSelfieError] = useState(false);
  const [showSelfieCapture, setShowSelfieCapture] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [resumeUrl, setResumeUrl] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [qrExpired, setQrExpired] = useState(false);
  const timerRef = useRef(null);
  const selfiePollRef = useRef(null);
  const currentDigioRequestId = useRef(null);
  const selfieSocketRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [previewModalData, setPreviewModalData] = useState(null);
  const [showSkipDerivativesModal, setShowSkipDerivativesModal] = useState(false);

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
    if ((selfie?.preview && selfie.preview !== "__CLEARED__") || (selfie?.matchScore !== null && selfie?.matchScore !== undefined && selfie?.matchScore !== 0)) {
      setSelfiePhase("done");
      if (selfie.preview && selfie.preview !== "__CLEARED__") {
        const full = getFullUrl(selfie.preview);
        if (full !== selfiePreviewUrl) {
          setSelfiePreviewUrl(full);
          setSelfieError(false);
        }
      }
      if (selfie.matchScore !== undefined && selfie.matchScore !== matchScore) setMatchScore(selfie.matchScore);
    }
  }, [panUpload, signature, financialProof, selfie, bankDetails]);

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
      if (sd?.preview && sd.preview !== "__CLEARED__") {
        const fullUrl = getFullUrl(sd.preview);
        if (selfiePreviewUrl && fullUrl === selfiePreviewUrl) {
          // Ignore the old selfie; wait for the new one to be uploaded
          return;
        }
        console.log("[DocUpload] Selfie detected from another device! Updating...");
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
  }, [applicationId, addToast, updateState, selfiePreviewUrl]);

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
  const generateMobileQR = async () => {
    try {
      const token = sessionStorage.getItem("kycToken") || sessionStorage.getItem("token");
      const activeAppId = applicationId || sessionStorage.getItem("kycApplicationId");
      if (!token || !activeAppId) return;

      const response = await fetch(`${API_BASE_URL}/api/kyc/mobile-session?applicationId=${activeAppId}`, {
         headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success && data.token) {
         const baseUrl = window.location.origin;
         setResumeUrl(`${baseUrl}/mobile-selfie?token=${data.token}&appId=${activeAppId}`);
         
         const expires = new Date(data.expiresAt).getTime();
         const now = new Date().getTime();
         let seconds = Math.floor((expires - now) / 1000);
         if (seconds < 0) seconds = 0;
         
         setTimeLeft(seconds);
         setQrExpired(false);
         setShowQR(true);
         
         if (timerRef.current) clearInterval(timerRef.current);
         timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
               if (prev <= 1) {
                  clearInterval(timerRef.current);
                  setQrExpired(true);
                  return 0;
               }
               return prev - 1;
            });
         }, 1000);
      } else {
         addToast("Failed to generate QR code session", "error");
      }
    } catch (err) {
       addToast("Error generating QR code", "error");
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleInlineSelfieSuccess = async (response) => {
    // Expected response format from Digio: { error_code, message, document_id }
    if (response.error_code === "cancel") {
      addToast("Selfie capture cancelled", "warning");
      return;
    }
    
    if (response.error_code && response.error_code !== "success") {
       addToast(`Selfie verification failed: ${response.message}`, "error");
       return;
    }

    try {
      // Fetch details from backend via document_id (or digio_doc_id, or fallback to the saved requestId)
      const docId = response.document_id || response.digio_doc_id || currentDigioRequestId.current;
      if (!docId) {
         addToast("Missing document ID from Digio.", "error");
         return;
      }
      const res = await fetchDigioRequestResponse(docId, "SELFIE");
      if (res?.success) {
         let sd = null;
         if (res.application) {
             sd = typeof res.application.selfieDetails === "string" ? JSON.parse(res.application.selfieDetails) : res.application.selfieDetails;
         } else if (res.updates) {
             sd = typeof res.updates.selfieDetails === "string" ? JSON.parse(res.updates.selfieDetails) : res.updates.selfieDetails;
         }

         if (sd?.preview && sd.preview !== "__CLEARED__") {
           const fullUrl = getFullUrl(sd.preview);
           setSelfiePreviewUrl(fullUrl);
           setMatchScore(sd.matchScore);
           setSelfieError(false);
           setSelfiePhase("done");
           addToast("Selfie verification completed", "success");
           updateState({
             selfie: { preview: sd.preview, matchScore: sd.matchScore },
             selfieDetails: { preview: sd.preview, matchScore: sd.matchScore },
           });
         } else {
           // Fallback in case preview URL wasn't generated but Digio approved it
           setSelfieError(false);
           setSelfiePhase("done");
           addToast("Selfie verification completed", "success");
           updateState({ selfie: { preview: "__DIGIO_SUCCESS__" } });
         }
      } else {
         addToast("Failed to sync selfie results", "error");
      }
    } catch (e) {
      addToast("Error syncing selfie", "error");
    }
  };

  const startDesktopSelfie = async () => {
    try {
      addToast("Initializing secure camera...", "info");
      let coords = { lat: null, lng: null };
      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
          });
          coords.lat = pos.coords.latitude;
          coords.lng = pos.coords.longitude;
        } catch (err) {
          console.warn("Geolocation skipped:", err.message);
        }
      }

      const requestData = await createDigioRequest("SELFIE", coords);
      const { requestId, customerIdentifier, accessToken } = requestData;
      currentDigioRequestId.current = requestId;

      const digio = initializeDigio({
        callback: handleInlineSelfieSuccess,
        is_redirection_approach: false // Use iframe/overlay for desktop
      });

      if (!digio || !requestId) {
        addToast("Unable to initialize selfie verification flow", "error");
        return;
      }

      if (!digio.is_redirection_approach) {
        digio.init();
      }

      if (accessToken) {
        digio.submit(requestId, customerIdentifier, accessToken);
      } else {
        digio.submit(requestId, customerIdentifier);
      }
    } catch (error) {
       addToast(error?.message || "Error connecting to verification service", "error");
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
      setFinPreview(event.target.result); // local preview for immediate feedback
      try {
        const uploadResult = await uploadDocument(file);
        addToast("Financial proof attached and uploaded", "success");
        updateState({ financialProof: { type: finType, filePreview: uploadResult.path } });
        await syncProgress({ financialProof: { type: finType, filePreview: uploadResult.path } }, false, "documentUpload");
      } catch (err) {
        addToast("Failed to upload financial proof", "error");
      }
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
      setBankProofPreview(event.target.result); // local preview
      try {
        const uploadResult = await uploadDocument(file);
        addToast("Bank proof attached and uploaded", "success");
        const updatedBankDetails = { ...(bankDetails || {}), proofPreview: uploadResult.path, proofType: bankProofType || "Bank Proof" };
        updateState({ bankDetails: updatedBankDetails });
        await syncProgress({ bankDetails: updatedBankDetails }, false, "documentUpload");
      } catch (err) {
        addToast("Failed to upload bank proof", "error");
      }
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

    if (isFinProofRequired && (!finType || !finPreview)) {
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
      nextStep();
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
                     <p style={{ fontSize: "0.7rem", color: "var(--wise-green)", fontWeight: 700, margin: 0, whiteSpace: "nowrap" }}>✓ Attached</p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => setPreviewModalData({ url: panPreview })} style={{ background: "var(--bg-secondary)", border: "none", padding: "10px", borderRadius: "10px", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "var(--border-color)"} onMouseOut={e => e.currentTarget.style.background = "var(--bg-secondary)"}>
                      <Eye size={18} />
                    </button>
                    <button onClick={() => panInputRef.current.click()} style={{ background: "var(--bg-secondary)", border: "none", padding: "10px 16px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }} onMouseOver={e => e.currentTarget.style.background = "var(--border-color)"} onMouseOut={e => e.currentTarget.style.background = "var(--bg-secondary)"}>Replace</button>
                  </div>
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
                  try {
                    const file = dataURLtoFile(res, "pan_upload.jpg");
                    const uploadResult = await uploadDocument(file);
                    addToast("PAN cropped and uploaded successfully", "success");
                    updateState({ panUpload: { filePreview: uploadResult.path } });
                    await syncProgress({ panUpload: { filePreview: uploadResult.path } }, false, "documentUpload");
                  } catch (err) {
                    addToast("Failed to upload PAN image", "error");
                  }
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
                     <p style={{ fontSize: "0.7rem", color: "var(--wise-green)", fontWeight: 700, margin: 0, whiteSpace: "nowrap" }}>✓ Attached</p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => setPreviewModalData({ url: sigPreview })} style={{ background: "var(--bg-secondary)", border: "none", padding: "10px", borderRadius: "10px", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "var(--border-color)"} onMouseOut={e => e.currentTarget.style.background = "var(--bg-secondary)"}>
                      <Eye size={18} />
                    </button>
                    <button onClick={() => sigInputRef.current.click()} style={{ background: "var(--bg-secondary)", border: "none", padding: "10px 16px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }} onMouseOver={e => e.currentTarget.style.background = "var(--border-color)"} onMouseOut={e => e.currentTarget.style.background = "var(--bg-secondary)"}>Replace</button>
                  </div>
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
                  try {
                    const file = dataURLtoFile(res, "signature.jpg");
                    const uploadResult = await uploadDocument(file);
                    addToast("Signature cropped and uploaded successfully", "success");
                    updateState({ signature: { filePreview: uploadResult.path } });
                    await syncProgress({ signature: { filePreview: uploadResult.path } }, false, "documentUpload");
                  } catch (err) {
                    addToast("Failed to upload signature image", "error");
                  }
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
              {selfiePhase === "intro" && !showSelfieCapture && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {!showQR ? (
                    <>
                      <button className="btn btn-premium" onClick={startDesktopSelfie} style={{ width: "100%", height: "56px", padding: "0 20px", borderRadius: "14px", fontWeight: "800", fontSize: "0.95rem", color: "#000" }}>
                        {selfiePreviewUrl ? "Retake Selfie Capture" : "Start Selfie Capture"}
                      </button>
                      <button onClick={generateMobileQR} style={{ width: "100%", background: "transparent", border: "1.5px solid var(--border-color)", color: "var(--text-secondary)", height: "48px", padding: "0 16px", borderRadius: "12px", fontSize: "0.85rem", fontWeight: "700", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.borderColor="var(--text-secondary)"} onMouseOut={e => e.currentTarget.style.borderColor="var(--border-color)"}>
                        Or scan QR on mobile
                      </button>
                      {selfiePreviewUrl && (
                        <button onClick={() => setSelfiePhase("done")} style={{ width: "100%", background: "var(--bg-secondary)", border: "none", color: "var(--text-primary)", height: "44px", borderRadius: "10px", fontSize: "0.85rem", fontWeight: "700", cursor: "pointer", marginTop: "8px", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background="var(--border-color)"} onMouseOut={e => e.currentTarget.style.background="var(--bg-secondary)"}>
                          Cancel Retake
                        </button>
                      )}
                    </>
                  ) : (
                    <div style={{ padding: "20px", background: "var(--bg-elevated)", borderRadius: "16px", textAlign: "center", border: "1px solid var(--border-color)" }}>
                      <p style={{ fontSize: "0.85rem", marginBottom: "16px", fontWeight: 600, color: "var(--text-primary)" }}>Scan with your mobile camera</p>
                      
                      {qrExpired ? (
                        <div style={{ padding: "24px", background: "rgba(247, 85, 85, 0.05)", borderRadius: "12px", marginBottom: "16px", border: "1px solid var(--wise-danger)" }}>
                           <p style={{ color: "var(--wise-danger)", fontWeight: 600, marginBottom: "12px" }}>QR Code Expired</p>
                           <button onClick={generateMobileQR} style={{ background: "var(--wise-danger)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>Generate New QR</button>
                        </div>
                      ) : resumeUrl ? (
                        <div style={{ background: "white", padding: "10px", borderRadius: "12px", display: "inline-block", marginBottom: "16px", border: "1px solid #e1e1e1", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                          <QRCode value={resumeUrl} size={256} ecLevel="L" />
                          <p style={{ fontSize: "1.2rem", fontWeight: 800, color: "#1a1a1a", marginTop: "12px", letterSpacing: "1px" }}>
                            {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                          </p>
                        </div>
                      ) : null}

                      {!qrExpired && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 10 }}>
                          <div className="loader" style={{ width: 14, height: 14, borderWidth: 2 }}></div>
                          <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--wise-green)", margin: 0 }}>Waiting for selfie from your mobile...</p>
                        </div>
                      )}
                      
                      <button onClick={() => setShowQR(false)} style={{ width: "100%", background: "var(--bg-secondary)", border: "none", color: "var(--text-primary)", height: "44px", borderRadius: "10px", fontSize: "0.85rem", fontWeight: "700", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background="var(--border-color)"} onMouseOut={e => e.currentTarget.style.background="var(--bg-secondary)"}>
                        Hide QR Code
                      </button>
                    </div>
                  )}
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
                    <p style={{ fontSize: "0.7rem", color: "var(--wise-green)", fontWeight: 700, margin: 0, whiteSpace: "nowrap" }}>✓ Verified</p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => setPreviewModalData({ url: selfiePreviewUrl })} style={{ background: "var(--bg-secondary)", border: "none", padding: "10px", borderRadius: "10px", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "var(--border-color)"} onMouseOut={e => e.currentTarget.style.background = "var(--bg-secondary)"}>
                      <Eye size={18} />
                    </button>
                    <button onClick={() => {
                      setSelfiePhase("intro");
                    }} style={{ background: "var(--bg-secondary)", border: "none", padding: "10px 16px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }} onMouseOver={e => e.currentTarget.style.background = "var(--border-color)"} onMouseOut={e => e.currentTarget.style.background = "var(--bg-secondary)"}>Retake</button>
                  </div>
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
                       <p style={{ fontSize: "0.7rem", color: "var(--wise-green)", fontWeight: 700, margin: 0, whiteSpace: "nowrap" }}>✓ Attached</p>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => setPreviewModalData({ url: bankProofPreview })} style={{ background: "var(--bg-secondary)", border: "none", padding: "10px", borderRadius: "10px", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "var(--border-color)"} onMouseOut={e => e.currentTarget.style.background = "var(--bg-secondary)"}>
                        <Eye size={18} />
                      </button>
                      <button onClick={() => bankProofInputRef.current.click()} style={{ background: "var(--bg-secondary)", border: "none", padding: "10px 16px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }} onMouseOver={e => e.currentTarget.style.background = "var(--border-color)"} onMouseOut={e => e.currentTarget.style.background = "var(--bg-secondary)"}>Replace</button>
                    </div>
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
                  const updatedFinProof = { ...(financialProof || {}), type: val };
                  updateState({ financialProof: updatedFinProof });
                  await syncProgress({ financialProof: updatedFinProof }, false, "documentUpload");
                }}
                options={finOptions}
                placeholder="-- Select Income Proof --"
                disabled={!isFinProofRequired}
              />
              <input type="file" disabled={!isFinProofRequired} ref={finInputRef} onChange={handleFinChange} style={{ display: "none" }} accept="image/*,application/pdf" />
              
              {finPreview ? (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--bg-elevated)", padding: "10px", borderRadius: "14px", border: "1px solid var(--border-color)" }}>
                  <div style={{ height: "48px", width: "48px", borderRadius: "8px", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 800 }}>DOC</div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                     <p style={{ fontSize: "0.7rem", color: "var(--wise-green)", fontWeight: 700, margin: 0, whiteSpace: "nowrap" }}>✓ Attached</p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => setPreviewModalData({ url: finPreview })} style={{ background: "var(--bg-secondary)", border: "none", padding: "10px", borderRadius: "10px", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "var(--border-color)"} onMouseOut={e => e.currentTarget.style.background = "var(--bg-secondary)"}>
                      <Eye size={18} />
                    </button>
                    <button disabled={!isFinProofRequired} onClick={() => finInputRef.current.click()} style={{ background: "var(--bg-secondary)", border: "none", padding: "10px 16px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", cursor: !isFinProofRequired ? "not-allowed" : "pointer", opacity: !isFinProofRequired ? 0.5 : 1, transition: "all 0.2s", whiteSpace: "nowrap" }} onMouseOver={e => !(!isFinProofRequired) && (e.currentTarget.style.background = "var(--border-color)")} onMouseOut={e => !(!isFinProofRequired) && (e.currentTarget.style.background = "var(--bg-secondary)")}>Replace</button>
                  </div>
                </div>
              ) : (
                <button disabled={!isFinProofRequired} onClick={() => finInputRef.current.click()} style={{ width: "100%", background: "var(--bg-elevated)", color: "var(--text-primary)", height: "56px", padding: "0 20px", borderRadius: "14px", fontWeight: "700", fontSize: "0.95rem", cursor: !isFinProofRequired ? "not-allowed" : "pointer", opacity: !isFinProofRequired ? 0.5 : 1, border: "1.5px dashed var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "all 0.2s" }} onMouseOver={(e) => !(!isFinProofRequired) && (e.currentTarget.style.borderColor = "var(--wise-green)")} onMouseOut={(e) => !(!isFinProofRequired) && (e.currentTarget.style.borderColor = "var(--border-color)")}>
                  <UploadIcon /> Upload Proof
                </button>
              )}
              {segments?.derivatives && (
                 <button onClick={() => setShowSkipDerivativesModal(true)} style={{ marginTop: "4px", width: "100%", background: "transparent", border: "none", color: "var(--text-secondary)", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", textDecoration: "underline" }}>
                   Skip & Trade only in Equity
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

      <DocumentPreviewModal 
        isOpen={!!previewModalData} 
        onClose={() => setPreviewModalData(null)} 
        documentUrl={previewModalData?.url} 
        documentType={previewModalData?.type} 
      />

      {showSkipDerivativesModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, minHeight: "100%", background: "rgba(0,0,0,0.8)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ width: "100%", maxWidth: "400px", background: "var(--bg-primary)", borderRadius: "20px", overflow: "hidden", padding: "24px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1.2rem", fontWeight: 800 }}>Skip Financial Proof?</h3>
            <p style={{ margin: "0 0 24px 0", fontSize: "0.95rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Your derivatives segment will be deselected and you will ONLY work in Equity segment. Are you sure you want to proceed?
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setShowSkipDerivativesModal(false)} style={{ flex: 1, padding: "12px", background: "var(--bg-secondary)", color: "var(--text-primary)", border: "none", borderRadius: "10px", fontWeight: 700, cursor: "pointer" }}>
                No
              </button>
              <button 
                onClick={async () => {
                  setShowSkipDerivativesModal(false);
                  const updatedSegments = { ...segments, derivatives: false, equity: true };
                  updateState({ segments: updatedSegments });
                  try {
                    await syncProgress({ segments: updatedSegments }, false, "pricing");
                    addToast("Derivatives segment removed. Financial proof is no longer required.", "success");
                  } catch(e) {
                    addToast("Failed to update segments", "error");
                  }
                }} 
                style={{ flex: 1, padding: "12px", background: "var(--wise-danger)", color: "#fff", border: "none", borderRadius: "10px", fontWeight: 700, cursor: "pointer" }}
              >
                Yes, Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
