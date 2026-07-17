"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/utils/apiConfig";
import { io } from "socket.io-client";
import AdminSidebar from "../components/AdminSidebar";
import "@/app/admin/admin.css";

const STEP_LABELS = {
  0: "Step 0: Welcome", 
  1: "Step 1: Phone", 
  2: "Step 2: Email", 
  3: "Step 3: Pricing",
  4: "Step 4: PAN", 
  5: "Step 5: DigiLocker", 
  6: "Step 6: Personal Details",
  7: "Step 7: Nominee Choice", 
  8: "Step 8: Nominee",
  9: "Step 9: Allocation", 
  10: "Step 10: Bank", 
  11: "Step 11: Document Upload",
  12: "Step 12: eSign Preview", 
  13: "Step 13: Aadhaar eSign", 
  14: "Step 14: Completion"
};

const STATUS_MAP = { 
  pending: "badge-pending", 
  identity_verified: "badge-verified",
  verified: "badge-verified", 
  rejected: "badge-rejected", 
  on_hold: "badge-suspended" 
};

export default function MakerCheckerDashboard() {
  const router = useRouter();
  const [kycs, setKycs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [adminUser, setAdminUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [changeStatusAppId, setChangeStatusAppId] = useState(null);
  const [pendingStep, setPendingStep] = useState(null);

  const ALL_COLUMNS = ["Actions", "KYC ID", "Client Code", "Number", "Name", "Email", "PAN", "Step", "Status", "Globe Status", "E-Stamp", "Date"];
  const [visibleColumns, setVisibleColumns] = useState(["Actions", "KYC ID", "Client Code", "Number", "Name", "Step", "Status", "E-Stamp", "Date"]);
  const [columnsOpen, setColumnsOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.action-menu-container')) {
        setOpenMenuId(null);
      }
      if (!e.target.closest('.columns-dropdown-container')) {
        setColumnsOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleContinueJourney = async (k) => {
    try {
      const adminToken = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/application/${k.id}/generate-token`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("kycApplicationId", k.id);
        sessionStorage.setItem("kycApplicationId", k.id);
        localStorage.setItem("kycToken", data.token);
        sessionStorage.setItem("kycToken", data.token);
        localStorage.setItem("token", data.token);
        window.open("/", "_blank");
      } else {
        alert(data.error || "Failed to generate session for user");
      }
    } catch (e) {
      console.error("Error continuing journey:", e);
      alert("Error starting journey");
    }
  };

  const deleteUser = async (applicationId) => {
    if (!confirm("Are you sure you want to delete this application?")) return;
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/application/${applicationId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        alert("Application deleted successfully");
        fetchApplications(true);
      } else {
        alert(data.error || "Failed to delete");
      }
    } catch (e) {
      alert("Error deleting application");
    }
  };

  const sendToBackoffice = async (applicationId) => {
    if (!confirm("Are you sure you want to send this user's data to the Backoffice?")) return;
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/application/${applicationId}/send-backoffice`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        alert("Sent to Backoffice successfully");
      } else {
        alert(data.error || "Failed to send to Backoffice");
      }
    } catch (e) {
      alert("Error sending to Backoffice");
    }
  };

  const updateStatus = async (applicationId, status, extra = {}) => {
    if (status === "verified") {
      const kycApp = kycs.find((k) => k.id === applicationId);
      if (kycApp && (kycApp.stepNum || 0) < 14) {
        if (!confirm(`This application is only at Step ${kycApp.stepNum || 0}/14. Are you sure you want to approve it?`)) {
          return;
        }
      }
    }
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`${API_BASE_URL}/api/admin/review/${applicationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status, currentStep: extra.currentStep })
      });
      const data = await response.json();
      if (data.success) {
        alert(`Status updated successfully`);
        fetchApplications(true);
      } else {
        alert(data.error || "Operation failed");
      }
    } catch (err) {
      alert("Operation failed");
    }
  };

  useEffect(() => {
    const userStr = localStorage.getItem("adminUser");
    if (userStr && userStr !== "undefined") {
      try {
        setAdminUser(JSON.parse(userStr));
      } catch (e) {
        console.error("Failed to parse adminUser", e);
      }
    }
  }, []);

  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        window.location.href = "/admin/login";
        return;
      }
      try {
        setIsAuthenticated(true);
      } catch (e) {
        console.error("Token verification failed", e);
        setIsAuthenticated(true);
      } finally {
        setLoadingAuth(false);
      }
    };
    verifyToken();
  }, []);


  const fetchApplications = async (isSilent = false) => {
    if (typeof window === "undefined") return;
    if (!isSilent) setLoading(true);
    try {
      const url = new URL(`${API_BASE_URL}/api/agent/applications`);
      if (filter !== "all") url.searchParams.append("status", filter);
      if (search) url.searchParams.append("search", search);
      url.searchParams.append("page", page);
      url.searchParams.append("limit", 15);

      const token = localStorage.getItem("adminToken");
      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.status === 401) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
        window.location.href = "/admin/login";
        return;
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.success) {
          setTotal(data.total);
          setTotalPages(data.totalPages);
          const mapped = data.applications.map(app => {
            let parsedPersonal = {};
            try { parsedPersonal = typeof app.personalDetails === "string" ? JSON.parse(app.personalDetails) : (app.personalDetails || {}); } catch(e) {}
            
            let parsedIdentity = {};
            try { parsedIdentity = typeof app.identityDetails === "string" ? JSON.parse(app.identityDetails) : (app.identityDetails || {}); } catch(e) {}
            
            return {
            id: app.applicationId,
            dbId: app.id,
            clientCode: app.clientCode,
            number: app.user?.phone || "N/A",
            email: app.user?.email || "N/A",
            name: parsedPersonal.fullName || parsedPersonal.name || "N/A",
            pan: parsedIdentity.panNumber || parsedIdentity.pan || parsedPersonal.pan || "N/A",
            eStamp: app.user?.eStampAssigned?.serialNo || app.user?.eStamp || "N/A",
            stepNum: app.currentStep || 0,
            stepLabel: STEP_LABELS[app.currentStep] || "Onboarding",
            type: "Full KYC",
            status: app.status,
            globeStatus: app.globeStatus || "pending",
            isResubmitted: app.isResubmitted,
            riskScore: app.riskScore || 0,
            faceMatch: app.faceMatchScore || 0,
            submittedAt: new Date(app.updatedAt || app.createdAt).toLocaleString(),
          };});
          setKycs(mapped);
        }
      }
    } catch (err) {
      console.error("Fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  useEffect(() => {
    if (loadingAuth || !isAuthenticated) return;

    fetchApplications();
    
    const socket = io(API_BASE_URL, { withCredentials: true });
    socket.on("connect", () => socket.emit("join_staff"));
    socket.on("applications_updated", () => fetchApplications(true));
    
    return () => socket.disconnect();
  }, [filter, search, page, loadingAuth, isAuthenticated, adminUser]);
  const exportToCSV = () => {
    if (!kycs || kycs.length === 0) return;
    const headers = ALL_COLUMNS.filter(c => c !== "Actions");
    const rows = kycs.map(k => headers.map(col => {
      if (col === "KYC ID") return k.id;
      if (col === "Number") return k.number;
      if (col === "Name") return `"${k.name || ""}"`;
      if (col === "Email") return `"${k.email || ""}"`;
      if (col === "PAN") return k.pan;
      if (col === "Step") return `Step ${k.stepNum || 0}/14`;
      if (col === "Status") return k.status;
      if (col === "Globe Status") return k.globeStatus;
      if (col === "E-Stamp") return k.eStamp;
      if (col === "Date") return `"${k.submittedAt || ""}"`;
      return "";
    }));
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kyc_export_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loadingAuth || !isAuthenticated) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg-secondary)" }}>
      <div className="loader"></div>
    </div>
  );

  return (
    <div style={{ 
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      background: "var(--bg-secondary)"
    }}>
      <div style={{ 
        display: "flex", 
        width: "100%",
        height: "100%"
      }}>
      <div style={{ zoom: 0.8, height: "125vh", flexShrink: 0 }}>
        <AdminSidebar 
          active="maker_checker" 
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%", overflowY: "auto" }}>
          {/* Top Header */}
          <header className="admin-header">
            <div style={{ fontWeight: 700, color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Admin / <span style={{ color: "var(--text-primary)", textTransform: "capitalize" }}>Maker / Checker</span>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, borderLeft: "1px solid var(--border-color)", paddingLeft: 20 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>Super Admin</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Role: Master Control</div>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: "12px", background: "var(--wise-green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--wise-dark-green)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
              </div>
            </div>
          </header>

          <main style={{ padding: "24px", flex: 1, width: "100%" }}>
            <div className="admin-animate">
              <h1 className="admin-section-title">Maker / Checker Queue</h1>
              <p className="admin-section-subtitle">Review applications step-by-step.</p>

              {/* Controls */}
              <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
                <input className="admin-input" placeholder="Search by name or ID..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 260 }} />
                <select className="admin-select" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: "200px" }}>
                  {["all", "pending", "verified", "rejected", "on_hold", "pushed_to_bo", "not_pushed_to_bo"].map(f => (
                    <option key={f} value={f}>{f.replace(/_/g, " ").toUpperCase()}</option>
                  ))}
                </select>
                
                <div className="columns-dropdown-container" style={{ position: "relative", marginLeft: "auto" }}>
                  <button 
                    onClick={() => setColumnsOpen(!columnsOpen)}
                    style={{ 
                      padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border-color)", 
                      background: "var(--bg-primary)", color: "var(--text-primary)", fontWeight: 700, 
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 8 
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                    Columns
                  </button>
                  {columnsOpen && (
                    <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 8, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 10, minWidth: 200, padding: "8px 0" }}>
                      <div style={{ padding: "4px 16px", fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", borderBottom: "1px solid var(--border-color)", paddingBottom: 8, marginBottom: 4 }}>Toggle Columns</div>
                      {ALL_COLUMNS.map(col => (
                        <label key={col} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", cursor: "pointer", fontSize: "0.85rem", color: "var(--text-primary)" }}>
                          <input 
                            type="checkbox" 
                            checked={visibleColumns.includes(col)}
                            onChange={() => {
                              setVisibleColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
                            }}
                          />
                          {col}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <button 
                  onClick={exportToCSV}
                  disabled={kycs.length === 0}
                  style={{ 
                    padding: "10px 16px", 
                    borderRadius: 8, 
                    border: "none", 
                    background: "var(--wise-green)", 
                    color: "white", 
                    fontWeight: 700, 
                    cursor: kycs.length === 0 ? "not-allowed" : "pointer",
                    opacity: kycs.length === 0 ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Export CSV
                </button>
              </div>

              {/* Table */}
              <div className="admin-table-container">
                <div style={{ overflowX: "auto" }}>
                  <table className="admin-table">
                    <thead><tr>
                      {ALL_COLUMNS.filter(h => visibleColumns.includes(h)).map(h => <th key={h}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {kycs.length === 0 ? (
                        <tr>
                          <td colSpan="9" style={{ textAlign: "center", padding: "40px" }}>
                            {loading ? "Loading..." : "No matching KYC requests found."}
                          </td>
                        </tr>
                      ) : kycs.map((k) => (
                        <tr key={k.id}>
                          {visibleColumns.includes("Actions") && (<td>
                            <div className="action-menu-container" style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  setOpenMenuId(openMenuId === k.id ? null : k.id);
                                }}
                                style={{ padding: "4px 8px", borderRadius: 4, background: "transparent", border: "1px solid var(--border-color)", cursor: "pointer", fontWeight: "bold", fontSize: "1.1rem" }}
                              >
                                ⋮
                              </button>
                              
                              {openMenuId === k.id && (
                                <div style={{ position: "absolute", left: 0, top: "100%", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 10, minWidth: 160, display: "flex", flexDirection: "column", padding: "4px 0" }}>
                                  <button onClick={() => { setOpenMenuId(null); router.push(`/admin/maker-checker/${k.id}`); }} style={{ padding: "10px 16px", background: "transparent", border: "none", textAlign: "left", cursor: "pointer", fontSize: "0.85rem", width: "100%", borderBottom: "1px solid var(--border-color)" }}>Verify</button>
                                  <button onClick={() => { setOpenMenuId(null); handleContinueJourney(k); }} style={{ padding: "10px 16px", background: "transparent", border: "none", textAlign: "left", cursor: "pointer", fontSize: "0.85rem", width: "100%", borderBottom: "1px solid var(--border-color)" }}>Continue Journey</button>
                                  <button onClick={() => { setOpenMenuId(null); deleteUser(k.id); }} style={{ padding: "10px 16px", background: "transparent", border: "none", textAlign: "left", cursor: "pointer", fontSize: "0.85rem", width: "100%", color: "#e5484d", borderBottom: "1px solid var(--border-color)" }}>Delete</button>
                                  <button onClick={() => { setOpenMenuId(null); setChangeStatusAppId(k.id); }} style={{ padding: "10px 16px", background: "transparent", border: "none", textAlign: "left", cursor: "pointer", fontSize: "0.85rem", width: "100%", borderBottom: k.status === "verified" ? "1px solid var(--border-color)" : "none" }}>Change Status</button>
                                  {k.status === "verified" && (
                                    <button onClick={() => { setOpenMenuId(null); sendToBackoffice(k.id); }} style={{ padding: "10px 16px", background: "transparent", border: "none", textAlign: "left", cursor: "pointer", fontSize: "0.85rem", width: "100%", color: "var(--wise-green)", fontWeight: 800 }}>Send to Backoffice</button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>)}
                          {visibleColumns.includes("KYC ID") && <td style={{ fontWeight: 800, fontSize: "0.82rem" }}>{k.id}</td>}
                          {visibleColumns.includes("Client Code") && <td style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--wise-green)" }}>{k.clientCode || "N/A"}</td>}
                          {visibleColumns.includes("Number") && <td style={{ fontWeight: 600 }}>{k.number}</td>}
                          {visibleColumns.includes("Name") && <td style={{ fontWeight: 600 }}>{k.name}</td>}
                          {visibleColumns.includes("Email") && <td style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>{k.email}</td>}
                          {visibleColumns.includes("PAN") && <td style={{ fontWeight: 600 }}>{k.pan}</td>}
                          {visibleColumns.includes("Step") && <td style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 700 }}>
                            Step {k.stepNum || 0}/14
                          </td>}
                          {visibleColumns.includes("Status") && <td>
                            <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center" }}>
                              <select 
                                className={`badge ${STATUS_MAP[k.status === 'under_review' ? 'pending' : k.status] || "badge-pending"}`}
                                value={k.status === 'under_review' ? 'pending' : k.status}
                                onChange={(e) => {
                                  updateStatus(k.id, e.target.value);
                                  // Optimistically update the UI
                                  setKycs(prev => prev.map(app => app.id === k.id ? { ...app, status: e.target.value } : app));
                                }}
                                style={{ outline: "none", cursor: "pointer", appearance: "auto", border: "none" }}
                              >
                                <option value="pending">PENDING</option>
                                <option value="verified">VERIFIED</option>
                                <option value="rejected">REJECTED</option>
                                <option value="on_hold">ON HOLD</option>
                              </select>
                              {k.isResubmitted && (
                                <span style={{ fontSize: "0.65rem", fontWeight: 800, background: "#fef3c7", color: "#b45309", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", border: "1px solid #fde68a" }}>Modified</span>
                              )}
                            </div>
                          </td>}

                          {visibleColumns.includes("Globe Status") && <td>
                            <span style={{ 
                              padding: "4px 8px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase",
                              background: k.globeStatus === 'approved' ? 'rgba(16, 185, 129, 0.1)' : k.globeStatus === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
                              color: k.globeStatus === 'approved' ? '#10b981' : k.globeStatus === 'rejected' ? '#ef4444' : '#f59e0b', 
                            }}>
                              {k.globeStatus}
                            </span>
                          </td>}
                          {visibleColumns.includes("E-Stamp") && <td style={{ fontSize: "0.82rem", color: "var(--wise-green)", fontWeight: 800 }}>
                            {k.eStamp}
                          </td>}
                          {visibleColumns.includes("Date") && <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{k.submittedAt}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-color)", fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button 
                      disabled={page <= 1 || loading} 
                      onClick={() => setPage(p => p - 1)}
                      style={{ padding: "4px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", cursor: "pointer", opacity: page <= 1 ? 0.4 : 1 }}
                    >
                      Previous
                    </button>
                    <span style={{ fontWeight: 700 }}>Page {page} of {totalPages}</span>
                    <button 
                      disabled={page >= totalPages || loading} 
                      onClick={() => setPage(p => p + 1)}
                      style={{ padding: "4px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", cursor: "pointer", opacity: page >= totalPages ? 0.4 : 1 }}
                    >
                      Next
                    </button>
                  </div>
                  <span>Total {total} applications</span>
                </div>
              </div>

              {changeStatusAppId && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ background: "var(--bg-primary)", padding: 24, borderRadius: 12, width: 320, border: "1px solid var(--border-color)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <h3 style={{ margin: 0 }}>Change Progress</h3>
                      <button onClick={() => { setChangeStatusAppId(null); setPendingStep(null); }} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "var(--text-muted)" }}>×</button>
                    </div>
                    
                    {/* Progress Section */}
                    {(() => {
                      const appForStatus = kycs.find(k => k.id === changeStatusAppId);
                      const currentAppStep = appForStatus ? (appForStatus.stepNum || 0) : 0;
                      return (
                        <div style={{ padding: 16, border: pendingStep !== null && pendingStep !== currentAppStep ? "2px solid var(--wise-green)" : "1px solid var(--border-color)", borderRadius: 8, background: "var(--bg-secondary)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>PROGRESS</span>
                            {pendingStep !== null && pendingStep !== currentAppStep && (
                              <span style={{ fontSize: "0.6rem", color: "var(--wise-green)", fontWeight: 800 }}>CHANGED</span>
                            )}
                          </div>
                          <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--wise-green)", marginTop: 4 }}>{STEP_LABELS[currentAppStep] || `Step ${currentAppStep}`}</div>
                          <select 
                            className="admin-select" 
                            style={{ width: "100%", marginTop: 12, height: 40, fontSize: "0.85rem" }}
                            value={pendingStep !== null ? pendingStep : currentAppStep}
                            onChange={e => setPendingStep(parseInt(e.target.value))}
                          >
                            {Object.entries(STEP_LABELS).map(([num, label]) => <option key={num} value={num}>{label}</option>)}
                          </select>
                          {pendingStep !== null && pendingStep !== currentAppStep && (
                            <button 
                              onClick={() => {
                                updateStatus(changeStatusAppId, appForStatus?.status || "pending", { currentStep: pendingStep });
                                setChangeStatusAppId(null);
                                setPendingStep(null);
                              }}
                              style={{ width: "100%", marginTop: 12, padding: 10, borderRadius: 8, background: "var(--wise-green)", color: "white", border: "none", fontWeight: 800, cursor: "pointer", fontSize: "0.85rem", boxShadow: "0 4px 12px rgba(48, 164, 108, 0.3)" }}
                            >
                              Save Step Change
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
