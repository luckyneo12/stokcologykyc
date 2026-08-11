"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/utils/apiConfig";
import { io } from "socket.io-client";
import GlobeSidebar from "../components/GlobeSidebar";

import { useDragScroll } from "@/utils/useDragScroll";
import "../globe-table.css";

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
  const [globeUser, setAdminUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openStatusMenuId, setOpenStatusMenuId] = useState(null);
  const [changeStatusAppId, setChangeStatusAppId] = useState(null);
  const [pendingStep, setPendingStep] = useState(null);

  const PERMANENT_COLUMNS = ["S.No.", "Actions", "Name", "Client Code"];
  const PERMANENT_WIDTHS = {
    "S.No.": 60,
    "Actions": 80,
    "Name": 180,
    "Client Code": 120
  };
  const ALL_COLUMNS = ["S.No.", "Actions", "Name", "Client Code", "KYC ID", "Number", "Email", "PAN", "Step", "Stage", "Status", "Globe Status", "E-Stamp", "Start Date", "eSign Date", "Date"];
  const [visibleColumns, setVisibleColumns] = useState(["S.No.", "Actions", "Name", "Client Code", "KYC ID", "Number", "Step", "Stage", "Status", "E-Stamp", "Start Date", "eSign Date", "Date"]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnsLoaded, setColumnsLoaded] = useState(false);

  const scrollRef = useDragScroll();

  const getStickyStyle = (colName, isHeader = false) => {
    if (!PERMANENT_COLUMNS.includes(colName)) return {};
    let left = 0;
    for (const c of PERMANENT_COLUMNS) {
      if (c === colName) break;
      left += PERMANENT_WIDTHS[c];
    }
    return {
      position: "sticky",
      left,
      zIndex: isHeader ? 11 : 10,
      minWidth: PERMANENT_WIDTHS[colName],
      maxWidth: PERMANENT_WIDTHS[colName],
      width: PERMANENT_WIDTHS[colName],
      backgroundColor: isHeader ? "var(--bg-secondary)" : "var(--bg-primary)",
      boxShadow: "none",
    };
  };


  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("makerCheckerVisibleColumns");
      if (saved) {
        try {
          setVisibleColumns(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse visible columns", e);
        }
      }
    }
    setColumnsLoaded(true);
  }, []);

  useEffect(() => {
    if (columnsLoaded && typeof window !== "undefined") {
      localStorage.setItem("makerCheckerVisibleColumns", JSON.stringify(visibleColumns));
    }
  }, [visibleColumns, columnsLoaded]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.action-menu-container')) {
        setOpenMenuId(null);
      }
      if (!e.target.closest('.columns-dropdown-container')) {
        setColumnsOpen(false);
      }
      if (!e.target.closest('.filter-dropdown-container')) {
        setFilterOpen(false);
      }
      if (!e.target.closest('.status-dropdown-container')) {
        setOpenStatusMenuId(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleContinueJourney = async (k) => {
    try {
      const globeToken = localStorage.getItem("globeToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/application/${k.id}/generate-token`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${globeToken}` }
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
      const token = localStorage.getItem("globeToken");
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
      const token = localStorage.getItem("globeToken");
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
      const token = localStorage.getItem("globeToken");
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

  const updateGlobeStatusAPI = async (applicationId, globeStatus) => {
    try {
      const token = localStorage.getItem("globeToken");
      const response = await fetch(`${API_BASE_URL}/api/globe/kycs/${applicationId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ globeStatus })
      });
      const data = await response.json();
      if (data.success) {
        alert(`Globe Status updated successfully`);
        fetchApplications(true);
      } else {
        alert(data.error || "Operation failed");
      }
    } catch (err) {
      alert("Operation failed");
    }
  };

  useEffect(() => {
    const userStr = localStorage.getItem("globeUser");
    if (userStr && userStr !== "undefined") {
      try {
        setAdminUser(JSON.parse(userStr));
      } catch (e) {
        console.error("Failed to parse globeUser", e);
      }
    }
  }, []);

  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem("globeToken");
      if (!token) {
        window.location.href = "/globe/login";
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
      const url = new URL(`${API_BASE_URL}/api/globe/kycs`);
      if (filter !== "all") url.searchParams.append("globeStatus", filter);
      if (search) url.searchParams.append("search", search);
      url.searchParams.append("page", page);
      url.searchParams.append("limit", 15);

      const token = localStorage.getItem("globeToken");
      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.status === 401) {
        localStorage.removeItem("globeToken");
        localStorage.removeItem("globeUser");
        window.location.href = "/globe/login";
        return;
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.success) {
          setTotal(data.pagination?.total || 0);
          setTotalPages(data.pagination?.pages || 1);
          const appsArray = data.data || data.applications || [];
          const mapped = appsArray.map(app => {
            let parsedPersonal = {};
            try { parsedPersonal = typeof app.personalDetails === "string" ? JSON.parse(app.personalDetails) : (app.personalDetails || {}); } catch(e) {}
            
            let parsedIdentity = {};
            try { parsedIdentity = typeof app.identityDetails === "string" ? JSON.parse(app.identityDetails) : (app.identityDetails || {}); } catch(e) {}
            
            let parsedEsign = {};
            try { parsedEsign = typeof app.esignDetails === "string" ? JSON.parse(app.esignDetails) : (app.esignDetails || {}); } catch(e) {}
            
            return {
            id: app.applicationId,
            dbId: app.id,
            clientCode: app.clientCode,
            number: app.user?.phone || "N/A",
            email: app.user?.email || parsedPersonal.email || "N/A",
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
            startDate: app.createdAt ? new Date(app.createdAt).toLocaleString("en-IN") : "N/A",
            esignDate: parsedEsign.timestamp || (app.currentStep >= 14 ? new Date(app.updatedAt).toLocaleString("en-IN") : "Pending"),
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

  const fetchRef = useRef(fetchApplications);
  useEffect(() => {
    fetchRef.current = fetchApplications;
  }, [fetchApplications]);

  useEffect(() => {
    if (loadingAuth || !isAuthenticated) return;
    
    const t = setTimeout(() => {
      fetchApplications();
    }, 500);
    return () => clearTimeout(t);
  }, [filter, search, page, loadingAuth, isAuthenticated]);

  useEffect(() => {
    if (loadingAuth || !isAuthenticated) return;

    const socket = io(API_BASE_URL, { withCredentials: true });
    socket.on("connect", () => socket.emit("join_staff"));
    socket.on("applications_updated", () => {
      if (fetchRef.current) fetchRef.current(true);
    });
    
    return () => socket.disconnect();
  }, [loadingAuth, isAuthenticated]);
  const exportToCSV = () => {
    if (!kycs || kycs.length === 0) return;
    const headers = ALL_COLUMNS.filter(c => c !== "Actions" && c !== "S.No.");
    const rows = kycs.map(k => headers.map(col => {
      if (col === "KYC ID") return k.id;
      if (col === "Number") return k.number;
      if (col === "Name") return `"${k.name || ""}"`;
      if (col === "Email") return `"${k.email || ""}"`;
      if (col === "PAN") return k.pan;
      if (col === "Step") return `Step ${k.stepNum || 0}/14`;
      if (col === "Stage") return `"${(k.stepLabel && k.stepLabel.includes(':')) ? k.stepLabel.split(': ')[1] : (k.stepLabel || "Onboarding")}"`;
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
        <GlobeSidebar 
          active="maker_checker"
          onNavigate={(sec) => {
            localStorage.setItem("globeActiveSection", sec);
            router.push("/globe");
          }}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
          <div style={{ 
            padding: "16px 28px", 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            background: "var(--bg-primary)",
            borderBottom: "1px solid var(--border-color)",
            zIndex: 20
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div>
                <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px", margin: 0 }}>Maker / Checker Queue</h1>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 4, margin: 0 }}>Review applications step-by-step.</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 12px", background: "var(--bg-secondary)", borderRadius: 99, border: "1px solid var(--border-color)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px rgba(16,185,129,0.5)" }}></div>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)" }}>{globeUser?.email || "Agent"}</span>
              </div>
            </div>
          </div>

          <main style={{ padding: "24px", flex: 1, width: "100%", overflowY: "auto" }}>
            <div className="admin-animate">
              {/* Controls */}
              <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
                <input className="admin-input" placeholder="Search by name or ID..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 260 }} />
                <div className="filter-dropdown-container" style={{ position: "relative", width: "220px" }}>
                  <button 
                    onClick={() => setFilterOpen(!filterOpen)}
                    style={{ 
                      width: "100%", padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border-color)", 
                      background: "var(--bg-primary)", color: "var(--text-primary)", fontWeight: 700, 
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                      boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--wise-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                      {filter === "all" ? "All Applications" : filter.replace(/_/g, " ").toUpperCase()}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ transform: filterOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                  {filterOpen && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", zIndex: 10, padding: "8px 0", overflow: "hidden" }}>
                      {["all", "pending", "approved", "rejected"].map(f => (
                        <div 
                          key={f}
                          onClick={() => { setFilter(f); setFilterOpen(false); }}
                          style={{ 
                            padding: "10px 16px", cursor: "pointer", fontSize: "0.85rem", fontWeight: filter === f ? 700 : 500,
                            color: filter === f ? "var(--wise-green)" : "var(--text-primary)",
                            background: filter === f ? "rgba(48, 164, 108, 0.1)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            transition: "background 0.2s ease"
                          }}
                          onMouseEnter={(e) => { if (filter !== f) e.currentTarget.style.background = "var(--bg-secondary)"; }}
                          onMouseLeave={(e) => { if (filter !== f) e.currentTarget.style.background = "transparent"; }}
                        >
                          {f === "all" ? "All Applications" : f.replace(/_/g, " ").toUpperCase()}
                          {filter === f && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
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
                        <label key={col} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", cursor: PERMANENT_COLUMNS.includes(col) ? "not-allowed" : "pointer", fontSize: "0.85rem", color: "var(--text-primary)", opacity: PERMANENT_COLUMNS.includes(col) ? 0.6 : 1 }}>
                          <input 
                            type="checkbox" 
                            checked={visibleColumns.includes(col) || PERMANENT_COLUMNS.includes(col)}
                            disabled={PERMANENT_COLUMNS.includes(col)}
                            onChange={() => {
                              if (PERMANENT_COLUMNS.includes(col)) return;
                              setVisibleColumns(prev => {
                                const next = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
                                localStorage.setItem("makerCheckerVisibleColumns", JSON.stringify(next));
                                return next;
                              });
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
                <div ref={scrollRef} style={{ overflowX: "auto", minHeight: kycs.length < 4 ? "300px" : "auto" }}>
                  <table className="admin-table">
                    <thead><tr>
                      {ALL_COLUMNS.filter(h => visibleColumns.includes(h) || PERMANENT_COLUMNS.includes(h)).map(h => <th key={h} style={getStickyStyle(h, true)}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {kycs.length === 0 ? (
                        <tr>
                          <td colSpan="9" style={{ textAlign: "center", padding: "40px" }}>
                            {loading ? "Loading..." : "No matching KYC requests found."}
                          </td>
                        </tr>
                      ) : kycs.map((k, index) => (
                        <tr key={k.id} onClick={() => router.push(`/globe/maker-checker/${k.id}`)} style={{ cursor: "pointer" }}>
                          {visibleColumns.includes("S.No.") && (
                            <td style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-muted)", ...getStickyStyle("S.No.") }}>
                              {(page - 1) * 15 + index + 1}
                            </td>
                          )}
                          {visibleColumns.includes("Actions") && (<td style={{ ...getStickyStyle("Actions"), zIndex: openMenuId === k.id ? 20 : 2 }}>
                            <div className="action-menu-container" style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  setOpenMenuId(openMenuId === k.id ? null : k.id);
                                }}
                                style={{ padding: "4px 8px", borderRadius: 4, background: "transparent", border: "1px solid var(--border-color)", cursor: "pointer", fontWeight: "bold", fontSize: "1.1rem", color: "var(--text-primary)" }}
                              >
                                ⋮
                              </button>
                              
                              {openMenuId === k.id && (
                                <div className="premium-action-menu" style={{ position: "absolute", top: (index >= 3 && index >= kycs.length - 4) ? "auto" : "100%", bottom: (index >= 3 && index >= kycs.length - 4) ? "100%" : "auto", left: 0, minWidth: "160px", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 50, padding: "4px" }}>
                                  <button onClick={() => { setOpenMenuId(null); router.push(`/globe/maker-checker/${k.id}`); }} style={{ display: "block", width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: "0.85rem", textAlign: "left", fontWeight: 600, color: "var(--text-primary)", borderRadius: "4px" }} onMouseEnter={e => e.target.style.background = 'var(--bg-secondary)'} onMouseLeave={e => e.target.style.background = 'transparent'}>Verify</button>
                                  <button onClick={() => { setOpenMenuId(null); handleContinueJourney(k); }} style={{ display: "block", width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: "0.85rem", textAlign: "left", fontWeight: 600, color: "var(--text-primary)", borderRadius: "4px" }} onMouseEnter={e => e.target.style.background = 'var(--bg-secondary)'} onMouseLeave={e => e.target.style.background = 'transparent'}>Continue Journey</button>
                                  <button onClick={() => { setOpenMenuId(null); deleteUser(k.id); }} style={{ display: "block", width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: "0.85rem", textAlign: "left", fontWeight: 600, color: "#ef4444", borderRadius: "4px" }} onMouseEnter={e => e.target.style.background = '#fef2f2'} onMouseLeave={e => e.target.style.background = 'transparent'}>Delete</button>
                                  <button onClick={() => { setOpenMenuId(null); setChangeStatusAppId(k.id); }} style={{ display: "block", width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: "0.85rem", textAlign: "left", fontWeight: 600, color: "var(--text-primary)", borderRadius: "4px" }} onMouseEnter={e => e.target.style.background = 'var(--bg-secondary)'} onMouseLeave={e => e.target.style.background = 'transparent'}>Change Status</button>
                                </div>
                              )}
                            </div>
                          </td>)}
                          {visibleColumns.includes("Name") && <td style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", ...getStickyStyle("Name") }}>{k.name}</td>}
                          {visibleColumns.includes("Client Code") && <td style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--wise-green)", ...getStickyStyle("Client Code") }}>{k.clientCode || "N/A"}</td>}
                          {visibleColumns.includes("KYC ID") && <td style={{ fontWeight: 800, fontSize: "0.82rem" }}>{k.id}</td>}
                          {visibleColumns.includes("Number") && <td style={{ fontWeight: 600 }}>{k.number}</td>}
                          {visibleColumns.includes("Email") && <td style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>{k.email}</td>}
                          {visibleColumns.includes("PAN") && <td style={{ fontWeight: 600 }}>{k.pan}</td>}
                          {visibleColumns.includes("Step") && <td style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 700 }}>
                            Step {k.stepNum || 0}/14
                          </td>}
                          {visibleColumns.includes("Stage") && <td style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                            {k.stepLabel && k.stepLabel.includes(':') ? k.stepLabel.split(': ')[1] : (k.stepLabel || "Onboarding")}
                          </td>}
                          {visibleColumns.includes("Status") && <td>
                            <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center" }}>
                              <div className={`badge ${STATUS_MAP[k.status === 'under_review' ? 'pending' : k.status] || "badge-pending"}`}>
                                {((k.status === 'under_review' ? 'pending' : k.status) || 'pending').replace("_", " ").toUpperCase()}
                              </div>
                              {k.isResubmitted && (
                                <span style={{ fontSize: "0.65rem", fontWeight: 800, background: "#fef3c7", color: "#b45309", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", border: "1px solid #fde68a" }}>Modified</span>
                              )}
                            </div>
                          </td>}

                          {visibleColumns.includes("Globe Status") && <td>
                            <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center" }}>
                              <div className="status-dropdown-container" style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                                <div 
                                  onClick={() => setOpenStatusMenuId(openStatusMenuId === k.id ? null : k.id)}
                                  className={`badge ${STATUS_MAP[k.globeStatus] || "badge-pending"}`}
                                  style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, border: "none" }}
                                >
                                  {(k.globeStatus || "PENDING").toUpperCase()}
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: openStatusMenuId === k.id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                                {openStatusMenuId === k.id && (
                                  <div style={{ position: "absolute", top: (index >= kycs.length - 3 && kycs.length > 3) ? "auto" : "100%", bottom: (index >= kycs.length - 3 && kycs.length > 3) ? "100%" : "auto", marginTop: (index >= kycs.length - 3 && kycs.length > 3) ? 0 : 4, marginBottom: (index >= kycs.length - 3 && kycs.length > 3) ? 4 : 0, left: 0, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 50, padding: "4px", minWidth: "120px" }}>
                                    {[
                                      { value: "pending", label: "PENDING" },
                                      { value: "approved", label: "APPROVED" },
                                      { value: "rejected", label: "REJECTED" }
                                    ].map(opt => (
                                      <div 
                                        key={opt.value}
                                        onClick={() => {
                                          if (k.globeStatus !== opt.value) {
                                            updateGlobeStatusAPI(k.id, opt.value);
                                            setKycs(prev => prev.map(app => app.id === k.id ? { ...app, globeStatus: opt.value } : app));
                                          }
                                          setOpenStatusMenuId(null);
                                        }}
                                        style={{ 
                                          padding: "8px 12px", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700, borderRadius: 6,
                                          color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "space-between",
                                          background: "transparent", transition: "background 0.2s"
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-secondary)"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                      >
                                        {opt.label}
                                        {k.globeStatus === opt.value && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--wise-green)" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>}
                          {visibleColumns.includes("E-Stamp") && <td style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.82rem" }}>{k.eStamp}</td>}
                          {visibleColumns.includes("Start Date") && <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{k.startDate}</td>}
                          {visibleColumns.includes("eSign Date") && <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{k.esignDate}</td>}
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
                          <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--wise-green)", marginTop: 8, marginBottom: 4, lineHeight: "1.4", paddingBottom: "2px" }}>
                            {STEP_LABELS[currentAppStep] || `Step ${currentAppStep}`}
                          </div>
                          <select 
                            className="admin-select" 
                            style={{ width: "100%", marginTop: 12, height: "44px", fontSize: "0.95rem", padding: "8px 12px", borderRadius: "8px" }}
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
                              style={{ width: "100%", marginTop: 16, padding: "12px", borderRadius: 8, background: "var(--wise-green)", color: "white", border: "none", fontWeight: 800, cursor: "pointer", fontSize: "0.95rem", boxShadow: "0 4px 12px rgba(48, 164, 108, 0.3)", transition: "all 0.2s ease" }}
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
