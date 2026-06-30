"use client";

import { useEffect, useState, useRef } from "react";
import { User, Mail, Shield, CheckCircle, Camera, Bell, Globe, Lock, Settings, Save, Smartphone, X } from "lucide-react";
import "@/app/admin/admin.css";

export default function AgentProfile() {
  const [user, setUser] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isHoveringAvatar, setIsHoveringAvatar] = useState(false);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const fileInputRef = useRef(null);
  
  // Local Settings State (Mock)
  const [settings, setSettings] = useState({
    notifications: true,
    emailAlerts: true,
    smsAlerts: false,
    darkMode: false,
    language: 'en',
    timezone: 'Asia/Kolkata'
  });

  useEffect(() => {
    const storedUser = localStorage.getItem("agent_user");
    if (storedUser && storedUser !== "undefined") {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse agent_user in profile", e);
      }
    }
    const storedPhoto = localStorage.getItem("agent_photo");
    if (storedPhoto) {
      setPhoto(storedPhoto);
    }
  }, []);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result);
        localStorage.setItem("agent_photo", reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarClick = () => {
    if (photo) {
      setShowPhotoMenu(!showPhotoMenu);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (!user) return null;

  return (
    <div className="admin-animate" style={{ maxWidth: "1100px", margin: "0 auto", paddingBottom: "40px" }}>
      {/* Header Banner */}
      <div style={{
        position: "relative",
        height: "180px",
        borderRadius: "16px",
        background: "linear-gradient(135deg, var(--wise-green) 0%, var(--wise-dark-green) 100%)",
        marginBottom: "60px",
        boxShadow: "0 10px 30px rgba(159, 232, 112, 0.2)"
      }}>
        <div style={{ position: "absolute", bottom: "-40px", left: "40px", display: "flex", alignItems: "flex-end", gap: "24px" }}>
          {/* Avatar with Upload */}
          <div 
            style={{ 
              position: "relative", 
              transition: "transform 0.2s ease",
              transform: isHoveringAvatar ? "scale(1.02)" : "scale(1)"
            }} 
            onMouseEnter={() => setIsHoveringAvatar(true)}
            onMouseLeave={() => setIsHoveringAvatar(false)}
          >
            <div 
              style={{ cursor: "pointer", position: "relative" }}
              onClick={handleAvatarClick}
            >
              <div style={{ 
                width: "120px", height: "120px", borderRadius: "50%", 
                background: photo ? `url(${photo}) center/cover` : "var(--bg-primary)", display: "flex", 
                alignItems: "center", justifyContent: "center",
                border: "4px solid var(--bg-primary)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                overflow: "hidden"
              }}>
                {!photo && (
                  <span style={{ fontSize: "3rem", fontWeight: 900, color: "var(--wise-dark-green)" }}>
                    {user?.email?.charAt(0).toUpperCase() || "A"}
                  </span>
                )}
              </div>
              {/* Hover overlay for upload */}
              <div style={{
                position: "absolute",
                bottom: "5px",
                right: "5px",
                background: "var(--text-primary)",
                color: "var(--bg-primary)",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "3px solid var(--bg-primary)",
                opacity: isHoveringAvatar ? 1 : 0.85,
                transform: isHoveringAvatar ? "scale(1.1)" : "scale(1)",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
              }}>
                <Camera size={16} />
              </div>
            </div>

            {/* Photo Menu Popover */}
            {showPhotoMenu && photo && (
              <div style={{
                position: "absolute",
                top: "130px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                padding: "8px",
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                minWidth: "160px"
              }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowPhotoMenu(false); fileInputRef.current?.click(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px",
                    border: "none", background: "transparent", cursor: "pointer",
                    borderRadius: "8px", fontWeight: 600, fontSize: "0.85rem",
                    color: "var(--text-primary)", textAlign: "left", width: "100%"
                  }}
                >
                  <Camera size={16} /> Upload New
                </button>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setShowPhotoMenu(false); 
                    setPhoto(null); 
                    localStorage.removeItem("agent_photo"); 
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px",
                    border: "none", background: "transparent", cursor: "pointer",
                    borderRadius: "8px", fontWeight: 600, fontSize: "0.85rem",
                    color: "#e5484d", textAlign: "left", width: "100%"
                  }}
                >
                  <X size={16} /> Remove Photo
                </button>
              </div>
            )}
            
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: "none" }} 
              accept="image/*" 
              onChange={handlePhotoUpload} 
            />
          </div>
          <div style={{ paddingBottom: "10px" }}>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0", color: "var(--text-primary)" }}>
              {user?.email?.split('@')[0]}
            </h1>
            <span style={{ 
              background: "var(--bg-primary)", 
              color: "var(--wise-dark-green)",
              padding: "6px 14px", 
              borderRadius: "20px",
              fontSize: "0.85rem", 
              fontWeight: 800,
              marginTop: "8px", 
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              border: "1px solid var(--border-color)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)"
            }}>
              <CheckCircle size={14} />
              {user?.role === "kyc_team" ? "KYC Portal Reviewer" : (user?.role || "KYC Team Agent")}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: "32px", marginTop: "40px" }}>
        
        {/* Sidebar Navigation */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button 
            onClick={() => setActiveTab("overview")}
            style={{ 
              display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderRadius: "12px",
              background: activeTab === "overview" ? "var(--wise-green-light)" : "transparent",
              color: activeTab === "overview" ? "var(--wise-dark-green)" : "var(--text-secondary)",
              fontWeight: activeTab === "overview" ? 800 : 600,
              border: "none", cursor: "pointer", textAlign: "left", transition: "all 0.2s"
            }}>
            <User size={18} /> Overview
          </button>
          <button 
            onClick={() => setActiveTab("settings")}
            style={{ 
              display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderRadius: "12px",
              background: activeTab === "settings" ? "var(--wise-green-light)" : "transparent",
              color: activeTab === "settings" ? "var(--wise-dark-green)" : "var(--text-secondary)",
              fontWeight: activeTab === "settings" ? 800 : 600,
              border: "none", cursor: "pointer", textAlign: "left", transition: "all 0.2s"
            }}>
            <Settings size={18} /> Preferences
          </button>
          <button 
            onClick={() => setActiveTab("security")}
            style={{ 
              display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderRadius: "12px",
              background: activeTab === "security" ? "var(--wise-green-light)" : "transparent",
              color: activeTab === "security" ? "var(--wise-dark-green)" : "var(--text-secondary)",
              fontWeight: activeTab === "security" ? 800 : 600,
              border: "none", cursor: "pointer", textAlign: "left", transition: "all 0.2s"
            }}>
            <Lock size={18} /> Security
          </button>
        </div>

        {/* Content Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {activeTab === "overview" && (
            <div className="admin-animate" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* CRM Info card */}
              <div className="card" style={{ padding: "32px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, right: 0, padding: "8px 16px", background: "var(--wise-green-light)", color: "var(--wise-dark-green)", fontSize: "0.7rem", fontWeight: 800, borderBottomLeftRadius: "12px" }}>
                  SYNCED FROM CRM
                </div>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <User size={18} /> Account Information
                </h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "32px" }}>
                  <div>
                    <label className="inspection-label">Email Address</label>
                    <div style={{ fontWeight: 700, fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", color: "var(--text-primary)" }}>
                      <Mail size={18} color="var(--text-muted)" />
                      {user.email}
                    </div>
                  </div>
                  
                  <div>
                    <label className="inspection-label">Employee ID (CRM)</label>
                    <div style={{ fontWeight: 700, fontSize: "1.05rem", fontFamily: "monospace", marginTop: "8px", color: "var(--text-primary)" }}>
                      {user.id || "N/A"}
                    </div>
                  </div>
                </div>
              </div>


            </div>
          )}

          {activeTab === "settings" && (
            <div className="card admin-animate" style={{ padding: "32px" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "8px", color: "var(--text-primary)" }}>
                Local Preferences
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "32px" }}>
                These settings are saved locally to your browser and do not affect your CRM profile.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                
                {/* Notifications Section */}
                <div>
                  <h4 style={{ fontSize: "0.9rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", color: "var(--text-secondary)" }}>
                    <Bell size={18} /> Notifications
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingLeft: "26px" }}>
                    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Push Notifications</span>
                      <input type="checkbox" checked={settings.notifications} onChange={(e) => handleSettingChange('notifications', e.target.checked)} style={{ accentColor: "var(--wise-green)", width: "18px", height: "18px" }} />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Email Alerts for New KYC</span>
                      <input type="checkbox" checked={settings.emailAlerts} onChange={(e) => handleSettingChange('emailAlerts', e.target.checked)} style={{ accentColor: "var(--wise-green)", width: "18px", height: "18px" }} />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>SMS Alerts (Urgent Only)</span>
                      <input type="checkbox" checked={settings.smsAlerts} onChange={(e) => handleSettingChange('smsAlerts', e.target.checked)} style={{ accentColor: "var(--wise-green)", width: "18px", height: "18px" }} />
                    </label>
                  </div>
                </div>

                <hr style={{ border: "none", borderTop: "1px solid var(--border-color)" }} />

                {/* Regional Section */}
                <div>
                  <h4 style={{ fontSize: "0.9rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", color: "var(--text-secondary)" }}>
                    <Globe size={18} /> Regional & Display
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", paddingLeft: "26px" }}>
                    <div>
                      <label className="inspection-label" style={{ marginBottom: "8px", display: "block" }}>Language</label>
                      <select className="admin-select" value={settings.language} onChange={(e) => handleSettingChange('language', e.target.value)} style={{ width: "100%" }}>
                        <option value="en">English (UK)</option>
                        <option value="en-us">English (US)</option>
                        <option value="hi">Hindi</option>
                      </select>
                    </div>
                    <div>
                      <label className="inspection-label" style={{ marginBottom: "8px", display: "block" }}>Timezone</label>
                      <select className="admin-select" value={settings.timezone} onChange={(e) => handleSettingChange('timezone', e.target.value)} style={{ width: "100%" }}>
                        <option value="Asia/Kolkata">IST (Asia/Kolkata)</option>
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">EST (America/New_York)</option>
                      </select>
                    </div>
                  </div>
                </div>

              </div>
              
              <div style={{ marginTop: "40px", display: "flex", justifyContent: "flex-end" }}>
                <button style={{ 
                  display: "flex", alignItems: "center", gap: "8px", 
                  background: "var(--wise-green)", color: "var(--wise-dark-green)", 
                  border: "none", padding: "12px 24px", borderRadius: "10px", 
                  fontWeight: 800, cursor: "pointer", fontSize: "0.9rem",
                  boxShadow: "0 4px 14px rgba(159, 232, 112, 0.4)"
                }}>
                  <Save size={18} /> Save Preferences
                </button>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="card admin-animate" style={{ padding: "32px" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "8px", color: "var(--text-primary)" }}>
                Security Settings
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "32px" }}>
                Manage your device sessions and authentication methods. Password changes must be done via the main CRM.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px", border: "1px solid var(--border-color)", borderRadius: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ background: "var(--bg-secondary)", padding: "12px", borderRadius: "50%" }}>
                      <Smartphone size={24} color="var(--text-primary)" />
                    </div>
                    <div>
                      <h4 style={{ margin: "0 0 4px 0", fontWeight: 700, fontSize: "1rem" }}>Current Device</h4>
                      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.85rem" }}>Windows • Chrome • Active Now</p>
                    </div>
                  </div>
                  <span className="badge badge-verified">Active</span>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px", border: "1px solid var(--border-color)", borderRadius: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ background: "var(--bg-secondary)", padding: "12px", borderRadius: "50%" }}>
                      <Lock size={24} color="var(--text-primary)" />
                    </div>
                    <div>
                      <h4 style={{ margin: "0 0 4px 0", fontWeight: 700, fontSize: "1rem" }}>Two-Factor Authentication (2FA)</h4>
                      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.85rem" }}>Managed by CRM Identity Provider</p>
                    </div>
                  </div>
                  <button style={{ 
                    background: "transparent", color: "var(--text-muted)", 
                    border: "1px solid var(--border-color)", padding: "8px 16px", 
                    borderRadius: "8px", fontWeight: 700, cursor: "not-allowed", fontSize: "0.85rem" 
                  }} disabled>
                    Managed Externally
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
