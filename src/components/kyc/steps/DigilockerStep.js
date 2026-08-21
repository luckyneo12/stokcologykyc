"use client";
import { useState, useEffect, useRef } from "react";
import { useKYC } from "@/context/KYCContext";
import { initializeDigio, createDigioRequest, fetchDigioRequestResponse } from "@/utils/digio";

const formatPanValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.toUpperCase().match(/[A-Z]{5}[0-9]{4}[A-Z]/);
    return match ? match[0] : value.toUpperCase();
  }
  if (typeof value !== "object") return String(value).toUpperCase();

  const preferredKeys = ["pan", "pan_no", "pan_number", "panNo", "id_no", "id_number", "number", "document_number"];
  for (const key of preferredKeys) {
    const formatted = formatPanValue(value[key]);
    if (formatted && formatted !== "[OBJECT OBJECT]") return formatted;
  }

  for (const nested of Object.values(value)) {
    const formatted = formatPanValue(nested);
    if (formatted && formatted !== "[OBJECT OBJECT]") return formatted;
  }

  return "";
};

export default function DigilockerStep() {
  const { nextStep, addToast, setApplicationId, updateState, personalDetails, identityDetails, address, goToStep, applicationId, markStepVerified } = useKYC();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const currentRequestId = useRef(null);

  
  const handleDigioSuccess = async (requestId) => {
    try {
      setLoading(true);
      const result = await fetchDigioRequestResponse(requestId, "DIGILOCKER");
      if (result && result.success) {
        if (result.updates) {
          const panName = (personalDetails?.fullName || "").trim().toLowerCase();
          const panDob = personalDetails?.dob || ""; // Expected YYYY-MM-DD
          
          const aadhaarName = (result.updates.personalDetails?.fullName || "").trim().toLowerCase();
          const aadhaarDobRaw = result.updates.personalDetails?.dob || ""; 
          
          const normalizeDate = (dateStr) => {
            if (!dateStr) return "";
            const cleanDate = dateStr.split("T")[0].replace(/\//g, "-"); 
            const parts = cleanDate.split("-");
            if (parts.length !== 3) return cleanDate;
            if (parts[0].length === 2 && parts[2].length === 4) {
              return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            return cleanDate;
          };

          const aadhaarDob = normalizeDate(aadhaarDobRaw);
          const normalizedPanDob = normalizeDate(panDob);

          const isNameMatch = !aadhaarName || !panName || (aadhaarName === panName);
          const isDobMatch = !aadhaarDob || !normalizedPanDob || (aadhaarDob === normalizedPanDob);

          console.log("[KYC Validation] Comparison:", {
            pan: { name: panName, dob: normalizedPanDob, raw: personalDetails?.dob },
            aadhaar: { name: aadhaarName, dob: aadhaarDob, raw: aadhaarDobRaw },
            matches: { name: isNameMatch, dob: isDobMatch }
          });

          // Check if PAN returned from DigiLocker differs from Step 4 PAN
          const step4Pan = formatPanValue(identityDetails?.manualPan || identityDetails?.pan);
          const dlPan = formatPanValue(result.updates.identityDetails?.pan);

          if (dlPan && step4Pan && dlPan !== step4Pan) {
            console.warn(`[KYC Validation] PAN Mismatch: Step 4 PAN (${step4Pan}) != DigiLocker PAN (${dlPan})`);
            addToast(`PAN mismatch! The PAN fetched from DigiLocker (${dlPan}) does not match the PAN entered in Step 4 (${step4Pan}). Please re-verify.`, "error");
            
            // Clear Aadhaar state so they can't bypass with the 'Continue' button
            updateState({
              identityDetails: {
                ...identityDetails,
                aadhaar: null
              },
              aadhaarVerified: false,
              panVerified: false
            });

            setTimeout(() => {
              goToStep(4);
            }, 500);

            setLoading(false);
            return;
          }

          if (!isNameMatch || !isDobMatch) {
            const reason = !isNameMatch ? "Name mismatch" : "DOB mismatch";
            addToast(`Aadhaar details (${reason}) do not match with PAN. Please re-verify.`, "error");
            
            // Clear Aadhaar state so they can't bypass with the 'Continue' button
            updateState({
              identityDetails: {
                ...identityDetails,
                aadhaar: null
              },
              aadhaarVerified: false,
              panVerified: false
            });

            setTimeout(() => {
              goToStep(4);
            }, 500);

            setLoading(false);
            return;
          }

          // Record verification fingerprint so this step auto-skips on re-navigation
          const aadhaarNumber = result.updates.identityDetails?.aadhaar;
          if (aadhaarNumber) {
            markStepVerified(5, `aadhaar:${aadhaarNumber}`);
          }
          nextStep({
            identityDetails: { 
              ...identityDetails, 
              ...result.updates.identityDetails,
              manualPan: step4Pan || formatPanValue(identityDetails?.pan),
              digilockerPan: dlPan || formatPanValue(result.updates.identityDetails?.pan) || "",
              pan: dlPan || step4Pan || formatPanValue(identityDetails?.pan),
            },
            personalDetails: { 
              ...personalDetails, 
              ...result.updates.personalDetails,
              fatherName: personalDetails?.fatherName || result.updates.personalDetails?.fatherName || "",
              email: personalDetails?.email || result.updates.personalDetails?.email || "",
            },
            address: { ...address, ...result.updates.address },
            aadhaarVerified: !!result.updates.identityDetails?.aadhaar,
            selfie: { ...result.updates.selfieDetails },
            faceMatchScore: result.updates.selfieDetails?.matchScore || null
          });
        } else {
          addToast("DigiLocker data synced successfully", "success");
          nextStep();
        }
      } else {
        addToast("Failed to sync DigiLocker data", "error");
        setLoading(false);
      }
    } catch (err) {
      addToast("Error fetching DigiLocker results", "error");
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    
    // Check for Digio Redirect URL return
    const searchParams = new URLSearchParams(window.location.search);
    const documentId = searchParams.get("document_id") || searchParams.get("digio_doc_id");
    const status = searchParams.get("message") || searchParams.get("status");
    
    if (documentId && status && !loading) {
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // If opened in a popup/new tab, notify opener and close
      if (window.opener && window.opener !== window) {
        window.opener.postMessage({ type: 'DIGIO_SUCCESS', documentId, step: 'DIGILOCKER' }, window.location.origin);
        window.close();
        return;
      }

      handleDigioSuccess(documentId);
    }

    // Listen for messages from popup
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'DIGIO_SUCCESS' && event.data?.step === 'DIGILOCKER') {
         handleDigioSuccess(event.data.documentId);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);


  const startFlow = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setError(null);

      // 1. PRE-INITIALIZE Digio immediately to capture user gesture
      const digioInstance = initializeDigio({
        environment: "production",
        callback: async (response) => {
          if (response.error_code) {
            addToast(`Authentication failed: ${response.message}`, "error");
            setLoading(false);
            setError(response.message);
          } else {
            handleDigioSuccess(currentRequestId.current || response.digio_doc_id);
          }
        }
      });

      if (digioInstance && !digioInstance.is_redirection_approach) {
        digioInstance.init(); // Opens the window/tab immediately if not using full redirect
      }

      // 2. NOW create the request on the background
      const requestData = await createDigioRequest("DIGILOCKER", {
        documentTypes: ["AADHAAR", "PAN"],
      });
      
      const { requestId, customerIdentifier, applicationId, accessToken } = requestData;
      currentRequestId.current = requestId; // Store for the callback
      
      if (applicationId) setApplicationId(applicationId);

      if (digioInstance && requestId) {
        // 3. Submit to the ALREADY OPENED window or redirect
        if (accessToken) {
          digioInstance.submit(requestId, customerIdentifier, accessToken);
        } else {
          digioInstance.submit(requestId, customerIdentifier);
        }
      } else {
        setLoading(false);
        setError("Unable to initialize DigiLocker flow");
      }
    } catch (err) {
      console.error("DigiLocker Step Error:", err);
      setError(err.message || "Connection failed");
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="container-sm" style={{ 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center",
      justifyContent: "center",
      minHeight: "50vh"
    }}>
      
      <div className="text-center" style={{ maxWidth: 500 }}>
        <h2 className="text-section" style={{ marginBottom: 12 }}>Connect DigiLocker</h2>
        <p className="text-body" style={{ marginBottom: 32, fontWeight: 600, color: "var(--text-muted)" }}>
          We'll now connect to your official DigiLocker account to securely fetch your Aadhaar and PAN details.
        </p>

        {error && (
          <div style={{ 
            background: "rgba(255, 71, 71, 0.05)", 
            border: "1px solid var(--wise-danger)", 
            padding: "16px", 
            borderRadius: "12px", 
            marginBottom: "24px",
            color: "var(--wise-danger)",
            fontSize: "0.9rem"
          }}>
            {error}
          </div>
        )}

        {identityDetails?.aadhaar ? (
          <button 
            className="btn btn-primary" 
            onClick={() => nextStep()}
            style={{ width: "100%", height: "56px", fontSize: "1.1rem", background: "var(--wise-green)", color: "#000" }}
          >
            Aadhaar Verified - Continue
          </button>
        ) : (
          <button 
            className="btn btn-primary" 
            disabled={loading}
            onClick={startFlow}
            style={{ width: "100%", height: "56px", fontSize: "1.1rem" }}
          >
            {loading ? "Connecting..." : "Proceed to DigiLocker"}
          </button>
        )}

        <p className="text-caption" style={{ marginTop: 24, marginBottom: 24, fontSize: "0.8rem", opacity: 0.7 }}>
          Clicking above will open a secure Government portal in a new window.
        </p>


      </div>

      <div style={{ 
        marginTop: 60, 
        padding: "24px", 
        background: "var(--bg-primary)", 
        borderRadius: "16px", 
        border: "1px solid var(--border-color)",
        maxWidth: 450
      }}>
        <div className="text-left">
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5, textAlign: "center" }}>
            Your data is encrypted and transferred directly. We never see or store your DigiLocker password.
          </div>
        </div>
      </div>
    </div>
  );
}
