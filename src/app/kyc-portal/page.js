"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "../admin/components/AdminSidebar";
import KYCRequests from "../admin/components/sections/KYCRequests";


export default function KYCPortal() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("adminUser");
    const token = localStorage.getItem("adminToken");
    
    if (!token || !storedUser) {
      router.push("/kyc-portal/login");
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role !== "kyc_team" && parsedUser.role !== "admin") {
      router.push("/kyc-portal/login");
      return;
    }
    
    setUser(parsedUser);
  }, [router]);

  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg-secondary)" }}>
      <div className="loader"></div>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-secondary)" }}>
      {/* Shared Sidebar - we can customize this for KYC team later */}
      <AdminSidebar 
        active="kyc" 
        onNavigate={() => {}} // KYC team stays on kyc requests
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        isKYCTeam={true}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ 
          height: 72, background: "var(--bg-primary)", borderBottom: "1px solid var(--border-color)", 
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px",
          position: "sticky", top: 0, zIndex: 100
        }}>
          <div style={{ fontWeight: 700, color: "var(--text-muted)", fontSize: "0.9rem" }}>
            KYC Verification Portal / <span style={{ color: "var(--text-primary)" }}>Pending Requests</span>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{user.email.split('@')[0]}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Role: KYC Verifier</div>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: "12px", background: "var(--wise-green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--wise-dark-green)" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
              </div>
            </div>
            <button 
              onClick={() => { localStorage.clear(); router.push("/kyc-portal/login"); }}
              style={{ padding: "8px 16px", borderRadius: "10px", border: "1px solid var(--border-color)", background: "transparent", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}
            >
              Logout
            </button>
          </div>
        </header>

        <main style={{ padding: "40px", flex: 1, maxWidth: 1400 }}>
          <KYCRequests />
        </main>
      </div>
    </div>
  );
}
