"use client";
import { useState, useEffect, useRef } from "react";

export default function DateInput({ value, onChange, style, className, max }) {
  const [textValue, setTextValue] = useState("");
  const hiddenDateRef = useRef(null);

  useEffect(() => {
    if (value && typeof value === 'string' && value.includes("-")) {
      const parts = value.split("-");
      if (parts.length === 3) {
        const expected = `${parts[2]}/${parts[1]}/${parts[0]}`;
        if (textValue !== expected && textValue.replace(/\D/g, "") !== expected.replace(/\D/g, "")) {
          setTextValue(expected);
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
    const inputVal = e.target.value;
    let val = inputVal.replace(/\D/g, "");
    
    // Auto-pad day if first digit > 3
    if (val.length === 1 && parseInt(val[0], 10) > 3) {
      val = "0" + val;
    }
    
    // Auto-pad month if first digit of month > 1
    if (val.length === 3 && parseInt(val[2], 10) > 1) {
      val = val.slice(0, 2) + "0" + val[2];
    }
    
    if (val.length > 8) val = val.slice(0, 8);
    
    // Clamp limits
    if (val.length >= 2) {
      let dd = parseInt(val.slice(0, 2), 10);
      if (dd > 31) val = "31" + val.slice(2);
      if (dd === 0 && val.length >= 2) val = "01" + val.slice(2);
    }
    
    if (val.length >= 4) {
      let mm = parseInt(val.slice(2, 4), 10);
      if (mm > 12) val = val.slice(0, 2) + "12" + val.slice(4);
      if (mm === 0 && val.length >= 4) val = val.slice(0, 2) + "01" + val.slice(4);
    }

    let formatted = val;
    if (val.length >= 5) {
      formatted = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
    } else if (val.length >= 3) {
      formatted = `${val.slice(0, 2)}/${val.slice(2)}`;
    }
    
    setTextValue(formatted);

    if (val.length === 8) {
      const dd = val.slice(0, 2);
      const mm = val.slice(2, 4);
      const yyyy = val.slice(4);
      onChange({ target: { value: `${yyyy}-${mm}-${dd}` } });
    } else {
      // If the date is incomplete, ensure the parent's state is cleared 
      // so it doesn't hold onto an old, invalid date!
      onChange({ target: { value: "" } });
    }
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
