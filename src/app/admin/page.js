"use client";
import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/utils/apiConfig";
import "./admin.css";
import AdminSidebar from "./components/AdminSidebar";
import DashboardOverview from "./components/sections/DashboardOverview";
import KYCRequests from "./components/sections/KYCRequests";
import EStamps from "./components/sections/EStamps";
import { 
  AuditLogs
} from "./components/sections/OtherSections";
import PdfBuilder from "./components/sections/PdfBuilder";

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

  // Load from localStorage on mount to avoid hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem("adminActiveSection");
    if (saved) setActiveSection(saved);
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        window.location.href = "/admin/login";
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/admin/dashboard-data`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.status === 401) {
          localStorage.removeItem("adminToken");
          localStorage.removeItem("adminUser");
          window.location.href = "/admin/login";
        } else {
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error("Token verification failed", e);
        setIsAuthenticated(true);
      } finally {
        setLoadingAuth(false);
      }
    };
    verifyToken();
  }, []);

  if (loadingAuth || !isAuthenticated) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg-secondary)" }}>
      <div className="loader"></div>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case "overview": return <DashboardOverview onNavigate={setActiveSection} />;
      case "kyc": return <KYCRequests searchQuery={searchQuery} onSearchChange={setSearchQuery} />;
      case "estamps": return <EStamps searchQuery={searchQuery} onSearchChange={setSearchQuery} />;
      case "audit": return <AuditLogs />;
      case "pdf-builder": return <PdfBuilder />;
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
        onNavigate={(sec) => {
          setActiveSection(sec);
          localStorage.setItem("adminActiveSection", sec);
          setSearchQuery(""); // Clear search query when changing sections
        }} 
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%", overflowY: "auto" }}>
        {/* Top Header */}
        <header className="admin-header">
          <div style={{ fontWeight: 700, color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Admin / <span style={{ color: "var(--text-primary)", textTransform: "capitalize" }}>{activeSection.replace("_", " ")}</span>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* Search Placeholder */}
            <div style={{ position: "relative" }}>
              <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", zIndex: 10 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input 
                type="text" 
                placeholder="Global search..." 
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  // Auto-navigate to 'kyc' if the user is in overview or a non-searchable section and starts searching
                  if (val && activeSection !== "kyc" && activeSection !== "users") {
                    setActiveSection("kyc");
                    localStorage.setItem("adminActiveSection", "kyc");
                  }
                }}
                className="global-search-input"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
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
