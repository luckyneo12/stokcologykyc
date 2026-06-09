"use client";
import { useState, useEffect } from "react";
import { DASHBOARD_STATS, MOCK_KYC } from "../../mockData";
import { API_BASE_URL } from "@/utils/apiConfig";

const StatCard = ({ label, value, sub, color, icon }) => (
  <div className="metric-card">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color }}>{icon}</div>
    </div>
    <div style={{ fontSize: "2.2rem", fontWeight: 900, marginBottom: 4, letterSpacing: "-1px" }}>{value}</div>
    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>{label}</div>
    {sub && <div style={{ fontSize: "0.75rem", color, fontWeight: 700, marginTop: 4 }}>{sub}</div>}
  </div>
);

const MiniBarChart = ({ data, color = "#9fe870", height = 50 }) => {
  const max = Math.max(...data);
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${data.length * 14} ${height}`} preserveAspectRatio="none">
      {data.map((v, i) => {
        const barH = (v / max) * (height - 8);
        return (
          <rect key={i} x={i * 14 + 2} y={height - barH - 4} width={10} height={barH}
            rx={3} fill={color} opacity={0.7 + 0.3 * (v / max)} />
        );
      })}
    </svg>
  );
};

const ACTIVITY = [
  { action: "KYC Approved", user: "Arjun Sharma", time: "2 min ago", color: "#30a46c" },
  { action: "Flag Added - Face Mismatch", user: "Priya Patel", time: "8 min ago", color: "#e5484d" },
  { action: "KYC Submitted", user: "Rahul Verma", time: "15 min ago", color: "#0091ff" },
  { action: "Document Re-uploaded", user: "Sneha Gupta", time: "22 min ago", color: "#ffb224" },
  { action: "KYC Rejected", user: "Vikram Singh", time: "35 min ago", color: "#e5484d" },
  { action: "KYC Approved", user: "Ananya Mishra", time: "51 min ago", color: "#30a46c" },
];

export default function DashboardOverview({ onNavigate }) {
  const [liveStats, setLiveStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (typeof window === "undefined") return;
      try {
        const token = localStorage.getItem("adminToken");
        console.log("Fetching stats from:", `${API_BASE_URL}/api/admin/dashboard-data`);
        const response = await fetch(`${API_BASE_URL}/api/admin/dashboard-data`, {
          headers: { 
            "Authorization": `Bearer ${token}` 
          }
        });
        
        console.log("Stats response status:", response.status);
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (data.success) {
            setLiveStats(data);
          }
        } else {
          const text = await response.text();
          console.warn("Expected JSON but got:", text.substring(0, 100));
        }
      } catch (err) {
        console.error("Failed to fetch stats! API_BASE_URL:", API_BASE_URL, "Error:", err.message, err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const stats = [
    { label: "Total Submissions", value: liveStats?.total || "0", sub: "Lifetime", color: "#9fe870", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
    { label: "Pending Review", value: liveStats?.review || "0", sub: "Awaiting Action", color: "#ffb224", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label: "Verified", value: liveStats?.verified || "0", sub: "Completed KYC", color: "#30a46c", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> },
    { label: "Rejected", value: liveStats?.rejected || "0", sub: "Failed KYC", color: "#e5484d", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> },
    { label: "On Hold", value: liveStats?.pending || "0", sub: "In Progress", color: "#0091ff", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
    { label: "Avg. Time", value: "Real-time", sub: "Live dashboard", color: "#9fe870", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  ];

  const dropOff = DASHBOARD_STATS.dropOff;

  return (
    <div className="admin-animate">
      <h1 className="admin-section-title">Dashboard Overview</h1>
      <p className="admin-section-subtitle">Real-time KYC compliance metrics and activity feed.</p>

      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20, marginBottom: 36 }}>
        {stats.map((s, i) => <StatCard key={i} {...s} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        {/* Weekly Trend */}
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1rem" }}>Weekly Submissions</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Last 14 days</div>
            </div>
            <span style={{ background: "rgba(159,232,112,0.15)", color: "#30a46c", padding: "4px 12px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 800 }}>+12%</span>
          </div>
          <MiniBarChart data={DASHBOARD_STATS.weeklyTrend} />
        </div>

        {/* Drop-off */}
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, padding: 28 }}>
          <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: 4 }}>Drop-off per Step</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 20 }}>% of users who abandoned at each step</div>
          {dropOff.map((d, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{d.step}</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 800, color: d.rate > 15 ? "#e5484d" : "var(--text-muted)" }}>{d.rate}%</span>
              </div>
              <div style={{ height: 6, background: "var(--border-color)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${d.rate * 5}%`, height: "100%", background: d.rate > 15 ? "#e5484d" : "#9fe870", borderRadius: 99 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 24 }}>
        {/* Recent KYC */}
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 800 }}>Recent KYC Requests</div>
            <button onClick={() => onNavigate("kyc")} style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--wise-green)", background: "none", border: "none", cursor: "pointer" }}>View All →</button>
          </div>
          <table className="admin-table">
            <thead><tr>
              {["ID", "Name", "Status", "Risk", "Action"].map(h => <th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {(liveStats?.recent || []).length > 0 ? (
                liveStats.recent.slice(0, 6).map((k, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, fontSize: "0.8rem" }}>{k.applicationId}</td>
                    <td style={{ fontWeight: 600 }}>{k.personalDetails?.fullName || k.user?.email || "User"}</td>
                    <td><span className={`badge badge-${k.status === "verified" ? "verified" : k.status === "rejected" ? "rejected" : k.status === "under_review" ? "review" : k.status === "on_hold" ? "suspended" : "pending"}`}>{k.status.replace("_", " ")}</span></td>
                    <td style={{ fontWeight: 800, color: (k.riskScore || 0) > 60 ? "#e5484d" : (k.riskScore || 0) > 30 ? "#b45309" : "#30a46c" }}>{k.riskScore || 0}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => onNavigate("kyc")} style={{ padding: "4px 10px", borderRadius: 999, border: "none", background: "rgba(48,164,108,0.1)", color: "#30a46c", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }}>View</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="5" style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>No recent requests</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Live Activity */}
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", fontWeight: 800 }}>
            Live Activity Feed
            <span style={{ width: 8, height: 8, background: "#30a46c", borderRadius: "50%", display: "inline-block", marginLeft: 8, animation: "pulse 2s infinite" }} />
          </div>
          <div style={{ padding: "8px 0" }}>
            {ACTIVITY.map((a, i) => (
              <div key={i} style={{ padding: "12px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.color, flexShrink: 0, marginTop: 5 }} />
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 700 }}>{a.action}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{a.user} · {a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
