"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/utils/apiConfig";

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

export default function UserManagement() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="admin-animate">
      <h1 className="admin-section-title">User Management</h1>
      <p className="admin-section-subtitle">KYC users list view</p>

      <div style={{ marginBottom: 12 }}>
        <input className="admin-input" style={{ width: 420 }} placeholder="Search by phone / email" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div style={{ border: "1px solid #b9c8e6", borderRadius: 14, background: "#eef3ff", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "70px 1.8fr 1.5fr 1.2fr 1.9fr 1fr 1fr 1fr 110px", gap: 0, alignItems: "center", padding: "14px 10px", borderBottom: "2px solid #2d6fce", color: "#1f2a44", fontWeight: 500, fontSize: "1.05rem" }}>
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

        <div style={{ maxHeight: "74vh", overflowY: "auto", background: "#f5f7fd" }}>
          {loading ? <div style={{ padding: 16 }}>Loading...</div> : users.map((u, idx) => (
            <div key={`${u.userId}-${idx}`} style={{ display: "grid", gridTemplateColumns: "70px 1.8fr 1.5fr 1.2fr 1.9fr 1fr 1fr 1fr 110px", alignItems: "center", padding: "12px 10px", borderBottom: "1px solid #d8deea", borderLeft: "3px solid #2d6fce", background: "#f4f6fb" }}>
              <div style={{ textAlign: "center", color: "#1f2a44" }}>{idx + 1}</div>

              <div>
                <div style={{ fontSize: "1.8ch", fontWeight: 500, color: "#12284c" }}>{u.customerRefNo}</div>
                <div style={{ marginTop: 3, fontSize: "0.9rem", color: "#7d8aa6" }}>{u.kycRequestId}</div>
              </div>

              <div style={{ fontSize: "1.9ch", color: "#2a3551" }}>{u.customerIdentifier}</div>

              <div>
                <span style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "#f8efdb", border: "1px solid #9d7723", color: "#5d4310", fontSize: "1.05rem", whiteSpace: "nowrap" }}>
                  {u.status === "under_review" ? "Pending: Approval" : (u.status || "Pending").replace("_", " ")}
                </span>
              </div>

              <div style={{ color: "#1f2a44", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{u.workflowName}</div>

              <div style={{ color: "#374764", lineHeight: 1.3 }}>{formatDate(u.createdAt)}</div>
              <div style={{ color: "#374764", lineHeight: 1.3 }}>{formatDate(u.updatedAt)}</div>

              <div>
                <button style={{ border: "1px solid #cfd5df", background: "#e8ecf3", color: "#9098a6", borderRadius: 22, padding: "8px 16px", fontSize: "0.95rem", cursor: "not-allowed" }}>
                  Resend ?
                </button>
              </div>

              <div style={{ textAlign: "center" }}>
                <button onClick={() => router.push(`/admin/user/${u.userId}`)} style={{ border: "none", background: "transparent", color: "#1665c0", fontSize: "2.2ch", cursor: "pointer", fontWeight: 500 }}>
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
