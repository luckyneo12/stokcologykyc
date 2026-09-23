"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { API_BASE_URL } from "@/utils/apiConfig";
import "./ap.css";

const StepLabel = (step) => {
  if (step === 0) return "Not Started";
  if (step >= 14) return "Submitted";
  return `Step ${step}/14`;
};

const StatusBadge = ({ status, prefix }) => {
  const s = (status || "pending").toLowerCase();
  let cls = "ap-badge ap-badge--pending";
  let label = status || "Pending";

  if (s === "verified" || s === "approved") {
    cls = "ap-badge ap-badge--approved";
    label = "Approved";
  } else if (s === "rejected") {
    cls = "ap-badge ap-badge--rejected";
    label = "Rejected";
  } else if (s === "under_review") {
    cls = "ap-badge ap-badge--review";
    label = "Under Review";
  } else {
    label = "Pending";
  }

  return <span className={cls}>{prefix ? `${prefix}: ` : ""}{label}</span>;
};

export default function APDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [statusFilter, setStatusFilter] = useState("all");
  const allColumns = [
    { id: 'index', label: '#' },
    { id: 'name', label: 'Name' },
    { id: 'phone', label: 'Phone' },
    { id: 'email', label: 'Email' },
    { id: 'applicationId', label: 'App ID' },
    { id: 'kycStage', label: 'KYC Stage' },
    { id: 'adminStatus', label: 'Admin Status' },
    { id: 'globeStatus', label: 'Globe Status' },
    { id: 'registered', label: 'Registered' },
    { id: 'lastUpdated', label: 'Last Updated' },
  ];
  const [visibleColumns, setVisibleColumns] = useState(['index', 'name', 'phone', 'kycStage', 'globeStatus', 'registered']);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  
  const dropdownRef = useRef(null);
  const columnDropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("apUser");
    const token = localStorage.getItem("apToken");
    if (!token || !storedUser) {
      router.push("/ap/login");
      return;
    }
    const parsed = JSON.parse(storedUser);
    if (parsed.role !== "ap") {
      router.push("/ap/login");
      return;
    }
    setUser(parsed);
    fetchDashboard(token);
    fetchUsers(token, 1, "");
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(e.target)) {
        setShowColumnDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchDashboard = async (token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/ap/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setStats(data);
    } catch (err) {
      console.error("Failed to fetch dashboard", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (token, pageNum, searchQ) => {
    setUsersLoading(true);
    try {
      const tkn = token || localStorage.getItem("apToken");
      const res = await fetch(`${API_BASE_URL}/api/ap/users?page=${pageNum}&limit=15&search=${encodeURIComponent(searchQ)}`, {
        headers: { Authorization: `Bearer ${tkn}` }
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
        setTotalPages(data.totalPages);
        setTotal(data.total);
        setPage(data.page);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleSearch = (val) => {
    setSearch(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchUsers(null, 1, val);
    }, 400);
  };

  const handleCopy = () => {
    const link = getReferralLink();
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("apToken");
    localStorage.removeItem("apUser");
    router.push("/ap/login");
  };

  const getReferralLink = () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const apCode = user?.apCode || `AP${user?.id}`;
    return `${baseUrl}/?apcode=${apCode}`;
  };

  const exportToCSV = () => {
    if (!users || users.length === 0) return;
    const headers = ["Phone", "Email", "KYC Stage", "Admin Status", "Globe Status", "Registered Date"];
    const rows = users.map(u => {
      const app = u.kycApplications?.[0];
      return [
        u.phone,
        u.email || "",
        app ? StepLabel(app.currentStep) : "Not Started",
        app?.status || "Pending",
        app?.globeStatus || "Pending",
        new Date(u.createdAt).toLocaleDateString("en-IN")
      ].join(",");
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `referred_users_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || !user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f8fafc" }}>
        <div className="loader"></div>
      </div>
    );
  }

  // Prepare data for the chart
  const chartData = stats ? [
    { name: "Not Started", value: stats.stageBreakdown.notStarted, color: "#94a3b8" },
    { name: "In Progress", value: stats.stageBreakdown.inProgress, color: "#f59e0b" },
    { name: "Submitted", value: stats.stageBreakdown.submitted, color: "#10b981" },
  ] : [];

  // Filter currently loaded page users
  const filteredUsers = users.filter(u => {
    const app = u.kycApplications?.[0];
    const status = (app?.status || "not started").toLowerCase();
    if (statusFilter !== "all") {
       if (statusFilter === "not_started" && status !== "not started") return false;
       if (statusFilter === "pending" && !["pending", "under_review"].includes(status)) return false;
       if (statusFilter === "verified" && !["verified", "approved"].includes(status)) return false;
       if (statusFilter === "rejected" && status !== "rejected") return false;
    }
    return true;
  });

  return (
    <div className="ap-layout-wrapper" style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Header */}
      <header className="ap-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="ap-header-title">
            AP Dashboard
          </div>
          <div style={{ padding: "4px 12px", borderRadius: 999, background: "#f1f5f9", color: "#475569", fontSize: "0.75rem", fontWeight: 800, border: "1px solid #e2e8f0" }}>
            {user.apCode || `AP${user.id}`}
          </div>
        </div>

        <div className="ap-user-menu" ref={dropdownRef}>
          <div className="ap-user-trigger" onClick={() => setShowDropdown(!showDropdown)}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 750, color: "#0f172a", lineHeight: 1.2 }}>{user.name || user.email?.split("@")[0]}</div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Associate Partner</div>
            </div>
            <div style={{ width: 42, height: 42, borderRadius: "14px", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
          </div>

            {showDropdown && (
              <div className="ap-dropdown">
                <button className="ap-dropdown-item" onClick={() => { setShowDropdown(false); router.push("/ap/profile"); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Profile & Password
                </button>
                <button className="ap-dropdown-item ap-dropdown-item--danger" onClick={handleLogout}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Logout
                </button>
              </div>
            )}
          </div>
      </header>

      {/* Main Content Layout */}
      <div className="ap-page-container">
        
        {/* Sidebar */}
        <div className="ap-sidebar animate-stagger-1">
          <button className={`ap-sidebar-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
            Dashboard
          </button>
          <button className={`ap-sidebar-link ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            Referred Users
          </button>
        </div>

        {/* Main Content Area */}
        <div className="ap-main-content">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="animate-stagger-2">
              {/* Stats Grid */}
              {stats && (
                <div className="ap-stats-grid">
                  <div className="ap-stat-card">
                    <div className="ap-stat-icon-wrapper icon-blue">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div className="ap-stat-value">{stats.totalUsers}</div>
                    <div className="ap-stat-label">Total Users</div>
                  </div>

                  <div className="ap-stat-card">
                    <div className="ap-stat-icon-wrapper icon-amber">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div className="ap-stat-value">{stats.adminActions.pending}</div>
                    <div className="ap-stat-label">Admin Pending</div>
                  </div>

                  <div className="ap-stat-card">
                    <div className="ap-stat-icon-wrapper icon-purple">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    </div>
                    <div className="ap-stat-value">{stats.adminActions.underReview}</div>
                    <div className="ap-stat-label">Under Review</div>
                  </div>

                  <div className="ap-stat-card">
                    <div className="ap-stat-icon-wrapper icon-emerald">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    <div className="ap-stat-value">{stats.adminActions.approved}</div>
                    <div className="ap-stat-label">Admin Approved</div>
                  </div>

                  <div className="ap-stat-card">
                    <div className="ap-stat-icon-wrapper icon-rose">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    </div>
                    <div className="ap-stat-value">{stats.adminActions.rejected}</div>
                    <div className="ap-stat-label">Admin Rejected</div>
                  </div>
                  
                  <div className="ap-stat-card">
                    <div className="ap-stat-icon-wrapper icon-emerald">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    </div>
                    <div className="ap-stat-value">{stats.globeActions.approved}</div>
                    <div className="ap-stat-label">Globe Approved</div>
                  </div>

                  <div className="ap-stat-card">
                    <div className="ap-stat-icon-wrapper icon-rose">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    </div>
                    <div className="ap-stat-value">{stats.globeActions.rejected}</div>
                    <div className="ap-stat-label">Globe Rejected</div>
                  </div>
                </div>
              )}

              {/* Middle Section: Referral & Chart */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", paddingBottom: "40px" }}>
                {/* Referral Link */}
                <div className="ap-glass-panel" style={{ marginBottom: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                    <div>
                      <div className="ap-section-title">Your Referral Link</div>
                      <div className="ap-section-subtitle">Share this link to seamlessly onboard users under your AP code. All traffic is tracked automatically.</div>
                    </div>
                    {stats && (
                      <div style={{ padding: "8px 16px", borderRadius: 999, background: "#ffffff", border: "1px solid #e2e8f0", fontSize: "0.85rem", fontWeight: 700, color: "#475569", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                        <span style={{ color: "#94a3b8" }}>{stats.stageBreakdown.notStarted} Not Started</span> &nbsp;·&nbsp; <span style={{ color: "#f59e0b" }}>{stats.stageBreakdown.inProgress} In Progress</span> &nbsp;·&nbsp; <span style={{ color: "#10b981" }}>{stats.stageBreakdown.submitted} Submitted</span>
                      </div>
                    )}
                  </div>
                  <div className="ap-referral-link-box">
                    <input type="text" value={getReferralLink()} readOnly />
                    <button className={`ap-copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
                      {copied ? "✓ Copied to Clipboard" : "Copy Link"}
                    </button>
                  </div>
                </div>

                {/* KYC Stage Chart */}
                <div className="ap-glass-panel" style={{ marginBottom: 0, padding: "24px 32px" }}>
                  <div className="ap-section-title">KYC Funnel</div>
                  <div className="ap-section-subtitle" style={{ marginBottom: 16 }}>Distribution of your users across onboarding stages</div>
                  
                  <div style={{ height: 200, width: "100%" }}>
                    {stats && stats.totalUsers > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 600, color: '#334155' }}
                            itemStyle={{ color: '#0f172a', fontWeight: 800 }}
                          />
                          <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontWeight: 600 }}>
                        No data available yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REFERRED USERS */}
          {activeTab === 'users' && (
            <div className="ap-table-container animate-stagger-2">
              <div className="ap-table-header-container" style={{ padding: "28px 32px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <div>
                  <div className="ap-section-title">Referred Users ({total})</div>
                  <div className="ap-section-subtitle">Real-time status of all users registered via your link</div>
                </div>
                
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <select 
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ padding: "10px 16px", borderRadius: 12, border: "1px solid #cbd5e1", outline: "none", color: "#334155", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", background: "#fff" }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="not_started">Not Started</option>
                    <option value="pending">Pending / In Progress</option>
                    <option value="verified">Approved / Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Search by phone or email..."
                    className="ap-table-search"
                    style={{ minWidth: 220 }}
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                  
                  <div style={{ position: "relative" }} ref={columnDropdownRef}>
                    <button className="ap-btn-outline" onClick={() => setShowColumnDropdown(!showColumnDropdown)}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 3h18v18H3z"></path><path d="M9 3v18"></path><path d="M15 3v18"></path></svg>
                      Columns
                    </button>
                    {showColumnDropdown && (
                      <div className="ap-dropdown" style={{ right: 0, left: "auto", padding: "8px", minWidth: 200, zIndex: 50, top: "calc(100% + 8px)" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", padding: "8px 12px", borderBottom: "1px solid #f1f5f9", marginBottom: 8 }}>
                          Toggle Columns
                        </div>
                        {allColumns.map(col => (
                          <label key={col.id} className="ap-dropdown-item" style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", cursor: "pointer", color: "#334155" }}>
                            <input 
                              type="checkbox" 
                              checked={visibleColumns.includes(col.id)} 
                              onChange={() => {
                                if (visibleColumns.includes(col.id)) {
                                  setVisibleColumns(visibleColumns.filter(id => id !== col.id));
                                } else {
                                  setVisibleColumns([...visibleColumns, col.id]);
                                }
                              }}
                              style={{ cursor: "pointer", width: 16, height: 16 }}
                            />
                            {col.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <button className="ap-btn-outline" onClick={exportToCSV}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Export CSV
                  </button>
                </div>
              </div>

              {usersLoading ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <div className="loader" style={{ margin: "0 auto" }}></div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="ap-empty">
                  <div className="ap-empty-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="11" x2="19" y2="17"/></svg>
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, margin: "16px 0 4px" }}>No users found</div>
                  <div style={{ fontSize: "0.85rem", color: "#64748b" }}>Try adjusting your filters or share your link to get started.</div>
                </div>
              ) : (
                <>
                  <div style={{ overflowX: "auto" }}>
                    <table className="ap-table">
                      <thead>
                        <tr>
                          {visibleColumns.includes('index') && <th>#</th>}
                          {visibleColumns.includes('name') && <th>Name</th>}
                          {visibleColumns.includes('phone') && <th>Phone</th>}
                          {visibleColumns.includes('email') && <th>Email</th>}
                          {visibleColumns.includes('applicationId') && <th>App ID</th>}
                          {visibleColumns.includes('kycStage') && <th>KYC Stage</th>}
                          {visibleColumns.includes('adminStatus') && <th>Admin Status</th>}
                          {visibleColumns.includes('globeStatus') && <th>Globe Status</th>}
                          {visibleColumns.includes('registered') && <th>Registered</th>}
                          {visibleColumns.includes('lastUpdated') && <th>Last Updated</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u, idx) => {
                          const app = u.kycApplications?.[0];
                          return (
                            <tr key={u.id}>
                              {visibleColumns.includes('index') && <td style={{ color: "var(--text-muted)", fontWeight: 600 }}>{(page - 1) * 15 + idx + 1}</td>}
                              {visibleColumns.includes('name') && <td style={{ fontWeight: 700, color: "#1e293b" }}>{u.name || "—"}</td>}
                              {visibleColumns.includes('phone') && <td style={{ fontWeight: 600 }}>{u.phone}</td>}
                              {visibleColumns.includes('email') && <td>{u.email || "—"}</td>}
                              {visibleColumns.includes('applicationId') && <td><span style={{ fontFamily: "monospace", color: "#64748b", background: "#f1f5f9", padding: "2px 6px", borderRadius: 6, fontSize: "0.8rem" }}>{u.applicationId || "—"}</span></td>}
                              {visibleColumns.includes('kycStage') && <td>
                                <span className="ap-badge ap-badge--review">
                                  {app ? StepLabel(app.currentStep) : "Not Started"}
                                </span>
                              </td>}
                              {visibleColumns.includes('adminStatus') && <td><StatusBadge status={app?.status} /></td>}
                              {visibleColumns.includes('globeStatus') && <td><StatusBadge status={app?.globeStatus} /></td>}
                              {visibleColumns.includes('registered') && <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                                {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              </td>}
                              {visibleColumns.includes('lastUpdated') && <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                                {new Date(u.lastUpdated).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              </td>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="ap-pagination">
                      <button disabled={page <= 1} onClick={() => fetchUsers(null, page - 1, search)}>
                        ← Previous
                      </button>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>
                        Page {page} of {totalPages}
                      </span>
                      <button disabled={page >= totalPages} onClick={() => fetchUsers(null, page + 1, search)}>
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
