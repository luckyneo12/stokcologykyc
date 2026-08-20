"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/utils/apiConfig";
import { UploadCloud, CheckCircle, Clock, Archive, Search, Eye, Edit2, Trash2, FileText, Image as ImageIcon, Copy, Check } from "lucide-react";

export default function EStamps({ searchQuery, onSearchChange }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [eStamps, setEStamps] = useState([]);
  const [stats, setStats] = useState({ totalUploaded: 0, totalUsed: 0, totalLeft: 0 });
  const [copiedKey, setCopiedKey] = useState(null);
  
  const [localSearch, setLocalSearch] = useState("");
  const search = searchQuery !== undefined ? searchQuery : localSearch;
  const setSearch = onSearchChange !== undefined ? onSearchChange : setLocalSearch;
  
  const [statusFilter, setStatusFilter] = useState("assigned"); // "all", "assigned", "available"
  
  const [loading, setLoading] = useState(true);

  const handleCopy = (text, key) => {
    if (!text || text === "Unextracted" || text === "—") return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  // Bulk Upload State
  const [showModal, setShowModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [extractedData, setExtractedData] = useState([]);
  const [duplicateInfo, setDuplicateInfo] = useState([]); // duplicate check results
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const fileInputRef = useRef(null);

  // Edit State
  const [editingStamp, setEditingStamp] = useState(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewPos, setPreviewPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchEStamps = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("adminToken");
      const url = new URL(`${API_BASE_URL}/api/admin/estamp`);
      if (search) url.searchParams.set("search", search);
      if (statusFilter) url.searchParams.set("status", statusFilter);
      url.searchParams.set("limit", "50");
      
      const [res, statsRes] = await Promise.all([
        fetch(url, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/admin/estamp/stats`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      const data = await res.json();
      const statsData = await statsRes.json();

      if (data.success) setEStamps(data.eStamps);
      if (statsData.success) setStats(statsData.stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchEStamps, 300);
    return () => clearTimeout(t);
  }, [search, statusFilter]);

  // ─── Check duplicates whenever extractedData changes ─────────────────
  const checkDuplicates = async (data) => {
    if (!data || data.length === 0) {
      setDuplicateInfo([]);
      return;
    }
    setIsCheckingDuplicates(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/estamp/check-duplicates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ stamps: data.map(d => ({ certificateNo: d.certificateNo, serialNo: d.serialNo })) })
      });
      const result = await res.json();
      if (result.success) {
        setDuplicateInfo(result.results);
      }
    } catch (e) {
      console.error("Duplicate check failed:", e);
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const Tesseract = (await import('tesseract.js')).default;
      const pdfjs = await import('pdfjs-dist/build/pdf');
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
      const { extractEStampEntries } = await import('@/utils/estampParser');

      const localResults = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isPdf = file.type === "application/pdf";
        const imageUrlsToOcr = [];

        if (isPdf) {
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: context, viewport }).promise;
            imageUrlsToOcr.push(canvas.toDataURL("image/png"));
          }
        } else {
          imageUrlsToOcr.push(URL.createObjectURL(file));
        }

        for (const imgUrl of imageUrlsToOcr) {
          console.log(`[OCR] Processing image for file: ${file.name}`);
          const { data: { text } } = await Tesseract.recognize(imgUrl, 'eng');
          const entries = extractEStampEntries(text);
          for (const entry of entries) {
            localResults.push({
              fileName: file.name,
              certificateNo: entry.certificateNo,
              serialNo: entry.serialNo,
              status: "pending_verification"
            });
          }
        }
      }

      // Now upload to backend
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }

      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/estamp/bulk-upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        // Map backend cloudinary URLs to our local OCR results based on filename
        const finalData = localResults.map(res => {
          const uploadedFile = data.files.find(f => f.originalName === res.fileName);
          return {
            ...res,
            fileUrl: uploadedFile ? uploadedFile.fileUrl : ""
          };
        });
        
        setExtractedData(finalData);
        await checkDuplicates(finalData);
      } else {
        alert("Upload failed: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Error processing files.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDataChange = (index, field, value) => {
    const newData = [...extractedData];
    newData[index][field] = value;
    setExtractedData(newData);
    // Re-check duplicates after edit (debounced)
    clearTimeout(window._dupCheckTimer);
    window._dupCheckTimer = setTimeout(() => checkDuplicates(newData), 500);
  };

  const handleRemoveItem = (index) => {
    const newData = [...extractedData];
    newData.splice(index, 1);
    setExtractedData(newData);
    // Update duplicate info
    const newDupInfo = [...duplicateInfo];
    newDupInfo.splice(index, 1);
    // Re-index
    setDuplicateInfo(newDupInfo.map((d, i) => ({ ...d, index: i })));
    checkDuplicates(newData);
  };

  const handleAddBlankRow = () => {
    const lastItem = extractedData[extractedData.length - 1];
    const newData = [...extractedData, {
      fileUrl: lastItem?.fileUrl || "",
      certificateNo: "",
      serialNo: "",
      status: "pending_verification"
    }];
    setExtractedData(newData);
  };

  const getDuplicateStatus = (index) => {
    if (!duplicateInfo || index >= duplicateInfo.length) return null;
    return duplicateInfo[index];
  };

  const saveConfirmedStamps = async () => {
    // Filter out duplicates
    const nonDuplicates = extractedData.filter((_, idx) => {
      const dupStatus = getDuplicateStatus(idx);
      return !dupStatus || !dupStatus.isDuplicate;
    });

    if (nonDuplicates.length === 0) {
      alert("No non-duplicate e-stamps to save. All items are either duplicates or empty.");
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/estamp/bulk-save`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ eStamps: nonDuplicates })
      });
      const data = await res.json();
      
      if (data.success) {
        let msg = data.message;
        if (data.duplicateCount > 0) {
          msg += `\n${data.duplicateCount} additional duplicates were caught during save.`;
        }
        if (data.errorCount > 0) {
          msg += `\n${data.errorCount} errors occurred.`;
        }
        alert(msg);
        setExtractedData([]);
        setDuplicateInfo([]);
        setShowModal(false);
        fetchEStamps();
      } else {
        alert("Save failed: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Error saving E-Stamps.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this available E-Stamp?")) return;
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/estamp/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchEStamps();
      } else {
        alert(data.error || "Delete failed");
      }
    } catch (e) {
      alert("Error deleting E-Stamp");
    }
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/estamp/${editingStamp.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ certificateNo: editingStamp.certificateNo, serialNo: editingStamp.serialNo })
      });
      const data = await res.json();
      if (data.success) {
        setEditingStamp(null);
        fetchEStamps();
      } else {
        alert(data.error || "Update failed");
      }
    } catch (e) {
      alert("Error updating E-Stamp");
    } finally {
      setIsUpdating(false);
    }
  };

  // Count non-duplicates
  const nonDuplicateCount = extractedData.filter((_, idx) => {
    const dupStatus = getDuplicateStatus(idx);
    return !dupStatus || !dupStatus.isDuplicate;
  }).length;

  const duplicateCount = extractedData.length - nonDuplicateCount;

  return (
    <div className="admin-animate">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 className="admin-section-title">E-Stamps Inventory</h1>
          <p className="admin-section-subtitle" style={{ marginBottom: 0 }}>Manage and assign digital e-stamps seamlessly</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          style={{
            padding: "12px 24px",
            background: "var(--text-primary)",
            color: "var(--bg-primary)",
            border: "none",
            borderRadius: 14,
            fontWeight: 700,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            transition: "transform 0.2s, box-shadow 0.2s"
          }}
          onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.2)"; }}
          onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)"; }}
        >
          <UploadCloud size={20} />
          Bulk Upload E-Stamps
        </button>
      </div>

      {/* Premium KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginBottom: 32 }}>
        {[
          { label: "Total Uploaded", value: stats.totalUploaded, icon: Archive, color: "#8b5cf6", filterVal: "all" },
          { label: "Total Used", value: stats.totalUsed, icon: Clock, color: "#f59e0b", filterVal: "assigned" },
          { label: "Available Left", value: stats.totalLeft, icon: CheckCircle, color: "#10b981", filterVal: "available" }
        ].map((kpi, i) => (
          <div 
            key={i} 
            onClick={() => setStatusFilter(kpi.filterVal)}
            style={{
              background: "var(--bg-primary)",
              border: `2px solid ${statusFilter === kpi.filterVal ? kpi.color : 'var(--border-color)'}`,
              borderRadius: 24,
              padding: "24px 28px",
              boxShadow: statusFilter === kpi.filterVal ? `0 8px 32px ${kpi.color}15` : "0 4px 24px rgba(0,0,0,0.02)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              position: "relative",
              overflow: "hidden",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{kpi.label}</div>
              <div style={{ color: "var(--text-primary)", fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-1px", lineHeight: 1 }}>{kpi.value}</div>
            </div>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: `${kpi.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <kpi.icon size={32} color={kpi.color} strokeWidth={2.5} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24, position: "relative" }}>
        <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}>
          <Search size={18} />
        </div>
        <input 
          className="admin-input global-search-input" 
          style={{ width: "100%", maxWidth: 480, paddingLeft: 44, fontSize: "0.95rem" }} 
          placeholder="Search by Certificate No or Serial No..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
        />
      </div>

      <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 24, overflow: "hidden", boxShadow: "var(--card-shadow)" }}>
        <div style={{ overflowX: "auto", userSelect: "text", WebkitUserSelect: "text" }}>
          <table className="admin-table" style={{ userSelect: "text", WebkitUserSelect: "text" }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: 24, width: 80 }}>Preview</th>
                <th>Certificate No</th>
                <th>Serial No</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th style={{ textAlign: "right", paddingRight: 24 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>Scanning inventory...</td></tr>
              ) : eStamps.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>No E-Stamps found matching your criteria.</td></tr>
              ) : (
                eStamps.map((stamp) => (
                  <tr key={stamp.id} style={{ transition: "all 0.2s" }}>
                    <td style={{ paddingLeft: 24 }}>
                      {stamp.fileUrl ? (
                        <a href={stamp.fileUrl} target="_blank" rel="noreferrer" style={{ display: "block", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-color)", width: 64, height: 44, background: "var(--bg-secondary)" }}>
                          <img src={stamp.fileUrl} alt="E-Stamp" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </a>
                      ) : (
                        <div style={{ width: 64, height: 44, borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                          <ImageIcon size={20} />
                        </div>
                      )}
                    </td>
                    <td style={{ userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 800, fontSize: "0.95rem", color: stamp.certificateNo ? "var(--text-primary)" : "var(--text-muted)", userSelect: "text", WebkitUserSelect: "text" }}>
                          {stamp.certificateNo || "Unextracted"}
                        </span>
                        {stamp.certificateNo && (
                          <button
                            onClick={() => handleCopy(stamp.certificateNo, `cert-${stamp.id}`)}
                            title="Copy Certificate Number"
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              padding: "2px 4px",
                              display: "inline-flex",
                              alignItems: "center",
                              color: copiedKey === `cert-${stamp.id}` ? "#16a34a" : "var(--text-muted)",
                              borderRadius: 4,
                              transition: "color 0.15s"
                            }}
                          >
                            {copiedKey === `cert-${stamp.id}` ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: "0.9rem", color: stamp.serialNo ? "var(--text-secondary)" : "var(--text-muted)", fontFamily: "var(--font-mono)", userSelect: "text", WebkitUserSelect: "text" }}>
                          {stamp.serialNo || "—"}
                        </span>
                        {stamp.serialNo && (
                          <button
                            onClick={() => handleCopy(stamp.serialNo, `serial-${stamp.id}`)}
                            title="Copy Serial Number"
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              padding: "2px 4px",
                              display: "inline-flex",
                              alignItems: "center",
                              color: copiedKey === `serial-${stamp.id}` ? "#16a34a" : "var(--text-muted)",
                              borderRadius: 4,
                              transition: "color 0.15s"
                            }}
                          >
                            {copiedKey === `serial-${stamp.id}` ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${stamp.status === "available" ? "badge-verified" : "badge-review"}`}>
                        {stamp.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                      {stamp.status === "assigned" ? (
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.85rem", userSelect: "text" }}>{stamp.userName}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", userSelect: "text" }}>{stamp.kycApplicationId || stamp.assignedTo}</div>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 600 }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", paddingRight: 24 }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        {stamp.status !== "available" && stamp.assignedTo && (
                          <button onClick={() => stamp.kycApplicationId ? router.push(`/admin/maker-checker/${stamp.kycApplicationId}`) : router.push(`/admin/user/${stamp.assignedTo}`)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontWeight: 700, fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => { e.currentTarget.style.background = "var(--bg-card)"; e.currentTarget.style.borderColor = "var(--text-primary)"; }} onMouseOut={e => { e.currentTarget.style.background = "var(--bg-secondary)"; e.currentTarget.style.borderColor = "var(--border-color)"; }}>
                            <Eye size={14} /> View KYC
                          </button>
                        )}
                        <button onClick={() => { setEditingStamp({ id: stamp.id, certificateNo: stamp.certificateNo, serialNo: stamp.serialNo, fileUrl: stamp.fileUrl }); setPreviewScale(1); setPreviewPos({ x: 0, y: 0 }); }} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }} title="Edit" onMouseOver={e => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.borderColor = "var(--text-primary)"; }} onMouseOut={e => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.borderColor = "var(--border-color)"; }}>
                          <Edit2 size={16} />
                        </button>
                        {stamp.status === "available" && (
                          <button onClick={() => handleDelete(stamp.id)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "#e5484d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }} title="Delete" onMouseOver={e => { e.currentTarget.style.background = "#e5484d"; e.currentTarget.style.color = "white"; e.currentTarget.style.borderColor = "#e5484d"; }} onMouseOut={e => { e.currentTarget.style.background = "var(--bg-secondary)"; e.currentTarget.style.color = "#e5484d"; e.currentTarget.style.borderColor = "var(--border-color)"; }}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Upload Modal */}
      {mounted && showModal && createPortal(
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          background: "rgba(0,0,0,0.6)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            background: "var(--bg-primary)", width: "90%", maxWidth: 1000,
            borderRadius: 12, padding: 24, maxHeight: "90vh", display: "flex", flexDirection: "column"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, color: "var(--text-primary)" }}>Bulk Upload E-Stamps</h2>
              <button onClick={() => { setShowModal(false); setExtractedData([]); setDuplicateInfo([]); }} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "var(--text-muted)" }}>&times;</button>
            </div>

            {extractedData.length === 0 ? (
              <div style={{
                border: "2px dashed var(--border-color)", borderRadius: 12, padding: "60px 20px",
                textAlign: "center", cursor: isUploading ? "default" : "pointer", background: "var(--bg-secondary)",
                opacity: isUploading ? 0.6 : 1
              }} onClick={() => !isUploading && fileInputRef.current.click()}>
                <div style={{ fontSize: "2rem", marginBottom: 10 }}>📁</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
                  Click to select multiple E-Stamp images
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Supports PNG, JPEG, and PDF. Multipage PDFs will be split automatically. OCR extracts details.</div>
                <input 
                  type="file" 
                  multiple 
                  accept="image/png, image/jpeg, image/jpg, application/pdf" 
                  ref={fileInputRef} 
                  style={{ display: "none" }} 
                  onChange={handleFileSelect}
                />
                {isUploading && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ color: "var(--wise-green)", fontWeight: 600, marginBottom: 8 }}>Analyzing & Extracting with OCR... Please wait.</div>
                    <div style={{ width: 200, height: 4, background: "var(--border-color)", borderRadius: 4, margin: "0 auto", overflow: "hidden" }}>
                      <div style={{ 
                        width: "60%", height: "100%", background: "var(--wise-green)", borderRadius: 4,
                        animation: "pulse 1.5s ease-in-out infinite"
                      }} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {/* Summary bar */}
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <div style={{ 
                    flex: 1, background: "rgba(48, 164, 108, 0.08)", padding: "10px 14px", 
                    borderRadius: 8, border: "1px solid rgba(48, 164, 108, 0.2)" 
                  }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Total Extracted</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--wise-green)" }}>{extractedData.length}</div>
                  </div>
                  <div style={{ 
                    flex: 1, background: "rgba(0, 145, 255, 0.08)", padding: "10px 14px", 
                    borderRadius: 8, border: "1px solid rgba(0, 145, 255, 0.2)" 
                  }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Ready to Save</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#0091ff" }}>{nonDuplicateCount}</div>
                  </div>
                  {duplicateCount > 0 && (
                    <div style={{ 
                      flex: 1, background: "rgba(229, 72, 77, 0.08)", padding: "10px 14px", 
                      borderRadius: 8, border: "1px solid rgba(229, 72, 77, 0.2)" 
                    }}>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Duplicates</div>
                      <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#e5484d" }}>{duplicateCount}</div>
                    </div>
                  )}
                </div>

                <div style={{ background: "rgba(255, 178, 36, 0.1)", color: "#ffb224", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: "0.9rem" }}>
                  <strong>Verify OCR Extraction:</strong> Review the extracted Certificate No and Serial No. You can edit them directly. Duplicates are auto-detected and highlighted in red.
                </div>
                
                <div style={{ overflowY: "auto", flex: 1, border: "1px solid var(--border-color)", borderRadius: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ background: "var(--bg-secondary)", position: "sticky", top: 0, zIndex: 1 }}>
                      <tr>
                        <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid var(--border-color)", width: "50px" }}>#</th>
                        <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid var(--border-color)", width: "100px" }}>Image</th>
                        <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid var(--border-color)" }}>Certificate No.</th>
                        <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid var(--border-color)" }}>Serial No.</th>
                        <th style={{ padding: 12, textAlign: "center", borderBottom: "1px solid var(--border-color)", width: "120px" }}>Status</th>
                        <th style={{ padding: 12, textAlign: "center", borderBottom: "1px solid var(--border-color)", width: "60px" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedData.map((item, idx) => {
                        const dupStatus = getDuplicateStatus(idx);
                        const isDup = dupStatus && dupStatus.isDuplicate;
                        
                        return (
                          <tr key={idx} style={{ 
                            borderBottom: "1px solid var(--border-color)",
                            background: isDup ? "rgba(229, 72, 77, 0.04)" : "transparent",
                            opacity: isDup ? 0.7 : 1
                          }}>
                            <td style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: "0.85rem" }}>{idx + 1}</td>
                            <td style={{ padding: 8 }}>
                              <a href={item.fileUrl} target="_blank" rel="noreferrer">
                                <img src={item.fileUrl} alt="preview" style={{ width: 70, height: 45, objectFit: "cover", borderRadius: 4, border: "1px solid #ddd" }} />
                              </a>
                            </td>
                            <td style={{ padding: 8 }}>
                              <input 
                                type="text" 
                                className="admin-input" 
                                value={item.certificateNo} 
                                onChange={(e) => handleDataChange(idx, "certificateNo", e.target.value)}
                                placeholder="IN-XXXXXXX"
                                style={{ 
                                  borderColor: isDup && dupStatus.duplicateReason.includes("Certificate") ? "#e5484d" : undefined 
                                }}
                              />
                            </td>
                            <td style={{ padding: 8 }}>
                              <input 
                                type="text" 
                                className="admin-input" 
                                value={item.serialNo} 
                                onChange={(e) => handleDataChange(idx, "serialNo", e.target.value)}
                                placeholder="e.g. 123456"
                                style={{ 
                                  color: "#d93025", fontWeight: 600,
                                  borderColor: isDup && dupStatus.duplicateReason.includes("Serial") ? "#e5484d" : undefined
                                }}
                              />
                            </td>
                            <td style={{ padding: 8, textAlign: "center" }}>
                              {isDup ? (
                                <div>
                                  <span style={{
                                    display: "inline-block",
                                    padding: "3px 8px", borderRadius: 4, fontSize: "0.7rem", fontWeight: 700,
                                    background: "rgba(229, 72, 77, 0.12)", color: "#e5484d",
                                    letterSpacing: "0.5px"
                                  }}>
                                    DUPLICATE
                                  </span>
                                  <div style={{ fontSize: "0.7rem", color: "#e5484d", marginTop: 4, maxWidth: 180, lineHeight: 1.2 }}>
                                    {dupStatus.duplicateReason}
                                  </div>
                                </div>
                              ) : (
                                (!item.certificateNo && !item.serialNo) ? (
                                  <span style={{
                                    padding: "3px 8px", borderRadius: 4, fontSize: "0.7rem", fontWeight: 700,
                                    background: "rgba(255, 178, 36, 0.12)", color: "#ffb224"
                                  }}>
                                    NEEDS INPUT
                                  </span>
                                ) : (
                                  <span style={{
                                    padding: "3px 8px", borderRadius: 4, fontSize: "0.7rem", fontWeight: 700,
                                    background: "rgba(48, 164, 108, 0.12)", color: "var(--wise-green)"
                                  }}>
                                    READY
                                  </span>
                                )
                              )}
                            </td>
                            <td style={{ padding: 8, textAlign: "center" }}>
                              <button 
                                onClick={() => handleRemoveItem(idx)}
                                style={{ background: "none", border: "none", color: "#e5484d", cursor: "pointer", fontSize: "1.2rem" }}
                                title="Remove"
                              >
                                &times;
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
                  <button 
                    onClick={handleAddBlankRow}
                    style={{
                      padding: "8px 16px", background: "var(--bg-secondary)", color: "var(--text-primary)",
                      border: "1px dashed var(--border-color)", borderRadius: 8, cursor: "pointer", fontSize: "0.9rem"
                    }}
                  >
                    + Add Blank Row
                  </button>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button className="admin-btn-outline" onClick={() => { setExtractedData([]); setDuplicateInfo([]); }} disabled={isSaving}>Cancel</button>
                    <button 
                      onClick={saveConfirmedStamps}
                      disabled={isSaving || nonDuplicateCount === 0}
                      style={{
                        padding: "10px 24px", background: "var(--wise-green)", color: "white", border: "none",
                        borderRadius: 8, fontWeight: 600, 
                        cursor: (isSaving || nonDuplicateCount === 0) ? "not-allowed" : "pointer", 
                        opacity: (isSaving || nonDuplicateCount === 0) ? 0.7 : 1
                      }}
                    >
                      {isSaving ? "Saving..." : `Confirm & Save ${nonDuplicateCount} E-Stamps`}
                      {duplicateCount > 0 && !isSaving && ` (${duplicateCount} duplicates skipped)`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
      {/* Premium Edit Modal */}
      {mounted && editingStamp && createPortal(
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          background: "rgba(0,0,0,0.6)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            background: "var(--bg-primary)", width: "90%", maxWidth: 850,
            borderRadius: 20, padding: 32, boxShadow: "0 24px 60px rgba(0,0,0,0.15), 0 0 0 1px var(--border-color)",
            display: "flex", flexDirection: "column", gap: 24, position: "relative"
          }}>
            <button 
              onClick={() => { setEditingStamp(null); setPreviewScale(1); setPreviewPos({ x: 0, y: 0 }); }} 
              style={{ position: "absolute", top: 24, right: 24, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)", transition: "all 0.2s" }}
            >
              &times;
            </button>

            <div>
              <h3 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>Edit E-Stamp</h3>
              <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "0.95rem" }}>Update the certificate or serial number for this document.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>
              {/* Left Column: Image Preview */}
              <div style={{
                background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border-color)",
                overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", height: 320, position: "relative"
              }}>
                {editingStamp.fileUrl ? (
                  editingStamp.fileUrl.toLowerCase().includes('.pdf') ? (
                    <object 
                      data={`/api/pdf-proxy?url=${encodeURIComponent(editingStamp.fileUrl)}`}
                      type="application/pdf"
                      width="100%"
                      height="100%"
                      style={{ borderRadius: 8 }}
                    >
                      <p>PDF cannot be displayed. <a href={editingStamp.fileUrl} target="_blank">Download</a></p>
                    </object>
                  ) : (
                    <div 
                      style={{ width: "100%", height: "100%", overflow: "hidden", cursor: isDragging ? "grabbing" : (previewScale > 1 ? "grab" : "zoom-in") }}
                      onWheel={e => setPreviewScale(prev => Math.min(Math.max(1, prev + (e.deltaY > 0 ? -0.2 : 0.2)), 5))}
                      onMouseDown={e => {
                        if (previewScale > 1) {
                          setIsDragging(true);
                          setDragStart({ x: e.clientX - previewPos.x, y: e.clientY - previewPos.y });
                        }
                      }}
                      onMouseMove={e => {
                        if (isDragging) {
                          setPreviewPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
                        }
                      }}
                      onMouseUp={() => setIsDragging(false)}
                      onMouseLeave={() => setIsDragging(false)}
                    >
                      <img 
                        src={editingStamp.fileUrl} 
                        alt="E-Stamp Preview" 
                        draggable={false}
                        style={{ 
                          width: "100%", height: "100%", objectFit: "contain", background: "rgba(0,0,0,0.05)", 
                          transform: `translate(${previewPos.x}px, ${previewPos.y}px) scale(${previewScale})`, 
                          transformOrigin: "center", 
                          transition: isDragging ? "none" : "transform 0.15s ease-out" 
                        }} 
                      />
                    </div>
                  )
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "var(--text-muted)" }}>
                    <ImageIcon size={48} opacity={0.5} />
                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>No image available</span>
                  </div>
                )}
                {editingStamp.fileUrl && !editingStamp.fileUrl.toLowerCase().includes('.pdf') && (
                  <a href={editingStamp.fileUrl} target="_blank" rel="noreferrer" style={{
                    position: "absolute", bottom: 16, right: 16, background: "rgba(0,0,0,0.75)", color: "white", padding: "6px 12px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 700, textDecoration: "none", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", gap: 6, transition: "background 0.2s"
                  }}>
                    <Eye size={14} /> Full Size
                  </a>
                )}
              </div>

              {/* Right Column: Form Fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24, height: "100%", justifyContent: "center" }}>
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    Certificate No
                  </label>
                  <input 
                    className="admin-input" 
                    value={editingStamp.certificateNo || ""} 
                    onChange={e => setEditingStamp({...editingStamp, certificateNo: e.target.value})} 
                    placeholder="e.g. IN-DL..."
                    style={{ width: "100%", padding: "12px 16px", fontSize: "1rem", borderRadius: 10, background: "var(--bg-secondary)", border: "2px solid var(--border-color)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    Serial No
                  </label>
                  <input 
                    className="admin-input" 
                    value={editingStamp.serialNo || ""} 
                    onChange={e => setEditingStamp({...editingStamp, serialNo: e.target.value})} 
                    placeholder="e.g. 61828003"
                    style={{ width: "100%", padding: "12px 16px", fontSize: "1rem", borderRadius: 10, background: "var(--bg-secondary)", border: "2px solid var(--border-color)" }}
                  />
                </div>
                
                <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                  <button 
                    onClick={() => { setEditingStamp(null); setPreviewScale(1); setPreviewPos({ x: 0, y: 0 }); }} 
                    disabled={isUpdating}
                    style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", fontWeight: 700, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    style={{ flex: 2, padding: "12px 0", background: "var(--wise-green)", color: "white", border: "none", borderRadius: 10, fontWeight: 700, fontSize: "1rem", cursor: isUpdating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    {isUpdating ? "Saving Changes..." : (
                      <>
                        <CheckCircle size={18} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
