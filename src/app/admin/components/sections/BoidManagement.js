import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "@/utils/apiConfig";
import { Upload, FileText, CheckCircle, Clock, Edit2, Check, X } from "lucide-react";

export default function BoidManagement() {
  const [boids, setBoids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, available: 0, assigned: 0, cooling_period: 0 });
  const [statusFilter, setStatusFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState(null);

  const fetchBoids = async (p = 1) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/boids?page=${p}&limit=50&status=${statusFilter}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setBoids(data.boids);
        setTotalPages(data.totalPages);
        if (data.stats) setStats(data.stats);
        setPage(data.page);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoids(1);
  }, [statusFilter]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/boids/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: data.message });
        setFile(null);
        fetchBoids(1);
        setTimeout(() => setMessage(null), 4000);
      } else {
        setMessage({ type: "error", text: data.error });
        setTimeout(() => setMessage(null), 4000);
      }
    } catch (e) {
      setMessage({ type: "error", text: "Upload failed." });
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setUploading(false);
    }
  };

  const saveEdit = async (id) => {
    if (!editValue.trim()) return;
    setSavingId(id);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/boids/${id}`, {
        method: "PUT",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ boidNumber: editValue })
      });
      const data = await res.json();
      if (data.success) {
        setEditingId(null);
        setMessage({ type: "success", text: "BOID updated successfully!" });
        fetchBoids(page);
        
        // Auto-clear success message after 3 seconds
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update BOID" });
        setTimeout(() => setMessage(null), 4000);
      }
    } catch (e) {
      console.error(e);
      setMessage({ type: "error", text: "An unexpected error occurred while saving." });
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="section-container" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24, height: "100%", position: "relative" }}>
      {/* Toast Notification */}
      {message && (
        <div style={{
          position: "fixed",
          top: 32,
          right: 32,
          zIndex: 9999,
          padding: "16px 24px",
          borderRadius: 12,
          background: message.type === "error" ? "#fff" : "#fff",
          color: message.type === "error" ? "var(--wise-red)" : "var(--wise-green)",
          border: `1px solid ${message.type === "error" ? "var(--wise-red-alpha)" : "var(--wise-green-alpha)"}`,
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: "0.95rem",
          fontWeight: 600,
          animation: "slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
        }}>
          {message.type === "error" ? <X size={20} /> : <CheckCircle size={20} />}
          {message.text}
          <style>{`
            @keyframes slideIn {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>BOID Management</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: 4 }}>Manage and allocate Beneficiary Owner Identification (BOID) numbers.</p>
        </div>
      </div>

      {/* KPI Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <div 
          onClick={() => setStatusFilter("all")}
          style={{ 
            background: statusFilter === "all" ? "var(--bg-secondary)" : "var(--bg-primary)", 
            padding: "16px 20px", borderRadius: 12, border: "1px solid var(--border-color)", 
            display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            cursor: "pointer", transition: "all 0.2s ease", transform: statusFilter === "all" ? "translateY(-2px)" : "none"
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Total BOIDs</span>
          <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text-primary)" }}>{stats.total.toLocaleString()}</span>
        </div>
        <div 
          onClick={() => setStatusFilter("available")}
          style={{ 
            background: statusFilter === "available" ? "rgba(48,164,108,0.05)" : "var(--bg-primary)", 
            padding: "16px 20px", borderRadius: 12, border: "1px solid rgba(48,164,108,0.2)", borderLeft: "4px solid #30a46c", 
            display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 1px 3px rgba(48,164,108,0.05)",
            cursor: "pointer", transition: "all 0.2s ease", transform: statusFilter === "available" ? "translateY(-2px)" : "none"
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Available</span>
          <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "#30a46c" }}>{stats.available.toLocaleString()}</span>
        </div>
        <div 
          onClick={() => setStatusFilter("assigned")}
          style={{ 
            background: statusFilter === "assigned" ? "rgba(0,145,255,0.05)" : "var(--bg-primary)", 
            padding: "16px 20px", borderRadius: 12, border: "1px solid rgba(0,145,255,0.2)", borderLeft: "4px solid #0091ff", 
            display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 1px 3px rgba(0,145,255,0.05)",
            cursor: "pointer", transition: "all 0.2s ease", transform: statusFilter === "assigned" ? "translateY(-2px)" : "none"
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Assigned</span>
          <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "#0091ff" }}>{stats.assigned.toLocaleString()}</span>
        </div>
        <div 
          onClick={() => setStatusFilter("cooling_period")}
          style={{ 
            background: statusFilter === "cooling_period" ? "rgba(245,166,35,0.05)" : "var(--bg-primary)", 
            padding: "16px 20px", borderRadius: 12, border: "1px solid rgba(245,166,35,0.2)", borderLeft: "4px solid #f5a623", 
            display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 1px 3px rgba(245,166,35,0.05)",
            cursor: "pointer", transition: "all 0.2s ease", transform: statusFilter === "cooling_period" ? "translateY(-2px)" : "none"
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Cooling Period</span>
          <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "#f5a623" }}>{stats.cooling_period.toLocaleString()}</span>
        </div>
      </div>

      <div style={{ background: "var(--bg-primary)", padding: 24, borderRadius: 12, border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 16 }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>Upload BOID File</h3>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>Upload a .txt file containing one BOID number per line. The prefix "IN300966" will be added automatically.</p>
        
        <div style={{ display: "flex", alignItems: "stretch", gap: 16 }}>
          <label 
            style={{ 
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              border: "1.5px dashed var(--border-color)",
              borderRadius: 10,
              background: "var(--bg-elevated)",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = "#30a46c"}
            onMouseOut={e => e.currentTarget.style.borderColor = "var(--border-color)"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ padding: 8, background: "var(--bg-primary)", borderRadius: 8, border: "1px solid var(--border-color)" }}>
                <FileText size={18} color="var(--text-muted)" />
              </div>
              <span style={{ fontSize: "0.9rem", color: file ? "var(--text-primary)" : "var(--text-muted)", fontWeight: 500 }}>
                {file ? file.name : "Click to select a .txt or .csv file"}
              </span>
            </div>
            {file && <span style={{ fontSize: "0.75rem", background: "var(--bg-primary)", padding: "4px 8px", borderRadius: 6, color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>{(file.size / 1024).toFixed(1)} KB</span>}
            <input 
              type="file" 
              accept=".txt,.csv" 
              onChange={e => setFile(e.target.files[0])}
              style={{ display: "none" }} 
            />
          </label>
          <button 
            onClick={handleUpload}
            disabled={!file || uploading}
            style={{ 
              padding: "10px 20px", 
              borderRadius: 999, 
              border: "none", 
              background: file ? "linear-gradient(135deg, #30a46c, #228b54)" : "var(--bg-elevated)", 
              color: file ? "#fff" : "var(--text-muted)",
              fontWeight: 600, 
              fontSize: "0.85rem", 
              cursor: file && !uploading ? "pointer" : "not-allowed",
              boxShadow: file ? "0 2px 8px rgba(48,164,108,0.25)" : "none",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap"
            }}
          >
            <Upload size={18} />
            {uploading ? "Uploading..." : "Upload BOIDs"}
          </button>
        </div>
      </div>

      <div style={{ background: "var(--bg-primary)", borderRadius: 12, border: "1px solid var(--border-color)", flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>BOID Inventory</h3>
          <div className="filter-dropdown-container" style={{ position: "relative", width: "180px" }}>
            <button 
              onClick={() => setFilterOpen(!filterOpen)}
              style={{ 
                width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", 
                background: "var(--bg-primary)", color: "var(--text-primary)", fontWeight: 600, fontSize: "0.85rem",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {statusFilter === "all" ? "All BOIDs" : statusFilter.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ transform: filterOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            {filterOpen && (
              <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 10, padding: "4px 0", overflow: "hidden" }}>
                {[
                  { value: "all", label: "All BOIDs" },
                  { value: "available", label: "Available" },
                  { value: "assigned", label: "Assigned" },
                  { value: "cooling_period", label: "Cooling Period" }
                ].map(opt => (
                  <div 
                    key={opt.value}
                    onClick={() => { setStatusFilter(opt.value); setFilterOpen(false); }}
                    style={{ 
                      padding: "8px 12px", cursor: "pointer", fontSize: "0.85rem", fontWeight: statusFilter === opt.value ? 600 : 500,
                      color: statusFilter === opt.value ? "var(--wise-green)" : "var(--text-primary)",
                      background: statusFilter === opt.value ? "rgba(48, 164, 108, 0.1)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      transition: "background 0.2s ease"
                    }}
                    onMouseEnter={(e) => { if (statusFilter !== opt.value) e.currentTarget.style.background = "var(--bg-secondary)"; }}
                    onMouseLeave={(e) => { if (statusFilter !== opt.value) e.currentTarget.style.background = "transparent"; }}
                  >
                    {opt.label}
                    {statusFilter === opt.value && <Check size={14} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
          ) : boids.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No BOIDs found.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 1 }}>
                <tr>
                  <th style={{ padding: "12px 24px", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border-color)" }}>BOID Number</th>
                  <th style={{ padding: "12px 24px", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border-color)" }}>Status</th>
                  <th style={{ padding: "12px 24px", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border-color)" }}>Assigned To</th>
                  <th style={{ padding: "12px 24px", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border-color)" }}>Cooling Ends</th>
                  <th style={{ padding: "12px 24px", textAlign: "right", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border-color)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {boids.map(boid => (
                  <tr key={boid.id} style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "var(--bg-elevated)"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "14px 24px", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      {editingId === boid.id ? (
                        <input 
                          type="text" 
                          value={editValue} 
                          onChange={e => setEditValue(e.target.value)}
                          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border-color)", outline: "none", background: "var(--bg-primary)", color: "var(--text-primary)", fontWeight: 600, width: "200px" }}
                        />
                      ) : (
                        boid.boidNumber
                      )}
                    </td>
                    <td style={{ padding: "14px 24px", fontSize: "0.85rem" }}>
                      <span style={{ 
                        display: "inline-flex", 
                        alignItems: "center", 
                        gap: 6, 
                        padding: "4px 10px", 
                        borderRadius: 999, 
                        fontSize: "0.75rem", 
                        fontWeight: 600,
                        background: boid.status === 'available' ? 'var(--wise-green-alpha)' : boid.status === 'assigned' ? 'rgba(0, 145, 255, 0.1)' : 'var(--wise-red-alpha)',
                        color: boid.status === 'available' ? 'var(--wise-green)' : boid.status === 'assigned' ? '#0091ff' : 'var(--wise-red)'
                      }}>
                        {boid.status === 'available' ? <CheckCircle size={12}/> : boid.status === 'assigned' ? <FileText size={12}/> : <Clock size={12}/>}
                        {boid.status.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "14px 24px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      {boid.user ? boid.user.phone || boid.user.email : "—"}
                    </td>
                    <td style={{ padding: "14px 24px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      {boid.coolingPeriodEnds ? new Date(boid.coolingPeriodEnds).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "14px 24px", textAlign: "right" }}>
                      {editingId === boid.id ? (
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button onClick={() => saveEdit(boid.id)} disabled={savingId === boid.id} style={{ background: "transparent", border: "none", cursor: savingId === boid.id ? "not-allowed" : "pointer", color: "var(--wise-green)", padding: 4, display: "flex" }} title="Save">
                            <Check size={18} />
                          </button>
                          <button onClick={() => setEditingId(null)} disabled={savingId === boid.id} style={{ background: "transparent", border: "none", cursor: savingId === boid.id ? "not-allowed" : "pointer", color: "var(--text-muted)", padding: 4, display: "flex" }} title="Cancel">
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => { setEditingId(boid.id); setEditValue(boid.boidNumber); }} 
                          style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, display: "flex", marginLeft: "auto" }}
                          title="Edit BOID"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: "12px 24px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-primary)" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Page {page} of {totalPages}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button 
                disabled={page === 1} 
                onClick={() => fetchBoids(page - 1)}
                style={{ padding: "6px 12px", border: "1px solid var(--border-color)", background: page === 1 ? "transparent" : "var(--bg-elevated)", color: page === 1 ? "var(--text-muted)" : "var(--text-primary)", borderRadius: 6, cursor: page === 1 ? "not-allowed" : "pointer" }}
              >
                Previous
              </button>
              <button 
                disabled={page === totalPages} 
                onClick={() => fetchBoids(page + 1)}
                style={{ padding: "6px 12px", border: "1px solid var(--border-color)", background: page === totalPages ? "transparent" : "var(--bg-elevated)", color: page === totalPages ? "var(--text-muted)" : "var(--text-primary)", borderRadius: 6, cursor: page === totalPages ? "not-allowed" : "pointer" }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
