const prisma = require("../config/db");
const { z } = require("zod");

// Fetch KYC submissions assigned to the currently logged in agent
const getAssignedApplications = async (req, res, next) => {
  try {
    const agentId = Number(req.user.id);
    const { status = "all", search = "", page = 1, limit = 15 } = req.query;
    
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(limit, 10) || 15, 1), 200);
    const skip = (pageNum - 1) * take;

    const where = { assignedCrmAgentId: agentId };
    
    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { applicationId: { contains: q } },
        { user: { phone: { contains: q } } },
        { user: { email: { contains: q } } },
        { personalDetails: { path: ["fullName"], string_contains: q } }
      ];
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
          personalDetails: true,
          stepStatuses: true,
          isResubmitted: true,
          riskScore: true,
          faceMatchScore: true,
          assignedCrmAgentId: true,
          user: { select: { email: true, phone: true, eStamp: true } }
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
  status: z.enum(["approved", "rejected"]),
  reason: z.string().optional()
});

const REVIEW_STEP_ORDER = [
  { id: "phoneVerification", kycIndex: 1 },
  { id: "emailVerification", kycIndex: 2 },
  { id: "pricingSelection", kycIndex: 3 },
  { id: "panVerification", kycIndex: 4 },
  { id: "digilocker", kycIndex: 5 },
  { id: "personalDetails", kycIndex: 6 },
  { id: "nomineeChoice", kycIndex: 7 },
  { id: "nomineeDetails", kycIndex: 8 },
  { id: "nomineeAllocation", kycIndex: 9 },
  { id: "bankVerification", kycIndex: 10 },
  { id: "financialProof", kycIndex: 11 },
  { id: "signature", kycIndex: 12 },
  { id: "panUpload", kycIndex: 13 },
  { id: "ipv", kycIndex: 14 },
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

    if ((app.currentStep || 0) < configuredStep.kycIndex) {
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

    const unlockedSteps = REVIEW_STEP_ORDER.filter((step) => (app.currentStep || 0) >= step.kycIndex);
    const firstPendingStep = unlockedSteps.find((step) => stepStatuses[step.id]?.status !== "approved" && stepStatuses[step.id]?.status !== "rejected");
    const existingStatus = stepStatuses[stepName]?.status;

    if (firstPendingStep?.id !== stepName && existingStatus !== "approved" && existingStatus !== "rejected") {
      return res.status(400).json({
        success: false,
        error: `Please review ${firstPendingStep?.id || "the previous step"} before this step`
      });
    }



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
        userId: null, // Since this is a CRM agent, we use crmAgentId instead of standard userId
        crmAgentId: agentId,
        crmAgentName: agentName,
        action: `kyc_step_${status}`,
        details: JSON.stringify({ applicationId: id, stepName, reason: reason || null }),
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
  nomineeChoice: 7,
  nomineeDetails: 8,
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

/**
 * Sends a rejection email to the KYC user and resets the application
 * so the user can modify only the rejected steps + re-eSign.
 */
const requestModifications = async (req, res, next) => {
  try {
    const { id } = req.params;
    const agentId = req.user.id;
    const agentName = req.user.email || `Agent ${agentId}`;

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

    if (rejectedEntries.length === 0) {
      return res.status(400).json({ success: false, error: "No rejected steps found on this application" });
    }

    // Find the first rejected step's KYC index — the user will land here
    const firstRejectedKycIndex = Math.min(...rejectedEntries.map(e => e.kycIndex));

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

    // Reset the application: move currentStep to first rejected step, set status to pending
    await prisma.kycApplication.update({
      where: { applicationId: id },
      data: {
        status: "pending",
        currentStep: firstRejectedKycIndex,
        isResubmitted: false,
      },
    });

    // Build the modification link — the user's KYC portal
    const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || "http://localhost:3000";
    const modifyLink = `${frontendUrl}/`;

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
      // Don't fail the whole request if email fails — the app is already reset
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: null,
        crmAgentId: agentId,
        crmAgentName: agentName,
        action: "kyc_modifications_requested",
        details: JSON.stringify({
          applicationId: id,
          rejectedSteps: rejectedEntries.map(e => e.stepId),
          emailSentTo: userEmail,
        }),
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
