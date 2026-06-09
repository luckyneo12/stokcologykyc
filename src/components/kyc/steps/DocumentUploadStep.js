"use client";
import { useState, useRef, useEffect } from "react";
import { useKYC } from "@/context/KYCContext";
import { ArrowLeftIcon } from "../Icons";

const RotateLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/>
  </svg>
);

const RotateRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/>
  </svg>
);

const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16V4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M20 20H4" />
  </svg>
);

// Reusable Image Cropper Component
function ImageCropper({ filePreview, setFilePreview, onCropApply, onCancel, cropLabel }) {
  const [cropRect, setCropRect] = useState({ top: 10, left: 10, bottom: 90, right: 90 });
  const [dragInfo, setDragInfo] = useState({ isDragging: false, mode: null, startX: 0, startY: 0, startRect: null });
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const handlePointerDown = (mode, e) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragInfo({ isDragging: true, mode, startX: clientX, startY: clientY, startRect: { ...cropRect } });
  };

  const handlePointerMove = (e) => {
    if (!dragInfo.isDragging) return;
    const container = containerRef.current;
    if (!container) return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = container.getBoundingClientRect();
    
    const dx = ((clientX - dragInfo.startX) / rect.width) * 100;
    const dy = ((clientY - dragInfo.startY) / rect.height) * 100;
    
    let newRect = { ...dragInfo.startRect };

    if (dragInfo.mode === 'move') {
      newRect.top += dy;
      newRect.bottom += dy;
      newRect.left += dx;
      newRect.right += dx;
      
      if (newRect.top < 0) { newRect.bottom -= newRect.top; newRect.top = 0; }
      if (newRect.left < 0) { newRect.right -= newRect.left; newRect.left = 0; }
      if (newRect.bottom > 100) { newRect.top -= (newRect.bottom - 100); newRect.bottom = 100; }
      if (newRect.right > 100) { newRect.left -= (newRect.right - 100); newRect.right = 100; }
    } else {
      if (dragInfo.mode.includes('n')) newRect.top += dy;
      if (dragInfo.mode.includes('s')) newRect.bottom += dy;
      if (dragInfo.mode.includes('w')) newRect.left += dx;
      if (dragInfo.mode.includes('e')) newRect.right += dx;
      
      const minSize = 10;
      if (newRect.bottom - newRect.top < minSize) {
        if (dragInfo.mode.includes('n')) newRect.top = newRect.bottom - minSize;
        else newRect.bottom = newRect.top + minSize;
      }
      if (newRect.right - newRect.left < minSize) {
        if (dragInfo.mode.includes('w')) newRect.left = newRect.right - minSize;
        else newRect.right = newRect.left + minSize;
      }
      
      newRect.top = Math.max(0, Math.min(100, newRect.top));
      newRect.bottom = Math.max(0, Math.min(100, newRect.bottom));
      newRect.left = Math.max(0, Math.min(100, newRect.left));
      newRect.right = Math.max(0, Math.min(100, newRect.right));
    }
    setCropRect(newRect);
  };

  const handlePointerUp = () => setDragInfo(prev => ({ ...prev, isDragging: false }));

  useEffect(() => {
    if (dragInfo.isDragging) {
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchend', handlePointerUp);
      return () => {
        window.removeEventListener('mouseup', handlePointerUp);
        window.removeEventListener('touchend', handlePointerUp);
      };
    }
  }, [dragInfo.isDragging]);

  const handleRotate = (angle) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      if (angle === 90 || angle === -90) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      setFilePreview(canvas.toDataURL("image/png"));
      setCropRect({ top: 10, left: 10, bottom: 90, right: 90 });
    };
    img.src = filePreview;
  };

  const applyCrop = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      const cropW = img.width * ((cropRect.right - cropRect.left) / 100);
      const cropH = img.height * ((cropRect.bottom - cropRect.top) / 100);
      canvas.width = cropW;
      canvas.height = cropH;
      const srcX = img.width * (cropRect.left / 100);
      const srcY = img.height * (cropRect.top / 100);
      ctx.drawImage(img, srcX, srcY, cropW, cropH, 0, 0, cropW, cropH);
      onCropApply(canvas.toDataURL("image/png"));
    };
    img.src = filePreview;
  };

  return (
    <div className="animate-fade-in" style={{ textAlign: "center", padding: "10px 0" }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <p style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "16px", color: "var(--text-primary)" }}>{cropLabel || "Crop Your Image"}</p>
      
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
        <div ref={containerRef} onMouseMove={handlePointerMove} onTouchMove={handlePointerMove} style={{ position: "relative", display: "inline-block", maxWidth: "100%", background: "#1a1a1a", borderRadius: "12px", overflow: "hidden", touchAction: "none", userSelect: "none", lineHeight: 0 }}>
          <div onMouseDown={(e) => handlePointerDown('move', e)} onTouchStart={(e) => handlePointerDown('move', e)} style={{ position: "absolute", top: `${cropRect.top}%`, left: `${cropRect.left}%`, width: `${cropRect.right - cropRect.left}%`, height: `${cropRect.bottom - cropRect.top}%`, border: "2px solid var(--wise-green)", boxShadow: "0 0 0 1000px rgba(0,0,0,0.75)", zIndex: 2, cursor: dragInfo.isDragging && dragInfo.mode === 'move' ? "grabbing" : "grab" }}>
            <div onMouseDown={(e) => handlePointerDown('nw', e)} onTouchStart={(e) => handlePointerDown('nw', e)} style={{ position: "absolute", top: -8, left: -8, width: 16, height: 16, background: "var(--wise-green)", borderRadius: "50%", cursor: "nwse-resize", zIndex: 10 }} />
            <div onMouseDown={(e) => handlePointerDown('ne', e)} onTouchStart={(e) => handlePointerDown('ne', e)} style={{ position: "absolute", top: -8, right: -8, width: 16, height: 16, background: "var(--wise-green)", borderRadius: "50%", cursor: "nesw-resize", zIndex: 10 }} />
            <div onMouseDown={(e) => handlePointerDown('sw', e)} onTouchStart={(e) => handlePointerDown('sw', e)} style={{ position: "absolute", bottom: -8, left: -8, width: 16, height: 16, background: "var(--wise-green)", borderRadius: "50%", cursor: "nesw-resize", zIndex: 10 }} />
            <div onMouseDown={(e) => handlePointerDown('se', e)} onTouchStart={(e) => handlePointerDown('se', e)} style={{ position: "absolute", bottom: -8, right: -8, width: 16, height: 16, background: "var(--wise-green)", borderRadius: "50%", cursor: "nwse-resize", zIndex: 10 }} />
          </div>
          <img src={filePreview} alt="Preview" style={{ display: "block", maxWidth: "100%", maxHeight: "300px", width: "auto", height: "auto", pointerEvents: "none" }} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "20px" }}>
        <button onClick={() => handleRotate(-90)} style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-elevated)", cursor: "pointer", color: "var(--text-primary)" }}><RotateLeftIcon /></button>
        <button onClick={() => handleRotate(90)} style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-elevated)", cursor: "pointer", color: "var(--text-primary)" }}><RotateRightIcon /></button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button className="btn btn-primary" onClick={applyCrop} style={{ width: "100%", padding: "14px" }}>Apply Crop</button>
        <div style={{ display: "flex", gap: "12px" }}>
          <button className="btn btn-secondary" onClick={() => setCropRect({ top: 10, left: 10, bottom: 90, right: 90 })} style={{ flex: 1, fontSize: "0.8rem" }}>Reset Box</button>
          <button className="btn btn-secondary" onClick={onCancel} style={{ flex: 1, fontSize: "0.8rem", color: "var(--wise-danger)" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function DocumentUploadStep() {
  const { financialProof, signature, panUpload, personalDetails, updateState, nextStep, prevStep, addToast } = useKYC();
  
  // Financial Proof State
  const [finType, setFinType] = useState(financialProof?.type || "");
  const [finPreview, setFinPreview] = useState(financialProof?.filePreview || null);
  const finInputRef = useRef(null);

  // Signature State
  const [sigPreview, setSigPreview] = useState(signature?.filePreview || null);
  const [isCroppingSig, setIsCroppingSig] = useState(false);
  const [rawSigImage, setRawSigImage] = useState(null);
  const sigInputRef = useRef(null);

  // PAN Upload State
  const [panPreview, setPanPreview] = useState(panUpload?.filePreview || null);
  const [isCroppingPan, setIsCroppingPan] = useState(false);
  const [rawPanImage, setRawPanImage] = useState(null);
  const panInputRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);

  // --- Handlers for Financial Proof ---
  const handleFinChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.match('image.*') && file.type !== 'application/pdf') {
      addToast("Please upload an image or PDF for Financial Proof", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) { addToast("File size too large (max 5MB)", "error"); return; }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setFinPreview(event.target.result);
      addToast("Financial proof attached", "success");
    };
    reader.readAsDataURL(file);
  };

  // --- Handlers for Signature ---
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
      const img = new Image();
      img.onload = () => {
        if (img.height > img.width) {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = img.height; canvas.height = img.width;
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((-90 * Math.PI) / 180);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          setRawSigImage(canvas.toDataURL("image/png"));
        } else {
          setRawSigImage(event.target.result);
        }
        setIsCroppingSig(true);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // --- Handlers for PAN Upload ---
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
    
    const requiresFinProof = personalDetails?.annualIncome === "More Than 25 Lac" || personalDetails?.segments?.derivatives;
    if (requiresFinProof && (!finType || !finPreview)) {
      addToast("Please provide Financial Proof for your selected options", "error");
      return;
    }

    if (finPreview && !finType) {
      addToast("Please select the type of Financial Proof uploaded", "error");
      return;
    }

    setSubmitting(true);
    try {
      updateState({
        financialProof: { type: finType, filePreview: finPreview },
        signature: { filePreview: sigPreview },
        panUpload: { filePreview: panPreview }
      });
      setTimeout(() => {
        nextStep();
      }, 100);
    } catch (err) {
      setSubmitting(false);
      addToast("Failed to save documents", "error");
    }
  };

  const finOptions = [
    "Bank account statement for last 6 months",
    "Copy of Demat account holding statement",
    "Salary Slip",
    "Copy of Form 16",
    "Copy of ITR Acknowledgement",
    "Copy of Annual Accounts",
    "Net worth certificate"
  ];

  return (
    <div className="container-sm" style={{ paddingTop: "4vh", paddingBottom: "6vh", maxWidth: "600px" }}>
      <div className="text-center animate-slide-up" style={{ marginBottom: 32 }}>
        <h1 className="text-section" style={{ fontSize: "2.5rem", marginBottom: 12 }}>Document Upload</h1>
        <p className="text-body" style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>
          Please provide the required documents to complete your KYC.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* PAN Section */}
        <div className="card animate-slide-up" style={{ padding: "24px", borderRadius: "24px", border: "1px solid var(--border-color)", background: "var(--bg-card)" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "var(--wise-green)", color: "#000", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}>1</span>
            PAN Card <span style={{ color: "var(--wise-danger)" }}>*</span>
          </h3>
          <input type="file" ref={panInputRef} onChange={handlePanChange} style={{ display: "none" }} accept="image/*" />
          
          {isCroppingPan ? (
            <ImageCropper 
              filePreview={rawPanImage} 
              setFilePreview={setRawPanImage} 
              cropLabel="Crop Your PAN Card"
              onCropApply={(res) => { setPanPreview(res); setIsCroppingPan(false); addToast("PAN cropped successfully", "success"); }}
              onCancel={() => { setIsCroppingPan(false); if (panInputRef.current) panInputRef.current.value = ""; }}
            />
          ) : (
            <>
              <button onClick={() => panInputRef.current.click()} style={{ width: "100%", background: "var(--bg-elevated)", color: "var(--text-primary)", padding: "16px", borderRadius: "12px", fontWeight: "700", fontSize: "1rem", cursor: "pointer", border: "1px dashed var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                <UploadIcon /> {panPreview ? "PAN Attached (Click to Replace)" : "Upload PAN"}
              </button>
              {panPreview && (
                <div style={{ marginTop: "16px", textAlign: "center", padding: "10px", border: "1.5px dashed var(--border-color)", borderRadius: "12px", background: "var(--bg-secondary)" }}>
                  <img src={panPreview} alt="PAN Preview" style={{ maxHeight: "150px", maxWidth: "100%", borderRadius: "8px" }} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Signature Section */}
        <div className="card animate-slide-up" style={{ padding: "24px", borderRadius: "24px", border: "1px solid var(--border-color)", background: "var(--bg-card)" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "var(--wise-green)", color: "#000", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}>2</span>
            Signature <span style={{ color: "var(--wise-danger)" }}>*</span>
          </h3>
          <input type="file" ref={sigInputRef} onChange={handleSigChange} style={{ display: "none" }} accept="image/jpeg,image/png" />
          
          {isCroppingSig ? (
            <ImageCropper 
              filePreview={rawSigImage} 
              setFilePreview={setRawSigImage} 
              cropLabel="Crop Your Signature"
              onCropApply={(res) => { setSigPreview(res); setIsCroppingSig(false); addToast("Signature cropped successfully", "success"); }}
              onCancel={() => { setIsCroppingSig(false); if (sigInputRef.current) sigInputRef.current.value = ""; }}
            />
          ) : (
            <>
              <button onClick={() => sigInputRef.current.click()} style={{ width: "100%", background: "var(--bg-elevated)", color: "var(--text-primary)", padding: "16px", borderRadius: "12px", fontWeight: "700", fontSize: "1rem", cursor: "pointer", border: "1px dashed var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                <UploadIcon /> {sigPreview ? "Signature Attached (Click to Replace)" : "Upload Signature"}
              </button>
              {sigPreview && (
                <div style={{ marginTop: "16px", textAlign: "center", padding: "10px", border: "1.5px dashed var(--border-color)", borderRadius: "12px", background: "var(--bg-secondary)" }}>
                  <img src={sigPreview} alt="Signature Preview" style={{ maxHeight: "150px", maxWidth: "100%", borderRadius: "8px", background: "#fff" }} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Financial Proof Section */}
        <div className="card animate-slide-up" style={{ padding: "24px", borderRadius: "24px", border: "1px solid var(--border-color)", background: "var(--bg-card)", overflow: "visible" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "var(--border-color)", color: "var(--text-primary)", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}>3</span>
            Financial Proof (Optional)
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px" }}>Required for F&O Trading or High Income categories.</p>
          
          <div style={{ marginBottom: "16px" }}>
            <select 
              value={finType} 
              onChange={(e) => setFinType(e.target.value)}
              style={{ width: "100%", height: "52px", borderRadius: "12px", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--text-primary)", padding: "0 16px", fontSize: "0.95rem", outline: "none" }}
            >
              <option value="">-- Select Income Proof Type --</option>
              {finOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <input type="file" ref={finInputRef} onChange={handleFinChange} style={{ display: "none" }} accept="image/*,application/pdf" />
          <button onClick={() => finInputRef.current.click()} style={{ width: "100%", background: "var(--bg-elevated)", color: "var(--text-primary)", padding: "16px", borderRadius: "12px", fontWeight: "700", fontSize: "1rem", cursor: "pointer", border: "1px dashed var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            <UploadIcon /> {finPreview ? "Financial Proof Attached (Replace)" : "Upload Document"}
          </button>
          {finPreview && (
            <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--wise-green)", marginTop: "12px", fontWeight: 600 }}>✓ Document Attached</p>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: "8px" }}>
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
    </div>
  );
}
