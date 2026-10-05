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
router.post("/kycs/:id/reject", globeOnly, globeController.rejectKYC);
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
const { requestModifications, reviewStep, getCorrectionLink, savePendingDocumentRejections } = require("../controllers/agentController");
const upload = require("../middlewares/upload");

router.put("/application/:id/update-details", updateApplicationDetails);
router.post("/application/:id/request-modifications", requestModifications);
router.post("/application/:id/upload-document", upload.single("document"), uploadAdminDocument);
router.post("/kyc/:id/step/:stepName/review", reviewStep);
// Same as the admin review page's "Correct as Admin" (opens the correction portal for this application)
router.get("/kyc/:id/correction-link", getCorrectionLink);
// Pending (not yet mailed) document rejections, shared live across reviewer devices
router.put("/kyc/:id/document-rejections", savePendingDocumentRejections);

module.exports = router;
