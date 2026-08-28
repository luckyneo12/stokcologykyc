"use client";
import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from "react";

const CorrectionContext = createContext(null);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Step title mapping for display
const STEP_TITLE_MAP = {
  phoneVerification: "Phone Verification",
  emailVerification: "Email Verification",
  pricingSelection: "Pricing Plan",
  panVerification: "PAN Verification",
  digilocker: "DigiLocker",
  personalDetails: "Personal Details",
  nomineeChoice: "Nominee Choice",
  nomineeDetails: "Nominee Details",
  nomineeAllocation: "Nominee Allocation",
  bankVerification: "Bank Verification",
  financialProof: "Financial Proof",
  signature: "Signature",
  panUpload: "PAN Card Upload",
  ipv: "In-Person Verification (Selfie)",
  pepProof: "PEP Proof",
  nominee1Proof: "Nominee 1 Document",
  nominee2Proof: "Nominee 2 Document",
  nominee3Proof: "Nominee 3 Document",
  guardian1Proof: "Guardian 1 Document",
  guardian2Proof: "Guardian 2 Document",
  guardian3Proof: "Guardian 3 Document",
  esignPreview: "eSign Preview",
  aadhaarEsign: "Aadhaar eSign",
};

const initialState = {
  // Session
  token: null,
  sessionId: null,
  isLoading: true,
  error: null,
  isStaleSession: false,
  staleMessage: "",

  // Correction data
  correctionSession: null,     // Full session from server
  applicationData: {},         // Read-only snapshot of existing app data
  rejectedSteps: [],           // From correctionSession.rejectedSteps
  drafts: {},                  // Local draft edits

  // Navigation
  currentStepIndex: 0,         // Index into the corrected step flow
  allStepsComplete: false,

  // UI
  toasts: [],
  submitting: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload, isLoading: false };

    case "SESSION_LOADED": {
      const { correctionSession, applicationData, token, sessionId } = action.payload;
      const rejectedSteps = correctionSession.rejectedSteps || [];
      const allComplete = rejectedSteps.every(s => s.completed);
      return {
        ...state,
        isLoading: false,
        token,
        sessionId,
        correctionSession,
        applicationData,
        rejectedSteps,
        drafts: correctionSession.drafts || {},
        currentStepIndex: allComplete ? rejectedSteps.length : 0,
        allStepsComplete: allComplete,
      };
    }

    case "STALE_SESSION":
      return {
        ...state,
        isLoading: false,
        isStaleSession: true,
        staleMessage: action.payload,
      };

    case "SET_STEP_INDEX":
      return { ...state, currentStepIndex: action.payload };

    case "SAVE_DRAFT": {
      const { stepId, data } = action.payload;
      const newDrafts = { ...state.drafts, [stepId]: data };
      const newRejectedSteps = state.rejectedSteps.map(s =>
        s.stepId === stepId ? { ...s, completed: true } : s
      );
      const allComplete = newRejectedSteps.every(s => s.completed);
      return {
        ...state,
        drafts: newDrafts,
        rejectedSteps: newRejectedSteps,
        allStepsComplete: allComplete,
      };
    }

    case "SET_SUBMITTING":
      return { ...state, submitting: action.payload };

    case "ADD_TOAST":
      return {
        ...state,
        toasts: [...state.toasts, { id: action.payload.id || Date.now(), message: action.payload.message, type: action.payload.type || "success" }],
      };

    case "REMOVE_TOAST":
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };

    default:
      return state;
  }
}

export function CorrectionProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const initialized = useRef(false);

  // Extract token from URL on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (!token) {
      dispatch({ type: "SET_ERROR", payload: "No correction token found. Please use the link from your rejection email." });
      return;
    }

    // Decode JWT to get sessionId (base64 decode, no verification — server verifies)
    let decoded = {};
    try {
      const payloadPart = token.split(".")[1];
      decoded = JSON.parse(atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/")));
    } catch (e) {
      dispatch({ type: "SET_ERROR", payload: "Invalid correction token." });
      return;
    }

    if (!decoded.correctionMode) {
      dispatch({ type: "SET_ERROR", payload: "This link is not a correction link." });
      return;
    }

    // Store token for API calls
    sessionStorage.setItem("correctionToken", token);

    // Fetch correction session
    loadSession(token, decoded.sessionId);
  }, []);

  const loadSession = useCallback(async (token, jwtSessionId) => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const url = `${API_BASE_URL}/api/kyc/correction/session${jwtSessionId ? `?sessionId=${jwtSessionId}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!data.success) {
        dispatch({ type: "SET_ERROR", payload: data.error || "Failed to load correction session" });
        return;
      }

      if (data.staleSession) {
        dispatch({ type: "STALE_SESSION", payload: data.message });
        return;
      }

      dispatch({
        type: "SESSION_LOADED",
        payload: {
          correctionSession: data.correctionSession,
          applicationData: data.applicationData,
          token,
          sessionId: data.correctionSession.sessionId,
        },
      });
    } catch (error) {
      console.error("[CorrectionContext] Failed to load session:", error);
      dispatch({ type: "SET_ERROR", payload: "Network error. Please try again." });
    }
  }, []);

  const addToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random(); // Add random to ensure uniqueness if multiple called quickly
    dispatch({ type: "ADD_TOAST", payload: { id, message, type } });
    setTimeout(() => {
      dispatch({ type: "REMOVE_TOAST", payload: id });
    }, 4000);
  }, []);

  const saveDraft = useCallback(async (stepId, data) => {
    const token = sessionStorage.getItem("correctionToken");
    if (!token) {
      addToast("Session expired. Please use the link from your email.", "error");
      return false;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/kyc/correction/save-step`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stepId, data }),
      });
      const result = await res.json();

      if (!result.success) {
        addToast(result.error || "Failed to save correction", "error");
        return false;
      }

      dispatch({ type: "SAVE_DRAFT", payload: { stepId, data } });
      addToast(`${STEP_TITLE_MAP[stepId] || stepId} correction saved`);
      return true;
    } catch (error) {
      console.error("[CorrectionContext] Save draft error:", error);
      addToast("Network error. Please try again.", "error");
      return false;
    }
  }, [addToast]);

  const nextCorrectionStep = useCallback(() => {
    dispatch({ type: "SET_STEP_INDEX", payload: state.currentStepIndex + 1 });
  }, [state.currentStepIndex]);

  const prevCorrectionStep = useCallback(() => {
    if (state.currentStepIndex > 0) {
      dispatch({ type: "SET_STEP_INDEX", payload: state.currentStepIndex - 1 });
    }
  }, [state.currentStepIndex]);

  const goToCorrectionStep = useCallback((index) => {
    dispatch({ type: "SET_STEP_INDEX", payload: index });
  }, []);

  const submitCorrections = useCallback(async () => {
    const token = sessionStorage.getItem("correctionToken");
    if (!token) {
      addToast("Session expired. Please use the link from your email.", "error");
      return false;
    }

    dispatch({ type: "SET_SUBMITTING", payload: true });
    try {
      const res = await fetch(`${API_BASE_URL}/api/kyc/correction/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await res.json();

      if (!result.success) {
        addToast(result.error || "Failed to submit corrections", "error");
        dispatch({ type: "SET_SUBMITTING", payload: false });
        return false;
      }

      addToast("All corrections submitted successfully!");
      // Clean up
      sessionStorage.removeItem("correctionToken");
      dispatch({ type: "SET_SUBMITTING", payload: false });
      return true;
    } catch (error) {
      console.error("[CorrectionContext] Submit error:", error);
      addToast("Network error. Please try again.", "error");
      dispatch({ type: "SET_SUBMITTING", payload: false });
      return false;
    }
  }, [addToast]);

  const value = {
    ...state,
    addToast,
    saveDraft,
    nextCorrectionStep,
    prevCorrectionStep,
    goToCorrectionStep,
    submitCorrections,
    loadSession,
    stepTitleMap: STEP_TITLE_MAP,
  };

  return (
    <CorrectionContext.Provider value={value}>
      {children}
    </CorrectionContext.Provider>
  );
}

export function useCorrection() {
  const ctx = useContext(CorrectionContext);
  if (!ctx) throw new Error("useCorrection must be used within CorrectionProvider");
  return ctx;
}
