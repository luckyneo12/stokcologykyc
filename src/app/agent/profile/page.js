"use client";

import { useEffect, useState } from "react";
import { User, Mail, Shield, CheckCircle } from "lucide-react";
import "@/app/admin/admin.css";

export default function AgentProfile() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("agent_user");
    if (storedUser && storedUser !== "undefined") {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse agent_user in profile", e);
      }
    }
  }, []);

  if (!user) return null;

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 className="admin-section-title" style={{ marginBottom: "4px" }}>Agent Profile</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>View your synced CRM profile credentials and assigned KYC workspace permissions</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2.5fr", gap: "32px" }}>
        {/* Left Avatar Card */}
        <div>
          <div className="card" style={{ padding: "32px 24px", textAlign: "center" }}>
            <div style={{ 
              width: "80px", height: "80px", borderRadius: "50%", 
              background: "rgba(159, 232, 112, 0.2)", display: "flex", 
              alignItems: "center", justifyContent: "center", margin: "0 auto 20px auto",
              border: "1px solid var(--border-color)"
            }}>
              <span style={{ fontSize: "2rem", fontWeight: 900, color: "var(--wise-dark-green)" }}>
                {user?.email?.charAt(0).toUpperCase() || "A"}
              </span>
            </div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 8px 0", wordBreak: "break-all" }}>{user?.email}</h2>
            <span className="badge badge-verified" style={{ padding: "6px 12px", fontSize: "0.7rem" }}>
              KYC Team Agent
            </span>
          </div>
        </div>

        {/* Right Info Section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Info card */}
          <div className="card" style={{ padding: "28px" }}>
            <h3 style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <User style={{ width: "16px", height: "16px" }} /> Account Information
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              <div>
                <label className="inspection-label">Email Address</label>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Mail style={{ width: "16px", height: "16px", color: "var(--text-muted)" }} />
                  {user.email}
                </div>
              </div>
              
              <div>
                <label className="inspection-label">Employee ID (CRM)</label>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", fontFamily: "monospace" }}>{user.id || "N/A"}</div>
              </div>
            </div>
          </div>

          {/* Permissions card */}
          <div className="card" style={{ padding: "28px" }}>
            <h3 style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Shield style={{ width: "16px", height: "16px" }} /> Access Control Permissions
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label className="inspection-label">Assigned Security Role</label>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(159, 232, 112, 0.15)", color: "var(--wise-dark-green)", padding: "6px 12px", borderRadius: "8px", fontSize: "0.85rem", fontWeight: 800 }}>
                  <CheckCircle style={{ width: "14px", height: "14px" }} />
                  {user.role === "kyc_team" ? "KYC Portal Reviewer" : user.role}
                </div>
              </div>

              {user.kyc_stages && user.kyc_stages.length > 0 && (
                <div>
                  <label className="inspection-label">Authorized Operations</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
                    {user.kyc_stages.map((stage, idx) => (
                      <span key={idx} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", padding: "6px 12px", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 700 }}>
                        {stage}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
