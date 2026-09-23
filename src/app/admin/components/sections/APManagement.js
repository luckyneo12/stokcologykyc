"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/utils/apiConfig";

// SVG Icons
const UsersIcon = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>;
const CheckCircleIcon = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>;
const ClockIcon = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
const TrendingUpIcon = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>;
const TrendingDownIcon = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>;
const BanknoteIcon = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M6 12h.01M18 12h.01"></path></svg>;
const MailIcon = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>;
const PhoneIcon = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>;
const AwardIcon = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>;
const SettingsIcon = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>;
const ArrowLeftIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>;

export default function APManagement() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [aps, setAps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const [selectedDate, setSelectedDate] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // newest, referrals, approved

  const [selectedAp, setSelectedAp] = useState(null);
  const [apUsers, setApUsers] = useState([]);
  const [apLogs, setApLogs] = useState([]);
  const [apStats, setApStats] = useState(null);
  const [apUsersLoading, setApUsersLoading] = useState(false);

  const [drillSearch, setDrillSearch] = useState("");
  const [drillStatusFilter, setDrillStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("users"); // users, profile

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPassword, setFormPassword] = useState("");

  useEffect(() => {
    if (selectedAp?.id) {
      fetchApUsers(selectedAp.id);
    } else {
      fetchAps();
    }
  }, [selectedDate, selectedAp?.id]);

  const fetchAps = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("adminToken");
      let url = `${API_BASE_URL}/api/admin/ap-list`;
      if (selectedDate) url += `?date=${selectedDate}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setAps(data.aps);
      }
    } catch (err) {
      console.error("Failed to fetch APs:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchApUsers = async (apId) => {
    setApUsersLoading(true);
    try {
      const token = localStorage.getItem("adminToken");
      let url = `${API_BASE_URL}/api/admin/ap/${apId}/users`;
      if (selectedDate) url += `?date=${selectedDate}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setApUsers(data.users || []);
        setApLogs(data.logs || []);
        setApStats(data.stats || null);
        setSelectedAp(prev => ({ ...prev, ...data.ap }));
      }
    } catch (err) {
      console.error("Failed to fetch AP users:", err);
    } finally {
      setApUsersLoading(false);
    }
  };

  const handleCopyLink = (apCode, e) => {
    e.stopPropagation();
    const link = `${window.location.origin}/register?ref=${apCode}`;
    navigator.clipboard.writeText(link);
    setCopiedId(apCode);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id, name, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete AP ${name}?`)) return;
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/ap/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchAps();
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setCreating(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/auth/create-ap`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: formName, email: formEmail, phone: formPhone, password: formPassword })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("AP Created successfully!");
        setFormName(""); setFormEmail(""); setFormPhone(""); setFormPassword("");
        setShowForm(false);
        fetchAps();
      } else {
        setError(data.error || "Failed to create AP");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setCreating(false);
    }
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingCsv(true); setError(""); setSuccess("");
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const rows = text.split("\n").filter(r => r.trim());
      const apsToCreate = [];
      
      let startIdx = 0;
      if (rows[0].toLowerCase().includes("email")) startIdx = 1;

      for (let i = startIdx; i < rows.length; i++) {
        const cols = rows[i].split(",");
        if (cols.length >= 4) {
          apsToCreate.push({
            name: cols[0].trim(),
            email: cols[1].trim(),
            phone: cols[2].trim(),
            password: cols[3].trim()
          });
        }
      }

      try {
        const token = localStorage.getItem("adminToken");
        const res = await fetch(`${API_BASE_URL}/api/admin/ap/bulk-create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ aps: apsToCreate })
        });
        const data = await res.json();
        if (data.success) {
          setSuccess(`Bulk created ${data.results.success} APs successfully! (${data.results.failed} failed)`);
          fetchAps();
        } else {
          setError(data.error || "Failed to bulk create APs");
        }
      } catch (err) {
        setError("Network error during bulk upload");
      } finally {
        setUploadingCsv(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const changeTier = async (tier) => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/ap/${selectedAp.id}/tier`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier })
      });
      if (res.ok) {
        setSelectedAp(prev => ({...prev, tier}));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleStatus = async () => {
    const newStatus = selectedAp.status === "active" ? "suspended" : "active";
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/ap/${selectedAp.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setSelectedAp(prev => ({...prev, status: newStatus}));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportCSV = () => {
    if (!apUsers || apUsers.length === 0) return;
    const headers = ["Phone,Status,Globe Status,Step,Date Registered\n"];
    const csvContent = apUsers.map(u => {
      const app = u.kycApplications?.[0];
      const status = app?.status || "Not Started";
      const globe = app?.globeStatus || "pending";
      const step = app?.currentStep || 0;
      const date = new Date(u.createdAt).toLocaleDateString();
      return `"${u.phone}","${status}","${globe}","${step}","${date}"`;
    }).join("\n");
    
    const blob = new Blob([headers + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedAp?.apCode || 'ap'}_users.csv`;
    link.click();
  };

  // Sorting logic
  let sortedAps = [...aps];
  if (sortBy === "referrals") sortedAps.sort((a,b) => b.referralCount - a.referralCount);
  if (sortBy === "approved") sortedAps.sort((a,b) => (b.breakdown?.approved || 0) - (a.breakdown?.approved || 0));
  
  // Filtering logic for drilldown
  let filteredUsers = apUsers.filter(u => {
    const app = u.kycApplications?.[0];
    const status = (app?.status || "not started").toLowerCase();
    
    if (drillSearch) {
      const searchLower = drillSearch.toLowerCase();
      const phoneMatch = u.phone && u.phone.toLowerCase().includes(searchLower);
      const idMatch = app?.applicationId && app.applicationId.toLowerCase().includes(searchLower);
      if (!phoneMatch && !idMatch) return false;
    }
    
    if (drillStatusFilter !== "all") {
       if (drillStatusFilter === "not_started" && status !== "not started") return false;
       if (drillStatusFilter === "pending" && !["pending", "under_review"].includes(status)) return false;
       if (drillStatusFilter === "verified" && !["verified", "approved"].includes(status)) return false;
       if (drillStatusFilter === "rejected" && status !== "rejected") return false;
    }
    return true;
  });

  if (loading && !selectedAp) return <div style={{ padding: "40px", textAlign: "center" }}><div className="loader"></div></div>;

  return (
    <div style={{ padding: "12px 40px 28px 40px", maxWidth: 1200, margin: "0 auto" }}>
      {/* HEADER SECTION */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        {!selectedAp ? (
          <div>
            <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>AP Management</h1>
            <p style={{ marginTop: 6, fontSize: "0.9rem", color: "var(--text-muted)" }}>Create and manage Associate Partners and their clients.</p>
          </div>
        ) : (
          <button onClick={() => setSelectedAp(null)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem", fontWeight: 500, padding: 0 }}>
            <ArrowLeftIcon /> Back to partners
          </button>
        )}
        
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* Calendar Filter */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 8, padding: selectedDate ? "6px 12px" : "8px 10px" }}>
            {!selectedDate && (
               <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ color: "var(--text-muted)" }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            )}
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)} 
              style={{ 
                border: "none", background: "transparent", outline: "none", color: "var(--text-primary)", fontWeight: 500, fontSize: "0.85rem",
                position: selectedDate ? "static" : "absolute",
                opacity: selectedDate ? 1 : 0,
                width: selectedDate ? "auto" : "100%",
                height: selectedDate ? "auto" : "100%",
                left: 0, top: 0, cursor: "pointer"
              }} 
            />
            {selectedDate && (
              <button onClick={() => setSelectedDate("")} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px 0 4px 8px", fontSize: "0.75rem", fontWeight: 600, zIndex: 2 }}>Clear</button>
            )}
          </div>
          
          {!selectedAp && (
            <>
              <input type="file" accept=".csv" ref={fileInputRef} style={{ display: "none" }} onChange={handleCsvUpload} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingCsv} style={{ padding: "8px 16px", borderRadius: 8, background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer" }}>
                {uploadingCsv ? "Uploading..." : "Import CSV"}
              </button>
              <button onClick={() => setShowForm(!showForm)} style={{ padding: "8px 16px", borderRadius: 8, background: "var(--text-primary)", color: "var(--bg-primary)", border: "none", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", transition: "transform 0.1s", display: "flex", alignItems: "center", gap: 6 }} onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"} onMouseUp={e => e.currentTarget.style.transform = "scale(1)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add New AP
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div style={{ background: "rgba(229,72,77,0.05)", border: "1px solid rgba(229,72,77,0.2)", color: "#e5484d", padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: "0.9rem" }}>{error}</div>}
      {success && <div style={{ background: "rgba(48,164,108,0.05)", border: "1px solid rgba(48,164,108,0.2)", color: "#30a46c", padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: "0.9rem" }}>{success}</div>}

      {selectedAp ? (
        // ======================= AP DRILL-DOWN VIEW =======================
        <div>
          
          {/* Minimalist Profile Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)", fontSize: "1.8rem", fontWeight: 600, border: "1px solid var(--border-color)" }}>
                {(selectedAp.name || selectedAp.apCode).charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                  <h2 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 600, color: "var(--text-primary)" }}>{selectedAp.name || selectedAp.apCode}</h2>
                  <span style={{ padding: "4px 10px", borderRadius: 6, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", fontSize: "0.75rem", fontWeight: 600 }}>{selectedAp.tier || "Standard"}</span>
                  {selectedAp.status === "suspended" && <span style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(229,72,77,0.05)", border: "1px solid rgba(229,72,77,0.2)", color: "#e5484d", fontSize: "0.75rem", fontWeight: 600 }}>Suspended</span>}
                </div>
                <div style={{ display: "flex", gap: 16, color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><MailIcon /> {selectedAp.email}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><PhoneIcon /> {selectedAp.phone}</span>
                </div>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 8 }}>
               <button onClick={() => setActiveTab("users")} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-color)", background: activeTab === "users" ? "var(--bg-secondary)" : "transparent", color: "var(--text-primary)", fontWeight: 500, fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}><UsersIcon /> Clients</button>
               <button onClick={() => setActiveTab("profile")} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-color)", background: activeTab === "profile" ? "var(--bg-secondary)" : "transparent", color: "var(--text-primary)", fontWeight: 500, fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}><SettingsIcon /> Settings</button>
            </div>
          </div>

          {activeTab === "users" && (
            <>
              {/* Professional KPI Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
                
                {/* KPI Card Template */}
                {[
                  { label: "Total Referrals", value: selectedAp.referralCount || 0, icon: <UsersIcon /> },
                  { label: "Approved Users", value: selectedAp.breakdown?.approved || 0, icon: <CheckCircleIcon /> },
                  { label: "In Progress", value: selectedAp.breakdown?.pending || 0, icon: <ClockIcon /> },
                  { label: "Conversion", value: `${selectedAp.conversionRate || 0}%`, icon: <TrendingUpIcon /> },
                  { label: "Est. Commission", value: `₹${selectedAp.estimatedCommission || 0}`, icon: <BanknoteIcon /> }
                ].map((kpi, i) => (
                  <div key={i} style={{ background: "var(--bg-card)", padding: 20, borderRadius: 12, border: "1px solid var(--border-color)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 500 }}>
                      <div style={{ color: "var(--text-primary)", opacity: 0.7 }}>{kpi.icon}</div>
                      {kpi.label}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--text-primary)" }}>{kpi.value}</div>
                      {kpi.subValue && <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{kpi.subValue}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Filtering & Table */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <input type="text" placeholder="Search phone or ID..." value={drillSearch} onChange={e => setDrillSearch(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", outline: "none", width: 250, fontSize: "0.9rem" }} />
                  <div style={{ display: "flex", gap: 12 }}>
                    <select value={drillStatusFilter} onChange={e => setDrillStatusFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", outline: "none", fontSize: "0.9rem", cursor: "pointer" }}>
                      <option value="all">All Statuses</option>
                      <option value="not_started">Not Started</option>
                      <option value="pending">Pending / In Progress</option>
                      <option value="verified">Verified</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <button onClick={handleExportCSV} style={{ padding: "8px 16px", borderRadius: 8, background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-color)", fontWeight: 500, fontSize: "0.9rem", cursor: "pointer" }}>Export CSV</button>
                  </div>
                </div>

                {apUsersLoading ? (
                  <div style={{ padding: 40, textAlign: "center" }}><div className="loader"></div></div>
                ) : filteredUsers.length === 0 ? (
                  <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>No users match criteria.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Phone", "KYC Status", "Globe Status", "Step", "Registered At"].map(h => (
                            <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map(u => {
                          const app = u.kycApplications?.[0];
                          return (
                            <tr 
                              key={u.id} 
                              onClick={() => app?.applicationId && router.push(`/admin/maker-checker/${app.applicationId}`)}
                              style={{ transition: "background 0.15s", cursor: app?.applicationId ? "pointer" : "default" }}
                              onMouseOver={e => e.currentTarget.style.background = "var(--bg-secondary)"}
                              onMouseOut={e => e.currentTarget.style.background = "transparent"}
                            >
                              <td style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", fontSize: "0.9rem" }}>{u.phone}</td>
                              <td style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)" }}>
                                <span style={{ padding: "4px 8px", borderRadius: 4, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", fontSize: "0.75rem", fontWeight: 500 }}>{app?.status ? app.status.toUpperCase() : "NOT STARTED"}</span>
                              </td>
                              <td style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)" }}>
                                <span style={{ padding: "4px 8px", borderRadius: 4, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", fontSize: "0.75rem", fontWeight: 500 }}>{app?.globeStatus ? app.globeStatus.toUpperCase() : "PENDING"}</span>
                              </td>
                              <td style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", fontSize: "0.9rem" }}>Step {app?.currentStep || 0}</td>
                              <td style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", fontSize: "0.85rem", color: "var(--text-muted)" }}>{new Date(u.createdAt).toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "profile" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
              <div style={{ background: "var(--bg-card)", padding: 24, borderRadius: 12, border: "1px solid var(--border-color)", height: "fit-content" }}>
                <h3 style={{ marginTop: 0, fontSize: "1.1rem", fontWeight: 600 }}>Commission Tier</h3>
                <div style={{ marginBottom: 20 }}>
                  <select value={selectedAp.tier || "Standard"} onChange={e => changeTier(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", fontSize: "0.9rem" }}>
                    <option value="Standard">Standard (₹300/approval)</option>
                    <option value="Premium">Premium (₹500/approval)</option>
                    <option value="VIP">VIP (₹1000/approval)</option>
                  </select>
                </div>
                <hr style={{ border: "none", borderTop: "1px solid var(--border-color)", margin: "24px 0" }}/>
                <h3 style={{ marginTop: 0, fontSize: "1.1rem", fontWeight: 600 }}>Account Access</h3>
                <div>
                  <button onClick={toggleStatus} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: selectedAp.status === "suspended" ? "var(--text-primary)" : "#e5484d", fontWeight: 500, fontSize: "0.9rem", cursor: "pointer" }}>
                    {selectedAp.status === "suspended" ? "Reactivate Account" : "Suspend Account"}
                  </button>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 8 }}>Suspended partners cannot access their portal.</div>
                </div>
              </div>
              
              <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border-color)", overflow: "hidden" }}>
                <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)" }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>Activity Log</h3>
                </div>
                <div style={{ maxHeight: 400, overflowY: "auto", padding: 12 }}>
                  {apLogs.length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>No activity recorded yet.</div>
                  ) : (
                    apLogs.map(log => (
                      <div key={log.id} style={{ display: "flex", gap: 16, padding: "12px 16px", borderBottom: "1px solid var(--border-color)" }}>
                        <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{new Date(log.timestamp).toLocaleDateString()}</div>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: "0.9rem" }}>{log.action}</div>
                          {log.details && <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>{JSON.parse(log.details).message || log.details}</div>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        // ======================= MAIN AP LIST VIEW =======================
        <>
          {showForm && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 32, marginBottom: 32 }}>
              <h2 style={{ margin: "0 0 24px 0", fontSize: "1.2rem", fontWeight: 600 }}>Create New Associate Partner</h2>
              <form onSubmit={handleCreate}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                  <div>
                    <label style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: 8, display: "block", color: "var(--text-muted)" }}>Full Name</label>
                    <input type="text" value={formName} onChange={e => setFormName(e.target.value)} required style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", outline: "none", fontSize: "0.95rem" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: 8, display: "block", color: "var(--text-muted)" }}>Email Address</label>
                    <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} required style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", outline: "none", fontSize: "0.95rem" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: 8, display: "block", color: "var(--text-muted)" }}>Mobile Number</label>
                    <input type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} required maxLength={10} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", outline: "none", fontSize: "0.95rem" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: 8, display: "block", color: "var(--text-muted)" }}>Password</label>
                    <input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} required style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", outline: "none", fontSize: "0.95rem" }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button type="submit" disabled={creating} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "var(--text-primary)", color: "var(--bg-primary)", fontWeight: 500, fontSize: "0.95rem", cursor: creating ? "not-allowed" : "pointer" }}>
                    {creating ? "Creating..." : "Create Partner"}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", fontWeight: 500, fontSize: "0.95rem", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Minimal Leaderboard */}
          {sortedAps.length > 0 && !selectedDate && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <AwardIcon />
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>Top Performers</h3>
              </div>
              <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16, paddingTop: 4 }}>
                {[...aps].sort((a,b) => (b.breakdown?.approved||0) - (a.breakdown?.approved||0)).slice(0, 5).map((top, idx) => {
                  const medalColors = ["#f59e0b", "#6b7280", "#b45309", "#9ca3af", "#9ca3af"];
                  const bgColors = ["#fffbeb", "#f3f4f6", "#fff7ed", "#f9fafb", "#f9fafb"];
                  return (
                  <div key={top.id} onClick={() => setSelectedAp(top)} style={{ 
                    minWidth: 240, flex: 1, 
                    background: "var(--bg-card)", 
                    padding: 20, borderRadius: 16, 
                    border: "1px solid var(--border-color)",
                    display: "flex", alignItems: "center", gap: 16,
                    boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                    transition: "all 0.2s ease",
                    cursor: "pointer"
                  }}
                  onMouseOver={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 10px 20px rgba(0,0,0,0.06)"; e.currentTarget.style.borderColor = "var(--text-muted)"; }}
                  onMouseOut={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)"; e.currentTarget.style.borderColor = "var(--border-color)"; }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: bgColors[idx], color: medalColors[idx], display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", fontWeight: 700, border: `1px solid ${medalColors[idx]}33` }}>
                      #{idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "1.05rem", color: "var(--text-primary)" }}>
                        {top.name || top.apCode}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }}></div>
                        {top.breakdown?.approved||0} Approved Clients
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          )}

          {/* AP List */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "1rem", fontWeight: 600 }}>All Partners ({aps.length})</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", outline: "none", fontSize: "0.85rem" }}>
                <option value="newest">Newest First</option>
                <option value="referrals">Highest Referrals</option>
                <option value="approved">Most Approved</option>
              </select>
            </div>

            {aps.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
                <div style={{ fontSize: "0.9rem" }}>No partners found</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Partner Details", "Total Referrals", "Est. Payout", "Actions"].map(h => (
                        <th key={h} style={{ padding: "12px 24px", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAps.map(ap => (
                      <tr 
                        key={ap.id} 
                        onClick={() => setSelectedAp(ap)}
                        style={{ transition: "background 0.15s", cursor: "pointer", opacity: ap.status === "suspended" ? 0.6 : 1 }}
                        onMouseOver={e => e.currentTarget.style.background = "var(--bg-secondary)"}
                        onMouseOut={e => e.currentTarget.style.background = "transparent"}
                      >
                        <td style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)", fontWeight: 600, border: "1px solid var(--border-color)", fontSize: "1.1rem" }}>
                               {(ap.name || ap.apCode).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "1rem" }}>{ap.name || ap.apCode}</div>
                              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 4, display: "flex", gap: 8, alignItems: "center" }}>
                                <span style={{ background: "var(--bg-card)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border-color)", fontSize: "0.7rem", fontWeight: 600, color: "var(--text-primary)" }}>{ap.apCode}</span> 
                                <span>{ap.email}</span>
                                {ap.status === "suspended" && <span style={{ color: "#e5484d", fontWeight: 600 }}>(Suspended)</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)" }}>
                          <div style={{ fontSize: "1rem", fontWeight: 600 }}>{ap.referralCount}</div>
                        </td>
                        <td style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)" }}>
                          <div style={{ display: "inline-block", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", padding: "4px 10px", borderRadius: 8, fontWeight: 700, fontSize: "0.9rem" }}>
                            ₹{ap.estimatedCommission || 0}
                          </div>
                        </td>
                        <td style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)" }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={(e) => handleCopyLink(ap.apCode, e)}
                              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", fontSize: "0.8rem", cursor: "pointer" }}
                            >
                              {copiedId === ap.apCode ? "Copied" : "Copy Link"}
                            </button>
                            <button
                              onClick={(e) => handleDelete(ap.id, ap.name || ap.email, e)}
                              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border-color)", background: "transparent", color: "#e5484d", fontSize: "0.8rem", cursor: "pointer" }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
