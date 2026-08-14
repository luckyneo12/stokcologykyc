"use client";

import { useState, useEffect } from "react";

export function useLocalDraft(key, initialValue) {
  const [state, setState] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`kyc-draft-${key}`);
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

  useEffect(() => {
    if (typeof window !== "undefined" && state !== undefined && state !== null) {
      try {
        localStorage.setItem(`kyc-draft-${key}`, JSON.stringify(state));
      } catch (e) {
        console.warn("Failed to save draft to localStorage:", e);
      }
    }
  }, [key, state]);

  const clearDraft = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(`kyc-draft-${key}`);
      } catch (e) {
        console.warn("Failed to clear draft from localStorage:", e);
      }
    }
  };

  return [state, setState, clearDraft];
}
