const express = require("express");
const {
  startKyc,
  getMyApplication,
  saveStep,
  uploadDocument,
  ocrExtract,
  faceMatch,
  submitKyc,
  getStatus,
  getKycConfig,
  getPincodeData,
  downloadPdf,
  bypassEsign,
  previewPdf,
  sendWelcome
} = require("../controllers/kycController");
const { auth } = require("../middlewares/auth");
const upload = require("../middlewares/upload");
const localUpload = require("../middlewares/localUpload");

const router = express.Router();

router.post("/start", auth, startKyc);
router.get("/me", auth, getMyApplication);

// Structured Step Endpoints for Clarity
router.put("/save/personal-details", auth, saveStep);
router.put("/save/address", auth, saveStep);
router.put("/save/bank", auth, saveStep);
router.put("/save/nominee", auth, saveStep);
router.put("/save/financials", auth, saveStep);
router.put("/save/signature", auth, saveStep);

// Legacy/Generic Sync Endpoint
router.put("/save-step", auth, saveStep);

router.post("/upload-document", auth, upload.single("document"), uploadDocument);
router.post("/upload-local", auth, localUpload.single("document"), uploadDocument);
router.post("/ocr-extract", auth, ocrExtract);
router.post("/face-match", auth, faceMatch);
router.post("/submit", auth, submitKyc);
router.post("/bypass-esign", auth, bypassEsign);
router.post("/preview-pdf", auth, previewPdf);
router.get("/status/:applicationId", auth, getStatus);
router.get("/download-pdf/:applicationId", auth, downloadPdf);
router.get("/config", getKycConfig);
router.get("/pincode/:pin", getPincodeData);
router.post("/welcome-email", auth, sendWelcome);

// Proxy endpoint for PDF preview — fetches remote PDFs and serves them as same-origin
router.get("/proxy-pdf", auth, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, error: "Missing url parameter" });

  // Only allow proxying from trusted sources (Cloudinary)
  if (!url.startsWith("https://res.cloudinary.com/")) {
    return res.status(403).json({ success: false, error: "URL not allowed" });
  }

  try {
    const { v2: cloudinary } = require("cloudinary");
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Extract public_id from Cloudinary URL
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/);
    if (!pathMatch) {
      return res.status(400).json({ success: false, error: "Could not parse Cloudinary URL" });
    }

    const resourceType = pathMatch[1];
    const publicIdWithExt = pathMatch[2];
    const ext = publicIdWithExt.match(/\.([^.]+)$/)?.[1] || "pdf";
    const publicId = publicIdWithExt.replace(/\.[^.]+$/, "");

    console.log(`[Proxy PDF] Resource: ${publicId}, ext: ${ext}, type: ${resourceType}`);

    // Use the private_download_url which generates an API-authenticated download URL
    // This bypasses Strict Transformations and delivery-level security
    const downloadUrl = cloudinary.utils.private_download_url(publicId, ext, {
      resource_type: resourceType,
      type: "upload",
      attachment: false,
    });

    console.log(`[Proxy PDF] Download URL: ${downloadUrl}`);

    const https = require("https");
    const fetchUrl = (targetUrl) => {
      return new Promise((resolve, reject) => {
        https.get(targetUrl, (proxyRes) => {
          if (proxyRes.statusCode === 301 || proxyRes.statusCode === 302) {
            fetchUrl(proxyRes.headers.location).then(resolve).catch(reject);
            return;
          }
          resolve(proxyRes);
        }).on("error", reject);
      });
    };

    const proxyRes = await fetchUrl(downloadUrl);

    if (proxyRes.statusCode !== 200) {
      console.error(`[Proxy PDF] Download returned ${proxyRes.statusCode}`);
      // Log response body for debugging
      let body = "";
      proxyRes.on("data", (chunk) => body += chunk);
      proxyRes.on("end", () => {
        console.error(`[Proxy PDF] Response body: ${body}`);
        res.status(proxyRes.statusCode).json({ success: false, error: `Download failed (${proxyRes.statusCode}): ${body}` });
      });
      return;
    }

    const contentType = proxyRes.headers["content-type"] || "application/pdf";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "inline");
    proxyRes.pipe(res);
  } catch (err) {
    console.error("[Proxy PDF] Error:", err.message, err.stack);
    res.status(500).json({ success: false, error: "Failed to proxy PDF: " + err.message });
  }
});

module.exports = router;
