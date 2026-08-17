"use client";
import { useState, useEffect, useRef } from "react";

export default function DateInput({ value, onChange, style, className, max }) {
  const [textValue, setTextValue] = useState("");
  const hiddenDateRef = useRef(null);

  useEffect(() => {
    if (value && typeof value === 'string' && value.includes("-")) {
      const parts = value.split("-");
      if (parts.length === 3) {
        const [y, m, d] = parts;
        
        // Safely check if current textValue functionally matches the prop value
        // to prevent aggressively overriding the user's typing (e.g. overriding "1/9/2000" with "01/09/2000")
        const currentParts = textValue.split("/");
        const cd = (currentParts[0] || "").padStart(2, "0");
        const cm = (currentParts[1] || "").padStart(2, "0");
        const cy = currentParts[2] || "";
        
        if (`${cy}-${cm}-${cd}` !== value) {
          setTextValue(`${d}/${m}/${y}`);
        }
      }
    } else if (!value) {
      // Only clear the text box if it currently holds a FULL date but the parent is empty
      // This prevents wiping the user's typing when they are halfway through entering a date
      if (textValue.replace(/\D/g, "").length === 8) {
        setTextValue("");
      }
    }
  }, [value]);

  const handleTextChange = (e) => {
    const input = e.target;
    let cursor = input.selectionStart;
    const inputVal = input.value;
    
    // Split by slashes to respect boundaries and prevent digits from "shifting" across sections
    let parts = inputVal.split("/");
    let day = (parts[0] || "").replace(/\D/g, "");
    let month = (parts[1] || "").replace(/\D/g, "");
    let year = (parts[2] || "").replace(/\D/g, "");

    // Handle overflow (e.g. if they paste or delete a slash)
    if (day.length > 2) {
      month = day.slice(2) + month;
      day = day.slice(0, 2);
    }
    if (month.length > 2) {
      year = month.slice(2) + year;
      month = month.slice(0, 2);
    }
    if (year.length > 4) {
      year = year.slice(0, 4);
    }

    // Auto-pad day if first digit > 3
    if (day.length === 1 && parseInt(day, 10) > 3) {
      day = "0" + day;
    }
    // Auto-pad month if first digit of month > 1
    if (month.length === 1 && parseInt(month, 10) > 1) {
      month = "0" + month;
    }
    
    // Clamp limits
    if (day.length === 2) {
      let dd = parseInt(day, 10);
      if (dd > 31) day = "31";
      if (dd === 0) day = "01";
    }
    if (month.length === 2) {
      let mm = parseInt(month, 10);
      if (mm > 12) month = "12";
      if (mm === 0) month = "01";
    }

    let formatted = day;
    if (month.length > 0 || parts.length > 1) {
      formatted += "/" + month;
    }
    if (year.length > 0 || parts.length > 2) {
      formatted += "/" + year;
    }
    
    // If the user is typing at the very end of the string, always push the cursor to the very end of the new formatted string.
    // This perfectly handles auto-padding zeros and auto-inserted slashes!
    let newCursor = cursor;
    if (cursor === inputVal.length) {
      newCursor = formatted.length;
    }

    setTextValue(formatted);

    if (day.length > 0 && month.length > 0 && year.length === 4) {
      const dd = day.padStart(2, "0");
      const mm = month.padStart(2, "0");
      onChange({ target: { value: `${year}-${mm}-${dd}` } });
    } else {
      // If the date is incomplete, ensure the parent's state is cleared 
      onChange({ target: { value: "" } });
    }

    // Restore cursor position asynchronously after React finishes rendering the new formatted value
    window.requestAnimationFrame(() => {
      if (input) {
        input.setSelectionRange(newCursor, newCursor);
      }
    });
  };

  const handleDateSelect = (e) => {
    const dateStr = e.target.value; 
    if (dateStr) {
      onChange({ target: { value: dateStr } });
      const parts = dateStr.split("-");
      setTextValue(`${parts[2]}/${parts[1]}/${parts[0]}`);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        placeholder="DD/MM/YYYY"
        className={className}
        style={{
          ...style,
          color: !textValue ? "var(--text-muted)" : "var(--text-primary)",
          width: "100%",
          paddingRight: "40px"
        }}
        value={textValue}
        onChange={handleTextChange}
        maxLength={10}
      />
      
      <input 
        ref={hiddenDateRef}
        type="date"
        max={max}
        onChange={handleDateSelect}
        value={value || ""}
        style={{
           position: 'absolute',
           width: 1,
           height: 1,
           opacity: 0,
           padding: 0,
           margin: 0,
           border: 'none',
           zIndex: -1
        }}
        tabIndex="-1"
      />

      <div 
        onClick={() => {
          if (hiddenDateRef.current && hiddenDateRef.current.showPicker) {
            hiddenDateRef.current.showPicker();
          }
        }}
        style={{ 
          position: "absolute", 
          right: 16, 
          top: "50%", 
          transform: "translateY(-50%)", 
          cursor: "pointer", 
          color: "var(--text-muted)", 
          zIndex: 2,
          background: "var(--input-bg)",
          display: "flex",
          alignItems: "center"
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
    </div>
  );
}
