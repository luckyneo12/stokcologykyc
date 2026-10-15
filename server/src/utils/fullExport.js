/**
 * "Export All" for the admin maker-checker: every stored detail of each application, as columns
 * GROUPED by topic (all bank columns together, all nominee-1 columns together, …).
 *
 * Read-only: builds values from what is already stored; nothing is written. Each column reads every
 * format the data has been saved in over time (e.g. `aadhaar` / `aadhar`, the old nominee array,
 * bank address as one field or three lines), so older applications don't come out blank.
 * Data the portal does not collect (KRA, reverse penny drop, account aggregator, OTP times, brokerage,
 * FATCA details, exchange-wise segments) is intentionally not included.
 */

const { mapState } = require("../services/backofficeService");

const MAX_NOMINEES = 3; // the portal allows at most 3 nominees
const NAME_MATCH_MIN = 80; // % similarity counted as a name match in the match columns

const STEP_LABELS = {
  0: "Welcome", 1: "Phone", 2: "Email", 3: "Pricing", 4: "PAN", 5: "DigiLocker", 6: "Personal Details",
  7: "Nominee Choice", 8: "Nominee", 9: "Allocation", 10: "Bank", 11: "Document Upload",
  12: "eSign Preview", 13: "Aadhaar eSign", 14: "eSign Done",
};

// Reviewed modules (stepStatuses keys) → name used in the export headers
const REVIEW_MODULES = [
  ["personalDetails", "PERSONAL DETAILS"],
  ["panVerification", "PAN"],
  ["panUpload", "PAN UPLOAD"],
  ["bankVerification", "BANK"],
  ["financialProof", "UPLOAD INCOME PROOF"],
  ["signature", "SIGNATURE UPLOAD"],
  ["ipv", "CLIENTIMAGE"],
  ["pepProof", "P E DOCUMENT"],
  ["nomineeDetails", "NOMINEE DETAILS"],
  ["nomineeAllocation", "NOMINEE PERCENTAGE"],
  ["nominee1Proof", "NOMINEE ONE UPLOAD"],
  ["nominee2Proof", "NOMINEE TWO UPLOAD"],
  ["nominee3Proof", "NOMINEE THREE UPLOAD"],
  ["guardian1Proof", "GUARDIAN ONE UPLOAD"],
  ["guardian2Proof", "GUARDIAN TWO UPLOAD"],
  ["guardian3Proof", "GUARDIAN THREE UPLOAD"],
];
const STEP_TITLES = Object.fromEntries(REVIEW_MODULES);

// Journey steps the user saves (audit log action → export header). The audit log keeps every save; the
// export shows the LATEST save of each step (a step re-done in a correction shows its newest time).
const STEP_SAVE_ACTIONS = [
  ["USER_SAVED_PHONE", "MOBILE TIMESTAMP"],
  ["USER_SAVED_EMAIL", "EMAIL TIMESTAMP"],
  ["USER_SAVED_PRICING", "SEGMENTS TIMESTAMP (PRICING)"],
  ["USER_SAVED_PAN", "DETAILSPAN TIMESTAMP (PAN STEP)"],
  ["USER_SAVED_DIGILOCKER", "DIGILOCKER STEP TIMESTAMP"],
  ["USER_SAVED_DETAILS", "PERSONAL DETAILS TIMESTAMP"],
  ["USER_SAVED_NOMINEECHOICE", "NOMINEE CHOICE TIMESTAMP"],
  ["USER_SAVED_NOMINEE", "NOMINEE TIMESTAMP"],
  ["USER_SAVED_NOMINEEALLOCATION", "NOMINEE PERCENTAGE TIMESTAMP"],
  ["USER_SAVED_BANKVERIFICATION", "BANK TIMESTAMP"],
  ["USER_SAVED_DOCUMENTUPLOAD", "DOCUMENT UPLOAD TIMESTAMP (SIGNATURE / INCOME PROOF)"],
  ["USER_SAVED_ESIGNPREVIEW", "ESIGN PREVIEW TIMESTAMP"],
  ["USER_SAVED_AADHAARESIGN", "AADHAAR ESIGN TIMESTAMP"],
  ["USER_APPLICATION_SUBMITTED", "APPLICATION SUBMITTED TIMESTAMP"],
];
const stepSaved = (c, action) => c.extra.stepTimes?.[action] || "";

// ─── value helpers ──────────────────────────────────────────────────────────
function parse(v, fallback) {
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v === "object") return v;
  try {
    const p = JSON.parse(v);
    return p === null || p === undefined ? fallback : p;
  } catch (e) {
    return fallback;
  }
}

const first = (...vals) => {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return "";
};

function yesNo(v) {
  if (v === undefined || v === null || v === "") return "";
  const s = String(v).trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(s)) return "Yes";
  if (["false", "no", "n", "0"].includes(s)) return "No";
  return String(v);
}

/** Date/time in Indian time, regardless of the server's time zone. Date-only strings stay as they are. */
function dateTime(v) {
  if (!v) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

const maskAadhaar = (v) => {
  if (!v) return "";
  const s = String(v).replace(/\s+/g, "");
  return s.length >= 4 ? `xxxxxxxx${s.slice(-4)}` : s;
};

const round = (v, digits = 2) => {
  if (v === undefined || v === null || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10 ** digits) / 10 ** digits : String(v);
};

// ─── name / DOB comparison (export-only checks; nothing is changed or re-verified) ───
const NAME_TITLES = new Set(["MR", "MRS", "MS", "MISS", "DR", "SHRI", "SMT", "KUMARI", "KUM"]);
function normName(v) {
  return String(v || "").toUpperCase().replace(/[^A-Z ]+/g, " ").split(/\s+/).filter((t) => t && !NAME_TITLES.has(t)).join(" ");
}
/** 0–100: how alike two names are (word order and titles ignored). "" when either is missing. */
function nameSimilarity(a, b) {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return "";
  const sorted = (s) => s.split(" ").sort().join(" ");
  const p = sorted(x);
  const q = sorted(y);
  if (p === q) return 100;
  const grams = (s) => {
    const out = new Map();
    for (let i = 0; i < s.length - 1; i++) out.set(s.slice(i, i + 2), (out.get(s.slice(i, i + 2)) || 0) + 1);
    return out;
  };
  const g1 = grams(p);
  const g2 = grams(q);
  let common = 0;
  for (const [k, n] of g1) common += Math.min(n, g2.get(k) || 0);
  const total = Math.max(1, p.length - 1 + q.length - 1);
  return Math.round((2 * common * 100) / total);
}
/** Any common DOB format (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY) → YYYY-MM-DD, or "". */
function normDob(v) {
  const s = String(v || "").trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}
const sameDob = (a, b) => {
  const x = normDob(a);
  const y = normDob(b);
  return x && y ? (x === y ? "Yes" : "No") : "";
};

/** Export time in Indian time (CURRENT DATE / DAY / MONTH / YEAR columns). */
function exportClock() {
  const now = new Date();
  const part = (o) => now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ...o });
  return { date: part({ day: "2-digit", month: "2-digit", year: "numeric" }), day: part({ weekday: "long" }), month: part({ month: "long" }), year: part({ year: "numeric" }) };
}

/** Same short BOID as the table (long stored BOIDs → 16-char DP ID + Client ID). */
function formatBoid(boid) {
  if (!boid) return "";
  const b = String(boid).trim();
  return b.length > 16 ? b.slice(0, 8) + b.slice(-10, -2) : b;
}

// ─── per-application context (everything parsed once) ─────────────────────
function buildContext(app, extra) {
  const personal = { ...parse(app.declarations, {}), ...parse(app.personalDetails, {}) };
  const identity = parse(app.identityDetails, {});
  let address = parse(app.address, {});
  if (typeof address === "string") address = parse(address, {});
  if (!address || typeof address !== "object") address = {};
  const bank = parse(app.bankDetails, {});
  const nomineeRaw = parse(app.nomineeDetails, {});
  const nominees = Array.isArray(nomineeRaw) ? nomineeRaw : Array.isArray(nomineeRaw?.nominees) ? nomineeRaw.nominees : [];
  const allocation = parse(app.nomineeAllocation, {});
  const selfie = parse(app.selfieDetails, {});
  const signature = parse(app.signature, {});
  const panUpload = parse(app.panUpload, {});
  const financial = parse(app.financialProof, {});
  const segments = parse(app.segments, {});
  const esign = parse(app.esignDetails, {});
  const ocr = parse(app.ocrData, {});
  const docs = parse(app.documents, []);
  const documents = Array.isArray(docs) ? docs : [];
  const stepStatuses = parse(app.stepStatuses, {});
  const nsdl = parse(app.nsdlResponse, {});
  const digio = ocr.digio || {};
  const digilockerAction = (digio.DIGILOCKER?.actions || []).find((a) => a?.details?.aadhaar || a?.details?.pan) || {};
  const aadhaar = digilockerAction.details?.aadhaar || {};
  const aadhaarAddr = aadhaar.current_address_details || aadhaar.permanent_address_details || {};
  const digiPan = digilockerAction.details?.pan || {};
  const panCheck = ocr.pan_verification || identity.pan_verification || {};
  const panData = panCheck.data || panCheck;
  return {
    app, user: app.user || {}, personal, identity, address, bank, nomineeRaw, nominees, allocation, selfie, signature,
    panUpload, financial, segments, esign, ocr, documents, stepStatuses, nsdl, digio, aadhaar, aadhaarAddr, digiPan,
    panCheck, panData, extra: extra || {},
    formName: first(personal.fullName, personal.name, identity.name),
    formDob: first(personal.dob, personal.dateOfBirth, identity.dob),
    panName: first(identity.panName, identity.pan_name),
    aadhaarName: first(identity.aadhaarName, aadhaar.name),
    clock: exportClock(),
  };
}

const findDoc = (c, test) => c.documents.find((d) => d && test(d)) || {};

/** STK status as the table shows it (a rejection counts only once its mail was sent). */
function stkStatus(c) {
  const { app } = c;
  const rejectionSent = !!parse(app.correctionDraft, null) || (app.globeStatus === "rejected" && !["verified", "rejected"].includes(app.status));
  if (app.status === "verified") return "approved";
  if (app.status === "rejected" && !rejectionSent) return "pending";
  return app.status || "";
}
function globeStatus(c) {
  const { app } = c;
  const rejectionSent = !!parse(app.correctionDraft, null) || (app.globeStatus === "rejected" && !["verified", "rejected"].includes(app.status));
  const g = app.globeStatus || "pending";
  return g === "rejected" && !rejectionSent ? "pending" : g;
}

/** Every rejection in one line, each marked STK / Globe (same text as the old export's "Rejections"). */
function rejectionSummary(c) {
  const { app, stepStatuses: ss } = c;
  const out = [];
  Object.entries(ss)
    .filter(([step, info]) => !step.startsWith("_") && info?.status === "rejected")
    .forEach(([step, info]) => out.push(`${info.rejectedBy || "STK"}: ${info.docLabel || STEP_TITLES[step] || step}: ${info.reason || "No reason provided"}`));
  const labels = ss._pendingDocumentRejectionLabels || {};
  const by = ss._pendingDocumentRejectionBy || {};
  Object.entries(ss._pendingDocumentRejections || {}).forEach(([src, reason]) => out.push(`${by[src] || "STK"}: ${labels[src] || "Document"}: ${reason || "No reason provided"}`));
  if (!out.some((r) => r.startsWith("STK")) && app.status === "rejected" && app.rejectionReason) out.push(`STK: Application: ${app.rejectionReason}`);
  if (!out.some((r) => r.startsWith("Globe")) && app.globeStatus === "rejected" && app.globeRemarks) out.push(`Globe: Application: ${app.globeRemarks}`);
  return out.join(" | ");
}

// ─── column groups ──────────────────────────────────────────────────────────
// Each column: [header, (ctx) => value]
function nomineeGroup(i) {
  const n = (c) => c.nominees[i] || {};
  const proof = (c, type, guardian) => {
    const x = n(c);
    const t = String((guardian ? x.guardianProofType : x.proofType) || "").toUpperCase();
    const num = guardian ? x.guardianProofNumber : (x.proofNumber || x.extractedProofNumber);
    if (!num) return "";
    if (type === "PAN") return t.includes("PAN") ? num : "";
    return t.includes("AADHAAR") || t.includes("AADHAR") ? maskAadhaar(num) : "";
  };
  const pct = (c) => {
    const p = c.allocation?.percentages;
    return first(Array.isArray(p) ? p[i] : "", n(c).sharePercentage, n(c).percentage);
  };
  const N = `NOMINEE${i + 1}`;
  const G = `GUARDIAN${i + 1}`;
  return {
    name: `NOMINEE ${i + 1} (WITH GUARDIAN)`,
    columns: [
      [`${N} NAME`, (c) => first(n(c).name)],
      [`${N} RELATION`, (c) => first(n(c).relation)],
      [`${N} DOB`, (c) => first(n(c).dob)],
      [`${N} PERCENTAGE`, (c) => pct(c)],
      [`${N} MOBILE`, (c) => first(n(c).mobile)],
      [`${N} EMAIL`, (c) => first(n(c).email)],
      [`${N} SAME AS MY ADDRESS`, (c) => yesNo(n(c).sameAddress)],
      [`${N} ADD1`, (c) => first(n(c).address)],
      [`${N} CITY`, (c) => first(n(c).city)],
      [`${N} STATE`, (c) => first(n(c).state)],
      [`${N} PINCODE`, (c) => first(n(c).pincode)],
      [`${N} COUNTRY`, (c) => (c.nominees[i] ? first(n(c).country) : "")],
      [`${N} PROOF TYPE`, (c) => first(n(c).proofType)],
      [`${N} PAN`, (c) => proof(c, "PAN", false)],
      [`${N} AADHAR`, (c) => proof(c, "AADHAAR", false)],
      [`${N} UPLOAD`, (c) => first(n(c).proofPath)],
      [`${G} NAME`, (c) => first(n(c).guardianName)],
      [`${G} RELATION`, (c) => first(n(c).guardianRelation)],
      [`${G} DOB`, (c) => first(n(c).guardianDob)],
      [`${G} MOBILE`, (c) => first(n(c).guardianMobile)],
      [`${G} EMAIL`, (c) => first(n(c).guardianEmail)],
      [`${G} SAME AS NOMINEE ADDRESS`, (c) => (n(c).guardianName ? yesNo(n(c).guardianSameAddress) : "")],
      [`${G} ADD1`, (c) => first(n(c).guardianAddress)],
      [`${G} CITY`, (c) => first(n(c).guardianCity)],
      [`${G} STATE`, (c) => first(n(c).guardianState)],
      [`${G} PINCODE`, (c) => first(n(c).guardianPincode)],
      [`${G} COUNTRY`, (c) => (n(c).guardianName ? first(n(c).guardianCountry) : "")],
      [`${G} PROOF TYPE`, (c) => (n(c).guardianName ? first(n(c).guardianProofType) : "")],
      [`${G} PAN`, (c) => proof(c, "PAN", true)],
      [`${G} AADHAR`, (c) => proof(c, "AADHAAR", true)],
      [`${G} UPLOAD`, (c) => first(n(c).guardianProofPath)],
    ],
  };
}

const GROUPS = [
  {
    name: "APPLICATION & STATUS",
    columns: [
      ["KYC ID", (c) => c.app.applicationId],
      ["CLIENTCODE", (c) => first(c.app.clientCode)],
      ["BOID", (c) => formatBoid(first(c.user.boid, c.user.boidAssigned?.boidNumber))],
      ["CURRENT MODULE", (c) => `Step ${c.app.currentStep || 0}/14 — ${STEP_LABELS[c.app.currentStep] || "Onboarding"}`],
      ["STATUS (STK)", stkStatus],
      ["STATUS (GLOBE)", globeStatus],
      ["VERIFY BY STOCKOLOGY TIMESTAMP", (c) => dateTime(c.app.stkApprovedAt)],
      // only while the approval stands (an approval that was later reversed is not shown, like its time)
      ["VERIFIED BY (STK)", (c) => (c.app.stkApprovedAt ? first(c.extra.stkApprovedBy) : "")],
      ["REJECTED BY STOCKOLOGY TIMESTAMP", (c) => dateTime(c.app.stkRejectedAt)],
      ["VERIFY BY GLOBE TIMESTAMP", (c) => dateTime(c.app.globeApprovedAt)],
      ["VERIFIED BY (GLOBE)", (c) => (c.app.globeApprovedAt ? first(c.extra.globeApprovedBy) : "")],
      ["REJECTED BY GLOBE TIMESTAMP", (c) => dateTime(c.app.globeRejectedAt)],
      ["KYC STATUS DATE (LAST STATUS CHANGE)", (c) => dateTime(c.extra.statusDate)],
      ["RESUBMITTED", (c) => yesNo(c.app.isResubmitted)],
      ["KYC DATE (STARTED)", (c) => dateTime(c.app.createdAt)],
      ["COMPLETE TIMESTAMP (SUBMITTED)", (c) => dateTime(c.app.submittedAt)],
      ["UPDATED AT", (c) => dateTime(c.app.updatedAt)],
      ["BACKOFFICE TIMESTAMP", (c) => dateTime(c.app.pushedToBackofficeAt)],
      ["PUSHED TO BACKOFFICE", (c) => yesNo(c.app.pushedToBackoffice)],
      ["NSDL TIMESTAMP", (c) => dateTime(c.nsdl.submittedAt)],
      ["NSDL STATUS", (c) => first(c.nsdl.status)],
      ["NSDL MESSAGE", (c) => first(c.nsdl.message)],
      ["REFERAL CODE (AP)", (c) => first(c.user.apCode)],
      ["SOURCE", (c) => first(c.app.source)],
      ["RISK SCORE", (c) => first(c.app.riskScore)],
      ["RISK CATEGORY", (c) => first(c.app.riskCategory)],
      // NSDL depository: an NSDL account request / response or an NSDL-style BOID (IN…)
      ["DEPOSITORY TYPE", (c) => (Object.keys(c.nsdl).length || /^IN/i.test(String(first(c.user.boid, c.user.boidAssigned?.boidNumber))) ? "NSDL" : "")],
      ["CURRENT DATE (EXPORT)", (c) => c.clock.date],
      ["CURRENT DAY", (c) => c.clock.day],
      ["CURRENT MONTH", (c) => c.clock.month],
      ["CURRENT YEAR", (c) => c.clock.year],
    ],
  },
  {
    name: "STEP TIMESTAMPS (LAST SAVED BY USER)",
    columns: [
      ["MOBILE OTP TIMESTAMP (FIRST VERIFIED)", (c) => dateTime(c.extra.mobileOtpFirst)],
      ["MOBILE OTP TIMESTAMP (LAST LOGIN)", (c) => dateTime(c.extra.mobileOtpLast)],
      ["EMAIL OTP TIMESTAMP", (c) => dateTime(c.extra.emailOtp)],
      ...STEP_SAVE_ACTIONS.map(([action, header]) => [header, (c) => dateTime(stepSaved(c, action))]),
    ],
  },
  {
    name: "PERSONAL DETAILS",
    columns: [
      ["PREFIX", (c) => first(c.personal.prefix)],
      ["NAME", (c) => first(c.personal.fullName, c.personal.name, c.identity.name)],
      ["DOB", (c) => first(c.personal.dob, c.personal.dateOfBirth, c.identity.dob)],
      ["GENDER", (c) => first(c.personal.gender, c.identity.gender)],
      ["FATHER NAME", (c) => first(c.personal.fatherName, c.personal.father_name)],
      ["MOTHER NAME", (c) => first(c.personal.motherName, c.personal.mother_name)],
      ["MARITAL STATUS", (c) => first(c.personal.maritalStatus)],
      ["EDUCATION", (c) => first(c.personal.education)],
      ["OCCUPATION", (c) => first(c.personal.occupation)],
      ["ANNUAL INCOME", (c) => first(c.personal.annualIncome, c.personal.annual_income)],
      ["TRADING EXPERIENCE", (c) => first(c.personal.experience)],
      ["ARE YOU CITIZEN OF INDIA", (c) => yesNo(c.personal.isIndianCitizen)],
      ["POLITICALLY EXPOSED", (c) => yesNo(c.personal.politicallyExposed)],
      ["POLITICALLY EXPOSED CATEGORY", (c) => first(c.personal.pepType)],
      ["P E DOCUMENT", (c) => first(c.personal.pepProof)],
      ["PEP COMMENT", (c) => first(c.personal.pepComment)],
    ],
  },
  {
    name: "FATCA / TAX RESIDENCY",
    columns: [
      ["TAX RESIDENCY OUTSIDE", (c) => yesNo(c.personal.taxResidencyOutside)],
      ["CITIZEN1 (CITIZENSHIP)", (c) => first(c.personal.citizenship)],
      ["COUNTRY BIRTH1", (c) => first(c.personal.countryOfBirth)],
      ["PLACE OF BIRTH", (c) => first(c.personal.placeOfBirth)],
      ["COUNTRY OF TAX RESIDENCE1", (c) => first(c.personal.taxResidence1)],
      ["TAX PAYER IDENTIFICATION NUMBER1", (c) => first(c.personal.taxId1)],
      ["COUNTRY OF TAX RESIDENCE2", (c) => first(c.personal.taxResidence2)],
      ["TAX PAYER IDENTIFICATION NUMBER2", (c) => first(c.personal.taxId2)],
      ["COUNTRY TAX RESIDENCE3", (c) => first(c.personal.taxResidence3)],
      ["TAX PAYER IDENTIFICATION NUMBER3", (c) => first(c.personal.taxId3)],
      ["TAX EXEMPT", (c) => yesNo(c.personal.taxExempt)],
      ["TAX EXEMPT REASON", (c) => first(c.personal.taxExemptReason)],
    ],
  },
  {
    name: "CONTACT",
    columns: [
      ["MOBILE NUMBER", (c) => first(c.user.phone, c.personal.mobile, c.personal.phone)],
      ["MOBILE BELONGS TO (DEPENDENCY)", (c) => first(c.personal.phoneDependency)],
      ["EMAIL", (c) => first(c.user.email, c.personal.email)],
      ["EMAIL BELONGS TO (DEPENDENCY)", (c) => first(c.personal.emailDependency)],
      ["SMS ALERT", (c) => yesNo(c.personal.smsAlert)],
    ],
  },
  {
    name: "PAN",
    columns: [
      ["PAN NUMBER", (c) => first(c.identity.panNumber, c.identity.pan, c.identity.manualPan, c.personal.pan)],
      ["NAME AS PER PAN", (c) => first(c.identity.panName, c.identity.pan_name)],
      ["PAN STATUS", (c) => first(c.panData.status)],
      ["PAN CATEGORY", (c) => first(c.panData.category)],
      ["PAN NAME MATCH", (c) => yesNo(c.panData.name_as_per_pan_match)],
      ["PAN DOB MATCH", (c) => yesNo(c.panData.date_of_birth_match)],
      ["AADHAR SEEDING STATUS", (c) => {
        const s = first(c.panData.aadhaar_seeding_status, c.identity.aadhaarSeedingStatus, c.identity.seedingStatus);
        return s ? String(s).toUpperCase() : "";
      }],
      ["PAN TIMESTAMP (VERIFIED)", (c) => dateTime(c.panCheck.verifiedAt)],
      ["PAN UPLOAD", (c) => first(c.panUpload.path, c.panUpload.filePreview)],
      ["PAN UPLOAD TIMESTAMP", (c) => dateTime(findDoc(c, (d) => d.type === "PAN" && d.source !== "DIGILOCKER").uploadedAt)],
    ],
  },
  {
    name: "AADHAAR / DIGILOCKER",
    columns: [
      ["IDENTITY METHOD", (c) => first(c.app.identityMethod, c.aadhaar.id_number || c.aadhaar.name ? "DigiLocker" : "")],
      ["AADHAR NO", (c) => maskAadhaar(first(c.identity.aadhaarNumber, c.identity.aadhaar, c.identity.aadhar, c.identity.uid, c.aadhaar.id_number))],
      ["NAME AS PER AADHAR", (c) => first(c.identity.aadhaarName, c.aadhaar.name)],
      ["AADHAR DOB", (c) => first(c.aadhaar.dob)],
      ["AADHAR GENDER", (c) => first(c.aadhaar.gender)],
      ["AADHAR FATHERNAME", (c) => first(c.aadhaar.father_name)],
      ["AADHAR ADDRESS", (c) => first(c.aadhaar.current_address, c.aadhaar.permanent_address)],
      ["AADHAR HOUSE", (c) => first(c.aadhaarAddr.address)],
      ["AADHAR LOCALITY", (c) => first(c.aadhaarAddr.locality_or_post_office)],
      ["AADHAR DIST", (c) => first(c.aadhaarAddr.district_or_city)],
      ["AADHAR STATE", (c) => first(c.aadhaarAddr.state)],
      ["AADHAR PINCODE", (c) => first(c.aadhaarAddr.pincode)],
      ["AADHAR IMAGE", (c) => first(findDoc(c, (d) => d.type === "PHOTO" && /aadhaar/i.test(d.label || "")).path)],
      ["AADHAR FILE", (c) => first(findDoc(c, (d) => d.type === "AADHAAR").path)],
      ["PAN FROM DIGILOCKER", (c) => first(c.identity.digilockerPan, c.digiPan.id_number)],
      ["PANNAME FOR DIGILOCKER", (c) => first(c.digiPan.name)],
      ["DIGILOCKER PAN FILE", (c) => first(findDoc(c, (d) => d.type === "PAN" && d.source === "DIGILOCKER").path)],
      ["DIGILOCKER STATUS", (c) => first(c.digio.DIGILOCKER?.status)],
      ["DIGILOCKER TIMESTAMP", (c) => dateTime(first(digilockerDone(c), c.digio.DIGILOCKER?.fetchedAt))],
    ],
  },
  {
    name: "NAME / DOB / PAN MATCH CHECKS",
    columns: [
      ["NAMEMATCH % (FORM NAME VS PAN NAME)", (c) => nameSimilarity(c.formName, c.panName)],
      ["NAME STATUS (FORM VS PAN)", (c) => matchLabel(nameSimilarity(c.formName, c.panName))],
      ["AADHAR NAME PERCENTAGE (VS PAN NAME)", (c) => nameSimilarity(c.aadhaarName, c.panName)],
      ["AADHAR NAME PERCENTAGE STATUS VERIFY", (c) => matchLabel(nameSimilarity(c.aadhaarName, c.panName))],
      ["PAN DOB FOR MATCH (FORM DOB)", (c) => c.formDob],
      ["DOBMATCH (FORM DOB VS AADHAR DOB)", (c) => sameDob(c.formDob, c.aadhaar.dob)],
      ["AADHAR DOB PERCENTAGE STATUS VERIFY", (c) => matchLabel(sameDob(c.formDob, c.aadhaar.dob) === "Yes" ? 100 : sameDob(c.formDob, c.aadhaar.dob) === "No" ? 0 : "")],
      ["AADHAR NAME AND DOB VERIFY", (c) => {
        const n = nameSimilarity(c.aadhaarName, c.panName);
        const d = sameDob(c.formDob, c.aadhaar.dob);
        if (n === "" || d === "") return "";
        return n >= NAME_MATCH_MIN && d === "Yes" ? "VERIFIED" : "MISMATCH";
      }],
      ["PANNOMATCH (FORM PAN VS DIGILOCKER PAN)", (c) => {
        const a = String(first(c.identity.panNumber, c.identity.pan, c.identity.manualPan)).toUpperCase();
        const b = String(first(c.identity.digilockerPan, c.digiPan.id_number)).toUpperCase();
        return a && b ? (a === b ? "Yes" : "No") : "";
      }],
    ],
  },
  {
    name: "ADDRESS (CORRESPONDENCE)",
    columns: [
      ["COR ADD1", (c) => first(c.address.line1, c.address.addressLine1, c.address.address)],
      ["COR ADD2", (c) => first(c.address.line2, c.address.addressLine2)],
      ["COR ADD3", (c) => first(c.address.line3, c.address.addressLine3, c.address.locality)],
      ["COR CITY", (c) => first(c.address.city)],
      ["COR DISTRICT", (c) => first(c.address.district)],
      ["COR STATE", (c) => first(c.address.state)],
      ["STATE CODE (AS SENT TO BACKOFFICE)", (c) => (c.address.state ? first(mapState(c.address.state)) : "")],
      ["COR PINCD", (c) => first(c.address.pincode, c.address.pinCode)],
      ["COR COUNTRY", (c) => first(c.address.country)],
      ["SAME AS AADHAAR ADDRESS", (c) => yesNo(c.address.useAadhaar)],
      ["ADDRESS PROOF CODE", (c) => first(c.address.addressProof)],
    ],
  },
  {
    name: "BANK",
    columns: [
      ["BANKNAME", (c) => first(c.bank.bankName, c.bank.bank_name)],
      ["ACCOUNT NUMBER", (c) => first(c.bank.accountNumber, c.bank.account_number, c.bank.accountNo)],
      ["ACCOUNT TYPE", (c) => first(c.bank.accountType)],
      ["IFSC", (c) => first(c.bank.ifsc, c.bank.ifscCode, c.bank.ifsc_code)],
      ["MICR", (c) => first(c.bank.micr, c.ocr.bank?.micr)],
      ["NAME AS PER BANK", (c) => first(c.bank.accountHolderName)],
      ["BRANCHNAME", (c) => first(c.bank.branch)],
      ["BANKADDRESS", (c) => first(c.bank.address, [c.bank.address1, c.bank.address2, c.bank.address3].filter(Boolean).join(", "))],
      ["BANK CITY", (c) => first(c.bank.city)],
      ["BANK DISTRICT", (c) => first(c.bank.district)],
      ["BANK STATE", (c) => first(c.bank.state)],
      ["SELECT PENNY DROP MODE", (c) => first(c.bank.method)],
      ["PENNYDROP VERIFIED", (c) => yesNo(c.bank.verified)],
      ["PENNYDROP NAME MATCH", (c) => yesNo(c.bank.name_match)],
      ["FUZZ MATCH SCORE", (c) => round(c.bank.name_match_score)],
      ["PENNYDROP VERIFY TIME", (c) => dateTime(c.bank.verifiedAt)],
    ],
  },
  {
    name: "SEGMENTS, DDPI & DEPOSITORY PREFERENCES",
    columns: [
      ["EQUITY / CASH SEGMENT", (c) => yesNo(c.segments.equity)],
      ["DERIVATIVES (F&O) SEGMENT", (c) => yesNo(c.segments.derivatives)],
      ["BSDA", (c) => first(c.app.bsda)],
      ["DDPI", (c) => yesNo(c.personal.ddpi)],
      ["OPERATE DDPI", (c) => yesNo(c.personal.operatedThroughDDPI)],
      ["DDPI CLAUSE1 (TRANSFER FOR SETTLEMENT)", (c) => yesNo(c.personal.transferSecurities)],
      ["DDPI CLAUSE2 (PLEDGE / RE-PLEDGE)", (c) => yesNo(c.personal.pledgeSecurities)],
      ["DDPI CLAUSE3 (MUTUAL FUND TRANSACTIONS)", (c) => yesNo(c.personal.mfTransactions)],
      ["DDPI CLAUSE4 (TENDER IN OPEN OFFERS)", (c) => yesNo(c.personal.tenderingShares)],
      ["DDPI YES NAME", (c) => (yesNo(c.personal.ddpi) === "Yes" ? c.formName : "")],
      ["DDPI YES STAMP", (c) => (yesNo(c.personal.ddpi) === "Yes" ? stampNo(c) : "")],
      ["DDPI NO NAME", (c) => (yesNo(c.personal.ddpi) === "No" ? c.formName : "")],
      ["DDPI NO STAMP", (c) => (yesNo(c.personal.ddpi) === "No" ? stampNo(c) : "")],
      ["DIS BOOKLET", (c) => yesNo(c.personal.dis)],
      ["ACCOUNT SETTLEMENT", (c) => first(c.personal.settlement)],
      ["NSDL1 RECEIVE CREDIT", (c) => yesNo(c.personal.receiveCredits)],
      ["NSDL2 E STATEMENT", (c) => yesNo(c.personal.eStatement)],
      ["NSDL3 PLEDGE INSTRUCTION", (c) => yesNo(c.personal.acceptPledgeInstructions)],
      ["NSDL4 ANNUAL REPORTS (ELECTRONIC)", (c) => yesNo(c.personal.receiveAnnualReports)],
    ],
  },
  {
    name: "INCOME PROOF",
    columns: [
      ["SELECT INCOME PROOFTYPE", (c) => first(c.financial.type)],
      ["UPLOAD INCOME PROOF", (c) => first(c.financial.path, c.financial.filePreview)],
    ],
  },
  {
    name: "NOMINEES (SUMMARY)",
    columns: [
      ["ADD NOMINEE (OPTED)", (c) => yesNo(c.nomineeRaw?.opted)],
      ["OPTINCHECKBOX", (c) => (optedIn(c) === true ? "Yes" : "")],
      ["NOMINEE OTP IN NAME", (c) => (optedIn(c) === true ? c.formName : "")],
      ["NOMINEE OPT IN CLIENTCODE", (c) => (optedIn(c) === true ? first(c.app.clientCode) : "")],
      ["NOMINEE OTP IN STAMP", (c) => (optedIn(c) === true ? stampNo(c) : "")],
      ["NOMINEE OPT IN DATE", (c) => (optedIn(c) === true ? dateTime(stepSaved(c, "USER_SAVED_NOMINEECHOICE")) : "")],
      ["OPTOUTCHECKBOX", (c) => (optedIn(c) === false ? "Yes" : "")],
      ["NOMINEE OTP OUT NAME", (c) => (optedIn(c) === false ? c.formName : "")],
      ["NOMINEE OPT OUT CLIENTCODE", (c) => (optedIn(c) === false ? first(c.app.clientCode) : "")],
      ["NOMINEE OPT OUT STAMP", (c) => (optedIn(c) === false ? stampNo(c) : "")],
      ["NOMINEE OPT OUT DATE", (c) => (optedIn(c) === false ? dateTime(stepSaved(c, "USER_SAVED_NOMINEECHOICE")) : "")],
      ["TOTAL NOMINEES", (c) => first(c.nomineeRaw?.numberOfNominees, c.nominees.length || "")],
    ],
  },
  ...Array.from({ length: MAX_NOMINEES }, (_, i) => nomineeGroup(i)),
  {
    name: "LIVE IMAGE (SELFIE)",
    columns: [
      ["CLIENTIMAGE", (c) => first(c.selfie.path, c.selfie.preview, c.app.selfie)],
      ["LIVEIMAGE TIMESTAMP", (c) => dateTime(first(c.selfie.capturedAt, c.selfie.extractedAt, c.selfie.timestamp, c.selfie.uploadedAt))],
      ["LATITUDE", (c) => first(c.selfie.geo?.latitude, c.selfie.latitude, c.selfie.lat)],
      ["LONGITUDE", (c) => first(c.selfie.geo?.longitude, c.selfie.longitude, c.selfie.lng)],
      ["LOCATION ACCURACY (METRES)", (c) => round(first(c.selfie.geo?.accuracy, c.selfie.accuracy), 0)],
      ["FACE MATCH SCORE", (c) => round(first(c.selfie.faceMatchScore, c.selfie.matchScore, c.app.faceMatchScore))],
      ["LIVENESS SCORE", (c) => round(c.selfie.livenessScore)],
      ["SELFIE SOURCE", (c) => first(c.selfie.source)],
      ["SELFIE VIDEO", (c) => first(c.selfie.videoPath)],
      ["SELFIE IP", (c) => first(c.selfie.ip)],
    ],
  },
  {
    name: "SIGNATURE, E-SIGN & E-STAMP",
    columns: [
      ["SIGNATURE UPLOAD", (c) => first(c.signature.path, c.signature.preview, c.signature.filePreview)],
      ["SIGN UPLOAD TIMESTAMP", (c) => dateTime(first(c.signature.timestamp, c.signature.uploadedAt, c.signature.path || c.signature.filePreview ? stepSaved(c, "USER_SAVED_DOCUMENTUPLOAD") : ""))],
      ["ESIGN STATUS", (c) => first(c.digio.ESIGN?.status, c.esign.status)],
      ["ESIGN TIMESTAMP", (c) => dateTime(first(findDoc(c, (d) => d.type === "ESIGN_DOCUMENT").uploadedAt, c.esign.timestamp, c.esign.signedAt, findDoc(c, (d) => d.type === "ESIGN_DOCUMENT").path ? stepSaved(c, "USER_SAVED_AADHAARESIGN") : ""))],
      ["ESIGN TRANSACTION ID", (c) => first(c.digio.ESIGN?.requestId)],
      // Aadhaar eSign is signed by the Aadhaar holder → their Aadhaar name (only once a signed PDF exists)
      ["ESIGN SIGNER NAME (AADHAAR NAME)", (c) => (findDoc(c, (d) => d.type === "ESIGN_DOCUMENT").path ? c.aadhaarName : "")],
      ["ESIGNED PDF- EQUITYKRA", (c) => first(findDoc(c, (d) => d.type === "ESIGN_DOCUMENT").path)],
      ["ESIGN IP", (c) => first(c.esign.ip)],
      ["ESIGN LATITUDE", (c) => first(c.esign.lat)],
      ["ESIGN LONGITUDE", (c) => first(c.esign.lng)],
      ["STAMPAPER NUMBER", (c) => first(c.user.eStampAssigned?.certificateNo, c.user.eStamp)],
      ["STAMPPAPER ID (SERIAL)", (c) => first(c.user.eStampAssigned?.serialNo)],
    ],
  },
  {
    name: "REJECTIONS",
    columns: [
      ["ALL REJECTIONS (SUMMARY)", rejectionSummary],
      ...REVIEW_MODULES.flatMap(([key, title]) => {
        const rej = (c) => (c.stepStatuses[key]?.status === "rejected" ? c.stepStatuses[key] : null);
        return [
          [`REJECT REASON ${title}`, (c) => first(rej(c)?.reason)],
          [`REJECTED BY ${title}`, (c) => (rej(c) ? first(rej(c).rejectedBy, "STK") : "")],
          [`REJECTED TIMESTAMP ${title}`, (c) => dateTime(rej(c)?.reviewedAt)],
        ];
      }),
    ],
  },
];

const stampNo = (c) => first(c.user.eStampAssigned?.certificateNo, c.user.eStamp);
/** true = opted in, false = opted out, null = not answered yet */
function optedIn(c) {
  const v = yesNo(c.nomineeRaw?.opted);
  return v === "Yes" ? true : v === "No" ? false : null;
}
function matchLabel(pct) {
  if (pct === "" || pct === undefined || pct === null) return "";
  return Number(pct) >= NAME_MATCH_MIN ? "MATCH" : "MISMATCH";
}

function digilockerDone(c) {
  const actions = c.digio.DIGILOCKER?.actions || [];
  return first(...actions.map((a) => a?.completed_at));
}

/** Header layout for the sheet: [{ name, columns: [header, …] }] */
function exportGroups() {
  return GROUPS.map((g) => ({ name: g.name, columns: g.columns.map(([h]) => h) }));
}

/** One row of values per application (same order as exportGroups). A failing column is left blank. */
function exportRow(app, extra) {
  const c = buildContext(app, extra);
  const row = [];
  for (const g of GROUPS) {
    for (const [, get] of g.columns) {
      let v;
      try {
        v = get(c);
      } catch (e) {
        v = "";
      }
      if (v === undefined || v === null) v = "";
      if (typeof v === "object") v = "";
      row.push(v);
    }
  }
  return row;
}

module.exports = { exportGroups, exportRow, STEP_SAVE_ACTION_NAMES: STEP_SAVE_ACTIONS.map(([a]) => a) };
