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
const crypto = require("crypto");
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

// ── Short QR code ──
// The QR image carries "<issue time base36>.<signature>" (~25 chars) instead of the long JWT, so the
// QR has far fewer squares and scans fast. Stateless: the signature ties the code to the application
// and its owner, so it works across restarts / server processes like the JWT did.
const CODE_SIG_LENGTH = 16; // base64url chars (96 bits)

function codeSignature(applicationId, userId, issuedAtMs) {
  return crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`mobile_selfie_qr|${applicationId}|${userId}|${issuedAtMs}`)
    .digest("base64url")
    .slice(0, CODE_SIG_LENGTH);
}

function makeQrCode(applicationId, userId, issuedAtMs) {
  return `${issuedAtMs.toString(36)}.${codeSignature(applicationId, userId, issuedAtMs)}`;
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
  return {
    token,
    code: makeQrCode(applicationId, userId, issuedAtMs),
    expiresAt: new Date(issuedAtMs + QR_SCAN_SECONDS * 1000).toISOString(),
    expiresInSeconds: QR_SCAN_SECONDS,
  };
}

/**
 * Checks a short QR code (see makeQrCode) for an application owned by userId.
 * Returns { claims } — the same claims a verified QR token has — or { error: "invalid" | "expired" | "replaced" }.
 */
function verifyQrCode(applicationId, userId, code) {
  const match = /^([0-9a-z]{1,12})\.([A-Za-z0-9_-]+)$/.exec(String(code || ""));
  if (!match || !applicationId || userId === undefined || userId === null) return { error: "invalid" };
  const issuedAtMs = parseInt(match[1], 36);
  if (!Number.isSafeInteger(issuedAtMs) || issuedAtMs <= 0) return { error: "invalid" };

  const expected = Buffer.from(codeSignature(applicationId, userId, issuedAtMs));
  const given = Buffer.from(match[2]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return { error: "invalid" };

  const expiresAtMs = issuedAtMs + QR_SCAN_SECONDS * 1000;
  if (Date.now() >= expiresAtMs) return { error: "expired" };

  const claims = {
    id: userId,
    applicationId,
    purpose: QR_PURPOSE,
    role: "user",
    issuedAtMs,
    exp: Math.floor(expiresAtMs / 1000),
  };
  if (isReplaced(claims)) return { error: "replaced" };
  return { claims };
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
  verifyQrCode,
  issueSessionToken,
};
