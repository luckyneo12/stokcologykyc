/**
 * Selfie provider switch.
 *
 *   "inhouse" (default) → our own camera screen (src/components/kyc/selfie/LiveSelfieCapture.js)
 *                         with real-time face checks, liveness challenge and mandatory location.
 *   "digio"             → the Digio Secure Capture SDK flow.
 *
 * TO SWITCH: set NEXT_PUBLIC_SELFIE_PROVIDER=digio (or inhouse) in the frontend .env, or change
 * the default below, then restart/rebuild. Both flows stay in the code; only this flag picks one.
 */
// Active: in-house camera.
export const SELFIE_PROVIDER = (process.env.NEXT_PUBLIC_SELFIE_PROVIDER || "inhouse").toLowerCase();
// Digio SDK flow — uncomment this and comment out the active line above to switch to Digio
// (template set in server/src/services/selfieService.js):
// export const SELFIE_PROVIDER = (process.env.NEXT_PUBLIC_SELFIE_PROVIDER || "digio").toLowerCase();

export const USE_INHOUSE_SELFIE = SELFIE_PROVIDER !== "digio";

/**
 * In-house selfie options (both OFF by default):
 *
 *   SELFIE_LIVENESS_ACTIONS  true  → head-turn + blink actions, then auto-capture (previous flow).
 *                            false → plain camera + "Click Selfie" button. Every photo check stays
 *                                    (one face only, no goggles / glasses, looking straight) and the
 *                                    server still runs Digio passive liveness + face match.
 *                            Must match SELFIE_LIVENESS_ACTIONS in the server .env.
 *   SELFIE_GUIDE             true  → instructor video + voice guidance (Hindi / English).
 *                            false → a simple text status card.
 *
 * TO SWITCH: set NEXT_PUBLIC_SELFIE_LIVENESS_ACTIONS=true / NEXT_PUBLIC_SELFIE_GUIDE=true in the
 * frontend .env (or change the defaults below), then restart/rebuild.
 */
export const SELFIE_LIVENESS_ACTIONS = (process.env.NEXT_PUBLIC_SELFIE_LIVENESS_ACTIONS || "false").toLowerCase() === "true";
export const SELFIE_GUIDE = (process.env.NEXT_PUBLIC_SELFIE_GUIDE || "false").toLowerCase() === "true";
