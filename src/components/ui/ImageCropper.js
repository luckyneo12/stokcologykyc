import React, { useState, useRef, useEffect } from "react";

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

export default function ImageCropper({ filePreview, setFilePreview, onCropApply, onCancel, cropLabel }) {
  const [cropRect, setCropRect] = useState({ top: 0, left: 0, bottom: 100, right: 100 });
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
      setFilePreview(canvas.toDataURL("image/jpeg", 0.7));
      setCropRect({ top: 0, left: 0, bottom: 100, right: 100 });
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
      onCropApply(canvas.toDataURL("image/jpeg", 0.7));
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
          <button className="btn btn-secondary" onClick={() => setCropRect({ top: 0, left: 0, bottom: 100, right: 100 })} style={{ flex: 1, fontSize: "0.8rem" }}>Reset Box</button>
          <button className="btn btn-secondary" onClick={onCancel} style={{ flex: 1, fontSize: "0.8rem", color: "var(--wise-danger)" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
