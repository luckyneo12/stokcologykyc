"use client";
import { useState, useEffect } from "react";

export default function AdminThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const isDark = localStorage.getItem("adminTheme") === "dark" || document.documentElement.getAttribute("data-theme") === "dark";
    setDark(isDark);
    if (isDark) document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("adminTheme", next ? "dark" : "light");
  };

  return (
    <button onClick={toggle} title="Toggle theme" style={{
      width: 40, height: 40, borderRadius: "12px",
      display: "flex", alignItems: "center", justifyContent: "center",
      border: "1px solid var(--border-color)", background: "var(--bg-primary)",
      cursor: "pointer", transition: "all 0.2s ease", color: "var(--text-primary)"
    }}>
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--wise-green)" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      )}
    </button>
  );
}
