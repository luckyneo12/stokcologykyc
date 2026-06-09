"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut, User, ShieldCheck, Home } from "lucide-react";

export default function AgentLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    setIsMounted(true);
    const token = localStorage.getItem("agent_token");
    const storedUser = localStorage.getItem("agent_user");

    if (!token && !pathname.includes("/login")) {
      router.push("/agent/login");
    } else if (storedUser && storedUser !== "undefined") {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse agent_user in layout", e);
      }
    }
  }, [pathname, router]);

  if (!isMounted) return null;

  if (pathname.includes("/login")) {
    return <>{children}</>;
  }

  const handleLogout = () => {
    localStorage.removeItem("agent_token");
    localStorage.removeItem("agent_user");
    router.push("/agent/login");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-secondary)", color: "var(--text-primary)" }}>
      {/* Sidebar */}
      <aside style={{ 
        width: "280px", 
        background: "var(--bg-primary)", 
        borderRight: "1px solid var(--border-color)", 
        display: "flex", 
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh"
      }}>
        {/* Brand Header */}
        <div style={{ padding: "24px", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ 
              width: "36px", height: "36px", borderRadius: "10px", 
              background: "rgba(159, 232, 112, 0.15)", display: "flex", 
              alignItems: "center", justifyContent: "center" 
            }}>
              <ShieldCheck style={{ width: "20px", height: "20px", color: "var(--wise-positive)" }} />
            </div>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 900, tracking: "wider", color: "var(--text-primary)" }}>KYC AGENT</h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Workspace Portal</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: "20px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <Link
            href="/agent"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 16px",
              borderRadius: "12px",
              fontSize: "0.95rem",
              fontWeight: 700,
              textDecoration: "none",
              transition: "all 0.2s ease",
              background: pathname === "/agent" ? "rgba(159, 232, 112, 0.15)" : "transparent",
              color: pathname === "/agent" ? "var(--wise-dark-green)" : "var(--text-secondary)"
            }}
          >
            <Home style={{ width: "18px", height: "18px" }} />
            KYC Requests
          </Link>
          <Link
            href="/agent/profile"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 16px",
              borderRadius: "12px",
              fontSize: "0.95rem",
              fontWeight: 700,
              textDecoration: "none",
              transition: "all 0.2s ease",
              background: pathname === "/agent/profile" ? "rgba(159, 232, 112, 0.15)" : "transparent",
              color: pathname === "/agent/profile" ? "var(--wise-dark-green)" : "var(--text-secondary)"
            }}
          >
            <User style={{ width: "18px", height: "18px" }} />
            My Profile
          </Link>
        </nav>

        {/* User profile / Logout footer */}
        <div style={{ padding: "16px", borderTop: "1px solid var(--border-color)" }}>
          <div style={{ 
            display: "flex", alignItems: "center", justifyBetween: "space-between", 
            padding: "12px", borderRadius: "16px", background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)", justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
              <div style={{ 
                width: "36px", height: "36px", borderRadius: "50%", 
                background: "rgba(159, 232, 112, 0.3)", display: "flex", 
                alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 900, color: "var(--wise-dark-green)" }}>
                  {user?.email?.charAt(0).toUpperCase() || "A"}
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.email || "Agent"}
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>KYC Reviewer</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: "none", border: "none", padding: "8px", borderRadius: "8px",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-muted)"
              }}
              title="Logout"
            >
              <LogOut style={{ width: "16px", height: "16px" }} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <header style={{ 
          height: "72px", 
          borderBottom: "1px solid var(--border-color)", 
          background: "var(--bg-primary)", 
          display: "flex", 
          alignItems: "center", 
          padding: "0 40px" 
        }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 800 }}>Agent Workspace</h1>
        </header>
        <div style={{ flex: 1, overflowY: "auto", padding: "40px" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
