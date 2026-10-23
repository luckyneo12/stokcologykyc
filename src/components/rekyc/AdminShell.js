"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminApi, getAdminToken, setAdminToken } from "./adminApi";

const AdminContext = createContext(null);
export const useAdmin = () => useContext(AdminContext);

export const STATUS_LABELS = {
  in_progress: "In Progress",
  esigned: "eSigned",
  to_be_verified: "To Be Verified",
  completed: "Completed",
  rejected: "Rejected",
  trashed: "Trash",
};

const ic = (d) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const NavIcons = {
  dashboard: ic(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  checker: ic(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></>),
  stamp: ic(<><path d="M9 4h6l-1 7h-4L9 4z" /><path d="M5 15h14v3H5zM4 21h16" /></>),
  users: ic(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c.6-3.4 3-5 6-5s5.4 1.6 6 5" /><circle cx="17.5" cy="9" r="2.4" /><path d="M16 14.2c2.4-.2 4.4 1.2 5 4.3" /></>),
  audit: ic(<><path d="M8 3h8l4 4v14H4V3h4z" /><path d="M8 11h8M8 15h8M8 7h4" /></>),
  account: ic(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4.4 4.2-6.5 8-6.5s7 2.1 8 6.5" /></>),
};

export default function AdminShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [counts, setCounts] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = useCallback((message, type = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  const can = useCallback((permission) => Boolean(user?.permissions?.includes(permission)), [user]);

  const refreshCounts = useCallback(async () => {
    try {
      const data = await adminApi("/stats");
      setCounts(data.counts);
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!getAdminToken()) {
      router.replace("/rekyc-admin/login");
      return;
    }
    adminApi("/auth/me")
      .then((d) => setUser(d.user))
      .catch((e) => setLoadError(e.message));
  }, [router]);

  useEffect(() => {
    if (user?.permissions?.includes("dashboard.view")) refreshCounts();
  }, [user, refreshCounts, pathname]);

  useEffect(() => setMenuOpen(false), [pathname]);

  const logout = () => {
    setAdminToken(null);
    router.replace("/rekyc-admin/login");
  };

  if (!user) {
    return (
      <div className="ra-login" style={{ color: "var(--ra-primary)" }}>
        {loadError ? (
          <div className="ra-login-card">
            <div className="ra-alert ra-alert-error">{loadError}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="ra-btn" onClick={() => window.location.reload()}>Retry</button>
              <button className="ra-btn ra-btn-ghost" onClick={logout}>Back to login</button>
            </div>
          </div>
        ) : (
          <span className="ra-spinner" />
        )}
      </div>
    );
  }

  const queue = [
    { href: "/rekyc-admin/queue/in-progress", label: "In Progress", count: counts?.in_progress },
    { href: "/rekyc-admin/queue/verify", label: "Verify", count: (counts?.esigned || 0) + (counts?.to_be_verified || 0) },
    { href: "/rekyc-admin/queue/completed", label: "Completed", count: counts?.completed },
    { href: "/rekyc-admin/queue/rejected", label: "Rejected", count: counts?.rejected },
    ...(can("request.trash") ? [{ href: "/rekyc-admin/queue/trash", label: "Trash", count: counts?.trashed }] : []),
  ];
  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <AdminContext.Provider value={{ user, can, notify, counts, refreshCounts }}>
      <div className="ra-shell">
        <aside className={`ra-side${menuOpen ? " open" : ""}`}>
          <Link href="/rekyc-admin/dashboard" className="ra-side-logo"><img src="/stklogo.png" alt="Stockology" /></Link>
          <nav className="ra-nav" aria-label="ReKYC admin">
            {can("dashboard.view") && <Link href="/rekyc-admin/dashboard" className={isActive("/rekyc-admin/dashboard") ? "active" : ""}>{NavIcons.dashboard} Dashboard</Link>}
            {can("request.view") && (
              <>
                <div className="ra-nav-group" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", color: "var(--ra-primary)", fontWeight: 600 }}>
                  {NavIcons.checker} Maker &amp; Checker
                </div>
                <div className="ra-sub">
                  {queue.map((q) => (
                    <Link key={q.href} href={q.href} className={isActive(q.href) ? "active" : ""}>
                      {q.label}
                      {q.count ? <span className="ra-count">{q.count}</span> : null}
                    </Link>
                  ))}
                </div>
              </>
            )}
            {can("estamp.manage") && <Link href="/rekyc-admin/estamps" className={isActive("/rekyc-admin/estamps") ? "active" : ""}>{NavIcons.stamp} Stamp Paper</Link>}
            {can("user.manage") && <Link href="/rekyc-admin/users" className={isActive("/rekyc-admin/users") ? "active" : ""}>{NavIcons.users} Users &amp; Roles</Link>}
            {can("audit.view") && <Link href="/rekyc-admin/audit" className={isActive("/rekyc-admin/audit") ? "active" : ""}>{NavIcons.audit} Audit Log</Link>}
            <Link href="/rekyc-admin/account" className={isActive("/rekyc-admin/account") ? "active" : ""}>{NavIcons.account} My Account</Link>
          </nav>
        </aside>
        <div style={{ minWidth: 0 }}>
          <header className="ra-top">
            <button className="ra-btn ra-btn-ghost ra-btn-sm ra-menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">☰</button>
            <span className="ra-hint">STOCKOLOGY SECURITIES PRIVATE LIMITED · ReKYC</span>
            <div className="ra-user">
              <div className="ra-avatar">{user.name?.charAt(0)?.toUpperCase()}</div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontWeight: 700 }}>{user.name}</div>
                <div className="ra-hint">{user.roleLabel}</div>
              </div>
            </div>
            <button className="ra-btn ra-btn-outline ra-btn-sm" onClick={logout}>Logout</button>
          </header>
          <main className="ra-page">{children}</main>
        </div>
      </div>
      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.25)" }} />}
      {toast && <div className={`ra-toast ra-toast-${toast.type}`} role="status">{toast.message}</div>}
    </AdminContext.Provider>
  );
}

export function AdminModal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="ra-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="ra-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ra-modal-head">
          <h3>{title}</h3>
          <button className="ra-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="ra-modal-body">{children}</div>
        {footer && <div className="ra-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
