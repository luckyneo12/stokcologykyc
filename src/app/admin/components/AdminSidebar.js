"use client";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShieldCheck,
  FileText,
  ListOrdered,
  Stamp,
  FileCog,
  ChevronRight,
  Menu,
  Plug,
  Hash,
  UserPlus,
  LogOut,
  Trash2
} from "lucide-react";
import { logoutUser } from "@/utils/auth";
import Logo from "@/components/kyc/Logo";

const NAV_ITEMS = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "maker_checker", label: "Maker / Checker", icon: ShieldCheck },
  // { id: "kyc", label: "KYC Requests", icon: FileText },
  { id: "audit", label: "Audit Logs", icon: ListOrdered },
  { id: "estamps", label: "E-Stamps", icon: Stamp },
  { id: "boids", label: "BOID Management", icon: Hash },
  { id: "pdf-builder", label: "PDF Builder", icon: FileCog },
  { id: "api-integration", label: "API Integration", icon: Plug },
  { id: "ap-management", label: "AP Management", icon: UserPlus },
  { id: "trash", label: "Trash", icon: Trash2 },
];

export default function AdminSidebar({ active, onNavigate, collapsed, onToggle }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    // Logout clears every portal's tokens across both localStorage and
    // sessionStorage, then redirects to the admin login page. The server
    // receives the JWT and records an audit event.
    logoutUser({
      redirectPath: "/admin/login",
      // The admin portal has no KYC context to reset.
    });
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
          color: var(--wise-green) !important;
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
        zIndex: 5,
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
                Admin Portal
              </div>
            </div>
          )}
          <button
            onClick={onToggle}
            className="sidebar-toggle-btn"
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
            if (pathname && pathname.includes("/admin/maker-checker") && item.id === "maker_checker") {
              isActive = true;
            }
            const Icon = item.icon;

            return (
              <button key={item.id} onClick={() => {
                if (item.id === "maker_checker") {
                  // Opening the module always starts on the default list — not the filter a dashboard card
                  // opened last (that one is still remembered when coming back from an application)
                  window.location.href = "/admin/maker-checker?filter=in_progress";
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
                {!collapsed && item.badge && (
                  <span style={{ background: "var(--wise-green-alpha)", color: "var(--wise-green)", fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
                    {item.badge}
                  </span>
                )}
                {collapsed && item.badge && (
                  <span style={{ position: "absolute", top: 8, right: 8, width: 6, height: 6, background: "var(--wise-green)", borderRadius: "50%" }} />
                )}
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
            title={collapsed ? "Log Out" : ""}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LogOut size={18} strokeWidth={2} />
            </div>
            {!collapsed && <span style={{ whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>Log Out</span>}
          </button>

          {!collapsed ? (
            <div
              className="sidebar-item"
              style={{
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                border: "none",
                width: "100%",
                boxShadow: "var(--neu-inset-sm, none)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--neu-base, var(--bg-primary))", boxShadow: "var(--neu-raised-xs, none)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "var(--neu-accent, var(--wise-green))", fontSize: "0.72rem", fontWeight: 700 }}>SA</span>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.2px" }}>Super Admin</div>
                </div>
              </div>
              <ChevronRight size={16} className="lucide" />
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--neu-base, var(--bg-primary))", boxShadow: "var(--neu-raised-xs, none)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <span style={{ color: "var(--neu-accent, var(--wise-green))", fontSize: "0.8rem", fontWeight: 700 }}>SA</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
