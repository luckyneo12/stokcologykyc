"use client";
import { useState, useRef, useEffect } from "react";
import { useKYC } from "@/context/KYCContext";
import { ArrowLeftIcon } from "../Icons";
import ImageCropper from "@/components/ui/ImageCropper";
import { initializeDigio, createDigioRequest, fetchDigioRequestResponse } from "@/utils/digio";
import { QRCode } from "react-qrcode-logo";

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
          opacity: disabled ? 0.6 : 1, padding: "0 16px"
        }}
      >
        <span style={{ color: value ? "var(--text-primary)" : "var(--text-muted)", fontSize: "0.85rem", fontWeight: 700 }}>
          {value || placeholder}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", opacity: 0.5 }}>
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
    segments, updateState, nextStep, prevStep, addToast, 
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
  const [showQR, setShowQR] = useState(false);
  const [resumeUrl, setResumeUrl] = useState("");

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
    if (selfie?.preview || (selfie?.matchScore !== null && selfie?.matchScore !== undefined && selfie?.matchScore !== 0)) {
      setSelfiePhase("done");
      if (selfie.preview) {
        const full = getFullUrl(selfie.preview);
        if (full !== selfiePreviewUrl) setSelfiePreviewUrl(full);
      }
      if (selfie.matchScore !== undefined && selfie.matchScore !== matchScore) setMatchScore(selfie.matchScore);
    }
  }, [panUpload, signature, financialProof, selfie]);

  // --- Selfie Logic ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem("kycToken") || sessionStorage.getItem("token");
      if (token && applicationId) {
        setResumeUrl(`${window.location.origin}/resume?token=${token}&appId=${applicationId}`);
      }
    }
  }, [applicationId]);

  const handleDigioSuccess = async (requestId) => {
    try {
      const result = await fetchDigioRequestResponse(requestId, "SELFIE");
      if (result?.success) {
        setMatchScore(result.score || result.faceMatchScore || 0);
        if (result.updates?.selfieDetails?.preview) {
          const preview = result.updates.selfieDetails.preview;
          setSelfiePreviewUrl(preview.startsWith('http') || preview.startsWith('data:') ? preview : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}${preview}`);
        }
      }
      addToast("Selfie verification completed", "success");
      setSelfiePhase("done");
    } catch (error) {
      addToast("Error fetching verification results", "error");
      setSelfiePhase("intro");
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const documentId = searchParams.get("document_id") || searchParams.get("digio_doc_id");
    const status = searchParams.get("message") || searchParams.get("status");
    
    if (documentId && status) {
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
    const digio = initializeDigio({
      callback: async (response) => {
        if (response.error_code) {
          addToast(`Selfie verification failed: ${response.message}`, "error");
          setSelfiePhase("intro");
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

      if (requestData.accessToken) {
        digio.submit(requestId, customerIdentifier, requestData.accessToken);
      } else {
        digio.submit(requestId, customerIdentifier);
      }
    } catch (error) {
      if (digio.cancel) digio.cancel();
      addToast(error?.message || "Error connecting to selfie verification service", "error");
      setSelfiePhase("intro");
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
    if (file.size > 5 * 1024 * 1024) { addToast("File size too large (max 5MB)", "error"); return; }
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      setFinPreview(event.target.result);
      addToast("Financial proof attached", "success");
      updateState({ financialProof: { type: finType, filePreview: event.target.result } });
      await syncProgress({ financialProof: { type: finType, filePreview: event.target.result } }, false, "documentUpload");
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
    if (file.size > 5 * 1024 * 1024) { addToast("File size too large (max 5MB)", "error"); return; }
    
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
    if (file.size > 5 * 1024 * 1024) { addToast("File size too large (max 5MB)", "error"); return; }
    
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
    <div className="container-sm" style={{ paddingTop: "4vh", paddingBottom: "6vh", maxWidth: "800px" }}>
      <div className="text-center animate-slide-up" style={{ marginBottom: 32 }}>
        <h1 className="text-section" style={{ fontSize: "2.5rem", marginBottom: 12 }}>Document Upload</h1>
        <p className="text-body" style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>
          Please provide the required documents and selfie to complete your KYC.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
        
        {/* PAN Section */}
        <div className="card animate-slide-up" style={{ padding: "24px", borderRadius: "24px", border: "1px solid var(--border-color)", background: "var(--bg-card)", display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "var(--wise-green)", color: "#000", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}>1</span>
            PAN Card <span style={{ color: "var(--wise-danger)" }}>*</span>
          </h3>
          <input type="file" ref={panInputRef} onChange={handlePanChange} style={{ display: "none" }} accept="image/*" />
          
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {isCroppingPan ? (
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
            ) : (
              <>
                <button onClick={() => panInputRef.current.click()} style={{ width: "100%", background: "var(--bg-elevated)", color: "var(--text-primary)", padding: "16px", borderRadius: "12px", fontWeight: "700", fontSize: "1rem", cursor: "pointer", border: "1px dashed var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  <UploadIcon /> {panPreview ? "PAN Attached (Replace)" : "Upload PAN"}
                </button>
                {panPreview && (
                  <div style={{ marginTop: "16px", textAlign: "center", padding: "10px", border: "1.5px dashed var(--border-color)", borderRadius: "12px", background: "var(--bg-secondary)" }}>
                    <img src={panPreview} alt="PAN Preview" style={{ maxHeight: "150px", maxWidth: "100%", borderRadius: "8px" }} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Signature Section */}
        <div className="card animate-slide-up" style={{ padding: "24px", borderRadius: "24px", border: "1px solid var(--border-color)", background: "var(--bg-card)", display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "var(--wise-green)", color: "#000", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}>2</span>
            Signature <span style={{ color: "var(--wise-danger)" }}>*</span>
          </h3>
          <input type="file" ref={sigInputRef} onChange={handleSigChange} style={{ display: "none" }} accept="image/jpeg,image/png" />
          
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {isCroppingSig ? (
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
            ) : (
              <>
                <button onClick={() => sigInputRef.current.click()} style={{ width: "100%", background: "var(--bg-elevated)", color: "var(--text-primary)", padding: "16px", borderRadius: "12px", fontWeight: "700", fontSize: "1rem", cursor: "pointer", border: "1px dashed var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  <UploadIcon /> {sigPreview ? "Signature Attached (Replace)" : "Upload Signature"}
                </button>
                {sigPreview && (
                  <div style={{ marginTop: "16px", textAlign: "center", padding: "10px", border: "1.5px dashed var(--border-color)", borderRadius: "12px", background: "var(--bg-secondary)" }}>
                    <img src={sigPreview} alt="Signature Preview" style={{ maxHeight: "150px", maxWidth: "100%", borderRadius: "8px", background: "#fff" }} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Selfie Section */}
        <div className="card animate-slide-up" style={{ padding: "24px", borderRadius: "24px", border: "1px solid var(--border-color)", background: "var(--bg-card)", display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "var(--wise-green)", color: "#000", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}>3</span>
            Selfie Verification <span style={{ color: "var(--wise-danger)" }}>*</span>
          </h3>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {selfiePhase === "intro" && (
              <>
                {!showQR ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <button className="btn btn-primary" onClick={startVerification} style={{ width: "100%", padding: "16px", borderRadius: "12px", fontWeight: "700", fontSize: "1rem" }}>
                      Start Selfie Capture
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowQR(true)} style={{ width: "100%", padding: "12px", borderRadius: "12px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                      Show QR
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "16px", background: "var(--bg-secondary)", borderRadius: "12px", textAlign: "center" }}>
                    <p style={{ fontSize: "0.9rem", marginBottom: "12px", fontWeight: 600 }}>Scan with your mobile camera</p>
                    {resumeUrl && (
                      <div style={{ background: "white", padding: "8px", borderRadius: "8px", display: "inline-block", marginBottom: "12px" }}>
                        <QRCode value={resumeUrl} size={256} />
                      </div>
                    )}
                    <button className="btn btn-text" onClick={() => setShowQR(false)} style={{ fontSize: "0.8rem", width: "100%" }}>
                      Hide QR Code
                    </button>
                  </div>
                )}
              </>
            )}
            {selfiePhase === "processing" && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div className="loader" style={{ margin: "0 auto 16px", width: "24px", height: "24px" }}></div>
                <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>Launching Digio Capture...</p>
                <button className="btn btn-secondary" onClick={() => setSelfiePhase("intro")} style={{ marginTop: "16px", padding: "8px 16px", fontSize: "0.8rem" }}>
                  Cancel
                </button>
              </div>
            )}
            {selfiePhase === "done" && (
              <div style={{ textAlign: "center", padding: "16px", border: "1.5px dashed var(--wise-green)", borderRadius: "12px", background: "var(--bg-secondary)" }}>
                <p style={{ color: "var(--wise-green)", fontWeight: 800, fontSize: "1rem", marginBottom: "8px" }}>✓ Verified</p>
                {selfiePreviewUrl && (
                  <div style={{ margin: "12px auto", width: "120px", height: "120px", borderRadius: "50%", overflow: "hidden", border: "3px solid var(--wise-green)", padding: "2px", background: "#fff" }}>
                    <img 
                      src={selfiePreviewUrl} 
                      alt="Selfie" 
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} 
                    />
                  </div>
                )}
                <button onClick={() => setSelfiePhase("intro")} style={{ marginTop: "12px", fontSize: "0.75rem", padding: "6px 16px", borderRadius: "20px", border: "none", background: "var(--wise-green)", color: "#000", cursor: "pointer", fontWeight: 700 }}>
                  Retake Selfie
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Financial Proof Section */}
        <div className="card animate-slide-up" style={{ padding: "24px", borderRadius: "24px", border: "1px solid var(--border-color)", background: "var(--bg-card)", display: "flex", flexDirection: "column", overflow: "visible" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "var(--border-color)", color: "var(--text-primary)", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}>4</span>
            Financial Proof 
            { (personalDetails?.annualIncome === "More Than 25 Lac" || segments?.derivatives) ? (
              <span style={{ color: "var(--wise-danger)" }}>*</span>
            ) : (
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>(Optional)</span>
            )}
          </h3>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "16px" }}>Required for F&O Trading or High Income.</p>
          
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ marginBottom: "16px" }}>
              <CustomSelect 
                value={finType}
                onChange={async (val) => {
                  setFinType(val);
                  updateState({ financialProof: { type: val, filePreview: finPreview } });
                  await syncProgress({ financialProof: { type: val, filePreview: finPreview } }, false, "documentUpload");
                }}
                options={finOptions}
                placeholder="-- Select Income Proof Type --"
              />
            </div>

            <input type="file" ref={finInputRef} onChange={handleFinChange} style={{ display: "none" }} accept="image/*,application/pdf" />
            <button onClick={() => finInputRef.current.click()} style={{ width: "100%", background: "var(--bg-elevated)", color: "var(--text-primary)", padding: "16px", borderRadius: "12px", fontWeight: "700", fontSize: "0.95rem", cursor: "pointer", border: "1px dashed var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
              <UploadIcon /> {finPreview ? "Proof Attached (Replace)" : "Upload Document"}
            </button>
            {finPreview && (
              <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--wise-green)", marginTop: "12px", fontWeight: 600 }}>✓ Document Attached</p>
            )}
          </div>
        </div>

      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: "32px" }}>
        <button 
          className="btn btn-primary" 
          onClick={handleSubmit} 
          disabled={submitting || isCroppingPan || isCroppingSig}
          style={{ width: "100%", padding: "16px", borderRadius: "16px", fontWeight: 800, fontSize: "1.1rem", opacity: (submitting || isCroppingPan || isCroppingSig) ? 0.7 : 1 }}
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
