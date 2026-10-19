"use client";
import Logo from "../../../components/kyc/Logo";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, ShieldCheck, Clock, CheckCircle2, XCircle, ChevronRight, Menu, LogOut } from "lucide-react";
import { logoutUser } from "@/utils/auth";

const NAV_ITEMS = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "maker_checker", label: "Maker / Checker", icon: ShieldCheck },
  { id: "pending", label: "Pending", icon: Clock },
  { id: "approved", label: "Approved", icon: CheckCircle2 },
  { id: "rejected", label: "Rejected", icon: XCircle }
];

// Same look as the admin portal's sidebar (soft UI); Globe's own menu and actions
export default function GlobeSidebar({ active, onNavigate, collapsed, onToggle }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    // Clears all portal tokens across both storages and redirects to the
    // Globe login. Server is notified (best-effort) to record the logout.
    logoutUser({ redirectPath: "/globe/login" });
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .sidebar-item {
          transition: color 0.2s ease, box-shadow 0.2s ease;
          border-radius: 12px !important;
          background: transparent !important;
        }
        .sidebar-item:hover {
          color: var(--text-primary) !important;
          box-shadow: var(--neu-raised-xs, none);
        }
        .sidebar-item.active {
          background: var(--neu-well, var(--bg-elevated)) !important;
          color: var(--neu-accent, var(--text-primary)) !important;
          font-weight: 600 !important;
          box-shadow: var(--neu-inset-sm, 0 1px 3px rgba(0,0,0,0.05)) !important;
        }
        .sidebar-item .lucide {
          color: var(--text-muted);
          transition: color 0.2s ease;
        }
        .sidebar-item:hover .lucide {
          color: var(--text-primary);
        }
        .sidebar-item.active .lucide {
          color: var(--neu-accent, var(--wise-green)) !important;
        }
        .sidebar-logout:hover {
          box-shadow: var(--neu-raised-xs, none);
        }
        .sidebar-toggle-btn {
          transition: box-shadow 0.2s ease, color 0.2s ease;
          box-shadow: var(--neu-raised-xs, none);
        }
        .sidebar-toggle-btn:hover {
          color: var(--text-primary) !important;
        }
        .sidebar-toggle-btn:active {
          box-shadow: var(--neu-inset-sm, none);
        }
      `}} />
      <aside style={{
        width: collapsed ? 72 : 220,
        height: "100vh",
        background: "var(--neu-base, var(--bg-primary))",
        boxShadow: "6px 0 16px -10px var(--neu-raise-lo, rgba(0,0,0,0.1))",
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      }}>
        {/* Logo Area */}
        <div style={{ padding: "18px 12px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {!collapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Logo width={44} height={44} />
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
                Globe Portal
              </div>
            </div>
          )}
          <button
            onClick={onToggle}
            className="sidebar-toggle-btn"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              border: "none",
              background: "var(--neu-base, transparent)",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              margin: collapsed ? "0 auto" : "0"
            }}
          >
            <Menu size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: "8px 12px", overflowY: "auto", position: "relative", display: "flex", flexDirection: "column", gap: 6 }}>
          {NAV_ITEMS.map(item => {
            let isActive = active === item.id;
            if (pathname && pathname.includes("/globe/maker-checker") && item.id === "maker_checker") {
              isActive = true;
            }
            const Icon = item.icon;

            return (
              <button key={item.id} onClick={() => {
                if (item.id === "maker_checker") {
                  // Opening the module always starts on the default list, not the last-used filter
                  window.location.href = "/globe/maker-checker?filter=verify";
                } else {
                  if (typeof onNavigate === 'function') onNavigate(item.id);
                  else router.push(`/globe`);
                }
              }}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                title={collapsed ? item.label : ""}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 11,
                  padding: collapsed ? "11px 0" : "9px 12px",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  fontWeight: 500,
                  fontSize: "0.83rem",
                  border: "none",
                  justifyContent: collapsed ? "center" : "flex-start",
                  position: "relative",
                  outline: "none"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={17} strokeWidth={2} />
                </div>
                {!collapsed && <span style={{ whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom User Area */}
        <div style={{ padding: "14px 12px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            onClick={handleLogout}
            className="sidebar-item sidebar-logout"
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 11,
              padding: collapsed ? "11px 0" : "9px 12px",
              cursor: "pointer",
              color: "#ef4444",
              fontWeight: 600,
              fontSize: "0.83rem",
              border: "none",
              justifyContent: collapsed ? "center" : "flex-start",
              outline: "none",
              background: "rgba(239, 68, 68, 0.05)"
            }}
            title={collapsed ? "Sign Out" : ""}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LogOut size={18} strokeWidth={2} />
            </div>
            {!collapsed && <span style={{ whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>Sign Out</span>}
          </button>

          {!collapsed ? (
            <div
              className="sidebar-item"
              style={{
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: "none",
                width: "100%",
                boxShadow: "var(--neu-inset-sm, none)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--neu-base, var(--bg-primary))", boxShadow: "var(--neu-raised-xs, none)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "var(--neu-accent, var(--wise-green))", fontSize: "0.72rem", fontWeight: 700 }}>GT</span>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.2px" }}>Globe Team</div>
                </div>
              </div>
              <ChevronRight size={16} className="lucide" />
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--neu-base, var(--bg-primary))", boxShadow: "var(--neu-raised-xs, none)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "var(--neu-accent, var(--wise-green))", fontSize: "0.8rem", fontWeight: 700 }}>GT</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
