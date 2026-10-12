// Applications can only be rejected once the applicant has finished every step (eSign done, i.e. the
// "Verify" filter). "In Progress" applications are still being filled in, so there is nothing to reject yet.
const ESIGN_STEP = 14;

const isRejectable = (app) => Number(app?.currentStep || 0) >= ESIGN_STEP;

const NOT_REJECTABLE_ERROR = "This application can't be rejected as it is still in progress. The applicant has not completed all the steps yet.";

// Approving needs the same: nobody can approve an application before the applicant has eSigned it.
const isApprovable = isRejectable;
const NOT_APPROVABLE_ERROR = "This application can't be approved as eSign is not done yet. The applicant has not completed all the steps.";

// An approval locks the application against rejection by that side: once STK has verified it, STK can't
// reject it (Globe still reviews it and can); once Globe has approved it, nobody can reject it.
// side: "STK" or "Globe" (a Globe reviewer is req.user.role === "globe").
const isLockedByApproval = (app, side) =>
  app?.globeStatus === "approved" || (side === "STK" && app?.status === "verified");

const APPROVED_LOCK_ERROR = "This application is already approved and can't be rejected.";

const rejectionSide = (user) => (user?.role === "globe" ? "Globe" : "STK");

module.exports = { ESIGN_STEP, isRejectable, NOT_REJECTABLE_ERROR, isApprovable, NOT_APPROVABLE_ERROR, isLockedByApproval, APPROVED_LOCK_ERROR, rejectionSide };
