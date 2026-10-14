/**
 * Mandatory location for the Digio selfie flows (normal portal, QR mobile page, correction portal).
 *
 * Asking only for a high-accuracy fix with maximumAge 0 makes phones wait for a real GPS lock,
 * which indoors often doesn't arrive in time — the request then fails with "timeout" even though
 * the permission was granted. So two requests run at once:
 *   - a quick network / cached reading (usually answers in well under a second)
 *   - a high-accuracy GPS reading
 * The first one to answer is used. It fails only when both fail (a denial always wins).
 *
 * @returns {Promise<{ success: true, lat, lng, accuracy } | { success: false, error: "permission_denied" | "timeout" | "position_unavailable" | "location_unavailable" }>}
 */
const QUICK_OPTIONS = { enableHighAccuracy: false, timeout: 15000, maximumAge: 2 * 60 * 1000 };
const PRECISE_OPTIONS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 };

export function getRequiredLocation() {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve({ success: false, error: "location_unavailable" });
  }
  return new Promise((resolve) => {
    let settled = false;
    const errors = [];
    const onSuccess = (pos) => {
      if (settled) return;
      settled = true;
      resolve({ success: true, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
    };
    const onError = (err) => {
      if (settled) return;
      // err.code: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
      if (err?.code === 1) {
        settled = true;
        resolve({ success: false, error: "permission_denied" });
        return;
      }
      errors.push(err);
      if (errors.length < 2) return; // the other request may still answer
      settled = true;
      resolve({ success: false, error: errors.every((e) => e?.code === 3) ? "timeout" : "position_unavailable" });
    };
    try {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, QUICK_OPTIONS);
      navigator.geolocation.getCurrentPosition(onSuccess, onError, PRECISE_OPTIONS);
    } catch (e) {
      settled = true;
      resolve({ success: false, error: "location_unavailable" });
    }
  });
}
