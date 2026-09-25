"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { initializeDigio, createDigioRequest, fetchDigioRequestResponse } from "@/utils/digio";

function MobileSelfieContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("loading"); // loading, ready, processing, success, error, expired
  const [errorMessage, setErrorMessage] = useState("");
  const [locationDenied, setLocationDenied] = useState(false);
  const hasProcessedRedirect = useRef(false);

  useEffect(() => {
    const urlToken = searchParams.get("token");
    const urlAppId = searchParams.get("appId");
    
    // Digio redirect may strip URL query parameters, so fallback to sessionStorage
    const token = urlToken || sessionStorage.getItem("kycToken");
    const appId = urlAppId || sessionStorage.getItem("kycApplicationId");
    
    // Check for Digio Redirect Return
    const documentId = searchParams.get("document_id") || searchParams.get("digio_doc_id");
    const digioMessage = searchParams.get("message") || searchParams.get("status");

    if (!token || !appId) {
      setStatus("error");
      setErrorMessage("Invalid link. Please scan the QR code again.");
      return;
    }

    if (urlToken) sessionStorage.setItem("kycToken", urlToken);
    if (urlAppId) sessionStorage.setItem("kycApplicationId", urlAppId);

    if (documentId && digioMessage && !hasProcessedRedirect.current) {
      hasProcessedRedirect.current = true;
      setStatus("processing");
      
      const msgLower = digioMessage.toLowerCase();
      const isSuccess = 
        msgLower.includes("success") || 
        msgLower.includes("completed") || 
        msgLower.includes("done") || 
        digioMessage === "Sign completed";

      if (isSuccess) {
        let savedCoords = null;
        try {
          const rawCoords = sessionStorage.getItem("mobileSelfieCoords");
          if (rawCoords) savedCoords = JSON.parse(rawCoords);
        } catch (e) {}

        fetchDigioRequestResponse(documentId, "SELFIE", appId, savedCoords ? { coords: savedCoords, lat: savedCoords.lat, lng: savedCoords.lng } : {})
          .then(async (res) => {
             if (res?.success) {
                setStatus("success");
             } else {
                setStatus("error");
                setErrorMessage("Failed to fetch verification results.");
             }
          })
          .catch((err) => {
             setStatus("error");
             setErrorMessage("Error verifying selfie.");
          });
      } else {
        setStatus("error");
        setErrorMessage(`Selfie verification failed: ${digioMessage}`);
      }
    } else if (status === "loading") {
       setStatus("ready");
    }
  }, [searchParams, status]);

  // ─── Helper: Get location with enforcement (same as desktop SelfieStep) ───
  const getRequiredLocation = async () => {
    if (!("geolocation" in navigator)) {
      return { success: false, error: "location_unavailable" };
    }
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });
      return { success: true, lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch (err) {
      // err.code: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
      if (err.code === 1) return { success: false, error: "permission_denied" };
      if (err.code === 3) return { success: false, error: "timeout" };
      return { success: false, error: "position_unavailable" };
    }
  };

  const startVerification = async () => {
    setStatus("processing");
    setLocationDenied(false);

    // 1. Get location FIRST — mandatory (same enforcement as desktop)
    const locResult = await getRequiredLocation();
    if (!locResult.success) {
      setLocationDenied(true);
      setStatus("ready");
      if (locResult.error === "permission_denied") {
        setErrorMessage("Location permission is required for selfie verification. Please allow location access in your browser settings and try again.");
      } else if (locResult.error === "timeout") {
        setErrorMessage("Could not fetch your location in time. Please check that your GPS is turned on and try again.");
      } else {
        setErrorMessage("Location services are not available. Please enable GPS/Location on your device and try again.");
      }
      return;
    }

    const coords = { lat: locResult.lat, lng: locResult.lng };
    try {
      sessionStorage.setItem("mobileSelfieCoords", JSON.stringify(coords));
    } catch (e) {}

    // 2. Wait for Digio SDK to be available
    if (typeof window !== "undefined" && !window.Digio) {
      let waited = 0;
      while (!window.Digio && waited < 3000) {
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
      }
      if (!window.Digio) {
        setStatus("error");
        setErrorMessage("Verification SDK is still loading. Please try again.");
        return;
      }
    }

    try {
      // 3. Pass coords and explicit appId to createDigioRequest
      const storedToken = sessionStorage.getItem("kycToken") || "";
      const storedAppId = sessionStorage.getItem("kycApplicationId") || searchParams.get("appId") || "";
      const requestData = await createDigioRequest("SELFIE", coords, storedAppId);
      const { requestId, customerIdentifier, accessToken } = requestData;

      // Build redirect URL preserving token & appId for the return trip
      const redirectBase = window.location.origin + window.location.pathname;
      const redirectUrl = `${redirectBase}?token=${encodeURIComponent(storedToken)}&appId=${encodeURIComponent(storedAppId)}`;

      const digio = initializeDigio({
        is_redirection_approach: true,
        redirect_url: redirectUrl,
        callback: (response) => {
          if (response.error_code && response.error_code !== "success") {
            setStatus("error");
            setErrorMessage(`Selfie verification failed: ${response.message}`);
            return;
          }
          
          setStatus("processing");
          const docId = response.document_id || response.digio_doc_id || requestId;
          if (docId) {
            fetchDigioRequestResponse(docId, "SELFIE", storedAppId, { coords, lat: coords.lat, lng: coords.lng })
              .then(async (res) => {
                 if (res?.success) {
                    setStatus("success");
                 } else {
                    setStatus("error");
                    setErrorMessage("Failed to fetch verification results.");
                 }
              })
              .catch((err) => {
                 setStatus("error");
                 setErrorMessage("Error verifying selfie.");
              });
          }
        }
      });

      if (!digio || !requestId) {
        setStatus("error");
        setErrorMessage("Unable to initialize selfie verification flow");
        return;
      }

      // Always call init() before submit() — required for proper SDK setup
      digio.init();

      // Small delay to let SDK UI initialize before submitting
      await new Promise(r => setTimeout(r, 300));

      if (accessToken) {
        digio.submit(requestId, customerIdentifier, accessToken);
      } else {
        digio.submit(requestId, customerIdentifier);
      }
    } catch (error) {
       setStatus("error");
       setErrorMessage(error?.message || "Error connecting to verification service");
    }
  };

  if (status === "loading") {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
         <div className="loader" style={{ width: 40, height: 40 }}></div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)', padding: 24, textAlign: 'center' }}>
         <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--wise-green)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 style={{ fontSize: "1.5rem", marginBottom: 12, color: "var(--text-primary)" }}>Selfie Captured!</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1rem", lineHeight: 1.5 }}>
            Your selfie has been successfully captured and synced. You can now close this window and return to your device to continue.
          </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: 24, display: 'flex', flexDirection: 'column' }}>
       <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 400, margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h1 style={{ fontSize: "1.8rem", marginBottom: 8, color: "var(--text-primary)", fontWeight: 800 }}>Selfie Verification</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Please complete the live face capture to verify your identity.
            </p>
          </div>

          {/* Location denied warning banner for mobile */}
          {locationDenied && (
            <div style={{
              background: "rgba(247, 85, 85, 0.08)",
              border: "1px solid rgba(247, 85, 85, 0.3)",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 24,
              textAlign: "left"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <strong style={{ color: "#ef4444", fontSize: "0.95rem" }}>Location Permission Required</strong>
              </div>
              <p style={{ margin: "0 0 8px 0", fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Your location is mandatory for selfie verification as per regulatory requirements. Without it, the selfie cannot be captured.
              </p>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                <strong>How to enable:</strong> Go to your phone&apos;s Settings → turn on GPS/Location. In your browser, tap the lock icon in the address bar → Site Settings → Location → Allow. Then tap the button below to retry.
              </p>
            </div>
          )}

          {status === "error" && !locationDenied && (
            <div style={{ padding: 16, background: "rgba(247, 85, 85, 0.1)", border: "1px solid var(--wise-danger)", borderRadius: 12, marginBottom: 24, textAlign: "center" }}>
              <p style={{ color: "var(--wise-danger)", margin: 0, fontWeight: 600 }}>{errorMessage}</p>
            </div>
          )}

          {status === "processing" ? (
             <div style={{ textAlign: 'center', padding: 32 }}>
                <div className="loader" style={{ margin: '0 auto 20px', width: 32, height: 32 }}></div>
                <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>Starting secure capture...</p>
             </div>
          ) : (
            <button 
              onClick={startVerification}
              style={{
                width: "100%", height: "56px", borderRadius: "12px", 
                background: "var(--wise-green)", color: "#000",
                fontSize: "1.1rem", fontWeight: 800, border: "none",
                cursor: "pointer", boxShadow: "0 4px 14px rgba(159, 232, 112, 0.4)"
              }}
            >
              {locationDenied ? "Retry with Location" : "Start Camera"}
            </button>
          )}
       </div>
    </div>
  );
}

export default function MobileSelfiePage() {
  return (
    <Suspense fallback={<div style={{height: '100vh', background: 'var(--bg-primary)'}} />}>
      <MobileSelfieContent />
    </Suspense>
  );
}
