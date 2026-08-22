"use client";
import { useState, useRef, useEffect } from "react";
import { useKYC } from "@/context/KYCContext";
import { ArrowLeftIcon } from "../Icons";
import Logo from "../Logo";

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

export default function SignatureStep() {
  const { signature, correctionDraft, updateNested, nextStep, prevStep, addToast, rejectionMode, stepStatuses, rejectedStepsList } = useKYC();
  
  const isRejection = Boolean(rejectionMode);
  const isSignatureRejected = isRejection && (
    rejectedStepsList?.some(r => r.stepId === "signature") ||
    stepStatuses?.signature?.status === "rejected"
  );
  
  const initialSignature = isSignatureRejected && correctionDraft?.signature
    ? correctionDraft.signature
    : signature;

  const [filePreview, setFilePreview] = useState(initialSignature?.filePreview || null);

  const rejectionCleared = useRef(false);

  useEffect(() => {
    if (isSignatureRejected && !rejectionCleared.current) {
      rejectionCleared.current = true;
      if (!correctionDraft?.signature) {
        setFilePreview(null);
      }
    }
  }, [isSignatureRejected, correctionDraft]);
  
  // Sync with context if it updates (e.g. after server sync)
  useEffect(() => {
    if (initialSignature?.filePreview && !filePreview) {
      setFilePreview(initialSignature.filePreview);
    }
  }, [initialSignature?.filePreview]);

  const [isCropping, setIsCropping] = useState(false);
  
  // Crop rectangle in percentages
  const [cropRect, setCropRect] = useState({ top: 0, left: 0, bottom: 100, right: 100 });
  const [dragInfo, setDragInfo] = useState({ isDragging: false, mode: null, startX: 0, startY: 0, startRect: null });
  
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef(null);
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
      
      // Keep inside container
      if (newRect.top < 0) { newRect.bottom -= newRect.top; newRect.top = 0; }
      if (newRect.left < 0) { newRect.right -= newRect.left; newRect.left = 0; }
      if (newRect.bottom > 100) { newRect.top -= (newRect.bottom - 100); newRect.bottom = 100; }
      if (newRect.right > 100) { newRect.left -= (newRect.right - 100); newRect.right = 100; }
    } else {
      if (dragInfo.mode.includes('n')) newRect.top += dy;
      if (dragInfo.mode.includes('s')) newRect.bottom += dy;
      if (dragInfo.mode.includes('w')) newRect.left += dx;
      if (dragInfo.mode.includes('e')) newRect.right += dx;
      
      // Constrain minimum size and bounds
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

  const handlePointerUp = () => {
    setDragInfo(prev => ({ ...prev, isDragging: false }));
  };

  // Global mouse up to catch outside releases
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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.match('image/jpeg') && !file.type.match('image/png')) {
      addToast("Please upload a JPEG or PNG image", "error");
      return;
    }


    
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // If image is vertical, automatically rotate it to horizontal
        if (img.height > img.width) {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = img.height;
          canvas.height = img.width;
          
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((-90 * Math.PI) / 180);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          
          setFilePreview(canvas.toDataURL("image/png"));
        } else {
          setFilePreview(event.target.result);
        }
        setIsCropping(true);
        setCropRect({ top: 0, left: 0, bottom: 100, right: 100 });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

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
      setCropRect({ top: 0, left: 0, bottom: 100, right: 100 });
    };
    img.src = filePreview;
  };

  const handleCrop = () => {
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

      const processedImage = canvas.toDataURL("image/png");
      setFilePreview(processedImage);
      setIsCropping(false);
      addToast("Signature cropped successfully", "success");
    };
    img.src = filePreview;
  };

  const resetCrop = () => {
    setCropRect({ top: 0, left: 0, bottom: 100, right: 100 });
  };

  const handleReset = () => {
    setFilePreview(null);
    setIsCropping(false);
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      setTimeout(() => fileInputRef.current.click(), 50);
    }
  };

  const handleSubmit = () => {
    if (!filePreview) {
      addToast("Please upload your signature", "error");
      return;
    }
    
    const payloadData = { filePreview };
    if (isSignatureRejected) {
      updateNested("correctionDraft", { signature: payloadData });
    } else {
      updateNested("signature", payloadData);
    }
    nextStep();
  };

  return (
    <div className="container-sm" style={{ paddingTop: "6vh", paddingBottom: "6vh" }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      
      <div className="text-center animate-slide-up" style={{ marginBottom: 40 }}>
        <h2 className="text-section" style={{ fontSize: "2.4rem", fontWeight: 900, letterSpacing: "-0.5px" }}>Your Signature</h2>
        <p className="text-body" style={{ fontWeight: 600, marginTop: 12, color: "var(--text-secondary)" }}>Upload a clear image of your signature on plain white paper.</p>
      </div>

      <div className="card animate-slide-up" style={{ padding: "40px", position: "relative", borderRadius: "32px", border: "1.5px solid var(--border-color)", background: "var(--bg-card)" }}>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: "none" }} accept="image/jpeg,image/png" />
        
        {!isCropping ? (
          <>
            <div style={{ marginBottom: "32px" }}>
              <button 
                onClick={() => fileInputRef.current.click()}
                style={{ 
                  width: "100%", background: "var(--bg-elevated)", color: "var(--text-primary)", 
                  height: "80px", borderRadius: "20px", fontWeight: "800", fontSize: "1.1rem",
                  cursor: "pointer", border: "2px dashed var(--border-color)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
                  transition: "all 0.2s"
                }}
              >
                <UploadIcon /> 
                {filePreview ? "Change Signature" : "Upload Signature"}
              </button>

              {filePreview && (
                <div style={{ 
                  marginTop: "24px", textAlign: "center", border: "2px solid var(--wise-green)", 
                  padding: "32px", borderRadius: "24px", background: "var(--input-bg)" 
                }}>
                  <img src={filePreview} alt="Signature Preview" style={{ maxHeight: "160px", maxWidth: "100%", objectFit: "contain" }} />
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button 
                className="btn-primary" 
                onClick={handleSubmit} 
                style={{ height: "60px", borderRadius: "16px", fontSize: "1.1rem", fontWeight: 800 }}
              >
                Continue
              </button>
              
              <button 
                className="btn-secondary" 
                onClick={prevStep} 
                style={{ height: "56px", borderRadius: "16px", fontWeight: 700, background: "transparent", color: "var(--text-secondary)" }}
              >
                Back
              </button>
            </div>
          </>
        ) : (
          <div className="animate-fade-in" style={{ textAlign: "center" }}>
            <p style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "20px", color: "var(--text-primary)" }}>Crop Your Signature</p>
            
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
              <div 
                ref={containerRef}
                onMouseMove={handlePointerMove}
                onTouchMove={handlePointerMove}
                style={{ 
                  position: "relative", 
                  display: "inline-block", 
                  maxWidth: "100%", 
                  background: "var(--bg-elevated)", 
                  borderRadius: "24px", 
                  overflow: "hidden", 
                  touchAction: "none",
                  userSelect: "none",
                  lineHeight: 0,
                  border: "1.5px solid var(--border-color)"
                }}
              >
                <div 
                  onMouseDown={(e) => handlePointerDown('move', e)}
                  onTouchStart={(e) => handlePointerDown('move', e)}
                  style={{
                    position: "absolute",
                    top: `${cropRect.top}%`, 
                    left: `${cropRect.left}%`,
                    width: `${cropRect.right - cropRect.left}%`,
                    height: `${cropRect.bottom - cropRect.top}%`,
                    border: "2px solid var(--wise-green)",
                    boxShadow: "0 0 0 1000px rgba(0,0,0,0.6)",
                    zIndex: 2,
                    cursor: dragInfo.isDragging && dragInfo.mode === 'move' ? "grabbing" : "grab"
                  }}>
                  <div style={{ position: "absolute", top: "33%", width: "100%", height: "1px", background: "rgba(255,255,255,0.2)" }} />
                  <div style={{ position: "absolute", top: "66%", width: "100%", height: "1px", background: "rgba(255,255,255,0.2)" }} />
                  <div style={{ position: "absolute", left: "33%", height: "100%", width: "1px", background: "rgba(255,255,255,0.2)" }} />
                  <div style={{ position: "absolute", left: "66%", height: "100%", width: "1px", background: "rgba(255,255,255,0.2)" }} />
                  
                  <div onMouseDown={(e) => handlePointerDown('nw', e)} onTouchStart={(e) => handlePointerDown('nw', e)} style={{ position: "absolute", top: -18, left: -18, width: 36, height: 36, background: "var(--wise-green)", borderRadius: "50%", cursor: "nwse-resize", zIndex: 10, border: "3px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }} />
                  <div onMouseDown={(e) => handlePointerDown('ne', e)} onTouchStart={(e) => handlePointerDown('ne', e)} style={{ position: "absolute", top: -18, right: -18, width: 36, height: 36, background: "var(--wise-green)", borderRadius: "50%", cursor: "nesw-resize", zIndex: 10, border: "3px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }} />
                  <div onMouseDown={(e) => handlePointerDown('sw', e)} onTouchStart={(e) => handlePointerDown('sw', e)} style={{ position: "absolute", bottom: -18, left: -18, width: 36, height: 36, background: "var(--wise-green)", borderRadius: "50%", cursor: "nesw-resize", zIndex: 10, border: "3px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }} />
                  <div onMouseDown={(e) => handlePointerDown('se', e)} onTouchStart={(e) => handlePointerDown('se', e)} style={{ position: "absolute", bottom: -18, right: -18, width: 36, height: 36, background: "var(--wise-green)", borderRadius: "50%", cursor: "nwse-resize", zIndex: 10, border: "3px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }} />
                </div>

                <img 
                  src={filePreview} 
                  alt="Signature" 
                  style={{ display: "block", maxWidth: "100%", maxHeight: "380px", width: "auto", height: "auto", pointerEvents: "none" }} 
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginBottom: "32px" }}>
              <button onClick={() => handleRotate(-90)} style={{ width: "56px", height: "56px", borderRadius: "16px", border: "1.5px solid var(--border-color)", background: "var(--bg-elevated)", cursor: "pointer", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <RotateLeftIcon />
              </button>
              <button onClick={() => handleRotate(90)} style={{ width: "56px", height: "56px", borderRadius: "16px", border: "1.5px solid var(--border-color)", background: "var(--bg-elevated)", cursor: "pointer", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <RotateRightIcon />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button className="btn-primary" onClick={handleCrop} style={{ height: "60px", borderRadius: "16px", fontWeight: 800, fontSize: "1.1rem" }}>
                Apply Crop
              </button>
              <button className="btn-secondary" onClick={handleReset} style={{ height: "56px", borderRadius: "16px", fontWeight: 700, color: "var(--wise-danger)", background: "transparent" }}>
                Cancel & Re-upload
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
