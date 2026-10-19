const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const crypto = require("crypto");
require("dotenv").config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "kyc_uploads",
    resource_type: "auto",
    access_mode: "public",
    public_id: (req, file) => `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});

module.exports = upload;

// OVD (Officially Valid Document) requested by an admin: PDF or any image format (HEIC, GIF, BMP, TIFF…).
// Non-JPG/PNG images are delivered as JPG (see uploadOvdDocument) so they can go into the KYC PDF and back office.
module.exports.ovd = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === "application/pdf" || String(file.mimetype || "").startsWith("image/");
    if (!ok) req.ovdRejectedType = file.mimetype || "unknown";
    cb(null, ok);
  },
});
