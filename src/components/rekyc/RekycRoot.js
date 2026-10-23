"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// Wraps every ReKYC client page: colour theme, text size and toasts. Preferences are per browser.
const RootContext = createContext(null);
const THEMES = ["light", "dark", "yellow", "blue", "orange"];
const FONTS = ["small", "normal", "large"];

function readPref(key, allowed, fallback) {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value) ? value : fallback;
  } catch (e) {
    return fallback;
  }
}

function writePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
}

export function useRekyc() {
  return useContext(RootContext);
}

export default function RekycRoot({ children }) {
  const [theme, setThemeState] = useState("light");
  const [font, setFontState] = useState("normal");
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    setThemeState(readPref("rekyc-theme", THEMES, "light"));
    setFontState(readPref("rekyc-font", FONTS, "normal"));
  }, []);

  const setTheme = useCallback((value) => {
    setThemeState(value);
    writePref("rekyc-theme", value);
  }, []);

  const setFont = useCallback((value) => {
    setFontState(value);
    writePref("rekyc-font", value);
  }, []);

  const notify = useCallback((message, type = "success") => {
    clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  return (
    <RootContext.Provider value={{ theme, setTheme, font, setFont, notify }}>
      <div className="rk-root" data-rk-theme={theme} data-rk-font={font}>
        {children}
        {toast && (
          <div className={`rk-toast rk-toast-${toast.type}`} role="status" aria-live="polite">
            {toast.message}
          </div>
        )}
      </div>
    </RootContext.Provider>
  );
}
