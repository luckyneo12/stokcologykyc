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
  under_review: "badge-review",
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
            return {
            id: app.applicationId,
            dbId: app.id,
            number: app.user?.phone || "N/A",
            name: parsedPersonal.fullName || parsedPersonal.name || "N/A",
            eStamp: app.user?.eStampAssigned?.serialNo || app.user?.eStamp || "N/A",
            stepNum: app.currentStep || 0,
            stepLabel: STEP_LABELS[app.currentStep] || "Onboarding",
            type: "Full KYC",
            status: app.status,
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
        width: "125%",
        height: "125%",
        transform: "scale(0.8)",
        transformOrigin: "top left"
      }}>
        <AdminSidebar 
          active="maker_checker" 
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

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
                  {["all", "pending", "verified", "rejected", "under_review", "on_hold"].map(f => (
                    <option key={f} value={f}>{f.replace("_", " ").toUpperCase()}</option>
                  ))}
                </select>
              </div>

              {/* Table */}
              <div className="admin-table-container">
                <div style={{ overflowX: "auto" }}>
                  <table className="admin-table">
                    <thead><tr>
                      {["KYC ID", "Number", "Name", "Step", "Status", "E-Stamp", "Date", "Actions"].map(h => <th key={h}>{h}</th>)}
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
                          <td style={{ fontWeight: 800, fontSize: "0.82rem" }}>{k.id}</td>
                          <td style={{ fontWeight: 600 }}>{k.number}</td>
                          <td style={{ fontWeight: 600 }}>{k.name}</td>
                          <td style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 700 }}>
                            Step {k.status !== "pending" ? 14 : (k.stepNum || 0)}/14
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center" }}>
                              <span className={`badge ${STATUS_MAP[k.status] || "badge-pending"}`}>{(k.status || "pending").replace("_", " ")}</span>
                              {k.isResubmitted && (
                                <span style={{ fontSize: "0.65rem", fontWeight: 800, background: "#fef3c7", color: "#b45309", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", border: "1px solid #fde68a" }}>Modified</span>
                              )}
                            </div>
                          </td>

                          <td style={{ fontSize: "0.82rem", color: "var(--wise-green)", fontWeight: 800 }}>
                            {k.eStamp}
                          </td>
                          <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{k.submittedAt}</td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button 
                                onClick={() => router.push(`/admin/maker-checker/${k.id}`)} 
                                style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
                              >
                                View
                              </button>
                            </div>
                          </td>
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

            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
