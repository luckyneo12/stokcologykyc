import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { API_BASE_URL } from "@/utils/apiConfig";

export default function PdfBuilder() {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState(1.0);
  const [basePdfUrl, setBasePdfUrl] = useState('/official_form.pdf');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [customVars, setCustomVars] = useState([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customForm, setCustomForm] = useState({ name: '', key: '', type: 'text' });
  
  // Track the natural (unscaled) canvas size for coordinate conversion
  const [canvasNaturalSize, setCanvasNaturalSize] = useState({ width: 0, height: 0 });
  
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const containerRef = useRef(null);

  const availableVariables = [
    { name: 'Application ID', key: 'applicationId', type: 'text' },
    { name: 'Status', key: 'status', type: 'text' },
    { name: 'Pricing Plan', key: 'plan', type: 'text' },
    { name: 'Full Name', key: 'fullName', type: 'text' },
    { name: 'Father/Spouse Name', key: 'fatherName', type: 'text' },
    { name: 'Mother\'s Name', key: 'motherName', type: 'text' },
    { name: 'Gender', key: 'gender', type: 'text' },
    { name: 'Date of Birth', key: 'dob', type: 'text' },
    { name: 'Nationality', key: 'nationality', type: 'text' },
    { name: 'Marital Status', key: 'maritalStatus', type: 'text' },
    { name: 'Occupation', key: 'occupation', type: 'text' },
    { name: 'Annual Income', key: 'annualIncome', type: 'text' },
    { name: 'PAN Number', key: 'pan', type: 'text' },
    { name: 'Aadhaar Number', key: 'aadhaar', type: 'text' },
    { name: 'Phone', key: 'phone', type: 'text' },
    { name: 'Email Address', key: 'email', type: 'text' },
    { name: 'Address Line 1', key: 'addressLine1', type: 'text' },
    { name: 'Address Line 2', key: 'addressLine2', type: 'text' },
    { name: 'City', key: 'city', type: 'text' },
    { name: 'State', key: 'state', type: 'text' },
    { name: 'Pincode', key: 'pincode', type: 'text' },
    { name: 'Full Address', key: 'fullAddress', type: 'text' },
    { name: 'Bank Name', key: 'bankName', type: 'text' },
    { name: 'Account Num', key: 'accountNumber', type: 'text' },
    { name: 'IFSC Code', key: 'ifsc', type: 'text' },
    { name: 'Account Type', key: 'accountType', type: 'text' },
    { name: 'Selfie (Image)', key: 'selfie', type: 'image' },
    { name: 'Signature (Image)', key: 'signature', type: 'image' },
    { name: 'eSign Stamp', key: 'esign', type: 'image' },
    { name: 'PAN Image', key: 'panImage', type: 'image' },
    { name: 'Aadhaar Image', key: 'aadhaarImage', type: 'image' },
    ...customVars
  ];

  useEffect(() => {
    const init = async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version || '5.7.284'}/build/pdf.worker.min.mjs`;

        const res = await fetch(`${API_BASE_URL}/api/admin/pdf-templates/active`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.fields) {
            setFields(JSON.parse(data.fields));
            if (data.basePdfUrl && data.basePdfUrl.startsWith('/uploads/')) {
              setBasePdfUrl(`${API_BASE_URL}${data.basePdfUrl}`);
            }
          }
        }
      } catch (err) {
        console.error("Error initializing PDF Builder:", err);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const loadPdf = async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const loadingTask = pdfjs.getDocument(basePdfUrl);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setPageNum(1);
      } catch (err) {
        console.error("Error loading PDF document:", err);
      }
    };
    if (basePdfUrl) {
      loadPdf();
    }
  }, [basePdfUrl]);

  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      renderPage(pageNum);
    }
  }, [pdfDoc, pageNum, scale]);

  const renderPage = async (num) => {
    try {
      const page = await pdfDoc.getPage(num);
      const viewport = page.getViewport({ scale });
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Store the natural (scale=1) dimensions for coordinate normalization
      const naturalViewport = page.getViewport({ scale: 1 });
      setCanvasNaturalSize({ 
        width: naturalViewport.width, 
        height: naturalViewport.height 
      });

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      renderTaskRef.current = page.render(renderContext);
      await renderTaskRef.current.promise;
      renderTaskRef.current = null;
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error("PDF Render Error:", err);
      }
    }
  };

  const addVariable = (variable) => {
    // Store positions in natural (unscaled) PDF coordinates
    setFields(prev => [...prev, {
      id: Date.now().toString(),
      variable: variable.key,
      type: variable.type,
      matchValue: variable.matchValue || '',
      page: pageNum,
      x: 100,
      y: 100,
      width: variable.type === 'image' ? 120 : (variable.type === 'checkbox' ? 20 : 150),
      height: variable.type === 'image' ? 60 : (variable.type === 'checkbox' ? 20 : 30),
      fontSize: variable.type === 'checkbox' ? 16 : 12
    }]);
  };

  const updateField = useCallback((id, changes) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...changes } : f));
  }, []);

  const removeField = (id) => {
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const duplicateField = (fieldToCopy) => {
    setFields(prev => [...prev, {
      ...fieldToCopy,
      id: Date.now().toString(),
      x: fieldToCopy.x + 20,
      y: fieldToCopy.y + 20
    }]);
  };

  const handleAddCustomVar = () => {
    if (!customForm.name || !customForm.key) {
      alert("Name and Data Key are required!");
      return;
    }
    setCustomVars([...customVars, { ...customForm }]);
    setCustomForm({ name: '', key: '', type: 'text' });
    setShowCustomForm(false);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const dbBaseUrl = basePdfUrl.startsWith(API_BASE_URL) ? basePdfUrl.replace(API_BASE_URL, '') : 'public/official_form.pdf';
      const res = await fetch(`${API_BASE_URL}/api/admin/pdf-templates`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}` 
        },
        body: JSON.stringify({
          name: 'Default Template',
          isActive: true,
          basePdfUrl: dbBaseUrl,
          fields: fields
        })
      });
      if (res.ok) alert('Template saved successfully!');
      else alert('Failed to save template');
    } catch (err) {
      console.error(err);
      alert('Error saving template');
    }
    setLoading(false);
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPdf(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/pdf-templates/upload-base`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setBasePdfUrl(`${API_BASE_URL}${data.url}`);
        // Reset fields when changing PDF to avoid out-of-bounds
        setFields([]);
      } else {
        alert('Failed to upload PDF');
      }
    } catch (err) {
      console.error("Upload error", err);
      alert('Upload error');
    }
    setUploadingPdf(false);
  };

  // Get the current scaled canvas dimensions
  const scaledCanvasWidth = canvasNaturalSize.width * scale;
  const scaledCanvasHeight = canvasNaturalSize.height * scale;

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 80px)',
      background: 'var(--bg-secondary)',
      padding: '24px',
      gap: '24px',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      
      {/* Sidebar */}
      <div style={{
        width: '320px',
        background: 'var(--bg-card)',
        borderRadius: '16px',
        boxShadow: 'var(--card-shadow)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden'
      }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            PDF Layout Builder
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Click a variable below to place it on the current page, then drag to position.
          </p>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {availableVariables.map((v) => (
            <button
              key={v.key}
              onClick={() => addVariable(v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '12px 16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--text-primary)',
                fontWeight: '600',
                fontSize: '0.875rem',
                transition: 'all 0.2s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = 'var(--wise-green)';
                e.currentTarget.style.background = 'var(--bg-elevated)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.background = 'var(--bg-secondary)';
              }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px', 
                background: v.type === 'image' ? 'var(--accent-blue-bg)' : 'var(--wise-green-alpha)',
                color: v.type === 'image' ? 'var(--accent-blue)' : 'var(--wise-dark-green)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {v.type === 'image' ? (
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                ) : (
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                )}
              </div>
              {v.name}
            </button>
          ))}
          
          {/* Custom Variable UI */}
          <div style={{ marginTop: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '16px' }}>
            {!showCustomForm ? (
              <button 
                onClick={() => setShowCustomForm(true)}
                style={{
                  width: '100%', padding: '10px', background: 'transparent',
                  border: '1px dashed var(--text-muted)', borderRadius: '8px',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                  fontWeight: '600', fontSize: '13px'
                }}
              >
                + Add Custom Variable
              </button>
            ) : (
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input 
                  type="text" placeholder="Label (e.g. Nominee)" 
                  value={customForm.name} onChange={e => setCustomForm({...customForm, name: e.target.value})}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px' }}
                />
                <input 
                  type="text" placeholder="Data Key (e.g. nomineeName)" 
                  value={customForm.key} onChange={e => setCustomForm({...customForm, key: e.target.value})}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px' }}
                />
                <select 
                  value={customForm.type} onChange={e => setCustomForm({...customForm, type: e.target.value})}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px' }}
                >
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                </select>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button onClick={handleAddCustomVar} style={{ flex: 1, padding: '6px', background: 'var(--accent-blue)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Add</button>
                  <button onClick={() => setShowCustomForm(false)} style={{ flex: 1, padding: '6px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-elevated)' }}>
          <button 
            onClick={handleSave} 
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: 'var(--wise-green)',
              color: 'var(--wise-dark-green)',
              fontWeight: '700',
              border: 'none',
              borderRadius: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '1rem',
              boxShadow: '0 4px 12px rgba(159, 232, 112, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            {loading ? 'Saving...' : 'Finalize & Save All'}
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div style={{
        flex: 1,
        background: 'var(--bg-card)',
        borderRadius: '16px',
        boxShadow: 'var(--card-shadow)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        
        {/* Toolbar */}
        <div style={{
          height: '64px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-elevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 12px', background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)',
              borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px'
            }}>
              {uploadingPdf ? 'Uploading...' : 'Upload Base PDF'}
              <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handlePdfUpload} disabled={uploadingPdf} />
            </label>
            <button 
              onClick={() => setPageNum(p => Math.max(1, p - 1))}
              disabled={pageNum <= 1}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              Previous
            </button>
            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
              Page {pageNum} of {numPages || '-'}
            </span>
            <button 
              onClick={() => setPageNum(p => Math.min(numPages, p + 1))}
              disabled={pageNum >= numPages}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              Next
            </button>
            <button 
              onClick={handleSave}
              style={{ 
                marginLeft: '16px', 
                padding: '8px 16px', 
                borderRadius: '8px', 
                border: 'none', 
                background: 'var(--wise-green)', 
                color: 'var(--wise-dark-green)', 
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer' 
              }}
              disabled={loading}
            >
              {loading ? 'Saving...' : `Save Page ${pageNum}`}
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>Zoom:</span>
            <button 
              onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
              style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold' }}
            >-</button>
            <span style={{ width: '60px', textAlign: 'center', fontWeight: '600', color: 'var(--text-primary)' }}>
              {(scale * 100).toFixed(0)}%
            </span>
            <button 
              onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
              style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold' }}
            >+</button>
          </div>
        </div>

        {/* Canvas Wrapper */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          background: 'var(--bg-secondary)',
          padding: '40px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start'
        }}>
          <div 
            ref={containerRef}
            style={{
              position: 'relative',
              boxShadow: '0 24px 48px rgba(0,0,0,0.1)',
              background: '#fff',
              // Explicitly set container size to match the canvas
              width: scaledCanvasWidth || 'auto',
              height: scaledCanvasHeight || 'auto'
            }}
          >
            <canvas ref={canvasRef} style={{ display: 'block' }} />
            
            {/* Render fields using controlled position/size props */}
            {canvasNaturalSize.width > 0 && fields.filter(f => f.page === pageNum).map(f => (
              <RndField
                key={f.id}
                field={f}
                scale={scale}
                canvasNaturalSize={canvasNaturalSize}
                onUpdate={updateField}
                onRemove={removeField}
                onDuplicate={duplicateField}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * Separate component for each draggable field.
 * Uses controlled `position` and `size` props instead of `default`
 * to ensure positions are always correct regardless of remounting.
 * 
 * Coordinates in state are stored in NATURAL (unscaled) PDF coordinates.
 * They are multiplied by `scale` for display and divided by `scale` on save.
 */
function RndField({ field: f, scale, canvasNaturalSize, onUpdate, onRemove, onDuplicate }) {
  // Compute the displayed (scaled) position and size from the stored natural coordinates
  const displayX = f.x * scale;
  const displayY = f.y * scale;
  const displayW = f.width * scale;
  const displayH = f.height * scale;

  const handleDragStop = (e, d) => {
    // d.x and d.y are the new position relative to the parent container (in scaled px)
    // Convert back to natural coordinates by dividing by scale
    const naturalX = d.x / scale;
    const naturalY = d.y / scale;
    
    // Clamp to canvas bounds
    const clampedX = Math.max(0, Math.min(naturalX, canvasNaturalSize.width - f.width));
    const clampedY = Math.max(0, Math.min(naturalY, canvasNaturalSize.height - f.height));
    
    onUpdate(f.id, { x: clampedX, y: clampedY });
  };

  const handleResizeStop = (e, dir, ref, delta, position) => {
    // ref.offsetWidth/Height give the new scaled dimensions
    // position.x/y give the new scaled position
    const naturalW = ref.offsetWidth / scale;
    const naturalH = ref.offsetHeight / scale;
    const naturalX = position.x / scale;
    const naturalY = position.y / scale;
    
    onUpdate(f.id, { 
      width: naturalW, 
      height: naturalH,
      x: naturalX,
      y: naturalY
    });
  };

  return (
    <Rnd
      position={{ x: displayX, y: displayY }}
      size={{ width: displayW, height: displayH }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      enableResizing={{ bottomRight: true, bottomLeft: true, topRight: true, topLeft: true }}
      style={{
        boxSizing: 'border-box',
        border: f.type === 'image' ? '2px dashed var(--accent-blue)' : (f.type === 'checkbox' ? '2px solid var(--accent-red)' : '2px solid var(--wise-green)'),
        background: f.type === 'image' ? 'rgba(14, 165, 233, 0.1)' : (f.type === 'checkbox' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(159, 232, 112, 0.2)'),
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'move',
        zIndex: 10
      }}
    >
      <div 
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDuplicate(f);
        }}
        style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '0 8px', boxSizing: 'border-box' }}
        title="Right-click to duplicate"
      >
        <span style={{ 
          fontWeight: '700', 
          color: f.type === 'image' ? 'var(--accent-blue)' : (f.type === 'checkbox' ? 'var(--accent-red)' : 'var(--wise-dark-green)'),
          fontSize: f.type === 'text' ? `${Math.max(8, (f.height || 30) * 0.6 * scale)}px` : (f.type === 'checkbox' ? '12px' : '12px'),
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          userSelect: 'none',
          lineHeight: '1'
        }}>
          {f.type === 'checkbox' ? `✓ ${f.matchValue}` : `{{${f.variable}}}`}
        </span>
        
        {/* Delete Button */}
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(f.id); }}
          style={{
            position: 'absolute',
            top: '-10px',
            right: '-10px',
            width: '24px',
            height: '24px',
            background: 'var(--accent-red)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: 20
          }}
          title="Delete"
        >
          ×
        </button>
      </div>
    </Rnd>
  );
}
