"use client";
import React, { useState, useEffect, useMemo } from "react";
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
  const [category, setCategory] = useState("all");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("timeline"); // "timeline" or "grouped"
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [expandedActors, setExpandedActors] = useState({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [showJsonMap, setShowJsonMap] = useState({});

  const handleCopy = (e, text, key) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text || text === "N/A" || text === "-") return;
    navigator.clipboard.writeText(String(text));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.filter-dropdown-container')) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    const loadLogs = async () => {
      if (typeof window === "undefined") return;
      try {
        setLoading(true);
        const url = new URL(`${API_BASE_URL}/api/admin/audit-logs`);
        if (filter !== "all") {
          url.searchParams.set("severity", filter);
        }
        if (category !== "all") {
          url.searchParams.set("category", category);
        }
        if (search) {
          url.searchParams.set("search", search);
        }
        url.searchParams.append("page", page);
        url.searchParams.append("limit", 50);
        
        const token = localStorage.getItem("adminToken");
        const response = await fetch(url, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (data.success && Array.isArray(data.logs)) {
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
            const STEP_LABELS = {
              phoneVerification: "Phone Verification",
              emailVerification: "Email Verification",
              pricingSelection: "Pricing Plan",
              panVerification: "PAN Verification",
              digilocker: "DigiLocker Aadhaar",
              personalDetails: "Personal Details",
              nomineeChoice: "Nominee Choice",
              nomineeDetails: "Nominee Details",
              nomineeAllocation: "Nominee Allocation",
              bankVerification: "Bank Verification",
              financialProof: "Financial Proof",
              signature: "Signature",
              panUpload: "PAN Upload",
              ipv: "Live Selfie (IPV)",
              esignPreview: "eSign Preview",
              aadhaarEsign: "Aadhaar eSign",
              completion: "Application Completion"
            };

            const formatIp = (ip) => {
              if (!ip || ip === "-") return "-";
              if (ip === "::1" || ip === "127.0.0.1") return "Localhost (::1)";
              return ip;
            };

            const mapped = data.logs.map((log) => {
              let parsedDetails = {};
              try {
                parsedDetails = typeof log.details === "string" ? JSON.parse(log.details) : (log.details || {});
              } catch (e) {
                parsedDetails = { message: String(log.details) };
              }

              // Extract applicant profile information from matchedApp or user
              const kycApp = log.matchedApp || log.user?.kycApplications?.[0];
              let userPersonal = {};
              if (kycApp?.personalDetails) {
                try { userPersonal = typeof kycApp.personalDetails === "string" ? JSON.parse(kycApp.personalDetails) : kycApp.personalDetails; } catch(e) {}
              }

              const appId = parsedDetails.applicationId || kycApp?.applicationId || (log.targetId && !/^\d+$/.test(String(log.targetId).trim()) ? log.targetId : null);
              const clientCode = kycApp?.clientCode || parsedDetails.clientCode || null;
              const applicantName = userPersonal?.fullName || kycApp?.user?.email || (log.user?.role === "user" ? (log.user?.email || log.user?.phone) : null);
              const userPhone = kycApp?.user?.phone || log.user?.phone || null;

              // Build crystal-clear Target ID (never display raw numeric database IDs like 39 or 43)
              let targetDisplay = "-";
              if (appId) {
                targetDisplay = applicantName ? `${appId} (${applicantName})` : appId;
              } else if (applicantName) {
                targetDisplay = userPhone ? `${applicantName} · ${userPhone}` : applicantName;
              } else if (userPhone) {
                targetDisplay = `Phone: ${userPhone}`;
              } else if (log.user?.email) {
                targetDisplay = `${log.user.email} (${log.user.role || 'User'})`;
              } else if (log.targetId) {
                targetDisplay = `Resource #${log.targetId}`;
              }

              // Determine actor role & display
              let actorRole = "System";
              let actorName = log.crmAgentName || log.user?.email || log.user?.phone || "System";
              const actUpper = (log.action || "").toUpperCase();

              if (log.user?.role === "globe" || actUpper.startsWith("GLOBE_")) {
                actorRole = "Globe Reviewer";
              } else if (log.user?.role === "admin" || actUpper.startsWith("ADMIN_")) {
                actorRole = "Admin";
              } else if (log.crmAgentId || log.user?.role === "kyc_team" || actUpper.startsWith("MAKER_CHECKER_") || actUpper.startsWith("KYC_STEP_")) {
                actorRole = "KYC Team";
              } else if (log.user?.role === "user" || actUpper.startsWith("USER_") || actUpper.startsWith("DIGIO_")) {
                actorRole = "Applicant";
              }

              // Human-Friendly Action Title
              let actionTitle = log.action || "Activity";
              if (log.action === "digio_request_failed") {
                const dType = parsedDetails.type || "API";
                if (dType === "SELFIE" || dType === "IPV") actionTitle = "Digio Selfie / IPV Failure";
                else if (dType === "PAN") actionTitle = "Digio PAN Verification Failure";
                else if (dType === "DIGILOCKER" || dType === "AADHAAR") actionTitle = "Digio DigiLocker Failure";
                else if (dType === "ESIGN") actionTitle = "Digio Aadhaar eSign Failure";
                else actionTitle = `Digio ${dType} Request Failed`;
              } else if (log.action === "kyc_step_rejected") {
                const sName = STEP_LABELS[parsedDetails.stepName] || parsedDetails.stepName || "Step";
                actionTitle = `Step Rejected: ${sName}`;
              } else if (log.action === "kyc_step_pending") {
                const sName = STEP_LABELS[parsedDetails.stepName] || parsedDetails.stepName || "Step";
                actionTitle = `Step Review Pending: ${sName}`;
              } else if (log.action === "kyc_step_approved") {
                const sName = STEP_LABELS[parsedDetails.stepName] || parsedDetails.stepName || "Step";
                actionTitle = `Step Approved: ${sName}`;
              } else if (log.action === "kyc_admin_uploaded_document") {
                actionTitle = `Uploaded: ${parsedDetails.documentType || "Document"}`;
              } else if (log.action === "kyc_admin_updated_details") {
                actionTitle = "Updated Application Fields";
              } else if (log.action === "kyc_modifications_requested") {
                actionTitle = "Modification Email Dispatched";
              } else if (log.action === "kyc_step_saved") {
                actionTitle = `Applicant Saved ${STEP_LABELS[parsedDetails.step] || parsedDetails.step || `Step ${parsedDetails.stepIndex || ""}`}`;
              } else if (log.action === "kyc_submitted") {
                actionTitle = "Applicant Submitted Application";
              } else if (log.action === "GLOBE_APPROVED_KYC") {
                actionTitle = "Globe Approved Application";
              } else if (log.action === "GLOBE_REJECTED_KYC") {
                actionTitle = "Globe Rejected Application";
              } else if (log.action === "ADMIN_STATUS_VERIFIED") {
                actionTitle = "Admin Verified Application";
              } else if (log.action === "ADMIN_STATUS_REJECTED") {
                actionTitle = "Admin Rejected Application";
              } else if (log.action === "ADMIN_STATUS_ON_HOLD") {
                actionTitle = "Admin Placed On Hold";
              }

              // Human-Readable Narrative Story
              let story = parsedDetails.message || "";
              const targetRef = appId ? `application ${appId}${applicantName ? ` (${applicantName})` : ""}` : (applicantName ? `applicant ${applicantName}` : `user ${userPhone || log.userId || ''}`);

              if (!story) {
                if (log.action === "digio_request_failed") {
                  const dType = parsedDetails.type || "API";
                  const errCode = parsedDetails.digioError?.code || "ERROR";
                  const errMsg = parsedDetails.digioError?.message || parsedDetails.error || "Request failed";
                  story = `Digio ${dType} verification failed during applicant onboarding for ${targetRef}. Error: ${errMsg} (${errCode})`;
                } else if (log.action === "kyc_step_rejected") {
                  const sName = STEP_LABELS[parsedDetails.stepName] || parsedDetails.stepName || "step";
                  story = `Reviewer (${actorName}) rejected ${sName} for ${targetRef}.${parsedDetails.reason ? ` Reason: ${parsedDetails.reason}` : ""}`;
                } else if (log.action === "kyc_step_pending") {
                  const sName = STEP_LABELS[parsedDetails.stepName] || parsedDetails.stepName || "step";
                  story = `Reviewer (${actorName}) marked ${sName} as pending review for ${targetRef}`;
                } else if (log.action === "kyc_step_approved") {
                  const sName = STEP_LABELS[parsedDetails.stepName] || parsedDetails.stepName || "step";
                  story = `Reviewer (${actorName}) approved ${sName} for ${targetRef}`;
                } else if (log.action === "kyc_admin_uploaded_document") {
                  story = `Reviewer (${actorName}) uploaded '${parsedDetails.documentType || "Document"}' for ${targetRef}`;
                } else if (log.action === "kyc_admin_updated_details") {
                  const updKeys = parsedDetails.updates ? Object.keys(parsedDetails.updates).join(", ") : "details";
                  story = `Reviewer (${actorName}) updated ${updKeys} for ${targetRef}`;
                } else if (log.action === "kyc_modifications_requested") {
                  story = `Modification email sent to ${parsedDetails.emailSentTo || "applicant"} for ${targetRef}`;
                } else if (log.action === "kyc_step_saved") {
                  story = `Applicant saved progress on ${STEP_LABELS[parsedDetails.step] || parsedDetails.step || `Step ${parsedDetails.stepIndex || ""}`} for ${targetRef}`;
                } else if (log.action === "kyc_submitted") {
                  story = `Applicant completed and submitted ${targetRef}`;
                } else if (log.action === "GLOBE_APPROVED_KYC") {
                  story = `Globe reviewer approved ${targetRef}`;
                } else if (log.action === "GLOBE_REJECTED_KYC") {
                  story = `Globe reviewer rejected ${targetRef}. Reason: ${parsedDetails.reason || log.oldValue || "No remarks provided"}`;
                } else {
                  story = log.action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                }
              }

              return {
                id: `LOG-${String(log.id).padStart(6, "0")}`,
                rawId: log.id,
                action: log.action || "N/A",
                actionTitle,
                story,
                actor: actorName,
                actorRole,
                target: targetDisplay,
                rawTarget: appId || applicantName || log.targetId || "-",
                ip: formatIp(log.ipAddress),
                timestamp: new Date(log.timestamp).toLocaleString("en-IN", {
                  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
                }),
                rawTimestamp: new Date(log.timestamp).getTime(),
                severity: (parsedDetails.severity || (log.action?.includes("REJECT") || log.action?.includes("fail") || log.action?.includes("FAIL") ? "warning" : "info")).toLowerCase(),
                details: parsedDetails,
                rawDetails: typeof log.details === "string" ? log.details : JSON.stringify(log.details || {})
              };
            });
            setLogs(mapped);
          }
        }
      } catch (error) {
        console.error("Failed to load audit logs", error);
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, [category, filter, search, page]);

  useEffect(() => {
    setPage(1);
  }, [category, filter, search]);

  const handleExport = async () => {
    try {
      const url = new URL(`${API_BASE_URL}/api/admin/audit-logs`);
      if (filter !== "all") url.searchParams.set("severity", filter);
      if (category !== "all") url.searchParams.set("category", category);
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

  const getActionBadgeStyle = (action, severity) => {
    const act = (action || "").toUpperCase();
    if (act.includes("APPROVED") || act.includes("VERIFIED") || act.includes("SUCCESS")) {
      return { background: "rgba(48, 164, 108, 0.12)", color: "#2b9a66", border: "1px solid rgba(48, 164, 108, 0.25)" };
    }
    if (act.includes("REJECT") || severity === "warning" || severity === "error") {
      return { background: "rgba(229, 72, 77, 0.12)", color: "#e5484d", border: "1px solid rgba(229, 72, 77, 0.25)" };
    }
    if (act.includes("MODIFICATION") || act.includes("HOLD")) {
      return { background: "rgba(247, 107, 21, 0.12)", color: "#f76b15", border: "1px solid rgba(247, 107, 21, 0.25)" };
    }
    if (act.includes("GLOBE")) {
      return { background: "rgba(0, 145, 255, 0.12)", color: "#0091ff", border: "1px solid rgba(0, 145, 255, 0.25)" };
    }
    if (act.includes("ADMIN")) {
      return { background: "rgba(142, 78, 198, 0.12)", color: "#8e4ec6", border: "1px solid rgba(142, 78, 198, 0.25)" };
    }
    return { background: "rgba(100, 116, 139, 0.12)", color: "#64748b", border: "1px solid rgba(100, 116, 139, 0.25)" };
  };

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case "Globe Reviewer": return { background: "rgba(0, 145, 255, 0.15)", color: "#0091ff" };
      case "Admin": return { background: "rgba(142, 78, 198, 0.15)", color: "#8e4ec6" };
      case "KYC Team": return { background: "rgba(48, 164, 108, 0.15)", color: "#2b9a66" };
      case "Applicant": return { background: "rgba(235, 94, 40, 0.15)", color: "#eb5e28" };
      default: return { background: "rgba(148, 163, 184, 0.15)", color: "#64748b" };
    }
  };

  const groupedLogs = useMemo(() => {
    const groups = {};
    logs.forEach(l => {
      if (!groups[l.actor]) {
        groups[l.actor] = { actor: l.actor, actorRole: l.actorRole, logs: [], latestTime: l.rawTimestamp };
      }
      groups[l.actor].logs.push(l);
      if (l.rawTimestamp > groups[l.actor].latestTime) {
        groups[l.actor].latestTime = l.rawTimestamp;
      }
    });
    return Object.values(groups).sort((a, b) => b.latestTime - a.latestTime);
  }, [logs]);

  return (
    <div className="admin-animate">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 className="admin-section-title" style={{ margin: 0 }}>Comprehensive Audit Logs</h1>
          <p className="admin-section-subtitle" style={{ margin: "4px 0 0 0" }}>
            Immutable, real-time chronicle of all administrative actions, Globe reviews, step decisions, email notices, and applicant submissions.
          </p>
        </div>
        <button 
          onClick={handleExport} 
          style={{ 
            padding: "10px 18px", borderRadius: 10, border: "none", background: "var(--wise-green)", 
            color: "var(--wise-dark-green)", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", 
            display: "flex", alignItems: "center", gap: 8, boxShadow: "0 2px 8px rgba(48, 164, 108, 0.2)" 
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV
        </button>
      </div>

      {/* Category Pills & Filters Header */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { id: "all", label: "All Activity" },
          { id: "globe", label: "Globe Reviews" },
          { id: "admin", label: "Admin Actions" },
          { id: "maker_checker", label: "Maker-Checker" },
          { id: "user", label: "Applicant Submissions" },
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            style={{
              padding: "8px 14px",
              borderRadius: 20,
              fontSize: "0.82rem",
              fontWeight: category === cat.id ? 700 : 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
              border: category === cat.id ? "1px solid var(--wise-green)" : "1px solid var(--border-color)",
              background: category === cat.id ? "var(--wise-green)" : "var(--bg-primary)",
              color: category === cat.id ? "var(--wise-dark-green)" : "var(--text-secondary)",
            }}
          >
            {cat.label}
          </button>
        ))}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setViewMode(v => v === "timeline" ? "grouped" : "timeline")}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid var(--border-color)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            {viewMode === "timeline" ? "Group by Actor" : "Timeline View"}
          </button>
        </div>
      </div>

      {/* Search and Severity Bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <svg style={{ position: "absolute", left: 14, top: 12, color: "var(--text-muted)", pointerEvents: "none" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder="Search action, application ID, actor, email, reason, or details..." 
            className="admin-input global-search-input" 
            style={{ paddingLeft: 40, width: "100%" }}
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
          {search && (
            <button 
              onClick={() => setSearch("")} 
              style={{ position: "absolute", right: 12, top: 10, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)", fontSize: "1rem" }}
            >
              ✕
            </button>
          )}
        </div>

        <div className="filter-dropdown-container" style={{ position: "relative", width: "160px" }}>
          <button 
            onClick={() => setFilterOpen(!filterOpen)}
            style={{ 
              width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-color)", 
              background: "var(--bg-primary)", color: "var(--text-primary)", fontWeight: 600, fontSize: "0.85rem",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            }}
          >
            <span>{filter === "all" ? "All Severity" : filter.toUpperCase()}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ transform: filterOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {filterOpen && (
            <div style={{ position: "absolute", top: "100%", right: 0, width: "160px", marginTop: 6, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", zIndex: 30, padding: "6px 0" }}>
              {[
                { value: "all", label: "All Severity" },
                { value: "info", label: "Info Only" },
                { value: "warning", label: "Warnings / Rejections" }
              ].map(f => (
                <div 
                  key={f.value}
                  onClick={() => { setFilter(f.value); setFilterOpen(false); }}
                  style={{ 
                    padding: "8px 14px", cursor: "pointer", fontSize: "0.82rem", fontWeight: filter === f.value ? 700 : 500,
                    color: filter === f.value ? "var(--wise-green)" : "var(--text-primary)",
                    background: filter === f.value ? "rgba(48, 164, 108, 0.1)" : "transparent",
                  }}
                >
                  {f.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Logs Display */}
      <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ width: "110px", padding: "12px 16px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Log ID</th>
                <th style={{ width: "240px", padding: "12px 16px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Action & Category</th>
                <th style={{ padding: "12px 16px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Narrative Summary</th>
                <th style={{ width: "180px", padding: "12px 16px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Actor / Role</th>
                <th style={{ width: "140px", padding: "12px 16px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Target ID</th>
                <th style={{ width: "170px", padding: "12px 16px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Date & Time</th>
                <th style={{ width: "50px", textAlign: "center" }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "50px 20px", color: "var(--text-muted)" }}>
                    <div style={{ display: "inline-block", width: 24, height: 24, border: "2px solid var(--border-color)", borderTopColor: "var(--wise-green)", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 8 }}></div>
                    <div>Loading audit logs...</div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 12px", opacity: 0.4 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>No audit log records found</div>
                    <div style={{ fontSize: "0.82rem", marginTop: 4 }}>Try changing your search query or severity filter</div>
                  </td>
                </tr>
              ) : viewMode === "grouped" ? (
                groupedLogs.map((group) => {
                  const isExpanded = expandedActors[group.actor] !== false; // expanded by default
                  return (
                    <React.Fragment key={group.actor}>
                      <tr 
                        style={{ background: "var(--bg-secondary)", borderTop: "2px solid var(--border-color)", cursor: "pointer" }}
                        onClick={() => setExpandedActors(prev => ({ ...prev, [group.actor]: !isExpanded }))}
                      >
                        <td colSpan={7} style={{ padding: "12px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>{group.actor}</span>
                              <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: 6, fontWeight: 700, ...getRoleBadgeStyle(group.actorRole) }}>
                                {group.actorRole}
                              </span>
                            </div>
                            <span style={{ fontSize: "0.75rem", background: "var(--border-color)", padding: "3px 10px", borderRadius: 99, fontWeight: 600 }}>
                              {group.logs.length} logged events
                            </span>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && group.logs.map(l => renderLogRow(l))}
                    </React.Fragment>
                  );
                })
              ) : (
                logs.map(l => renderLogRow(l))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-color)", fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button 
              disabled={page <= 1 || loading} 
              onClick={() => setPage(p => p - 1)}
              style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", cursor: "pointer", opacity: page <= 1 ? 0.4 : 1, fontWeight: 600 }}
            >
              Previous
            </button>
            <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Page {page} of {totalPages}</span>
            <button 
              disabled={page >= totalPages || loading} 
              onClick={() => setPage(p => p + 1)}
              style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", cursor: "pointer", opacity: page >= totalPages ? 0.4 : 1, fontWeight: 600 }}
            >
              Next
            </button>
          </div>
          <span style={{ fontWeight: 600 }}>Showing {logs.length} of {total} events</span>
        </div>
      </div>
    </div>
  );

  function renderLogRow(l) {
    const isExpanded = expandedLogId === l.id;
    const badgeStyle = getActionBadgeStyle(l.action, l.severity);
    const roleBadgeStyle = getRoleBadgeStyle(l.actorRole);
    const showJson = !!showJsonMap[l.id];

    return (
      <React.Fragment key={l.id}>
        <tr 
          style={{ 
            cursor: "pointer", 
            transition: "background 0.15s ease",
            background: isExpanded ? "var(--bg-secondary)" : "transparent"
          }} 
          onClick={() => setExpandedLogId(isExpanded ? null : l.id)}
        >
          {/* Log ID with copy */}
          <td style={{ padding: "12px 16px" }}>
            <span 
              onClick={(e) => handleCopy(e, l.id, `log-${l.id}`)}
              style={{ 
                fontFamily: "monospace", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", 
                cursor: "pointer", padding: "2px 6px", borderRadius: 4, background: "var(--bg-secondary)" 
              }}
              title="Click to copy Log ID"
            >
              {copiedKey === `log-${l.id}` ? "✓ Copied" : l.id}
            </span>
          </td>

          {/* Action Badge */}
          <td style={{ padding: "12px 16px" }}>
            <span style={{ 
              display: "inline-block", padding: "4px 9px", borderRadius: 6, fontSize: "0.76rem", 
              fontWeight: 700, letterSpacing: "0.02em", ...badgeStyle 
            }}>
              {l.actionTitle || l.action}
            </span>
            {l.actionTitle && l.actionTitle !== l.action && (
              <div style={{ fontSize: "0.68rem", fontFamily: "monospace", color: "var(--text-muted)", marginTop: 3 }}>
                {l.action}
              </div>
            )}
          </td>

          {/* Narrative Story */}
          <td style={{ padding: "12px 16px", fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.4 }}>
            {l.story}
          </td>

          {/* Actor & Role */}
          <td style={{ padding: "12px 16px" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
              {l.actor}
            </div>
            <span style={{ fontSize: "0.7rem", padding: "1px 6px", borderRadius: 4, fontWeight: 700, ...roleBadgeStyle }}>
              {l.actorRole}
            </span>
          </td>

          {/* Target ID */}
          <td style={{ padding: "12px 16px" }}>
            {l.target !== "-" ? (
              <span 
                onClick={(e) => handleCopy(e, l.target, `target-${l.id}`)}
                style={{ 
                  fontFamily: "monospace", fontSize: "0.78rem", fontWeight: 700, color: "var(--wise-dark-green)",
                  background: "rgba(48, 164, 108, 0.1)", padding: "3px 8px", borderRadius: 6, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 4
                }}
                title="Click to copy Target ID"
              >
                {copiedKey === `target-${l.id}` ? "✓ Copied" : l.target}
              </span>
            ) : (
              <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</span>
            )}
          </td>

          {/* Timestamp */}
          <td style={{ padding: "12px 16px", fontSize: "0.78rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            <div>{l.timestamp}</div>
            <div style={{ fontSize: "0.7rem", fontFamily: "monospace", opacity: 0.7 }}>IP: {l.ip}</div>
          </td>

          {/* Chevron */}
          <td style={{ padding: "12px 16px", textAlign: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
          </td>
        </tr>

        {/* Expanded Rich Details */}
        {isExpanded && (
          <tr>
            <td colSpan={7} style={{ padding: 0, background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
              <div style={{ padding: "20px 24px", borderLeft: "4px solid var(--wise-green)" }}>
                {/* Header inside drawer */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 800, fontSize: "0.92rem", color: "var(--text-primary)" }}>Detailed Audit Record</span>
                    <span style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--text-muted)" }}>{l.id}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button 
                      onClick={() => setShowJsonMap(prev => ({ ...prev, [l.id]: !prev[l.id] }))}
                      style={{ 
                        padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border-color)", 
                        background: "var(--bg-primary)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                        color: showJson ? "var(--wise-green)" : "var(--text-primary)"
                      }}
                    >
                      {showJson ? "Hide Raw Payload" : "View Raw JSON Payload"}
                    </button>
                    <button 
                      onClick={(e) => handleCopy(e, l.rawDetails, `json-${l.id}`)}
                      style={{ 
                        padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border-color)", 
                        background: "var(--bg-primary)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                        color: "var(--text-primary)"
                      }}
                    >
                      {copiedKey === `json-${l.id}` ? "✓ Payload Copied" : "Copy Payload"}
                    </button>
                  </div>
                </div>

                {/* Structured Overview Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
                  <div style={{ background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border-color)" }}>
                    <div style={{ fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>Actor</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>{l.actor}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>Role: {l.actorRole}</div>
                  </div>

                  <div style={{ background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border-color)" }}>
                    <div style={{ fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>Target Resource</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace" }}>{l.target}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>IP: {l.ip}</div>
                  </div>

                  <div style={{ background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border-color)" }}>
                    <div style={{ fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>Timestamp</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>{l.timestamp}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>Status: Logged Immutably</div>
                  </div>
                </div>

                {/* Specific context rendering */}
                {/* 1. Reason / Remarks */}
                {(l.details.reason || l.details.remarks) && (
                  <div style={{ background: "rgba(229, 72, 77, 0.08)", border: "1px solid rgba(229, 72, 77, 0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#e5484d", textTransform: "uppercase", marginBottom: 4 }}>
                      Rejection / Review Remarks:
                    </div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      {l.details.reason || l.details.remarks}
                    </div>
                  </div>
                )}

                {/* 2. Rejected Steps (Modification Email) */}
                {Array.isArray(l.details.rejectedSteps) && l.details.rejectedSteps.length > 0 && (
                  <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
                      Steps Requiring Modification by User:
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {l.details.rejectedSteps.map((step, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-secondary)", padding: "8px 12px", borderRadius: 6, fontSize: "0.82rem" }}>
                          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                            • {typeof step === "string" ? step : step.title || step.stepId}
                          </span>
                          {typeof step === "object" && step.reason && (
                            <span style={{ color: "#e5484d", fontWeight: 600, fontSize: "0.78rem" }}>{step.reason}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    {l.details.emailSentTo && (
                      <div style={{ marginTop: 8, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        Notification delivered to: <strong style={{ color: "var(--text-primary)" }}>{l.details.emailSentTo}</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Uploaded Document Preview */}
                {l.details.filePath && (
                  <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Uploaded File:</div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>{l.details.documentType || "KYC Document"}</div>
                    </div>
                    <a 
                      href={l.details.filePath} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ padding: "6px 12px", background: "var(--wise-green)", color: "var(--wise-dark-green)", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <span>Open Document</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </a>
                  </div>
                )}

                {/* 4. Updates / Field Edits */}
                {l.details.updates && typeof l.details.updates === "object" && Object.keys(l.details.updates).length > 0 && (
                  <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
                      Modified Fields:
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
                      {Object.entries(l.details.updates).map(([key, val]) => (
                        <div key={key} style={{ background: "var(--bg-secondary)", padding: "8px 12px", borderRadius: 6 }}>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>{key}</div>
                          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)", wordBreak: "break-all" }}>
                            {typeof val === "object" ? JSON.stringify(val) : String(val)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Raw JSON Payload Toggle */}
                {showJson && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 6 }}>
                      Raw JSON Log Payload
                    </div>
                    <pre style={{ margin: 0, padding: 14, background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 8, fontSize: "0.78rem", color: "var(--text-primary)", overflowX: "auto", fontFamily: "var(--font-mono)" }}>
                      {JSON.stringify(l.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  }
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

