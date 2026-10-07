const express = require("express");
const { sendOtp, verifyOtp, adminLogin, globeLogin, globeForgotPassword, globeResetPassword, kycTeamLogin, kycTeamSignup, setupAdmin, apLogin, createAp, logout } = require("../controllers/authController");
const { auth, adminAuth } = require("../middlewares/auth");

const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/admin-login", adminLogin);
router.post("/globe-login", globeLogin);
router.post("/globe-forgot-password", globeForgotPassword);
router.post("/globe-reset-password", globeResetPassword);
router.post("/kyc-login", kycTeamLogin);
router.post("/agent/login", kycTeamLogin); // Alias for agent portal
router.post("/kyc-signup", kycTeamSignup);
router.post("/setup-admin", setupAdmin);
router.post("/ap-login", apLogin);
router.post("/create-ap", adminAuth, createAp);

// Logout — validates JWT via auth middleware, then logs audit event
router.post("/logout", auth, logout);

module.exports = router;
