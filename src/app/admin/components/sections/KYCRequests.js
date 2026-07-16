"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/utils/apiConfig";
import { io } from "socket.io-client";

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

export default function KYCRequests({ searchQuery, onSearchChange, defaultFilter }) {
  const router = useRouter();
  const [kycs, setKycs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(defaultFilter || "all");
  const [localSearch, setLocalSearch] = useState("");
  const search = searchQuery !== undefined ? searchQuery : localSearch;
  const setSearch = onSearchChange !== undefined ? onSearchChange : setLocalSearch;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [bulk, setBulk] = useState([]);
  const [toast, setToast] = useState(null);
  const [employees, setEmployees] = useState([]);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [changeStatusAppId, setChangeStatusAppId] = useState(null);
  const [pendingStep, setPendingStep] = useState(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.action-menu-container')) {
        setOpenMenuId(null);
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
        if (typeof showToast === 'function') showToast(data.error || "Failed to generate session for user", "error");
        else alert(data.error || "Failed to generate session for user");
      }
    } catch (e) {
      console.error("Error continuing journey:", e);
      if (typeof showToast === 'function') showToast("Error starting journey", "error");
      else alert("Error starting journey");
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
        showToast("Application deleted successfully", "success");
        fetchApplications(true);
      } else {
        showToast(data.error || "Failed to delete", "error");
      }
    } catch (e) {
      showToast("Error deleting application", "error");
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
        showToast("Sent to Backoffice successfully", "success");
      } else {
        showToast(data.error || "Failed to send to Backoffice", "error");
      }
    } catch (e) {
      showToast("Error sending to Backoffice", "error");
    }
  };

  const fetchApplications = async (isSilent = false) => {
    if (typeof window === "undefined") return;
    if (!isSilent) setLoading(true);
    try {
      const url = new URL(`${API_BASE_URL}/api/admin/applications`);
      if (filter !== "all") url.searchParams.append("status", filter);
      if (search) url.searchParams.append("search", search);
      url.searchParams.append("page", page);
      url.searchParams.append("limit", 15);

      const token = localStorage.getItem("adminToken");
      const response = await fetch(url.toString(), {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.status === 401) {
        console.warn("Unauthorized access. Redirecting to login...");
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
        window.location.href = "/admin/login";
        return;
      }

      const updateStatus = async (applicationId, status) => {
        try {
          const token = localStorage.getItem("adminToken");
          const res = await fetch(`${API_BASE_URL}/api/admin/review/${applicationId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ status })
          });
          const data = await res.json();
          if (!data.success) {
            if (typeof showToast === 'function') showToast(data.error || "Failed to update status", "error");
            else alert(data.error || "Failed to update status");
          }
        } catch (e) {
          if (typeof showToast === 'function') showToast("Error updating status", "error");
          else alert("Error updating status");
        }
      };

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
              email: app.user?.email || "N/A",
              stepNum: app.currentStep || 0,
              stepLabel: STEP_LABELS[app.currentStep] || "Onboarding",
              type: "Full KYC",
              status: app.status,
              isResubmitted: app.isResubmitted,
              riskScore: app.riskScore || 0,
              faceMatch: app.faceMatchScore || 0,
              reviewer: app.reviewer?.email || "Unassigned",
              assignedCrmAgentId: app.assignedCrmAgentId,
              globeStatus: app.globeStatus || "pending",
              submittedAt: new Date(app.submittedAt || app.createdAt).toLocaleString(),
              
              personal: parsedPersonal,
              identity: app.identityDetails || {},
              address: app.address || {},
              ocrData: app.ocrData || {},
              
              documents: {
                pan: !!app.identityDetails?.pan,
                aadhaar: !!app.identityDetails?.aadhaar,
                selfie: !!app.selfie,
                financial: !!app.ocrData?.financial_proof
              }
            };
          });
          setKycs(mapped);
        }
      } else {
        const text = await response.text();
        console.warn("Expected JSON but got:", text.substring(0, 100));
      }
    } catch (err) {
      console.error("Fetch failed:", err.message);
      showToast("Network error or server unreachable", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/crm-employees`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setEmployees(data.employees || []);
      }
    } catch (err) {
      console.error("Failed to fetch employees:", err.message);
      // Optional: showToast("Failed to fetch employees", "error");
    }
  };

  useEffect(() => {
    if (defaultFilter) {
      setFilter(defaultFilter);
    }
  }, [defaultFilter]);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchApplications();
    }, 200);
    
    const socket = io(API_BASE_URL, { withCredentials: true });
    socket.on("connect", () => socket.emit("join_staff"));
    socket.on("applications_updated", () => fetchApplications(true));
    
    return () => {
      clearTimeout(t);
      socket.disconnect();
    };
  }, [filter, search, page]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        // No modal to close
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const showToast = (msg, type = "success") => { 
    setToast({ msg, type }); 
    setTimeout(() => setToast(null), 3000); 
  };

  const updateStatus = async (applicationId, status, extra = {}) => {
    if (typeof window === "undefined") return;
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`${API_BASE_URL}/api/admin/review/${applicationId}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ status, reason: extra.reason, currentStep: extra.currentStep })
      });
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.success) {
          showToast(`KYC ${status === "verified" ? "Approved" : status.replace("_", " ")} successfully`);
          await fetchApplications(true);
        } else {
          showToast(data.error || "Operation failed", "error");
        }
      } else {
        showToast("Server returned invalid response", "error");
      }
    } catch (err) {
      showToast("Operation failed. Please check connection.", "error");
    }
  };

  const toggleBulk = (applicationId) => {
    setBulk(prev => prev.includes(applicationId) ? prev.filter(id => id !== applicationId) : [...prev, applicationId]);
  };

  const bulkAction = async (status) => {
    const ids = [...bulk];
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await updateStatus(id, status);
    }
    setBulk([]);
  };

  return (
    <div className="admin-animate">
      <h1 className="admin-section-title">KYC Requests</h1>
      <p className="admin-section-subtitle">Manage, review, and action all submitted KYC applications.</p>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <input className="admin-input" placeholder="Search by name or ID..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 260 }} />
        <select className="admin-select" value={filter} onChange={e => setFilter(e.target.value)}>
          {["all", "pending", "verified", "rejected", "on_hold", "globe_approved", "globe_rejected", "pushed_to_bo", "not_pushed_to_bo"].map(f => (
            <option key={f} value={f}>{f.replace(/_/g, " ").toUpperCase()}</option>
          ))}
        </select>
        {bulk.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>{bulk.length} selected</span>
            <button onClick={() => bulkAction("verified")} style={{ padding: "8px 16px", borderRadius: 999, border: "none", background: "rgba(48,164,108,0.1)", color: "#30a46c", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>Bulk Approve</button>
            <button onClick={() => bulkAction("rejected")} style={{ padding: "8px 16px", borderRadius: 999, border: "none", background: "rgba(229,72,77,0.1)", color: "#e5484d", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>Bulk Reject</button>
            <button onClick={() => setBulk([])} style={{ padding: "8px 16px", borderRadius: 999, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-muted)", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>Clear</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="admin-table-container">
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead><tr>
              <th><input type="checkbox" onChange={e => setBulk(e.target.checked ? kycs.map(k => k.id) : [])} checked={bulk.length === kycs.length && kycs.length > 0} /></th>
              {["KYC ID", "Number", "Name", "Step", "Admin Status", "Globe Status", "Date", "Actions"].map(h => <th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {kycs.map((k) => (
                <tr key={k.id}>
                  <td><input type="checkbox" checked={bulk.includes(k.id)} onChange={() => toggleBulk(k.id)} /></td>
                  <td style={{ fontWeight: 800, fontSize: "0.82rem" }}>{k.id}</td>
                  <td style={{ fontWeight: 600 }}>{k.number}</td>
                  <td style={{ fontWeight: 600 }}>{k.name}</td>
                  <td style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 700 }}>
                    Step {k.stepNum || 0}/14
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center" }}>
                      <select 
                        className={`badge ${STATUS_MAP[k.status === 'under_review' ? 'pending' : k.status] || "badge-pending"}`}
                        value={k.status === 'under_review' ? 'pending' : k.status}
                        onChange={(e) => {
                          updateStatus(k.id, e.target.value);
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
                  </td>
                  <td>
                    <span style={{ 
                      padding: "4px 8px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase",
                      background: k.globeStatus === 'approved' ? 'rgba(16, 185, 129, 0.1)' : k.globeStatus === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
                      color: k.globeStatus === 'approved' ? '#10b981' : k.globeStatus === 'rejected' ? '#ef4444' : '#f59e0b', 
                    }}>
                      {k.globeStatus}
                    </span>
                  </td>

                  <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{k.submittedAt}</td>
                  <td>
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
                        <div style={{ position: "absolute", right: 30, top: 0, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 10, minWidth: 160, display: "flex", flexDirection: "column", padding: "4px 0" }}>
                          <button onClick={() => { setOpenMenuId(null); router.push(`/admin/application/${k.id}`); }} style={{ padding: "10px 16px", background: "transparent", border: "none", textAlign: "left", cursor: "pointer", fontSize: "0.85rem", width: "100%", borderBottom: "1px solid var(--border-color)" }}>Verify</button>
                          <button onClick={() => { setOpenMenuId(null); handleContinueJourney(k); }} style={{ padding: "10px 16px", background: "transparent", border: "none", textAlign: "left", cursor: "pointer", fontSize: "0.85rem", width: "100%", borderBottom: "1px solid var(--border-color)" }}>Continue Journey</button>
                          <button onClick={() => { setOpenMenuId(null); deleteUser(k.id); }} style={{ padding: "10px 16px", background: "transparent", border: "none", textAlign: "left", cursor: "pointer", fontSize: "0.85rem", width: "100%", color: "#e5484d", borderBottom: "1px solid var(--border-color)" }}>Delete</button>
                          <button onClick={() => { setOpenMenuId(null); setChangeStatusAppId(k.id); }} style={{ padding: "10px 16px", background: "transparent", border: "none", textAlign: "left", cursor: "pointer", fontSize: "0.85rem", width: "100%", borderBottom: k.status === "verified" ? "1px solid var(--border-color)" : "none" }}>Change Status</button>
                          {k.status === "verified" && (
                            <button onClick={() => { setOpenMenuId(null); sendToBackoffice(k.id); }} style={{ padding: "10px 16px", background: "transparent", border: "none", textAlign: "left", cursor: "pointer", fontSize: "0.85rem", width: "100%", color: "var(--wise-green)", fontWeight: 800 }}>Send to Backoffice</button>
                          )}
                        </div>
                      )}
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
          <span style={{ fontWeight: 700, color: "var(--wise-green)" }}>NSDL v2.2.3 Compliant</span>
        </div>
      </div>

      {changeStatusAppId && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--bg-primary)", padding: 24, borderRadius: 12, width: 320, border: "1px solid var(--border-color)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Change Progress</h3>
              <button onClick={() => { setChangeStatusAppId(null); setPendingStep(null); }} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "var(--text-muted)" }}>×</button>
            </div>
            
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
  );
}
