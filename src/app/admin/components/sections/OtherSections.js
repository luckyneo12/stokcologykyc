"use client";
import React, { useState, useEffect } from "react";
import { MOCK_KYC } from "../../mockData";
import { MOCK_RULES, MOCK_NOTIFICATIONS, MOCK_ROLES, MOCK_AUDIT_LOGS, DASHBOARD_STATS } from "../../mockData";
import { API_BASE_URL } from "@/utils/apiConfig";

// ---- Risk & Fraud ----
// ---- Risk & Fraud ----
export function RiskFraud() {
  const [kycs, setKycs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRisk = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/risk-fraud`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        const mapped = data.highRisk.map(k => ({
          id: k.applicationId,
          name: k.personalDetails?.fullName || k.user?.email || "Unknown",
          riskScore: Math.round(100 - (k.faceMatchScore || 0)), // Reverse score for risk
          status: k.status,
          flags: (k.faceMatchScore < 80 ? ["Low Face Match"] : [])
        }));
        setKycs(mapped);
      }
    } catch (err) {
      console.error("Risk fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRisk();
  }, []);

  const getRiskColor = (s) => s > 70 ? "#e5484d" : s > 40 ? "#ffb224" : "#30a46c";

  return (
    <div className="admin-animate">
      <h1 className="admin-section-title">Risk & Fraud Detection</h1>
      <p className="admin-section-subtitle">Real-time monitoring of suspicious identities and low-confidence match scores.</p>
      
      {loading ? (
        <div className="metric-card" style={{ textAlign: "center", padding: 40 }}>
           <div className="loader" style={{ margin: "0 auto 16px" }} />
           <p>Scanning applications for risk patterns...</p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 28 }}>
            {[{ label: "High Risk (>70)", value: kycs.filter(k => k.riskScore > 70).length, color: "#e5484d" }, { label: "Medium Risk", value: kycs.filter(k => k.riskScore > 40 && k.riskScore <= 70).length, color: "#ffb224" }, { label: "Flagged Cases", value: kycs.filter(k => k.flags?.length).length, color: "#e5484d" }].map((s, i) => (
              <div key={i} className="metric-card" style={{ borderLeft: `4px solid ${s.color}` }}>
                <div style={{ fontSize: "2rem", fontWeight: 900 }}>{s.value}</div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead><tr>{["KYC ID", "Name", "Risk Score", "Flags", "Status"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{kycs.map(k => (
                  <tr key={k.id}>
                    <td style={{ fontWeight: 800 }}>{k.id}</td>
                    <td style={{ fontWeight: 600 }}>{k.name}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 80, height: 6, background: "var(--border-color)", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ width: `${k.riskScore}%`, height: "100%", background: getRiskColor(k.riskScore), borderRadius: 99 }} />
                        </div>
                        <span style={{ fontWeight: 800, color: getRiskColor(k.riskScore) }}>{k.riskScore}</span>
                      </div>
                    </td>
                    <td>{k.flags?.length > 0 ? k.flags.map((f, i) => <span key={i} className="badge badge-flagged" style={{ marginRight: 4 }}>{f}</span>) : <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>None</span>}</td>
                    <td><span className={`badge badge-${k.status === "verified" ? "verified" : k.status === "rejected" ? "rejected" : "review"}`}>{k.status.replace("_"," ")}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Rules & Config ----
export function RulesConfig() {
  const [rules, setRules] = useState(MOCK_RULES);
  const [saved, setSaved] = useState(false);
  const update = (key, val) => setRules(p => ({ ...p, [key]: val }));
  const updateFeature = (key, val) => setRules(p => ({ ...p, features: { ...p.features, [key]: val } }));
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const LabeledInput = ({ label, value, onChange, type = "number" }) => (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 8 }}>{label}</label>
      <input type={type} className="admin-input" value={value} onChange={e => onChange(type === "number" ? Number(e.target.value) : e.target.value)} style={{ width: 200 }} />
    </div>
  );

  const Toggle = ({ label, desc, value, onChange }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid var(--border-color)" }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{label}</div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{desc}</div>
      </div>
      <button className={`toggle-switch ${value ? "active" : ""}`} onClick={() => onChange(!value)} />
    </div>
  );

  return (
    <div className="admin-animate">
      <h1 className="admin-section-title">Rules & Configuration</h1>
      <p className="admin-section-subtitle">Manage compliance rules, thresholds, and feature toggles.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, padding: 28 }}>
          <div style={{ fontWeight: 800, fontSize: "1.05rem", marginBottom: 24 }}>Compliance Rules</div>
          <LabeledInput label="Minimum Age" value={rules.minAge} onChange={v => update("minAge", v)} />
          <LabeledInput label="Max Retries Allowed" value={rules.maxRetries} onChange={v => update("maxRetries", v)} />
          <LabeledInput label="Face Match Threshold (%)" value={rules.faceMatchThreshold} onChange={v => update("faceMatchThreshold", v)} />
          <LabeledInput label="Auto-Approve Risk Below" value={rules.autoApproveRiskBelow} onChange={v => update("autoApproveRiskBelow", v)} />
          <LabeledInput label="SLA Hours (Review Deadline)" value={rules.slaHours} onChange={v => update("slaHours", v)} />
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Accepted Document Types</label>
            {["PAN Card", "Aadhaar", "Passport", "Driving License", "Voter ID"].map(doc => (
              <label key={doc} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={rules.acceptedDocs.includes(doc)} onChange={e => update("acceptedDocs", e.target.checked ? [...rules.acceptedDocs, doc] : rules.acceptedDocs.filter(d => d !== doc))} />
                <span style={{ fontSize: "0.9rem" }}>{doc}</span>
              </label>
            ))}
          </div>
          <button onClick={save} style={{ padding: "12px 32px", borderRadius: 999, border: "none", background: "var(--wise-green)", color: "var(--wise-dark-green)", fontWeight: 700, cursor: "pointer" }}>
            {saved ? "✓ Saved!" : "Save Rules"}
          </button>
        </div>

        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, padding: 28 }}>
          <div style={{ fontWeight: 800, fontSize: "1.05rem", marginBottom: 8 }}>Feature Toggles</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16 }}>Enable or disable KYC verification features in real-time.</div>
          <Toggle label="OCR Extraction" desc="Auto-extract data from uploaded documents" value={rules.features.ocr} onChange={v => updateFeature("ocr", v)} />
          <Toggle label="Face Verification" desc="Compare selfie with government ID photo" value={rules.features.faceVerification} onChange={v => updateFeature("faceVerification", v)} />
          <Toggle label="Liveness Detection" desc="Detect if selfie is from a live person" value={rules.features.liveness} onChange={v => updateFeature("liveness", v)} />
          <Toggle label="Video KYC" desc="Full video-based verification session" value={rules.features.videoKyc} onChange={v => updateFeature("videoKyc", v)} />
          <Toggle label="Manual Review Mode" desc="Route all KYCs to human agents" value={rules.features.manualReview} onChange={v => updateFeature("manualReview", v)} />
          <Toggle label="Auto-Approve Low Risk" desc="Automatically approve when risk score is below threshold" value={rules.features.autoApprove} onChange={v => updateFeature("autoApprove", v)} />
        </div>
      </div>
    </div>
  );
}

// ---- Notifications ----
export function Notifications() {
  const [notifs, setNotifs] = useState(MOCK_NOTIFICATIONS);
  const update = (id, changes) => setNotifs(prev => prev.map(n => n.id === id ? { ...n, ...changes } : n));

  return (
    <div className="admin-animate">
      <h1 className="admin-section-title">Notification Management</h1>
      <p className="admin-section-subtitle">Edit SMS/email templates and manage notification triggers.</p>
      <div style={{ display: "grid", gap: 20 }}>
        {notifs.map(n => (
          <div key={n.id} style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: "1rem" }}>{n.type}</div>
              <button className={`toggle-switch ${n.active ? "active" : ""}`} onClick={() => update(n.id, { active: !n.active })} />
            </div>
            <textarea className="admin-input" value={n.template} onChange={e => update(n.id, { template: e.target.value })} style={{ resize: "vertical", minHeight: 80, marginBottom: 12 }} />
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Available variables: <code style={{ background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: 4 }}>{"{{name}}"}</code> <code style={{ background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: 4 }}>{"{{otp}}"}</code> <code style={{ background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: 4 }}>{"{{reason}}"}</code></div>
            <button style={{ marginTop: 12, padding: "8px 20px", borderRadius: 999, border: "none", background: "var(--wise-green)", color: "var(--wise-dark-green)", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>Send Test</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Analytics ----
export function Analytics() {
  const data = DASHBOARD_STATS;
  const bars = data.weeklyTrend;
  const max = Math.max(...bars);

  return (
    <div className="admin-animate">
      <h1 className="admin-section-title">Reports & Analytics</h1>
      <p className="admin-section-subtitle">Deep-dive into KYC trends, conversion rates and fraud patterns.</p>
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <select className="admin-select"><option>Last 14 Days</option><option>Last 30 Days</option><option>Last 90 Days</option></select>
        <select className="admin-select"><option>All Regions</option><option>North India</option><option>South India</option></select>
        <select className="admin-select"><option>All KYC Types</option><option>PAN + Aadhaar</option><option>Passport</option></select>
        <button style={{ padding: "10px 20px", borderRadius: 999, border: "none", background: "var(--wise-green)", color: "var(--wise-dark-green)", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>Export PDF</button>
        <button style={{ padding: "10px 20px", borderRadius: 999, border: "1px solid var(--border-color)", background: "transparent", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>Export CSV</button>
      </div>
      <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, padding: 28, marginBottom: 24 }}>
        <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: 20 }}>KYC Submission Trend (14 Days)</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160 }}>
          {bars.map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>{v}</span>
              <div style={{ width: "100%", height: `${(v / max) * 120}px`, background: v === max ? "var(--wise-green)" : "rgba(159,232,112,0.4)", borderRadius: "6px 6px 0 0", transition: "all 0.3s ease" }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Day 1</span>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Day 14</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, padding: 28 }}>
          <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: 16 }}>Approval vs Rejection</div>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: data.verified, height: 12, background: "#30a46c", borderRadius: "99px 0 0 99px" }} />
            <div style={{ flex: data.rejected, height: 12, background: "#e5484d", borderRadius: "0 99px 99px 0" }} />
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: "#30a46c" }} /><span style={{ fontSize: "0.85rem", fontWeight: 700 }}>Approved {data.approvalRate}%</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: "#e5484d" }} /><span style={{ fontSize: "0.85rem", fontWeight: 700 }}>Rejected {(100 - data.approvalRate).toFixed(1)}%</span></div>
          </div>
        </div>
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, padding: 28 }}>
          <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: 16 }}>Summary Statistics</div>
          {[["Total Submissions", data.total.toLocaleString()], ["Verified", data.verified.toLocaleString()], ["Pending", data.pending], ["Fraud Flagged", data.flagged], ["Avg. Review Time", data.avgTime]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-color)" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{k}</span>
              <span style={{ fontWeight: 800 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Roles & Permissions ----
export function RolesPermissions() {
  const [roles, setRoles] = useState(MOCK_ROLES);
  const allPerms = ["view_kyc", "edit_kyc", "approve_kyc", "reject_kyc", "add_notes", "view_logs", "export", "manage_users", "manage_config"];

  return (
    <div className="admin-animate">
      <h1 className="admin-section-title">Roles & Access Control</h1>
      <p className="admin-section-subtitle">Define roles, manage permissions, and control access to modules.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20, marginBottom: 32 }}>
        {roles.map(r => (
          <div key={r.id} style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, padding: 24, borderTop: `3px solid ${r.color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: "1rem" }}>{r.name}</div>
              <span style={{ background: `${r.color}15`, color: r.color, padding: "3px 10px", borderRadius: 999, fontSize: "0.72rem", fontWeight: 800 }}>{r.users} users</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {allPerms.map(p => (
                <span key={p} style={{ padding: "3px 10px", borderRadius: 999, fontSize: "0.7rem", fontWeight: 700, background: r.permissions.includes("all") || r.permissions.includes(p) ? "rgba(159,232,112,0.15)" : "var(--bg-secondary)", color: r.permissions.includes("all") || r.permissions.includes(p) ? "#30a46c" : "var(--text-muted)" }}>
                  {p.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, padding: 28 }}>
        <div style={{ fontWeight: 800, marginBottom: 16 }}>Permission Matrix</div>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead><tr>
              <th>Permission</th>
              {roles.map(r => <th key={r.id}>{r.name}</th>)}
            </tr></thead>
            <tbody>{allPerms.map(p => (
              <tr key={p}>
                <td style={{ fontWeight: 600, fontSize: "0.85rem" }}>{p.replace(/_/g, " ")}</td>
                {roles.map(r => (
                  <td key={r.id} style={{ textAlign: "center" }}>
                    <span style={{ color: r.permissions.includes("all") || r.permissions.includes(p) ? "#30a46c" : "var(--text-muted)", fontSize: "1rem" }}>
                      {r.permissions.includes("all") || r.permissions.includes(p) ? "✓" : "—"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---- Audit Logs ----
export function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedLogId, setExpandedLogId] = useState(null);

  useEffect(() => {
    const loadLogs = async () => {
      if (typeof window === "undefined") return;
      try {
        const url = new URL(`${API_BASE_URL}/api/admin/audit-logs`);
        if (filter !== "all") {
          url.searchParams.set("severity", filter);
        }
        if (search) {
          url.searchParams.set("search", search);
        }
        url.searchParams.append("page", page);
        url.searchParams.append("limit", 20);
        
        const token = localStorage.getItem("adminToken");
        const response = await fetch(url, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (data.success && Array.isArray(data.logs)) {
            setTotal(data.total);
            setTotalPages(data.totalPages);
            const mapped = data.logs.map((log) => ({
              id: `LOG-${String(log.id).padStart(6, "0")}`,
              action: log.action || "N/A",
              actor: log.user?.email || log.user?.phone || log.crmAgentName || "System",
              target: log.details?.applicationId || log.details?.requestId || log.targetId || "-",
              ip: log.ipAddress || "-",
              timestamp: new Date(log.timestamp).toLocaleString("en-IN"),
              severity: (log.details?.severity || "info").toLowerCase(),
              rawDetails: log.details || "{}"
            }));
            setLogs(mapped);
          }
        } else {
          const text = await response.text();
          console.warn("Expected JSON but got:", text.substring(0, 100));
        }
      } catch (error) {
        console.error("Failed to load audit logs", error);
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, [filter, search, page]);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const handleExport = async () => {
    try {
      const url = new URL(`${API_BASE_URL}/api/admin/audit-logs`);
      if (filter !== "all") url.searchParams.set("severity", filter);
      if (search) url.searchParams.set("search", search);
      url.searchParams.set("export", "true");
      
      const token = localStorage.getItem("adminToken");
      const response = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `audit-logs-${new Date().getTime()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("Export failed", e);
    }
  };

  const filtered = filter === "all" ? logs : logs.filter(l => l.severity === filter);

  return (
    <div className="admin-animate">
      <h1 className="admin-section-title">Audit Logs</h1>
      <p className="admin-section-subtitle">Immutable record of all admin actions. Timestamped and IP-tracked.</p>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <input 
          type="text" 
          placeholder="Search actor, target, action..." 
          className="admin-input global-search-input" 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
        />
        <select className="admin-select" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 160 }}>
          <option value="all">All Severity</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
        </select>
        <button onClick={handleExport} style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: "var(--wise-green)", color: "var(--wise-dark-green)", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV
        </button>
      </div>
      <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead><tr>{["Log ID", "Action", "Actor", "Target", "IP Address", "Severity", "Timestamp", "Details"].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{filtered.map(l => (
              <React.Fragment key={l.id}>
              <tr style={{ cursor: "pointer" }} onClick={() => setExpandedLogId(expandedLogId === l.id ? null : l.id)}>
                <td style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-muted)" }}>{l.id}</td>
                <td style={{ fontWeight: 700, fontSize: "0.88rem" }}>{l.action}</td>
                <td style={{ fontSize: "0.85rem" }}>{l.actor}</td>
                <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{l.target}</td>
                <td style={{ fontSize: "0.82rem", fontFamily: "monospace", color: "var(--text-muted)" }}>{l.ip}</td>
                <td><span className={`badge ${l.severity === "warning" ? "badge-pending" : "badge-verified"}`}>{l.severity}</span></td>
                <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{l.timestamp}</td>
                <td>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: expandedLogId === l.id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                </td>
              </tr>
              {expandedLogId === l.id && (
                <tr>
                  <td colSpan={8} style={{ padding: "16px 24px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 8 }}>Raw Log Payload</div>
                    <pre style={{ margin: 0, padding: 16, background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, fontSize: "0.8rem", color: "var(--text-primary)", overflowX: "auto", fontFamily: "var(--font-mono)" }}>
                      {JSON.stringify(JSON.parse(l.rawDetails || "{}"), null, 2)}
                    </pre>
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}</tbody>
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
          <span>Total {total} logs</span>
        </div>
      </div>
      {loading && <p style={{ marginTop: 12, fontSize: "0.82rem", color: "var(--text-muted)" }}>Loading audit logs...</p>}
    </div>
  );
}

// ---- Document Repository ----
export function DocumentRepository() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const token = localStorage.getItem("adminToken");
        const res = await fetch(`${API_BASE_URL}/api/admin/documents`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) setDocs(data.documents);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchDocs();
  }, []);

  return (
    <div className="admin-animate">
      <h1 className="admin-section-title">Document Repository</h1>
      <p className="admin-section-subtitle">Centralized view of all uploaded identity and financial documents.</p>
      <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, overflow: "hidden" }}>
        <table className="admin-table">
          <thead><tr>{["Type", "User", "App ID", "Uploaded At", "Action"].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {docs.map((d, i) => (
              <tr key={i}>
                <td><span className="badge badge-verified">{d.type}</span></td>
                <td>{d.user}</td>
                <td style={{ fontWeight: 700 }}>{d.applicationId}</td>
                <td style={{ fontSize: "0.8rem" }}>{new Date(d.uploadedAt).toLocaleString()}</td>
                <td><a href={`${API_BASE_URL}${d.path}`} target="_blank" className="badge badge-review" style={{ textDecoration: "none" }}>View File</a></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && docs.length === 0 && <p style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>No documents found</p>}
      </div>
    </div>
  );
}

// ---- Face Match Logs ----
export function FaceMatchLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const token = localStorage.getItem("adminToken");
        const res = await fetch(`${API_BASE_URL}/api/admin/facematch`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) setLogs(data.logs);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchLogs();
  }, []);

  return (
    <div className="admin-animate">
      <h1 className="admin-section-title">Face Match Audits</h1>
      <p className="admin-section-subtitle">Historical records of automated face comparison scores.</p>
      <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, overflow: "hidden" }}>
        <table className="admin-table">
          <thead><tr>{["App ID", "User", "Similarity Score", "Result", "Timestamp"].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700 }}>{l.applicationId}</td>
                <td>{l.user?.email}</td>
                <td style={{ fontWeight: 900, color: l.faceMatchScore < 80 ? "#e5484d" : "#30a46c" }}>{l.faceMatchScore}%</td>
                <td><span className={`badge badge-${l.faceMatchScore >= 80 ? "verified" : "rejected"}`}>{l.faceMatchScore >= 80 ? "PASS" : "FAIL"}</span></td>
                <td style={{ fontSize: "0.8rem" }}>{new Date(l.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- System Settings ----
export function SystemSettings() {
  const [settings, setSettings] = useState({ systemName: "SecureKYC", supportEmail: "support@securekyc.in", apiTimeout: 30, maxFileSize: 5, maintenanceMode: false, debugMode: false });
  const [saved, setSaved] = useState(false);
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="admin-animate">
      <h1 className="admin-section-title">System Settings</h1>
      <p className="admin-section-subtitle">Configure global system parameters, maintenance mode, and integrations.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, padding: 28 }}>
          <div style={{ fontWeight: 800, marginBottom: 20 }}>General Configuration</div>
          {[["System Name", "systemName", "text"], ["Support Email", "supportEmail", "email"], ["API Timeout (s)", "apiTimeout", "number"], ["Max File Size (MB)", "maxFileSize", "number"]].map(([label, key, type]) => (
            <div key={key} style={{ marginBottom: 20 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 8 }}>{label}</label>
              <input type={type} className="admin-input" value={settings[key]} onChange={e => setSettings(p => ({ ...p, [key]: type === "number" ? Number(e.target.value) : e.target.value }))} />
            </div>
          ))}
          <button onClick={save} style={{ padding: "12px 32px", borderRadius: 999, border: "none", background: "var(--wise-green)", color: "var(--wise-dark-green)", fontWeight: 700, cursor: "pointer" }}>{saved ? "✓ Saved!" : "Save Settings"}</button>
        </div>
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 20, padding: 28 }}>
          <div style={{ fontWeight: 800, marginBottom: 20 }}>System Controls</div>
          {[["Maintenance Mode", "maintenanceMode", "Disable all KYC submissions"], ["Debug Mode", "debugMode", "Enable verbose logging"]].map(([label, key, desc]) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid var(--border-color)" }}>
              <div><div style={{ fontWeight: 700 }}>{label}</div><div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{desc}</div></div>
              <button className={`toggle-switch ${settings[key] ? "active" : ""}`} onClick={() => setSettings(p => ({ ...p, [key]: !p[key] }))} />
            </div>
          ))}
          <div style={{ marginTop: 28 }}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>System Info</div>
            {[["Version", "2.4.1"], ["NSDL API", "v2.2.3"], ["Uptime", "99.98%"], ["Last Backup", "Today, 3:00 AM"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-color)" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{k}</span>
                <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

