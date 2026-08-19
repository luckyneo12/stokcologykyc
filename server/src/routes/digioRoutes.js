const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { z } = require("zod");

const prisma = require("../config/db");
const { auth } = require("../middlewares/auth");
const panService = require("../services/panService");
const digilockerService = require("../services/digilockerService");
const bankService = require("../services/bankService");
const selfieService = require("../services/selfieService");
const esignService = require("../services/esignService");
const digioClient = require("../services/digioClient");
const cloudinary = require("cloudinary").v2;

const uploadBufferToCloudinary = (buffer, filename, format = undefined) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { 
        folder: "kyc_uploads", 
        public_id: filename, 
        resource_type: "auto",
        ...(format && { format })
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

const router = express.Router();

router.get("/test", (req, res) =>
  res.json({ message: "Digio Router is working" }),
);

const CREATE_REQUEST_SCHEMA = z.object({
  type: z.enum([
    "PAN_VERIFICATION",
    "DIGILOCKER",
    "BANK_VERIFICATION",
    "SELFIE",
    "LIVENESS",
    "ESIGN",
  ]),
  data: z.record(z.string(), z.any()).optional().default({}),
  applicationId: z.string().optional(),
});

const VERIFY_PAN_SCHEMA = z.object({
  pan: z.string().length(10),
  fullName: z.string().min(3),
  dob: z.string(), // YYYY-MM-DD
  applicationId: z.string().optional(),
});

const FETCH_RESPONSE_SCHEMA = z.object({
  requestId: z.string().optional(),
  applicationId: z.string().optional(),
  type: z.string().optional(),
});

const STEP_BY_REQUEST_TYPE = {
  PAN_VERIFICATION: 4,
  DIGILOCKER: 5,
  BANK_VERIFICATION: 10,
  ESIGN: 13,
};

const DIGIO_ACTION_BY_REQUEST_TYPE = {
  PAN_VERIFICATION: "DIGILOCKER",
  DIGILOCKER: "DIGILOCKER",
  BANK_VERIFICATION: "PENNY_DROP",
  SELFIE: "SELFIE",
  LIVENESS: "SELFIE",
  ESIGN: "DIGILOCKER",
};

function generateApplicationId() {
  return (
    "KYC" +
    Date.now().toString(36).toUpperCase() +
    crypto.randomBytes(2).toString("hex").toUpperCase()
  );
}

function resolveCustomerIdentifier(user) {
  // Prioritize mobile for DigiLocker login experience
  if (user?.phone) {
    const cleanPhone = user.phone.replace(/\D/g, "").slice(-10);
    if (/^[6-9]\d{9}$/.test(cleanPhone)) return cleanPhone;
  }
  if (user?.email) return user.email;
  return null;
}

async function writeAuditLog({ userId, action, details, ipAddress }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        details: serializeJsonField(details),
        ipAddress,
      },
    });
  } catch (error) {
    console.error("[AuditLog] Failed to persist log:", error.message);
  }
}

async function getOrCreateDraftApplication({ userId, applicationId }) {
  if (applicationId) {
    const existing = await prisma.kycApplication.findUnique({
      where: { applicationId },
      include: { user: true },
    });
    if (!existing || existing.userId !== userId) return null;
    return existing;
  }

  const existing = await prisma.kycApplication.findFirst({
    where: {
      userId,
      status: { in: ["pending", "under_review", "on_hold"] },
    },
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });

  if (existing) return existing;

  return prisma.kycApplication.create({
    data: {
      userId,
      applicationId: generateApplicationId(),
      status: "pending",
      currentStep: 0,
    },
  });
}

/**
 * Defensively merges a patch into an existing JSON object.
 * Protects existing non-empty values from being overwritten by empty/null patches.
 */
function mergeJson(existing, patch) {
  const existingObj = parseJsonField(existing) || {};
  const patchObj = parseJsonField(patch) || {};

  if (!patchObj || Object.keys(patchObj).length === 0) return existingObj;
  if (!existingObj || Object.keys(existingObj).length === 0) return patchObj;

  const result = { ...existingObj };

  Object.keys(patchObj).forEach((key) => {
    const val = patchObj[key];
    const oldVal = existingObj[key];

    // Recursive merge for nested objects (except arrays)
    if (
      val &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      oldVal &&
      typeof oldVal === "object" &&
      !Array.isArray(oldVal)
    ) {
      result[key] = mergeJson(oldVal, val);
      return;
    }

    // Protection: if the new value is empty but the old value was populated, keep old
    const isEmpty =
      val === null ||
      val === undefined ||
      (typeof val === "string" && val.trim() === "") ||
      (typeof val === "object" &&
        !Array.isArray(val) &&
        Object.keys(val).length === 0);
    const wasPopulated =
      oldVal !== null &&
      oldVal !== undefined &&
      oldVal !== "" &&
      !(
        typeof oldVal === "object" &&
        !Array.isArray(oldVal) &&
        Object.keys(oldVal).length === 0
      );

    if (isEmpty && wasPopulated) {
      return; // Protect the existing populated value
    }

    result[key] = val;
  });

  return result;
}

function parseJsonField(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function serializeJsonField(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

function serializeJsonFields(data, keys) {
  const next = { ...data };
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(next, key)) {
      next[key] = serializeJsonField(next[key]);
    }
  });
  return next;
}

function extractFaceScoreFromDigioResponse(digioResponse) {
  const scoreCandidates = [];

  const pushNormalized = (value) => {
    if (value === null || value === undefined) return;
    const num = Number(value);
    if (Number.isNaN(num)) return;
    if (num <= 1) {
      scoreCandidates.push(Math.round(num * 100));
    } else {
      scoreCandidates.push(Math.round(num));
    }
  };

  pushNormalized(digioResponse?.score);
  pushNormalized(digioResponse?.similarity);
  pushNormalized(digioResponse?.face_match_score);
  pushNormalized(digioResponse?.faceMatchScore);

  if (Array.isArray(digioResponse?.actions)) {
    for (const action of digioResponse.actions) {
      pushNormalized(action?.score);
      pushNormalized(action?.similarity);
      pushNormalized(action?.face_match_score);
      pushNormalized(action?.details?.score);
      pushNormalized(action?.details?.similarity);
      pushNormalized(action?.details?.face_match_score);
    }
  }

  if (!scoreCandidates.length) return null;
  return Math.max(...scoreCandidates);
}

function cleanPdfText(value, fallback = "N/A") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return (
    String(value)
      .replace(/[^\x20-\x7E]/g, " ")
      .trim() || fallback
  );
}

function maskAadhaar(value) {
  const digits = cleanPdfText(value, "").replace(/\D/g, "");
  if (digits.length < 4) return "XXXXXXXXXXXX";
  return `XXXXXXXX${digits.slice(-4)}`;
}

function findDigilockerExecutionRequestId(digioResponse) {
  if (!digioResponse || typeof digioResponse !== "object") return null;

  const actions = Array.isArray(digioResponse.actions)
    ? digioResponse.actions
    : [];
  for (const action of actions) {
    if (
      String(action?.type || "").toLowerCase() === "digilocker" &&
      action.execution_request_id
    ) {
      return action.execution_request_id;
    }
  }

  const nestedActions = digioResponse?.ocrData?.digio?.DIGILOCKER?.actions;
  if (Array.isArray(nestedActions)) {
    for (const action of nestedActions) {
      if (action?.execution_request_id) return action.execution_request_id;
    }
  }

  return digioResponse.execution_request_id || null;
}

function detectMediaExtension(buffer, contentType = "") {
  const content = String(contentType).toLowerCase();
  if (content.includes("pdf") || buffer.slice(0, 4).toString() === "%PDF")
    return "pdf";
  if (content.includes("zip") || (buffer[0] === 0x50 && buffer[1] === 0x4b))
    return "zip";
  if (
    content.includes("xml") ||
    buffer.slice(0, 5).toString().startsWith("<?xml")
  )
    return "xml";
  if (content.includes("png") || (buffer[0] === 0x89 && buffer[1] === 0x50))
    return "png";
  if (
    content.includes("jpeg") ||
    content.includes("jpg") ||
    (buffer[0] === 0xff && buffer[1] === 0xd8)
  )
    return "jpg";
  return "bin";
}

function documentPriorityScore(doc) {
  let score = 0;
  if (doc?.issued) score += 100;
  else if (!doc?.generated) score += 60;
  else score += 20;
  if (String(doc?.path || "").includes("issued")) score += 10;
  return score;
}

function getDocumentBucket(doc) {
  const type = String(doc?.type || "").toUpperCase();
  const label = String(doc?.label || "").toUpperCase();
  const docPath = String(doc?.path || "").toLowerCase();

  const pathIsPan = /digilocker_pan|_pan_issued|(^|[/_])pan([/_]|\.)/i.test(
    docPath,
  );
  const pathIsAadhaar =
    /digilocker_aadhaar|_aadhaar_issued|aadhaar|aadhar|uid/i.test(docPath);

  if (type === "PHOTO" || (/\.(png|jpe?g|webp)$/i.test(docPath) && !pathIsPan))
    return "PHOTO";
  if (pathIsPan || (type.includes("PAN") && !type.includes("AADHAAR")))
    return "PAN";
  if (
    pathIsAadhaar ||
    type.includes("AADHAAR") ||
    type.includes("AADHAR") ||
    type.includes("UID") ||
    label.includes("AADHAAR")
  ) {
    return "AADHAAR";
  }
  return `FILE:${docPath}`;
}

function dedupeApplicationDocuments(documents) {
  if (!Array.isArray(documents)) return [];

  const bestByBucket = new Map();
  const pathSeen = new Set();

  for (const doc of documents) {
    if (!doc?.path || pathSeen.has(doc.path)) continue;
    pathSeen.add(doc.path);

    const bucket = getDocumentBucket(doc);
    const existing = bestByBucket.get(bucket);
    if (
      !existing ||
      documentPriorityScore(doc) > documentPriorityScore(existing)
    ) {
      bestByBucket.set(bucket, doc);
    }
  }

  return Array.from(bestByBucket.values());
}

function hasDocumentBucket(documents, bucket) {
  return dedupeApplicationDocuments(documents).some(
    (doc) => getDocumentBucket(doc) === bucket,
  );
}

async function downloadDigilockerIssuedDocuments({
  executionRequestId,
  requestId,
  uploadsDir,
  addSavedDocument,
  existingDocuments = [],
}) {
  if (!executionRequestId) return;

  const docTypes = ["AADHAAR", "PAN"];

  for (const docType of docTypes) {
    const existingBest = dedupeApplicationDocuments(existingDocuments).find(
      (d) => getDocumentBucket(d) === docType,
    );
    if (existingBest && existingBest.issued) {
      console.log(
        `[Digio] Skipping media download for ${docType} — already stored and issued`,
      );
      continue;
    }
    try {
      console.log(
        `[Digio] Downloading DigiLocker media ${docType} for ${executionRequestId}`,
      );
      const response = await digioClient.downloadKycMedia(executionRequestId, {
        docType,
        xml: false,
        base64: false,
      });
      const buffer = Buffer.from(response.data || []);
      if (!buffer.length) continue;

      const extension = detectMediaExtension(
        buffer,
        response.headers?.["content-type"] || "",
      );
      const publicId = `digilocker_${docType.toLowerCase()}_issued_${requestId}_${Date.now()}`;
      
      const filePath = path.join(uploadsDir, `${publicId}.${extension}`);
      fs.writeFileSync(filePath, buffer);

      addSavedDocument({
        path: `/uploads/${publicId}.${extension}`,
        type: docType,
        label: `DigiLocker ${docType} (issued)`,
        issued: true,
      });
      console.log(`[Digio] Saved issued ${docType} locally: /uploads/${publicId}.${extension}`);
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data
        ? Buffer.isBuffer(error.response.data)
          ? error.response.data.toString("utf8").slice(0, 200)
          : JSON.stringify(error.response.data)
        : error.message;
      console.warn(
        `[Digio] Media download failed for ${docType} (${status || "n/a"}):`,
        message,
      );
    }
  }
}

function wrapText(text, maxChars = 54) {
  const words = cleanPdfText(text, "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    if ((line + " " + word).trim().length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : ["N/A"];
}

function drawVerificationRow(
  page,
  { x, y, width, label, value, font, boldFont, height = 24 },
) {
  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    borderColor: rgb(0.55, 0.55, 0.55),
    borderWidth: 0.7,
  });
  page.drawRectangle({
    x,
    y: y - height,
    width: 132,
    height,
    color: rgb(0.94, 0.95, 0.95),
    borderColor: rgb(0.55, 0.55, 0.55),
    borderWidth: 0.7,
  });
  page.drawText(cleanPdfText(label), {
    x: x + 7,
    y: y - 15,
    size: 8,
    font: boldFont,
  });
  const lines = wrapText(value, 52).slice(0, 2);
  lines.forEach((line, idx) => {
    page.drawText(line, { x: x + 140, y: y - 15 - idx * 10, size: 8, font });
  });
}

async function embedPhotoInPdfPage(pdfDoc, page, photoPath) {
  if (!photoPath) return;
  try {
    const absolutePath = path.isAbsolute(photoPath)
      ? photoPath
      : path.join(__dirname, "../../", photoPath.replace(/^\//, ""));
    if (!fs.existsSync(absolutePath)) return;

    const bytes = fs.readFileSync(absolutePath);
    const lowerPath = absolutePath.toLowerCase();
    const image = lowerPath.endsWith(".png")
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);
    const dims = image.scaleToFit(95, 120);
    page.drawImage(image, {
      x: 405 + (95 - dims.width) / 2,
      y: 525 + (120 - dims.height) / 2,
      width: dims.width,
      height: dims.height,
    });
  } catch (error) {
    console.warn(
      "[Digio] Could not embed Aadhaar photo in verification PDF:",
      error.message,
    );
  }
}

async function createDigilockerAadhaarPdf({
  filePath,
  identityDetails,
  personalDetails,
  address,
  photoPath,
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const width = page.getWidth();
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  page.drawText("DigiLocker verified e-Aadhaar", {
    x: 192,
    y: 770,
    size: 14,
    font: boldFont,
  });
  page.drawText(
    "This document is generated from DigiLocker verified Aadhaar data fetched through Digio.",
    { x: 78, y: 752, size: 7, font },
  );
  page.drawText("XML verified", {
    x: 470,
    y: 720,
    size: 9,
    font: boldFont,
    color: rgb(0, 0.5, 0.18),
  });
  page.drawRectangle({
    x: 452,
    y: 708,
    width: 52,
    height: 52,
    borderColor: rgb(0, 0.55, 0.2),
    borderWidth: 1,
  });
  page.drawText("OK", {
    x: 469,
    y: 727,
    size: 14,
    font: boldFont,
    color: rgb(0, 0.55, 0.2),
  });

  const tableX = 34;
  const tableW = width - 68;
  let y = 720;
  const rows = [
    [
      "Document type",
      "e-Aadhaar generated from DigiLocker verified Aadhaar XML",
    ],
    ["Generation date", now],
    ["Masked Aadhaar number", maskAadhaar(identityDetails.aadhaar)],
    ["Name", personalDetails.fullName],
    ["Date Of Birth", personalDetails.dob],
    ["Gender", personalDetails.gender],
    ["Care of", personalDetails.fatherName],
  ];

  rows.forEach(([label, value]) => {
    drawVerificationRow(page, {
      x: tableX,
      y,
      width: tableW,
      label,
      value,
      font,
      boldFont,
    });
    y -= 24;
  });

  const addressValue = [
    address.line1,
    address.line2,
    address.line3,
    address.city,
    address.state,
    address.pincode,
  ]
    .filter(Boolean)
    .join(", ");
  drawVerificationRow(page, {
    x: tableX,
    y,
    width: tableW,
    label: "Address",
    value: addressValue,
    font,
    boldFont,
    height: 58,
  });
  y -= 58;
  drawVerificationRow(page, {
    x: tableX,
    y,
    width: tableW / 2,
    label: "City / District",
    value: address.city,
    font,
    boldFont,
  });
  drawVerificationRow(page, {
    x: tableX + tableW / 2,
    y,
    width: tableW / 2,
    label: "Pin Code",
    value: address.pincode,
    font,
    boldFont,
  });
  y -= 24;
  drawVerificationRow(page, {
    x: tableX,
    y,
    width: tableW / 2,
    label: "State",
    value: address.state,
    font,
    boldFont,
  });
  drawVerificationRow(page, {
    x: tableX + tableW / 2,
    y,
    width: tableW / 2,
    label: "Country",
    value: address.country || "India",
    font,
    boldFont,
  });

  page.drawRectangle({
    x: 400,
    y: 520,
    width: 105,
    height: 130,
    borderColor: rgb(0.65, 0.65, 0.65),
    borderWidth: 1,
    color: rgb(0.92, 0.94, 0.96),
  });
  await embedPhotoInPdfPage(pdfDoc, page, photoPath);
  if (!photoPath) {
    page.drawText("PHOTO", {
      x: 434,
      y: 582,
      size: 10,
      font: boldFont,
      color: rgb(0.45, 0.45, 0.45),
    });
  }
  page.drawText("www.digio.in | For Limited Circulation | CONFIDENTIAL", {
    x: 185,
    y: 60,
    size: 7,
    font,
    color: rgb(0, 0.2, 0.8),
  });

  fs.writeFileSync(filePath, await pdfDoc.save());
}

async function createDigilockerPanPdf({
  filePath,
  identityDetails,
  personalDetails,
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const x = 96;
  const tableW = 404;
  let y = 725;

  page.drawText("Income Tax Department", {
    x: 222,
    y: 774,
    size: 16,
    font: boldFont,
  });
  page.drawText("PAN VERIFICATION RECORD", {
    x: 218,
    y: 738,
    size: 11,
    font: boldFont,
  });
  page.drawRectangle({
    x,
    y: 728,
    width: tableW,
    height: 22,
    color: rgb(0.94, 0.95, 0.95),
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 0.7,
  });

  const rows = [
    ["Permanent Account Number", identityDetails.pan],
    ["Name", personalDetails.fullName || identityDetails.pan_name],
    ["Gender", personalDetails.gender],
    ["Date of Birth", personalDetails.dob],
    ["Verified On", now],
  ];

  rows.forEach(([label, value]) => {
    drawVerificationRow(page, {
      x,
      y,
      width: tableW,
      label: label.toUpperCase(),
      value,
      font,
      boldFont,
      height: 30,
    });
    y -= 30;
  });

  page.drawRectangle({
    x: 105,
    y: 490,
    width: 75,
    height: 75,
    borderColor: rgb(0.15, 0.15, 0.15),
    borderWidth: 1,
  });
  page.drawText("QR", { x: 132, y: 524, size: 16, font: boldFont });
  page.drawText("Digitally signed by DigiLocker", {
    x: 326,
    y: 530,
    size: 8,
    font,
  });
  page.drawText(`Date: ${now}`, { x: 326, y: 516, size: 8, font });
  page.drawText("Verified", {
    x: 446,
    y: 520,
    size: 12,
    font: boldFont,
    color: rgb(0, 0.55, 0.2),
  });
  page.drawRectangle({
    x: 96,
    y: 430,
    width: tableW,
    height: 45,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 0.7,
  });
  page.drawText("Note:", { x: 106, y: 460, size: 7, font: boldFont });
  page.drawText("1. This PAN data is accessed using DigiLocker.", {
    x: 125,
    y: 460,
    size: 7,
    font,
  });
  page.drawText("2. This is digitally verified document valid as per IT Act.", {
    x: 125,
    y: 448,
    size: 7,
    font,
  });

  fs.writeFileSync(filePath, await pdfDoc.save());
}

router.post("/create-request", auth, async (req, res) => {
  const body = req.body || {};

  // Basic manual validation for robustness
  if (!body.type) {
    return res
      .status(400)
      .json({ success: false, error: "Request type is required" });
  }

  const payload = {
    type: body.type,
    data: body.data || {},
    applicationId: body.applicationId,
  };

  const { type, data, applicationId } = payload;
  const customerIdentifier = resolveCustomerIdentifier(req.user);

  if (!customerIdentifier) {
    return res.status(400).json({
      success: false,
      error: "Unable to resolve customer identifier (phone/email)",
    });
  }

  try {
    console.log(
      `[Digio Route] Create Request Type: ${type}, ApplicationId: ${applicationId}`,
    );

    const application = await getOrCreateDraftApplication({
      userId: req.user.id,
      applicationId,
    });

    if (!application) {
      console.warn(
        `[Digio Route] Application not found for UserID: ${req.user.id}`,
      );
      return res.status(404).json({
        success: false,
        error: "Application not found for this user",
      });
    }

    let result;
    try {
      switch (type) {
        case "PAN_VERIFICATION":
          result = await panService.createPanRequest(
            customerIdentifier,
            data.pan,
            data.dob,
            application.personalDetails?.fullName || req.user.name,
          );
          break;
        case "DIGILOCKER":
          result = await digilockerService.createRequest(
            customerIdentifier,
            data?.aadhaar,
            data?.documentTypes || ["AADHAAR", "PAN"],
            application.personalDetails?.fullName || req.user.name,
          );
          break;
        case "BANK_VERIFICATION":
          result = await bankService.createRequest(
            customerIdentifier,
            data.accountNumber,
            data.ifsc,
          );
          break;
        case "SELFIE":
        case "LIVENESS":
          result = await selfieService.createRequest(
            customerIdentifier,
            application.personalDetails?.fullName || req.user.name,
          );
          break;
        case "ESIGN":
          // We pass the entire application object so the service can generate the 55-page PDF locally
          result = await esignService.createRequest(
            customerIdentifier,
            data?.aadhaar,
            application,
          );
          break;
        default:
          return res
            .status(400)
            .json({ success: false, error: "Invalid request type" });
      }
    } catch (serviceError) {
      console.error(
        `[Digio Route] Service ${type} failed:`,
        serviceError.message,
      );
      throw serviceError;
    }

    if (!result || !result.id) {
      console.error(
        `[Digio Route] Service ${type} returned empty result or no ID:`,
        result,
      );
      throw new Error(`Failed to initialize Digio ${type} request`);
    }

    const nextStep = STEP_BY_REQUEST_TYPE[type] || application.currentStep;

    const nextIdentityDetails = mergeJson(application.identityDetails, {
      ...(data?.pan ? { pan: String(data.pan).toUpperCase() } : {}),
      ...(data?.aadhaar ? { aadhaar: String(data.aadhaar) } : {}),
    });

    let nextEsignDetails = parseJsonField(application.esignDetails, {});
    if (type === "ESIGN") {
      nextEsignDetails = mergeJson(nextEsignDetails, {
        ip:
          req.ip ||
          req.connection?.remoteAddress ||
          req.headers["x-forwarded-for"],
        lat: data?.lat || nextEsignDetails?.lat,
        lng: data?.lng || nextEsignDetails?.lng,
        name: application.personalDetails?.fullName || req.user.name,
        email: application.personalDetails?.email || req.user.email,
        phone: application.user?.phone || req.user.phone,
        status: "requested",
      });
    }

    let nextSelfieDetails = parseJsonField(application.selfieDetails, {});
    if (type === "SELFIE" || type === "LIVENESS") {
      nextSelfieDetails = mergeJson(nextSelfieDetails, {
        ip:
          req.ip ||
          req.connection?.remoteAddress ||
          req.headers["x-forwarded-for"],
        lat: data?.lat || nextSelfieDetails?.lat,
        lng: data?.lng || nextSelfieDetails?.lng,
      });
    }

    const nextPersonalDetails = mergeJson(application.personalDetails, {
      ...(data?.dob ? { dob: data.dob } : {}),
    });

    const nextOcrData = mergeJson(application.ocrData, {
      digio: mergeJson(application.ocrData?.digio, {
        [type]: {
          requestId: result.id,
          actionType: DIGIO_ACTION_BY_REQUEST_TYPE[type] || type,
          createdAt: new Date().toISOString(),
          status: result.status || "requested",
          customerIdentifier,
        },
      }),
    });

    await prisma.kycApplication.update({
      where: { id: application.id },
      data: serializeJsonFields(
        {
          currentStep: Math.max(application.currentStep || 0, nextStep),
          identityDetails: nextIdentityDetails,
          personalDetails: nextPersonalDetails,
          ocrData: nextOcrData,
          ...(type === "ESIGN" ? { esignDetails: nextEsignDetails } : {}),
          ...(type === "SELFIE" || type === "LIVENESS"
            ? { selfieDetails: nextSelfieDetails }
            : {}),
        },
        [
          "identityDetails",
          "personalDetails",
          "ocrData",
          "esignDetails",
          "selfieDetails",
        ],
      ),
    });

      // Notify clients of real-time update
      if (req.app && req.app.get("io")) { req.app.get("io").to(application?.applicationId || req.body?.applicationId || req.params?.applicationId || req.query?.applicationId).emit("kyc_updated"); }

    await writeAuditLog({
      userId: req.user.id,
      action: "digio_request_created",
      details: {
        applicationId: application.applicationId,
        type,
        digioActionType: DIGIO_ACTION_BY_REQUEST_TYPE[type] || type,
        requestId: result.id,
        status: result.status,
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      applicationId: application.applicationId,
      id: result.id,
      status: result.status,
      customer_identifier: result.customer_identifier || customerIdentifier,
      reference_id: result.reference_id,
      transaction_id: result.transaction_id,
      access_token: result.access_token,
    });
  } catch (error) {
    const digioError = error.response?.data;
    console.error(
      `[Digio Route] Error in /create-request [${type}]:`,
      digioError || error.message,
    );

    await writeAuditLog({
      userId: req.user?.id,
      action: "digio_request_failed",
      details: {
        type,
        payload: data,
        digioError: digioError || { message: error.message },
      },
      ipAddress: req.ip,
    });

    return res.status(error.response?.status || 500).json({
      success: false,
      error:
        digioError?.message ||
        error.message ||
        "Failed to create Digio request",
      details: digioError?.details || error.message,
      code: digioError?.code || "INTERNAL_ERROR",
    });
  }
});

router.post("/verify-pan", auth, async (req, res) => {
  const body = req.body || {};

  if (!body.pan || !body.fullName || !body.dob) {
    return res
      .status(400)
      .json({ success: false, error: "PAN, Full Name, and DOB are required" });
  }

  const payload = {
    pan: body.pan,
    fullName: body.fullName,
    dob: body.dob,
    applicationId: body.applicationId,
  };

  const { pan, fullName, dob, applicationId } = payload;

  try {
    const application = await getOrCreateDraftApplication({
      userId: req.user.id,
      applicationId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        error: "Application not found for this user",
      });
    }

    // Check if PAN is already linked to another account
    try {
      const existingApps = await prisma.$queryRaw`
        SELECT id FROM KycApplication 
        WHERE userId != ${req.user.id} 
        AND JSON_EXTRACT(identityDetails, '$.pan') = ${pan.toUpperCase()}
        LIMIT 1
      `;

      if (existingApps && existingApps.length > 0) {
        return res.status(400).json({
          success: false,
          error:
            "This PAN number is already linked to another account. Please use a different PAN or contact support.",
        });
      }
    } catch (dbError) {
      console.error("Error checking existing PAN:", dbError);
      // Proceed gracefully if the JSON query fails due to DB version limitations
    }

    const result = await panService.verifyPan(pan, fullName, dob);

    if (result.success) {
      // Update application state
      const nextIdentityDetails = mergeJson(application.identityDetails, {
        pan: pan.toUpperCase(),
        pan_name: result.data.name_at_pan || fullName, // Use name from Digio if available
      });

      const nextPersonalDetails = mergeJson(application.personalDetails, {
        dob,
        fatherName:
          result.data?.father_name ||
          result.data?.parent_name ||
          result.data?.fathers_name ||
          result.data?.fatherName ||
          result.data?.relative_name ||
          application.personalDetails?.fatherName,
      });

      const nextOcrData = mergeJson(application.ocrData, {
        pan_verification: {
          verifiedAt: new Date().toISOString(),
          data: result.data,
          status: "success",
        },
      });

      await prisma.kycApplication.update({
        where: { id: application.id },
        data: serializeJsonFields(
          {
            currentStep: Math.max(
              application.currentStep || 0,
              STEP_BY_REQUEST_TYPE.PAN_VERIFICATION,
            ),
            identityDetails: nextIdentityDetails,
            personalDetails: nextPersonalDetails,
            ocrData: nextOcrData,
          },
          ["identityDetails", "personalDetails", "ocrData"],
        ),
      });

      // Notify clients of real-time update
      if (req.app && req.app.get("io")) { req.app.get("io").to(application?.applicationId || req.body?.applicationId || req.params?.applicationId || req.query?.applicationId).emit("kyc_updated"); }

      // BOID Allocation Logic
      const userWithBoid = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!userWithBoid.boid) {
        // Find an available BOID or one whose cooling period has expired
        const availableBoid = await prisma.boid.findFirst({
          where: {
            OR: [
              { status: "available" },
              { status: "cooling_period", coolingPeriodEnds: { lt: new Date() } }
            ]
          },
          orderBy: { createdAt: "asc" }
        });

        if (availableBoid) {
          await prisma.$transaction([
            prisma.boid.update({
              where: { id: availableBoid.id },
              data: {
                status: "assigned",
                assignedTo: req.user.id,
                coolingPeriodEnds: null
              }
            }),
            prisma.user.update({
              where: { id: req.user.id },
              data: { boid: availableBoid.boidNumber }
            })
          ]);
        }
      }

      await writeAuditLog({
        userId: req.user.id,
        action: "pan_verified_directly",
        details: {
          applicationId: application.applicationId,
          pan: pan.substring(0, 5) + "...",
          status: "success",
        },
        ipAddress: req.ip,
      });
    }

    return res.json(result);
  } catch (error) {
    console.error("Direct PAN Verification Route Error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to verify PAN",
    });
  }
});

router.post("/verify-nominee-proof", auth, async (req, res) => {
  const { proofType, proofNumber, fullName, dob } = req.body || {};

  if (!proofType || !proofNumber || !fullName || !dob) {
    return res
      .status(400)
      .json({
        success: false,
        error: "Proof Type, Number, Full Name, and DOB are required",
      });
  }

  try {
    if (proofType === "PAN CARD") {
      // Use Digio API for real PAN verification
      const result = await panService.verifyPan(proofNumber, fullName, dob);
      return res.json(result);
    } else if (proofType === "AADHAAR CARD") {
      // Since Digio Aadhaar verification requires OTP, we do a basic valid-format simulation here
      // Real-world scenario would require either a separate Digilocker flow or a basic ID search API
      if (/^[0-9]{12}$/.test(proofNumber)) {
        return res.json({
          success: true,
          data: { status: "VALID", name: fullName },
        });
      } else {
        return res
          .status(400)
          .json({ success: false, error: "Invalid Aadhaar format" });
      }
    } else {
      return res
        .status(400)
        .json({ success: false, error: "Unsupported proof type" });
    }
  } catch (error) {
    console.error("Nominee Proof Verification Route Error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to verify Nominee Proof",
    });
  }
});

router.post("/request-response/:requestId", auth, async (req, res) => {
  const { requestId } = req.params;
  const body = req.body || {};

  const payload = {
    requestId: requestId,
    applicationId: body.applicationId,
    type: body.type,
  };

  try {
    let digioResponse;
    if (payload.type === "ESIGN") {
      console.log(`[Digio Route] Fetching Document Details for ${requestId}`);
      digioResponse = await esignService.getRequestDetails(requestId);
    } else {
      console.log(
        `[Digio Route] Fetching KYC Request Response for ${requestId}`,
      );
      digioResponse = await digioClient.getKycRequestResponse(requestId);
    }

    const application = await getOrCreateDraftApplication({
      userId: req.user.id,
      applicationId: payload.applicationId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        error: "Application not found for this user",
      });
    }

    // Extract Selfie Image for Cross-Device Sync before sanitization
    let globalExtractedSelfieUrl = null;
    let globalExtractedFaceScore = null;
    if (payload.type === "SELFIE" || payload.type === "LIVENESS") {
      const selfieAction = digioResponse.actions?.find(a => 
         (a.type === "SELFIE" || a.type === "LIVENESS") && 
         (a.status === "approved" || a.status === "success" || a.status === "requested" || a.status === "approval_pending")
      );
      if (selfieAction && selfieAction.details && (selfieAction.details.image || selfieAction.details.photo)) {
        try {
          const base64Data = selfieAction.details.image || selfieAction.details.photo;
          const cleanBase64 = base64Data.replace(/^data:(image|application)\/[a-z0-9.+-]+;base64,/i, "");
          const { uploadBufferToCloudinary } = require("../utils/cloudinaryHelper");
          const buffer = Buffer.from(cleanBase64, "base64");
          const cloudinaryResult = await uploadBufferToCloudinary(buffer, `kyc_selfie_${application.applicationId}_${Date.now()}`, "jpg");
          globalExtractedSelfieUrl = cloudinaryResult.secure_url;
          if (selfieAction.details.face_match_score) {
             globalExtractedFaceScore = selfieAction.details.face_match_score;
          }
        } catch (err) {
          console.error("[Digio Route] Failed to upload extracted selfie to cloudinary:", err.message);
          globalExtractedSelfieUrl = "__DIGIO_SUCCESS__";
        }
      } else if (selfieAction && (selfieAction.status === "approved" || selfieAction.status === "success")) {
         globalExtractedSelfieUrl = "__DIGIO_SUCCESS__";
      }
    }

    // Sanitize actions to remove heavy base64 strings before storing in DB
    const sanitizedActions = digioResponse.actions
      ? JSON.parse(JSON.stringify(digioResponse.actions))
      : null;
    if (sanitizedActions) {
      for (const action of sanitizedActions) {
        if (action.details) {
          if (action.details.image) action.details.image = "[BASE64_EXTRACTED]";
          if (action.details.photo) action.details.photo = "[BASE64_EXTRACTED]";
          if (action.details.image_data)
            action.details.image_data = "[BASE64_EXTRACTED]";
          if (action.details.file_data)
            action.details.file_data = "[BASE64_EXTRACTED]";

          for (const key of Object.keys(action.details)) {
            if (
              action.details[key] &&
              typeof action.details[key] === "object"
            ) {
              const nested = action.details[key];
              if (nested.image) nested.image = "[BASE64_EXTRACTED]";
              if (nested.photo) nested.photo = "[BASE64_EXTRACTED]";
              if (nested.image_data) nested.image_data = "[BASE64_EXTRACTED]";
              if (nested.file_data) nested.file_data = "[BASE64_EXTRACTED]";
              if (nested.pdf_data) nested.pdf_data = "[BASE64_EXTRACTED]";
            }
          }
        }
      }
    }

    const nextOcrData = mergeJson(application.ocrData, {
      digio: mergeJson(application.ocrData?.digio, {
        [payload.type || "UNKNOWN"]: {
          requestId,
          fetchedAt: new Date().toISOString(),
          status: digioResponse.status || digioResponse.signing_status,
          // Actions are for KYC, signers are for documents
          ...(sanitizedActions ? { actions: sanitizedActions } : {}),
          ...(digioResponse.signers ? { signers: digioResponse.signers } : {}),
        },
      }),
    });

    // --- DEEP SCAN EXTRACTION ENGINE ---
    const findValue = (obj, targetKey) => {
      if (!obj || typeof obj !== "object") return null;
      if (obj[targetKey]) return obj[targetKey];
      for (const key in obj) {
        const val = findValue(obj[key], targetKey);
        if (val) return val;
      }
      return null;
    };

    const extractPanNumber = (value) => {
      if (!value) return null;
      if (typeof value === "string") {
        const match = value.toUpperCase().match(/[A-Z]{5}[0-9]{4}[A-Z]/);
        return match ? match[0] : null;
      }
      if (typeof value !== "object") return null;

      const preferredKeys = [
        "pan",
        "pan_no",
        "pan_number",
        "panNo",
        "id_no",
        "id_number",
        "number",
        "document_number",
      ];
      for (const key of preferredKeys) {
        const found = extractPanNumber(value[key]);
        if (found) return found;
      }

      for (const nested of Object.values(value)) {
        const found = extractPanNumber(nested);
        if (found) return found;
      }
      return null;
    };

    const extractAadhaarNumber = (value) => {
      if (!value) return null;
      if (typeof value === "string") {
        const trimmed = value.trim();
        const digits = trimmed.replace(/\D/g, "");
        if (digits.length === 12) return digits;
        // Digio/DigiLocker masked id e.g. xxxxxxxx3134
        if (/^[xX*]{4,}\d{4}$/i.test(trimmed.replace(/\s/g, "")))
          return trimmed.replace(/\s/g, "");
        if (/[xX*]/i.test(trimmed) && digits.length >= 4) return trimmed;
      }
      if (typeof value !== "object") return null;

      const preferredKeys = [
        "aadhaar_no",
        "aadhar_no",
        "aadhaar",
        "aadhar",
        "uid",
        "id_no",
        "id_number",
        "number",
        "document_number",
      ];
      for (const key of preferredKeys) {
        const found = extractAadhaarNumber(value[key]);
        if (found) return found;
      }

      for (const nested of Object.values(value)) {
        const found = extractAadhaarNumber(nested);
        if (found) return found;
      }
      return null;
    };

    let nextIdentityDetails = parseJsonField(application.identityDetails, {});
    let nextPersonalDetails = parseJsonField(application.personalDetails, {});
    let nextAddress = parseJsonField(application.address, {});

    // Scan for Identity
    const extractedAadhaar =
      extractAadhaarNumber(findValue(digioResponse, "aadhaar_no")) ||
      extractAadhaarNumber(findValue(digioResponse, "aadhaar")) ||
      extractAadhaarNumber(findValue(digioResponse, "aadhar")) ||
      extractAadhaarNumber(findValue(digioResponse, "id_number")) ||
      extractAadhaarNumber(findValue(digioResponse, "id_no"));
    const extractedPan =
      extractPanNumber(findValue(digioResponse, "pan")) ||
      extractPanNumber(findValue(digioResponse, "pan_no")) ||
      extractPanNumber(findValue(digioResponse, "pan_number")) ||
      extractPanNumber(findValue(digioResponse, "panNo")) ||
      extractPanNumber(digioResponse);
    const extractedName =
      findValue(digioResponse, "name") || findValue(digioResponse, "full_name");
    const extractedDob =
      findValue(digioResponse, "dob") ||
      findValue(digioResponse, "date_of_birth");
    const extractedGender = findValue(digioResponse, "gender");

    const digilockerActions = Array.isArray(digioResponse.actions)
      ? digioResponse.actions.filter(
          (action) => String(action?.type || "").toLowerCase() === "digilocker",
        )
      : [];

    for (const action of digilockerActions) {
      const aadhaarDetails = action?.details?.aadhaar;
      const panDetails = action?.details?.pan;

      if (aadhaarDetails?.id_number) {
        nextIdentityDetails.aadhaar = String(aadhaarDetails.id_number).trim();
      }
      if (panDetails?.id_number) {
        nextIdentityDetails.pan =
          extractPanNumber(panDetails.id_number) ||
          String(panDetails.id_number).trim().toUpperCase();
      }
      if (aadhaarDetails?.name) {
        nextIdentityDetails.aadhaarName = aadhaarDetails.name;
        if (!extractedName) nextPersonalDetails.fullName = aadhaarDetails.name;
      }
      if (panDetails?.name) {
        nextIdentityDetails.panName = panDetails.name;
      }
      if (aadhaarDetails?.dob && !extractedDob)
        nextPersonalDetails.dob = aadhaarDetails.dob;
      if (aadhaarDetails?.gender && !extractedGender)
        nextPersonalDetails.gender = aadhaarDetails.gender;
      if (aadhaarDetails?.father_name && !nextPersonalDetails.fatherName) {
        nextPersonalDetails.fatherName = String(aadhaarDetails.father_name)
          .replace(/^(S\/O|W\/O|D\/O|C\/O)[:\s]+/i, "")
          .trim();
      }
    }

    if (extractedAadhaar && !nextIdentityDetails.aadhaar)
      nextIdentityDetails.aadhaar = extractedAadhaar;
    if (extractedPan && !nextIdentityDetails.pan)
      nextIdentityDetails.pan = extractedPan;
    if (extractedName) {
      nextPersonalDetails.fullName = extractedName;
      if (
        payload.type === "PAN_VERIFICATION" ||
        findValue(digioResponse, "pan_no")
      ) {
        if (!nextIdentityDetails.panName)
          nextIdentityDetails.panName = extractedName;
      } else {
        if (!nextIdentityDetails.aadhaarName)
          nextIdentityDetails.aadhaarName = extractedName;
      }
    }
    if (extractedDob) nextPersonalDetails.dob = extractedDob;
    if (extractedGender) nextPersonalDetails.gender = extractedGender;

    // Scan for Father/Spouse Name (Care Of)
    const relativeName =
      findValue(digioResponse, "father_name") ||
      findValue(digioResponse, "spouse_name") ||
      findValue(digioResponse, "care_of") ||
      findValue(digioResponse, "relative_name") ||
      findValue(digioResponse, "co");

    if (relativeName) {
      console.log(`[Digio Extraction] Found relative name: ${relativeName}`);
      // Clean prefix if present (S/O: Binod Kumar -> Binod Kumar, D/O BINOD -> BINOD)
      const cleanRelative = relativeName
        .replace(/^(S\/O|W\/O|D\/O|C\/O|CO|SO|CARE OF)[:\s]+/i, "")
        .trim();
      nextPersonalDetails.fatherName = cleanRelative;
      console.log(`[Digio Extraction] Cleaned Father Name: ${cleanRelative}`);
    } else {
      // Try extracting from house/address if it starts with S/O
      const houseField =
        findValue(digioResponse, "house_no") ||
        findValue(digioResponse, "house");
      if (
        houseField &&
        /^(S\/O|W\/O|D\/O|C\/O|CO|SO)[:\s]+/i.test(houseField)
      ) {
        const match = houseField.match(
          /^(S\/O|W\/O|D\/O|C\/O|CO|SO)[:\s]+([^,]+)/i,
        );
        if (match && match[2]) {
          nextPersonalDetails.fatherName = match[2].trim();
          console.log(
            `[Digio Extraction] Extracted Father Name from house field: ${nextPersonalDetails.fatherName}`,
          );
        }
      }
    }

    // Scan for Address (Deep Component Search)
    const house =
      findValue(digioResponse, "house_no") || findValue(digioResponse, "house");
    const street = findValue(digioResponse, "street");
    const landmark = findValue(digioResponse, "landmark");
    const loc =
      findValue(digioResponse, "loc") || findValue(digioResponse, "location");
    const vtc =
      findValue(digioResponse, "vtc") ||
      findValue(digioResponse, "city") ||
      findValue(digioResponse, "district_or_city");
    const dist =
      findValue(digioResponse, "dist") ||
      findValue(digioResponse, "district") ||
      findValue(digioResponse, "district_or_city");
    const state = findValue(digioResponse, "state");
    const pc =
      findValue(digioResponse, "pc") || findValue(digioResponse, "pincode");

    // Reconstruct Line 1 from pieces with cleaning
    const cleanPrefix = (str) => {
      if (!str || typeof str !== "string") return str;
      // Remove S/O:, W/O:, D/O:, C/O: and everything up to the first comma or space if it looks like a name
      return str
        .replace(/^(S\/O|W\/O|D\/O|C\/O|CO|SO)[:\s]+[^,]+,?\s*/i, "")
        .trim();
    };

    const addressParts = [cleanPrefix(house), street, landmark, loc].filter(
      Boolean,
    );
    if (addressParts.length > 0) {
      nextAddress.line1 = addressParts.join(", ");
    } else {
      const fullAddr =
        findValue(digioResponse, "address_information") ||
        findValue(digioResponse, "address");
      if (typeof fullAddr === "string")
        nextAddress.line1 = cleanPrefix(fullAddr);
      else if (fullAddr && typeof fullAddr === "object") {
        const rawAddr = fullAddr.address || fullAddr.line1 || nextAddress.line1;
        nextAddress.line1 = cleanPrefix(rawAddr);
      }
    }

    if (vtc || dist) nextAddress.city = vtc || dist;
    if (state) nextAddress.state = state;
    if (pc) nextAddress.pincode = pc;

    // --- DOCUMENT EXTRACTION ENGINE ---
    const previousDocuments = parseJsonField(application.documents, []);
    let savedDocumentPaths = [];
    const uploadsDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadsDir))
      fs.mkdirSync(uploadsDir, { recursive: true });

    const inferDocumentType = (...parts) => {
      const haystack = parts
        .filter(Boolean)
        .map((part) => {
          if (typeof part === "string") return part;
          try {
            return JSON.stringify(part);
          } catch {
            return "";
          }
        })
        .join(" ")
        .toUpperCase();

      if (
        haystack.includes("PHOTO") ||
        haystack.includes("SELFIE") ||
        haystack.includes("PORTRAIT") ||
        haystack.includes("FACE")
      )
        return "PHOTO";
      if (
        haystack.includes("AADHAAR") ||
        haystack.includes("AADHAR") ||
        haystack.includes("UID")
      )
        return "AADHAAR";
      if (haystack.includes("PAN")) return "PAN";
      if (haystack.includes("DRIVING") || haystack.includes("DL")) return "DL";
      if (haystack.includes("SIGN")) return "SIGN";
      return "DIGILOCKER_DOCUMENT";
    };

    const isDocumentBase64 = (value) => {
      if (!value || typeof value !== "string") return false;
      if (value === "[BASE64_EXTRACTED]") return false;
      const clean = value
        .replace(/^data:(image|application)\/[a-z0-9.+-]+;base64,/i, "")
        .trim();
      if (clean.length < 100) return false;
      if (
        clean.startsWith("JVBERi") ||
        clean.startsWith("/9j/") ||
        clean.startsWith("iVBORw")
      )
        return true;
      return /^[A-Za-z0-9+/=\r\n]+$/.test(clean.slice(0, 160));
    };

    const saveBase64Document = (base64Data, label, documentType) => {
      if (isDocumentBase64(base64Data)) {
        try {
          const isPdf =
            base64Data.includes("application/pdf") ||
            base64Data.startsWith("data:application/pdf") ||
            base64Data.startsWith("JVBERi") ||
            base64Data.includes("JVBERi");
          const ext = isPdf ? "pdf" : "png";
          const safeLabel = String(label || "document")
            .replace(/[^a-z0-9_-]+/gi, "_")
            .slice(0, 80);
          const filename = `extracted_${safeLabel}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
          const cleanBase64 = base64Data.replace(
            /^data:(image|application)\/[a-z0-9.+-]+;base64,/i,
            "",
          );
          
          fs.writeFileSync(
            path.join(uploadsDir, filename),
            Buffer.from(cleanBase64, "base64"),
          );
          
          console.log(`[Digio] Extracted and saved locally: ${documentType || label} as ${ext}`);
          
          const inferredType = documentType || inferDocumentType(label);
          const resolvedType =
            !isPdf && inferredType === "AADHAAR" ? "PHOTO" : inferredType;
          return {
            path: `/uploads/${filename}`,
            type: resolvedType,
            label,
          };
        } catch (e) {
          console.error(
            `[Digio] Failed to save extracted document ${label}:`,
            e.message,
          );
        }
      }
      return null;
    };

    const addSavedDocument = (document) => {
      if (!document?.path) return;
      if (savedDocumentPaths.some((saved) => saved.path === document.path))
        return;
      savedDocumentPaths.push(document);
    };

    const documentDataKeys = [
      "file_data",
      "pdf_data",
      "image_data",
      "document_data",
      "doc_data",
      "DocData",
      "base64",
      "image",
      "photo",
    ];

    const scanForDigilockerDocuments = (obj, context = []) => {
      if (!obj || typeof obj !== "object") return;

      if (Array.isArray(obj)) {
        obj.forEach((item, index) =>
          scanForDigilockerDocuments(item, [...context, String(index)]),
        );
        return;
      }

      const localType = inferDocumentType(
        ...context,
        obj.type,
        obj.document_type,
        obj.documentType,
        obj.doc_type,
        obj.document_id,
        obj.documentId,
        obj.name,
        obj.document_name,
        obj.documentName,
        obj.title,
        obj.label,
      );

      for (const key of documentDataKeys) {
        if (isDocumentBase64(obj[key])) {
          addSavedDocument(
            saveBase64Document(
              obj[key],
              [...context, localType, key].join("_"),
              localType,
            ),
          );
        }
      }

      for (const [key, val] of Object.entries(obj)) {
        if (documentDataKeys.includes(key)) continue;
        if (typeof val === "string" && isDocumentBase64(val)) {
          const docType = inferDocumentType(...context, key, obj);
          addSavedDocument(
            saveBase64Document(
              val,
              [...context, docType, key].join("_"),
              docType,
            ),
          );
        } else if (val && typeof val === "object") {
          scanForDigilockerDocuments(val, [...context, key]);
        }
      }
    };

    // Fallback 1: Extract PAN/Aadhaar files from any Digio response shape.
    scanForDigilockerDocuments(digioResponse, [payload.type || "DIGILOCKER"]);

    // Download issued DigiLocker PDFs via Digio Media API (execution_request_id / RID)
    if (payload.type === "DIGILOCKER" || payload.type === "PAN_VERIFICATION") {
      const executionRequestId =
        findDigilockerExecutionRequestId(digioResponse);
      if (executionRequestId) {
        await downloadDigilockerIssuedDocuments({
          executionRequestId,
          requestId,
          uploadsDir,
          addSavedDocument,
          existingDocuments: [...previousDocuments, ...savedDocumentPaths],
        });
      } else {
        console.warn(
          `[Digio] No execution_request_id found for media download on request ${requestId}`,
        );
      }
    }

    // Fallback 2: Direct Download from Digio if no images extracted
    if (savedDocumentPaths.length === 0) {
      if (payload.type === "ESIGN") {
        // Run completely in background for ESIGN to prevent blocking frontend completion
        (async () => {
          try {
            console.log(`[Background] Starting async download for ESIGN document ${requestId}...`);
            const downloadResponse = await esignService.downloadDocument(requestId);
            if (downloadResponse && downloadResponse.data) {
              const buffer = Buffer.from(downloadResponse.data);
              console.log(`[Background] ESIGN document downloaded (${buffer.length} bytes), uploading to Cloudinary...`);
              
              const { uploadBufferToCloudinary } = require("../utils/cloudinaryHelper");
              const publicId = `digio_${requestId}_${Date.now()}`;
              
              try {
                const cloudinaryResult = await uploadBufferToCloudinary(buffer, publicId, 'pdf');
                const finalUrl = cloudinaryResult.secure_url;
                
                // Fetch fresh documents array and update DB
                const appToUpdate = await prisma.kycApplication.findUnique({ where: { applicationId: application.applicationId } });
                if (appToUpdate) {
                  const currentDocs = parseJsonField(appToUpdate.documents, []);
                  currentDocs.push({
                    path: finalUrl,
                    type: "ESIGN_DOCUMENT",
                    label: "eSigned PDF"
                  });
                  await prisma.kycApplication.update({
                    where: { applicationId: application.applicationId },
                    data: { documents: JSON.stringify(currentDocs) }
                  });
                  console.log(`[Background] Successfully saved ESIGN document to DB for ${application.applicationId}`);
                  
                  // Trigger Welcome Email instantly
                  try {
                    const { sendWelcomeEmail } = require("../services/emailService");
                    const pDetails = parseJsonField(appToUpdate.personalDetails, {});
                    if (pDetails.email) {
                      await sendWelcomeEmail(pDetails.email, pDetails.fullName || "Customer", {
                        filename: `KYC_Application_${appToUpdate.applicationId}_Signed.pdf`,
                        content: buffer,
                        contentType: "application/pdf"
                      });
                      const sStatuses = parseJsonField(appToUpdate.stepStatuses, {});
                      sStatuses.welcomeEmailSent = true;
                      await prisma.kycApplication.update({
                        where: { applicationId: application.applicationId },
                        data: { stepStatuses: JSON.stringify(sStatuses) }
                      });
                      console.log(`[Background] Sent welcome email for ${application.applicationId}`);
                    }
                  } catch (emErr) {
                    console.error("[Background] Failed to send email:", emErr.message);
                  }
                }
              } catch (cloudErr) {
                console.error("[Background] Failed to upload ESIGN to cloudinary:", cloudErr.message);
                // Fallback to local storage if Cloudinary fails
                const filename = `${publicId}.pdf`;
                const filePath = path.join(uploadsDir, filename);
                fs.writeFileSync(filePath, buffer);
                
                const appToUpdate = await prisma.kycApplication.findUnique({ where: { applicationId: application.applicationId } });
                if (appToUpdate) {
                  const currentDocs = parseJsonField(appToUpdate.documents, []);
                  currentDocs.push({ path: `/uploads/${filename}`, type: "ESIGN_DOCUMENT", label: "eSigned PDF" });
                  await prisma.kycApplication.update({
                    where: { applicationId: application.applicationId },
                    data: { documents: JSON.stringify(currentDocs) }
                  });
                  
                  // Trigger Welcome Email instantly (fallback route)
                  try {
                    const { sendWelcomeEmail } = require("../services/emailService");
                    const pDetails = parseJsonField(appToUpdate.personalDetails, {});
                    if (pDetails.email) {
                      await sendWelcomeEmail(pDetails.email, pDetails.fullName || "Customer", {
                        filename: `KYC_Application_${appToUpdate.applicationId}_Signed.pdf`,
                        content: buffer,
                        contentType: "application/pdf"
                      });
                      const sStatuses = parseJsonField(appToUpdate.stepStatuses, {});
                      sStatuses.welcomeEmailSent = true;
                      await prisma.kycApplication.update({
                        where: { applicationId: application.applicationId },
                        data: { stepStatuses: JSON.stringify(sStatuses) }
                      });
                    }
                  } catch (emErr) {
                    console.error("[Background] Failed to send email in fallback:", emErr.message);
                  }
                }
              }
            }
          } catch (err) {
            console.error("[Background] Background ESIGN download failed:", err.message);
          }
        })();
      } else {
        // Synchronous download for PAN/DIGILOCKER
        try {
          const downloadResponse = await digioClient.downloadKycDocument(requestId);
          if (downloadResponse && downloadResponse.data) {
            const contentType = String(
              downloadResponse.headers?.["content-type"] || "",
            ).toLowerCase();
            const buffer = Buffer.from(downloadResponse.data);
            const isPdf =
              contentType.includes("pdf") ||
              buffer.slice(0, 4).toString() === "%PDF";
            const extension = isPdf ? "pdf" : "png";
            const filename = `digio_${requestId}_${Date.now()}.${extension}`;
            const filePath = path.join(uploadsDir, filename);
            fs.writeFileSync(filePath, buffer);
            savedDocumentPaths.push({
              path: `/uploads/${filename}`,
              type: payload.type || "DIGILOCKER_DOCUMENT",
              label: "download",
            });
          }
        } catch (downloadError) {
          console.warn(
            `[Digio] Document download skipped or failed for ${requestId}:`,
            downloadError.message,
          );
        }
      }
    }

    const hasPdfForType = (type) =>
      savedDocumentPaths.some((doc) => {
        const docType = String(doc.type || "").toUpperCase();
        const docPath = String(doc.path || "").toLowerCase();
        return docType.includes(type) && docPath.endsWith(".pdf");
      });
    const aadhaarPhotoPath =
      savedDocumentPaths.find((doc) => {
        const docPath = String(doc.path || "").toLowerCase();
        return doc.type === "PHOTO" || /\.(png|jpe?g|webp)$/i.test(docPath);
      })?.path || null;

    const addGeneratedVerificationPdf = async (type) => {
      const filename = `digilocker_${type.toLowerCase()}_${requestId}_${Date.now()}.pdf`;
      const filePath = path.join(uploadsDir, filename);

      if (type === "AADHAAR") {
        await createDigilockerAadhaarPdf({
          filePath,
          identityDetails: nextIdentityDetails,
          personalDetails: nextPersonalDetails,
          address: nextAddress,
          photoPath: aadhaarPhotoPath,
        });
      } else if (type === "PAN") {
        await createDigilockerPanPdf({
          filePath,
          identityDetails: nextIdentityDetails,
          personalDetails: nextPersonalDetails,
        });
      }

      try {
        savedDocumentPaths.push({
          path: `/uploads/${filename}`,
          type,
          label: `DigiLocker ${type} Verification PDF`,
          generated: true,
        });
        console.log(`[Digio] Generated ${type} PDF and saved locally: /uploads/${filename}`);
      } catch (err) {
        console.error(`[Digio] Failed to add generated ${type} PDF:`, err);
      }
    };

    if (
      (payload.type === "DIGILOCKER" || payload.type === "PAN_VERIFICATION") &&
      nextIdentityDetails.aadhaar
    ) {
      await addGeneratedVerificationPdf("AADHAAR");
    }

    if (
      (payload.type === "DIGILOCKER" || payload.type === "PAN_VERIFICATION") &&
      nextIdentityDetails.pan
    ) {
      await addGeneratedVerificationPdf("PAN");
    }

    // 4. Final Database Sync
    let nextSelfieDetails = parseJsonField(application.selfieDetails, {});
    const extractedFaceScore = extractFaceScoreFromDigioResponse(digioResponse);
    const extractMediaFromDigio = (response) => {
      const media = { image: null, video: null };
      const isUrl = (value) =>
        typeof value === "string" && /^https?:\/\//i.test(value);
      const isUploadPath = (value) =>
        typeof value === "string" && value.startsWith("/uploads/");
      const isMediaRef = (value) => isUrl(value) || isUploadPath(value);
      const imageKeys = [
        "image",
        "image_url",
        "imageUrl",
        "photo",
        "selfie",
        "selfie_url",
        "selfieUrl",
        "preview",
      ];
      const videoKeys = [
        "video",
        "video_url",
        "videoUrl",
        "recording",
        "recording_url",
        "recordingUrl",
        "video_preview",
        "videoPreview",
      ];

      const scan = (obj) => {
        if (!obj || typeof obj !== "object") return;
        for (const [key, val] of Object.entries(obj)) {
          if (
            !media.image &&
            typeof val === "string" &&
            imageKeys.includes(key) &&
            isMediaRef(val)
          )
            media.image = val;
          if (
            !media.video &&
            typeof val === "string" &&
            videoKeys.includes(key) &&
            isMediaRef(val)
          )
            media.video = val;
          if (val && typeof val === "object") scan(val);
        }
      };

      scan(response);
      return media;
    };
    const selfieActions = Array.isArray(digioResponse.actions)
      ? digioResponse.actions.filter((a) =>
          ["selfie", "liveness"].includes(String(a?.type || "").toLowerCase()),
        )
      : [];
    const isExplicitSelfiePayload =
      payload.type === "SELFIE" || payload.type === "LIVENESS";
    const mediaSource = isExplicitSelfiePayload ? digioResponse : selfieActions;
    const extractedMedia = extractMediaFromDigio(mediaSource);

    // Explicitly attempt to download selfie file if action contains file_id
    let downloadedSelfiePath = null;
    if (selfieActions && selfieActions.length > 0) {
      for (const action of selfieActions) {
        const mediaId = action.file_id || action.execution_request_id;
        if (mediaId && !downloadedSelfiePath) {
          try {
            console.log(
              `[Digio Extraction] Downloading selfie using media_id: ${mediaId}`,
            );
            const response = await digioClient.downloadKycMedia(mediaId);
            const mediaBuffer = response.data;
            if (
              mediaBuffer &&
              (mediaBuffer.byteLength > 0 || mediaBuffer.length > 0)
            ) {
              const publicId = `selfie_${application.applicationId}_${Date.now()}`;
              console.log(`[Digio Extraction] Uploading selfie to Cloudinary...`);
              
              const cloudinaryResult = await uploadBufferToCloudinary(Buffer.from(mediaBuffer), publicId, "jpg");
              downloadedSelfiePath = cloudinaryResult.secure_url;
              
              console.log(
                `[Digio Extraction] Saved downloaded selfie to Cloudinary: ${downloadedSelfiePath}`,
              );
            }
          } catch (err) {
            console.error(
              `[Digio Extraction] Failed to download selfie media_id ${mediaId}:`,
              err.message,
            );
          }
        }
      }
    }

    // Merge extracted documents (one file per PHOTO / AADHAAR / PAN bucket)
    const incomingDocuments = savedDocumentPaths.map((doc) => ({
      type: doc.type,
      label: doc.label || doc.type,
      path: doc.path,
      uploadedAt: new Date().toISOString(),
      requestId,
      source: "DIGILOCKER",
      ...(doc.issued ? { issued: true } : {}),
      ...(doc.generated ? { generated: true } : {}),
    }));

    if (downloadedSelfiePath) {
      incomingDocuments.push({
        type: "PHOTO",
        label: "selfie_downloaded",
        path: downloadedSelfiePath,
        uploadedAt: new Date().toISOString(),
        requestId,
        source: "DIGILOCKER",
      });
    }

    const newDocuments = dedupeApplicationDocuments([
      ...previousDocuments,
      ...incomingDocuments,
    ]);

    const selfieDocPath =
      savedDocumentPaths.find((doc) => doc.type === "PHOTO")?.path ||
      downloadedSelfiePath ||
      null;
    const isSelfieDataPresent =
      isExplicitSelfiePayload || selfieActions.length > 0;
    const liveSelfieDoc =
      savedDocumentPaths.find(
        (doc) =>
          doc.type === "PHOTO" &&
          (String(doc.label).toLowerCase().includes("file_base64") ||
            String(doc.label).toLowerCase().includes("selfie") ||
            isExplicitSelfiePayload),
      ) || (downloadedSelfiePath ? { path: downloadedSelfiePath } : null);

    const safeSelfieDocPath = liveSelfieDoc ? liveSelfieDoc.path : null;
    const hasSelfieData =
      isSelfieDataPresent &&
      (safeSelfieDocPath ||
        extractedMedia.image ||
        extractedMedia.video ||
        extractedFaceScore !== null);

    const findGeoVal = (obj, keys) => {
      if (!obj || typeof obj !== "object") return undefined;
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null) return obj[k];
      }
      for (const v of Object.values(obj)) {
        const res = findGeoVal(v, keys);
        if (res !== undefined && res !== null) return res;
      }
      return undefined;
    };
    const geoLat = findGeoVal(digioResponse, ["latitude", "lat"]);
    const geoLng = findGeoVal(digioResponse, ["longitude", "lng", "lon"]);
    const geoAddress = findGeoVal(digioResponse, ["address", "location_address"]);

    if (hasSelfieData) {
      nextSelfieDetails = {
        ...nextSelfieDetails,
        preview:
          safeSelfieDocPath ||
          extractedMedia.image ||
          nextSelfieDetails.preview ||
          null,
        ...(extractedMedia.video ? { videoPath: extractedMedia.video } : {}),
        extractedAt: new Date().toISOString(),
        requestId,
        ...(extractedFaceScore !== null
          ? { matchScore: extractedFaceScore }
          : {}),
      };

      if (geoLat || geoLng) {
        nextSelfieDetails.geo = {
          ...(nextSelfieDetails.geo || {}),
          address: geoAddress || nextSelfieDetails.geo?.address || null,
          latitude: geoLat || nextSelfieDetails.geo?.latitude || null,
          longitude: geoLng || nextSelfieDetails.geo?.longitude || null,
          provider: "digio"
        };
        nextSelfieDetails.lat = geoLat;
        nextSelfieDetails.lng = geoLng;
        nextSelfieDetails.latitude = geoLat;
        nextSelfieDetails.longitude = geoLng;
      }
    } else if (extractedFaceScore !== null) {
      nextSelfieDetails.matchScore = extractedFaceScore;
    }

    if (globalExtractedSelfieUrl) {
       nextSelfieDetails.preview = globalExtractedSelfieUrl;
       if (globalExtractedFaceScore) nextSelfieDetails.matchScore = globalExtractedFaceScore;
    }

    await prisma.kycApplication.update({
      where: { id: application.id },
      data: serializeJsonFields(
        {
          status: "under_review",
          ocrData: nextOcrData,
          identityDetails: nextIdentityDetails,
          personalDetails: nextPersonalDetails,
          address: nextAddress,
          documents: newDocuments,
          selfieDetails: nextSelfieDetails,
          ...(hasSelfieData
            ? {
                ...(safeSelfieDocPath || extractedMedia.image
                  ? { selfie: safeSelfieDocPath || extractedMedia.image }
                  : {}),
                ...(extractedFaceScore !== null
                  ? { faceMatchScore: extractedFaceScore }
                  : {}),
              }
            : extractedFaceScore !== null
              ? { faceMatchScore: extractedFaceScore }
              : {}),
          currentStep: Math.max(application.currentStep, STEP_BY_REQUEST_TYPE[payload.type] || 4),
        },
        [
          "ocrData",
          "identityDetails",
          "personalDetails",
          "address",
          "documents",
          "selfieDetails",
        ],
      ),
    });

      // Notify clients of real-time update
      if (req.app && req.app.get("io")) { req.app.get("io").to(application?.applicationId || req.body?.applicationId || req.params?.applicationId || req.query?.applicationId).emit("kyc_updated"); }

    await writeAuditLog({
      userId: req.user.id,
      action: "digio_response_fetched",
      details: {
        applicationId: application.applicationId,
        requestId,
        status: digioResponse.status,
        type: payload.type,
        extractedFields: {
          aadhaar: !!nextIdentityDetails.aadhaar,
          pan: !!nextIdentityDetails.pan,
          name: !!nextPersonalDetails.fullName,
        },
      },
      ipAddress: req.ip,
    });

    // Notify connected clients (e.g. desktop UI waiting for mobile selfie)
    req.app.get("io")?.to(application.applicationId).emit("kyc_updated");

    // START ASYNC BACKGROUND UPLOAD
    (async () => {
      try {
        const appToUpdate = await prisma.kycApplication.findUnique({
          where: { applicationId: application.applicationId }
        });
        if (!appToUpdate) return;
        
        let docsUpdated = false;
        const currentDocs = parseJsonField(appToUpdate.documents, []);
        
        for (let i = 0; i < currentDocs.length; i++) {
          const doc = currentDocs[i];
          if (doc.path && doc.path.startsWith('/uploads/')) {
            const localPath = path.join(__dirname, "../..", doc.path);
            if (fs.existsSync(localPath)) {
              console.log(`[Background] Uploading ${doc.label || 'document'} to Cloudinary...`);
              const fileBuffer = fs.readFileSync(localPath);
              const ext = doc.path.split('.').pop()?.toLowerCase();
              const publicId = doc.path.split('/').pop().replace(`.${ext}`, '');
              
              try {
                const cloudinaryResult = await uploadBufferToCloudinary(fileBuffer, publicId, ext === 'pdf' ? 'pdf' : undefined);
                currentDocs[i].path = cloudinaryResult.secure_url;
                docsUpdated = true;
                try { fs.unlinkSync(localPath); } catch (e) {} // Cleanup local file
              } catch (upErr) {
                console.error(`[Background] Failed to upload ${doc.path}:`, upErr.message);
              }
            }
          }
        }
        
        if (docsUpdated) {
          await prisma.kycApplication.update({
            where: { applicationId: application.applicationId },
            data: { documents: JSON.stringify(currentDocs) }
          });
          console.log(`[Background] Successfully moved local documents to Cloudinary for ${application.applicationId}`);
        }
      } catch (err) {
        console.error(`[Background] Background upload process failed:`, err);
      }
    })();


    return res.json({
      success: true,
      applicationId: application.applicationId,
      requestId,
      updates: {
        identityDetails: nextIdentityDetails,
        personalDetails: nextPersonalDetails,
        address: nextAddress,
        selfieDetails: nextSelfieDetails,
      },
      response: digioResponse,
    });
  } catch (error) {
    const digioError = error.response?.data;
    console.error("Digio Response Fetch Error:", digioError || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: digioError?.message || "Failed to fetch Digio response",
      details: digioError?.details,
      code: digioError?.code,
    });
  }
});

router.post("/verify-bank", auth, async (req, res) => {
  const { accountNumber, ifsc, beneficiaryName, accountType, applicationId } =
    req.body || {};

  if (!accountNumber || !ifsc) {
    return res
      .status(400)
      .json({ success: false, error: "Account number and IFSC are required" });
  }

  try {
    const application = await getOrCreateDraftApplication({
      userId: req.user.id,
      applicationId,
    });

    if (!application) {
      return res
        .status(404)
        .json({ success: false, error: "Application not found" });
    }

    const personalDetails = parseJsonField(application.personalDetails, {});
    const bankDetails = parseJsonField(application.bankDetails, {});

    const result = await bankService.verifyAccount(
      accountNumber,
      ifsc,
      beneficiaryName || personalDetails.fullName,
    );

    // Cross-check account type if provided by user and API
    if (accountType && (result.account_type || result.accountType || result.bank_account_type)) {
      const apiType = String(result.account_type || result.accountType || result.bank_account_type).toLowerCase();
      const userType = String(accountType).toLowerCase();
      
      if (apiType.includes('saving') && userType.includes('current')) {
        return res.json({ success: false, error: `Account type mismatch. You selected Current Account but this is a Savings Account.` });
      }
      if (apiType.includes('current') && userType.includes('saving')) {
        return res.json({ success: false, error: `Account type mismatch. You selected Savings Account but this is a Current Account.` });
      }
    }

    if (result.verified) {
      // Fetch branch details using IFSC to populate address/city
      let branchDetails = {};
      try {
        if (ifsc) {
          const ifscRes = await bankService.verifyIfsc(ifsc);
          branchDetails =
            ifscRes?.data ||
            ifscRes?.result ||
            ifscRes?.details ||
            ifscRes ||
            {};
        }
      } catch (e) {
        console.warn("IFSC lookup failed during bank verification:", e.message);
      }

      const panName = personalDetails.fullName || beneficiaryName || "";
      const bankNameFromDigio = result.beneficiary_name_with_bank || result.beneficiary_name || "";
      const localMatchScore = getStringSimilarity(panName, bankNameFromDigio) * 100;
      const digioMatchScore = parseFloat(result.name_match_score || result.name_match_score_percentage || 0);
      const finalScore = Math.max(localMatchScore, digioMatchScore);
      const isNameMatched = finalScore >= 90;

      // Update application state
      const nextBankDetails = mergeJson(application.bankDetails, {
        accountNumber,
        ifsc,
        bankName:
          result.bank_name ||
          result.bank ||
          branchDetails.bank_name ||
          bankDetails.bankName,
        micr:
          result.micr || branchDetails.micr || bankDetails.micr,
        accountHolderName: bankNameFromDigio,
        verified: isNameMatched,
        verifiedAt: result.verified_at,
        bankRequestId: result.id,
        method: "PENNY_DROP",
        name_match_score: finalScore,
        name_match: isNameMatched,
        address:
          branchDetails.address ||
          branchDetails.bank_address ||
          branchDetails.branch ||
          bankDetails.address,
        city: branchDetails.city || bankDetails.city,
        state: branchDetails.state || bankDetails.state,
        district: branchDetails.district || bankDetails.district,
        pincode:
          branchDetails.pin ||
          branchDetails.pincode ||
          branchDetails.pin_code ||
          bankDetails.pincode,
      });

      await prisma.kycApplication.update({
        where: { id: application.id },
        data: serializeJsonFields(
          {
            bankDetails: nextBankDetails,
            currentStep: Math.max(application.currentStep || 0, 11), // Bank step is 11
          },
          ["bankDetails"],
        ),
      });

      // Notify clients of real-time update
      if (req.app && req.app.get("io")) { req.app.get("io").to(application?.applicationId || req.body?.applicationId || req.params?.applicationId || req.query?.applicationId).emit("kyc_updated"); }

      await writeAuditLog({
        userId: req.user.id,
        action: "bank_verified_directly",
        details: {
          applicationId: application.applicationId,
          status: "success",
        },
        ipAddress: req.ip,
      });
      
      return res.json({
        success: true,
        verified: isNameMatched,
        nameMismatch: !isNameMatched,
        data: result,
      });
    }

    // If penny drop failed completely (e.g., invalid account number or IFSC),
    // we should explicitly block the user and ask them to fix the details.
    return res.json({ 
      success: false, 
      error: "Invalid Bank Account Details. Please check your Account Number and IFSC Code."
    });
  } catch (error) {
    console.error("Bank Verification Route Error:", error.message);
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "Bank verification failed",
      });
  }
});

// Helper for string similarity (Levenshtein Distance)
function getStringSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  
  // Clean strings: lower case and remove common prefixes
  const cleanName = (name) => {
    return name
      .toLowerCase()
      .replace(/^(mr\.?|mrs\.?|ms\.?|miss|dr\.?|shri|smt\.?|kumari)\s+/g, '')
      .replace(/[^a-z0-9 ]/g, '') // optionally remove other special characters just to be safe
      .replace(/\s+/g, ' ')
      .trim();
  };

  s1 = cleanName(s1);
  s2 = cleanName(s2);
  
  if (s1 === s2) return 1.0;
  
  const len1 = s1.length, len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;
  
  let matrix = [];
  for (let i = 0; i <= len1; i++) matrix[i] = [i];
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      let cost = (s1[i - 1] === s2[j - 1]) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  const maxLen = Math.max(len1, len2);
  return (maxLen - matrix[len1][len2]) / maxLen;
}

router.post("/face-match", auth, async (req, res) => {
  try {
    const { applicationId, selfie } = req.body || {};

    if (!selfie) {
      return res.status(400).json({ success: false, error: "Selfie image is required" });
    }

    const application = await getOrCreateDraftApplication({
      userId: req.user.id,
      applicationId,
    });

    if (!application) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    // 1. Prepare Selfie, Perform Liveness Check, and Save to Cloudinary
    let savedSelfiePath = null;
    let cleanSelfie = null;
    if (selfie) {
      cleanSelfie = selfie.replace(/^data:image\/[a-z]+;base64,/, "");
      try {
        const selfieBuffer = Buffer.from(cleanSelfie, "base64");
        
        // -- LIVENESS CHECK START --
        console.log(`[FaceMatch] Performing liveness check for ${application.applicationId}...`);
        const livenessResult = await digioClient.checkPassiveLiveness(selfieBuffer, application.applicationId);
        console.log(`[FaceMatch] Liveness check response:`, JSON.stringify(livenessResult));

        if (livenessResult.count !== 1) {
          return res.status(400).json({ 
            success: false, 
            error: livenessResult.count === 0 ? "No face detected in selfie." : "Multiple faces detected. Please ensure only you are in the frame." 
          });
        }

        if (livenessResult.result === "FAIL" || livenessResult.result === "UNKNOWN") {
           return res.status(400).json({ 
             success: false, 
             error: "Selfie liveness check failed. Spoofing or low quality detected." 
           });
        }
        // -- LIVENESS CHECK END --

        console.log(`[FaceMatch] Uploading selfie to Cloudinary for ${application.applicationId}...`);
        const cloudinaryResult = await uploadBufferToCloudinary(selfieBuffer, `kyc_selfie_${application.applicationId}_${Date.now()}`, "jpg");
        savedSelfiePath = cloudinaryResult.secure_url;
        console.log(`[FaceMatch] Live selfie securely saved to Cloudinary: ${savedSelfiePath}`);
      } catch (saveError) {
        console.error("[FaceMatch] Failed to process selfie (Liveness or Cloudinary):", saveError.message);
        return res.status(500).json({ success: false, error: "Failed to process selfie verification." });
      }
    }

    // 2. Bypass Digio completely, use a high confidence mock score
    const mockScore = 85 + Math.floor(Math.random() * 10);
    
    // 3. Update Database with the mock score and the captured image
    await prisma.kycApplication.update({
      where: { id: application.id },
      data: serializeJsonFields({
        faceMatchScore: mockScore,
        ...(savedSelfiePath ? {
          selfie: savedSelfiePath,
          selfieDetails: {
            ...parseJsonField(application.selfieDetails, {}),
            preview: savedSelfiePath,
            matchScore: mockScore,
            source: "IPV_LIVE_CAPTURE_BYPASS",
            updatedAt: new Date().toISOString(),
          },
        } : {}),
      }, ["selfieDetails"]),
    });

    // --- NEW CLOUDINARY CLEANUP LOGIC ---
    if (savedSelfiePath && application.selfie) {
      try {
        const { deleteCloudinaryFile } = require("../utils/cloudinaryHelper");
        // application.selfie holds the old selfie URL from the DB fetch at the start of this route
        deleteCloudinaryFile(application.selfie);
      } catch (cleanupErr) {
        console.error("[FaceMatch] Cloudinary cleanup failed non-fatally:", cleanupErr.message);
      }
    }
    // ------------------------------------

      // Notify clients of real-time update
      if (req.app && req.app.get("io")) { req.app.get("io").to(application?.applicationId || req.body?.applicationId || req.params?.applicationId || req.query?.applicationId).emit("kyc_updated"); }

    await writeAuditLog({
      userId: req.user.id,
      action: "face_match_performed",
      details: {
        applicationId: application.applicationId,
        score: mockScore,
        status: "success (bypassed)",
        selfieSaved: !!savedSelfiePath,
      },
      ipAddress: req.ip,
    });

    return res.json({ success: true, score: mockScore, selfiePath: savedSelfiePath, isMock: true });
  } catch (error) {
    console.error("[FaceMatch] Route Error:", error.message);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
});

router.post("/verify-ifsc", auth, async (req, res) => {
  const { ifscCode } = req.body || {};
  if (!ifscCode)
    return res
      .status(400)
      .json({ success: false, error: "IFSC code is required" });

  try {
    const result = await bankService.verifyIfsc(ifscCode);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.warn("[IFSC] Digio check failed, trying fallback:", error.message);
    // Fallback to public ifsc api for better UX if Digio fails
    try {
      const fbResponse = await fetch(`https://ifsc.razorpay.com/${ifscCode}`);
      if (fbResponse.ok) {
        const data = await fbResponse.json();
        return res.json({
          success: true,
          data: {
            bank: data.BANK,
            branch: data.BRANCH,
            city: data.CITY,
            state: data.STATE,
            micr: data.MICR,
          },
        });
      }
    } catch (f) {
      console.error("[IFSC] Fallback also failed");
    }

    return res
      .status(500)
      .json({ success: false, error: "Failed to verify IFSC" });
  }
});

router.post("/webhook", async (req, res) => {
  const { event, payload } = req.body || {};
  console.log(`[Digio Webhook] Event: ${event || "unknown"}`);

  await writeAuditLog({
    userId: null,
    action: "digio_webhook_received",
    details: { event, payload },
    ipAddress: req.ip,
  });

  res.sendStatus(200);
});

async function ensureDigilockerVerificationDocuments(application) {
  if (!application?.id) return application;

  const identityDetails = parseJsonField(application.identityDetails, {});
  const personalDetails = parseJsonField(application.personalDetails, {});
  const address = parseJsonField(application.address, {});
  const ocrData = parseJsonField(application.ocrData, {});
  let documents = parseJsonField(application.documents, []);
  const identitySnapshot = JSON.stringify(identityDetails);

  const uploadsDir = path.join(__dirname, "../../uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const digioBucket = ocrData?.digio?.DIGILOCKER || {};
  const requestId = digioBucket.requestId;
  const executionRequestId =
    findDigilockerExecutionRequestId(digioBucket) ||
    findDigilockerExecutionRequestId({ actions: digioBucket.actions });

  const digilockerActions = Array.isArray(digioBucket.actions)
    ? digioBucket.actions
    : [];
  for (const action of digilockerActions) {
    if (action?.details?.aadhaar?.id_number && !identityDetails.aadhaar) {
      identityDetails.aadhaar = String(action.details.aadhaar.id_number).trim();
    }
    if (action?.details?.pan?.id_number && !identityDetails.pan) {
      identityDetails.pan = String(action.details.pan.id_number)
        .trim()
        .toUpperCase();
    }
  }

  const savedPaths = [];
  const addSavedDocument = (document) => {
    if (!document?.path) return;
    if (documents.some((doc) => doc.path === document.path)) return;
    savedPaths.push(document);
    documents.push({
      type: document.type,
      label: document.label || document.type,
      path: document.path,
      uploadedAt: new Date().toISOString(),
      requestId: requestId || null,
      source: "DIGILOCKER",
      ...(document.issued ? { issued: true } : {}),
      ...(document.generated ? { generated: true } : {}),
    });
  };

  if (executionRequestId && requestId) {
    const missingAadhaar = !hasDocumentBucket(documents, "AADHAAR");
    const missingPan = !hasDocumentBucket(documents, "PAN");
    if (missingAadhaar || missingPan) {
      await downloadDigilockerIssuedDocuments({
        executionRequestId,
        requestId,
        uploadsDir,
        addSavedDocument,
        existingDocuments: documents,
      });
    }
  }

  const originalDocuments = parseJsonField(application.documents, []);
  documents = dedupeApplicationDocuments(documents);

  const needsAadhaarPdf =
    identityDetails.aadhaar && !hasDocumentBucket(documents, "AADHAAR");
  const needsPanPdf =
    identityDetails.pan && !hasDocumentBucket(documents, "PAN");
  const identityPatched = JSON.stringify(identityDetails) !== identitySnapshot;
  const documentsNeedCleanup =
    JSON.stringify(documents) !== JSON.stringify(originalDocuments);

  const aadhaarPhotoPath =
    documents.find((doc) => {
      const docPath = String(doc?.path || "").toLowerCase();
      return doc?.type === "PHOTO" || /\.(png|jpe?g|webp)$/i.test(docPath);
    })?.path || null;

  if (needsAadhaarPdf) {
    const filename = `digilocker_aadhaar_${application.applicationId || application.id}_${Date.now()}.pdf`;
    const filePath = path.join(uploadsDir, filename);
    await createDigilockerAadhaarPdf({
      filePath,
      identityDetails,
      personalDetails,
      address,
      photoPath: aadhaarPhotoPath,
    });
    addSavedDocument({
      type: "AADHAAR",
      label: "DigiLocker AADHAAR Verification PDF",
      path: `/uploads/${filename}`,
      generated: true,
    });
  }

  if (needsPanPdf) {
    const filename = `digilocker_pan_${application.applicationId || application.id}_${Date.now()}.pdf`;
    const filePath = path.join(uploadsDir, filename);
    await createDigilockerPanPdf({
      filePath,
      identityDetails,
      personalDetails,
    });
    addSavedDocument({
      type: "PAN",
      label: "DigiLocker PAN Verification PDF",
      path: `/uploads/${filename}`,
      generated: true,
    });
  }

  documents = dedupeApplicationDocuments(documents);

  const updatePayload = {};
  if (
    documentsNeedCleanup ||
    savedPaths.length > 0 ||
    needsAadhaarPdf ||
    needsPanPdf
  ) {
    updatePayload.documents = documents;
  }
  if (identityPatched) {
    updatePayload.identityDetails = identityDetails;
  }

  if (!Object.keys(updatePayload).length) return application;

  const updated = await prisma.kycApplication.update({
    where: { id: application.id },
    data: serializeJsonFields(updatePayload, ["documents", "identityDetails"]),
  });

  return updated;
}

router.post("/mask-aadhaar", auth, async (req, res) => {
  const {
    data,
    data_content_type = "PNG",
    file_name = "aadhaar.png",
    consent = "Y",
  } = req.body;

  if (!data) {
    return res
      .status(400)
      .json({ success: false, error: "Base64 image data is required" });
  }

  try {
    const reference_id = `MASK-${Date.now()}`;
    const unique_request_id = `REQ-${Date.now()}`;

    // Clean base64 prefix if present
    const base64Data = data.includes("base64,")
      ? data.split("base64,")[1]
      : data;

    const payload = {
      reference_id,
      unique_request_id,
      data: base64Data,
      file_name,
      data_content_type,
      is_validate: false,
      consent,
      mask_qr: false,
    };

    console.log(
      `[Digio Route] Masking Aadhaar for User: ${req.user.id}, ReqID: ${unique_request_id}`,
    );
    const response = await digioClient.maskAadhaarImage(payload);

    if (response && response.masked_output) {
      await writeAuditLog({
        userId: req.user.id,
        action: "aadhaar_masked",
        details: { reference_id, unique_request_id, details: response.details },
        ipAddress: req.ip,
      });

      return res.json({
        success: true,
        masked_output: response.masked_output, // Digio returns bare base64
        details: response.details,
      });
    } else {
      throw new Error(
        response.error_message || "Masking failed with no output",
      );
    }
  } catch (error) {
    console.error(
      "[Digio Route] Masking error:",
      error.response?.data || error.message,
    );

    await writeAuditLog({
      userId: req.user.id,
      action: "aadhaar_mask_failed",
      details: { error: error.response?.data || error.message },
      ipAddress: req.ip,
    });

    return res.status(500).json({
      success: false,
      error:
        error.response?.data?.error_message ||
        error.message ||
        "Failed to mask Aadhaar image",
    });
  }
});

module.exports = router;
module.exports.ensureDigilockerVerificationDocuments =
  ensureDigilockerVerificationDocuments;
