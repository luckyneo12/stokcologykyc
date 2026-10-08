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
export const SELFIE_PROVIDER = (process.env.NEXT_PUBLIC_SELFIE_PROVIDER || "inhouse").toLowerCase();

export const USE_INHOUSE_SELFIE = SELFIE_PROVIDER !== "digio";
