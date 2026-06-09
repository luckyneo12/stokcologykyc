"use client";
import { useState, useEffect } from "react";
import "./admin.css";
import AdminSidebar from "./components/AdminSidebar";
import DashboardOverview from "./components/sections/DashboardOverview";
import KYCRequests from "./components/sections/KYCRequests";
import UserManagement from "./components/sections/UserManagement";
import { 
  RiskFraud, 
  RulesConfig, 
  Notifications, 
  Analytics, 
  RolesPermissions, 
  AuditLogs, 
  SystemSettings,
  DocumentRepository,
  FaceMatchLogs
} from "./components/sections/OtherSections";

// Self-contained Theme Toggle for Admin
function AdminThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const isDark = localStorage.getItem("adminTheme") === "dark" || document.documentElement.getAttribute("data-theme") === "dark";
    setDark(isDark);
    if (isDark) document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("adminTheme", next ? "dark" : "light");
  };
  return (
    <button onClick={toggle} title="Toggle theme" style={{
      width: 40, height: 40, borderRadius: "12px",
      display: "flex", alignItems: "center", justifyContent: "center",
      border: "1px solid var(--border-color)", background: "var(--bg-primary)",
      cursor: "pointer", transition: "all 0.2s ease"
    }}>
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--wise-green)" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      )}
    </button>
  );
}

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      window.location.href = "/admin/login";
    } else {
      setIsAuthenticated(true);
    }
  }, []);

  if (!isAuthenticated) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg-secondary)" }}>
      <div className="loader"></div>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case "overview": return <DashboardOverview onNavigate={setActiveSection} />;
      case "kyc": return <KYCRequests />;
      case "users": return <UserManagement />;
      case "risk": return <RiskFraud />;
      case "rules": return <RulesConfig />;
      case "notifications": return <Notifications />;
      case "analytics": return <Analytics />;
      case "roles": return <RolesPermissions />;
      case "audit": return <AuditLogs />;
      case "system": return <SystemSettings />;
      case "documents": return <DocumentRepository />;
      case "facematch": return <FaceMatchLogs />;
      default: return <DashboardOverview onNavigate={setActiveSection} />;
    }
  };

  return (
    <div style={{ 
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      background: "var(--bg-secondary)"
    }}>
      <div style={{ 
        display: "flex", 
        width: "125%",
        height: "125%",
        transform: "scale(0.8)",
        transformOrigin: "top left"
      }}>
      {/* Sidebar Navigation */}
      <AdminSidebar 
        active={activeSection} 
        onNavigate={setActiveSection} 
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%", overflowY: "auto" }}>
        {/* Top Header */}
        <header style={{ 
          height: 72, background: "var(--bg-primary)", borderBottom: "1px solid var(--border-color)", 
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px",
          position: "sticky", top: 0, zIndex: 100
        }}>
          <div style={{ fontWeight: 700, color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Admin / <span style={{ color: "var(--text-primary)", textTransform: "capitalize" }}>{activeSection.replace("_", " ")}</span>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* Search Placeholder */}
            <div style={{ position: "relative" }}>
              <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input 
                type="text" placeholder="Global search... (Press Enter)" 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    alert("Global search is coming soon! For now, please use the specific search filters within each section.");
                    e.target.value = '';
                  }
                }}
                style={{ padding: "8px 16px 8px 36px", borderRadius: 10, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", width: 220, fontSize: "0.85rem", outline: "none" }} 
              />
            </div>
            
            <AdminThemeToggle />
            
            <div style={{ display: "flex", alignItems: "center", gap: 12, borderLeft: "1px solid var(--border-color)", paddingLeft: 20 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>Super Admin</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Role: Master Control</div>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: "12px", background: "var(--wise-green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--wise-dark-green)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
            </div>
          </div>
        </header>

        {/* Content Scroll Container */}
        <main style={{ padding: "24px", flex: 1, width: "100%" }}>
          {renderSection()}
        </main>
        </div>
      </div>
    </div>
  );
}
