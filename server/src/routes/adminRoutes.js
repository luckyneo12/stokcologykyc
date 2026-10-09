const express = require("express");
const {
  getApplications,
  getApplicationById,
  reviewApplication,
  getStats,
  getAuditLogs,
  getUsers,
  getRiskFraud,
  getDocuments,
  getFaceMatchLogs,
  getUserKycDetails,
  refreshFromDigio,
  sendToBackoffice,
  getCrmEmployees,
  assignApplication,
  updateUserEstamp,
  updateEstampSequence,
  testBackofficeConnection
} = require("../controllers/adminController");
const { adminAuth } = require("../middlewares/auth");
const estampRoutes = require("./estampRoutes");
const trash = require("../controllers/trashController");

const router = express.Router();

// A trashed application can't be changed through any /:id route until it is restored
router.param("id", trash.rejectIfTrashed);

const boidRoutes = require("./boidRoutes");
router.use("/boids", boidRoutes);

router.use("/estamp", estampRoutes);

router.get("/applications", adminAuth, getApplications);
router.get("/application/:id", adminAuth, getApplicationById);
router.put("/review/:id", adminAuth, reviewApplication);
// "Delete" moves the application to the Trash; it is removed only from there
router.delete("/application/:id", adminAuth, trash.moveToTrash);
router.get("/trash", adminAuth, trash.listTrash);
router.get("/trash/:appId", adminAuth, trash.getTrashedApplication);
router.post("/trash/:appId/restore", adminAuth, trash.restoreFromTrash);
router.delete("/trash/:appId", adminAuth, trash.deletePermanently);
router.get("/dashboard-data", adminAuth, getStats);
router.get("/audit-logs", adminAuth, getAuditLogs);
router.get("/users", adminAuth, getUsers);
router.get("/users/:id", adminAuth, getUserKycDetails);
router.get("/risk-fraud", adminAuth, getRiskFraud);
router.get("/documents", adminAuth, getDocuments);
router.get("/facematch", adminAuth, getFaceMatchLogs);
router.post("/application/:id/refresh-digio", adminAuth, refreshFromDigio);
router.post("/application/:id/send-backoffice", adminAuth, sendToBackoffice);
router.get("/crm-employees", adminAuth, getCrmEmployees);
router.post("/application/:id/assign", adminAuth, assignApplication);
router.put("/users/:id/estamp", adminAuth, updateUserEstamp);
router.put("/sequence/estamp", adminAuth, updateEstampSequence);
router.post("/backoffice/test-connection", adminAuth, testBackofficeConnection);

// Rejection email / modification request (reuse agent controller logic)
const { requestModifications } = require("../controllers/agentController");
router.post("/application/:id/request-modifications", adminAuth, requestModifications);

// Update application details directly
const { updateApplicationDetails, uploadAdminDocument, generateUserToken } = require("../controllers/adminController");
router.put("/application/:id/update-details", adminAuth, updateApplicationDetails);
router.post("/application/:id/generate-token", adminAuth, generateUserToken);

// Upload document from admin portal (Cloudinary)
const upload = require("../middlewares/upload");
router.post("/application/:id/upload-document", adminAuth, upload.single("document"), uploadAdminDocument);

// AP Management
const { getApList, getApUsers, deleteAp, changeApStatus, changeApTier, bulkCreateAps } = require("../controllers/adminController");
router.get("/ap-list", adminAuth, getApList);
router.get("/ap/:id/users", adminAuth, getApUsers);
router.delete("/ap/:id", adminAuth, deleteAp);
router.put("/ap/:id/status", adminAuth, changeApStatus);
router.put("/ap/:id/tier", adminAuth, changeApTier);
router.post("/ap/bulk-create", adminAuth, bulkCreateAps);

module.exports = router;
