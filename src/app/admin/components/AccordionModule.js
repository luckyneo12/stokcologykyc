import React, { useState } from "react";

export default function AccordionModule({ title, fields, onEdit }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border-color)",
      borderRadius: "12px",
      overflow: "hidden",
      marginBottom: "16px",
      boxShadow: "var(--card-shadow)"
    }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px",
          cursor: "pointer",
          background: "var(--bg-card)"
        }}
      >
        <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>
          {title}
        </h4>
        <svg 
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {isOpen && (
        <div style={{ padding: "0 20px 20px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {fields.map((field, idx) => (
            <div key={idx} style={{
              background: "var(--bg-secondary)",
              padding: "10px 14px",
              borderRadius: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1px solid rgba(0,0,0,0.05)"
            }}>
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                  {field.label}
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {field.value || "N/A"}
                </div>
              </div>
              {field.editable && (
                <button 
                  onClick={() => onEdit && onEdit(field)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
