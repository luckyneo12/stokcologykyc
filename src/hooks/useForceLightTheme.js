"use client";
import { useLayoutEffect } from "react";

// Sign-in pages are always light. The portal's saved theme (storageKey) comes back when the page is left.
export function useForceLightTheme(storageKey) {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
    return () => {
      let saved = null;
      try { saved = localStorage.getItem(storageKey); } catch (e) {}
      document.documentElement.setAttribute("data-theme", saved === "dark" ? "dark" : "light");
    };
  }, [storageKey]);
}
