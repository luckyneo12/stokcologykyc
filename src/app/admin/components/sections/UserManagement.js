"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/utils/apiConfig";

const STATUS_MAP = { 
  pending: "badge-pending", 
  under_review: "badge-review",
  identity_verified: "badge-verified",
  verified: "badge-verified", 
  rejected: "badge-rejected", 
  on_hold: "badge-suspended" 
};

function formatDate(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).replace(",", "");
}

export default function UserManagement({ searchQuery, onSearchChange }) {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [localSearch, setLocalSearch] = useState("");
  const search = searchQuery !== undefined ? searchQuery : localSearch;
  const setSearch = onSearchChange !== undefined ? onSearchChange : setLocalSearch;
  const [loading, setLoading] = useState(true);
  const [seqModal, setSeqModal] = useState(false);
  const [seqInput, setSeqInput] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("adminToken");
        const url = new URL(`${API_BASE_URL}/api/admin/users`);
        if (search) url.searchParams.set("search", search);
        url.searchParams.set("limit", "250");
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!data.success) return;

        const mapped = (data.users || []).map((u) => {
          const latest = (u.kycApplications || [])[0] || {};
          return {
            userId: u.id,
            customerRefNo: latest.applicationId || "-",
            kycRequestId: latest.applicationId ? `KID${latest.applicationId}` : "-",
            customerIdentifier: u.phone || u.email || "-",
            status: latest.status || "pending",
            workflowName: latest.identityMethod || "DIGILOCKER_CONDITIONAL_JOURNEY",
            createdAt: latest.createdAt || u.createdAt,
            updatedAt: latest.updatedAt || u.updatedAt
          };
        });

        setUsers(mapped);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    const t = setTimeout(fetchUsers, 180);
    return () => clearTimeout(t);
  }, [search]);

  const handleUpdateSequence = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const num = parseInt(seqInput, 10);
      if (isNaN(num) || num < 0) return alert("Please enter a valid positive number");
      const res = await fetch(`${API_BASE_URL}/api/admin/sequence/estamp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nextSequenceValue: num })
      });
      const data = await res.json();
      if (data.success) {
        alert("E-Stamp sequence updated successfully!");
        setSeqModal(false);
      } else {
        alert(data.error || "Failed to update sequence");
      }
    } catch (e) {
      console.error(e);
      alert("Error updating sequence");
    }
  };

  return (
    <div className="admin-animate">
      <h1 className="admin-section-title">User Management</h1>
      <p className="admin-section-subtitle">KYC users list view</p>

      <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <input className="admin-input" style={{ width: 420 }} placeholder="Search by phone / email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button onClick={() => setSeqModal(true)} style={{ padding: "8px 16px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", fontWeight: 600, cursor: "pointer" }}>?? E-Stamp Settings</button>
      </div>

      {seqModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "var(--bg-primary)", padding: 24, borderRadius: 12, width: 400, border: "1px solid var(--border-color)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>E-Stamp Sequence</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16 }}>Set the next starting number for e-stamps. It will automatically pad to 6 digits (e.g., entering 500 will make the next stamp 000500).</p>
            <input type="number" value={seqInput} onChange={(e) => setSeqInput(e.target.value)} className="admin-input" style={{ width: "100%", marginBottom: 16 }} placeholder="e.g. 100" />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setSeqModal(false)} style={{ padding: "8px 16px", borderRadius: 8, background: "transparent", border: "1px solid var(--border-color)", color: "var(--text-muted)", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleUpdateSequence} style={{ padding: "8px 16px", borderRadius: 8, background: "var(--wise-green)", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}>Update Sequence</button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-table-container">
        <div style={{ display: "grid", gridTemplateColumns: "70px 1.8fr 1.5fr 1.2fr 1.9fr 1fr 1fr 1fr 110px", gap: 0, alignItems: "center", padding: "14px 10px", borderBottom: "2px solid var(--border-color)", color: "var(--text-primary)", fontWeight: 500, fontSize: "1.05rem", background: "var(--bg-secondary)" }}>
          <div></div>
          <div>Customer Ref No</div>
          <div>Customer Identifier</div>
          <div>Status</div>
          <div>Workflow Name</div>
          <div>Created At</div>
          <div>Updated At</div>
          <div>Resend Request</div>
          <div style={{ textAlign: "center" }}>1 of {users.length || 1}</div>
        </div>

        <div style={{ maxHeight: "74vh", overflowY: "auto", background: "var(--bg-primary)" }}>
          {loading ? <div style={{ padding: 16, color: "var(--text-muted)" }}>Loading...</div> : users.map((u, idx) => (
            <div key={`${u.userId}-${idx}`} style={{ display: "grid", gridTemplateColumns: "70px 1.8fr 1.5fr 1.2fr 1.9fr 1fr 1fr 1fr 110px", alignItems: "center", padding: "12px 10px", borderBottom: "1px solid var(--border-color)", borderLeft: "3px solid var(--wise-green)", background: "var(--bg-secondary)" }}>
              <div style={{ textAlign: "center", color: "var(--text-primary)" }}>{idx + 1}</div>

              <div>
                <div style={{ fontSize: "1.8ch", fontWeight: 500, color: "var(--text-primary)" }}>{u.customerRefNo}</div>
                <div style={{ marginTop: 3, fontSize: "0.9rem", color: "var(--text-muted)" }}>{u.kycRequestId}</div>
              </div>

              <div style={{ fontSize: "1.9ch", color: "var(--text-secondary)" }}>{u.customerIdentifier}</div>

              <div>
                <span className={`badge ${STATUS_MAP[u.status] || "badge-pending"}`}>
                  {u.status === "under_review" ? "Pending: Approval" : (u.status || "Pending").replace("_", " ")}
                </span>
              </div>

              <div style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{u.workflowName}</div>

              <div style={{ color: "var(--text-secondary)", lineHeight: 1.3 }}>{formatDate(u.createdAt)}</div>
              <div style={{ color: "var(--text-secondary)", lineHeight: 1.3 }}>{formatDate(u.updatedAt)}</div>

              <div>
                <button style={{ border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-muted)", borderRadius: 22, padding: "8px 16px", fontSize: "0.95rem", cursor: "not-allowed" }}>
                  Resend ?
                </button>
              </div>

              <div style={{ textAlign: "center" }}>
                <button 
                  onClick={() => router.push(`/admin/user/${u.userId}`)} 
                  style={{ 
                    padding: "6px 14px", 
                    borderRadius: 8, 
                    border: "1px solid var(--border-color)", 
                    background: "var(--bg-primary)", 
                    color: "var(--text-primary)", 
                    fontSize: "0.85rem", 
                    fontWeight: 700, 
                    cursor: "pointer",
                    transition: "all 0.2s ease" 
                  }}
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
