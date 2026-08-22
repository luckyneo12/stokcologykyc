"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { saveKycStep } from "@/utils/kycApi";
import { io } from "socket.io-client";

const KYCContext = createContext(null);

const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const getStorage = () => isMobile() ? localStorage : sessionStorage;


const INITIAL_STATE = {
  currentStep: 1,
  applicationId: "",
  isRestoring: true,
  phone: "",
  otpVerified: false,
  emailVerified: false,
  panVerified: false,
  personalDetails: {
    prefix: "",
    fatherName: "",
    motherName: "",
    gender: "",
    maritalStatus: "",
    education: "",
    annualIncome: "",
    experience: "",
    politicallyExposed: "No",
    pepType: "",
    pepComments: "",
    pepProofPreview: null,
    occupation: "",
    isIndianCitizen: "Yes",
    taxResidencyOutside: "No",
    countryOfBirth: "",
    citizenship: "",
    taxResidence1: "",
    taxId1: "",
    taxResidence2: "",
    taxId2: "",
    taxResidence3: "",
    taxId3: "",
    placeOfBirth: "",
    taxExempt: "No",
    taxExemptReason: "",
    ddpi: "Yes",
    transferSecurities: true,
    pledgeSecurities: true,
    mfTransactions: true,
    tenderingShares: true,
    dis: "No",
    receiveCredits: "Yes",
    eStatement: "Yes",
    acceptPledgeInstructions: "No",
    receiveAnnualReports: "Yes",
    settlement: "Quarterly",
    smsAlert: "Yes",
    operatedThroughDDPI: "Yes",
    dob: "",
    fullName: "",
    email: "",
  },
  identityMethod: "",
  identityDetails: { pan: "", aadhaar: "", passportNo: "", dlNo: "" },
  documents: { front: null, back: null, frontPreview: null, backPreview: null },
  ocrData: { name: "", dob: "", idNumber: "", extractedAt: null },
  selfie: { image: null, preview: null, livenessPass: false, matchScore: 0 },
  address: {
    line1: "",
    line2: "",
    line3: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    useAadhaar: false,
  },
  addressProof: null,
  bankDetails: {
    accountNumber: "",
    bankName: "",
    ifsc: "",
    micr: "",
    accountType: "10",
  },
  financialProof: { type: "", filePreview: null },
  signature: { filePreview: null },
  panUpload: { filePreview: null },
  nomineeDetails: {
    opted: "Yes",
    numberOfNominees: "1",
    nominees: [
      {
        name: "",
        email: "",
        mobile: "",
        relation: "",
        dob: "",
        sameAddress: false,
        address: "",
        city: "",
        state: "",
        pincode: "",
        country: "India",
        proofType: "PAN CARD",
        proofNumber: "",
      },
    ],
  },
  nomineeAllocation: { percentages: [100] },
  consent: false,
  bsda: "opt-in",
  segments: { equity: true, derivatives: false },
  status: null, // null | 'pending' | 'under_review' | 'verified' | 'rejected'
  rejectionReason: "",
  submittedAt: null,
  nsdlResponse: null,
  stepStatuses: {}, // { [reviewStepId]: { status, reason, ... } }
  generatedPdfBase64: null,
  verifiedSteps: {}, // { [stepIndex]: { fingerprint: string } } — tracks verified API steps to skip on re-navigation
  rejectionMode: false, // true when user accessed via rejection email magic link
  rejectedStepsList: [], // list of rejected steps with { stepId, type, reason }
  correctionDraft: null, // Stores draft values for rejected steps
};

function decodeJwtPayload(token) {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

const STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "phone", label: "Phone" },
  { id: "email", label: "Email" },
  { id: "pricing", label: "Pricing" },
  { id: "pan", label: "PAN" },
  { id: "digilocker", label: "DigiLocker" },
  { id: "details", label: "Details" },
  { id: "nomineeChoice", label: "Nominee Choice" },
  { id: "nominee", label: "Nominee" },
  { id: "nomineeAllocation", label: "Allocation" },
  { id: "bankVerification", label: "Bank Verification" },
  { id: "documentUpload", label: "Document Upload" },
  { id: "esignPreview", label: "eSign Preview" },
  { id: "aadhaarEsign", label: "Aadhaar eSign" },
  { id: "finalCompletion", label: "Completion" },
];

// Maps agent review step IDs → KYC user step indexes
// Some review steps map to the same KYC step (e.g. financialProof, signature, panUpload → documentUpload=11)
const REVIEW_STEP_TO_KYC_INDEX = {
  phoneVerification: 1,
  emailVerification: 2,
  pricingSelection: 3,
  panVerification: 4,
  digilocker: 5,
  personalDetails: 6,
  nomineeChoice: 7,
  nomineeDetails: 8,
  nomineeAllocation: 9,
  bankVerification: 10,
  financialProof: 11,
  signature: 11,
  panUpload: 11,
  ipv: 11,
  esignPreview: 12,
  aadhaarEsign: 13,
  completion: 14,
};

/**
 * Returns true if a KYC step index is "approved" (i.e. all review steps
 * that map to this KYC step have been approved).
 * A step is NOT considered approved if ANY review step mapping to it is rejected or missing.
 * Steps 12+ (eSign/completion) are NEVER skipped — they must always be redone after modifications.
 */
function isKycStepApproved(kycStepIndex, stepStatuses, isResubmission) {
  if (!stepStatuses || Object.keys(stepStatuses).length === 0) return false;
  // eSign preview and beyond must always be revisited
  if (kycStepIndex >= 12) return false;

  const reviewStepsForIndex = Object.entries(REVIEW_STEP_TO_KYC_INDEX)
    .filter(([, idx]) => idx === kycStepIndex)
    .map(([reviewId]) => reviewId);

  if (reviewStepsForIndex.length === 0) return false;

  if (isResubmission) {
    // If resubmitting, we skip everything UNLESS it is explicitly rejected.
    const hasRejection = reviewStepsForIndex.some(
      (reviewId) => stepStatuses[reviewId]?.status === "rejected",
    );
    return !hasRejection;
  } else {
    // Normal flow: only skip if explicitly approved
    return reviewStepsForIndex.every(
      (reviewId) => stepStatuses[reviewId]?.status === "approved",
    );
  }
}

const STEP_RELEVANT_KEYS = {
  welcome: ["status"],
  phone: ["status"],
  email: ["status", "personalDetails"],
  pricing: ["segments", "bsda"],
  pan: [
    "identityMethod",
    "identityDetails",
    "ocrData",
    "panVerified",
    "personalDetails",
  ],
  digilocker: ["address", "personalDetails", "identityDetails"],
  details: ["personalDetails"],
  nomineeChoice: ["nomineeDetails"],
  nominee: ["nomineeDetails"],
  nomineeAllocation: ["nomineeAllocation"],
  bankVerification: ["bankDetails"],
  documentUpload: ["financialProof", "signature", "panUpload", "selfieDetails", "bankDetails"],
  esignPreview: ["generatedPdfBase64"],
  aadhaarEsign: [
    "status",
    "submittedAt",
    "nsdlResponse",
    "consent",
    "personalDetails",
    "identityMethod",
    "identityDetails",
    "ocrData",
    "address",
    "bankDetails",
    "segments",
    "bsda",
    "nomineeDetails",
    "nomineeAllocation",
    "panUpload",
    "signature",
    "financialProof",
    "selfieDetails",
  ],
};

/**
 * Fingerprint functions for API-verified steps.
 * If a step has a fingerprint function, it means the step uses an external API for verification.
 * When moving forward, if the computed fingerprint matches the stored one, the step is auto-skipped.
 * Returning null/falsy means "not yet verified" → never skip.
 */
const VERIFICATION_FINGERPRINTS = {
  // Step 4: PAN Verification — fingerprint is PAN + Name + DOB
  4: (state) => {
    if (!state.panVerified) return null;
    return `${state.identityDetails?.pan || ""}|${state.personalDetails?.fullName || ""}|${state.personalDetails?.dob || ""}`;
  },
  // Step 5: DigiLocker — fingerprint is the aadhaar number (set after successful DigiLocker flow)
  5: (state) => {
    if (!state.identityDetails?.aadhaar) return null;
    return `aadhaar:${state.identityDetails.aadhaar}`;
  },
  // Step 10: Bank Verification — fingerprint is account number + IFSC (only if penny-drop succeeded)
  10: (state) => {
    if (!state.bankDetails?.accountHolderName) return null;
    return `${state.bankDetails.accountNumber || ""}|${state.bankDetails.ifsc || ""}`;
  },
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export function KYCProvider({ children }) {
  const [state, setState] = useState(INITIAL_STATE);

    if (typeof window !== "undefined" && isMobile()) {
      const sessionStart = localStorage.getItem("mobileSessionStart");
      const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
      if (sessionStart && (Date.now() - parseInt(sessionStart)) > ONE_DAY_IN_MS) {
        localStorage.clear();
      } else if (!sessionStart) {
        localStorage.setItem("mobileSessionStart", Date.now().toString());
      }
    }

  const [theme, setTheme] = useState("light");
  const [toasts, setToasts] = useState([]);
  const [preGeneratedPdf, setPreGeneratedPdf] = useState(null);

  const preGeneratePdf = useCallback(async (currentState = state) => {
    try {
      const token = typeof window !== "undefined" ? (getStorage().getItem("kycToken") || getStorage().getItem("adminToken") || localStorage.getItem("token")) : "";
      
      const res = await fetch(`${API_BASE_URL}/api/kyc/preview-pdf`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(currentState)
      });
      
      const data = await res.json();
      if (data.success && data.pdfBase64) {
        setPreGeneratedPdf(data.pdfBase64);
        console.log("[KYC Context] Pre-generated PDF loaded in background.");
      }
    } catch (err) {
      console.warn("[KYC Context] Background PDF pre-generation failed:", err);
    }
  }, [state]);

  const lastClientStepChange = useRef(0);
  const lastSyncedReviewedAt = useRef(null);
  const [steps, setSteps] = useState([]);
  const [stepsLoaded, setStepsLoaded] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);

  const fetchSteps = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/kyc/config`);
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.success) {
          setSteps(data.steps);
          setStepsLoaded(true);
        }
      } else {
        const text = await response.text();
        console.warn(
          "[KYC Context] Expected JSON step config but got text",
          text.substring(0, 50),
        );
      }
    } catch (error) {
      console.warn("[KYC Context] Failed to fetch step config, using defaults");
    }
  }, []);

  useEffect(() => {
    // Attempt to quickly restore state from session storage before the API call finishes
    try {
      const saved = getStorage().getItem("kyc-progress");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.currentStep !== undefined) {
          setState((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch (e) {
      console.warn(
        "[KYC Context] Failed to restore progress from session storage",
        e,
      );
    }

    fetchSteps();
  }, [fetchSteps]);

  const addToast = useCallback((message, type = "info") => {
    setToasts((prev) => {
      // Prevent duplicate messages within a short window
      if (prev.length > 0 && prev[prev.length - 1].message === message)
        return prev;

      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const next = [...prev, { id, message, type }];
      setTimeout(
        () => setToasts((curr) => curr.filter((t) => t.id !== id)),
        8000,
      );
      return next;
    });
  }, []);

  const refreshProgress = useCallback(
    async (appId, authToken, isPolling = false) => {
      // Ensure we have an applicationId and token (check both storage types)
      const activeAppId =
        appId ||
        (typeof window !== "undefined"
          ? getStorage().getItem("kycApplicationId") ||
            localStorage.getItem("kycApplicationId")
          : null);
      const activeToken =
        authToken ||
        (typeof window !== "undefined"
          ? getStorage().getItem("kycToken") ||
            localStorage.getItem("kycToken") ||
            localStorage.getItem("token")
          : null);

      if (!activeAppId || !activeToken) {
        if (!isPolling) {
          console.log(
            "[KYC Sync] No active application ID or token found. Skipping refresh.",
          );
          setState((prev) => ({ ...prev, isRestoring: false }));
        }
        return null;
      }

      if (!isPolling) {
        setState((prev) => ({ ...prev, isRestoring: true }));
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/kyc/status/${activeAppId}`,
          {
            headers: { Authorization: `Bearer ${activeToken}` },
          },
        );

        // Handle Deleted Application or Invalid Session
        if (response.status === 404 || response.status === 401) {
          console.warn(
            `[KYC Sync] ${response.status === 404 ? "Application Deleted" : "Session Expired"}. Cleaning up...`,
          );
          if (typeof window !== "undefined") {
            getStorage().removeItem("kycApplicationId");
            getStorage().removeItem("kycToken");
            getStorage().removeItem("kyc-progress");
            localStorage.removeItem("kycApplicationId");
            localStorage.removeItem("kycToken");
          }
          setState(INITIAL_STATE);
          return null;
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (data.success && data.application) {
            const app = data.application;

            const isInitialLoad = !isPolling;
            const adminJustMoved =
              app.reviewedAt && app.reviewedAt !== lastSyncedReviewedAt.current;

            // Server now sets currentStep to the first rejected step when
            // sending rejections. The nextStep function saves progress on each
            // transition, so we trust the server's currentStep value on refresh
            // instead of forcibly recalculating it every time.

            setHasSynced(true);
            setState((rawPrev) => {
              // 0. RESET STATE ON NEW APPLICATION
              // If the application ID changed (e.g. user logged in with different number in same tab),
              // we MUST NOT merge the new empty application into the old populated state!
              const prev = rawPrev.applicationId && rawPrev.applicationId !== app.applicationId
                ? { ...INITIAL_STATE, isRestoring: true, hasSynced: true }
                : rawPrev;

              // Detect if anything critical actually changed
              const stepChanged = app.currentStep !== prev.currentStep;
              const statusChanged = app.status !== prev.status;
              const adminMoved =
                app.reviewedAt &&
                app.reviewedAt !== lastSyncedReviewedAt.current;

              if (!stepChanged && !statusChanged && !adminMoved && isPolling) {
                // If it's a socket event, we should still sync the data if the device is inactive
                // to show real-time changes (e.g. document uploads) from the other device.
                const timeSinceLastNav = Date.now() - (lastClientStepChange.current || 0);
                if (timeSinceLastNav < 15000) {
                  return prev;
                }
              }

              const updateSessionStorage = (nextState) => {
                try {
                  getStorage().setItem(
                    "kyc-progress",
                    JSON.stringify(nextState),
                  );
                } catch (e) {}
                return nextState;
              };

              // 1. ABSOLUTE ADMIN OVERRIDE: If Admin explicitly moved the user, we always trust the server
              if (adminMoved) {
                console.log(
                  `[KYC Sync] Admin Override Detected! Moving to Step: ${app.currentStep} and syncing all data.`,
                );
                lastSyncedReviewedAt.current = app.reviewedAt;
                return updateSessionStorage({
                  ...prev,
                  applicationId: app.applicationId,
                  currentStep: app.currentStep,
                  status: app.status,
                  rejectionReason:
                    app.rejectionReason !== undefined
                      ? app.rejectionReason
                      : prev.rejectionReason,
                  submittedAt:
                    app.submittedAt !== undefined
                      ? app.submittedAt
                      : prev.submittedAt,
                  isResubmitted:
                    app.isResubmitted !== undefined
                      ? app.isResubmitted
                      : prev.isResubmitted,
                  personalDetails: {
                    ...prev.personalDetails,
                    ...(app.personalDetails || {}),
                  },
                  identityDetails: {
                    ...prev.identityDetails,
                    ...(app.identityDetails || {}),
                  },
                  address: { ...prev.address, ...(app.address || {}) },
                  bankDetails: {
                    ...prev.bankDetails,
                    ...(app.bankDetails || {}),
                  },
                  ocrData: { ...prev.ocrData, ...(app.ocrData || {}) },
                  selfie: { ...prev.selfie, ...(app.selfieDetails || {}) },
                  signature: { ...prev.signature, ...(app.signature || {}) },
                  panUpload: { ...prev.panUpload, ...(app.panUpload || {}) },
                  financialProof: {
                    ...prev.financialProof,
                    ...(app.financialProof || {}),
                  },
                  segments: app.segments || prev.segments,
                  bsda: app.bsda || prev.bsda,
                  nomineeDetails: app.nomineeDetails || prev.nomineeDetails,
                  nomineeAllocation:
                    app.nomineeAllocation || prev.nomineeAllocation,
                  stepStatuses: app.stepStatuses || prev.stepStatuses,
                  generatedPdfBase64: app.generatedPdfBase64 || prev.generatedPdfBase64,
                });
              }

              // 2. INITIAL LOAD / REFRESH: Always trust server on first load (isPolling is false)
              if (!isPolling) {
                lastSyncedReviewedAt.current = app.reviewedAt; // Initialize the marker
                setPreGeneratedPdf(null);

                const isRejectionMode =
                  getStorage().getItem("kycRejectionMode") === "true" ||
                  prev.rejectionMode ||
                  Boolean(decodeJwtPayload(activeToken)?.rejectionMode);

                let rejList = prev.rejectedStepsList || [];
                if (rejList.length === 0) {
                  try {
                    rejList = JSON.parse(
                      getStorage().getItem("kycRejectedSteps") || "[]"
                    );
                  } catch (e) {
                    rejList = [];
                  }
                }

                let parsedStatuses = {};
                if (app.stepStatuses) {
                  try {
                    parsedStatuses =
                      typeof app.stepStatuses === "string"
                        ? JSON.parse(app.stepStatuses)
                        : app.stepStatuses;
                  } catch (e) {
                    parsedStatuses = {};
                  }
                }

                const isStepRejected = (stepName) => {
                  if (!isRejectionMode) return false;
                  if (rejList.some((r) => r.stepId === stepName)) return true;
                  return parsedStatuses[stepName]?.status === "rejected";
                };

                // Clear stale local drafts for rejected steps
                if (typeof window !== "undefined" && isRejectionMode) {
                  const appId = app.applicationId;
                  if (isStepRejected("personalDetails"))
                    localStorage.removeItem(`kyc-draft-${appId}-details`);
                  if (isStepRejected("bankVerification"))
                    localStorage.removeItem(`kyc-draft-${appId}-bankForm`);
                  if (
                    isStepRejected("nomineeDetails") ||
                    isStepRejected("nomineeChoice")
                  ) {
                    localStorage.removeItem(`kyc-draft-${appId}-nominees`);
                    localStorage.removeItem(`kyc-draft-${appId}-nomineeOpted`);
                    localStorage.removeItem(`kyc-draft-${appId}-nomineeConfirmed`);
                  }
                  if (isStepRejected("panVerification")) {
                    localStorage.removeItem(`kyc-draft-${appId}-pan`);
                    localStorage.removeItem(`kyc-draft-${appId}-panFullName`);
                    localStorage.removeItem(`kyc-draft-${appId}-panDob`);
                  }
                  if (isStepRejected("digilocker")) {
                    localStorage.removeItem(`kyc-draft-${appId}-address`);
                  }
                  if (isStepRejected("pricingSelection")) {
                    localStorage.removeItem(`kyc-draft-${appId}-pricingSegments`);
                    localStorage.removeItem(`kyc-draft-${appId}-pricingBsda`);
                    localStorage.removeItem(`kyc-draft-${appId}-pricingBrokerageAccepted`);
                    localStorage.removeItem(`kyc-draft-${appId}-pricingTariffAccepted`);
                  }
                }

                return updateSessionStorage({
                  ...prev,
                  applicationId: app.applicationId,
                  currentStep: app.currentStep,
                  status: app.status,
                  rejectionMode: isRejectionMode,
                  rejectedStepsList: rejList,
                  rejectionReason:
                    app.rejectionReason !== undefined
                      ? app.rejectionReason
                      : prev.rejectionReason,
                  submittedAt:
                    app.submittedAt !== undefined
                      ? app.submittedAt
                      : prev.submittedAt,
                  isResubmitted:
                    app.isResubmitted !== undefined
                      ? app.isResubmitted
                      : prev.isResubmitted,
                  isRestoring: false,
                  otpVerified: app.currentStep > 1 ? true : prev.otpVerified,
                  emailVerified: app.currentStep > 2 ? true : prev.emailVerified,
                  panVerified: app.currentStep > 4 ? true : prev.panVerified,
                  correctionDraft: app.correctionDraft ? (typeof app.correctionDraft === "string" ? JSON.parse(app.correctionDraft) : app.correctionDraft) : prev.correctionDraft,
                  personalDetails: {
                    ...prev.personalDetails,
                    ...(app.personalDetails || {}),
                  },
                  identityDetails: {
                    ...prev.identityDetails,
                    ...(app.identityDetails || {}),
                  },
                  address: { ...prev.address, ...(app.address || {}) },
                  bankDetails: {
                    ...prev.bankDetails,
                    ...(app.bankDetails || {}),
                  },
                  ocrData: { ...prev.ocrData, ...(app.ocrData || {}) },
                  selfie: { ...prev.selfie, ...(app.selfieDetails || {}) },
                  signature: { ...prev.signature, ...(app.signature || {}) },
                  panUpload: { ...prev.panUpload, ...(app.panUpload || {}) },
                  financialProof: {
                    ...prev.financialProof,
                    ...(app.financialProof || {}),
                  },
                  segments: app.segments || prev.segments,
                  bsda: app.bsda || prev.bsda,
                  nomineeDetails: app.nomineeDetails || prev.nomineeDetails,
                  nomineeAllocation: app.nomineeAllocation || prev.nomineeAllocation,
                  stepStatuses: app.stepStatuses || prev.stepStatuses,
                  generatedPdfBase64: app.generatedPdfBase64 || prev.generatedPdfBase64,
                });
              }

              // 3. BACKGROUND POLLING LOGIC:
              // For real-time updates across devices, if this device is not actively
              // navigating (cooldown), we should sync with the server's state.
              if (isPolling) {
                const serverIsNewerAdminChange =
                  app.reviewedAt &&
                  (!lastSyncedReviewedAt.current ||
                    new Date(app.reviewedAt).getTime() >
                      new Date(lastSyncedReviewedAt.current).getTime());

                // Navigation Cooldown to prevent race conditions while user is typing/clicking
                const timeSinceLastNav = Date.now() - (lastClientStepChange.current || 0);
                const isNavCooldown = timeSinceLastNav < 15000; // 15 seconds

                if (isNavCooldown && !statusChanged && !serverIsNewerAdminChange) {
                  console.log(
                    `[KYC Sync] Ignoring server pull to Step: ${app.currentStep} due to 15s activity cooldown on this device.`
                  );
                  return prev;
                }
                
                // If the user hasn't interacted recently, we sync everything from the server!
                // This ensures real-time updates from other devices (like mobile selfie completion).
                const reason = statusChanged 
                  ? "Status changed" 
                  : serverIsNewerAdminChange 
                    ? "Admin moved step/status" 
                    : "Real-time sync from another device";

                console.log(
                  `[KYC Sync] Following server (${reason}). New Step: ${app.currentStep}, Status: ${app.status}`,
                );

                if (serverIsNewerAdminChange) {
                  lastSyncedReviewedAt.current = app.reviewedAt;
                  setPreGeneratedPdf(null);
                }

                  // Defensive merge even on background sync
                  return updateSessionStorage({
                    ...prev,
                    applicationId: app.applicationId,
                    currentStep: app.currentStep,
                    status: app.status,
                    rejectionReason:
                      app.rejectionReason !== undefined
                        ? app.rejectionReason
                        : prev.rejectionReason,
                    submittedAt:
                      app.submittedAt !== undefined
                        ? app.submittedAt
                        : prev.submittedAt,
                    isResubmitted:
                      app.isResubmitted !== undefined
                        ? app.isResubmitted
                        : prev.isResubmitted,
                    personalDetails: {
                      ...prev.personalDetails,
                      ...(app.personalDetails || {}),
                    },
                    identityDetails: {
                      ...prev.identityDetails,
                      ...(app.identityDetails || {}),
                    },
                    address: { ...prev.address, ...(app.address || {}) },
                    bankDetails: {
                      ...prev.bankDetails,
                      ...(app.bankDetails || {}),
                    },
                    ocrData: { ...prev.ocrData, ...(app.ocrData || {}) },
                    selfie: { ...prev.selfie, ...(app.selfieDetails || {}) },
                    signature: { ...prev.signature, ...(app.signature || {}) },
                    panUpload: { ...prev.panUpload, ...(app.panUpload || {}) },
                    financialProof: {
                      ...prev.financialProof,
                      ...(app.financialProof || {}),
                    },
                    segments: app.segments || prev.segments,
                    bsda: app.bsda || prev.bsda,
                    nomineeDetails: app.nomineeDetails || prev.nomineeDetails,
                    nomineeAllocation:
                      app.nomineeAllocation || prev.nomineeAllocation,
                    stepStatuses: app.stepStatuses || prev.stepStatuses,
                    generatedPdfBase64: app.generatedPdfBase64 || prev.generatedPdfBase64,
                  });
                }
                // If server is behind and no admin change, stay where we are (no yank back)
                return prev;
            });
            return app;
          }
        }
      } catch (error) {
        if (!isPolling) {
          console.warn("[KYC Sync] Failed to sync with server:", error.message);
          setState((prev) => ({ ...prev, isRestoring: false }));
          // If we can't reach the server, we haven't synced, so stay hasSynced = false
        }
      } finally {
        if (!isPolling) {
          // Ensure restoration flag is eventually cleared
          setTimeout(
            () => setState((prev) => ({ ...prev, isRestoring: false })),
            100,
          );
        }
      }
      return null;
    },
    [],
  );

  // Real-time updates via Socket.IO (replaces background polling)
  useEffect(() => {
    const activeAppId =
      state.applicationId ||
      (typeof window !== "undefined"
        ? getStorage().getItem("kycApplicationId")
        : null);
    const activeToken =
      getStorage().getItem("kycToken") || getStorage().getItem("token");

    if (!activeAppId || !activeToken) return;

    const socket = io(API_BASE_URL, {
      withCredentials: true,
    });

    socket.on("connect", () => {
      console.log("[Socket.IO] Connected to real-time server");
      socket.emit("join_application", activeAppId);
    });

    socket.on("kyc_updated", (data) => {
      console.log("[Socket.IO] Received kyc_updated event:", data);
      // Trigger a silent refresh just like polling did
      refreshProgress(activeAppId, activeToken, true);
    });

    return () => {
      socket.disconnect();
    };
  }, [state.applicationId, refreshProgress]);

  useEffect(() => {
    const savedTheme = getStorage().getItem("kyc-theme");
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }

    if (typeof window === "undefined") return;

    // Only restore from sessionStorage to ensure new tabs start fresh at Phone Verification
    const savedApplicationId = getStorage().getItem("kycApplicationId");
    const token =
      getStorage().getItem("kycToken") ||
      getStorage().getItem("adminToken") ||
      getStorage().getItem("token");

    const urlParams = new URLSearchParams(window.location.search);
    const magicToken = urlParams.get("token");

    if (magicToken) {
      getStorage().setItem("kycToken", magicToken);
      window.history.replaceState({}, document.title, window.location.pathname);

      const decoded = decodeJwtPayload(magicToken);
      const isRejection = Boolean(decoded?.rejectionMode);
      const rejSteps = decoded?.rejectedSteps || [];

      if (isRejection) {
        getStorage().setItem("kycRejectionMode", "true");
        getStorage().setItem(
          "kycRejectedSteps",
          JSON.stringify(rejSteps)
        );
      } else {
        getStorage().removeItem("kycRejectionMode");
        getStorage().removeItem("kycRejectedSteps");
      }

      // Set restoring immediately so KYCJourney shows the loading spinner
      // instead of flashing step 1 while we fetch the application
      setState((prev) => ({
        ...prev,
        rejectionMode: isRejection,
        rejectedStepsList: rejSteps,
        isRestoring: true,
      }));

      // Fetch /api/kyc/me to get the application id
      fetch(`${API_BASE_URL}/api/kyc/me`, {
        headers: { Authorization: `Bearer ${magicToken}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.application) {
            getStorage().setItem(
              "kycApplicationId",
              data.application.applicationId,
            );
            refreshProgress(data.application.applicationId, magicToken);
          } else {
            setHasSynced(true);
            setState((prev) => ({ ...prev, isRestoring: false }));
          }
        })
        .catch((err) => {
          console.warn("[KYC Init] Failed to verify magic token:", err);
          setHasSynced(true);
          setState((prev) => ({ ...prev, isRestoring: false }));
        });
      return;
    }

    if (savedApplicationId && token) {
      console.log(
        `[KYC Init] Found tab session for ${savedApplicationId}. Refreshing...`,
      );
      const decoded = decodeJwtPayload(token);
      const isRejection = Boolean(
        decoded?.rejectionMode ||
          getStorage().getItem("kycRejectionMode") === "true"
      );
      let rejSteps = decoded?.rejectedSteps || [];
      if (rejSteps.length === 0) {
        try {
          rejSteps = JSON.parse(
            getStorage().getItem("kycRejectedSteps") || "[]"
          );
        } catch (e) {
          rejSteps = [];
        }
      }

      if (isRejection) {
        setState((prev) => ({
          ...prev,
          rejectionMode: true,
          rejectedStepsList: rejSteps,
        }));
      }

      refreshProgress(savedApplicationId, token);
    } else {
      // No active tab session, stop the restoring spinner
      setHasSynced(true);
      setState((prev) => ({ ...prev, isRestoring: false }));
    }
  }, [refreshProgress]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      getStorage().setItem("kyc-theme", next);
      return next;
    });
  }, []);

  const updateState = useCallback((updates) => {
    setPreGeneratedPdf(null); // Clear cached PDF if data changes
    setState((prev) => {
      const next = { ...prev, ...updates };
      // Avoid updating state if nothing changed (prevents render loops)
      const isEqual = Object.keys(updates).every(
        (key) => prev[key] === updates[key],
      );
      if (isEqual) return prev;
      try {
        getStorage().setItem("kyc-progress", JSON.stringify(next));
      } catch (e) {
        console.warn("[KYC Context] sessionStorage update failed:", e.message);
      }
      return next;
    });
  }, []);

  const updateNested = useCallback((key, updates) => {
    setPreGeneratedPdf(null); // Clear cached PDF if data changes
    setState((prev) => {
      const next = { ...prev, [key]: { ...prev[key], ...updates } };
      try {
        getStorage().setItem("kyc-progress", JSON.stringify(next));
      } catch (e) {
        console.warn("[KYC Context] sessionStorage update failed:", e.message);
      }
      return next;
    });
  }, []);

  const getBackendPayload = useCallback(
    (snapshot, forceKeysOrStepId = null) => {
      const currentSteps = steps.length > 0 ? steps : STEPS;
      let relevantKeys = [];

      if (Array.isArray(forceKeysOrStepId)) {
        relevantKeys = forceKeysOrStepId;
      } else if (typeof forceKeysOrStepId === "string") {
        relevantKeys = STEP_RELEVANT_KEYS[forceKeysOrStepId] || [];
      } else {
        const stepId = currentSteps[snapshot.currentStep]?.id;
        relevantKeys = STEP_RELEVANT_KEYS[stepId] || [];
      }

      const payload = {
        currentStep: snapshot.currentStep,
        status: snapshot.status || "pending",
      };

      // Helper to conditionally add key to payload if it's relevant
      const addIfRelevant = (key, transform) => {
        if (relevantKeys.includes(key)) {
          payload[key] = transform ? transform(snapshot[key]) : snapshot[key];
        }
      };

      if (snapshot.rejectionMode && snapshot.correctionDraft !== undefined) {
        payload.correctionDraft = snapshot.correctionDraft;
      }

      addIfRelevant("personalDetails");
      addIfRelevant("identityMethod");
      addIfRelevant("identityDetails");
      addIfRelevant("ocrData");
      addIfRelevant("address");
      addIfRelevant("bankDetails");
      addIfRelevant("segments");
      addIfRelevant("bsda");
      addIfRelevant("nomineeAllocation");
      addIfRelevant("consent");
      addIfRelevant("submittedAt");
      addIfRelevant("esignPreview");

      if (relevantKeys.includes("nomineeDetails")) {
        payload.nomineeDetails =
          snapshot.nomineeDetails?.opted === "No"
            ? { ...snapshot.nomineeDetails, nominees: [] }
            : {
                ...snapshot.nomineeDetails,
                nominees: (snapshot.nomineeDetails?.nominees || []).map(
                  (nom) => {
                    const { proofFile, ...serializableNominee } = nom;
                    return serializableNominee;
                  },
                ),
              };
      }

      if (relevantKeys.includes("panUpload")) {
        payload.panUpload = snapshot.panUpload
          ? { ...snapshot.panUpload, file: undefined }
          : snapshot.panUpload;
      }
      if (relevantKeys.includes("signature")) {
        payload.signature = snapshot.signature
          ? { ...snapshot.signature, file: undefined }
          : snapshot.signature;
      }
      if (relevantKeys.includes("financialProof")) {
        payload.financialProof = snapshot.financialProof
          ? { ...snapshot.financialProof, file: undefined }
          : snapshot.financialProof;
      }
      if (relevantKeys.includes("selfieDetails")) {
        payload.selfieDetails = snapshot.selfie;
      }

      // Removed the payload.documents boolean flags to prevent overwriting the backend array

      return payload;
    },
    [steps],
  );

  // Use a ref to always have access to latest state in async callbacks
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const persistStepToBackend = useCallback(
    async (partialSnapshot, showToastOnError = false, forceStepId = null) => {
      if (typeof window === "undefined") return false;

      // Merge partial snapshot with latest state for a complete picture
      const snapshot = { ...stateRef.current, ...partialSnapshot };

      const applicationId =
        snapshot.applicationId || getStorage().getItem("kycApplicationId");
      const token =
        getStorage().getItem("kycToken") ||
        getStorage().getItem("adminToken") ||
        getStorage().getItem("token");
      if (!applicationId || !token) return false;

      const currentSteps = steps.length > 0 ? steps : STEPS;
      const stepId = forceStepId || currentSteps[snapshot.currentStep]?.id;
      if (!stepId) return false;

      console.log(
        `[KYC Context] Persisting Step: ${stepId} (Index: ${snapshot.currentStep})`,
      );

      try {
        await saveKycStep({
          applicationId,
          step: stepId,
          stepIndex: snapshot.currentStep,
          data: getBackendPayload(
            snapshot,
            forceStepId ||
              (partialSnapshot ? Object.keys(partialSnapshot) : null),
          ),
        });
        return true;
      } catch (error) {
        console.warn("[KYC Sync] save-step failed:", error?.message || error);
        if (showToastOnError) {
          const errorMsg =
            error?.message || "Failed to sync progress. Please try again.";
          addToast(errorMsg, "error");
        }
        return false;
      }
    },
    [getBackendPayload, addToast, steps],
  );

  /**
   * Records that a step has been verified with a specific data fingerprint.
   * Called by step components after successful API verification.
   */
  const markStepVerified = useCallback((stepIndex, fingerprint) => {
    if (!fingerprint) return;
    setState((prev) => {
      const next = {
        ...prev,
        verifiedSteps: {
          ...prev.verifiedSteps,
          [stepIndex]: { fingerprint },
        },
      };
      try {
        getStorage().setItem("kyc-progress", JSON.stringify(next));
      } catch (e) {
        console.warn("[KYC Context] sessionStorage update failed:", e.message);
      }
      return next;
    });
    console.log(
      `[KYC Context] Step ${stepIndex} marked as verified with fingerprint: ${fingerprint}`,
    );
  }, []);

  const nextStep = useCallback(
    async (updates) => {
      const now = Date.now();
      if (now - lastClientStepChange.current < 800) {
        console.warn(
          "[KYC Context] nextStep blocked (double-click protection)",
        );
        return;
      }
      lastClientStepChange.current = now;

      // Sync with the step we are LEAVING to ensure its data is saved
      const currentSteps = steps.length > 0 ? steps : STEPS;
      const currentPrev = stateRef.current;
      const currentStepId = currentSteps[currentPrev.currentStep]?.id;

      const base = updates ? { ...currentPrev, ...updates } : currentPrev;
      let nextStepIndex = Math.min(
        base.currentStep + 1,
        currentSteps.length - 1,
      );

      // MODIFICATION MODE: Skip approved steps (but never skip step 12+ i.e. eSign)
      const hasStepStatuses =
        base.stepStatuses && Object.keys(base.stepStatuses).length > 0;
      const hasAnyRejected =
        hasStepStatuses &&
        Object.values(base.stepStatuses).some((s) => s?.status === "rejected");
      const isResubmission =
        !!base.rejectionReason ||
        !!base.submittedAt ||
        !!base.isResubmitted ||
        hasAnyRejected;
      if (hasStepStatuses) {
        while (
          nextStepIndex < currentSteps.length - 1 &&
          isKycStepApproved(nextStepIndex, base.stepStatuses, isResubmission)
        ) {
          console.log(
            `[KYC Context] Skipping approved step ${nextStepIndex} (${currentSteps[nextStepIndex]?.id})`,
          );
          nextStepIndex++;
        }
      }

      // AUTO-SKIP VERIFIED API STEPS: If the user is moving forward through a step
      // that was already verified (PAN, DigiLocker, Bank) and the data hasn't changed,
      // skip it automatically so the user doesn't have to click "Continue" on each one.
      while (
        nextStepIndex < currentSteps.length - 1 &&
        VERIFICATION_FINGERPRINTS[nextStepIndex]
      ) {
        const fpFn = VERIFICATION_FINGERPRINTS[nextStepIndex];
        const currentFp = fpFn(base);
        if (!currentFp) break; // Step not verified at all — stop here

        const savedFp = base.verifiedSteps?.[nextStepIndex]?.fingerprint;
        if (savedFp && currentFp !== savedFp) break; // Data CHANGED since verification — must re-verify

        // Either fingerprint matches, or no saved fingerprint but step IS verified
        // (e.g., server-restored session, admin-moved user, pre-existing session)
        console.log(
          `[KYC Context] Auto-skipping verified step ${nextStepIndex} (${currentSteps[nextStepIndex]?.id}) — ${savedFp ? "fingerprint matches" : "auto-populated from verified state"}`,
        );

        // Auto-populate fingerprint if missing (so future changes can be detected)
        if (!savedFp) {
          base.verifiedSteps = {
            ...(base.verifiedSteps || {}),
            [nextStepIndex]: { fingerprint: currentFp },
          };
        }
        nextStepIndex++;
      }

      // We must pass the NEXT step index so the backend updates the user's progress bookmark
      const computedNextState = { ...base, currentStep: nextStepIndex };

      // Await saving to backend BEFORE we advance state
      const success = await persistStepToBackend(
        computedNextState,
        true,
        currentStepId,
      );

      // If saving failed (e.g., server offline), ABORT advancing to prevent data loss
      if (!success) {
        console.error(
          "[KYC Context] nextStep aborted due to backend sync failure.",
        );
        return;
      }

      setState((prev) => {
        const freshBase = updates ? { ...prev, ...updates } : prev;
        let freshNextStepIndex = Math.min(
          freshBase.currentStep + 1,
          currentSteps.length - 1,
        );

        const hasStepStatuses =
          freshBase.stepStatuses &&
          Object.keys(freshBase.stepStatuses).length > 0;
        const hasAnyRejected =
          hasStepStatuses &&
          Object.values(freshBase.stepStatuses).some(
            (s) => s?.status === "rejected",
          );
        const isResubmissionState =
          !!freshBase.rejectionReason ||
          !!freshBase.submittedAt ||
          !!freshBase.isResubmitted ||
          hasAnyRejected;
        if (hasStepStatuses) {
          while (
            freshNextStepIndex < currentSteps.length - 1 &&
            isKycStepApproved(
              freshNextStepIndex,
              freshBase.stepStatuses,
              isResubmissionState,
            )
          ) {
            console.log(
              `[KYC Context] Skipping approved step ${freshNextStepIndex} (${currentSteps[freshNextStepIndex]?.id}) during state update`,
            );
            freshNextStepIndex++;
          }
        }

        // AUTO-SKIP VERIFIED API STEPS (mirror of the pre-persist logic above)
        while (
          freshNextStepIndex < currentSteps.length - 1 &&
          VERIFICATION_FINGERPRINTS[freshNextStepIndex]
        ) {
          const fpFn = VERIFICATION_FINGERPRINTS[freshNextStepIndex];
          const currentFp = fpFn(freshBase);
          if (!currentFp) break; // Step not verified

          const savedFp =
            freshBase.verifiedSteps?.[freshNextStepIndex]?.fingerprint;
          if (savedFp && currentFp !== savedFp) break; // Data changed

          console.log(
            `[KYC Context] Auto-skipping verified step ${freshNextStepIndex} (${currentSteps[freshNextStepIndex]?.id}) during state update`,
          );

          // Auto-populate fingerprint if missing
          if (!savedFp) {
            freshBase.verifiedSteps = {
              ...(freshBase.verifiedSteps || {}),
              [freshNextStepIndex]: { fingerprint: currentFp },
            };
          }
          freshNextStepIndex++;
        }

        const stateToReturn = { ...freshBase, currentStep: freshNextStepIndex };

        if (typeof window !== "undefined") {
          getStorage().setItem(
            "kyc-progress",
            JSON.stringify(stateToReturn)
          );
        }
        return stateToReturn;
      });
    },
    [persistStepToBackend, steps],
  );

  const prevStep = useCallback(() => {
    lastClientStepChange.current = Date.now();

    const currentSteps = steps.length > 0 ? steps : STEPS;
    const currentPrev = stateRef.current;
    let prevStepIndex = Math.max(currentPrev.currentStep - 1, 0);

    // In rejection/resubmission mode, skip backward over approved steps
    // so the user only navigates between rejected steps + mandatory steps
    const hasStepStatuses =
      currentPrev.stepStatuses && Object.keys(currentPrev.stepStatuses).length > 0;
    const hasAnyRejected =
      hasStepStatuses &&
      Object.values(currentPrev.stepStatuses).some(s => s?.status === "rejected");
    const isResubmission =
      !!currentPrev.rejectionReason ||
      !!currentPrev.submittedAt ||
      !!currentPrev.isResubmitted ||
      hasAnyRejected;

    if (hasStepStatuses && isResubmission) {
      while (
        prevStepIndex > 0 &&
        isKycStepApproved(prevStepIndex, currentPrev.stepStatuses, isResubmission)
      ) {
        prevStepIndex--;
      }
    }

    const computedNextState = { ...currentPrev, currentStep: prevStepIndex };

    setState((prev) => {
      let freshPrevStepIndex = Math.max(prev.currentStep - 1, 0);

      // Mirror the same skip logic using fresh state
      const freshHasStatuses = prev.stepStatuses && Object.keys(prev.stepStatuses).length > 0;
      const freshHasRejected = freshHasStatuses &&
        Object.values(prev.stepStatuses).some(s => s?.status === "rejected");
      const freshIsResubmission =
        !!prev.rejectionReason || !!prev.submittedAt || !!prev.isResubmitted || freshHasRejected;

      if (freshHasStatuses && freshIsResubmission) {
        while (
          freshPrevStepIndex > 0 &&
          isKycStepApproved(freshPrevStepIndex, prev.stepStatuses, freshIsResubmission)
        ) {
          freshPrevStepIndex--;
        }
      }

      const stateToReturn = { ...prev, currentStep: freshPrevStepIndex };
      if (typeof window !== "undefined") {
        getStorage().setItem(
          "kyc-progress",
          JSON.stringify({
            currentStep: freshPrevStepIndex,
            status: stateToReturn.status,
          }),
        );
      }
      return stateToReturn;
    });

    persistStepToBackend(computedNextState, true);
  }, [persistStepToBackend, steps]);


  const goToStep = useCallback(
    (step, updates) => {
      lastClientStepChange.current = Date.now();

      // Safety check - bounds
      if (step < 0) return;

      setState((prev) => {
        const freshBase = updates ? { ...prev, ...updates } : prev;
        if (step >= 1) freshBase.otpVerified = true;
        if (step >= 3) freshBase.emailVerified = true;
        if (step >= 5) freshBase.panVerified = true;

        const computedNextState = { ...freshBase, currentStep: step };

        // We only auto-sync to backend when the step explicitly changes
        if (step !== prev.currentStep && hasSynced) {
          console.log(`[KYC Sync] Persisting transition to Step ${step}`);
          persistStepToBackend(computedNextState, true);
        }

        if (typeof window !== "undefined") {
          getStorage().setItem(
            "kyc-progress",
            JSON.stringify({
              currentStep: step,
              status: computedNextState.status,
            }),
          );
          if (computedNextState.applicationId) {
            getStorage().setItem(
              "kycApplicationId",
              computedNextState.applicationId,
            );
          }
        }
        return computedNextState;
      });
    },
    [hasSynced, persistStepToBackend],
  );

  const resetKYC = useCallback(() => {
    setState(INITIAL_STATE);
    if (typeof window !== "undefined") {
      getStorage().clear();
      localStorage.removeItem("kyc-progress");
      localStorage.removeItem("kycApplicationId");
      localStorage.removeItem("kycToken");
      localStorage.removeItem("token");
      
      // Clear all kyc-drafts to prevent stale data in new applications
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("kyc-draft-")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
  }, []);

  const setApplicationId = useCallback((applicationId) => {
    setState((prev) => ({ ...prev, applicationId: applicationId || "" }));
    if (typeof window !== "undefined" && applicationId) {
      getStorage().setItem("kycApplicationId", applicationId);
      localStorage.setItem("kycApplicationId", applicationId);
    }
  }, []);

  return (
    <KYCContext.Provider
      value={{
        ...state,
        theme,
        toasts,
        steps: steps.length > 0 ? steps : STEPS,
        STEPS,
        updateState,
        updateNested,
        nextStep,
        prevStep,
        goToStep,
        addToast,
        toggleTheme,
        resetKYC,
        setApplicationId,
        syncProgress: persistStepToBackend,
        refreshProgress,
        getBackendPayload,
        markStepVerified,
        preGeneratedPdf,
        generatedPdfBase64: state.generatedPdfBase64,
        preGeneratePdf,
      }}
    >
      {children}
    </KYCContext.Provider>
  );
}

export const useKYC = () => {
  const ctx = useContext(KYCContext);
  if (!ctx) throw new Error("useKYC must be used within KYCProvider");
  return ctx;
};
