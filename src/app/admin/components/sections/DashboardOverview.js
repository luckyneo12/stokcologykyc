"use client";
import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/utils/apiConfig";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  ShieldAlert, Users, FileText, CheckCircle, Clock, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, Activity, ChevronRight 
} from 'lucide-react';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

const StatCard = ({ label, value, trend, trendValue, icon: Icon, color, onClick }) => (
  <div className="premium-metric-card" style={{
    background: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: 24,
    padding: "24px 28px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.02)",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    position: "relative",
    overflow: "hidden",
    cursor: onClick ? "pointer" : "default"
  }}
  onClick={onClick}
  onMouseOver={(e) => {
    e.currentTarget.style.transform = "translateY(-4px)";
    e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.06)";
    e.currentTarget.style.borderColor = `${color}40`;
  }}
  onMouseOut={(e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.02)";
    e.currentTarget.style.borderColor = "var(--border-color)";
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div style={{ 
        width: 44, height: 44, borderRadius: 12, 
        background: "var(--bg-secondary)", 
        border: "1px solid var(--border-color)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)" 
      }}>
        <Icon size={22} strokeWidth={2} />
      </div>
      {trend && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: trend === 'up' ? '#10b98115' : '#ef444415', color: trend === 'up' ? '#10b981' : '#ef4444', padding: "4px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 700 }}>
          {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trendValue}
        </div>
      )}
    </div>
    <div style={{ fontSize: "2.5rem", fontWeight: 900, marginBottom: 4, letterSpacing: "-1px", color: "var(--text-primary)" }}>{value}</div>
    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", padding: "12px 16px", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
        <p style={{ margin: "0 0 8px", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)" }}>{label}</p>
        {payload.map((entry, index) => (
          <div key={index} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "1rem", fontWeight: 800, color: entry.color }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color }} />
            {entry.name}: {entry.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardOverview({ onNavigate }) {
  const [liveStats, setLiveStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartDays, setChartDays] = useState(14);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("adminToken");
        const response = await fetch(`${API_BASE_URL}/api/admin/dashboard-data?days=${chartDays}`, {
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
  }, [chartDays]);

  if (loading) {
    return (
      <div className="admin-animate" style={{ paddingBottom: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
          <div>
            <div className="skeleton" style={{ width: 300, height: 40, marginBottom: 8, borderRadius: 12 }}></div>
            <div className="skeleton" style={{ width: 200, height: 20, borderRadius: 8 }}></div>
          </div>
          <div className="skeleton" style={{ width: 140, height: 40, borderRadius: 999 }}></div>
        </div>

        {/* Skeleton Top Metric Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24, marginBottom: 32 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="metric-card" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 16 }}></div>
                <div className="skeleton" style={{ width: 50, height: 20, borderRadius: 999 }}></div>
              </div>
              <div className="skeleton" style={{ width: "60%", height: 36, borderRadius: 8 }}></div>
              <div className="skeleton" style={{ width: "40%", height: 16, borderRadius: 4 }}></div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: 24, marginBottom: 24 }}>
          {/* Skeleton Chart */}
          <div className="card">
            <div className="skeleton" style={{ width: 200, height: 24, marginBottom: 8, borderRadius: 8 }}></div>
            <div className="skeleton" style={{ width: 150, height: 16, marginBottom: 30, borderRadius: 4 }}></div>
            <div className="skeleton" style={{ width: "100%", height: 280, borderRadius: 12 }}></div>
          </div>
          {/* Skeleton Pie */}
          <div className="card">
            <div className="skeleton" style={{ width: 150, height: 24, marginBottom: 8, borderRadius: 8 }}></div>
            <div className="skeleton" style={{ width: 180, height: 16, marginBottom: 30, borderRadius: 4 }}></div>
            <div className="skeleton" style={{ width: "100%", height: 200, borderRadius: "50%", margin: "0 auto 20px", maxWidth: 200 }}></div>
            <div className="skeleton" style={{ width: "100%", height: 40, borderRadius: 8 }}></div>
          </div>
        </div>
      </div>
    );
  }

  const total = liveStats?.total || 0;
  const verified = liveStats?.verified || 0;
  const rejected = liveStats?.rejected || 0;
  const review = liveStats?.review || 0;
  const globeApproved = liveStats?.globeApprovedCount || 0;
  const globeRejected = liveStats?.globeRejectedCount || 0;
  const pushedToBo = liveStats?.pushedToBoCount || 0;
  const notPushedToBo = liveStats?.notPushedToBoCount || 0;
  const trends = liveStats?.trends || { total: 0, verified: 0, rejected: 0 };

  const getTrendIcon = (val) => val >= 0 ? "up" : "down";
  const getTrendStr = (val) => `${val > 0 ? '+' : ''}${val}%`;

  const handleExport = () => {
    if (!liveStats) return;

    // Create CSV content
    let csv = "KYC Portal - Dashboard Report\n\n";
    csv += `Total Submissions,${total}\n`;
    csv += `Verified Identities,${verified}\n`;
    csv += `Pending Review,${review}\n`;
    csv += `Rejected,${rejected}\n`;
    csv += `On Hold,${liveStats?.onHold || 0}\n\n`;

    csv += "Recent Applications\n";
    csv += "KYC ID,Number,Name,Status,Date\n";
    
    (liveStats.recent || []).forEach(app => {
      let parsedPersonal = {};
      try { parsedPersonal = typeof app.personalDetails === "string" ? JSON.parse(app.personalDetails) : (app.personalDetails || {}); } catch(e) {}
      const name = parsedPersonal.fullName || parsedPersonal.name || "N/A";
      const date = new Date(app.updatedAt || app.createdAt).toLocaleString();
      // Wrap name in quotes in case it contains commas
      csv += `${app.applicationId || app.id},${app.user?.phone || "N/A"},"${name}",${app.status},"${date}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `KYC_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const trendData = (liveStats?.weeklyTrend || []).map((val, i) => ({
    day: `Day ${i + 1}`,
    submissions: typeof val === 'number' ? val : (val.submissions || 0),
    approvals: typeof val === 'number' ? 0 : (val.approvals || 0),
    rejections: typeof val === 'number' ? 0 : (val.rejections || 0)
  }));

  const pieData = [
    { name: 'Verified', value: verified },
    { name: 'Pending', value: review },
    { name: 'Rejected', value: rejected },
    { name: 'On Hold', value: liveStats?.onHold || 0 }
  ].filter(d => d.value > 0);

  const dropOffData = (liveStats?.dropOff || []).map(d => ({
    step: d.step,
    dropRate: d.rate,
    retentionRate: 100 - d.rate
  }));

  const avgProcessing = liveStats?.averageProcessingTime && liveStats.averageProcessingTime !== "N/A" 
    ? liveStats.averageProcessingTime 
    : "3 mins"; // Mock data if empty

  const avgUserCompletion = liveStats?.averageUserCompletionTime && liveStats.averageUserCompletionTime !== "N/A" 
    ? liveStats.averageUserCompletionTime 
    : "8 mins"; // Mock data if empty

  const rejectionReasonsData = liveStats?.rejectionReasons && liveStats.rejectionReasons.length > 0 
    ? liveStats.rejectionReasons 
    : [
        { name: "Poor Image Quality", value: 14 },
        { name: "Name Mismatch", value: 8 },
        { name: "Document Expired", value: 5 },
        { name: "Selfie Not Matching", value: 3 }
      ]; // Mock data if empty

  const deviceStatsData = liveStats?.deviceStats && liveStats.deviceStats.length > 0 
    ? liveStats.deviceStats 
    : [
        { name: "Mobile", value: 65 },
        { name: "Desktop", value: 25 },
        { name: "Tablet", value: 10 }
      ]; // Mock data if empty

  return (
    <div className="admin-animate" style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <h1 className="admin-section-title" style={{ fontSize: "2.4rem", fontWeight: 950, letterSpacing: "-1px", marginBottom: 6 }}>Dashboard Overview</h1>
          <p className="admin-section-subtitle" style={{ fontSize: "1.05rem", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "flex", width: 10, height: 10, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px #10b981" }} className="pulse-dot" />
            Real-time KYC intelligence & analytics
          </p>
        </div>
        <button 
          onClick={handleExport}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--text-primary)", color: "var(--bg-primary)", border: "none", padding: "10px 20px", borderRadius: 999, fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", transition: "transform 0.2s" }} 
          onMouseOver={e => e.currentTarget.style.transform="scale(1.05)"} 
          onMouseOut={e => e.currentTarget.style.transform="scale(1)"}
        >
          <FileText size={18} />
          Export Report
        </button>
      </div>

      {/* Top Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24, marginBottom: 32 }}>
        <StatCard label="Total Submissions" value={total} trend={getTrendIcon(trends.total)} trendValue={getTrendStr(trends.total)} icon={Users} color="#8b5cf6" onClick={() => onNavigate("kyc", { filter: "all" })} />
        <StatCard label="Verified" value={verified} trend={getTrendIcon(trends.verified)} trendValue={getTrendStr(trends.verified)} icon={CheckCircle} color="#10b981" onClick={() => onNavigate("kyc", { filter: "verified" })} />
        <StatCard label="Pending Review" value={review} icon={Activity} color="#f59e0b" onClick={() => onNavigate("kyc", { filter: "under_review" })} />
        <StatCard label="Rejected" value={rejected} trend={getTrendIcon(trends.rejected)} trendValue={getTrendStr(trends.rejected)} icon={ShieldAlert} color="#ef4444" onClick={() => onNavigate("kyc", { filter: "rejected" })} />
        <StatCard label="Globe Approved" value={globeApproved} icon={CheckCircle} color="#10b981" onClick={() => onNavigate("kyc", { filter: "globe_approved" })} />
        <StatCard label="Globe Rejected" value={globeRejected} icon={ShieldAlert} color="#ef4444" onClick={() => onNavigate("kyc", { filter: "globe_rejected" })} />
        <StatCard label="Pushed To BO" value={pushedToBo} icon={CheckCircle} color="#8b5cf6" onClick={() => onNavigate("kyc", { filter: "pushed_to_bo" })} />
        <StatCard label="Not Pushed" value={notPushedToBo} icon={ShieldAlert} color="#ef4444" onClick={() => onNavigate("kyc", { filter: "not_pushed_to_bo" })} />
        <StatCard label="Agent Processing" value={avgProcessing} icon={Clock} color="#3b82f6" />
        <StatCard label="User Completion" value={avgUserCompletion} icon={Clock} color="#8b5cf6" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: 24, marginBottom: 24 }}>
        {/* Weekly Trend Area Chart */}
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: "1.2rem", letterSpacing: "-0.5px" }}>Submission Volume Trend</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>{chartDays}-day trailing analysis</div>
            </div>
            <select className="admin-select" value={chartDays} onChange={e => setChartDays(Number(e.target.value))} style={{ padding: "8px 16px", borderRadius: 12, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", fontWeight: 700, fontSize: "0.85rem", color: "var(--text-primary)" }}>
              <option value={14}>Last 14 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>
          <div style={{ height: 300, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorApprovals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRejections" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--text-muted)", fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--text-muted)", fontWeight: 600 }} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="submissions" name="Submissions" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorSubmissions)" activeDot={{ r: 6, strokeWidth: 0, fill: "#8b5cf6" }} />
                <Area type="monotone" dataKey="approvals" name="Approvals" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorApprovals)" activeDot={{ r: 6, strokeWidth: 0, fill: "#10b981" }} />
                <Area type="monotone" dataKey="rejections" name="Rejections" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorRejections)" activeDot={{ r: 6, strokeWidth: 0, fill: "#ef4444" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Pie Chart */}
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column" }}>
          <div style={{ fontWeight: 900, fontSize: "1.2rem", letterSpacing: "-0.5px", marginBottom: 4 }}>Status Breakdown</div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: 20 }}>Current pipeline distribution</div>
          
          <div style={{ flex: 1, position: "relative", minHeight: 200 }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontWeight: 600 }}>No Data</div>
            )}
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
              <div style={{ fontSize: "2rem", fontWeight: 900, lineHeight: 1 }}>{total}</div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Total</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
            {pieData.map((entry, index) => (
              <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", fontWeight: 600 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS[index % COLORS.length] }} />
                <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{entry.name}</span>
                <span style={{ marginLeft: "auto", fontWeight: 800 }}>{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, marginBottom: 32 }}>
        {/* Drop-off Funnel Chart */}
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}>
           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: "1.2rem", letterSpacing: "-0.5px" }}>User Drop-off Funnel</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>Abandonment rate per step</div>
            </div>
          </div>
          <div style={{ height: 260, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dropOffData} margin={{ top: 0, right: 0, left: 10, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--text-muted)", fontWeight: 600 }} domain={[0, 100]} />
                <YAxis dataKey="step" type="category" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--text-primary)", fontWeight: 700 }} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="retentionRate" name="Retention %" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={20} />
                <Bar dataKey="dropRate" name="Drop-off %" stackId="a" fill="#ef4444" radius={[0, 8, 8, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 24, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}>
          <div style={{ padding: "24px 28px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-secondary)" }}>
            <div style={{ fontWeight: 900, fontSize: "1.1rem", letterSpacing: "-0.5px" }}>Live Activity Feed</div>
            <Activity size={18} color="#10b981" />
          </div>
          <div style={{ padding: "24px 28px", flex: 1, position: "relative", overflowY: "auto", maxHeight: 310 }}>
            <div style={{ position: "absolute", left: 35, top: 24, bottom: 24, width: 2, background: "var(--border-color)", borderRadius: 2 }} />
            {(liveStats?.liveActivity || []).map((a, i) => (
              <div key={i} style={{ position: "relative", paddingLeft: 30, marginBottom: 24, animation: `slideIn 0.3s ease forwards ${i * 0.1}s`, opacity: 0 }}>
                <div style={{ position: "absolute", left: -1, top: 4, width: 14, height: 14, borderRadius: "50%", background: "var(--bg-primary)", border: `3px solid ${a.color}`, zIndex: 2, boxShadow: `0 0 10px ${a.color}40` }} />
                <div style={{ background: "var(--bg-secondary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 2 }}>{a.action}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>{a.user}</div>
                  </div>
                  <div style={{ fontSize: "0.7rem", color: a.color, fontWeight: 800, background: `${a.color}15`, padding: "4px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>{a.time}</div>
                </div>
              </div>
            ))}
            {(!liveStats?.liveActivity || liveStats.liveActivity.length === 0) && (
              <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: 40, fontWeight: 600 }}>No recent activity</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent KYC Requests Table */}
      <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 24, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}>
        <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-secondary)" }}>
          <div style={{ fontWeight: 900, fontSize: "1.2rem", letterSpacing: "-0.5px" }}>Recent Applications</div>
          <button onClick={() => onNavigate("kyc")} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)", background: "transparent", border: "1px solid var(--border-color)", padding: "8px 16px", borderRadius: 999, cursor: "pointer", transition: "0.2s" }} onMouseOver={e => e.currentTarget.style.background="var(--border-color)"} onMouseOut={e => e.currentTarget.style.background="transparent"}>
            View All <ChevronRight size={16} />
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", background: "var(--bg-primary)" }}>
                {["ID", "Applicant", "Status", "Action"].map(h => <th key={h} style={{ padding: "16px 32px", color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "1px solid var(--border-color)", fontWeight: 800 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(liveStats?.recent || []).length > 0 ? (
                liveStats.recent.slice(0, 6).map((k, i) => {
                  let parsedPersonal = {};
                  try { parsedPersonal = typeof k.personalDetails === "string" ? JSON.parse(k.personalDetails) : (k.personalDetails || {}); } catch(e) {}
                  
                  return (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.2s ease" }} onMouseOver={e => e.currentTarget.style.background="var(--bg-secondary)"} onMouseOut={e => e.currentTarget.style.background="transparent"}>
                    <td style={{ padding: "18px 32px", fontWeight: 800, fontSize: "0.85rem", color: "var(--text-primary)" }}>{k.applicationId}</td>
                    <td style={{ padding: "18px 32px" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{parsedPersonal.fullName || parsedPersonal.name || "N/A"}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>{k.user?.phone || ""}</div>
                    </td>
                    <td style={{ padding: "18px 32px" }}>
                      <span style={{ 
                        padding: "6px 12px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", display: "inline-block",
                        background: k.status === "verified" ? "#10b98115" : k.status === "rejected" ? "#ef444415" : k.status === "under_review" ? "#3b82f615" : "#f59e0b15",
                        color: k.status === "verified" ? "#10b981" : k.status === "rejected" ? "#ef4444" : k.status === "under_review" ? "#3b82f6" : "#f59e0b"
                      }}>
                        {k.status.replace("_", " ")}
                      </span>
                    </td>

                    <td style={{ padding: "18px 32px" }}>
                      <button onClick={() => onNavigate("kyc")} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)", fontWeight: 800, fontSize: "0.75rem", cursor: "pointer", transition: "all 0.2s ease", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }} onMouseOver={e => e.currentTarget.style.borderColor="var(--text-muted)"} onMouseOut={e => e.currentTarget.style.borderColor="var(--border-color)"}>Review</button>
                    </td>
                  </tr>
                  );
                })
              ) : (
                <tr><td colSpan="4" style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontWeight: 700 }}>No recent requests found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 24, marginBottom: 32 }}>
        {/* Rejection Reasons Pie Chart */}
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column" }}>
          <div style={{ fontWeight: 900, fontSize: "1.2rem", letterSpacing: "-0.5px", marginBottom: 4 }}>Rejection Reasons</div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: 20 }}>Top reasons for application denial</div>
          
          <div style={{ flex: 1, position: "relative", minHeight: 220 }}>
            {rejectionReasonsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rejectionReasonsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {rejectionReasonsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontWeight: 600 }}>No Rejections Found</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            {rejectionReasonsData.map((entry, index) => (
              <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", fontWeight: 600 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS[index % COLORS.length], flexShrink: 0 }} />
                <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={entry.name}>{entry.name}</span>
                <span style={{ marginLeft: "auto", fontWeight: 800 }}>{entry.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Device & Platform Usage */}
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column" }}>
          <div style={{ fontWeight: 900, fontSize: "1.2rem", letterSpacing: "-0.5px", marginBottom: 4 }}>Device & Platform Usage</div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: 20 }}>How users complete KYC</div>
          
          <div style={{ flex: 1, position: "relative", minHeight: 220 }}>
            {deviceStatsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deviceStatsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {deviceStatsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontWeight: 600 }}>No Device Data</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            {deviceStatsData.map((entry, index) => (
              <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", fontWeight: 600 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS[(index + 2) % COLORS.length], flexShrink: 0 }} />
                <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{entry.name}</span>
                <span style={{ marginLeft: "auto", fontWeight: 800 }}>{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .pulse-dot { animation: pulseDot 2s infinite; }
        @keyframes pulseDot { 
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 
          50% { opacity: 0.5; box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); } 
        }
        @keyframes slideIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
        /* Recharts Overrides for Dark Mode Compatibility */
        [data-theme="dark"] .recharts-cartesian-grid-line { stroke: rgba(255, 255, 255, 0.05); }
        [data-theme="dark"] .recharts-text { fill: rgba(255, 255, 255, 0.5); }
      `}</style>
    </div>
  );
}
