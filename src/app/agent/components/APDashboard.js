import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/utils/apiConfig";

export default function APDashboard({ agentUser }) {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [copied, setCopied] = useState(false);
  const [apCode, setApCode] = useState("");

  const fetchReferrals = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("agent_token");
      const url = new URL(`${API_BASE_URL}/api/agent/ap/referrals`);
      url.searchParams.append("page", page);
      url.searchParams.append("limit", 15);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) {
        window.location.href = "/agent/login";
        return;
      }

      const data = await response.json();
      if (data.success) {
        setReferrals(data.referrals || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setApCode(data.apCode || "");
      }
    } catch (err) {
      console.error("Fetch referrals failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (agentUser) {
      fetchReferrals();
    }
  }, [page, agentUser]);

  const referralLink = typeof window !== "undefined" && apCode
    ? `${window.location.origin}/?apcode=${apCode}`
    : "";

  const handleCopy = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!agentUser) return null;

  return (
    <div className="admin-animate">
      <h1 className="admin-section-title">My Referrals Dashboard</h1>
      <p className="admin-section-subtitle">Track users who registered through your unique link.</p>

      {/* Referral Link Card */}
      <div style={{
        background: "var(--bg-primary)",
        padding: "24px",
        borderRadius: "16px",
        border: "1px solid var(--border-color)",
        marginBottom: "32px",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>
        <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Your Unique Referral Link</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
          Share this link with your clients to start their KYC journey. They will automatically be tracked under your account.
        </p>
        <div style={{
          display: "flex",
          gap: "12px",
          marginTop: "8px",
          alignItems: "center"
        }}>
          <input
            type="text"
            readOnly
            value={referralLink}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              fontWeight: 600,
              outline: "none"
            }}
          />
          <button
            onClick={handleCopy}
            style={{
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              background: copied ? "var(--wise-positive)" : "var(--wise-green)",
              color: "var(--wise-dark-green)",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>

      {/* Referrals Table */}
      <div className="admin-table-container">
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>User Contact</th>
                <th>Registration Date</th>
                <th>KYC Stage</th>
                <th>KYC Status</th>
                <th>Last Update</th>
                <th>Assigned Agent</th>
              </tr>
            </thead>
            <tbody>
              {referrals.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "40px" }}>
                    {loading ? "Loading referrals..." : "You have no referrals yet."}
                  </td>
                </tr>
              ) : (
                referrals.map((user) => {
                  const latestApp = user.kycApplications?.[0];
                  return (
                    <tr key={user.id}>
                      <td style={{ fontWeight: 600 }}>{user.phone || user.email || "N/A"}</td>
                      <td style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        {latestApp ? `Step ${latestApp.currentStep}/17` : "Not Started"}
                      </td>
                      <td>
                        {latestApp ? (
                          <span className={`badge badge-${latestApp.status.replace("_", "")}`}>
                            {latestApp.status.replace("_", " ")}
                          </span>
                        ) : (
                          <span className="badge badge-pending">No App</span>
                        )}
                      </td>
                      <td style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                        {latestApp ? new Date(latestApp.updatedAt).toLocaleDateString() : "-"}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {latestApp?.assignedCrmAgentId || "Unassigned"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div style={{
          padding: "14px 24px",
          borderTop: "1px solid var(--border-color)",
          fontSize: "0.82rem",
          color: "var(--text-muted)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => p - 1)}
              style={{
                padding: "4px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                background: "transparent",
                cursor: "pointer",
                opacity: page <= 1 ? 0.4 : 1
              }}
            >
              Previous
            </button>
            <span style={{ fontWeight: 700 }}>Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: "4px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                background: "transparent",
                cursor: "pointer",
                opacity: page >= totalPages ? 0.4 : 1
              }}
            >
              Next
            </button>
          </div>
          <span>Total {total} referrals</span>
        </div>
      </div>
    </div>
  );
}
