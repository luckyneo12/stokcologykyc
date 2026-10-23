const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const client = require("./clientController");
const admin = require("./adminController");
const { clientAuth, adminAuth, requirePermission } = require("./auth");
const { PERMISSIONS: P } = require("./permissions");

// Files stay in memory and are checked before anything is uploaded
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const singleFile = (field) => (req, res, next) =>
  memoryUpload.single(field)(req, res, (error) => {
    if (error) return res.status(400).json({ success: false, error: error.code === "LIMIT_FILE_SIZE" ? "File is too large." : "Could not read the file." });
    next();
  });

const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { success: false, error: "Too many attempts. Please try again later." } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { success: false, error: "Too many attempts. Please try again later." } });

// ─── Client portal: /api/rekyc ─────────────────────────────────────────────────
const clientRouter = express.Router();
clientRouter.post("/auth/send-otp", otpLimiter, client.sendLoginOtp);
clientRouter.post("/auth/verify-otp", otpLimiter, client.verifyLoginOtp);

clientRouter.use(clientAuth);
clientRouter.get("/me", client.me);
clientRouter.post("/personal/name", client.changeName);
clientRouter.post("/personal/relative", client.changeRelative);
clientRouter.post("/personal/contact/send-otp", otpLimiter, client.sendContactOtp);
clientRouter.post("/personal/contact/verify", otpLimiter, client.verifyContactOtp);
clientRouter.post("/personal/address/digilocker/start", client.startDigilocker);
clientRouter.post("/personal/address/digilocker/complete", client.completeDigilocker);
clientRouter.post("/changes/undo", client.undoChange);
clientRouter.get("/bank", client.listBanks);
clientRouter.post("/bank/ifsc", client.lookupIfsc);
clientRouter.post("/bank/add", client.addBank);
clientRouter.post("/bank/remove", client.removeBank);
clientRouter.post("/bank/restore", client.restoreBank);
clientRouter.post("/bank/default", client.setDefaultBank);
clientRouter.post("/segment", client.saveSegment);
clientRouter.post("/nominee", client.saveNominee);
clientRouter.post("/others", client.saveOthers);
clientRouter.get("/documents/options", client.documentOptions);
clientRouter.post("/documents/upload", singleFile("file"), client.uploadDocument);
clientRouter.post("/documents/remove", client.removeDocument);
clientRouter.post("/selfie", client.submitSelfie);
clientRouter.post("/esign/start", client.startEsign);
clientRouter.post("/esign/complete", client.completeEsign);
clientRouter.get("/esign/download", client.downloadSignedPdf);

// ─── ReKYC admin portal: /api/rekyc-admin ──────────────────────────────────────
const adminRouter = express.Router();
adminRouter.post("/auth/login", loginLimiter, admin.login);

adminRouter.use(adminAuth);
adminRouter.get("/auth/me", admin.me);
adminRouter.post("/auth/change-password", admin.changePassword);

adminRouter.get("/stats", requirePermission(P.DASHBOARD_VIEW), admin.stats);
adminRouter.get("/requests", requirePermission(P.REQUEST_VIEW), admin.listRequests);
adminRouter.get("/requests/:id", requirePermission(P.REQUEST_VIEW), admin.getRequest);
adminRouter.get("/requests/:id/files/:kind", requirePermission(P.REQUEST_VIEW), admin.getFile);
adminRouter.post("/requests/:id/maker-approve", requirePermission(P.MAKER_ACTION), admin.makerApprove);
adminRouter.post("/requests/:id/checker-approve", requirePermission(P.CHECKER_ACTION), requirePermission(P.BACKOFFICE_PUSH), admin.checkerApprove);
adminRouter.post("/requests/:id/reject", admin.reject); // maker or checker — checked inside by stage
adminRouter.post("/requests/:id/trash", requirePermission(P.REQUEST_TRASH), admin.trash);
adminRouter.post("/requests/:id/restore", requirePermission(P.REQUEST_TRASH), admin.restore);

adminRouter.get("/export/mis", requirePermission(P.REPORT_EXPORT), admin.exportMis);
adminRouter.get("/export/esigned-pdfs", requirePermission(P.REPORT_EXPORT), admin.exportEsignedPdfs);

adminRouter.get("/estamps", requirePermission(P.ESTAMP_MANAGE), admin.listEStamps);
adminRouter.post("/estamps", requirePermission(P.ESTAMP_MANAGE), singleFile("file"), admin.uploadEStamp);
adminRouter.get("/estamps/:id/file", requirePermission(P.ESTAMP_MANAGE), admin.viewEStamp);
adminRouter.delete("/estamps/:id", requirePermission(P.ESTAMP_MANAGE), admin.deleteEStamp);

adminRouter.get("/users", requirePermission(P.USER_MANAGE), admin.listUsers);
adminRouter.post("/users", requirePermission(P.USER_MANAGE), admin.createUser);
adminRouter.put("/users/:id", requirePermission(P.USER_MANAGE), admin.updateUser);
adminRouter.post("/users/:id/reset-password", requirePermission(P.USER_MANAGE), admin.resetUserPassword);
adminRouter.get("/audit", requirePermission(P.AUDIT_VIEW), admin.auditLog);

module.exports = { clientRouter, adminRouter };
