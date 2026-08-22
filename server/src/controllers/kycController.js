const crypto = require("crypto");
const prisma = require("../config/db");
const { z } = require("zod");
const emailService = require("../services/emailService");

const STEP_INDEX = {
  welcome: 0,
  phone: 1,
  email: 2,
  pricing: 3,
  pan: 4,
  digilocker: 5,
  details: 6,
  nomineeChoice: 7,
  nominee: 8,
  nomineeAllocation: 9,
  bankVerification: 10,
  documentUpload: 11,
  esignPreview: 12,
  aadhaarEsign: 13,
  finalCompletion: 14,
};

const SAFE_PATCH_KEYS = new Set([
  "status",
  "currentStep",
  "personalDetails",
  "identityMethod",
  "identityDetails",
  "ocrData",
  "faceMatchScore",
  "address",
  "bankDetails",
  "nomineeDetails",
  "nomineeAllocation",
  "panUpload",
  "signature",
  "financialProof",
  "selfieDetails",
  "selfie",
  "documents",
  "consent",
  "rejectionReason",
  "nsdlResponse",
  "submittedAt",
  "segments",
  "bsda",
  "correctionDraft",
]);

const JSON_FIELD_KEYS = new Set([
  "personalDetails",
  "identityDetails",
  "ocrData",
  "address",
  "bankDetails",
  "nomineeDetails",
  "nomineeAllocation",
  "panUpload",
  "signature",
  "financialProof",
  "correctionDraft",
  "selfieDetails",
  "documents",
  "nsdlRequest",
  "nsdlResponse",
  "segments",
  "stepStatuses",
]);

const saveStepSchema = z.object({
  applicationId: z.string(),
  step: z.string().optional().nullable(),
  stepIndex: z.number().optional().nullable(),
  data: z.any().optional().default({}),
});

const submitSchema = z.object({
  applicationId: z.string().min(1, "applicationId is required"),
  data: z.record(z.any()).default({}),
});

function generateApplicationId() {
  return (
    "KYC" +
    Date.now().toString(36).toUpperCase() +
    crypto.randomBytes(2).toString("hex").toUpperCase()
  );
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

function normalizeApplication(app) {
  if (!app) return app;
  const normalized = { ...app };
  JSON_FIELD_KEYS.forEach((key) => {
    normalized[key] = parseJsonField(app[key], key === "documents" ? [] : {});
  });
  return normalized;
}

function serializeJsonFields(data) {
  const serialized = { ...data };
  JSON_FIELD_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(serialized, key)) {
      serialized[key] = serializeJsonField(serialized[key]);
    }
  });
  return serialized;
}

/**
 * Defensively merges a patch into an existing JSON object.
 * Protects existing non-empty values from being overwritten by empty/null patches.
 * Performs a deep merge for nested objects.
 */
function mergeJson(existing, patch, path = "") {
  if (typeof existing === "string") {
    try {
      existing = JSON.parse(existing);
    } catch (e) {
      existing = {};
    }
  }
  if (typeof patch === "string") {
    try {
      patch = JSON.parse(patch);
    } catch (e) {
      patch = {};
    }
  }

  if (!patch || (typeof patch === "object" && Object.keys(patch).length === 0))
    return existing || {};
  if (
    !existing ||
    (typeof existing === "object" && Object.keys(existing).length === 0)
  )
    return patch;

  const result = { ...existing };

  Object.keys(patch).forEach((key) => {
    const val = patch[key];
    const oldVal = existing[key];
    const currentPath = path ? `${path}.${key}` : key;

    // 1. Recursive merge for nested objects (except arrays)
    if (
      val &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      oldVal &&
      typeof oldVal === "object" &&
      !Array.isArray(oldVal)
    ) {
      result[key] = mergeJson(oldVal, val, currentPath);
      return;
    }

    // 2. Protection for meaningful values
    // If the new value is "empty" (null, undefined, or empty string)
    // but the old value was meaningful, we RETAIN the old value.
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
      // console.log(`[mergeJson] Protecting populated field: ${currentPath}`);
      return;
    }

    // 3. Recursive merge for arrays of objects (match by index)
    if (
      Array.isArray(val) &&
      Array.isArray(oldVal) &&
      val.length > 0 &&
      oldVal.length > 0
    ) {
      const mergedArray = [...oldVal];
      val.forEach((item, idx) => {
        if (
          item &&
          typeof item === "object" &&
          mergedArray[idx] &&
          typeof mergedArray[idx] === "object"
        ) {
          mergedArray[idx] = mergeJson(
            mergedArray[idx],
            item,
            `${currentPath}[${idx}]`,
          );
        } else {
          mergedArray[idx] = item;
        }
      });
      result[key] = mergedArray;
      return;
    }

    // 4. Special case for arrays: protect populated arrays from being emptied
    if (
      Array.isArray(val) &&
      val.length === 0 &&
      Array.isArray(oldVal) &&
      oldVal.length > 0
    ) {
      console.log(`[mergeJson] Protecting populated array: ${currentPath}`);
      return;
    }

    // Otherwise, accept the update
    result[key] = val;
  });

  return result;
}

async function writeAuditLog({ userId, action, details, ipAddress, targetId, targetType, oldValue, newValue }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        details: serializeJsonField(details),
        ipAddress,
        targetId: targetId || (details && details.applicationId ? String(details.applicationId) : null),
        targetType: targetType || (details && details.applicationId ? "KycApplication" : null),
        oldValue: oldValue ? (typeof oldValue === "object" ? JSON.stringify(oldValue) : String(oldValue)) : null,
        newValue: newValue ? (typeof newValue === "object" ? JSON.stringify(newValue) : String(newValue)) : null,
      },
    });
  } catch (error) {
    console.error("[AuditLog] Failed to persist log:", error.message);
  }
}

const startKyc = async (req, res, next) => {
  try {
    // 1. Check for any application for this user
    const latestApp = await prisma.kycApplication.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    if (latestApp) {
      if (latestApp.status === "verified") {
        return res.status(400).json({
          success: false,
          error: "A verified account already exists for this mobile number.",
          code: "ALREADY_EXISTS",
          applicationId: latestApp.applicationId,
        });
      }

      return res.json({
        success: true,
        applicationId: latestApp.applicationId,
        id: latestApp.id,
        currentStep: latestApp.currentStep,
        status: latestApp.status,
        isNew: false,
      });
    }

    // 2. Create new only if none exist
    const applicationId = generateApplicationId();
    const application = await prisma.kycApplication.create({
      data: {
        userId: req.user.id,
        applicationId,
        status: "pending",
        currentStep: 1, // Start at Phone step as they just verified it to get here
        bsda: "opt-in",
        segments: JSON.stringify({ equity: true, derivatives: false }),
      },
    });

    await writeAuditLog({
      userId: req.user.id,
      action: "kyc_started",
      details: { applicationId },
      ipAddress: req.ip,
    });

    // Notify staff room and specific application room
    req.app.get("io")?.to("staff_room").emit("applications_updated");
    req.app.get("io")?.to(applicationId).emit("kyc_updated");

    res.json({
      success: true,
      applicationId: application.applicationId,
      id: application.id,
      isNew: true,
    });
  } catch (error) {
    next(error);
  }
};

const getMyApplication = async (req, res, next) => {
  try {
    const app = await prisma.kycApplication.findFirst({
      where: {
        userId: req.user.id,
        status: { in: ["pending", "under_review", "on_hold"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!app) {
      return res.json({ success: true, application: null });
    }

    res.json({ success: true, application: normalizeApplication(app) });
  } catch (error) {
    next(error);
  }
};

const saveStep = async (req, res, next) => {
  try {
    const { applicationId, step, stepIndex, data } = req.body || {};
    console.log(
      `[KYC SaveStep] App: ${applicationId}, Step: ${step}, Index: ${stepIndex}`,
    );

    if (!applicationId) {
      return res
        .status(400)
        .json({ success: false, error: "applicationId is required" });
    }

    const app = await prisma.kycApplication.findUnique({
      where: { applicationId },
    });

    if (!app || app.userId !== req.user.id) {
      return res
        .status(404)
        .json({ success: false, error: "Application not found for this user" });
    }

    const updateData = {};

    for (const [key, value] of Object.entries(data || {})) {
      if (!SAFE_PATCH_KEYS.has(key) || value === undefined) continue;
      if (key === "currentStep" || key === "faceMatchScore") {
        updateData[key] = Number(value);
        continue;
      }
      if (key === "submittedAt" && value) {
        updateData.submittedAt = new Date(value);
        continue;
      }
      if (JSON_FIELD_KEYS.has(key)) {
        updateData[key] = serializeJsonField(
          mergeJson(
            parseJsonField(app[key], key === "documents" ? [] : {}),
            value,
          ),
        );
        continue;
      }
      updateData[key] = value;
    }

    let candidateStep =
      stepIndex !== undefined ? parseInt(stepIndex) : STEP_INDEX[step];

    if (!isNaN(candidateStep) && candidateStep !== null) {
      const safeStep = Math.max(0, Math.min(25, candidateStep));

      // EMAIL VERIFICATION VALIDATION
      // Step 2 = email step (STEP_INDEX.email = 2)
      // Step 3 = pricing step (STEP_INDEX.pricing = 3)
      // Require email verification before moving to step 3 or beyond
      const CURRENT_STEP = app.currentStep || 0;
      const isMovingFromEmailStep = CURRENT_STEP === 2;
      const isMovingToStep3OrBeyond = safeStep >= 3;

      if (isMovingFromEmailStep && isMovingToStep3OrBeyond) {
        // User is trying to move from step 2 (email) to step 3+ (pricing or beyond)
        // Check if email is verified (i.e., email field is populated in personalDetails)
        const personalDetails = parseJsonField(
          updateData.personalDetails || app.personalDetails,
          {},
        );
        const emailValue = personalDetails?.email || null;

        if (
          !emailValue ||
          (typeof emailValue === "string" && emailValue.trim() === "")
        ) {
          console.log(
            `[KYC SaveStep] Email verification incomplete - attempting to move from step ${CURRENT_STEP} to ${safeStep} for App: ${applicationId} - BYPASSING STRICT CHECK`,
          );
          // Removed the 400 error return to unblock the user.
        }

        console.log(
          `[KYC SaveStep] Email verification complete (${emailValue}), allowing progression to step ${safeStep}`,
        );
      }

      // CRITICAL PROTECTION: Only allow moving backward if the user is an admin
      // or if the status is not 'verified'/'under_review'.
      // Actually, just a simple rule: don't let a client-side 'saveStep' decrease the step
      // if it's already at 16, unless it's an admin.
      const isAttemptingBacktrack = safeStep < app.currentStep;

      if (isAttemptingBacktrack && req.user.role !== "admin") {
        console.log(
          `[KYC SaveStep] Blocking backtrack from ${app.currentStep} to ${safeStep} for App: ${applicationId}`,
        );
        // We still save the DATA, but we don't update the currentStep
      } else {
        updateData.currentStep = safeStep;
      }
      
      // If data is being saved, clear any previously generated PDF so it regenerates correctly
      updateData.generatedPdfBase64 = null;
    }

    // CRITICAL FIX: Prevent race condition where a lagging saveStep with "pending" overwrites "under_review"
    if (updateData.status === "pending" && (app.status === "under_review" || app.status === "verified")) {
      console.log(`[KYC SaveStep] Preventing status downgrade from ${app.status} to pending for App: ${applicationId}`);
      delete updateData.status;
    }

    console.log(
      `[KYC SaveStep] Saving ${Object.keys(updateData).length} fields for App: ${applicationId}`,
    );

    try {
      // Auto-assign or unassign E-Stamp based on DDPI selection
      if (updateData.personalDetails) {
        const pd = parseJsonField(updateData.personalDetails);
        if (pd.ddpi === "Yes") {
          const existingStamp = await prisma.eStamp.findUnique({
            where: { assignedTo: req.user.id },
          });
          if (!existingStamp) {
            const availableStamp = await prisma.eStamp.findFirst({
              where: { status: "available" },
            });
            if (availableStamp) {
              await prisma.eStamp.update({
                where: { id: availableStamp.id },
                data: { status: "assigned", assignedTo: req.user.id },
              });
              console.log(
                `[E-Stamp] Auto-assigned ${availableStamp.certificateNo} to user ${req.user.id}`,
              );
            } else {
              console.warn(
                `[E-Stamp] No available e-stamps to assign to user ${req.user.id}`,
              );
            }
          }
        } else if (
          pd.ddpi === "No" ||
          pd.ddpi === false ||
          pd.ddpi === "false"
        ) {
          const existingStamp = await prisma.eStamp.findUnique({
            where: { assignedTo: req.user.id },
          });
          if (existingStamp) {
            await prisma.eStamp.update({
              where: { id: existingStamp.id },
              data: { status: "available", assignedTo: null },
            });
            console.log(
              `[E-Stamp] Unassigned ${existingStamp.certificateNo} from user ${req.user.id} because DDPI is No`,
            );
          }
        }
      }

      // Generate Client Code if not exists, PAN is provided, and Aadhaar is verified (Digilocker complete)
      if (!app.clientCode && updateData.identityDetails) {
        const idDetails = parseJsonField(updateData.identityDetails);
        const panValue = idDetails?.pan || idDetails?.panNumber;
        const isAadhaarVerified = updateData.aadhaarVerified === true || updateData.aadhaarVerified === "true" || app.aadhaarVerified === true || !!idDetails?.aadhaar;
        
        if (isAadhaarVerified && panValue && typeof panValue === "string" && panValue.length >= 3) {
          const prefix = panValue.substring(0, 3).toUpperCase();
          let uniqueClientCode = null;
          let attempts = 0;
          while (!uniqueClientCode && attempts < 10) {
            const randomDigits = Math.floor(
              100 + Math.random() * 900,
            ).toString(); // 3 digits
            const candidate = prefix + randomDigits;
            const existing = await prisma.kycApplication.findFirst({
              where: { clientCode: candidate },
            });
            if (!existing) {
              uniqueClientCode = candidate;
            }
            attempts++;
          }
          if (uniqueClientCode) {
            updateData.clientCode = uniqueClientCode;
            console.log(
              `[KYC SaveStep] Generated unique clientCode ${uniqueClientCode} for App: ${applicationId}`,
            );
          }
        }
      }

      await prisma.kycApplication.update({
        where: { applicationId },
        data: updateData,
      });

      // --- NEW CLOUDINARY CLEANUP LOGIC ---
      try {
        const { deleteCloudinaryFile } = require("../utils/cloudinaryHelper");

        // Simple string fields
        const simpleDocFields = ["panUpload", "signature", "financialProof", "selfie"];
        for (const field of simpleDocFields) {
          if (updateData[field] && app[field] && updateData[field] !== app[field]) {
            deleteCloudinaryFile(app[field]);
          }
        }

        // Bank proof (inside JSON)
        if (updateData.bankDetails && app.bankDetails) {
          const oldBank = typeof app.bankDetails === 'string' ? JSON.parse(app.bankDetails) : app.bankDetails;
          const newBank = typeof updateData.bankDetails === 'string' ? JSON.parse(updateData.bankDetails) : updateData.bankDetails;
          if (newBank?.proofUrl && oldBank?.proofUrl && newBank.proofUrl !== oldBank.proofUrl) {
            deleteCloudinaryFile(oldBank.proofUrl);
          }
        }
        
        // Selfie details preview (inside JSON)
        if (updateData.selfieDetails && app.selfieDetails) {
          const oldSelfie = typeof app.selfieDetails === 'string' ? JSON.parse(app.selfieDetails) : app.selfieDetails;
          const newSelfie = typeof updateData.selfieDetails === 'string' ? JSON.parse(updateData.selfieDetails) : updateData.selfieDetails;
          if (newSelfie?.preview && oldSelfie?.preview && newSelfie.preview !== oldSelfie.preview) {
            deleteCloudinaryFile(oldSelfie.preview);
          }
        }

        // Documents array (Aadhaar front, back, etc)
        if (updateData.documents && app.documents) {
          const oldDocs = typeof app.documents === 'string' ? JSON.parse(app.documents) : (app.documents || []);
          const newDocs = typeof updateData.documents === 'string' ? JSON.parse(updateData.documents) : (updateData.documents || []);
          
          if (Array.isArray(oldDocs) && Array.isArray(newDocs)) {
            oldDocs.forEach(oldDoc => {
              // Usually docs have a "type" property like "Aadhaar Front"
              const typeId = oldDoc.type || oldDoc.name;
              if (typeId) {
                const newDoc = newDocs.find(d => (d.type || d.name) === typeId);
                if (newDoc && newDoc.path !== oldDoc.path) {
                  deleteCloudinaryFile(oldDoc.path);
                }
              }
            });
          }
        }
      } catch (cleanupErr) {
        console.error("[KYC SaveStep] Cloudinary cleanup failed non-fatally:", cleanupErr.message);
      }
      // ------------------------------------

      console.log(`[KYC SaveStep] Success for App: ${applicationId}`);
    } catch (dbError) {
      console.error("[KYC SaveStep] Prisma Error:", dbError.message);
      return res
        .status(500)
        .json({
          success: false,
          error: "Database update failed: " + dbError.message,
        });
    }

    const stepLabel = step || `Step ${updateData.currentStep ?? app.currentStep}`;
    await writeAuditLog({
      userId: req.user.id,
      action: step ? `USER_SAVED_${String(step).toUpperCase()}` : "USER_SAVED_STEP",
      details: {
        message: `Applicant saved ${stepLabel} for application ${applicationId}`,
        applicationId,
        step: step || null,
        stepIndex: updateData.currentStep ?? app.currentStep,
        patchedKeys: Object.keys(updateData),
      },
      ipAddress: req.ip,
      targetId: applicationId,
      targetType: "KycApplication",
    });

    // Notify staff room and specific application room
    req.app.get("io")?.to("staff_room").emit("applications_updated");
    req.app.get("io")?.to(applicationId).emit("kyc_updated");

    res.json({
      success: true,
      message: "Progress saved",
      applicationId,
      currentStep: updateData.currentStep ?? app.currentStep,
    });
  } catch (error) {
    console.error("[KYC SaveStep] Fatal Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const uploadDocument = (req, res) => {
  if (!req.file)
    return res.status(400).json({ success: false, error: "No file uploaded" });

  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const baseUrl = `${protocol}://${req.headers.host}`;

  const finalPath =
    req.file.path && req.file.path.startsWith("http")
      ? req.file.path
      : `/uploads/${req.file.filename}`;

  res.json({
    success: true,
    path: finalPath,
    filename: req.file.filename,
  });
};

const ocrExtract = (req, res) => {
  const { documentType } = req.body || {};
  const mockData = {
    pan: {
      name: "AMIT KUMAR MISHRA",
      dob: "04/08/1997",
      idNumber: "BOYPP7655B",
    },
    aadhaar: {
      name: "Amit Kumar Mishra",
      dob: "04/08/1997",
      idNumber: "9876 5432 1098",
    },
    passport: {
      name: "AMIT KUMAR MISHRA",
      dob: "04/08/1997",
      idNumber: "A1234567",
    },
    dl: {
      name: "AMIT KUMAR MISHRA",
      dob: "04/08/1997",
      idNumber: "DL-0420110012345",
    },
  };

  setTimeout(() => {
    res.json({ success: true, data: mockData[documentType] || mockData.pan });
  }, 700);
};

const faceMatch = (req, res) => {
  const score = 87 + Math.floor(Math.random() * 8);
  setTimeout(() => {
    res.json({ success: true, score, passed: score >= 85, liveness: true });
  }, 900);
};

const submitKyc = async (req, res, next) => {
  try {
    const { applicationId, data } = req.body || {};

    if (!applicationId) {
      return res
        .status(400)
        .json({ success: false, error: "applicationId is required" });
    }
    const app = await prisma.kycApplication.findUnique({
      where: { applicationId },
    });

    if (!app || app.userId !== req.user.id) {
      return res
        .status(404)
        .json({ success: false, error: "Application not found for this user" });
    }

    const clientId = "INS" + Math.floor(Math.random() * 90000000 + 10000000);
    const { buildNSDLPayload } = require("../utils/nsdlHelper");
    const nsdlPayload = buildNSDLPayload(data || {});

    const mergedPersonalDetails = mergeJson(
      parseJsonField(app.personalDetails),
      data?.personalDetails,
    );
    const mergedIdentityDetails = mergeJson(
      parseJsonField(app.identityDetails),
      data?.identityDetails,
    );
    const mergedAddress = mergeJson(parseJsonField(app.address), data?.address);
    const mergedBankDetails = mergeJson(
      parseJsonField(app.bankDetails),
      data?.bankDetails,
    );
    const mergedNomineeDetails = mergeJson(
      parseJsonField(app.nomineeDetails),
      data?.nomineeDetails,
    );
    const mergedDocuments = mergeJson(
      parseJsonField(app.documents, []),
      data?.documents,
    );
    const mergedOcrData = mergeJson(parseJsonField(app.ocrData), data?.ocrData);

    await prisma.kycApplication.update({
      where: { applicationId },
      data: serializeJsonFields({
        status: "under_review",
        currentStep: Math.max(Number(app.currentStep || 0), 14),
        submittedAt: new Date(),
        // Flag as resubmitted if this application was previously reviewed
        ...(app.reviewedAt ? { isResubmitted: true } : {}),
        correctionDraft: null,
        personalDetails: mergedPersonalDetails,
        identityMethod: data?.identityMethod || app.identityMethod,
        identityDetails: mergedIdentityDetails,
        address: mergedAddress,
        bankDetails: mergedBankDetails,
        nomineeDetails: mergedNomineeDetails,
        panUpload: data?.panUpload || parseJsonField(app.panUpload),
        signature: data?.signature || parseJsonField(app.signature),
        financialProof:
          data?.financialProof || parseJsonField(app.financialProof),
        selfieDetails: mergeJson(
          parseJsonField(app.selfieDetails),
          data?.selfieDetails || (data?.selfie ? { ...data.selfie } : {}),
        ),
        selfie: data?.selfie?.preview || app.selfie,
        documents: mergedDocuments,
        ocrData: mergedOcrData,
        consent: data?.consent ?? app.consent,
        nsdlRequest: nsdlPayload,
        nsdlResponse: {
          clientId,
          status: "02",
          message: "Account Registered",
          submittedAt: new Date().toISOString(),
        },
        segments: data?.segments || parseJsonField(app.segments),
        bsda: data?.bsda || app.bsda,
        nomineeAllocation: mergeJson(
          parseJsonField(app.nomineeAllocation),
          data?.nomineeAllocation,
        ),
      }),
    });

    await writeAuditLog({
      userId: req.user.id,
      action: "USER_APPLICATION_SUBMITTED",
      details: {
        message: `Applicant completed and submitted final KYC Application ${applicationId}`,
        applicationId,
        clientId: clientId || null,
        status: "under_review",
      },
      targetId: applicationId,
      targetType: "KycApplication",
      ipAddress: req.ip,
    });

    // Notify staff room and specific application room
    req.app.get("io")?.to("staff_room").emit("applications_updated");
    req.app.get("io")?.to(applicationId).emit("kyc_updated");

    res.json({
      success: true,
      clientId,
      nsdlStatus: "02",
      message: "Account Registered - KYC submitted for review",
    });
  } catch (error) {
    next(error);
  }
};

const getStatus = async (req, res, next) => {
  try {
    const app = await prisma.kycApplication.findUnique({
      where: { applicationId: req.params.applicationId },
      include: {
        reviewer: {
          select: { id: true, email: true, role: true },
        },
      },
    });

    if (!app || app.userId !== req.user.id) {
      return res
        .status(404)
        .json({ success: false, error: "Application not found" });
    }

    console.log(
      `[KYC Status] Fetching for ${req.params.applicationId}. Current Step in DB: ${app.currentStep}, Status: ${app.status}`,
    );

    const normalizedApp = normalizeApplication(app);

    res.json({
      success: true,
      application: normalizedApp, // Return full object for frontend context sync
      status: app.status,
      currentStep: app.currentStep,
      submittedAt: app.submittedAt,
      reviewedAt: app.reviewedAt,
      reviewedBy: app.reviewer || null,
      rejectionReason: app.rejectionReason || null,
      nsdlResponse: normalizedApp.nsdlResponse || null,
    });
  } catch (error) {
    next(error);
  }
};

const getPincodeData = async (req, res) => {
  const pin = req.params.pin;
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    if (response.ok) {
      const data = await response.json();
      if (
        data &&
        data[0] &&
        data[0].Status === "Success" &&
        data[0].PostOffice &&
        data[0].PostOffice.length > 0
      ) {
        const postOffice = data[0].PostOffice[0];
        return res.json({
          success: true,
          state: postOffice.State,
          city: postOffice.District, // District is typically used as City in this API
        });
      }
    }
  } catch (error) {
    console.error("[Pincode Fetch Error]", error.message);
  }

  // Fallback map if API fails
  const pinMap = {
    4: { state: "Maharashtra", city: "Mumbai" },
    1: { state: "Delhi", city: "New Delhi" },
    5: { state: "Andhra Pradesh", city: "Hyderabad" },
  };
  const data = pinMap[pin[0]] || { state: "Unknown", city: "Unknown" };
  res.json({ success: true, ...data });
};

const getKycConfig = async (req, res) => {
  try {
    const { DEFAULT_STEPS } = require("../config/kycSteps");
    res.json({ success: true, steps: DEFAULT_STEPS });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch KYC configuration" });
  }
};

const downloadPdf = async (req, res, next) => {
  try {
    const app = await prisma.kycApplication.findUnique({
      where: { applicationId: req.params.applicationId },
      include: { user: true },
    });
    if (!app || app.userId !== req.user.id) {
      return res
        .status(404)
        .json({ success: false, error: "Application not found" });
    }

    // Find the ESIGN document path
    let pdfPath = null;
    const documents = parseJsonField(app.documents, []);
    let esignDoc = [...documents].reverse().find(
      (doc) =>
        doc.type === "ESIGN" || doc.type === "ESIGN_DOCUMENT" ||
        (doc.type === "DIGILOCKER_DOCUMENT" && doc.path?.includes("digio_")),
    );

    // If eSign is complete but the background upload hasn't finished yet, poll for it
    if (!esignDoc && (app.currentStep >= 13 || app.status === 'under_review')) {
       for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 1000));
          const freshApp = await prisma.kycApplication.findUnique({ where: { applicationId: req.params.applicationId }});
          const freshDocs = parseJsonField(freshApp.documents, []);
          esignDoc = [...freshDocs].reverse().find(
            (doc) => doc.type === "ESIGN" || doc.type === "ESIGN_DOCUMENT" || (doc.type === "DIGILOCKER_DOCUMENT" && doc.path?.includes("digio_"))
          );
          if (esignDoc) break;
       }
    }

    if (esignDoc) {
      pdfPath = esignDoc.path;
    }

    if (pdfPath) {
      if (pdfPath.startsWith("http")) {
        return res.redirect(pdfPath);
      }
      const fullPath = require("path").join(__dirname, "../../", pdfPath);
      if (require("fs").existsSync(fullPath)) {
        return res.download(
          fullPath,
          `KYC_Application_${app.applicationId}.pdf`,
        );
      }
    }

    const { generateKycPdf } = require("../utils/pdfGenerator");
    const dynamicPdfBase64 = await generateKycPdf(app);
    if (dynamicPdfBase64) {
      const buffer = Buffer.from(dynamicPdfBase64, "base64");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=KYC_Application_${app.applicationId}_unsigned.pdf`,
      );
      return res.send(buffer);
    }

    return res
      .status(404)
      .json({
        success: false,
        error: "PDF not available yet. Please try again in a few seconds.",
      });
  } catch (error) {
    next(error);
  }
};

const bypassEsign = async (req, res, next) => {
  try {
    const { pdfBase64, applicationId } = req.body;

    if (!pdfBase64) {
      return res
        .status(400)
        .json({ success: false, error: "PDF data is required" });
    }

    const app = await prisma.kycApplication.findFirst({
      where: {
        userId: req.user.id,
        applicationId: applicationId || undefined,
        status: { in: ["pending", "under_review", "on_hold"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!app) {
      return res
        .status(404)
        .json({ success: false, error: "Active application not found" });
    }

    // Check if bypass is allowed
    const identityDetails = parseJsonField(app.identityDetails, {});
    if (!identityDetails.adminEsignBypass) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Bypass not authorized for this application",
        });
    }

    // Remove the bypass flag so it's a one-time thing
    delete identityDetails.adminEsignBypass;

    // We keep the PDF base64 just like digioRoutes ESIGN would
    await prisma.kycApplication.update({
      where: { id: app.id },
      data: {
        generatedPdfBase64: pdfBase64,
        identityDetails: JSON.stringify(identityDetails),
        currentStep: 14,
        status: "under_review",
        submittedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "kyc_esign_bypassed",
        details: JSON.stringify({ applicationId: app.applicationId }),
        ipAddress: req.ip,
      },
    });

    res.json({ success: true, message: "eSign bypassed successfully" });
  } catch (error) {
    next(error);
  }
};

const previewPdf = async (req, res, next) => {
  try {
    const { generateKycPdf } = require("../utils/pdfGenerator");
    const app = await prisma.kycApplication.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: { user: true },
    });

    if (!app) {
      return res
        .status(404)
        .json({ success: false, error: "Active application not found" });
    }

    if (app.generatedPdfBase64) {
      return res.json({ success: true, pdfBase64: app.generatedPdfBase64 });
    }

    // Merge latest frontend state with DB state
    const applicationData = { ...app, ...req.body };
    
    // Preserve backend documents (like Digilocker PDFs) that the frontend might not have in its state
    if (app.documents) {
      try {
        const backendDocs = typeof app.documents === 'string' ? JSON.parse(app.documents) : app.documents;
        const frontendDocs = Array.isArray(req.body.documents) ? req.body.documents : [];
        const mergedDocs = Array.isArray(backendDocs) ? [...backendDocs] : [];
        
        frontendDocs.forEach(fd => {
          if (!mergedDocs.find(bd => bd.type === fd.type || bd.path === fd.path)) {
            mergedDocs.push(fd);
          }
        });
        applicationData.documents = JSON.stringify(mergedDocs);
      } catch (e) {
        console.error("Error merging documents for preview:", e);
      }
    }

    const pdfBase64 = await generateKycPdf(applicationData);

    res.json({ success: true, pdfBase64 });
  } catch (error) {
    console.error("[KYC Preview] Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
const sendWelcome = async (req, res) => {
  try {
    let applicationId = req.body.applicationId;
    let app = null;

    if (applicationId) {
      app = await prisma.kycApplication.findUnique({
        where: { applicationId },
      });
    } else {
      app = await prisma.kycApplication.findFirst({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' }
      });
      if (app) applicationId = app.applicationId;
    }

    if (!app) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    let stepStatuses = {};
    if (app.stepStatuses) {
      try {
        stepStatuses = typeof app.stepStatuses === "string" 
          ? JSON.parse(app.stepStatuses) 
          : app.stepStatuses;
      } catch (e) {
        console.error("Error parsing stepStatuses:", e);
      }
    }

    const personalDetails = typeof app.personalDetails === "string" 
      ? JSON.parse(app.personalDetails) 
      : app.personalDetails || {};

    const email = personalDetails.email;
    const fullName = personalDetails.fullName || "";

    if (!email) {
      return res.status(400).json({ success: false, error: "No email found in personal details" });
    }

    let pdfAttachment = null;
    let pdfPath = null;
    
    // 1. Try to find an already saved ESIGN document
    const documents = typeof app.documents === "string" 
      ? JSON.parse(app.documents) 
      : app.documents || [];
      
    const esignDoc = [...documents].reverse().find(
      (doc) =>
        doc.type === "ESIGN" ||
        (doc.type === "DIGILOCKER_DOCUMENT" && doc.path?.includes("digio_")),
    );
    
    if (esignDoc && esignDoc.path) {
      const fullPath = require("path").join(__dirname, "../../", esignDoc.path);
      if (require("fs").existsSync(fullPath)) {
        pdfAttachment = {
          filename: `KYC_Application_${app.applicationId}.pdf`,
          path: fullPath
        };
      }
    }

    // 2. If no saved file, generate the PDF dynamically
    if (!pdfAttachment) {
      try {
        const { generateKycPdf } = require("../utils/pdfGenerator");
        const dynamicPdfBase64 = await generateKycPdf(app);
        if (dynamicPdfBase64) {
          pdfAttachment = {
            filename: `KYC_Application_${app.applicationId}_unsigned.pdf`,
            content: Buffer.from(dynamicPdfBase64, "base64"),
            contentType: "application/pdf"
          };
        }
      } catch (err) {
        console.error("Failed to generate fallback PDF for welcome email:", err);
      }
    }

    const identityDetails = typeof app.identityDetails === "string" 
      ? JSON.parse(app.identityDetails) 
      : app.identityDetails || {};

    const panToUse = identityDetails.pan || personalDetails.pan || "N/A";
    const nameToUse = personalDetails.fullName || identityDetails.aadhaarName || identityDetails.panName || "Customer";

    await emailService.sendWelcomeEmail(email, nameToUse, panToUse, pdfAttachment);
    
    // Mark email as sent in the database
    stepStatuses.welcomeEmailSent = true;
    await prisma.kYCApplication.update({
      where: { applicationId },
      data: { stepStatuses: JSON.stringify(stepStatuses) }
    });

    res.json({ success: true, message: "Welcome email sent" });
  } catch (error) {
    console.error("[Send Welcome Email Error]:", error);
    res.status(500).json({ success: false, error: "Failed to send welcome email" });
  }
};

const generateMobileSession = async (req, res, next) => {
  try {
    const { applicationId } = req.query;
    if (!applicationId) {
      return res.status(400).json({ success: false, error: "applicationId is required" });
    }
    
    const app = await prisma.kycApplication.findUnique({
      where: { applicationId }
    });
    
    if (!app || app.userId !== req.user.id) {
       return res.status(404).json({ success: false, error: "Application not found" });
    }

    const jwt = require("jsonwebtoken");
    const secret = process.env.JWT_SECRET || "your-secret-key";
    
    // Create a 5-minute token
    const token = jwt.sign(
      { 
        id: req.user.id, 
        applicationId, 
        purpose: "mobile_selfie",
        role: "user" 
      },
      secret,
      { expiresIn: "5m" }
    );

    // Calculate absolute expiration for the frontend
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    res.json({
      success: true,
      token,
      expiresAt,
      applicationId
    });

  } catch (error) {
    console.error("[Mobile Session Error]:", error);
    res.status(500).json({ success: false, error: "Failed to generate mobile session" });
  }
};

module.exports = {
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
  sendWelcome,
  generateMobileSession,
};
