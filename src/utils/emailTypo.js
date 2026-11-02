/**
 * Email domain typo detection (e.g. "gmail.co", "gmial.com", "yaho.com").
 * KEEP IN SYNC with server/src/utils/emailTypo.js — the server re-runs the same check on Send OTP.
 *
 * getEmailTypoSuggestion("vivek@gmail.co") -> "vivek@gmail.com"
 * getEmailTypoSuggestion("vivek@gmail.com") -> null (no typo)
 */

// Providers we correct typos towards
const POPULAR_DOMAINS = [
  "gmail.com", "yahoo.com", "yahoo.co.in", "yahoo.in", "outlook.com", "outlook.in",
  "hotmail.com", "live.com", "rediffmail.com", "icloud.com",
];

// Real domains that look close to a popular one — never flagged
const ALLOWED_DOMAINS = new Set([
  "googlemail.com", "mail.com", "email.com", "ymail.com", "gmx.com", "gmx.net", "rocketmail.com",
  "live.in", "live.co.uk", "live.ca", "msn.com", "me.com", "mac.com", "aol.com", "aol.in",
  "cloud.com", "proton.me", "protonmail.com", "zoho.com", "zohomail.com", "zohomail.in",
  "yahoo.co.uk", "yahoo.co.id", "yahoo.co.jp", "yahoo.ca", "yahoo.fr", "yahoo.de", "yahoo.com.au", "yahoo.com.sg",
  "hotmail.co.uk", "hotmail.fr", "hotmail.de", "hotmail.it", "hotmail.es",
  "outlook.co.uk", "outlook.fr", "outlook.de",
]);

// Providers that use exactly one domain: "gmail.<anything else>" is always a typo
const SINGLE_DOMAIN_PROVIDERS = { gmail: "gmail.com", rediffmail: "rediffmail.com", icloud: "icloud.com" };

// Endings that are not real domain endings — almost always a mistyped ".com"
const BAD_ENDINGS = ["con", "cmo", "comm", "cpm", "vom", "xom", "ocm", "coom", "cim", "cok"];

// Edit distance counting a swap of two neighbouring letters as one edit ("gmial" -> "gmail" = 1)
const editDistance = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
};

const suggestDomain = (domain) => {
  if (!domain || POPULAR_DOMAINS.includes(domain) || ALLOWED_DOMAINS.has(domain)) return null;

  // "gmail.co", "gmail.in", "gmail.co.in" ...
  const firstLabel = domain.split(".")[0];
  if (SINGLE_DOMAIN_PROVIDERS[firstLabel]) return SINGLE_DOMAIN_PROVIDERS[firstLabel];

  // "1 letter off" from a popular provider ("2 letters off" for the longer names). Short ones like live.com
  // are skipped — too many real domains (dive.com, hive.com) are 1 letter away from them.
  let best = null;
  let bestDistance = Infinity;
  for (const target of POPULAR_DOMAINS) {
    if (target.length < 9) continue;
    const distance = editDistance(domain, target);
    const limit = target.length >= 10 ? 2 : 1;
    if (distance <= limit && distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  if (best) return best;

  // "anything.con" -> "anything.com"
  const parts = domain.split(".");
  if (parts.length >= 2 && BAD_ENDINGS.includes(parts[parts.length - 1])) {
    return [...parts.slice(0, -1), "com"].join(".");
  }
  return null;
};

export const getEmailTypoSuggestion = (email) => {
  const value = String(email || "").trim();
  const at = value.lastIndexOf("@");
  if (at < 1) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1).toLowerCase();
  const suggested = suggestDomain(domain);
  return suggested && suggested !== domain ? `${local}@${suggested}` : null;
};
