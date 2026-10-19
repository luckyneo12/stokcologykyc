"use client";
import { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "@/utils/apiConfig";
import io from "socket.io-client";

import GlobeSidebar from "./components/GlobeSidebar";
import GlobeOverview from "./components/GlobeOverview";
import GlobeReviewQueue from "./components/GlobeReviewQueue";
import AdminThemeToggle from "../admin/components/AdminThemeToggle";

// Page name shown in the top bar (same style as the admin portal)
const SECTION_META = {
  overview: { title: "Dashboard", subtitle: "Globe review activity at a glance" },
  all: { title: "All Applications", subtitle: "Every application sent to Globe for review" },
  pending: { title: "Pending", subtitle: "Applications waiting for a Globe decision" },
  approved: { title: "Approved", subtitle: "Applications approved by Globe" },
  rejected: { title: "Rejected", subtitle: "Applications rejected by Globe" },
};

export default function GlobePage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [applications, setApplications] = useState([]);
  
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const token = typeof window !== 'undefined' ? localStorage.getItem("globeToken") : null;

  useEffect(() => {
    if (!token) {
      window.location.href = "/globe/login";
      return;
    }
    
    // Restore section from localstorage only on initial load
    const savedSection = localStorage.getItem("globeActiveSection");
    if (savedSection && savedSection !== activeSection) {
      setActiveSection(savedSection);
    } else {
      fetchData(activeSection);
    }
  }, [token]);

  const handleNavigate = (section) => {
    setActiveSection(section);
    localStorage.setItem("globeActiveSection", section);
  };

  const fetchData = async (section, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const kpiRes = await fetch(`${API_BASE_URL}/api/globe/kpis`, { headers: { "Authorization": `Bearer ${token}` } });
      const kpiData = await kpiRes.json();
      if (kpiData.success) setKpis(kpiData.data);

      if (section !== "overview") {
        const appsRes = await fetch(`${API_BASE_URL}/api/globe/kycs?globeStatus=${section}`, { headers: { "Authorization": `Bearer ${token}` } });
        const appsData = await appsRes.json();
        if (appsData.success) setApplications(appsData.data);
      }
    } catch (err) {
      console.error("Error fetching Globe data", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchRef = useRef(fetchData);
  useEffect(() => {
    fetchRef.current = fetchData;
  }, [fetchData]);

  useEffect(() => {
    if (token) {
      fetchData(activeSection);
      
      const socket = io(API_BASE_URL, { withCredentials: true });
      socket.on("connect", () => socket.emit("join_staff"));
      socket.on("applications_updated", () => {
        if (fetchRef.current) fetchRef.current(activeSection, true);
      });
      
      return () => socket.disconnect();
    }
  }, [activeSection, token]);

  const handleAction = async (id, action) => {
    // Only "approve" — rejecting is done inside the application, so the applicant always gets the mail
    const url = `${API_BASE_URL}/api/globe/kycs/${id}/${action}`;
    const body = null;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully ${action}ed KYC application!`);
        fetchData(activeSection, true);
      } else {
        alert(`Error: ${data.message || data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Failed to ${action} KYC.`);
    }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", gap: 14, alignItems: "center", justifyContent: "center", background: "var(--bg-secondary)", color: "var(--text-muted)", fontWeight: 600 }}>
      <div className="loader"></div>
      Loading Globe Portal...
    </div>
  );

  const meta = SECTION_META[activeSection] || SECTION_META.overview;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-secondary)" }}>
      {/* Sidebar */}
      <GlobeSidebar 
        active={activeSection} 
        onNavigate={handleNavigate} 
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%", overflowY: "auto" }}>
        {/* Top bar */}
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
          <div className="neu-page-head">
            <h1 className="neu-page-title">{meta.title}</h1>
            <p className="neu-page-sub">
              {activeSection === "overview" && <span className="neu-live-dot" />}
              {meta.subtitle}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <AdminThemeToggle storageKey="globeTheme" />
            <div style={{ textAlign: "right", borderLeft: "1px solid var(--border-color)", paddingLeft: 16 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>Globe Team</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Role: Reviewer</div>
            </div>
            <div className="neu-avatar" style={{ width: 40, height: 40, borderRadius: "12px", background: "var(--wise-green-alpha)", border: "1px solid var(--wise-green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--wise-green)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
          </div>
        </header>

      <main className="neu-main" style={{ 
        flex: 1, 
        width: "100%",
        padding: "24px",
        position: "relative"
      }}>
        {/* Dynamic Content */}
        <div style={{ maxWidth: "1600px", margin: "0 auto", animation: "fadeIn 0.4s ease forwards" }}>
          {activeSection === "overview" && <GlobeOverview kpis={kpis} onNavigate={handleNavigate} />}
          {["all", "pending", "approved", "rejected"].includes(activeSection) && <GlobeReviewQueue applications={applications} handleAction={handleAction} activeSection={activeSection} />}
        </div>
      </main>
      </div>

      {/* Inline styles for basic animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
