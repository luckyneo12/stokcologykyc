"use client";
import Logo from "../../../components/kyc/Logo";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { id: "overview", label: "Dashboard", icon: "grid" },
  { id: "maker_checker", label: "Maker / Checker", icon: "shield" },
  { id: "pending", label: "Pending", icon: "clock" },
  { id: "approved", label: "Approved", icon: "check" },
  { id: "rejected", label: "Rejected", icon: "x" }
];

const ICONS = {
  grid: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  shield: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  clock: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  check: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>,
  x: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

export default function GlobeSidebar({ active, onNavigate, collapsed, onToggle }) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("globeToken");
    localStorage.removeItem("globeUser");
    localStorage.removeItem("globeActiveSection");
    window.location.href = "/globe/login";
  };

  return (
    <div style={{
      width: collapsed ? "80px" : "280px",
      minWidth: collapsed ? "80px" : "280px",
      height: "100vh",
      background: "var(--bg-primary)",
      borderRight: "1px solid var(--border-color)",
      display: "flex",
      flexDirection: "column",
      transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      position: "relative",
      zIndex: 40,
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Collapse Toggle */}
      <button 
        onClick={onToggle}
        style={{
          position: "absolute",
          right: "-14px",
          top: "32px",
          width: "28px",
          height: "28px",
          background: "var(--bg-primary)",
          border: "1px solid var(--border-color)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "var(--text-muted)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          zIndex: 50,
          transition: "all 0.2s ease"
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.color = "var(--text-primary)";
          e.currentTarget.style.transform = "scale(1.1)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.color = "var(--text-muted)";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <svg 
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.3s ease" }}
        >
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>

      {/* Header */}
      <div style={{
        padding: collapsed ? "32px 0" : "32px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: "14px",
        borderBottom: "1px solid var(--border-color)",
        transition: "all 0.3s ease",
        minHeight: "100px",
        boxSizing: "border-box"
      }}>
        <div style={{ 
          width: "42px", height: "42px", flexShrink: 0,
          transition: "transform 0.3s ease",
          transform: collapsed ? "scale(1.1)" : "scale(1)"
        }}>
          <Logo width={42} height={42} />
        </div>
        {!collapsed && (
          <div style={{ overflow: "hidden", whiteSpace: "nowrap", opacity: 1, transition: "opacity 0.3s ease" }}>
            <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
              Globe Portal
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
              Maker / Checker
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "24px 16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "maker_checker") {
                  router.push("/globe/maker-checker");
                } else {
                  if (typeof onNavigate === 'function') onNavigate(item.id);
                  else router.push(`/globe`);
                }
              }}
              title={collapsed ? item.label : ""}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                width: "100%",
                padding: collapsed ? "14px 0" : "14px 16px",
                justifyContent: collapsed ? "center" : "flex-start",
                background: isActive ? "var(--wise-green)" : "transparent",
                color: isActive ? "var(--wise-dark-green)" : "var(--text-muted)",
                border: "none",
                borderRadius: "14px",
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                fontWeight: isActive ? 800 : 600,
                fontSize: "0.95rem",
                position: "relative",
                overflow: "hidden"
              }}
              onMouseOver={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "var(--bg-secondary)";
                  e.currentTarget.style.color = "var(--text-primary)";
                  e.currentTarget.style.transform = "translateX(4px)";
                }
              }}
              onMouseOut={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.transform = "translateX(0)";
                }
              }}
            >
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                transform: isActive ? "scale(1.1)" : "scale(1)",
                transition: "transform 0.2s ease"
              }}>
                {ICONS[item.icon]}
              </div>
              
              {!collapsed && (
                <span style={{ whiteSpace: "nowrap" }}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / Profile */}
      <div style={{
        padding: "24px 16px",
        borderTop: "1px solid var(--border-color)",
        background: "var(--bg-primary)"
      }}>
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : ""}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            width: "100%",
            padding: collapsed ? "14px 0" : "14px 16px",
            justifyContent: collapsed ? "center" : "flex-start",
            background: "rgba(229,72,77,0.05)",
            color: "#e5484d",
            border: "1px solid rgba(229,72,77,0.1)",
            borderRadius: "14px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            fontWeight: 700,
            fontSize: "0.9rem"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#e5484d";
            e.currentTarget.style.color = "#fff";
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 16px rgba(229,72,77,0.2)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "rgba(229,72,77,0.05)";
            e.currentTarget.style.color = "#e5484d";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );
}
