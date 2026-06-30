const express = require("express");
const { getAssignedApplications, reviewStep, getApReferrals, requestModifications } = require("../controllers/agentController");
const { auth } = require("../middlewares/auth");

const router = express.Router();

// Ensure only kyc_team agents can access these routes
const agentAuth = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.role !== "kyc_team" && req.user.role !== "admin") {
      return res.status(403).json({ error: "KYC team access required" });
    }
    next();
  });
};

const apAuth = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.role !== "AP" && req.user.role !== "admin") {
      return res.status(403).json({ error: "AP access required" });
    }
    next();
  });
};

router.get("/applications", agentAuth, getAssignedApplications);
router.post("/kyc/:id/step/:stepName/review", agentAuth, reviewStep);
router.post("/kyc/:id/request-modifications", agentAuth, requestModifications);

// AP Routes
router.get("/ap/referrals", apAuth, getApReferrals);

module.exports = router;
