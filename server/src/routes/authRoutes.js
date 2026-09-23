const express = require("express");
const { sendOtp, verifyOtp, adminLogin, globeLogin, kycTeamLogin, kycTeamSignup, setupAdmin, apLogin, createAp } = require("../controllers/authController");
const { adminAuth } = require("../middlewares/auth");

const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/admin-login", adminLogin);
router.post("/globe-login", globeLogin);
router.post("/kyc-login", kycTeamLogin);
router.post("/agent/login", kycTeamLogin); // Alias for agent portal
router.post("/kyc-signup", kycTeamSignup);
router.post("/setup-admin", setupAdmin);
router.post("/ap-login", apLogin);
router.post("/create-ap", adminAuth, createAp);

module.exports = router;
