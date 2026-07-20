"use client";
import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/utils/apiConfig";
import "./admin.css";
import AdminSidebar from "./components/AdminSidebar";
import DashboardOverview from "./components/sections/DashboardOverview";
import KYCRequests from "./components/sections/KYCRequests";
import EStamps from "./components/sections/EStamps";
import AdminThemeToggle from "./components/AdminThemeToggle";
import { 
  AuditLogs
} from "./components/sections/OtherSections";
import PdfBuilder from "./components/sections/PdfBuilder";


export default function AdminPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [activeSectionParams, setActiveSectionParams] = useState({});

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
    const handleNavigate = (sec, params = {}) => {
      setActiveSection(sec);
      setActiveSectionParams(params);
      localStorage.setItem("adminActiveSection", sec);
      setSearchQuery("");
    };

    switch (activeSection) {
      case "overview": return <DashboardOverview onNavigate={handleNavigate} />;
      case "kyc": return <KYCRequests searchQuery={searchQuery} onSearchChange={setSearchQuery} defaultFilter={activeSectionParams?.filter} />;
      case "estamps": return <EStamps searchQuery={searchQuery} onSearchChange={setSearchQuery} />;
      case "audit": return <AuditLogs />;
      case "pdf-builder": return <PdfBuilder />;
      default: return <DashboardOverview onNavigate={handleNavigate} />;
    }
  };

  return (
    <div style={{ 
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      background: "var(--bg-secondary)",
      display: "flex"
    }}>
      {/* Sidebar Navigation */}
      <AdminSidebar 
        active={activeSection} 
        onNavigate={(sec) => {
          setActiveSection(sec);
          setActiveSectionParams({});
          localStorage.setItem("adminActiveSection", sec);
          setSearchQuery(""); // Clear search query when changing sections
        }} 
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%", overflowY: "auto" }}>
        {/* Top Header */}
        <header className="admin-header" style={{ 
          padding: "24px 40px", 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          borderBottom: "1px solid var(--border-color)",
          background: "var(--bg-primary)",
          position: "sticky",
          top: 0,
          zIndex: 20
        }}>
          <div style={{ fontWeight: 700, color: "var(--text-muted)", fontSize: "0.95rem" }}>
            Admin / <span style={{ color: "var(--text-primary)", textTransform: "capitalize" }}>{activeSection.replace("_", " ")}</span>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
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
            
            <div style={{ display: "flex", alignItems: "center", gap: 12, borderLeft: "1px solid var(--border-color)", paddingLeft: 20, cursor: "pointer", transition: "opacity 0.2s" }} onMouseOver={e => e.currentTarget.style.opacity="0.8"} onMouseOut={e => e.currentTarget.style.opacity="1"}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>Super Admin</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Role: Master Control</div>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: "12px", background: "var(--wise-green-alpha)", border: "1px solid var(--wise-green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--wise-green)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
        </header>

        {/* Content Scroll Container */}
        <main style={{ padding: "24px", flex: 1, width: "100%" }}>
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
