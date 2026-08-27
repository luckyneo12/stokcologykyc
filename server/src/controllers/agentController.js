const prisma = require("../config/db");
const { z } = require("zod");

// Fetch KYC submissions assigned to the currently logged in agent
const getAssignedApplications = async (req, res, next) => {
  try {
    const agentId = Number(req.user.id);
    const { status = "all", search = "", page = 1, limit = 15, stage = "all" } = req.query;
    
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(limit, 10) || 15, 1), 200);
    const skip = (pageNum - 1) * take;

    const where = {};
    if (req.user.role === "agent") {
      where.assignedCrmAgentId = agentId;
    }
    
    const normalizedStatus = String(status || "").toLowerCase();
    if (normalizedStatus && normalizedStatus !== "all") {
      if (normalizedStatus === "pushed_to_bo") {
        where.pushedToBackoffice = true;
      } else if (normalizedStatus === "not_pushed_to_bo") {
        where.status = "verified";
        where.pushedToBackoffice = false;
      } else if (normalizedStatus === "pending") {
        where.status = { in: ["pending", "under_review"] };
      } else {
        where.status = normalizedStatus;
      }
    }

    if (stage !== "all" && !isNaN(parseInt(stage))) {
      where.currentStep = parseInt(stage);
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
          globeStatus: true,
          isResubmitted: true,
          riskScore: true,
          faceMatchScore: true,
          assignedCrmAgentId: true,
          user: { select: { email: true, phone: true, eStamp: true, eStampAssigned: { select: { serialNo: true, certificateNo: true } } } }
        }
      }),
      prisma.kycApplication.count({ where })
    ]);

    res.json({ 
      success: true, 
      applications,
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

    if (status === "rejected" && (!reason || reason.trim() === "")) {
      return res.status(400).json({ success: false, error: "Rejection reason is required" });
    }

    const app = await prisma.kycApplication.findUnique({
      where: { applicationId: id },
    });

    if (!app) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    // Ensure the agent is assigned to this app or has admin privileges
    if (Number(app.assignedCrmAgentId) !== Number(agentId) && req.user.role !== "admin") {
      return res.status(403).json({ success: false, error: "You are not assigned to review this application" });
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
    // stepStatuses structure: { [stepName]: { status, reason, reviewedAt, reviewedBy } }
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
      reviewedAt: new Date().toISOString(),
      reviewedBy: agentId,
    };

    const updateData = {
      stepStatuses: JSON.stringify(stepStatuses),
      status: status === "rejected" ? "rejected" : "under_review",
      reviewedAt: new Date(),
    };

    if (status === "rejected") {
      updateData.rejectionReason = reason;
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
    const { documentRejections } = req.body || {};

    const app = await prisma.kycApplication.findUnique({
      where: { applicationId: id },
      include: { user: true },
    });

    if (!app) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    // Parse stepStatuses to find rejected steps
    let stepStatuses = {};
    if (app.stepStatuses) {
      try { stepStatuses = JSON.parse(app.stepStatuses); } catch (e) { stepStatuses = {}; }
    }

    const rejectedEntries = Object.entries(stepStatuses)
      .filter(([, info]) => info?.status === "rejected")
      .map(([stepId, info]) => ({
        stepId,
        stepTitle: STEP_TITLE_MAP[stepId] || stepId,
        reason: info.reason || "",
        kycIndex: REVIEW_STEP_TO_KYC_INDEX[stepId] || 1,
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

    if (documentRejections && typeof documentRejections === "object") {
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

      for (const [docSrc, reason] of Object.entries(documentRejections)) {
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
          stepStatuses[finalStepId] = { status: "rejected", reason: reason };
        }
      }

      // Persist the updated stepStatuses with document rejections
      await prisma.kycApplication.update({
        where: { applicationId: id },
        data: { stepStatuses: JSON.stringify(stepStatuses) },
      });
    }

    if (rejectedEntries.length === 0) {
      return res.status(400).json({ success: false, error: "No rejected steps found on this application" });
    }

    // Build a structured correction session (replaces any previous session)
    const crypto = require("crypto");
    const correctionSessionId = `CORR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const correctionSession = {
      sessionId: correctionSessionId,
      createdAt: new Date().toISOString(),
      rejectedSteps: rejectedEntries.map(e => ({
        stepId: e.stepId,
        type: DOCUMENT_REVIEW_STEPS.includes(e.stepId) ? "document" : "module",
        reason: e.reason,
        kycIndex: e.kycIndex,
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

    // Set status to "rejected" and store correction session.
    // IMPORTANT: currentStep is NOT moved — normal flow position is preserved.
    await prisma.kycApplication.update({
      where: { applicationId: id },
      data: {
        status: "rejected",
        correctionDraft: JSON.stringify(correctionSession),
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
        rejectedSteps: correctionSession.rejectedSteps,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const modifyLink = `${frontendUrl}/correction?token=${magicToken}`;

    // Send the email
    const { sendRejectionEmail } = require("../services/emailService");
    try {
      await sendRejectionEmail(
        userEmail,
        userName,
        rejectedEntries.map(e => ({ stepTitle: e.stepTitle, reason: e.reason })),
        modifyLink
      );
    } catch (emailError) {
      console.error("[RequestModifications] Email sending failed:", emailError.message);
      // Don't fail the whole request if email fails — the app is already updated
    }

    // Audit log
    const stepTitles = rejectedEntries.map(e => e.stepTitle || e.stepId).join(", ");
    await prisma.auditLog.create({
      data: {
        userId: null,
        crmAgentId: agentId,
        crmAgentName: agentName,
        action: "MODIFICATION_REQUEST_SENT",
        details: JSON.stringify({
          message: `Modification request email sent to ${userEmail} by ${agentName} for steps: ${stepTitles}`,
          applicationId: id,
          rejectedSteps: rejectedEntries.map(e => ({ stepId: e.stepId, title: e.stepTitle, reason: e.reason })),
          emailSentTo: userEmail,
          correctionSessionId,
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

    res.json({
      success: true,
      message: `Modification request sent to ${userEmail}`,
      rejectedSteps: rejectedEntries.map(e => e.stepTitle),
      correctionSessionId,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAssignedApplications,
  reviewStep,
  getApReferrals,
  requestModifications,
};
