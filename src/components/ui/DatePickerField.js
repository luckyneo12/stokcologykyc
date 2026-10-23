"use client";
import { useState, useRef } from "react";
import CalendarPopover, { isoToDisplay } from "./CalendarPopover";

/**
 * Click-to-open date field (no typing) for filters. `onChange` receives the "YYYY-MM-DD" string
 * ("" when cleared).
 */
export default function DatePickerField({ value, onChange, min, max, placeholder = "DD/MM/YYYY", style, iconColor = "var(--text-muted)" }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          width: "100%", padding: "8px", borderRadius: 6, border: "1px solid var(--border-color)",
          background: "var(--bg-primary)", fontSize: "0.85rem", cursor: "pointer", textAlign: "left",
          color: value ? "var(--text-primary)" : "var(--text-muted)",
          ...style
        }}
      >
        <span>{value ? isoToDisplay(value) : placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
      </button>
      {open && (
        <CalendarPopover
          anchorRef={anchorRef}
          value={value}
          min={min}
          max={max}
          onSelect={onChange}
          onClear={() => onChange("")}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
