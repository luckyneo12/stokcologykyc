"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/utils/apiConfig";

export default function EStamps({ searchQuery, onSearchChange }) {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [localSearch, setLocalSearch] = useState("");
  const search = searchQuery !== undefined ? searchQuery : localSearch;
  const setSearch = onSearchChange !== undefined ? onSearchChange : setLocalSearch;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEStamps = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("adminToken");
        const url = new URL(`${API_BASE_URL}/api/admin/users`);
        if (search) url.searchParams.set("search", search);
        url.searchParams.set("limit", "500");
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!data.success) return;

        // Filter only users who have an eStamp
        const estampUsers = (data.users || []).filter(u => u.eStamp).map((u) => {
          const latest = (u.kycApplications || [])[0] || {};
          return {
            userId: u.id,
            eStamp: u.eStamp,
            customerRefNo: latest.applicationId || "-",
            fullName: latest.personalDetails?.fullName || "N/A",
            phone: u.phone || "-",
            status: latest.status || "pending",
          };
        });

        setUsers(estampUsers);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    const t = setTimeout(fetchEStamps, 180);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="admin-animate">
      <h1 className="admin-section-title">E-Stamps Directory</h1>
      <p className="admin-section-subtitle">View all assigned digital e-stamps</p>

      <div style={{ marginBottom: 12 }}>
        <input 
          className="admin-input" 
          style={{ width: 420 }} 
          placeholder="Search by phone / name / ID" 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
        />
      </div>

      <div className="admin-table-container">
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "70px 1.2fr 1.8fr 1.5fr 1.5fr 110px", 
          gap: 0, 
          alignItems: "center", 
          padding: "14px 10px", 
          borderBottom: "2px solid var(--border-color)", 
          color: "var(--text-primary)", 
          fontWeight: 500, 
          fontSize: "1.05rem", 
          background: "var(--bg-secondary)" 
        }}>
          <div style={{ textAlign: "center" }}>#</div>
          <div>E-Stamp</div>
          <div>Customer Name</div>
          <div>Phone Number</div>
          <div>KYC User ID</div>
          <div style={{ textAlign: "center" }}>Action</div>
        </div>

        <div style={{ maxHeight: "74vh", overflowY: "auto", background: "var(--bg-primary)" }}>
          {loading ? (
            <div style={{ padding: 16, color: "var(--text-muted)" }}>Loading e-stamps...</div>
          ) : users.length === 0 ? (
            <div style={{ padding: 16, color: "var(--text-muted)" }}>No e-stamps found.</div>
          ) : (
            users.map((u, idx) => (
              <div 
                key={`${u.userId}-${idx}`} 
                style={{ 
                  display: "grid", 
                  gridTemplateColumns: "70px 1.2fr 1.8fr 1.5fr 1.5fr 110px", 
                  alignItems: "center", 
                  padding: "12px 10px", 
                  borderBottom: "1px solid var(--border-color)", 
                  borderLeft: "3px solid var(--wise-green)", 
                  background: "var(--bg-secondary)",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
                onClick={() => router.push(`/admin/user/${u.userId}`)}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-primary)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-secondary)"}
              >
                <div style={{ textAlign: "center", color: "var(--text-muted)" }}>{idx + 1}</div>

                <div style={{ fontWeight: 800, color: "var(--wise-green)", letterSpacing: "1px", fontSize: "1.1rem" }}>
                  {u.eStamp}
                </div>

                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {u.fullName}
                </div>

                <div style={{ color: "var(--text-secondary)" }}>
                  {u.phone}
                </div>

                <div style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
                  {u.customerRefNo}
                </div>

                <div style={{ textAlign: "center" }}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/admin/user/${u.userId}`);
                    }} 
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
