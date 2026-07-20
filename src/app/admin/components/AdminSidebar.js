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
  Menu
} from "lucide-react";

const NAV_ITEMS = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "maker_checker", label: "Maker / Checker", icon: ShieldCheck },
  // { id: "kyc", label: "KYC Requests", icon: FileText },
  { id: "audit", label: "Audit Logs", icon: ListOrdered },
  { id: "estamps", label: "E-Stamps", icon: Stamp },
  { id: "pdf-builder", label: "PDF Builder", icon: FileCog },
];

export default function AdminSidebar({ active, onNavigate, collapsed, onToggle }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .sidebar-item {
          transition: all 0.2s ease;
          border-radius: 8px !important;
          background: transparent !important;
        }
        .sidebar-item:hover {
          background: var(--bg-card) !important;
          color: var(--text-primary) !important;
        }
        .sidebar-item.active {
          background: var(--bg-elevated) !important;
          color: var(--text-primary) !important;
          font-weight: 600 !important;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .sidebar-item .lucide {
          color: var(--text-muted);
          transition: color 0.2s ease;
        }
        .sidebar-item:hover .lucide {
          color: var(--text-primary);
        }
        .sidebar-item.active .lucide {
          color: var(--text-primary) !important;
        }
        .sidebar-toggle-btn {
          transition: all 0.2s ease;
        }
        .sidebar-toggle-btn:hover {
          background: var(--bg-elevated) !important;
          color: var(--text-primary) !important;
        }
      `}} />
      <aside style={{
        width: collapsed ? 68 : 260,
        height: "100vh",
        background: "var(--bg-primary)",
        borderRight: "1px solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      }}>
        {/* Logo Area */}
        <div style={{ padding: "24px 20px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {!collapsed && (
            <div style={{ fontSize: "1.15rem", fontWeight: 750, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
              Admin Portal
            </div>
          )}
          <button 
            onClick={onToggle} 
            className="sidebar-toggle-btn"
            style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 6, 
              border: "1px solid transparent", 
              background: "transparent", 
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
        <nav style={{ flex: 1, padding: "8px 12px", overflowY: "auto", position: "relative", display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map(item => {
            let isActive = active === item.id;
            if (pathname && pathname.includes("/admin/maker-checker") && item.id === "maker_checker") {
              isActive = true;
            }
            const Icon = item.icon;
            
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
                  padding: collapsed ? "12px 0" : "10px 14px",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  fontWeight: 500,
                  fontSize: "0.85rem",
                  border: "1px solid transparent",
                  justifyContent: collapsed ? "center" : "flex-start",
                  position: "relative",
                  outline: "none"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={18} strokeWidth={2} />
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
        <div style={{ padding: "16px 12px" }}>
          {!collapsed ? (
            <div 
              className="sidebar-item"
              style={{ 
                padding: "10px 12px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between",
                cursor: "pointer",
                border: "1px solid transparent",
                width: "100%"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "var(--bg-primary)", fontSize: "0.75rem", fontWeight: 800 }}>SA</span>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.2px" }}>Super Admin</div>
                </div>
              </div>
              <ChevronRight size={16} className="lucide" />
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <span style={{ color: "var(--bg-primary)", fontSize: "0.85rem", fontWeight: 800 }}>SA</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
