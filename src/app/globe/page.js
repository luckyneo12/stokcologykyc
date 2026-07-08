"use client";
import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/utils/apiConfig";

import GlobeSidebar from "./components/GlobeSidebar";
import GlobeOverview from "./components/GlobeOverview";
import GlobeReviewQueue from "./components/GlobeReviewQueue";

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
    
    // Restore section from localstorage
    const savedSection = localStorage.getItem("globeActiveSection");
    if (savedSection) setActiveSection(savedSection);
    
    fetchData();
  }, [token]);

  const handleNavigate = (section) => {
    setActiveSection(section);
    localStorage.setItem("globeActiveSection", section);
  };

  const fetchData = async () => {
    try {
      const [kpiRes, appsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/globe/kpis`, { headers: { "Authorization": `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/globe/kycs`, { headers: { "Authorization": `Bearer ${token}` } })
      ]);
      const kpiData = await kpiRes.json();
      const appsData = await appsRes.json();
      
      if (kpiData.success) setKpis(kpiData.data);
      if (appsData.success) setApplications(appsData.data);
    } catch (err) {
      console.error("Error fetching Globe data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    let url = `${API_BASE_URL}/api/globe/kycs/${id}/${action}`;
    let body = null;
    
    if (action === "reject") {
      const remarks = prompt("Please enter the reason for rejection:");
      if (!remarks) return;
      body = JSON.stringify({ remarks });
    }

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
        fetchData();
      } else {
        alert(`Error: ${data.message || data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Failed to ${action} KYC.`);
    }
  };

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-secondary)", color: "var(--text-muted)", fontWeight: 700 }}>Loading Globe Portal...</div>;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-secondary)" }}>
      {/* Sidebar */}
      <GlobeSidebar 
        active={activeSection} 
        onNavigate={handleNavigate} 
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <main style={{ 
        flex: 1, 
        height: "100vh", 
        overflowY: "auto",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative"
      }}>
        {/* Dynamic Content */}
        <div style={{ padding: "40px 48px", maxWidth: "1600px", margin: "0 auto", animation: "fadeIn 0.4s ease forwards" }}>
          {activeSection === "overview" && <GlobeOverview kpis={kpis} />}
          {activeSection === "maker_checker" && <GlobeReviewQueue applications={applications} handleAction={handleAction} />}
        </div>
      </main>

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
