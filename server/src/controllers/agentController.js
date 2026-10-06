const prisma = require("../config/db");
const { z } = require("zod");
const { attachDecisionTimestamps } = require("../utils/decisionTimestamps");
const { annotateRejectedBy } = require("../utils/rejectedBy");
const { isRejectable, NOT_REJECTABLE_ERROR } = require("../utils/rejectionGuard");
// Document rejections a reviewer has marked but not yet mailed are kept on the application (reserved
// keys inside stepStatuses, like welcomeEmailSent) so every reviewer device sees them live. Code reading
// stepStatuses only looks at { status } entries.
const {
  PENDING_DOC_REJECTIONS_KEY,
  PENDING_DOC_LABELS_KEY,
  PENDING_DOC_BY_KEY,
  REJECTION_MAIL_SENT_KEY,
  PENDING_DOC_STATUS_FLIP_KEY,
  getPendingDocRejections,
  hasRejectedSteps: hasRejectedStepEntries,
  rejectionFingerprint,
  getRejectionMailState,
} = require("../utils/rejectionMail");

// Which side made a rejection — shown as a tag in both portals
const reviewerSide = (req) => (req.user?.role === "globe" ? "Globe" : "STK");

// Fetch KYC submissions assigned to the currently logged in agent
const getAssignedApplications = async (req, res, next) => {
  try {
    const agentId = Number(req.user.id);
    const { status = "all", search = "", page = 1, limit = 15, stage = "all", startDate, endDate } = req.query;
    
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(limit, 10) || 15, 1), 200);
    const skip = (pageNum - 1) * take;

    const where = {};
    if (req.user.role === "agent") {
      where.assignedCrmAgentId = agentId;
    }
    
    const normalizedStatus = String(status || "").toLowerCase();
    if (normalizedStatus && normalizedStatus !== "all") {
      if (normalizedStatus === "globe_approved") {
        // Approved on the Globe portal
        where.globeStatus = "approved";
      } else if (normalizedStatus === "globe_rejected") {
        // Rejected on the Globe portal
        where.globeStatus = "rejected";
      } else if (normalizedStatus === "pushed_to_bo") {
        where.pushedToBackoffice = true;
      } else if (normalizedStatus === "completed" || normalizedStatus === "not_pushed_to_bo") {
        where.status = "verified";
        where.globeStatus = "approved";
        where.pushedToBackoffice = false;
      } else if (normalizedStatus === "verify") {
        // eSign done and not yet pushed to back office — stays here even after STK/Globe are verified.
        // Rejected / on-hold applications have their own filters. A Globe rejection leaves the STK
        // status untouched, so Globe-rejected applications are excluded by globeStatus as well.
        where.currentStep = { gte: 14 };
        where.status = { notIn: ["rejected", "on_hold"] };
        where.globeStatus = { not: "rejected" };
        where.pushedToBackoffice = false;
      } else if (normalizedStatus === "in_progress" || normalizedStatus === "pending") {
        where.currentStep = { lt: 14 };
        where.status = { notIn: ["rejected", "on_hold", "verified"] };
        // Removing where.status check here to ensure all applications with eSign incomplete are shown
      } else {
        where.status = normalizedStatus;
      }
    }

    if (stage !== "all" && !isNaN(parseInt(stage))) {
      where.currentStep = parseInt(stage);
    }

    if (startDate || endDate) {
      where.updatedAt = {};
      if (startDate) {
        where.updatedAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.updatedAt.lte = end;
      }
    }

    if (search) {
      const q = String(search).trim();
      const terms = Array.from(new Set([
        q,
        q.toLowerCase(),
        q.toUpperCase(),
        q.charAt(0).toUpperCase() + q.slice(1).toLowerCase()
      ]));

      const searchConditions = [];
      for (const term of terms) {
        searchConditions.push(
          { applicationId: { contains: term } },
          { clientCode: { contains: term } },
          { personalDetails: { contains: term } },
          { identityDetails: { contains: term } },
          { bankDetails: { contains: term } },
          { address: { contains: term } },
          { nomineeDetails: { contains: term } },
          { rejectionReason: { contains: term } },
          { globeRemarks: { contains: term } },
          { user: { email: { contains: term } } },
          { user: { phone: { contains: term } } },
          { user: { eStamp: { contains: term } } },
          { user: { boid: { contains: term } } }
        );
      }

      if (!isNaN(parseInt(q, 10)) && String(parseInt(q, 10)) === q) {
        searchConditions.push({ userId: parseInt(q, 10) });
      }

      where.OR = searchConditions;
    }

    const [applications, total] = await Promise.all([
      prisma.kycApplication.findMany({
        where,
        orderBy: [{ isResubmitted: "desc" }, { updatedAt: "desc" }],
        take,
        skip,
        select: {
          id: true,
          applicationId: true,
          status: true,
          currentStep: true,
          updatedAt: true,
          createdAt: true,
          clientCode: true,
          personalDetails: true,
          identityDetails: true,
          bankDetails: true,
          address: true,
          nomineeDetails: true,
          esignDetails: true,
          ocrData: true,
          stepStatuses: true,
          selfieDetails: true,
          signature: true,
          segments: true,
          globeStatus: true,
          isResubmitted: true,
          riskScore: true,
          faceMatchScore: true,
          assignedCrmAgentId: true,
          correctionDraft: true, // only to work out rejectionMail below — not sent to the list
          user: { select: { email: true, phone: true, eStamp: true, boid: true, boidAssigned: { select: { boidNumber: true } }, eStampAssigned: { select: { serialNo: true, certificateNo: true } } } }
        }
      }),
      prisma.kycApplication.count({ where })
    ]);

    // rejectionMail.mailPending → "Mail not sent" tag on rejected applications
    const listed = applications.map(({ correctionDraft, ...app }) => ({ ...app, rejectionMail: getRejectionMailState({ ...app, correctionDraft }) }));

    res.json({
      success: true,
      applications: await attachDecisionTimestamps(await annotateRejectedBy(listed)),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / take)
    });
  } catch (error) {
    next(error);
  }
};

// Fetch users referred by the AP
const getApReferrals = async (req, res, next) => {
  try {
    const apId = Number(req.user.id);
    const apCode = `AP${apId}`; // Matches AP logic
    const { page = 1, limit = 15 } = req.query;
    
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(limit, 10) || 15, 1), 200);
    const skip = (pageNum - 1) * take;

    const where = { apCode: apCode };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        select: {
          id: true,
          phone: true,
          email: true,
          createdAt: true,
          kycApplications: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: {
              currentStep: true,
              status: true,
              updatedAt: true,
              assignedCrmAgentId: true
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    res.json({ 
      success: true, 
      referrals: users,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / take),
      apCode
    });
  } catch (error) {
    next(error);
  }
};

const reviewStepSchema = z.object({
  stepName: z.string(),
  status: z.enum(["approved", "rejected", "pending"]),
  reason: z.string().optional()
});

const REVIEW_STEP_ORDER = [
  { id: "phoneVerification", kycIndex: 1 },
  { id: "emailVerification", kycIndex: 2 },
  { id: "pricingSelection", kycIndex: 3 },
  { id: "panVerification", kycIndex: 4 },
  { id: "digilocker", kycIndex: 5 },
  { id: "personalDetails", kycIndex: 6 },
  { id: "pepProof", kycIndex: 6 },
  { id: "nomineeChoice", kycIndex: 7 },
  { id: "nomineeDetails", kycIndex: 8 },
  { id: "nominee1Proof", kycIndex: 8 },
  { id: "nominee2Proof", kycIndex: 8 },
  { id: "nominee3Proof", kycIndex: 8 },
  { id: "guardian1Proof", kycIndex: 8 },
  { id: "guardian2Proof", kycIndex: 8 },
  { id: "guardian3Proof", kycIndex: 8 },
  { id: "nomineeAllocation", kycIndex: 9 },
  { id: "bankVerification", kycIndex: 10 },
  { id: "financialProof", kycIndex: 11 },
  { id: "signature", kycIndex: 12 },
  { id: "panUpload", kycIndex: 13 },
  { id: "ipv", kycIndex: 14 },
  { id: "documentUpload", kycIndex: 11 }, // Fallback for general document rejections
  { id: "esignPreview", kycIndex: 15 },
  { id: "aadhaarEsign", kycIndex: 16 },
  { id: "completion", kycIndex: 17 },
];

// Granular step-by-step review
const reviewStep = async (req, res, next) => {
  try {
    const { id, stepName } = req.params;
    const agentId = req.user.id;
    
    // Use req.user.email as the agent name for audit log if available
    const agentName = req.user.email || `Agent ${agentId}`;
    
    const { status, reason } = reviewStepSchema.parse({
      stepName,
      status: req.body.status,
      reason: req.body.reason
    });

    // Extract field-level rejection info
    const rejectedFields = Array.isArray(req.body.rejectedFields) ? req.body.rejectedFields : [];
    const rejectEntireModule = req.body.rejectEntireModule === true;

    if (status === "rejected" && (!reason || reason.trim() === "")) {
      return res.status(400).json({ success: false, error: "Rejection reason is required" });
    }

    const app = await prisma.kycApplication.findUnique({
      where: { applicationId: id },
    });

    if (!app) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    // Ensure the agent is assigned to this app, or is an admin / Globe reviewer (they review every application)
    if (Number(app.assignedCrmAgentId) !== Number(agentId) && !["admin", "globe"].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "You are not assigned to review this application" });
    }

    if (status === "rejected" && !isRejectable(app)) {
      return res.status(400).json({ success: false, error: NOT_REJECTABLE_ERROR });
    }

    const configuredStep = REVIEW_STEP_ORDER.find((step) => step.id === stepName);
    if (!configuredStep) {
      return res.status(400).json({ success: false, error: "Unknown review step" });
    }

    const hasCompletedJourneyOnce = !!app.submittedAt || !!app.isResubmitted || !!app.rejectionReason;
    if (!hasCompletedJourneyOnce && (app.currentStep || 0) < configuredStep.kycIndex) {
      return res.status(400).json({
        success: false,
        error: "This step is not available yet because the applicant has not reached it"
      });
    }

    // Update stepStatuses JSON
    // stepStatuses structure: { [stepName]: { status, reason, reviewedAt, reviewedBy, rejectedFields?, rejectEntireModule? } }
    let stepStatuses = {};
    if (app.stepStatuses) {
      try {
        stepStatuses = JSON.parse(app.stepStatuses);
      } catch (e) {
        stepStatuses = {};
      }
    }

    // Automatically approve phone and email as they are OTP verified unless explicitly set
    if (!stepStatuses.phoneVerification || !stepStatuses.phoneVerification.status) {
      stepStatuses.phoneVerification = { status: "approved" };
    }
    if (!stepStatuses.emailVerification || !stepStatuses.emailVerification.status) {
      stepStatuses.emailVerification = { status: "approved" };
    }

    // Sequential review check removed as per request



    stepStatuses[stepName] = {
      status,
      reason: status === "rejected" ? reason : null,
      rejectedFields: status === "rejected" ? rejectedFields : [],
      rejectEntireModule: status === "rejected" ? rejectEntireModule : false,
      reviewedAt: new Date().toISOString(),
      reviewedBy: agentId,
      rejectedBy: status === "rejected" ? reviewerSide(req) : null,
    };

    // Document rejections marked but not yet mailed keep the application rejected too
    let hasRejectedSteps = hasRejectedStepEntries(stepStatuses) || Object.keys(getPendingDocRejections(stepStatuses)).length > 0;

    const updateData = {
      stepStatuses: JSON.stringify(stepStatuses),
      reviewedAt: new Date(),
    };

    if (status === "rejected") {
      updateData.rejectionReason = reason;
      updateData.status = "rejected";

      // Re-saving a rejection (e.g. one field undone) after the rejection mail: keep the applicant's
      // correction session in step, so they are only asked to fix what is still rejected
      if (app.correctionDraft) {
        try {
          const session = typeof app.correctionDraft === "string" ? JSON.parse(app.correctionDraft) : app.correctionDraft;
          const entry = session && Array.isArray(session.rejectedSteps) ? session.rejectedSteps.find(s => s.stepId === stepName) : null;
          if (entry) {
            entry.reason = reason;
            entry.rejectedFields = rejectedFields;
            entry.rejectEntireModule = rejectEntireModule;
            updateData.correctionDraft = JSON.stringify(session);
          }
        } catch (e) {
          console.error("Error updating correctionDraft for re-saved rejection:", e);
        }
      }
    } else {
      // Reversal of rejection (un-reject): If there's an active correction session, remove this step
      if (app.correctionDraft) {
        try {
          let session = typeof app.correctionDraft === 'string' 
            ? JSON.parse(app.correctionDraft) 
            : app.correctionDraft;
            
          if (session && Array.isArray(session.rejectedSteps)) {
            session.rejectedSteps = session.rejectedSteps.filter(s => s.stepId !== stepName);
            
            if (session.rejectedSteps.length > 0) {
              hasRejectedSteps = true; // Other steps (e.g. documents) are still rejected
              updateData.correctionDraft = JSON.stringify(session);
            } else {
              updateData.correctionDraft = null;
            }
          }
        } catch (e) {
          console.error("Error parsing correctionDraft during un-reject:", e);
        }
      }
      updateData.status = hasRejectedSteps ? "rejected" : "under_review";
    }

    // A module rejected on the Globe portal is a Globe rejection (shows under Globe "Rejected");
    // once Globe has undone every rejection, it goes back to pending for Globe review.
    // Globe never changes the STK status, the STK rejection reason or the STK review time.
    if (req.user.role === "globe") {
      delete updateData.status;
      delete updateData.rejectionReason;
      delete updateData.reviewedAt;
      if (status === "rejected") {
        updateData.globeStatus = "rejected";
        updateData.globeRemarks = reason;
        updateData.globeReviewedAt = new Date();
        updateData.globeReviewedBy = agentId;
      } else if (!hasRejectedSteps && app.globeStatus === "rejected") {
        updateData.globeStatus = "pending";
      }
    }

    await prisma.kycApplication.update({
      where: { applicationId: id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        userId: null,
        crmAgentId: agentId,
        crmAgentName: agentName,
        action: `MAKER_CHECKER_STEP_${status.toUpperCase()}`,
        details: JSON.stringify({ 
          message: `Maker/Checker reviewer (${agentName}) marked step '${stepName}' as ${status}${reason ? '. Reason: ' + reason : ''}`,
          applicationId: id, 
          stepName, 
          status,
          reason: reason || null 
        }),
        targetId: String(id),
        targetType: "KycApplication",
        ipAddress: req.ip,
      },
    });

    // Real-time: other reviewers with this KYC open (any device) refresh and see the change
    const io = req.app.get("io");
    if (io) {
      io.to(id).emit("kyc_updated");
      io.to("staff_room").emit("applications_updated");
    }

    res.json({ success: true, message: `Step ${stepName} ${status}` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors?.[0]?.message || error.message });
    }
    next(error);
  }
};

// Step title mapping for human-readable email
const STEP_TITLE_MAP = {
  phoneVerification: "Phone Verification",
  emailVerification: "Email Verification",
  pricingSelection: "Pricing Plan",
  panVerification: "PAN Verification",
  digilocker: "DigiLocker",
  personalDetails: "Personal Details",
  nomineeChoice: "Nominee Choice",
  nomineeDetails: "Nominee Details",
  nomineeAllocation: "Nominee Allocation",
  bankVerification: "Bank Verification",
  financialProof: "Financial Proof",
  signature: "Signature",
  panUpload: "PAN Upload",
  ipv: "In-Person Verification (Selfie)",
  pepProof: "PEP Proof",
  nominee1Proof: "Nominee 1 Proof",
  nominee2Proof: "Nominee 2 Proof",
  nominee3Proof: "Nominee 3 Proof",
  guardian1Proof: "Guardian 1 Proof",
  guardian2Proof: "Guardian 2 Proof",
  guardian3Proof: "Guardian 3 Proof",
  esignPreview: "eSign Preview",
  aadhaarEsign: "Aadhaar eSign",
  completion: "Completion",
};

// Map review step ids to KYC user step indexes for navigation
const REVIEW_STEP_TO_KYC_INDEX = {
  phoneVerification: 1,
  emailVerification: 2,
  pricingSelection: 3,
  panVerification: 4,
  digilocker: 5,
  personalDetails: 6,
  pepProof: 6, // Renders in DetailsStep
  nomineeChoice: 7,
  nomineeDetails: 8,
  nominee1Proof: 8, // Renders in NomineeStep
  nominee2Proof: 8,
  nominee3Proof: 8,
  guardian1Proof: 8,
  guardian2Proof: 8,
  guardian3Proof: 8,
  nomineeAllocation: 9,
  bankVerification: 10,
  financialProof: 11,
  signature: 11,
  panUpload: 11,
  ipv: 11,
  esignPreview: 12,
  aadhaarEsign: 13,
  completion: 14,
};

// Document-type review steps — rejection of these only clears the specific document,
// not the entire form. All other steps are "module" rejections.
const DOCUMENT_REVIEW_STEPS = [
  "financialProof", "signature", "panUpload", "ipv",
  "pepProof", "nominee1Proof", "nominee2Proof", "nominee3Proof",
  "guardian1Proof", "guardian2Proof", "guardian3Proof"
];

/**
 * Sends a rejection email to the KYC user and resets the application
 * so the user can modify only the rejected steps + re-eSign.
 */
const requestModifications = async (req, res, next) => {
  try {
    const { id } = req.params;
    const agentId = req.user.id;
    const agentName = req.user.email || `Agent ${agentId}`;
    // resend: true → send again even though these exact rejections were already mailed
    const { documentRejections, resend } = req.body || {};

    const app = await prisma.kycApplication.findUnique({
      where: { applicationId: id },
      include: { user: true },
    });

    if (!app) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    if (!isRejectable(app)) {
      return res.status(400).json({ success: false, error: NOT_REJECTABLE_ERROR });
    }

    // Parse stepStatuses to find rejected steps
    let stepStatuses = {};
    if (app.stepStatuses) {
      try { stepStatuses = JSON.parse(app.stepStatuses); } catch (e) { stepStatuses = {}; }
    }

    // Document rejections to mail: what the reviewer's screen sent, else the ones saved on the application
    const docRejectionsToMail = documentRejections && typeof documentRejections === "object" && !Array.isArray(documentRejections)
      ? documentRejections
      : getPendingDocRejections(stepStatuses);

    // The applicant was already mailed exactly these rejections — don't mail them twice by accident
    const mailState = getRejectionMailState(app, { ...stepStatuses, [PENDING_DOC_REJECTIONS_KEY]: docRejectionsToMail });
    if (mailState.alreadySent && resend !== true) {
      return res.status(409).json({
        success: false,
        code: "REJECTION_MAIL_ALREADY_SENT",
        error: "The rejection mail for these rejections has already been sent. Add, edit or remove a rejection to send a new one, or use Resend.",
      });
    }
    // Resending the same rejections: keep the applicant's correction session (and anything they have
    // already corrected in it) — only the mail and its link are sent again
    let existingSession = null;
    if (mailState.alreadySent && app.correctionDraft) {
      try {
        const parsed = typeof app.correctionDraft === "string" ? JSON.parse(app.correctionDraft) : app.correctionDraft;
        if (parsed?.sessionId && Array.isArray(parsed.rejectedSteps)) existingSession = parsed;
      } catch (e) { existingSession = null; }
    }

    const rejectedEntries = Object.entries(stepStatuses)
      .filter(([stepId, info]) => !stepId.startsWith("_") && info?.status === "rejected")
      .map(([stepId, info]) => ({
        stepId,
        stepTitle: STEP_TITLE_MAP[stepId] || stepId,
        reason: info.reason || "",
        kycIndex: REVIEW_STEP_TO_KYC_INDEX[stepId] || 1,
        rejectedFields: Array.isArray(info.rejectedFields) ? info.rejectedFields : [],
        rejectEntireModule: info.rejectEntireModule === true,
      }));

    // Merge document rejections from the frontend (localStorage-based)
    // These are keyed by document URL (src) with a reason string as value
    // Merge document rejections from the frontend (localStorage-based)
    // These are keyed by document URL (src) with a reason string as value
    const DOCUMENT_TITLE_MAP = {
      financialProof: "Financial Proof",
      signature: "Signature",
      panUpload: "PAN Card Upload",
      ipv: "In-Person Verification (Selfie)",
      pepProof: "PEP Proof",
      nominee1Proof: "Nominee 1 Proof",
      nominee2Proof: "Nominee 2 Proof",
      nominee3Proof: "Nominee 3 Proof",
      guardian1Proof: "Guardian 1 Proof",
      guardian2Proof: "Guardian 2 Proof",
      guardian3Proof: "Guardian 3 Proof",
    };

    if (Object.keys(docRejectionsToMail).length > 0 || stepStatuses[PENDING_DOC_REJECTIONS_KEY]) {
      // Try to match document src URLs to their stepId by checking the app's documents
      let appDocuments = [];
      if (app.documents) {
        try { appDocuments = JSON.parse(app.documents); } catch (e) { appDocuments = []; }
      }

      // Parse known application fields so we can match document paths
      // that aren't stored in the documents array (e.g. nominee proofs, guardian proofs)
      let parsedNomineeDetails = {};
      try { parsedNomineeDetails = typeof app.nomineeDetails === "string" ? JSON.parse(app.nomineeDetails) : (app.nomineeDetails || {}); } catch (e) {}
      let parsedPersonalDetails = {};
      try { parsedPersonalDetails = typeof app.personalDetails === "string" ? JSON.parse(app.personalDetails) : (app.personalDetails || {}); } catch (e) {}
      let parsedFinancialProof = {};
      try { parsedFinancialProof = typeof app.financialProof === "string" ? JSON.parse(app.financialProof) : (app.financialProof || {}); } catch (e) {}
      let parsedSignature = {};
      try { parsedSignature = typeof app.signature === "string" ? JSON.parse(app.signature) : (app.signature || {}); } catch (e) {}
      let parsedPanUpload = {};
      try { parsedPanUpload = typeof app.panUpload === "string" ? JSON.parse(app.panUpload) : (app.panUpload || {}); } catch (e) {}
      let parsedSelfieDetails = {};
      try { parsedSelfieDetails = typeof app.selfieDetails === "string" ? JSON.parse(app.selfieDetails) : (app.selfieDetails || {}); } catch (e) {}
      let parsedBankDetails = {};
      try { parsedBankDetails = typeof app.bankDetails === "string" ? JSON.parse(app.bankDetails) : (app.bankDetails || {}); } catch (e) {}

      // Helper: check if a document path matches the given src
      const pathMatches = (fieldPath, src) => {
        if (!fieldPath || !src) return false;
        // Normalize: strip domain/protocol for comparison
        const normalize = (p) => (p || "").replace(/^https?:\/\/[^/]+/, "").replace(/^\/+/, "");
        return normalize(fieldPath) === normalize(src) || fieldPath === src;
      };

      for (const [docSrc, reason] of Object.entries(docRejectionsToMail)) {
        if (!reason) continue;
        // Try to find matching document in the documents array first
        const matchedDoc = appDocuments.find(d => d.url === docSrc || d.path === docSrc);
        let docStepId = null;
        let docLabel = "Document";

        if (matchedDoc) {
          // Map document type to a step ID
          const typeLC = (matchedDoc.type || matchedDoc.label || "").toLowerCase();
          if (typeLC.includes("financial") || typeLC.includes("income")) {
            docStepId = "financialProof";
          } else if (typeLC.includes("signature")) {
            docStepId = "signature";
          } else if (typeLC.includes("pan") && !typeLC.includes("digilocker")) {
            docStepId = "panUpload";
          } else if (typeLC.includes("selfie") || typeLC.includes("ipv")) {
            docStepId = "ipv";
          } else if (typeLC.includes("pep")) {
            docStepId = "pepProof";
          } else if (typeLC.includes("nominee")) {
            if (typeLC.includes("1")) docStepId = "nominee1Proof";
            else if (typeLC.includes("2")) docStepId = "nominee2Proof";
            else if (typeLC.includes("3")) docStepId = "nominee3Proof";
            else docStepId = "nominee1Proof"; // Fallback
          } else if (typeLC.includes("guardian")) {
            if (typeLC.includes("1")) docStepId = "guardian1Proof";
            else if (typeLC.includes("2")) docStepId = "guardian2Proof";
            else if (typeLC.includes("3")) docStepId = "guardian3Proof";
            else docStepId = "guardian1Proof"; // Fallback
          }
          docLabel = matchedDoc.label || matchedDoc.type || "Document";
        }

        // If not found in documents array, check against known application fields
        if (!docStepId) {
          // Check nominee and guardian proofs
          const nominees = Array.isArray(parsedNomineeDetails.nominees) ? parsedNomineeDetails.nominees : [];
          for (let i = 0; i < nominees.length; i++) {
            const nom = nominees[i];
            if (pathMatches(nom.proofPath, docSrc) || pathMatches(nom.proofPreview, docSrc) || pathMatches(nom.proof, docSrc)) {
              docStepId = `nominee${i + 1}Proof`;
              docLabel = `Nominee ${i + 1} Document`;
              break;
            }
            if (pathMatches(nom.guardianProofPath, docSrc) || pathMatches(nom.guardianProofPreview, docSrc) || pathMatches(nom.guardianProof, docSrc)) {
              docStepId = `guardian${i + 1}Proof`;
              docLabel = `Nominee ${i + 1} Guardian Document`;
              break;
            }
          }

          // Check financial proof
          if (!docStepId && (pathMatches(parsedFinancialProof.filePreview, docSrc) || pathMatches(parsedFinancialProof.path, docSrc) || pathMatches(parsedFinancialProof.preview, docSrc))) {
            docStepId = "financialProof";
            docLabel = "Financial Proof";
          }

          // Check signature
          if (!docStepId && (pathMatches(parsedSignature.filePreview, docSrc) || pathMatches(parsedSignature.path, docSrc) || pathMatches(parsedSignature.preview, docSrc) || pathMatches(app.signature, docSrc))) {
            docStepId = "signature";
            docLabel = "Signature";
          }

          // Check PAN upload
          if (!docStepId && (pathMatches(parsedPanUpload.filePreview, docSrc) || pathMatches(parsedPanUpload.path, docSrc) || pathMatches(parsedPanUpload.preview, docSrc))) {
            docStepId = "panUpload";
            docLabel = "PAN Card Upload";
          }

          // Check selfie/IPV
          if (!docStepId && (pathMatches(parsedSelfieDetails.preview, docSrc) || pathMatches(parsedSelfieDetails.path, docSrc) || pathMatches(app.selfie, docSrc))) {
            docStepId = "ipv";
            docLabel = "Live Selfie";
          }

          // Check bank proof
          if (!docStepId && (pathMatches(parsedBankDetails.proofPreview, docSrc) || pathMatches(parsedBankDetails.proofPath, docSrc) || pathMatches(parsedBankDetails.proof, docSrc))) {
            docStepId = "bankVerification";
            docLabel = "Bank Proof";
          }

          // Check PEP proof
          if (!docStepId && (pathMatches(parsedPersonalDetails.pepProof, docSrc) || pathMatches(parsedPersonalDetails.pepProofPreview, docSrc))) {
            docStepId = "pepProof";
            docLabel = "PEP Proof";
          }
        }

        // Determine a step ID for this document
        const finalStepId = docStepId || "documentUpload";
        const finalTitle = DOCUMENT_TITLE_MAP[docStepId] || docLabel;

        // Only add if not already in rejectedEntries (avoid duplicates)
        if (!rejectedEntries.some(e => e.stepId === finalStepId)) {
          rejectedEntries.push({
            stepId: finalStepId,
            stepTitle: finalTitle,
            reason: reason,
            kycIndex: REVIEW_STEP_TO_KYC_INDEX[finalStepId] || 11,
          });

          // Also save to stepStatuses so frontend can detect it
          stepStatuses[finalStepId] = {
            status: "rejected",
            reason: reason,
            docSrc,
            docLabel: finalTitle,
            rejectedBy: (stepStatuses[PENDING_DOC_BY_KEY] || {})[docSrc] || reviewerSide(req),
            reviewedAt: new Date().toISOString(),
          };
        }
      }

      // These pending (not yet mailed) document rejections are now part of the request — clear the pending list
      delete stepStatuses[PENDING_DOC_REJECTIONS_KEY];
      delete stepStatuses[PENDING_DOC_LABELS_KEY];
      delete stepStatuses[PENDING_DOC_BY_KEY];

      // Persist the updated stepStatuses with document rejections
      await prisma.kycApplication.update({
        where: { applicationId: id },
        data: { stepStatuses: JSON.stringify(stepStatuses) },
      });
    }

    if (rejectedEntries.length === 0) {
      return res.status(400).json({ success: false, error: "No rejected steps found on this application" });
    }

    // Build a structured correction session (replaces any previous session — except on a resend)
    const crypto = require("crypto");
    const correctionSessionId = existingSession
      ? existingSession.sessionId
      : `CORR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    // Sort rejected entries by kycIndex to preserve normal flow order
    rejectedEntries.sort((a, b) => a.kycIndex - b.kycIndex);

    const correctionSession = existingSession || {
      sessionId: correctionSessionId,
      createdAt: new Date().toISOString(),
      rejectedSteps: rejectedEntries.map(e => ({
        stepId: e.stepId,
        type: DOCUMENT_REVIEW_STEPS.includes(e.stepId) ? "document" : "module",
        reason: e.reason,
        kycIndex: e.kycIndex,
        rejectedFields: e.rejectedFields || [],
        rejectEntireModule: e.rejectEntireModule || false,
        completed: false,
      })),
      drafts: {},
      requiresEsign: true,
    };

    // Get the user's email and name
    let personalDetails = {};
    if (app.personalDetails) {
      try { personalDetails = JSON.parse(app.personalDetails); } catch (e) { personalDetails = {}; }
    }
    const userName = personalDetails.fullName || app.user?.email || app.user?.phone || "User";
    const userEmail = personalDetails.email || app.user?.email;

    if (!userEmail) {
      return res.status(400).json({ success: false, error: "No email found for this user. Cannot send rejection notification." });
    }

    // These rejections are now real (mailed) — a status set before a not-yet-mailed document
    // rejection must no longer be put back if one of them is removed
    delete stepStatuses[PENDING_DOC_STATUS_FLIP_KEY];

    // Set status to "rejected" and store correction session.
    // IMPORTANT: currentStep is NOT moved — normal flow position is preserved.
    await prisma.kycApplication.update({
      where: { applicationId: id },
      data: {
        stepStatuses: JSON.stringify(stepStatuses),
        correctionDraft: JSON.stringify(correctionSession),
        // Sent from the Globe portal → a Globe rejection only (the STK status is never changed by Globe);
        // sent by STK → the STK status becomes rejected (Globe status untouched)
        ...(req.user.role === "globe"
          ? { globeStatus: "rejected", globeReviewedAt: new Date(), globeReviewedBy: req.user.id }
          : { status: "rejected" }),
      },
    });

    // Build the correction link — points to the separate /correction route
    const jwt = require("jsonwebtoken");
    const magicToken = jwt.sign(
      {
        id: app.user.id,
        phone: app.user.phone,
        role: app.user.role || "user",
        correctionMode: true,
        sessionId: correctionSessionId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const modifyLink = `${frontendUrl}/correction?token=${magicToken}`;

    // Send the email
    const { sendRejectionEmail } = require("../services/emailService");
    let emailError = null;
    try {
      await sendRejectionEmail(
        userEmail,
        userName,
        rejectedEntries.map(e => ({ stepTitle: e.stepTitle, reason: e.reason })),
        modifyLink
      );
    } catch (error) {
      emailError = error;
      console.error("[RequestModifications] Email sending failed:", error.message);
      // The application is already updated (rejected, correction session saved) — the reviewer can retry the mail
    }

    // Only a delivered mail counts: from now on the button stays disabled until the rejections change.
    // A failed first mail is recorded too (fingerprint null), so the correction session saved above is
    // not taken for a mail sent before this tracking existed.
    if (!emailError) {
      stepStatuses[REJECTION_MAIL_SENT_KEY] = {
        fingerprint: rejectionFingerprint(stepStatuses),
        sentAt: new Date().toISOString(),
        by: reviewerSide(req),
        sentByEmail: agentName,
      };
    } else if (!stepStatuses[REJECTION_MAIL_SENT_KEY]) {
      stepStatuses[REJECTION_MAIL_SENT_KEY] = { fingerprint: null, failedAt: new Date().toISOString() };
    }
    await prisma.kycApplication.update({
      where: { applicationId: id },
      data: { stepStatuses: JSON.stringify(stepStatuses) },
    });

    // Audit log
    const stepTitles = rejectedEntries.map(e => e.stepTitle || e.stepId).join(", ");
    await prisma.auditLog.create({
      data: {
        userId: null,
        crmAgentId: agentId,
        crmAgentName: agentName,
        action: emailError ? "MODIFICATION_REQUEST_EMAIL_FAILED" : "MODIFICATION_REQUEST_SENT",
        details: JSON.stringify({
          message: emailError
            ? `Modification request email to ${userEmail} by ${agentName} could not be sent (${emailError.message}) for steps: ${stepTitles}`
            : `Modification request email ${existingSession ? "re-sent" : "sent"} to ${userEmail} by ${agentName} for steps: ${stepTitles}`,
          applicationId: id,
          rejectedSteps: rejectedEntries.map(e => ({ stepId: e.stepId, title: e.stepTitle, reason: e.reason })),
          emailSentTo: userEmail,
          correctionSessionId,
          resend: !!existingSession,
        }),
        targetId: String(id),
        targetType: "KycApplication",
        ipAddress: req.ip,
      },
    });

    // Notify via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(id).emit("kyc_updated", { action: "modifications_requested" });
      io.to("staff_room").emit("applications_updated");
    }

    if (emailError) {
      return res.status(502).json({
        success: false,
        code: "REJECTION_MAIL_FAILED",
        error: "The rejections were saved, but the email could not be sent to the applicant. Please try sending the rejection mail again.",
      });
    }

    res.json({
      success: true,
      resent: !!existingSession,
      message: `Modification request ${existingSession ? "re-sent" : "sent"} to ${userEmail}`,
      rejectedSteps: rejectedEntries.map(e => e.stepTitle),
      correctionSessionId,
      correctionLink: modifyLink,
    });
  } catch (error) {
    next(error);
  }
};

const getCorrectionLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    const app = await prisma.kycApplication.findUnique({
      where: { applicationId: id },
      include: { user: true },
    });

    if (!app || !app.correctionDraft) {
      return res.status(404).json({ success: false, error: "No active correction session found." });
    }

    let session;
    try {
      session = JSON.parse(app.correctionDraft);
    } catch (e) {
      return res.status(500).json({ success: false, error: "Invalid correction session data." });
    }

    const jwt = require("jsonwebtoken");
    const magicToken = jwt.sign(
      {
        id: app.user.id,
        phone: app.user.phone,
        role: app.user.role || "user",
        correctionMode: true,
        sessionId: session.sessionId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const modifyLink = `${frontendUrl}/correction?token=${magicToken}`;

    res.json({ success: true, correctionLink: modifyLink });
  } catch (error) {
    next(error);
  }
};

// Save the pending (not yet mailed) document rejections for an application — replaces the whole set.
// Notifies other reviewers with this KYC open so they see it in real time.
const savePendingDocumentRejections = async (req, res, next) => {
  try {
    const { id } = req.params;
    const input = req.body?.documentRejections;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return res.status(400).json({ success: false, error: "documentRejections must be an object" });
    }

    const clean = {};
    for (const [src, reason] of Object.entries(input)) {
      if (typeof src === "string" && src && typeof reason === "string" && reason.trim()) {
        clean[src] = reason.trim();
      }
    }

    const app = await prisma.kycApplication.findUnique({ where: { applicationId: id }, select: { stepStatuses: true, currentStep: true, status: true, globeStatus: true } });
    if (!app) return res.status(404).json({ success: false, error: "Application not found" });
    if (Object.keys(clean).length > 0 && !isRejectable(app)) {
      return res.status(400).json({ success: false, error: NOT_REJECTABLE_ERROR });
    }

    let stepStatuses = {};
    if (app.stepStatuses) {
      try { stepStatuses = typeof app.stepStatuses === "string" ? JSON.parse(app.stepStatuses) : app.stepStatuses; } catch (e) { stepStatuses = {}; }
    }
    // Optional document names (e.g. "PAN Card") so lists can show which document is rejected
    const inputLabels = req.body?.labels && typeof req.body.labels === "object" ? req.body.labels : {};
    const labels = {};
    for (const src of Object.keys(clean)) {
      if (typeof inputLabels[src] === "string" && inputLabels[src].trim()) labels[src] = inputLabels[src].trim();
    }

    if (Object.keys(clean).length > 0) {
      stepStatuses[PENDING_DOC_REJECTIONS_KEY] = clean;
      stepStatuses[PENDING_DOC_LABELS_KEY] = labels;
      const prevBy = stepStatuses[PENDING_DOC_BY_KEY] || {};
      const by = {};
      for (const src of Object.keys(clean)) by[src] = prevBy[src] || reviewerSide(req);
      stepStatuses[PENDING_DOC_BY_KEY] = by;
    } else {
      delete stepStatuses[PENDING_DOC_REJECTIONS_KEY];
      delete stepStatuses[PENDING_DOC_LABELS_KEY];
      delete stepStatuses[PENDING_DOC_BY_KEY];
    }

    // A marked document rejection rejects the application straight away (like a module rejection) —
    // STK's on the STK status, Globe's on the Globe status — even before the mail is sent.
    // When the last one of a side is removed and nothing else is rejected, that side gets back the
    // status it had before (kept in PENDING_DOC_STATUS_FLIP_KEY).
    const sidesAfter = new Set(Object.keys(getPendingDocRejections(stepStatuses)).map((src) => (stepStatuses[PENDING_DOC_BY_KEY] || {})[src] || "STK"));
    const statusField = { STK: "status", Globe: "globeStatus" };
    const flips = { ...(stepStatuses[PENDING_DOC_STATUS_FLIP_KEY] || {}) };
    const statusUpdate = {};
    for (const side of ["STK", "Globe"]) {
      const field = statusField[side];
      if (sidesAfter.has(side)) {
        if (app[field] !== "rejected") {
          flips[side] = { prev: app[field], setAt: new Date().toISOString() };
          statusUpdate[field] = "rejected";
        }
      } else if (flips[side]) {
        if (app[field] !== "rejected") {
          delete flips[side]; // the status was changed since — nothing to put back
        } else if (!hasRejectedStepEntries(stepStatuses) && sidesAfter.size === 0) {
          statusUpdate[field] = flips[side].prev;
          delete flips[side];
        }
        // otherwise something else is still rejected — put it back once that is gone too
      }
    }
    if (Object.keys(flips).length > 0) stepStatuses[PENDING_DOC_STATUS_FLIP_KEY] = flips;
    else delete stepStatuses[PENDING_DOC_STATUS_FLIP_KEY];

    await prisma.kycApplication.update({
      where: { applicationId: id },
      data: { stepStatuses: JSON.stringify(stepStatuses), ...statusUpdate },
    });

    const io = req.app.get("io");
    if (io) {
      io.to(id).emit("kyc_updated");
      io.to("staff_room").emit("applications_updated"); // lists refresh their Rejections column
    }

    res.json({ success: true, documentRejections: clean });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAssignedApplications,
  reviewStep,
  getApReferrals,
  requestModifications,
  getCorrectionLink,
  savePendingDocumentRejections,
};
