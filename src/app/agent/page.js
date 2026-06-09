"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/utils/apiConfig";
import { io } from "socket.io-client";
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

export default function AgentDashboard() {
  const router = useRouter();
  const [kycs, setKycs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [agentUser, setAgentUser] = useState(null);

  useEffect(() => {
    const userStr = localStorage.getItem("agent_user");
    if (userStr && userStr !== "undefined") {
      try {
        setAgentUser(JSON.parse(userStr));
      } catch (e) {
        console.error("Failed to parse agent_user", e);
      }
    }
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

      const token = localStorage.getItem("agent_token");
      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.status === 401) {
        localStorage.removeItem("agent_token");
        localStorage.removeItem("agent_user");
        window.location.href = "/agent/login";
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
            submittedAt: new Date(app.updatedAt || app.createdAt).toLocaleString(),
          }));
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
    fetchApplications();
    
    const socket = io(API_BASE_URL, { withCredentials: true });
    socket.on("connect", () => socket.emit("join_staff"));
    socket.on("applications_updated", () => fetchApplications(true));
    
    return () => socket.disconnect();
  }, [filter, search, page]);

  return (
    <div className="admin-animate">
      <h1 className="admin-section-title">KYC Requests</h1>
      <p className="admin-section-subtitle">Manage, review, and action your assigned KYC applications.</p>

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
      <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead><tr>
              {["KYC ID", "Number", "Step", "Status", "Risk", "Face Match", "Assigned", "Date", "Actions"].map(h => <th key={h}>{h}</th>)}
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
                  <td style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 700 }}>
                    Step {k.stepNum || 0}/18
                  </td>
                  <td><span className={`badge ${STATUS_MAP[k.status] || "badge-pending"}`}>{(k.status || "pending").replace("_", " ")}</span></td>
                  <td>
                    <span style={{ fontWeight: 800, fontSize: "0.9rem", color: k.riskScore > 60 ? "#e5484d" : k.riskScore > 30 ? "#b45309" : "#30a46c" }}>{k.riskScore}</span>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>/100</span>
                  </td>
                  <td style={{ fontWeight: 700, fontSize: "0.85rem" }}>{k.faceMatch}%</td>
                  <td style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 700 }}>
                    {agentUser?.email || "Agent"}
                  </td>
                  <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{k.submittedAt}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button 
                        onClick={() => router.push(`/agent/submissions/${k.id}`)} 
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
  );
}
