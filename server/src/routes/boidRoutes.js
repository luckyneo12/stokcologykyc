const express = require("express");
const { getBoids, uploadBoids, updateBoid } = require("../controllers/boidController");
const { adminAuth } = require("../middlewares/auth");
const localUpload = require("../middlewares/localUpload");

const router = express.Router();

router.get("/", adminAuth, getBoids);
router.post("/upload", adminAuth, localUpload.single("file"), uploadBoids);
router.put("/:id", adminAuth, updateBoid);

module.exports = router;
