"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { initializeDigio, createDigioRequest, fetchDigioRequestResponse } from "@/utils/digio";
import { getRequiredLocation } from "@/utils/location";
import LiveSelfieCapture from "@/components/kyc/selfie/LiveSelfieCapture";
import { USE_INHOUSE_SELFIE } from "@/config/selfieConfig";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const SESSION_KEY = "mobileSelfieSession";
const EXPIRED_MSG = "This QR code has expired. Please generate a new QR code on your computer and scan it again.";
const REPLACED_MSG = "A newer QR code was generated on your computer. Please scan the latest QR code.";

/** Claims of a JWT (not verified — only used to read the expiry / purpose; the server verifies). */
function readJwt(token) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "=")));
  } catch (e) {
    return null;
  }
}

function tokenExpiresAtMs(token) {
  const exp = readJwt(token)?.exp;
  return exp ? exp * 1000 : null;
}

/**
 * Turns the token from the QR link into a capture session:
 *   QR token (5 min)  → exchanged once at /mobile-session/claim for a 15-minute session token.
 *                       A reload of the same link reuses that session (even after the QR's 5 minutes).
 *   session token     → (Digio redirect return / older links) used as is while it is valid.
 * Returns { token, expiresAtMs } | { expired: message } | { error: message }.
 */
async function resolveSession(urlToken, appId) {
  const claims = urlToken ? readJwt(urlToken) : null;

  if (claims?.purpose === "mobile_selfie_qr") {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (saved && saved.qrIssuedAtMs === claims.issuedAtMs && saved.appId === appId && saved.expiresAtMs > Date.now()) {
        return { token: saved.token, expiresAtMs: saved.expiresAtMs };
      }
    } catch (e) {}
    if (claims.exp && claims.exp * 1000 <= Date.now()) return { expired: EXPIRED_MSG };

    let res, data;
    try {
      res = await fetch(`${API_BASE_URL}/api/kyc/mobile-session/claim`, {
        method: "POST",
        headers: { Authorization: `Bearer ${urlToken}` },
      });
      data = await res.json().catch(() => ({}));
    } catch (e) {
      return { error: "Network error. Check your internet connection and reload this page." };
    }
    if (res.status === 401) return { expired: data?.code === "MOBILE_SESSION_REPLACED" ? REPLACED_MSG : EXPIRED_MSG };
    if (!res.ok || !data?.success || !data.token) return { error: data?.error || "Could not open the selfie session. Please scan the QR code again." };

    const expiresAtMs = tokenExpiresAtMs(data.token) || Date.now() + 15 * 60 * 1000;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ qrIssuedAtMs: claims.issuedAtMs, appId, token: data.token, expiresAtMs }));
    } catch (e) {}
    return { token: data.token, expiresAtMs };
  }

  // Session token (Digio redirect return, or a link generated before this change)
  const token = urlToken || sessionStorage.getItem("kycToken");
  if (!token) return { error: "Invalid link. Please scan the QR code again." };
  const expiresAtMs = tokenExpiresAtMs(token);
  if (expiresAtMs && expiresAtMs <= Date.now()) return { expired: EXPIRED_MSG };
  return { token, expiresAtMs };
}

function MobileSelfieContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("loading"); // loading, ready, processing, success, error, expired
  const [errorMessage, setErrorMessage] = useState("");
  const [locationDenied, setLocationDenied] = useState(false);
  const [session, setSession] = useState({ token: null, appId: null });
  const [sessionExpiresAtMs, setSessionExpiresAtMs] = useState(null);
  const hasProcessedRedirect = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const urlToken = searchParams.get("token");
    const urlAppId = searchParams.get("appId");

    (async () => {
      // Digio redirect may strip URL query parameters, so fallback to sessionStorage
      const appId = urlAppId || sessionStorage.getItem("kycApplicationId");
      if (!appId || (!urlToken && !sessionStorage.getItem("kycToken"))) {
        setStatus("error");
        setErrorMessage("Invalid link. Please scan the QR code again.");
        return;
      }

      // The QR's validity is checked BEFORE anything starts (camera, location, Digio)
      const resolved = await resolveSession(urlToken, appId);
      if (cancelled) return;
      if (resolved.expired) {
        setErrorMessage(resolved.expired);
        setStatus("expired");
        return;
      }
      if (resolved.error) {
        setErrorMessage(resolved.error);
        setStatus("error");
        return;
      }
      const token = resolved.token;
      sessionStorage.setItem("kycToken", token);
      sessionStorage.setItem("kycApplicationId", appId);
      setSessionExpiresAtMs(resolved.expiresAtMs || null);
      setSession((prev) => (prev.token === token && prev.appId === appId ? prev : { token, appId }));

      // Check for Digio Redirect Return
      const documentId = searchParams.get("document_id") || searchParams.get("digio_doc_id");
      const digioMessage = searchParams.get("message") || searchParams.get("status");

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
      } else {
        setStatus((prev) => (prev === "loading" ? "ready" : prev));
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams]);

  // The session ends while the page is open → stop (unmounts the camera) and show the expired screen
  useEffect(() => {
    if (!sessionExpiresAtMs) return;
    const expire = () => {
      setStatus((prev) => (prev === "success" || prev === "expired" ? prev : "expired"));
      setErrorMessage(EXPIRED_MSG);
    };
    const ms = sessionExpiresAtMs - Date.now();
    if (ms <= 0) {
      expire();
      return;
    }
    const t = setTimeout(expire, Math.min(ms, 2147483647));
    return () => clearTimeout(t);
  }, [sessionExpiresAtMs]);

  const handleSessionExpired = (message) => {
    setErrorMessage(message || EXPIRED_MSG);
    setStatus((prev) => (prev === "success" ? prev : "expired"));
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

  if (status === "expired") {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)', padding: 24, textAlign: 'center' }}>
        <div style={{ maxWidth: 400, width: '100%', padding: 20, background: "rgba(247, 85, 85, 0.1)", border: "1px solid var(--wise-danger)", borderRadius: 12 }}>
          <h1 style={{ fontSize: "1.3rem", marginBottom: 10, color: "var(--wise-danger)", fontWeight: 800 }}>QR Code Expired</h1>
          <p style={{ color: "var(--text-primary)", margin: 0, fontWeight: 600, lineHeight: 1.5 }}>{errorMessage || EXPIRED_MSG}</p>
          <p style={{ color: "var(--text-secondary)", margin: "12px 0 0", fontSize: "0.9rem" }}>No selfie was taken. You can close this page.</p>
        </div>
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

  // ─── IN-HOUSE SELFIE (active when USE_INHOUSE_SELFIE, see src/config/selfieConfig.js) ───
  // The QR token/appId are passed straight to the capture; the desktop picks the result up
  // through its existing socket + polling watcher.
  if (USE_INHOUSE_SELFIE) {
    if (status === "error") {
      return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: 400, width: '100%', padding: 16, background: "rgba(247, 85, 85, 0.1)", border: "1px solid var(--wise-danger)", borderRadius: 12, textAlign: "center" }}>
            <p style={{ color: "var(--wise-danger)", margin: 0, fontWeight: 600 }}>{errorMessage || "Something went wrong. Please scan the QR code again."}</p>
          </div>
        </div>
      );
    }
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '16px 0' }}>
        <LiveSelfieCapture
          variant="page"
          applicationId={session.appId}
          authToken={session.token}
          onSuccess={() => setStatus("success")}
          onSessionExpired={handleSessionExpired}
        />
      </div>
    );
  }

  // ─── LEGACY DIGIO SELFIE FLOW (used only when NEXT_PUBLIC_SELFIE_PROVIDER=digio) ───
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
