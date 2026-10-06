// Tracks whether the applicant has already been mailed the application's current rejections, so the
// "Send Rejection Mail" button stays disabled until a rejection is added, edited or removed.
// Everything is kept on the application in reserved stepStatuses keys (like welcomeEmailSent).

// Document rejections a reviewer has marked but not yet mailed ({ [documentSrc]: reason })
const PENDING_DOC_REJECTIONS_KEY = "_pendingDocumentRejections";
const PENDING_DOC_LABELS_KEY = "_pendingDocumentRejectionLabels"; // { [documentSrc]: document name }
const PENDING_DOC_BY_KEY = "_pendingDocumentRejectionBy"; // { [documentSrc]: "STK" | "Globe" }
// { fingerprint, sentAt, by, sentByEmail } of the last rejection mail that was actually delivered
const REJECTION_MAIL_SENT_KEY = "_rejectionMailSent";
// { STK?: { prev, setAt }, Globe?: { prev, setAt } } — the status a side had before a not-yet-mailed
// document rejection turned it to "rejected", so removing that rejection can put it back
const PENDING_DOC_STATUS_FLIP_KEY = "_pendingDocStatusFlip";

const parseStepStatuses = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try { return JSON.parse(value) || {}; } catch (e) { return {}; }
};

const getPendingDocRejections = (ss) => {
  const pending = ss?.[PENDING_DOC_REJECTIONS_KEY];
  return pending && typeof pending === "object" && !Array.isArray(pending) ? pending : {};
};

const hasRejectedSteps = (ss) =>
  Object.entries(ss || {}).some(([key, info]) => !key.startsWith("_") && info && typeof info === "object" && info.status === "rejected");

// Everything a rejection mail would tell the applicant, as a stable string ("" = no rejections)
const rejectionFingerprint = (ss) => {
  const items = [];
  for (const [stepId, info] of Object.entries(ss || {})) {
    if (stepId.startsWith("_") || !info || typeof info !== "object" || info.status !== "rejected") continue;
    const fields = Array.isArray(info.rejectedFields) ? info.rejectedFields.map(String).sort() : [];
    items.push(JSON.stringify(["step", stepId, info.reason || "", fields, info.rejectEntireModule === true, info.docSrc || ""]));
  }
  for (const [src, reason] of Object.entries(getPendingDocRejections(ss))) {
    if (reason) items.push(JSON.stringify(["doc", src, String(reason)]));
  }
  return items.sort().join("\n");
};

// Applications mailed before this tracking existed: an active correction session that already covers
// every rejected step (and no new document rejections) means the current rejections were mailed.
const legacyMailSent = (ss, correctionDraft) => {
  if (!correctionDraft || Object.keys(getPendingDocRejections(ss)).length > 0) return false;
  let session = correctionDraft;
  if (typeof session === "string") { try { session = JSON.parse(session); } catch (e) { return false; } }
  if (!session?.sessionId || !Array.isArray(session.rejectedSteps)) return false;
  const mailed = new Set(session.rejectedSteps.map((s) => s?.stepId));
  const rejected = Object.entries(ss).filter(([k, v]) => !k.startsWith("_") && v?.status === "rejected").map(([k]) => k);
  return rejected.length > 0 && rejected.every((k) => mailed.has(k));
};

/**
 * { hasRejections, alreadySent, mailPending, sentAt, sentBy } for an application.
 * mailPending = there are rejections the applicant has not been mailed yet.
 */
const getRejectionMailState = (app, ssOverride) => {
  const ss = ssOverride || parseStepStatuses(app?.stepStatuses);
  const fingerprint = rejectionFingerprint(ss);
  const hasRejections = fingerprint !== "";
  const sent = ss[REJECTION_MAIL_SENT_KEY];
  const alreadySent = hasRejections && (sent ? sent.fingerprint === fingerprint : legacyMailSent(ss, app?.correctionDraft));
  return {
    hasRejections,
    alreadySent,
    mailPending: hasRejections && !alreadySent,
    sentAt: sent?.sentAt || null,
    sentBy: sent?.by || null,
  };
};

// A decision on the whole application ("STK" status or "Globe" status) replaces the status saved to be
// put back when a not-yet-mailed document rejection is removed — forget it. Never throws.
const clearPendingDocStatusFlip = async (prisma, where, side) => {
  try {
    const app = await prisma.kycApplication.findUnique({ where, select: { stepStatuses: true } });
    const ss = parseStepStatuses(app?.stepStatuses);
    if (!ss[PENDING_DOC_STATUS_FLIP_KEY]?.[side]) return;
    delete ss[PENDING_DOC_STATUS_FLIP_KEY][side];
    if (Object.keys(ss[PENDING_DOC_STATUS_FLIP_KEY]).length === 0) delete ss[PENDING_DOC_STATUS_FLIP_KEY];
    await prisma.kycApplication.update({ where, data: { stepStatuses: JSON.stringify(ss) } });
  } catch (error) {
    console.error("[rejectionMail] Could not clear the saved status:", error.message);
  }
};

// Adds `rejectionMail` to each application (for API responses)
const withRejectionMailState = (app) => (app ? { ...app, rejectionMail: getRejectionMailState(app) } : app);

module.exports = {
  PENDING_DOC_REJECTIONS_KEY,
  PENDING_DOC_LABELS_KEY,
  PENDING_DOC_BY_KEY,
  REJECTION_MAIL_SENT_KEY,
  PENDING_DOC_STATUS_FLIP_KEY,
  parseStepStatuses,
  getPendingDocRejections,
  hasRejectedSteps,
  rejectionFingerprint,
  getRejectionMailState,
  withRejectionMailState,
  clearPendingDocStatusFlip,
};
