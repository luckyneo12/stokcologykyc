/**
 * Centralized auth / logout utilities.
 *
 * The app stores tokens in localStorage (and sessionStorage for the KYC user
 * journey) under several keys depending on which portal the user is in:
 *   - adminToken  / adminUser     (Super Admin)
 *   - globeToken  / globeUser     (Globe reviewer)
 *   - kycToken    / kycUser       (KYC Team / Maker-Checker)
 *   - apToken     / apUser        (Associate Partner)
 *   - kycToken    / token         (end-user KYC journey)
 *
 * Logout must clear ALL of these across BOTH storages, otherwise a stale token
 * from another portal could silently re-authenticate the user on the next
 * request. This module is the single source of truth for that cleanup.
 */

import { API_BASE_URL } from "./apiConfig";

// Every token / user key we know about across all portals.
export const AUTH_KEYS = {
  TOKENS: [
    "adminToken",
    "globeToken",
    "kycToken",
    "apToken",
    "token",
  ],
  USERS: [
    "adminUser",
    "globeUser",
    "kycUser",
    "apUser",
  ],
  // Application-level keys that must be wiped when a KYC user logs out.
  KYC_STATE: [
    "kycApplicationId",
    "kyc-progress",
    "kycRejectionMode",
    "kycRejectedSteps",
    "kyc-theme",
  ],
};

/**
 * Remove a list of keys from BOTH localStorage and sessionStorage.
 * Safe to call in SSR (window undefined) — guarded internally.
 */
function clearKeysBothStorages(keys) {
  if (typeof window === "undefined") return;
  const storages = [localStorage, sessionStorage];
  for (const storage of storages) {
    for (const key of keys) {
      try {
        storage.removeItem(key);
      } catch (e) {
        // Ignore quota / security errors — best-effort cleanup.
      }
    }
  }
}

/**
 * Clear every auth token and user object across all portals and storages.
 * Also wipes the KYC application state so the user starts fresh on next visit.
 */
export function clearAuthState() {
  clearKeysBothStorages([
    ...AUTH_KEYS.TOKENS,
    ...AUTH_KEYS.USERS,
    ...AUTH_KEYS.KYC_STATE,
  ]);

  // Also remove any kyc-draft-* keys (per-application local drafts)
  if (typeof window !== "undefined") {
    for (const storage of [localStorage, sessionStorage]) {
      try {
        const keysToRemove = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && key.startsWith("kyc-draft-")) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => storage.removeItem(k));
      } catch (e) {
        // Ignore
      }
    }
  }
}

/**
 * Fire a best-effort server-side logout audit event.
 * Non-fatal: if the server is unreachable or the token is invalid we still
 * complete the client-side cleanup.
 */
export async function notifyServerLogout(token) {
  if (!token) return;
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  } catch (e) {
    // Best-effort only — logout should still succeed client-side.
    console.warn("[Auth] Server logout notification failed:", e);
  }
}

/**
 * Resolve the currently active token, preferring the active portal's token.
 */
export function getActiveToken() {
  if (typeof window === "undefined") return null;
  for (const key of AUTH_KEYS.TOKENS) {
    const val =
      sessionStorage.getItem(key) ||
      localStorage.getItem(key);
    if (val) return val;
  }
  return null;
}

/**
 * Perform a full logout:
 *   1. Notify the server (audit log) with the active token.
 *   2. Clear all auth state from both storages.
 *   3. Optionally reset the KYC context state (via callback).
 *   4. Redirect to a given login path.
 *
 * @param {object} opts
 * @param {string} opts.redirectPath - where to send the user after logout.
 * @param {function} opts.resetKyc - optional callback to reset KYC context state.
 * @param {string} opts.token - explicit token override (defaults to active token).
 */
export async function logoutUser({
  redirectPath = "/",
  resetKyc = null,
  token = null,
} = {}) {
  const activeToken = token || getActiveToken();

  // 1. Server-side audit event (non-blocking)
  await notifyServerLogout(activeToken);

  // 2. Clear all local auth state
  clearAuthState();

  // 3. Reset KYC context if the caller provides a resetter
  if (typeof resetKyc === "function") {
    try {
      resetKyc();
    } catch (e) {
      console.warn("[Auth] KYC reset callback failed:", e);
    }
  }

  // 4. Redirect
  if (typeof window !== "undefined") {
    window.location.href = redirectPath;
  }
}