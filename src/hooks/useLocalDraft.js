"use client";

const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const getStorage = () => isMobile() ? localStorage : sessionStorage;


import { useState, useEffect } from "react";

export function useLocalDraft(key, initialValue) {
  const [state, setState] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const appId = getStorage().getItem("kycApplicationId") || localStorage.getItem("kycApplicationId") || "default";
        const saved = localStorage.getItem(`kyc-draft-${appId}-${key}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed;
        }
      } catch (e) {
        console.warn("Failed to read draft from localStorage:", e);
      }
    }
    return initialValue;
  });

  // Track changes to initialValue from the backend to overwrite stale local drafts
  const initialValueStr = JSON.stringify(initialValue);
  const [lastInitialStr, setLastInitialStr] = useState(initialValueStr);

  useEffect(() => {
    if (initialValueStr !== lastInitialStr) {
      setState(initialValue);
      setLastInitialStr(initialValueStr);
    }
  }, [initialValueStr, lastInitialStr, initialValue]);

  useEffect(() => {
    if (typeof window !== "undefined" && state !== undefined && state !== null) {
      try {
        const appId = getStorage().getItem("kycApplicationId") || localStorage.getItem("kycApplicationId") || "default";
        localStorage.setItem(`kyc-draft-${appId}-${key}`, JSON.stringify(state));
      } catch (e) {
        console.warn("Failed to save draft to localStorage:", e);
      }
    }
  }, [key, state]);

  const clearDraft = () => {
    if (typeof window !== "undefined") {
      try {
        const appId = getStorage().getItem("kycApplicationId") || localStorage.getItem("kycApplicationId") || "default";
        localStorage.removeItem(`kyc-draft-${appId}-${key}`);
      } catch (e) {
        console.warn("Failed to clear draft from localStorage:", e);
      }
    }
  };

  return [state, setState, clearDraft];
}
