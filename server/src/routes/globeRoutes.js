const express = require("express");
const router = express.Router();
const globeController = require("../controllers/globeController");
const { getApplicationById } = require("../controllers/adminController");
const { auth } = require("../middlewares/auth");

const globeAuth = (req, res, next) => {
  auth(req, res, () => {
    if (!["admin", "globe"].includes(req.user.role)) {
      return res.status(403).json({ error: "Globe/Admin access required" });
    }
    next();
  });
};

router.use(globeAuth);

// An application in the admin Trash can't be changed from the Globe portal either
router.param("id", require("../controllers/trashController").rejectIfTrashed);

// Globe only works on applications STK has approved. One STK has rejected (or not approved yet) is not on
// the Globe portal at all — Globe can't open it, even by link. A Globe-rejected one that is back with STK
// for review stays in Globe's "Rejected" list, so it can be opened, but not changed until STK approves it.
const prisma = require("../config/db");
const NOT_WITH_GLOBE = "This application is not with Globe — STK has not approved it.";
const BACK_WITH_STK = "This application is back with STK for review. Globe can act on it once STK approves it again.";
router.param("id", async (req, res, next, id) => {
  if (req.user?.role !== "globe") return next();
  try {
    const key = String(id);
    const app = await prisma.kycApplication.findFirst({
      where: { OR: [{ applicationId: key }, ...(/^\d+$/.test(key) ? [{ id: Number(key) }] : [])] },
      select: { status: true, globeStatus: true },
    });
    if (!app) return next(); // the handler answers "not found"
    const withGlobe = app.status === "verified";
    const viewable = withGlobe || (app.globeStatus === "rejected" && app.status !== "rejected");
    if (!viewable) return res.status(403).json({ success: false, error: NOT_WITH_GLOBE, message: NOT_WITH_GLOBE });
    if (req.method !== "GET" && !withGlobe) return res.status(403).json({ success: false, error: BACK_WITH_STK, message: BACK_WITH_STK });
    next();
  } catch (error) {
    next(error);
  }
});

router.get("/kpis", globeController.getDashboardKPIs);
router.get("/kycs", globeController.getPendingKYCs);

// The Globe status is set only by Globe reviewers — never by STK (admin / KYC team)
const globeOnly = (req, res, next) => {
  if (req.user.role !== "globe") {
    return res.status(403).json({ success: false, error: "Only Globe reviewers can change the Globe status" });
  }
  next();
};

router.post("/kycs/:id/approve", globeOnly, globeController.approveKYC);
// No "reject without mail" route: Globe rejects sections / documents and then sends the rejection mail,
// so the applicant always gets a link to correct them (see agentController.requestModifications)
// Sending to back office is done from the admin portal only — never by Globe reviewers
const notGlobe = (req, res, next) => {
  if (req.user.role === "globe") {
    return res.status(403).json({ success: false, error: "Sending to back office is done from the admin portal" });
  }
  next();
};
router.post("/kycs/:id/push", notGlobe, globeController.pushToBackoffice);
router.put("/kycs/:id/status", globeOnly, globeController.updateGlobeStatus);

router.get("/application/:id", getApplicationById);

const { updateApplicationDetails, uploadAdminDocument } = require("../controllers/adminController");
const { requestModifications, reviewStep, savePendingDocumentRejections } = require("../controllers/agentController");
const upload = require("../middlewares/upload");

router.put("/application/:id/update-details", updateApplicationDetails);
router.post("/application/:id/request-modifications", requestModifications);
router.post("/application/:id/upload-document", upload.single("document"), uploadAdminDocument);
router.post("/kyc/:id/step/:stepName/review", reviewStep);
// Pending (not yet mailed) document rejections, shared live across reviewer devices
router.put("/kyc/:id/document-rejections", savePendingDocumentRejections);

module.exports = router;
