"use client";
import { KYCProvider, useKYC } from "@/context/KYCContext";

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

export function Providers({ children }) {
  return (
    <KYCProvider>
      <ToastContainer />
      {children}
    </KYCProvider>
  );
}
