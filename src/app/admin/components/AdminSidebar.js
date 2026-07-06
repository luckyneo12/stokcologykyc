"use client";
import Logo from "../../../components/kyc/Logo";

import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { id: "overview", label: "Dashboard", icon: "grid" },
  { id: "maker_checker", label: "Maker / Checker", icon: "shield" },
  { id: "kyc", label: "KYC Requests", icon: "file" },
  { id: "audit", label: "Audit Logs", icon: "list" },
  { id: "estamps", label: "E-Stamps", icon: "doc" },
  { id: "pdf-builder", label: "PDF Builder", icon: "settings2" },
];

const ICONS = {
  grid: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  file: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  users: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  doc: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  camera: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  shield: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  settings2: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 0 4.93 19.07"/><path d="M4.93 4.93A10 10 0 0 1 19.07 19.07"/></svg>,
  bell: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  chart: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  lock: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  list: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  cog: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
};

export default function AdminSidebar({ active, onNavigate, collapsed, onToggle }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .sidebar-item {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sidebar-item:hover {
          background: rgba(159,232,112,0.08) !important;
          transform: translateX(4px);
        }
        .sidebar-item:active {
          transform: scale(0.97) translateX(4px);
        }
        .sidebar-item.active {
          background: rgba(159,232,112,0.15) !important;
          color: var(--wise-dark-green) !important;
        }
        .sidebar-item.active:hover {
          background: rgba(159,232,112,0.2) !important;
        }
        
        /* Dark theme specific overrides for active & hover sidebar items */
        [data-theme="dark"] .sidebar-item.active {
          background: var(--wise-green) !important;
          color: var(--wise-dark-green) !important;
        }
        [data-theme="dark"] .sidebar-item.active:hover {
          background: var(--wise-green) !important;
          color: var(--wise-dark-green) !important;
          opacity: 0.9;
        }
        [data-theme="dark"] .sidebar-item:hover {
          background: rgba(159,232,112,0.12) !important;
          color: var(--wise-green) !important;
        }
        .sidebar-toggle-btn:hover {
          background: var(--border-color) !important;
          border-color: var(--border-hover) !important;
        }
      `}} />
      <aside style={{
        width: collapsed ? 72 : 270,
      height: "100%",
      minHeight: "100%",
      background: "var(--bg-primary)",
      borderRight: "1px solid var(--border-color)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      flexShrink: 0,
      position: "sticky",
      top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 72 }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Logo width={100} height={30} />
          </div>
        )}
        <button 
          onClick={onToggle} 
          className="sidebar-toggle-btn"
          style={{ 
            width: 32, 
            height: 32, 
            borderRadius: 8, 
            border: "1px solid var(--border-color)", 
            background: "var(--bg-secondary)", 
            color: "var(--text-primary)",
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            cursor: "pointer", 
            flexShrink: 0,
            transition: "all 0.2s ease"
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {collapsed ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}
          </svg>
        </button>
      </div>

      {/* Nav Items */}
      <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto", position: "relative" }}>
        {/* Background Watermark for Sidebar - Centered */}
        {!collapsed && (
          <div style={{ 
            position: "absolute", 
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            opacity: 0.03, 
            pointerEvents: "none"
          }}>
            <Logo variant="bull" width={220} height={220} />
          </div>
        )}
        
        {NAV_ITEMS.map(item => {
          let isActive = active === item.id;
          if (pathname && pathname.includes("/admin/maker-checker") && item.id === "maker_checker") {
            isActive = true;
          }
          
          return (
            <button key={item.id} onClick={() => {
              if (item.id === "maker_checker") {
                router.push("/admin/maker-checker");
              } else {
                if (pathname !== "/admin") {
                  localStorage.setItem("adminActiveSection", item.id);
                  router.push("/admin");
                } else if (onNavigate) {
                  onNavigate(item.id);
                }
              }
            }}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              title={collapsed ? item.label : ""}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12,
                padding: collapsed ? "14px 0" : "14px 16px",
                borderRadius: 10, border: "none", cursor: "pointer",
                background: "transparent", // Handled by CSS class now
                color: isActive ? "var(--wise-dark-green)" : "var(--text-secondary)",
                fontWeight: isActive ? 600 : 500,
                fontSize: "1rem",
                marginBottom: 6,
                justifyContent: collapsed ? "center" : "flex-start",
                position: "relative",
                zIndex: 1,
              }}
            >
              <span style={{ flexShrink: 0, color: "currentColor" }}>{ICONS[item.icon]}</span>
              {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
              {!collapsed && item.badge && (
                <span style={{ marginLeft: "auto", background: "var(--wise-green)", color: "var(--wise-dark-green)", fontSize: "0.65rem", fontWeight: 900, padding: "2px 7px", borderRadius: 999 }}>
                  {item.badge}
                </span>
              )}
              {collapsed && item.badge && (
                <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, background: "#e5484d", borderRadius: "50%" }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom User */}
      {!collapsed && (
        <div style={{ padding: "16px", borderTop: "1px solid var(--border-color)", background: "var(--bg-primary)", position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--wise-green)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--wise-dark-green)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>Super Admin</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>admin@securekyc.in</div>
            </div>
          </div>
        </div>
      )}
    </aside>
    </>
  );
}
