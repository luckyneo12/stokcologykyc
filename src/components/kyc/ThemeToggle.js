"use client";
import { useKYC } from "@/context/KYCContext";

export default function ThemeToggle({ className, style }) {
  const { theme, toggleTheme } = useKYC();
  
  return (
    <button 
      className={`btn-ghost ${className}`} 
      onClick={toggleTheme} 
      title="Toggle theme"
      style={{ 
        width: 44, height: 44, borderRadius: "50%", 
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "1px solid var(--border-color)",
        background: "var(--bg-primary)",
        boxShadow: "var(--ring-shadow)",
        transition: "all 0.3s ease",
        padding: 0,
        ...style
      }}
    >
      <div style={{ margin: "auto" }}>
        {theme === "light" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-primary)" }}>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--wise-green)" }}>
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        )}
      </div>
    </button>
  );
}
