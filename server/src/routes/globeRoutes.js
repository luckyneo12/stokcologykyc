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

router.post("/kycs/:id/approve", globeController.approveKYC);
router.post("/kycs/:id/reject", globeController.rejectKYC);
router.post("/kycs/:id/push", globeController.pushToBackoffice);

router.get("/application/:id", getApplicationById);

module.exports = router;
