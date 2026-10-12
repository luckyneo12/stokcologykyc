const { REJECTION_SENT_WHERE, GLOBE_REJECTED_SENT_WHERE } = require("./rejectionMail");

/**
 * Prisma `where` for one admin list filter (Maker-Checker / KYC Requests "status" filter). The dashboard
 * cards count with the same function, so a card's number is always the number of rows in the list it opens.
 * Uses AND / NOT (never a top-level OR), so it combines with the search's own OR.
 */
function statusFilterWhere(status) {
  const s = String(status || "").toLowerCase();
  if (!s || s === "all") return {};
  switch (s) {
    case "stk_approved":
      // Approved by STK (whatever Globe has done)
      return { status: "verified" };
    case "globe_approved":
      // Approved on the Globe portal
      return { globeStatus: "approved" };
    case "globe_rejected":
      // Same as Globe's own "Rejected" list (mail sent, or back with STK)
      return { AND: [GLOBE_REJECTED_SENT_WHERE] };
    case "rejected":
      // Rejected by STK or by Globe, once the rejection mail was sent
      return { AND: [REJECTION_SENT_WHERE] };
    case "pushed_to_bo":
      return { pushedToBackoffice: true };
    case "completed":
    case "not_pushed_to_bo":
      // Approved by STK and Globe, not yet sent to back office
      return { status: "verified", globeStatus: "approved", pushedToBackoffice: false };
    case "verify":
      // eSign done and not yet pushed to back office — stays here even after STK/Globe are verified.
      // A rejection (STK or Globe) stays here until its rejection mail is sent; then it moves to
      // "Rejected", and once the applicant resubmits it is back here for STK.
      return { currentStep: { gte: 14 }, status: { not: "on_hold" }, NOT: REJECTION_SENT_WHERE, pushedToBackoffice: false };
    case "in_progress":
    case "pending":
      // eSign not done yet
      return { currentStep: { lt: 14 }, status: { notIn: ["rejected", "on_hold", "verified"] } };
    default:
      return { status: s };
  }
}

module.exports = { statusFilterWhere };
