"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/utils/apiConfig";
import "../ap.css";

export default function APProfile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

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
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }

    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      setMessage({ type: "error", text: "Password must contain at least one special character" });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("apToken");
      const res = await fetch(`${API_BASE_URL}/api/ap/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: "success", text: "Password changed successfully!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMessage({ type: "error", text: data.error || "Failed to change password" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Connection error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="ap-loader">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div className="ap-layout-wrapper" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <header className="ap-header" style={{ position: "static", boxShadow: "none", background: "transparent", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, width: "100%" }}>
          <button onClick={() => router.push("/ap")} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontWeight: 700, fontSize: "0.95rem", transition: "color 0.2s" }} onMouseOver={e => e.currentTarget.style.color = "#0f172a"} onMouseOut={e => e.currentTarget.style.color = "#64748b"}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Dashboard
          </button>
        </div>
      </header>

      {/* Main Settings Area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        
        {/* Settings Sidebar */}
        <div style={{ width: 280, borderRight: "1px solid rgba(0,0,0,0.05)", padding: "48px 32px", background: "rgba(255,255,255,0.4)" }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 900, color: "#0f172a", marginBottom: 32, letterSpacing: "-1px" }}>Settings</h1>
          
          <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ padding: "12px 16px", background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", color: "#0f172a", fontWeight: 700, fontSize: "0.95rem", boxShadow: "0 4px 12px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: 12 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Account & Security
            </div>
            <div style={{ padding: "12px 16px", background: "transparent", color: "#64748b", fontWeight: 600, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 12, opacity: 0.5 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Notifications (Soon)
            </div>
          </nav>
        </div>

        {/* Settings Content */}
        <div style={{ flex: 1, padding: "48px 64px", overflowY: "auto" }}>
          <div style={{ width: "100%" }}>
            
            {/* Account Details Card */}
            <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 10px 40px rgba(0, 0, 0, 0.03)", marginBottom: 40, overflow: "hidden" }}>
              <div style={{ padding: "32px 40px" }}>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 800, marginBottom: 8, color: "#0f172a", letterSpacing: "-0.5px" }}>Personal Information</h2>
                <p style={{ color: "#64748b", fontSize: "0.95rem", marginBottom: 32, fontWeight: 500 }}>Your personal profile information and generated referral code.</p>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <div className="ap-profile-field">
                    <div className="ap-profile-label">Full Name</div>
                    <div className="ap-profile-value">{user.name || "—"}</div>
                  </div>
                  <div className="ap-profile-field">
                    <div className="ap-profile-label">AP Code</div>
                    <div className="ap-profile-value" style={{ color: "#059669" }}>{user.apCode || `AP${user.id}`}</div>
                  </div>
                  <div className="ap-profile-field">
                    <div className="ap-profile-label">Email Address</div>
                    <div className="ap-profile-value" style={{ wordBreak: "break-all" }}>{user.email}</div>
                  </div>
                  <div className="ap-profile-field">
                    <div className="ap-profile-label">Phone Number</div>
                    <div className="ap-profile-value">{user.phone || "—"}</div>
                  </div>
                </div>
              </div>
              <div style={{ background: "#f8fafc", padding: "16px 40px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>Contact an administrator to modify your email or phone number.</span>
              </div>
            </div>

            {/* Change Password Card */}
            <form onSubmit={handleChangePassword} style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 10px 40px rgba(0, 0, 0, 0.03)", marginBottom: 40, overflow: "hidden" }}>
              <div style={{ padding: "32px 40px" }}>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 800, marginBottom: 8, color: "#0f172a", letterSpacing: "-0.5px" }}>Update Password</h2>
                <p style={{ color: "#64748b", fontSize: "0.95rem", marginBottom: 32, fontWeight: 500 }}>
                  Ensure your account is using a long, random password to stay secure.
                </p>

                {message.text && (
                  <div style={{ padding: "16px", borderRadius: "12px", marginBottom: "24px", fontWeight: "600", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "10px", 
                                background: message.type === "success" ? "#ecfdf5" : "#fef2f2", 
                                color: message.type === "success" ? "#059669" : "#e11d48",
                                border: `1px solid ${message.type === "success" ? "#a7f3d0" : "#fecdd3"}`}}>
                    {message.type === "success" ? (
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    ) : (
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    )}
                    {message.text}
                  </div>
                )}

                <div style={{ maxWidth: 400 }}>
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#475569", marginBottom: 8, display: "block" }}>Current Password</label>
                    <input
                      type="password"
                      className="ap-input"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#475569", marginBottom: 8, display: "block" }}>New Password</label>
                    <input
                      type="password"
                      className="ap-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#475569", marginBottom: 8, display: "block" }}>Confirm New Password</label>
                    <input
                      type="password"
                      className="ap-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
              </div>
              <div style={{ background: "#f8fafc", padding: "16px 40px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>Must be at least 6 characters with a special character.</span>
                <button type="submit" className="ap-btn-primary" disabled={loading} style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, padding: "10px 24px" }}>
                  {loading ? (
                    <svg className="ap-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "ap-spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  ) : (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  )}
                  {loading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes ap-spin {
          100% { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
