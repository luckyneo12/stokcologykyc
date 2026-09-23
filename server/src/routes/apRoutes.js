const express = require("express");
const { getApDashboard, getApUsers, changeApPassword } = require("../controllers/apController");
const { apAuth } = require("../middlewares/auth");

const router = express.Router();

router.get("/dashboard", apAuth, getApDashboard);
router.get("/users", apAuth, getApUsers);
router.post("/change-password", apAuth, changeApPassword);

module.exports = router;
