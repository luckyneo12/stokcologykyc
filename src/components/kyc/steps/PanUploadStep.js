"use client";
import { useState, useRef, useEffect } from "react";
import { useKYC } from "@/context/KYCContext";
import { ArrowLeftIcon } from "../Icons";
import Logo from "../Logo";
import Tesseract from 'tesseract.js';

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

export default function PanUploadStep() {
  const { panUpload, updateNested, nextStep, prevStep, addToast } = useKYC();
  const [filePreview, setFilePreview] = useState(panUpload?.filePreview || null);
  
  useEffect(() => {
    if (panUpload?.filePreview && !filePreview) {
      setFilePreview(panUpload.filePreview);
    }
  }, [panUpload?.filePreview]);

  const [isCropping, setIsCropping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cropRect, setCropRect] = useState({ top: 10, left: 10, bottom: 90, right: 90 });
  const [dragInfo, setDragInfo] = useState({ isDragging: false, mode: null, startX: 0, startY: 0, startRect: null });
  
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const autoRotateImage = (dataUrl, angle) => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        if (angle === 90 || angle === 270) {
          canvas.width = img.height;
          canvas.height = img.width;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        ctx.translate(canvas.width / 2, canvas.height / 2);
        // orientation_degrees is the clockwise rotation of the image. We rotate counter-clockwise to fix.
        ctx.rotate(((360 - angle) * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = dataUrl;
    });
  };

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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.match('image.*')) {
      addToast("Please upload an image (JPEG or PNG)", "error");
      return;
    }

    
    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      let resultDataUrl = event.target.result;
      try {
        const { data } = await Tesseract.recognize(file, 'osd');
        const degrees = data.orientation_degrees;
        if (degrees && degrees !== 0 && degrees !== 360) {
          console.log("Auto-rotating image by", degrees, "degrees");
          resultDataUrl = await autoRotateImage(resultDataUrl, degrees);
        }
      } catch (err) {
        console.warn("Tesseract OSD failed, skipping auto-rotation:", err);
      }
      
      setFilePreview(resultDataUrl);
      setIsAnalyzing(false);
      setIsCropping(true);
      setCropRect({ top: 10, left: 10, bottom: 90, right: 90 });
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
      setFilePreview(canvas.toDataURL("image/png"));
      setIsCropping(false);
      addToast("PAN image cropped successfully", "success");
    };
    img.src = filePreview;
  };

  const resetCrop = () => setCropRect({ top: 10, left: 10, bottom: 90, right: 90 });

  const handleReset = () => {
    setFilePreview(null);
    setIsCropping(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      setTimeout(() => fileInputRef.current.click(), 50);
    }
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!filePreview) {
      addToast("Please upload your PAN card", "error");
      return;
    }
    if (submitting) return;
    
    setSubmitting(true);
    try {
      updateNested("panUpload", { filePreview });
      nextStep();
    } catch (err) {
      setSubmitting(false);
      addToast("Failed to move to next step", "error");
    }
  };

  return (
    <div className="container-sm" style={{ paddingTop: "6vh", paddingBottom: "6vh", maxWidth: "550px" }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div className="text-center animate-slide-up" style={{ marginBottom: 32 }}>
        <h1 className="text-section" style={{ fontSize: "2.8rem", marginBottom: 16 }}>PAN Upload</h1>
        <p className="text-body" style={{ color: "var(--text-secondary)", marginTop: "12px", fontSize: "1rem", lineHeight: 1.5, padding: "0 20px", fontWeight: 500 }}>
          {isAnalyzing ? "Analyzing image orientation..." : isCropping ? "Crop and rotate your PAN image for clarity." : "Please upload your PAN card to continue with your onboarding process."}
        </p>
      </div>

      <div className="card animate-slide-up" style={{ padding: "40px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-color)", position: "relative" }}>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: "none" }} accept="image/*" />
        
        {!isCropping ? (
          <>
            <div style={{ marginBottom: "32px" }}>
              <button 
                onClick={() => fileInputRef.current.click()}
                disabled={isAnalyzing}
                style={{ 
                  width: "100%", background: "var(--bg-elevated)", color: "var(--text-primary)", 
                  padding: "16px", borderRadius: "12px", fontWeight: "700", fontSize: "1rem",
                  cursor: isAnalyzing ? "wait" : "pointer", border: "1px solid var(--border-color)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                  transition: "all var(--transition-fast)", opacity: isAnalyzing ? 0.7 : 1
                }}
                className={isAnalyzing ? "" : "hover-scale"}
              >
                <span style={{ fontSize: "1.2rem" }}>↑</span> 
                {isAnalyzing ? "Analyzing Document..." : filePreview ? "PAN Attached (Click to Replace)" : "Upload PAN *"}
              </button>

              {filePreview && !isAnalyzing && (
                <div style={{ marginTop: "20px", textAlign: "center", border: "1.5px dashed var(--border-color)", padding: "12px", borderRadius: "12px", background: "var(--bg-secondary)" }}>
                  <img src={filePreview} alt="PAN Preview" style={{ maxHeight: "180px", maxWidth: "100%", objectFit: "contain", borderRadius: "8px" }} />
                  <p style={{ fontSize: "0.8rem", color: "var(--wise-positive)", marginTop: "10px", fontWeight: 600 }}>✓ Document Attached</p>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
              <button 
                className="btn btn-primary" 
                onClick={handleSubmit} 
                disabled={submitting}
                style={{ width: "100%", padding: "16px", borderRadius: "12px", fontWeight: 800, fontSize: "1.1rem", opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Processing..." : "Submit"}
              </button>
              <button onClick={prevStep} className="btn-back" disabled={submitting}>
                <ArrowLeftIcon size={18} /> Back
              </button>
            </div>
          </>
        ) : (
          <div className="animate-fade-in" style={{ textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
              <div ref={containerRef} onMouseMove={handlePointerMove} onTouchMove={handlePointerMove} style={{ position: "relative", display: "inline-block", maxWidth: "100%", background: "#1a1a1a", borderRadius: "12px", overflow: "hidden", touchAction: "none", userSelect: "none", lineHeight: 0 }}>
                <div onMouseDown={(e) => handlePointerDown('move', e)} onTouchStart={(e) => handlePointerDown('move', e)} style={{ position: "absolute", top: `${cropRect.top}%`, left: `${cropRect.left}%`, width: `${cropRect.right - cropRect.left}%`, height: `${cropRect.bottom - cropRect.top}%`, border: "2px solid var(--wise-green)", boxShadow: "0 0 0 1000px rgba(0,0,0,0.75)", zIndex: 2, cursor: dragInfo.isDragging && dragInfo.mode === 'move' ? "grabbing" : "grab" }}>
                  <div onMouseDown={(e) => handlePointerDown('nw', e)} onTouchStart={(e) => handlePointerDown('nw', e)} style={{ position: "absolute", top: -8, left: -8, width: 16, height: 16, background: "var(--wise-green)", borderRadius: "50%", cursor: "nwse-resize", zIndex: 10 }} />
                  <div onMouseDown={(e) => handlePointerDown('ne', e)} onTouchStart={(e) => handlePointerDown('ne', e)} style={{ position: "absolute", top: -8, right: -8, width: 16, height: 16, background: "var(--wise-green)", borderRadius: "50%", cursor: "nesw-resize", zIndex: 10 }} />
                  <div onMouseDown={(e) => handlePointerDown('sw', e)} onTouchStart={(e) => handlePointerDown('sw', e)} style={{ position: "absolute", bottom: -8, left: -8, width: 16, height: 16, background: "var(--wise-green)", borderRadius: "50%", cursor: "nesw-resize", zIndex: 10 }} />
                  <div onMouseDown={(e) => handlePointerDown('se', e)} onTouchStart={(e) => handlePointerDown('se', e)} style={{ position: "absolute", bottom: -8, right: -8, width: 16, height: 16, background: "var(--wise-green)", borderRadius: "50%", cursor: "nwse-resize", zIndex: 10 }} />
                </div>
                <img src={filePreview} alt="PAN" style={{ display: "block", maxWidth: "100%", maxHeight: "350px", width: "auto", height: "auto", pointerEvents: "none" }} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "20px" }}>
              <button onClick={() => handleRotate(-90)} style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-elevated)", cursor: "pointer", color: "var(--text-primary)" }}><RotateLeftIcon /></button>
              <button onClick={() => handleRotate(90)} style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-elevated)", cursor: "pointer", color: "var(--text-primary)" }}><RotateRightIcon /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button className="btn btn-primary" onClick={applyCrop} style={{ width: "100%", padding: "14px" }}>Apply Crop</button>
              <div style={{ display: "flex", gap: "12px" }}>
                <button className="btn btn-secondary" onClick={resetCrop} style={{ flex: 1, fontSize: "0.8rem" }}>Reset Box</button>
                <button className="btn btn-secondary" onClick={handleReset} style={{ flex: 1, fontSize: "0.8rem", color: "var(--wise-danger)" }}>Choose Different Image</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
