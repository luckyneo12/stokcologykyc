/**
 * QR → phone selfie sessions.
 *
 *   QR token       purpose "mobile_selfie_qr", lives QR_SCAN_SECONDS (the desktop countdown).
 *                  Only good for opening the link: the phone exchanges it at /mobile-session/claim.
 *   Session token  purpose "mobile_selfie", ends together with the QR it was claimed from
 *                  (never longer than SESSION_SECONDS).
 *
 * Generating a new QR replaces the older ones: tokens of an older QR (and sessions claimed from it)
 * are rejected. The newest issue time per application is kept in memory. A token is rejected only
 * when a NEWER one is known, so a restart or a second server process can never block the newest
 * QR — at worst an older QR keeps working until its own (short) expiry.
 */
const jwt = require("jsonwebtoken");

// Same secret / fallback as middlewares/auth.js, which verifies these tokens
const JWT_SECRET = process.env.JWT_SECRET || "kyc-secret-key-change-in-production";

const QR_SCAN_SECONDS = 5 * 60;
const SESSION_SECONDS = 15 * 60;
const QR_PURPOSE = "mobile_selfie_qr";
const SESSION_PURPOSE = "mobile_selfie";

const latestIssuedAt = new Map(); // applicationId → issuedAtMs of the newest QR

function isMobileSelfieToken(decoded) {
  return decoded?.purpose === QR_PURPOSE || decoded?.purpose === SESSION_PURPOSE;
}

/** True when a newer QR was generated for the same application after this token's QR. */
function isReplaced(decoded) {
  if (!isMobileSelfieToken(decoded) || !decoded.applicationId || !decoded.issuedAtMs) return false;
  const latest = latestIssuedAt.get(String(decoded.applicationId));
  return Boolean(latest && decoded.issuedAtMs < latest);
}

/** New QR token for the desktop; replaces every earlier QR of this application. */
function issueQrToken(userId, applicationId) {
  const issuedAtMs = Date.now();
  latestIssuedAt.set(String(applicationId), issuedAtMs);
  const token = jwt.sign(
    { id: userId, applicationId, purpose: QR_PURPOSE, role: "user", issuedAtMs },
    JWT_SECRET,
    { expiresIn: QR_SCAN_SECONDS },
  );
  return { token, expiresAt: new Date(issuedAtMs + QR_SCAN_SECONDS * 1000).toISOString(), expiresInSeconds: QR_SCAN_SECONDS };
}

/**
 * Capture session for a phone that opened a still-valid QR (decoded = the verified QR token).
 * The session ends together with the QR: when the computer's countdown reaches 0 the phone shows
 * "expired" and the computer offers "Generate New QR".
 */
function issueSessionToken(decoded) {
  const qrSecondsLeft = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : SESSION_SECONDS;
  const sessionSeconds = Math.max(1, Math.min(SESSION_SECONDS, qrSecondsLeft));
  const token = jwt.sign(
    {
      id: decoded.id,
      applicationId: decoded.applicationId,
      purpose: SESSION_PURPOSE,
      role: "user",
      issuedAtMs: decoded.issuedAtMs, // same QR → replaced together with it
    },
    JWT_SECRET,
    { expiresIn: sessionSeconds },
  );
  return { token, expiresAt: new Date(Date.now() + sessionSeconds * 1000).toISOString() };
}

module.exports = {
  QR_PURPOSE,
  SESSION_PURPOSE,
  isMobileSelfieToken,
  isReplaced,
  issueQrToken,
  issueSessionToken,
};
