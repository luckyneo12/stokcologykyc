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
  const { nextStep, addToast, setApplicationId, updateState, personalDetails, identityDetails, address, goToStep } = useKYC();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const currentRequestId = useRef(null);

  useEffect(() => {
    setMounted(true);
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
            try {
              setLoading(true);
              // We need the requestId here, so we'll store it in a ref or local closure
              const result = await fetchDigioRequestResponse(currentRequestId.current, "DIGILOCKER");
              if (result && result.success) {
                if (result.updates) {
                  const panName = (personalDetails?.fullName || "").trim().toLowerCase();
                  const panDob = personalDetails?.dob || ""; // Expected YYYY-MM-DD
                  
                  const aadhaarName = (result.updates.personalDetails?.fullName || "").trim().toLowerCase();
                  const aadhaarDobRaw = result.updates.personalDetails?.dob || ""; 
                  
                  // Comprehensive DOB Normalization to YYYY-MM-DD
                  const normalizeDate = (dateStr) => {
                    if (!dateStr) return "";
                    // Remove any T00:00:00 suffix if present
                    const cleanDate = dateStr.split("T")[0].replace(/\//g, "-"); 
                    const parts = cleanDate.split("-");
                    
                    if (parts.length !== 3) return cleanDate;
                    
                    // Case: DD-MM-YYYY
                    if (parts[0].length === 2 && parts[2].length === 4) {
                      return `${parts[2]}-${parts[1]}-${parts[0]}`;
                    }
                    // Case: YYYY-MM-DD (already correct)
                    return cleanDate;
                  };

                  const aadhaarDob = normalizeDate(aadhaarDobRaw);
                  const normalizedPanDob = normalizeDate(panDob);

                  // Strict Name Match: Must be exactly the same after normalization
                  const isNameMatch = !aadhaarName || !panName || (aadhaarName === panName);
                  
                  const isDobMatch = !aadhaarDob || !normalizedPanDob || (aadhaarDob === normalizedPanDob);

                  console.log("[KYC Validation] Comparison:", {
                    pan: { name: panName, dob: normalizedPanDob, raw: personalDetails?.dob },
                    aadhaar: { name: aadhaarName, dob: aadhaarDob, raw: aadhaarDobRaw },
                    matches: { name: isNameMatch, dob: isDobMatch }
                  });

                  if (!isNameMatch || !isDobMatch) {
                    const reason = !isNameMatch ? "Name mismatch" : "DOB mismatch";
                    addToast(`Aadhaar details (${reason}) do not match with PAN. Please re-verify.`, "error");
                    goToStep(4);
                    setLoading(false);
                    return;
                  }

                  nextStep({
                    identityDetails: { 
                      ...identityDetails, 
                      ...result.updates.identityDetails,
                      // Preserve PAN from previous step — DigiLocker doesn't return it
                      pan: formatPanValue(result.updates.identityDetails?.pan) || formatPanValue(identityDetails?.pan),
                    },
                    personalDetails: { 
                      ...personalDetails, 
                      ...result.updates.personalDetails,
                      // Preserve email from email verification step — DigiLocker doesn't return it
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
          }
        }
      });

      if (digioInstance) {
        digioInstance.init(); // Opens the window/tab immediately
      }

      // 2. NOW create the request on the background
      const requestData = await createDigioRequest("DIGILOCKER", {
        documentTypes: ["AADHAAR", "PAN"],
      });
      
      const { requestId, customerIdentifier, applicationId } = requestData;
      currentRequestId.current = requestId; // Store for the callback
      
      if (applicationId) setApplicationId(applicationId);

      if (digioInstance && requestId) {
        // 3. Submit to the ALREADY OPENED window
        digioInstance.submit(requestId, customerIdentifier);
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

        <button 
          className="btn btn-primary" 
          disabled={loading}
          onClick={startFlow}
          style={{ width: "100%", height: "56px", fontSize: "1.1rem" }}
        >
          {loading ? "Connecting..." : "Proceed to DigiLocker"}
        </button>

        <p className="text-caption" style={{ marginTop: 24, fontSize: "0.8rem", opacity: 0.7 }}>
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
