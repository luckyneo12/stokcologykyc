// Applications can only be rejected once the applicant has finished every step (eSign done, i.e. the
// "Verify" filter). "In Progress" applications are still being filled in, so there is nothing to reject yet.
const ESIGN_STEP = 14;

const isRejectable = (app) => Number(app?.currentStep || 0) >= ESIGN_STEP;

const NOT_REJECTABLE_ERROR = "This application can't be rejected as it is still in progress. The applicant has not completed all the steps yet.";

module.exports = { ESIGN_STEP, isRejectable, NOT_REJECTABLE_ERROR };
