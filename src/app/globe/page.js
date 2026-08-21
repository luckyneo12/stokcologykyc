"use client";
import { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "@/utils/apiConfig";
import io from "socket.io-client";

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
        fetchData(activeSection, true);
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
          {activeSection === "overview" && <GlobeOverview kpis={kpis} onNavigate={handleNavigate} />}
          {["all", "pending", "approved", "rejected"].includes(activeSection) && <GlobeReviewQueue applications={applications} handleAction={handleAction} activeSection={activeSection} />}
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
