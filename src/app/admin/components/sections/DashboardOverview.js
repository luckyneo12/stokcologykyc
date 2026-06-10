"use client";
import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/utils/apiConfig";

const StatCard = ({ label, value, sub, color, icon }) => (
  <div className="premium-metric-card" style={{
    background: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 10px 30px rgba(0,0,0,0.02)",
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
    cursor: "default"
  }}
  onMouseOver={(e) => {
    e.currentTarget.style.transform = "translateY(-5px)";
    e.currentTarget.style.boxShadow = "0 20px 40px rgba(0,0,0,0.06)";
  }}
  onMouseOut={(e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.02)";
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
      <div style={{ 
        width: 48, height: 48, borderRadius: 14, 
        background: `linear-gradient(135deg, ${color}22 0%, ${color}10 100%)`, 
        border: `1px solid ${color}30`,
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", color 
      }}>
        {icon}
      </div>
    </div>
    <div style={{ fontSize: "2.4rem", fontWeight: 900, marginBottom: 4, letterSpacing: "-1.5px", color: "var(--text-primary)" }}>{value}</div>
    <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
    {sub && <div style={{ fontSize: "0.75rem", color, fontWeight: 800, marginTop: 6 }}>{sub}</div>}
  </div>
);

const MiniBarChart = ({ data, color = "#30a46c", height = 60 }) => {
  const max = Math.max(...data, 1);
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${data.length * 16} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {data.map((v, i) => {
        const barH = (v / max) * (height - 10);
        return (
          <rect 
            key={i} x={i * 16 + 2} y={height - barH - 4} width={12} height={barH}
            rx={4} fill="url(#barGrad)" 
            style={{ transition: "all 0.3s ease" }}
            onMouseOver={(e) => { e.target.style.opacity = 0.8; }}
            onMouseOut={(e) => { e.target.style.opacity = 1; }}
          />
        );
      })}
    </svg>
  );
};

export default function DashboardOverview({ onNavigate }) {
  const [liveStats, setLiveStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (typeof window === "undefined") return;
      try {
        const token = localStorage.getItem("adminToken");
        const response = await fetch(`${API_BASE_URL}/api/admin/dashboard-data`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (data.success) {
            setLiveStats(data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const stats = [
    { label: "Total Submissions", value: liveStats?.total || "0", sub: "Lifetime count", color: "#30a46c", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
    { label: "Pending Review", value: liveStats?.review || "0", sub: "Awaiting Action", color: "#f59e0b", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label: "Verified", value: liveStats?.verified || "0", sub: "Completed KYC", color: "#10b981", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> },
    { label: "Rejected", value: liveStats?.rejected || "0", sub: "Failed KYC", color: "#ef4444", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> },
    { label: "On Hold", value: liveStats?.pending || "0", sub: "In Progress", color: "#3b82f6", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
    { label: "Avg. Time", value: "Real-time", sub: "Live data sync", color: "#8b5cf6", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
  ];

  const dropOff = liveStats?.dropOff || [];

  return (
    <div className="admin-animate" style={{ paddingBottom: 40 }}>
      <h1 className="admin-section-title" style={{ fontSize: "2.4rem", fontWeight: 950, letterSpacing: "-1px" }}>Dashboard Overview</h1>
      <p className="admin-section-subtitle" style={{ fontSize: "1.05rem", marginBottom: 30 }}>Real-time KYC compliance metrics and activity feed.</p>

      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 24, marginBottom: 40 }}>
        {stats.map((s, i) => <StatCard key={i} {...s} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 32 }}>
        {/* Weekly Trend */}
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 32, boxShadow: "0 10px 40px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 30 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>Weekly Submissions</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>Last 14 days</div>
            </div>
            <span style={{ background: "linear-gradient(135deg, #10b98122, #10b98110)", color: "#10b981", border: "1px solid #10b98140", padding: "6px 14px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 800 }}>+12% Trend</span>
          </div>
          <MiniBarChart data={liveStats?.weeklyTrend || []} color="#10b981" />
        </div>

        {/* Drop-off */}
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 32, boxShadow: "0 10px 40px rgba(0,0,0,0.03)" }}>
          <div style={{ fontWeight: 900, fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Drop-off per Step</div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: 24 }}>% of users who abandoned at each step</div>
          {dropOff.map((d, i) => (
            <div key={i} style={{ marginBottom: 16, background: "var(--bg-secondary)", padding: "10px 16px", borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{d.step}</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 900, color: d.rate > 15 ? "#ef4444" : "var(--text-muted)" }}>{d.rate}%</span>
              </div>
              <div style={{ height: 6, background: "var(--border-color)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${d.rate * 5}%`, height: "100%", background: d.rate > 15 ? "linear-gradient(90deg, #fca5a5, #ef4444)" : "linear-gradient(90deg, #6ee7b7, #10b981)", borderRadius: 99 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 32 }}>
        {/* Recent KYC */}
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 24, overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.03)" }}>
          <div style={{ padding: "24px 30px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-secondary)" }}>
            <div style={{ fontWeight: 900, fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>Recent KYC Requests</div>
            <button onClick={() => onNavigate("kyc")} style={{ fontSize: "0.85rem", fontWeight: 800, color: "#10b981", background: "rgba(16, 185, 129, 0.1)", padding: "6px 16px", borderRadius: 20, border: "none", cursor: "pointer", transition: "0.2s" }} onMouseOver={e => e.currentTarget.style.background="rgba(16, 185, 129, 0.2)"} onMouseOut={e => e.currentTarget.style.background="rgba(16, 185, 129, 0.1)"}>View All</button>
          </div>
          <table className="admin-table premium-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-primary)", textAlign: "left" }}>
                {["ID", "Name", "Status", "Risk", "Action"].map(h => <th key={h} style={{ padding: "16px 30px", color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "1px solid var(--border-color)" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(liveStats?.recent || []).length > 0 ? (
                liveStats.recent.slice(0, 6).map((k, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.2s ease" }} onMouseOver={e => e.currentTarget.style.background="var(--bg-secondary)"} onMouseOut={e => e.currentTarget.style.background="transparent"}>
                    <td style={{ padding: "18px 30px", fontWeight: 800, fontSize: "0.85rem", color: "var(--text-primary)" }}>{k.applicationId}</td>
                    <td style={{ padding: "18px 30px", fontWeight: 600 }}>{k.personalDetails?.fullName || k.user?.email || "User"}</td>
                    <td style={{ padding: "18px 30px" }}>
                      <span style={{ 
                        padding: "6px 12px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px",
                        background: k.status === "verified" ? "#d1fae5" : k.status === "rejected" ? "#fee2e2" : k.status === "under_review" ? "#dbeafe" : "#fef3c7",
                        color: k.status === "verified" ? "#065f46" : k.status === "rejected" ? "#991b1b" : k.status === "under_review" ? "#1e40af" : "#92400e"
                      }}>
                        {k.status.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ padding: "18px 30px", fontWeight: 900, color: (k.riskScore || 0) > 60 ? "#ef4444" : (k.riskScore || 0) > 30 ? "#f59e0b" : "#10b981" }}>{k.riskScore || 0}</td>
                    <td style={{ padding: "18px 30px" }}>
                      <button onClick={() => onNavigate("kyc")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--text-primary)", color: "var(--bg-primary)", fontWeight: 800, fontSize: "0.75rem", cursor: "pointer", transition: "transform 0.2s ease" }} onMouseOver={e => e.currentTarget.style.transform="scale(1.05)"} onMouseOut={e => e.currentTarget.style.transform="scale(1)"}>Review</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="5" style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontWeight: 700 }}>No recent requests found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Live Activity Timeline */}
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 0, overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "24px 30px", borderBottom: "1px solid var(--border-color)", fontWeight: 900, fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: "0.5px", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            Live Activity Feed
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "#10b981", fontWeight: 800 }}>
              <span style={{ width: 8, height: 8, background: "#10b981", borderRadius: "50%", display: "inline-block", animation: "pulse 2s infinite" }} /> Live
            </span>
          </div>
          <div style={{ padding: "30px 30px", flex: 1, position: "relative" }}>
            {/* Timeline vertical line */}
            <div style={{ position: "absolute", left: 35, top: 40, bottom: 40, width: 2, background: "var(--border-color)", borderRadius: 2 }} />
            
            {(liveStats?.liveActivity || []).map((a, i) => (
              <div key={i} style={{ position: "relative", paddingLeft: 30, marginBottom: 28, animation: `slideIn 0.3s ease forwards ${i * 0.1}s`, opacity: 0 }}>
                <div style={{ position: "absolute", left: -1, top: 4, width: 14, height: 14, borderRadius: "50%", background: "var(--bg-primary)", border: `3px solid ${a.color}`, zIndex: 2, boxShadow: `0 0 10px ${a.color}60` }} />
                <div style={{ background: "var(--bg-secondary)", padding: "14px 20px", borderRadius: 12, border: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>{a.action}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>{a.user} &bull; <span style={{ color: a.color }}>{a.time}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 50% { opacity: 0.5; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}
