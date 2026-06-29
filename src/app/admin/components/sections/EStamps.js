"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/utils/apiConfig";

export default function EStamps({ searchQuery, onSearchChange }) {
  const router = useRouter();
  const [eStamps, setEStamps] = useState([]);
  const [stats, setStats] = useState({ totalUploaded: 0, totalUsed: 0, totalLeft: 0 });
  
  const [localSearch, setLocalSearch] = useState("");
  const search = searchQuery !== undefined ? searchQuery : localSearch;
  const setSearch = onSearchChange !== undefined ? onSearchChange : setLocalSearch;
  
  const [statusFilter, setStatusFilter] = useState("assigned"); // "all", "assigned", "available"
  
  const [loading, setLoading] = useState(true);

  // Bulk Upload State
  const [showModal, setShowModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [extractedData, setExtractedData] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Edit State
  const [editingStamp, setEditingStamp] = useState(null);
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

  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/estamp/bulk-upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setExtractedData(data.extractedData);
      } else {
        alert("Upload failed: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Error uploading files.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDataChange = (index, field, value) => {
    const newData = [...extractedData];
    newData[index][field] = value;
    setExtractedData(newData);
  };

  const handleRemoveItem = (index) => {
    const newData = [...extractedData];
    newData.splice(index, 1);
    setExtractedData(newData);
  };

  const saveConfirmedStamps = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/estamp/bulk-save`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ eStamps: extractedData })
      });
      const data = await res.json();
      
      if (data.success) {
        alert(data.message);
        setExtractedData([]);
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

  return (
    <div className="admin-animate">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 className="admin-section-title">E-Stamps Inventory</h1>
          <p className="admin-section-subtitle">Manage and assign digital e-stamps</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          style={{
            padding: "10px 20px",
            background: "var(--wise-green)",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(48, 164, 108, 0.2)"
          }}
        >
          + Bulk Upload E-Stamps
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 24 }}>
        {[
          { label: "Total Uploaded", value: stats.totalUploaded, color: "#0091ff", filterVal: "all" },
          { label: "Total Used", value: stats.totalUsed, color: "#e5484d", filterVal: "assigned" },
          { label: "Available Left", value: stats.totalLeft, color: "var(--wise-green)", filterVal: "available" }
        ].map((kpi, i) => (
          <div 
            key={i} 
            onClick={() => setStatusFilter(kpi.filterVal)}
            style={{
              background: statusFilter === kpi.filterVal ? `rgba(${kpi.color === "var(--wise-green)" ? "48, 164, 108" : kpi.color === "#0091ff" ? "0, 145, 255" : "229, 72, 77"}, 0.05)` : "var(--bg-secondary)", 
              padding: 20, 
              borderRadius: 12,
              border: "1px solid var(--border-color)", 
              borderLeft: `4px solid ${kpi.color}`,
              cursor: "pointer",
              transition: "all 0.2s ease",
              opacity: statusFilter === kpi.filterVal ? 1 : 0.6
            }}
          >
            <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontWeight: 500, marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ color: "var(--text-primary)", fontSize: "1.8rem", fontWeight: 700 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <input 
          className="admin-input" 
          style={{ width: 420 }} 
          placeholder="Search by Certificate No or Serial No" 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
        />
      </div>

      <div className="admin-table-container">
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "100px 1.5fr 1.5fr 1fr 1.5fr 100px", 
          gap: 10, 
          alignItems: "center", 
          padding: "14px 10px", 
          borderBottom: "2px solid var(--border-color)", 
          color: "var(--text-primary)", 
          fontWeight: 600, 
          fontSize: "0.95rem", 
          background: "var(--bg-secondary)" 
        }}>
          <div>Preview</div>
          <div>Certificate No</div>
          <div>Serial No</div>
          <div>Status</div>
          <div>Assigned To</div>
          <div style={{ textAlign: "center" }}>Action</div>
        </div>

        <div style={{ maxHeight: "60vh", overflowY: "auto", background: "var(--bg-primary)" }}>
          {loading ? (
            <div style={{ padding: 16, color: "var(--text-muted)" }}>Loading e-stamps...</div>
          ) : eStamps.length === 0 ? (
            <div style={{ padding: 16, color: "var(--text-muted)" }}>No e-stamps found.</div>
          ) : (
            eStamps.map((stamp, idx) => (
              <div 
                key={stamp.id} 
                style={{ 
                  display: "grid", 
                  gridTemplateColumns: "100px 1.5fr 1.5fr 1fr 1.5fr 100px", 
                  alignItems: "center", 
                  gap: 10,
                  padding: "12px 10px", 
                  borderBottom: "1px solid var(--border-color)", 
                  background: "var(--bg-secondary)",
                  transition: "all 0.2s ease"
                }}
              >
                <div>
                  {stamp.fileUrl ? (
                    <a href={stamp.fileUrl} target="_blank" rel="noreferrer">
                      <img src={stamp.fileUrl} alt="E-Stamp" style={{ width: 60, height: 40, objectFit: "cover", borderRadius: 4, border: "1px solid #ddd" }} />
                    </a>
                  ) : <div style={{ fontSize: "0.8rem", color: "#888" }}>No Image</div>}
                </div>

                <div style={{ fontWeight: 700, color: "var(--wise-green)", letterSpacing: "1px" }}>
                  {stamp.certificateNo}
                </div>

                <div style={{ fontWeight: 600, color: "#d93025" }}>
                  {stamp.serialNo}
                </div>

                <div>
                  <span style={{
                    padding: "4px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: 700,
                    background: stamp.status === "available" ? "rgba(48, 164, 108, 0.1)" : "rgba(229, 72, 77, 0.1)",
                    color: stamp.status === "available" ? "var(--wise-green)" : "#e5484d"
                  }}>
                    {stamp.status.toUpperCase()}
                  </span>
                </div>

                <div style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>
                  {stamp.status === "assigned" ? (
                    <div>
                      <div>{stamp.userName}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>ID: {stamp.kycApplicationId || stamp.assignedTo}</div>
                    </div>
                  ) : "-"}
                </div>

                <div style={{ textAlign: "center", display: "flex", gap: 10, justifyContent: "center", alignItems: "center" }}>
                  {stamp.status === "available" ? (
                    <>
                      <button 
                        onClick={() => setEditingStamp({ id: stamp.id, certificateNo: stamp.certificateNo, serialNo: stamp.serialNo })}
                        style={{ background: "none", border: "none", color: "var(--wise-green)", cursor: "pointer", fontSize: "1.1rem" }}
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button 
                        onClick={() => handleDelete(stamp.id)}
                        style={{ background: "none", border: "none", color: "#e5484d", cursor: "pointer", fontSize: "1.1rem" }}
                        title="Delete"
                      >
                        🗑
                      </button>
                    </>
                  ) : (
                    stamp.assignedTo && (
                      <button 
                        onClick={() => stamp.kycApplicationId ? router.push(`/admin/application/${stamp.kycApplicationId}`) : router.push(`/admin/user/${stamp.assignedTo}`)}
                        className="admin-btn-outline"
                        style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                      >
                        View User
                      </button>
                    )
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bulk Upload Modal */}
      {showModal && (
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
              <button onClick={() => { setShowModal(false); setExtractedData([]); }} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "var(--text-muted)" }}>&times;</button>
            </div>

            {extractedData.length === 0 ? (
              <div style={{
                border: "2px dashed var(--border-color)", borderRadius: 12, padding: "60px 20px",
                textAlign: "center", cursor: "pointer", background: "var(--bg-secondary)"
              }} onClick={() => fileInputRef.current.click()}>
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
                {isUploading && <div style={{ marginTop: 20, color: "var(--wise-green)", fontWeight: 600 }}>Analyzing & Extracting with OCR... Please wait.</div>}
              </div>
            ) : (
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ background: "rgba(255, 178, 36, 0.1)", color: "#ffb224", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: "0.9rem" }}>
                  <strong>Verify OCR Extraction:</strong> Please review the extracted Certificate No and Serial No. You can edit them directly if the OCR missed them.
                </div>
                
                <div style={{ overflowY: "auto", flex: 1, border: "1px solid var(--border-color)", borderRadius: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ background: "var(--bg-secondary)", position: "sticky", top: 0, zIndex: 1 }}>
                      <tr>
                        <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid var(--border-color)", width: "100px" }}>Image</th>
                        <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid var(--border-color)" }}>Certificate No.</th>
                        <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid var(--border-color)" }}>Serial No. (Red)</th>
                        <th style={{ padding: 12, textAlign: "center", borderBottom: "1px solid var(--border-color)", width: "80px" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedData.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--border-color)" }}>
                          <td style={{ padding: 12 }}>
                            <a href={item.fileUrl} target="_blank" rel="noreferrer">
                              <img src={item.fileUrl} alt="preview" style={{ width: 80, height: 50, objectFit: "cover", borderRadius: 4, border: "1px solid #ddd" }} />
                            </a>
                          </td>
                          <td style={{ padding: 12 }}>
                            <input 
                              type="text" 
                              className="admin-input" 
                              value={item.certificateNo} 
                              onChange={(e) => handleDataChange(idx, "certificateNo", e.target.value)}
                              placeholder="IN-XXXXXXX"
                            />
                          </td>
                          <td style={{ padding: 12 }}>
                            <input 
                              type="text" 
                              className="admin-input" 
                              value={item.serialNo} 
                              onChange={(e) => handleDataChange(idx, "serialNo", e.target.value)}
                              placeholder="e.g. 123456"
                              style={{ color: "#d93025", fontWeight: 600 }}
                            />
                          </td>
                          <td style={{ padding: 12, textAlign: "center" }}>
                            <button 
                              onClick={() => handleRemoveItem(idx)}
                              style={{ background: "none", border: "none", color: "#e5484d", cursor: "pointer", fontSize: "1.2rem" }}
                              title="Remove"
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
                  <button className="admin-btn-outline" onClick={() => setExtractedData([])} disabled={isSaving}>Cancel</button>
                  <button 
                    onClick={saveConfirmedStamps}
                    disabled={isSaving}
                    style={{
                      padding: "10px 24px", background: "var(--wise-green)", color: "white", border: "none",
                      borderRadius: 8, fontWeight: 600, cursor: isSaving ? "not-allowed" : "pointer", opacity: isSaving ? 0.7 : 1
                    }}
                  >
                    {isSaving ? "Saving..." : `Confirm & Save ${extractedData.length} E-Stamps`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Edit Modal */}
      {editingStamp && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          background: "rgba(0,0,0,0.6)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            background: "var(--bg-primary)", width: 400,
            borderRadius: 12, padding: 24, boxShadow: "0 10px 40px rgba(0,0,0,0.2)"
          }}>
            <h3 style={{ marginTop: 0, marginBottom: 20 }}>Edit E-Stamp</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", color: "var(--text-muted)" }}>Certificate No</label>
              <input 
                className="admin-input" 
                value={editingStamp.certificateNo} 
                onChange={e => setEditingStamp({...editingStamp, certificateNo: e.target.value})} 
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", color: "var(--text-muted)" }}>Serial No</label>
              <input 
                className="admin-input" 
                value={editingStamp.serialNo} 
                onChange={e => setEditingStamp({...editingStamp, serialNo: e.target.value})} 
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button className="admin-btn-outline" onClick={() => setEditingStamp(null)} disabled={isUpdating}>Cancel</button>
              <button 
                onClick={handleUpdate}
                disabled={isUpdating}
                style={{ padding: "8px 16px", background: "var(--wise-green)", color: "white", border: "none", borderRadius: 8, cursor: isUpdating ? "not-allowed" : "pointer" }}
              >
                {isUpdating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
