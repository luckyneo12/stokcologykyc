"use client";
import { KYCProvider, useKYC } from "@/context/KYCContext";
import { useEffect } from "react";

function ToastContainer() {
  const { toasts } = useKYC();
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type} flex items-center gap-sm`}>
          {t.type === "success" && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--wise-positive)" }}><polyline points="20 6 9 17 4 12"/></svg>
          )}
          {t.type === "error" && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--wise-danger)" }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}
import { usePathname } from "next/navigation";

function AntiInspect() {
  const { addToast } = useKYC();
  const pathname = usePathname();

  useEffect(() => {
    // Disable anti-inspect on the admin portal
    if (pathname && pathname.startsWith('/admin')) {
      return;
    }

    const showWarning = () => {
      addToast("Ah being smart! We have an eye on you!!", "error");
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
      showWarning();
    };

    const handleKeyDown = (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        (e.ctrlKey && ['U', 'u'].includes(e.key))
      ) {
        e.preventDefault();
        showWarning();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [addToast, pathname]);

  return null;
}

export function Providers({ children }) {
  return (
    <KYCProvider>
      <ToastContainer />
      <AntiInspect />
      {children}
    </KYCProvider>
  );
}
