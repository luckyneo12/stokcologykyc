const crypto = require("crypto");
const smsService = require("../services/smsService");
const emailService = require("../services/emailService");

// One-time passwords for ReKYC (login and new mobile / e-mail). In memory, like the KYC portal's
// OTP store: valid 5 minutes, 5 wrong tries, 30 seconds between sends.
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_GAP_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;
const store = new Map();

function sweep() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key);
  }
}

function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? `XXXXXX${digits.slice(-4)}` : "";
}

function maskEmail(email) {
  const [user, domain] = String(email || "").split("@");
  if (!user || !domain) return "";
  return `${user.slice(0, 2)}${"*".repeat(Math.max(user.length - 2, 2))}@${domain}`;
}

/**
 * Sends one OTP to the phone and/or e-mail given. key identifies what the OTP is for
 * (e.g. "login:HO0010" or "mobile:<requestId>").
 */
async function sendOtp(key, { phone, email }) {
  sweep();
  const previous = store.get(key);
  if (previous && Date.now() - previous.sentAt < RESEND_GAP_MS) {
    const wait = Math.ceil((RESEND_GAP_MS - (Date.now() - previous.sentAt)) / 1000);
    const error = new Error(`Please wait ${wait} seconds before requesting a new OTP.`);
    error.status = 429;
    error.expose = true;
    throw error;
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  const phoneDigits = String(phone || "").replace(/\D/g, "").slice(-10);
  const fail = (message, status) => Object.assign(new Error(message), { status, expose: true });
  if (phoneDigits.length !== 10 && !email) throw fail("No mobile number or e-mail is available to send the OTP.", 400);

  // Sent to every channel given; it is enough that one of them works
  const sentTo = [];
  if (phoneDigits.length === 10) {
    try {
      await smsService.sendMobileOtp(phoneDigits, otp);
      sentTo.push(maskPhone(phoneDigits));
    } catch (error) {
      console.error("[ReKYC OTP] SMS failed:", error.message);
    }
  }
  if (email) {
    try {
      await emailService.sendOtpEmail(email, otp);
      sentTo.push(maskEmail(email));
    } catch (error) {
      console.error("[ReKYC OTP] E-mail failed:", error.message);
    }
  }
  if (!sentTo.length) throw fail("We could not send the OTP right now. Please try again in a moment.", 503);

  store.set(key, { otp, expiresAt: Date.now() + OTP_TTL_MS, sentAt: Date.now(), attempts: 0 });
  return { sentTo };
}

/** Returns true once for a correct OTP (the OTP is then used up). */
function verifyOtp(key, otp) {
  sweep();
  const entry = store.get(key);
  if (!entry) return { ok: false, error: "OTP expired. Please request a new one." };
  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(key);
    return { ok: false, error: "Too many wrong attempts. Please request a new OTP." };
  }
  const given = String(otp || "").trim();
  const match = given.length === entry.otp.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(entry.otp));
  if (!match) {
    entry.attempts += 1;
    return { ok: false, error: "Incorrect OTP." };
  }
  store.delete(key);
  return { ok: true };
}

module.exports = { sendOtp, verifyOtp, maskPhone, maskEmail };
