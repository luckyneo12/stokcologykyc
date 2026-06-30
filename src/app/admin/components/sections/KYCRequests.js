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
  under_review: "badge-review",
  identity_verified: "badge-verified",
  verified: "badge-verified", 
  rejected: "badge-rejected", 
  on_hold: "badge-suspended" 
};

export default function KYCRequests({ searchQuery, onSearchChange }) {
  const router = useRouter();
  const [kycs, setKycs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [localSearch, setLocalSearch] = useState("");
  const search = searchQuery !== undefined ? searchQuery : localSearch;
  const setSearch = onSearchChange !== undefined ? onSearchChange : setLocalSearch;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [bulk, setBulk] = useState([]);
  const [toast, setToast] = useState(null);
  const [employees, setEmployees] = useState([]);

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

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.success) {
          setTotal(data.total);
          setTotalPages(data.totalPages);
          const mapped = data.applications.map(app => ({
            id: app.applicationId,
            dbId: app.id,
            number: app.user?.phone || "N/A",
            stepNum: app.currentStep || 0,
            stepLabel: STEP_LABELS[app.currentStep] || "Onboarding",
            type: "Full KYC",
            status: app.status,
            riskScore: app.riskScore || 0,
            faceMatch: app.faceMatchScore || 0,
            reviewer: app.reviewer?.email || "Unassigned",
            assignedCrmAgentId: app.assignedCrmAgentId,
            submittedAt: new Date(app.submittedAt || app.createdAt).toLocaleString(),
            
            personal: app.personalDetails || {},
            identity: app.identityDetails || {},
            address: app.address || {},
            ocrData: app.ocrData || {},
            
            documents: {
              pan: !!app.identityDetails?.pan,
              aadhaar: !!app.identityDetails?.aadhaar,
              selfie: !!app.selfie,
              financial: !!app.ocrData?.financial_proof
            }
          }));
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
          {["all", "pending", "verified", "rejected", "under_review", "on_hold"].map(f => (
            <option key={f} value={f}>{f.replace("_", " ").toUpperCase()}</option>
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
              {["KYC ID", "Number", "Step", "Status", "Risk", "Face Match", "Assigned", "Date", "Actions"].map(h => <th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {kycs.map((k) => (
                <tr key={k.id}>
                  <td><input type="checkbox" checked={bulk.includes(k.id)} onChange={() => toggleBulk(k.id)} /></td>
                  <td style={{ fontWeight: 800, fontSize: "0.82rem" }}>{k.id}</td>
                  <td style={{ fontWeight: 600 }}>{k.number}</td>
                  <td style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 700 }}>
                    Step {k.stepNum || 0}/14
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                      <span className={`badge ${STATUS_MAP[k.status] || "badge-pending"}`}>{k.status.replace("_", " ")}</span>
                      {k.isResubmitted && (
                        <span style={{ fontSize: "0.65rem", fontWeight: 800, background: "#fef3c7", color: "#b45309", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>Modified by User</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 800, fontSize: "0.9rem", color: k.riskScore > 60 ? "#e5484d" : k.riskScore > 30 ? "#b45309" : "#30a46c" }}>{k.riskScore}</span>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>/100</span>
                  </td>
                  <td style={{ fontWeight: 700, fontSize: "0.85rem" }}>{k.faceMatch}%</td>
                  <td style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 700 }}>
                    {employees.find(e => String(e.id) === String(k.assignedCrmAgentId))?.name || "Unassigned"}
                  </td>
                  <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{k.submittedAt}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button 
                        onClick={() => router.push(`/admin/application/${k.id}`)} 
                        style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
                      >
                        View
                      </button>
                      {k.status === "pending" && <>
                        <button onClick={() => updateStatus(k.id, "verified")} style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "rgba(48,164,108,0.1)", color: "#30a46c", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>✓</button>
                        <button onClick={() => router.push(`/admin/application/${k.id}?action=reject`)} style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "rgba(229,72,77,0.1)", color: "#e5484d", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>✕</button>
                      </>}
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

    </div>
  );
}
