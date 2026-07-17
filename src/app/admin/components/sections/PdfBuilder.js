import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { API_BASE_URL } from "@/utils/apiConfig";

// ─── SVG Icon helpers ────────────────────────────────────────────────
const Icon = ({ d, size = 16, stroke = 'currentColor', fill = 'none', sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{typeof d === 'string' ? <path d={d}/> : d}</svg>
);
const Icons = {
  upload: <Icon d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>,
  undo: <Icon d={<><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6.69 3L3 13"/></>}/>,
  redo: <Icon d={<><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016.69 3L21 13"/></>}/>,
  zoomIn: <Icon d={<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></>}/>,
  zoomOut: <Icon d={<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></>}/>,
  chevLeft: <Icon d="M15 18l-6-6 6-6" size={14}/>,
  chevRight: <Icon d="M9 18l6-6-6-6" size={14}/>,
  analyze: <Icon d={<><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></>}/>,
  trash: <Icon d={<><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></>}/>,
  copy: <Icon d={<><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>}/>,
  settings: <Icon d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>}/>,
  text: <Icon d={<><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5"/><path d="M11.828 15H9v-2.828l8.586-8.586a2 2 0 112.828 2.828L11.828 15z"/></>} size={14}/>,
  image: <Icon d={<><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>} size={14}/>,
  check: <Icon d="M20 6L9 17l-5-5" size={14}/>,
  compile: <Icon d={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>}/>,
  panelLeft: <Icon d={<><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></>} size={14}/>,
  panelRight: <Icon d={<><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="15" y1="3" x2="15" y2="21"/></>} size={14}/>,
  crosshair: <Icon d={<><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></>} size={40}/>,
  addPage: <Icon d={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></>}/>,
  deletePage: <Icon d={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></>}/>,
  replace: <Icon d={<><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></>}/>,
};

// ─── Available Variables ──────────────────────────────────────────────
const BASE_VARIABLES = [
  { name: 'Application ID', key: 'applicationId', type: 'text', group: 'Application' },
  { name: 'Status', key: 'status', type: 'text', group: 'Application' },
  { name: 'Pricing Plan', key: 'plan', type: 'text', group: 'Application' },
  { name: 'Full Name', key: 'fullName', type: 'text', group: 'Personal' },
  { name: 'Father/Spouse Name', key: 'fatherName', type: 'text', group: 'Personal' },
  { name: "Mother's Name", key: 'motherName', type: 'text', group: 'Personal' },
  { name: 'Gender', key: 'gender', type: 'text', group: 'Personal' },
  { name: 'Date of Birth', key: 'dob', type: 'text', group: 'Personal' },
  { name: 'Nationality', key: 'nationality', type: 'text', group: 'Personal' },
  { name: 'Marital Status', key: 'maritalStatus', type: 'text', group: 'Personal' },
  { name: 'Occupation', key: 'occupation', type: 'text', group: 'Personal' },
  { name: 'Annual Income', key: 'annualIncome', type: 'text', group: 'Personal' },
  { name: 'PAN Number', key: 'pan', type: 'text', group: 'Identity' },
  { name: 'Aadhaar Number', key: 'aadhaar', type: 'text', group: 'Identity' },
  { name: 'Phone', key: 'phone', type: 'text', group: 'Contact' },
  { name: 'Email Address', key: 'email', type: 'text', group: 'Contact' },
  { name: 'Address Line 1', key: 'addressLine1', type: 'text', group: 'Address' },
  { name: 'Address Line 2', key: 'addressLine2', type: 'text', group: 'Address' },
  { name: 'City', key: 'city', type: 'text', group: 'Address' },
  { name: 'State', key: 'state', type: 'text', group: 'Address' },
  { name: 'Pincode', key: 'pincode', type: 'text', group: 'Address' },
  { name: 'Full Address', key: 'fullAddress', type: 'text', group: 'Address' },
  { name: 'Bank Name', key: 'bankName', type: 'text', group: 'Bank' },
  { name: 'Account Num', key: 'accountNumber', type: 'text', group: 'Bank' },
  { name: 'IFSC Code', key: 'ifsc', type: 'text', group: 'Bank' },
  { name: 'Account Type', key: 'accountType', type: 'text', group: 'Bank' },
  { name: 'Selfie (Image)', key: 'selfie', type: 'image', group: 'Media' },
  { name: 'Signature (Image)', key: 'signature', type: 'image', group: 'Media' },
  { name: 'eSign Stamp', key: 'esign', type: 'image', group: 'Media' },
  { name: 'PAN Image', key: 'panImage', type: 'image', group: 'Media' },
  { name: 'Aadhaar Image', key: 'aadhaarImage', type: 'image', group: 'Media' },
];

// ─── Main Component ──────────────────────────────────────────────────
export default function PdfBuilder() {
  // Core state
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [fields, setFields] = useState([]);
  const [pages, setPages] = useState([]);
  const [basePdfUrl, setBasePdfUrl] = useState('/official_form.pdf');
  const [scale, setScale] = useState(1.0);
  const [canvasNaturalSize, setCanvasNaturalSize] = useState({ width: 0, height: 0 });

  // UI state
  const [loading, setLoading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [replacingPage, setReplacingPage] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [customVars, setCustomVars] = useState([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customForm, setCustomForm] = useState({ name: '', key: '', type: 'text' });
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // {x, y, fieldId}
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error' | 'unsaved'
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [showDimTooltip, setShowDimTooltip] = useState(null); // {id, w, h}

  // Undo/Redo
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Refs
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const containerRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  // All available variables (base + custom)
  const availableVariables = useMemo(() => [...BASE_VARIABLES, ...customVars], [customVars]);

  // Grouped variables for sidebar
  const groupedVariables = useMemo(() => {
    const groups = {};
    const filtered = availableVariables.filter(v =>
      !searchQuery || v.name.toLowerCase().includes(searchQuery.toLowerCase()) || v.key.toLowerCase().includes(searchQuery.toLowerCase())
    );
    filtered.forEach(v => {
      const g = v.group || 'Custom';
      if (!groups[g]) groups[g] = [];
      groups[g].push(v);
    });
    return groups;
  }, [availableVariables, searchQuery]);

  // Placed variable keys on current page
  const placedKeys = useMemo(() => {
    return new Set(fields.filter(f => f.page === pageNum).map(f => f.variable));
  }, [fields, pageNum]);

  // Selected field object
  const selectedField = useMemo(() => fields.find(f => f.id === selectedFieldId), [fields, selectedFieldId]);

  // ─── Auto-save logic ──────────────────────────────────────────────
  const triggerAutoSave = useCallback(() => {
    setSaveStatus('unsaved');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      performSave(false);
    }, 800);
  }, []);

  const performSave = async (compilePdf = false, overridePages = null, overrideBaseUrl = null) => {
    console.log(`[performSave] compilePdf=${compilePdf}`);
    const currentFields = fieldsRef.current;
    setSaveStatus('saving');
    setLoading(compilePdf);
    try {
      let currentPages = overridePages || pages;
      const currentBase = overrideBaseUrl || basePdfUrl;

      // If compiling but pages array is empty, reconstruct from the loaded PDF document
      if (compilePdf && (!currentPages || currentPages.length === 0) && pdfDoc) {
        currentPages = Array.from({ length: pdfDoc.numPages }, (_, i) => ({ type: 'pdf', pageNumberInSource: i + 1 }));
        console.log(`[Compile] Reconstructed ${currentPages.length} pages from loaded PDF`);
      }

      console.log(`[performSave] Sending ${currentPages?.length || 0} pages to backend...`);
      const res = await fetch(`${API_BASE_URL}/api/admin/pdf-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          name: 'Default Template',
          isActive: true,
          basePdfUrl: currentBase ? (currentBase.startsWith(API_BASE_URL) ? currentBase.replace(API_BASE_URL, '') : currentBase) : null,
          fields: currentFields,
          pages: currentPages,
          compilePdf
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSaveStatus('saved');
        if (compilePdf && data.template && data.template.basePdfUrl) {
          if (data.template.basePdfUrl.startsWith('/uploads/')) {
            setBasePdfUrl(`${API_BASE_URL}${data.template.basePdfUrl}`);
          } else {
            setBasePdfUrl(data.template.basePdfUrl.startsWith('http') ? data.template.basePdfUrl : data.template.basePdfUrl);
          }
          setPages([]);
        }
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
      if (compilePdf) {
        window.alert(`Compile failed: ${err.message}. See console for details.`);
      }
    }
    setLoading(false);
  };

  // ─── Undo / Redo ──────────────────────────────────────────────────
  const pushUndo = useCallback((prevFields) => {
    setUndoStack(prev => [...prev.slice(-30), JSON.parse(JSON.stringify(prevFields))]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, JSON.parse(JSON.stringify(fieldsRef.current))]);
    setUndoStack(u => u.slice(0, -1));
    setFields(prev);
    triggerAutoSave();
  }, [undoStack, triggerAutoSave]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, JSON.parse(JSON.stringify(fieldsRef.current))]);
    setRedoStack(r => r.slice(0, -1));
    setFields(next);
    triggerAutoSave();
  }, [redoStack, triggerAutoSave]);

  // ─── Init: Load pdfjs + saved template ────────────────────────────
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
            const parsedFields = JSON.parse(data.fields);
            if (Array.isArray(parsedFields)) {
              setFields(parsedFields);
            } else {
              setFields(parsedFields.variables || []);
              if (parsedFields.pages && parsedFields.pages.length > 0) {
                setPages(parsedFields.pages);
              }
            }
            if (data.basePdfUrl && data.basePdfUrl.startsWith('/uploads/')) {
              setBasePdfUrl(`${API_BASE_URL}${data.basePdfUrl}`);
            } else if (data.basePdfUrl) {
              // Handle non-upload URLs (e.g. /official_form.pdf) - keep as relative path
              // so it loads from the frontend Next.js server (public directory)
              setBasePdfUrl(data.basePdfUrl.startsWith('http') ? data.basePdfUrl : data.basePdfUrl);
            }
          }
        }
      } catch (err) {
        console.error("Error initializing PDF Builder:", err);
      }
    };
    init();
  }, []);

  // ─── Load PDF document ────────────────────────────────────────────
  useEffect(() => {
    const loadPdf = async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const loadingTask = pdfjs.getDocument(basePdfUrl);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setPageNum(1);
        setPages(prev => {
          if (prev.length > 0) return prev;
          return Array.from({ length: pdf.numPages }, (_, i) => ({ type: 'pdf', pageNumberInSource: i + 1 }));
        });
      } catch (err) {
        console.error("Error loading PDF:", err);
      }
    };
    if (basePdfUrl) loadPdf();
  }, [basePdfUrl]);

  // ─── Render current page ──────────────────────────────────────────
  useEffect(() => {
    if (pages[pageNum - 1]?.type === 'html') {
      setCanvasNaturalSize({ width: 595.28, height: 841.89 });
    } else if (pdfDoc && canvasRef.current) {
      renderPage(pageNum);
    }
  }, [pdfDoc, pageNum, scale, pages]);

  const renderPage = async (num) => {
    try {
      const pageInfo = pages[num - 1];
      if (pageInfo?.type !== 'pdf') return;
      const sourcePageNum = pageInfo.pageNumberInSource || num;
      const page = await pdfDoc.getPage(sourcePageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const naturalViewport = page.getViewport({ scale: 1 });
      setCanvasNaturalSize({ width: naturalViewport.width, height: naturalViewport.height });

      if (renderTaskRef.current) renderTaskRef.current.cancel();
      renderTaskRef.current = page.render({ canvasContext: context, viewport });
      await renderTaskRef.current.promise;
      renderTaskRef.current = null;
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') console.error("Render Error:", err);
    }
  };

  // ─── Field operations ─────────────────────────────────────────────
  const addVariable = useCallback((variable) => {
    pushUndo(fieldsRef.current);
    const newField = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      variable: variable.key,
      type: variable.type || 'text',
      matchValue: variable.matchValue || '',
      page: pageNum,
      x: 100,
      y: 100,
      width: variable.type === 'image' ? 120 : (variable.type === 'checkbox' ? 20 : 150),
      height: variable.type === 'image' ? 60 : (variable.type === 'checkbox' ? 20 : 24),
      fontSize: variable.type === 'checkbox' ? 16 : 10
    };
    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newField.id);
    triggerAutoSave();
  }, [pageNum, pushUndo, triggerAutoSave]);

  const updateField = useCallback((id, changes) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...changes } : f));
    triggerAutoSave();
  }, [triggerAutoSave]);

  const updateFieldWithUndo = useCallback((id, changes) => {
    pushUndo(fieldsRef.current);
    updateField(id, changes);
  }, [pushUndo, updateField]);

  const removeField = useCallback((id) => {
    pushUndo(fieldsRef.current);
    setFields(prev => prev.filter(f => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
    triggerAutoSave();
  }, [selectedFieldId, pushUndo, triggerAutoSave]);

  const duplicateField = useCallback((fieldToCopy) => {
    pushUndo(fieldsRef.current);
    const newField = {
      ...fieldToCopy,
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      x: fieldToCopy.x + 15,
      y: fieldToCopy.y + 15
    };
    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newField.id);
    triggerAutoSave();
  }, [pushUndo, triggerAutoSave]);

  // ─── Custom Variable ──────────────────────────────────────────────
  const handleAddCustomVar = () => {
    if (!customForm.name || !customForm.key) return;
    setCustomVars(prev => [...prev, { ...customForm, group: 'Custom' }]);
    setCustomForm({ name: '', key: '', type: 'text' });
    setShowCustomForm(false);
  };

  // ─── PDF Upload ───────────────────────────────────────────────────
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPdf(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      if (file.type === 'application/pdf') {
        const res = await fetch(`${API_BASE_URL}/api/admin/pdf-templates/upload-base`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          setBasePdfUrl(`${API_BASE_URL}${data.url}`);
          setFields([]);
          setPages([]);
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/api/admin/pdf-templates/convert-to-html`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          setBasePdfUrl(null);
          setPdfDoc(null);
          setPageNum(1);
          setPages([{ type: 'html', content: data.html }]);
          setFields([]);
        }
      }
    } catch (err) { console.error("Upload error", err); }
    setUploadingPdf(false);
  };

  // ─── Replace Page ─────────────────────────────────────────────────
  const handleReplacePage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setReplacingPage(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      if (file.type === 'application/pdf') {
        formData.append('basePdfUrl', basePdfUrl || '');
        formData.append('pageIndex', pageNum - 1);
        const res = await fetch(`${API_BASE_URL}/api/admin/pdf-templates/replace-page`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          const newBase = `${API_BASE_URL}${data.url}`;
          setBasePdfUrl(newBase);
          performSave(false, pages, newBase);
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/api/admin/pdf-templates/convert-to-html`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          const newPages = [...pages];
          newPages[pageNum - 1] = { type: 'html', content: data.html };
          setPages(newPages);
          performSave(false, newPages, basePdfUrl);
        }
      }
    } catch (err) { console.error("Replace error", err); }
    setReplacingPage(false);
  };

  // ─── PDF Analysis ─────────────────────────────────────────────────
  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisResults(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/pdf-templates/analyze-page`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          basePdfUrl: basePdfUrl ? (basePdfUrl.startsWith(API_BASE_URL) ? basePdfUrl.replace(API_BASE_URL, '') : basePdfUrl) : null,
          pageNumber: pages[pageNum - 1]?.pageNumberInSource || pageNum
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysisResults(data.suggestions || []);
      } else {
        setAnalysisResults([]);
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setAnalysisResults([]);
    }
    setAnalyzing(false);
  };

  const acceptSuggestion = (suggestion) => {
    pushUndo(fieldsRef.current);
    const newField = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      variable: suggestion.variable,
      type: suggestion.type || 'text',
      matchValue: '',
      page: pageNum,
      x: suggestion.x,
      y: suggestion.y,
      width: suggestion.width || 150,
      height: suggestion.height || 24,
      fontSize: suggestion.fontSize || 10
    };
    setFields(prev => [...prev, newField]);
    setAnalysisResults(prev => prev.filter(s => s.variable !== suggestion.variable));
    triggerAutoSave();
  };

  // ─── Keyboard shortcuts ───────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedFieldId) {
          e.preventDefault();
          removeField(selectedFieldId);
        }
      } else if (e.key === 'Escape') {
        setSelectedFieldId(null);
        setContextMenu(null);
        setAnalysisResults(null);
      } else if (selectedFieldId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        const delta = { ArrowUp: { y: -step }, ArrowDown: { y: step }, ArrowLeft: { x: -step }, ArrowRight: { x: step } };
        const d = delta[e.key];
        const f = fieldsRef.current.find(f => f.id === selectedFieldId);
        if (f) {
          if (!e._undoPushed) { pushUndo(fieldsRef.current); e._undoPushed = true; }
          updateField(selectedFieldId, {
            x: Math.max(0, f.x + (d.x || 0)),
            y: Math.max(0, f.y + (d.y || 0))
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFieldId, handleUndo, handleRedo, removeField, pushUndo, updateField]);

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  // ─── Computed display values ──────────────────────────────────────
  const scaleFactor = canvasNaturalSize.width > 0 ? (canvasNaturalSize.width * scale) / canvasNaturalSize.width : 1;
  const displayW = canvasNaturalSize.width * scale;
  const displayH = canvasNaturalSize.height * scale;

  // ─── RENDER ───────────────────────────────────────────────────────
  return (
    <div className="pdfb">
      {/* ══════════════ LEFT PANEL: Variable Palette ══════════════ */}
      <div className={`pdfb-left${leftCollapsed ? ' collapsed' : ''}`}>
        <div className="pdfb-left-header">
          <h3>Variables</h3>
          <p>Click or drag to place on page</p>
        </div>

        <div style={{ position: 'relative', margin: '12px 20px 0' }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            className="pdfb-search"
            placeholder="Search variables..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32, margin: 0, width: '100%' }}
          />
        </div>

        <div className="pdfb-var-list">
          {Object.entries(groupedVariables).map(([group, vars]) => (
            <div key={group}>
              <div className="pdfb-var-group-title">{group}</div>
              {vars.map(v => (
                <button
                  key={v.key}
                  className="pdfb-var-item"
                  onClick={() => addVariable(v)}
                  title={`Click to add {{${v.key}}} to page ${pageNum}`}
                >
                  <div className={`pdfb-var-icon ${v.type}`}>
                    {v.type === 'image' ? Icons.image : v.type === 'checkbox' ? Icons.check : Icons.text}
                  </div>
                  <span className="pdfb-var-label">{v.name}</span>
                  {placedKeys.has(v.key) && <span className="pdfb-placed-indicator" title="Placed on this page"/>}
                </button>
              ))}
            </div>
          ))}

          {/* Custom Variable */}
          <div style={{ marginTop: 8, borderTop: '1px dashed var(--border-color)', paddingTop: 12 }}>
            {!showCustomForm ? (
              <button
                className="pdfb-var-item"
                onClick={() => setShowCustomForm(true)}
                style={{ justifyContent: 'center', color: 'var(--text-muted)', border: '1.5px dashed var(--border-color)' }}
              >
                + Add Custom Variable
              </button>
            ) : (
              <div className="pdfb-custom-form">
                <input placeholder="Label (e.g. Nominee)" value={customForm.name} onChange={e => setCustomForm({...customForm, name: e.target.value})}/>
                <input placeholder="Data Key (e.g. nomineeName)" value={customForm.key} onChange={e => setCustomForm({...customForm, key: e.target.value})}/>
                <select value={customForm.type} onChange={e => setCustomForm({...customForm, type: e.target.value})}>
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="checkbox">Checkbox</option>
                </select>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button className="pdfb-tbtn primary" style={{ flex: 1, fontSize: '0.72rem' }} onClick={handleAddCustomVar}>Add</button>
                  <button className="pdfb-tbtn" style={{ flex: 1, fontSize: '0.72rem', border: '1px solid var(--border-color)' }} onClick={() => setShowCustomForm(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════ CENTER: Toolbar + Canvas ══════════════ */}
      <div className="pdfb-center">
        {/* Toolbar */}
        <div className="pdfb-toolbar">
          <div className="pdfb-toolbar-group">
            {/* Panel toggles */}
            <button className={`pdfb-tbtn${!leftCollapsed ? ' active' : ''}`} onClick={() => setLeftCollapsed(!leftCollapsed)} title="Toggle variables panel">
              {Icons.panelLeft}
            </button>
            <div className="pdfb-toolbar-divider"/>

            {/* Upload / Replace */}
            <label className="pdfb-tbtn" title="Upload Base PDF" style={{ cursor: 'pointer' }}>
              {Icons.upload} <span>{uploadingPdf ? 'Uploading...' : 'Upload'}</span>
              <input type="file" accept=".pdf,.doc,.docx,.html" style={{ display: 'none' }} onChange={handlePdfUpload} disabled={uploadingPdf}/>
            </label>
            <label className="pdfb-tbtn" title="Replace current page" style={{ cursor: 'pointer' }}>
              {Icons.replace} <span>{replacingPage ? 'Replacing...' : 'Replace'}</span>
              <input type="file" accept=".pdf,.doc,.docx,.html" style={{ display: 'none' }} onChange={handleReplacePage} disabled={replacingPage || pages.length === 0}/>
            </label>

            <div className="pdfb-toolbar-divider"/>

            {/* Page Navigation */}
            <button className="pdfb-tbtn" onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1} title="Previous page">
              {Icons.chevLeft}
            </button>
            <span className="pdfb-page-indicator">
              {pageNum} / {pages.length || '—'}
            </span>
            <button className="pdfb-tbtn" onClick={() => setPageNum(p => Math.min(pages.length, p + 1))} disabled={pageNum >= pages.length} title="Next page">
              {Icons.chevRight}
            </button>

            <div className="pdfb-toolbar-divider"/>

            {/* Page operations */}
            <button className="pdfb-tbtn" title="Add page after current" onClick={() => {
              const newPages = [...pages];
              newPages.splice(pageNum, 0, { type: 'html', content: '<div style="font-family: Arial; padding: 20px;">New Blank Page</div>' });
              setPages(newPages);
              setPageNum(p => p + 1);
              performSave(false, newPages, basePdfUrl);
            }}>
              {Icons.addPage}
            </button>
            <button className="pdfb-tbtn danger" title="Delete current page" disabled={pages.length <= 1} onClick={() => {
              if (window.confirm('Delete this page?')) {
                const newPages = pages.filter((_, i) => i !== pageNum - 1);
                setPages(newPages);
                setPageNum(p => Math.max(1, p - 1));
                performSave(false, newPages, basePdfUrl);
              }
            }}>
              {Icons.deletePage}
            </button>

            <div className="pdfb-toolbar-divider"/>

            {/* Undo / Redo */}
            <button className="pdfb-tbtn" onClick={handleUndo} disabled={undoStack.length === 0} title="Undo (Ctrl+Z)">
              {Icons.undo}
            </button>
            <button className="pdfb-tbtn" onClick={handleRedo} disabled={redoStack.length === 0} title="Redo (Ctrl+Y)">
              {Icons.redo}
            </button>
          </div>

          <div className="pdfb-toolbar-group">
            {/* Auto-save status */}
            <div className={`pdfb-save-status ${saveStatus}`}>
              <span className="pdfb-save-dot"/>
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Error' : 'Unsaved'}
            </div>

            <div className="pdfb-toolbar-divider"/>

            {/* Analyze */}
            <button className="pdfb-tbtn" onClick={handleAnalyze} disabled={analyzing || !basePdfUrl} title="AI Analyze PDF">
              {Icons.analyze} <span>{analyzing ? 'Analyzing...' : 'Analyze'}</span>
            </button>

            <div className="pdfb-toolbar-divider"/>

            {/* Zoom */}
            <button className="pdfb-tbtn" onClick={() => setScale(s => Math.max(0.4, +(s - 0.15).toFixed(2)))} title="Zoom out">{Icons.zoomOut}</button>
            <span className="pdfb-zoom-value">{(scale * 100).toFixed(0)}%</span>
            <button className="pdfb-tbtn" onClick={() => setScale(s => Math.min(2.5, +(s + 0.15).toFixed(2)))} title="Zoom in">{Icons.zoomIn}</button>

            <div className="pdfb-toolbar-divider"/>

            {/* Compile */}
            <button className="pdfb-tbtn primary" onClick={() => performSave(true)} disabled={loading} title="Compile & finalize PDF">
              {Icons.compile} <span>{loading ? 'Compiling...' : 'Compile PDF'}</span>
            </button>

            <div className="pdfb-toolbar-divider"/>
            <button className={`pdfb-tbtn${!rightCollapsed ? ' active' : ''}`} onClick={() => setRightCollapsed(!rightCollapsed)} title="Toggle properties panel">
              {Icons.panelRight}
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div
          className="pdfb-canvas-wrapper"
          onClick={(e) => {
            if (e.target === e.currentTarget || e.target.closest('.pdfb-canvas-container') === containerRef.current) {
              if (!e.target.closest('.pdfb-field')) setSelectedFieldId(null);
            }
          }}
        >
          {/* Analysis Panel Overlay */}
          {analysisResults !== null && (
            <div className="pdfb-analysis-panel" style={{ position: 'fixed', top: 'auto', right: 16, bottom: 16, maxHeight: 400, borderRadius: 16, border: '1px solid var(--border-color)' }}>
              <div className="pdfb-analysis-header">
                <h4>📊 Suggested Variables ({analysisResults.length})</h4>
                <button className="pdfb-tbtn danger" onClick={() => setAnalysisResults(null)} style={{ padding: '4px 8px' }}>✕</button>
              </div>
              <div className="pdfb-analysis-list">
                {analysisResults.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: 20 }}>No suggestions found for this page.</p>
                ) : (
                  analysisResults.map((s, i) => (
                    <div key={i} className="pdfb-analysis-item" style={{ cursor: 'pointer' }} onClick={() => acceptSuggestion(s)}>
                      <div className={`pdfb-var-icon ${s.type || 'text'}`} style={{ width: 24, height: 24, borderRadius: 6 }}>
                        {(s.type === 'image') ? Icons.image : Icons.text}
                      </div>
                      <span className="label">{s.name || s.variable}</span>
                      <span className="confidence">{s.confidence ? `${(s.confidence * 100).toFixed(0)}%` : ''}</span>
                      <button className="pdfb-tbtn primary" style={{ padding: '3px 8px', fontSize: '0.65rem' }} onClick={(e) => { e.stopPropagation(); acceptSuggestion(s); }}>
                        Place
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div
            ref={containerRef}
            className="pdfb-canvas-container"
            style={{ width: displayW || 'auto', height: displayH || 'auto' }}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          >
            {pages[pageNum - 1]?.type === 'html' ? (
              <div
                contentEditable={true}
                suppressContentEditableWarning={true}
                onBlur={(e) => {
                  const newContent = e.currentTarget.innerHTML;
                  setPages(prev => {
                    const newPages = [...prev];
                    newPages[pageNum - 1] = { ...newPages[pageNum - 1], content: newContent };
                    return newPages;
                  });
                  triggerAutoSave();
                }}
                dangerouslySetInnerHTML={{ __html: pages[pageNum - 1].content }}
                style={{
                  width: 794,
                  minHeight: 1123,
                  boxSizing: 'border-box',
                  outline: 'none',
                  transform: `scale(${scale * (595.28 / 794)})`,
                  transformOrigin: 'top left',
                  background: 'white'
                }}
              />
            ) : (
              <canvas ref={canvasRef} style={{ display: 'block' }}/>
            )}

            {/* Render Fields */}
            {canvasNaturalSize.width > 0 && fields.filter(f => f.page === pageNum).map(f => (
              <FieldOverlay
                key={f.id}
                field={f}
                scale={scale}
                isSelected={selectedFieldId === f.id}
                onSelect={() => setSelectedFieldId(f.id)}
                onUpdate={updateField}
                onUpdateWithUndo={updateFieldWithUndo}
                onRemove={removeField}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({ x: e.clientX, y: e.clientY, fieldId: f.id });
                  setSelectedFieldId(f.id);
                }}
                onResizeStart={() => setShowDimTooltip({ id: f.id, w: f.width, h: f.height })}
                onResize={(w, h) => setShowDimTooltip({ id: f.id, w, h })}
                onResizeEnd={() => setShowDimTooltip(null)}
                showDimTooltip={showDimTooltip?.id === f.id ? showDimTooltip : null}
                canvasNaturalSize={canvasNaturalSize}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════ RIGHT PANEL: Property Inspector ══════════════ */}
      <div className={`pdfb-right${rightCollapsed ? ' collapsed' : ''}`}>
        <div className="pdfb-right-header">
          <h4>Properties</h4>
        </div>
        {selectedField ? (
          <div className="pdfb-props">
            <p className="pdfb-prop-section" style={{ borderTop: 'none', paddingTop: 0 }}>Variable</p>
            <div className="pdfb-prop-row">
              <span className="pdfb-prop-label">Key</span>
              <input className="pdfb-prop-input" value={selectedField.variable} onChange={e => updateFieldWithUndo(selectedField.id, { variable: e.target.value })}/>
            </div>
            <div className="pdfb-prop-row">
              <span className="pdfb-prop-label">Type</span>
              <select className="pdfb-prop-input" style={{ fontFamily: 'var(--font-sans)' }} value={selectedField.type} onChange={e => updateFieldWithUndo(selectedField.id, { type: e.target.value })}>
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="checkbox">Checkbox</option>
              </select>
            </div>
            {selectedField.type === 'checkbox' && (
              <div className="pdfb-prop-row">
                <span className="pdfb-prop-label">Match</span>
                <input className="pdfb-prop-input" value={selectedField.matchValue || ''} onChange={e => updateFieldWithUndo(selectedField.id, { matchValue: e.target.value })} placeholder="Value to match"/>
              </div>
            )}

            <p className="pdfb-prop-section">Position</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="pdfb-prop-row" style={{ margin: 0 }}>
                <span className="pdfb-prop-label" style={{ width: 16 }}>X</span>
                <input className="pdfb-prop-input" type="number" step="1" value={Math.round(selectedField.x)} onChange={e => updateFieldWithUndo(selectedField.id, { x: parseFloat(e.target.value) || 0 })}/>
              </div>
              <div className="pdfb-prop-row" style={{ margin: 0 }}>
                <span className="pdfb-prop-label" style={{ width: 16 }}>Y</span>
                <input className="pdfb-prop-input" type="number" step="1" value={Math.round(selectedField.y)} onChange={e => updateFieldWithUndo(selectedField.id, { y: parseFloat(e.target.value) || 0 })}/>
              </div>
            </div>

            <p className="pdfb-prop-section">Size</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="pdfb-prop-row" style={{ margin: 0 }}>
                <span className="pdfb-prop-label" style={{ width: 16 }}>W</span>
                <input className="pdfb-prop-input" type="number" step="1" value={Math.round(selectedField.width)} onChange={e => updateFieldWithUndo(selectedField.id, { width: parseFloat(e.target.value) || 10 })}/>
              </div>
              <div className="pdfb-prop-row" style={{ margin: 0 }}>
                <span className="pdfb-prop-label" style={{ width: 16 }}>H</span>
                <input className="pdfb-prop-input" type="number" step="1" value={Math.round(selectedField.height)} onChange={e => updateFieldWithUndo(selectedField.id, { height: parseFloat(e.target.value) || 10 })}/>
              </div>
            </div>

            {selectedField.type === 'text' && (
              <>
                <p className="pdfb-prop-section">Typography</p>
                <div className="pdfb-prop-row">
                  <span className="pdfb-prop-label">Size</span>
                  <input className="pdfb-prop-input" type="number" step="0.5" min="4" max="72" value={selectedField.fontSize || 10} onChange={e => updateFieldWithUndo(selectedField.id, { fontSize: parseFloat(e.target.value) || 10 })}/>
                </div>
              </>
            )}

            <p className="pdfb-prop-section">Page</p>
            <div className="pdfb-prop-row">
              <span className="pdfb-prop-label">Page</span>
              <input className="pdfb-prop-input" type="number" min="1" max={pages.length} value={selectedField.page} onChange={e => updateFieldWithUndo(selectedField.id, { page: parseInt(e.target.value) || 1 })}/>
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 6 }}>
              <button className="pdfb-tbtn" style={{ flex: 1, border: '1px solid var(--border-color)', justifyContent: 'center' }} onClick={() => {
                const f = fields.find(f => f.id === selectedFieldId);
                if (f) duplicateField(f);
              }}>
                {Icons.copy} Duplicate
              </button>
              <button className="pdfb-tbtn danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => removeField(selectedFieldId)}>
                {Icons.trash} Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="pdfb-no-selection">
            {Icons.crosshair}
            <p>Select a field on the canvas to inspect and edit its properties</p>
          </div>
        )}
      </div>

      {/* ══════════════ Context Menu ══════════════ */}
      {contextMenu && (
        <div className="pdfb-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          <button className="pdfb-ctx-item" onClick={() => {
            const f = fields.find(f => f.id === contextMenu.fieldId);
            if (f) duplicateField(f);
            setContextMenu(null);
          }}>
            {Icons.copy} Duplicate <span className="pdfb-ctx-shortcut">Ctrl+D</span>
          </button>
          <button className="pdfb-ctx-item" onClick={() => {
            const newVar = window.prompt("Rename variable key:", fields.find(f => f.id === contextMenu.fieldId)?.variable);
            if (newVar?.trim()) updateFieldWithUndo(contextMenu.fieldId, { variable: newVar.trim() });
            setContextMenu(null);
          }}>
            {Icons.text} Rename Variable
          </button>
          <div className="pdfb-ctx-sep"/>
          <button className="pdfb-ctx-item" onClick={() => {
            const f = fields.find(f => f.id === contextMenu.fieldId);
            if (f && canvasNaturalSize.width > 0) {
              updateFieldWithUndo(f.id, { x: (canvasNaturalSize.width - f.width) / 2 });
            }
            setContextMenu(null);
          }}>
            Center Horizontally
          </button>
          <button className="pdfb-ctx-item" onClick={() => {
            const f = fields.find(f => f.id === contextMenu.fieldId);
            if (f) updateFieldWithUndo(f.id, { x: 0 });
            setContextMenu(null);
          }}>
            Align Left
          </button>
          <button className="pdfb-ctx-item" onClick={() => {
            const f = fields.find(f => f.id === contextMenu.fieldId);
            if (f && canvasNaturalSize.width > 0) {
              updateFieldWithUndo(f.id, { x: canvasNaturalSize.width - f.width });
            }
            setContextMenu(null);
          }}>
            Align Right
          </button>
          <div className="pdfb-ctx-sep"/>
          <button className="pdfb-ctx-item danger" onClick={() => { removeField(contextMenu.fieldId); setContextMenu(null); }}>
            {Icons.trash} Delete <span className="pdfb-ctx-shortcut">Del</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Field Overlay Component ────────────────────────────────────────
// Renders a single draggable, resizable field on the canvas.
// All coordinates are stored in PDF points (natural/unscaled).
// Display position = naturalPos * scale
function FieldOverlay({
  field: f,
  scale,
  isSelected,
  onSelect,
  onUpdate,
  onUpdateWithUndo,
  onRemove,
  onContextMenu,
  onResizeStart,
  onResize,
  onResizeEnd,
  showDimTooltip,
  canvasNaturalSize
}) {
  const dragRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [resizeStart, setResizeStart] = useState(null);

  // Display position in pixels
  const displayX = f.x * scale;
  const displayY = f.y * scale;
  const displayW = f.width * scale;
  const displayH = f.height * scale;

  // Font size for display label
  const labelFontSize = f.type === 'text'
    ? Math.max(7, Math.min(f.height * 0.55 * scale, 14))
    : 11;

  // ─── Drag handlers ───────────────────────────────────────────────
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // left-click only
    if (e.target.closest('.pdfb-handle') || e.target.closest('.pdfb-field-delete')) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect();

    const startMouse = { x: e.clientX, y: e.clientY };
    const startPos = { x: f.x, y: f.y };
    let hasMoved = false;

    const onMove = (me) => {
      if (!hasMoved) {
        hasMoved = true;
        onUpdateWithUndo(f.id, {}); // push undo on first move
        setIsDragging(true);
      }
      const dx = (me.clientX - startMouse.x) / scale;
      const dy = (me.clientY - startMouse.y) / scale;
      const newX = Math.max(0, Math.min(startPos.x + dx, canvasNaturalSize.width - f.width));
      const newY = Math.max(0, Math.min(startPos.y + dy, canvasNaturalSize.height - f.height));
      onUpdate(f.id, { x: newX, y: newY });
    };

    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ─── Resize handlers ─────────────────────────────────────────────
  const handleResizeMouseDown = (e, handle) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();

    const startMouse = { x: e.clientX, y: e.clientY };
    const startRect = { x: f.x, y: f.y, w: f.width, h: f.height };
    let hasMoved = false;

    onResizeStart?.();

    const minW = f.type === 'image' ? 30 : (f.type === 'checkbox' ? 12 : 20);
    const minH = f.type === 'image' ? 20 : (f.type === 'checkbox' ? 12 : 10);

    const onMove = (me) => {
      if (!hasMoved) {
        hasMoved = true;
        onUpdateWithUndo(f.id, {}); // push undo on first resize
        setIsResizing(true);
      }

      const dx = (me.clientX - startMouse.x) / scale;
      const dy = (me.clientY - startMouse.y) / scale;

      let newX = startRect.x, newY = startRect.y, newW = startRect.w, newH = startRect.h;

      // Handle based on which corner/edge
      if (handle.includes('r')) { newW = Math.max(minW, startRect.w + dx); }
      if (handle.includes('l')) { newW = Math.max(minW, startRect.w - dx); newX = startRect.x + startRect.w - newW; }
      if (handle.includes('b')) { newH = Math.max(minH, startRect.h + dy); }
      if (handle.includes('t')) { newH = Math.max(minH, startRect.h - dy); newY = startRect.y + startRect.h - newH; }

      // Clamp to canvas
      newX = Math.max(0, newX);
      newY = Math.max(0, newY);
      if (newX + newW > canvasNaturalSize.width) newW = canvasNaturalSize.width - newX;
      if (newY + newH > canvasNaturalSize.height) newH = canvasNaturalSize.height - newY;

      onUpdate(f.id, { x: newX, y: newY, width: newW, height: newH });
      onResize?.(newW, newH);
    };

    const onUp = () => {
      setIsResizing(false);
      onResizeEnd?.();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const typeClass = `type-${f.type || 'text'}`;

  return (
    <div
      className={`pdfb-field ${typeClass}${isSelected ? ' selected' : ''}${!isDragging && !isResizing ? ' pdfb-field-new' : ''}`}
      style={{
        left: displayX,
        top: displayY,
        width: displayW,
        height: displayH,
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={onContextMenu}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div className="pdfb-field-inner">
        <span className="pdfb-field-label" style={{ fontSize: labelFontSize }}>
          {f.type === 'checkbox' ? `✓ ${f.matchValue || ''}` : `{{${f.variable}}}`}
        </span>
      </div>

      {/* Delete button */}
      <button className="pdfb-field-delete" onClick={(e) => { e.stopPropagation(); onRemove(f.id); }} title="Delete">×</button>

      {/* 8 Resize handles */}
      {['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'].map(h => (
        <div key={h} className={`pdfb-handle ${h}`} onMouseDown={(e) => handleResizeMouseDown(e, h)}/>
      ))}

      {/* Dimension tooltip during resize */}
      {showDimTooltip && (
        <div className="pdfb-dim-tooltip">
          {Math.round(showDimTooltip.w)} × {Math.round(showDimTooltip.h)} pt
        </div>
      )}
    </div>
  );
}
