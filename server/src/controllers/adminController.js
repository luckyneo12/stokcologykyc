const prisma = require("../config/db");
const { z } = require("zod");
const digioClient = require("../services/digioClient");
const crmService = require("../services/crmService");
const backofficeService = require("../services/backofficeService");
const { ensureDigilockerVerificationDocuments } = require("../routes/digioRoutes");

const reviewSchema = z.object({
  status: z.enum(["pending", "under_review", "verified", "rejected", "on_hold"]),
  reason: z.string().optional().default(""),
  currentStep: z.number().int().min(0).max(50).optional(),
});

const JSON_FIELD_KEYS = [
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
  "selfieDetails",
  "documents",
  "nsdlRequest",
  "nsdlResponse",
  "segments",
  "stepStatuses",
];

const parseJsonField = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeApplication = (app) => {
  if (!app) return app;
  const normalized = { ...app };
  JSON_FIELD_KEYS.forEach((key) => {
    normalized[key] = parseJsonField(app[key], key === "documents" ? [] : {});
  });
  return normalized;
};

const getApplications = async (req, res, next) => {
  const { status, search = "", page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
  const skip = (pageNum - 1) * take;

  try {
    const where = {};
    const normalizedStatus = String(status || "").toLowerCase();
    if (normalizedStatus && normalizedStatus !== "all") {
      if (normalizedStatus === "globe_approved") {
        where.globeStatus = "approved";
      } else if (normalizedStatus === "globe_rejected") {
        where.globeStatus = "rejected";
      } else if (normalizedStatus === "pushed_to_bo") {
        where.pushedToBackoffice = true;
      } else if (normalizedStatus === "not_pushed_to_bo") {
        where.status = "verified";
        where.pushedToBackoffice = false;
      } else {
        where.status = normalizedStatus;
      }
    }

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { applicationId: { contains: q } },
        { user: { phone: { contains: q } } },
        { user: { email: { contains: q } } },
        { personalDetails: { contains: q } }
      ];
    }

    // Optimization: Only fetch fields needed for the list view
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
          personalDetails: true, // Needed for name
          identityDetails: true, // Needed for PAN/Aadhaar status
          isResubmitted: true,
          assignedCrmAgentId: true,
          globeStatus: true,
          user: {
            select: {
              id: true,
              phone: true,
              email: true,
              eStamp: true,
              eStampAssigned: { select: { serialNo: true } }
            }
          }
        }
      }),
      prisma.kycApplication.count({ where })
    ]);

    res.json({
      success: true,
      applications,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    next(error);
  }
};

const getApplicationById = async (req, res, next) => {
  try {
    const rawId = String(req.params.id || "").trim();
    const numericId = Number(rawId);

    let app = await prisma.kycApplication.findFirst({
      where: {
        OR: [
          { applicationId: rawId },
          ...(Number.isInteger(numericId) && numericId > 0 ? [{ id: numericId }] : []),
        ],
      },
      include: {
        user: {
          include: { eStampAssigned: true }
        },
        reviewer: true,
      },
    });

    if (!app) {
      app = await prisma.kycApplication.findFirst({
        where: {
          applicationId: {
            contains: rawId,
          },
        },
        include: {
          user: {
            include: { eStampAssigned: true }
          },
          reviewer: true,
        },
      });
    }

    if (!app) return res.status(404).json({ success: false, error: "Not found" });

    if (req.user.role === "kyc_team" && Number(app.assignedCrmAgentId) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, error: "You are not assigned to review this application" });
    }

    ensureDigilockerVerificationDocuments(app).then((updatedApp) => {
      if (updatedApp && JSON.stringify(updatedApp.documents) !== JSON.stringify(app.documents)) {
        req.app.get("io")?.to(app.applicationId).emit("kyc_updated");
      }
    }).catch((pdfError) => {
      console.warn("[Admin] Could not ensure DigiLocker verification PDF:", pdfError.message);
    });

    const allLogs = await prisma.auditLog.findMany({
      where: { userId: app.userId },
      orderBy: { timestamp: "desc" },
      take: 500,
    });

    const logs = allLogs.map((log) => ({
      ...log,
      details: parseJsonField(log.details, log.details),
    })).filter((log) => {
      const linkedAppId = log.details?.applicationId;
      return !linkedAppId || linkedAppId === app.applicationId;
    });

    res.json({ success: true, application: normalizeApplication(app), logs });
  } catch (error) {
    next(error);
  }
};

const reviewApplication = async (req, res, next) => {
  let payload;
  try {
    payload = reviewSchema.parse(req.body || {});
  } catch (error) {
    return res.status(400).json({ success: false, error: error.errors?.[0]?.message || "Invalid review payload" });
  }

  const { status, reason, currentStep } = payload;
  try {
    const app = await prisma.kycApplication.findUnique({
      where: { applicationId: req.params.id },
    });
    if (!app) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    if (status === "verified") {
      let statuses = {};
      try {
        statuses = typeof app.stepStatuses === "string" ? JSON.parse(app.stepStatuses) : (app.stepStatuses || {});
      } catch (e) {}
      
      const hasRejected = Object.values(statuses).some(s => s?.status === "rejected");
      if (hasRejected) {
        return res.status(400).json({ success: false, error: "Cannot approve application because one or more steps are marked as rejected." });
      }
    }

    const isKycAgent = req.user.role === "kyc_team";
    const updateData = {
      status,
      rejectionReason: reason || null,
      reviewedAt: new Date(),
    };

    if (!isKycAgent) {
      updateData.reviewedBy = req.user.id;
    }

    if (currentStep !== undefined) {
      updateData.currentStep = currentStep;
    }

    await prisma.kycApplication.update({
      where: { applicationId: req.params.id },
      data: updateData,
    });

    if (status === "verified") {
      const user = await prisma.user.findUnique({ where: { id: app.userId } });
      if (user) {
        await prisma.$transaction(async (tx) => {
          const existingStamp = await tx.eStamp.findFirst({
            where: { assignedTo: user.id }
          });

          if (!existingStamp && !user.eStamp) {
            const availableStamp = await tx.eStamp.findFirst({
              where: { status: "available" },
              orderBy: { createdAt: "asc" }
            });

            if (availableStamp) {
              await tx.eStamp.update({
                where: { id: availableStamp.id },
                data: { status: "assigned", assignedTo: user.id }
              });
              await tx.user.update({
                where: { id: app.userId },
                data: { eStamp: availableStamp.certificateNo }
              });
            } else {
              console.warn(`[KYC Verification] No available E-Stamps for user ${user.id}`);
            }
          } else if (existingStamp && !user.eStamp) {
            await tx.user.update({
              where: { id: app.userId },
              data: { eStamp: existingStamp.certificateNo }
            });
          }
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: isKycAgent ? null : req.user.id,
        crmAgentId: isKycAgent ? req.user.id : null,
        crmAgentName: isKycAgent ? (req.user.email || `Agent ${req.user.id}`) : null,
        action: `kyc_${status}`,
        details: JSON.stringify({ applicationId: req.params.id, reason: reason || null, currentStep }),
        ipAddress: req.ip,
      },
    });

    // Notify client via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(req.params.id).emit("kyc_updated", { status, currentStep });
      io.to("staff_room").emit("applications_updated");
    }

    res.json({ success: true, message: `Application ${status}` });
  } catch (error) {
    next(error);
  }
};

const getStats = async (req, res, next) => {
  try {
    const daysParam = parseInt(req.query.days, 10) || 14;
    const chartDays = daysParam === 30 ? 30 : 14;

    const trendStartDate = new Date();
    trendStartDate.setDate(trendStartDate.getDate() - (chartDays - 1));
    trendStartDate.setHours(0, 0, 0, 0);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      total, statusCounts, recent, 
      recentAppsForTrend, allAppsForDropoff, recentLogs,
      verifiedThisWeekCount, verifiedLastWeekCount,
      rejectedThisWeekCount, rejectedLastWeekCount,
      globeApprovedCount, globeRejectedCount,
      pushedToBoCount, notPushedToBoCount
    ] = await Promise.all([
      prisma.kycApplication.count(),
      prisma.kycApplication.groupBy({
        by: ['status'],
        _count: { status: true }
      }),
      prisma.kycApplication.findMany({
        orderBy: { id: "desc" },
        take: 10,
        select: {
          id: true,
          applicationId: true,
          status: true,
          riskScore: true,
          personalDetails: true,
          user: { select: { email: true, phone: true } }
        }
      }),
      // For Trend Chart (14 or 30 days) and other analytics
      prisma.kycApplication.findMany({
        where: { 
          OR: [
            { createdAt: { gte: trendStartDate } },
            { updatedAt: { gte: trendStartDate } }
          ]
        },
        select: { 
          createdAt: true, 
          updatedAt: true, 
          submittedAt: true,
          deviceType: true,
          status: true, 
          rejectionReason: true, 
          reviewedBy: true, 
          reviewer: { select: { email: true, phone: true } }
        }
      }),
      // For Drop-off Funnel
      prisma.kycApplication.groupBy({
        by: ['currentStep'],
        _count: { currentStep: true }
      }),
      // For Live Activity
      prisma.auditLog.findMany({
        orderBy: { timestamp: "desc" },
        take: 6,
        include: { user: { select: { email: true, phone: true } } }
      }),
      // Trends for Verified
      prisma.kycApplication.count({
        where: { status: 'verified', updatedAt: { gte: sevenDaysAgo } }
      }),
      prisma.kycApplication.count({
        where: { status: 'verified', updatedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } }
      }),
      // Trends for Rejected
      prisma.kycApplication.count({
        where: { status: 'rejected', updatedAt: { gte: sevenDaysAgo } }
      }),
      prisma.kycApplication.count({
        where: { status: 'rejected', updatedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } }
      }),
      // Globe KPIs
      prisma.kycApplication.count({
        where: { globeStatus: 'approved' }
      }),
      prisma.kycApplication.count({
        where: { globeStatus: 'rejected' }
      }),
      prisma.kycApplication.count({
        where: { pushedToBackoffice: true }
      }),
      prisma.kycApplication.count({
        where: { status: 'verified', pushedToBackoffice: false }
      })
    ]);

    // Extract status counts
    let pending = 0, review = 0, verified = 0, rejected = 0, onHold = 0;
    statusCounts.forEach(s => {
      if (s.status === 'pending') pending = s._count.status;
      if (s.status === 'under_review') review = s._count.status;
      if (s.status === 'verified') verified = s._count.status;
      if (s.status === 'rejected') rejected = s._count.status;
      if (s.status === 'on_hold') onHold = s._count.status;
    });

    // 1. Calculate Chart Trend (14 or 30 days) & Other Stats
    const weeklyTrend = Array.from({ length: chartDays }, () => ({ submissions: 0, approvals: 0, rejections: 0 }));
    
    const rejectionReasonsMap = {};
    let totalProcessingTimeMs = 0;
    let processedCount = 0;
    
    let totalUserCompletionTimeMs = 0;
    let userCompletedCount = 0;
    const deviceStatsMap = {};

    const now = new Date();
    recentAppsForTrend.forEach(app => {
      // Trend: Submissions
      const diffDays = Math.floor((now - app.createdAt) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < chartDays) {
        weeklyTrend[(chartDays - 1) - diffDays].submissions++;
      }
      
      // User Completion Time
      if (app.submittedAt) {
         const timeToComplete = new Date(app.submittedAt).getTime() - new Date(app.createdAt).getTime();
         if (timeToComplete > 0) {
            totalUserCompletionTimeMs += timeToComplete;
            userCompletedCount++;
         }
      }

      // Device Stats
      if (app.deviceType) {
         const dt = app.deviceType.toLowerCase();
         let category = "Desktop";
         if (dt.includes("mobile") || dt.includes("android") || dt.includes("iphone") || dt.includes("ios") || dt.includes("webos") || dt.includes("blackberry")) category = "Mobile";
         else if (dt.includes("tablet") || dt.includes("ipad")) category = "Tablet";
         
         deviceStatsMap[category] = (deviceStatsMap[category] || 0) + 1;
      }

      if (app.status === 'verified' || app.status === 'rejected') {
        // Trend: Approvals & Rejections
        const updatedDiff = Math.floor((now - app.updatedAt) / (1000 * 60 * 60 * 24));
        if (updatedDiff >= 0 && updatedDiff < chartDays) {
          if (app.status === 'verified') weeklyTrend[(chartDays - 1) - updatedDiff].approvals++;
          if (app.status === 'rejected') weeklyTrend[(chartDays - 1) - updatedDiff].rejections++;
        }

        // Rejection Reasons
        if (app.status === 'rejected' && app.rejectionReason) {
          rejectionReasonsMap[app.rejectionReason] = (rejectionReasonsMap[app.rejectionReason] || 0) + 1;
        }

        // Avg Processing Time
        const timeToProcess = new Date(app.updatedAt).getTime() - new Date(app.createdAt).getTime();
        if (timeToProcess > 0) {
           totalProcessingTimeMs += timeToProcess;
           processedCount++;
        }
      }
    });

    const rejectionReasons = Object.entries(rejectionReasonsMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const deviceStats = Object.entries(deviceStatsMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    let averageProcessingTime = "N/A";
    if (processedCount > 0) {
       const avgMs = totalProcessingTimeMs / processedCount;
       const avgMins = Math.floor(avgMs / 60000);
       if (avgMins < 60) averageProcessingTime = `${avgMins} mins`;
       else {
           const hrs = Math.floor(avgMins / 60);
           const rem = avgMins % 60;
           averageProcessingTime = `${hrs}h ${rem}m`;
       }
    }

    let averageUserCompletionTime = "N/A";
    if (userCompletedCount > 0) {
       const avgMs = totalUserCompletionTimeMs / userCompletedCount;
       const avgMins = Math.floor(avgMs / 60000);
       if (avgMins < 60) averageUserCompletionTime = `${avgMins} mins`;
       else {
           const hrs = Math.floor(avgMins / 60);
           const rem = avgMins % 60;
           averageUserCompletionTime = `${hrs}h ${rem}m`;
       }
    }

    // 2. Calculate Drop-off Funnel
    let stepCounts = { setup: 0, identity: 0, personal: 0, docs: 0, esign: 0 };
    allAppsForDropoff.forEach(group => {
      const step = group.currentStep;
      const count = group._count.currentStep;
      if (step <= 3) stepCounts.setup += count;
      else if (step <= 5) stepCounts.identity += count;
      else if (step <= 10) stepCounts.personal += count;
      else if (step <= 12) stepCounts.docs += count;
      else stepCounts.esign += count;
    });

    const dropOff = total > 0 ? [
      { step: "Contact & Setup", rate: Math.round((stepCounts.setup / total) * 100) },
      { step: "Identity & Address", rate: Math.round((stepCounts.identity / total) * 100) },
      { step: "Personal & Bank", rate: Math.round((stepCounts.personal / total) * 100) },
      { step: "Documents & Selfie", rate: Math.round((stepCounts.docs / total) * 100) },
      { step: "eSign & Completion", rate: Math.round((stepCounts.esign / total) * 100) },
    ] : [
      { step: "Contact & Setup", rate: 0 },
      { step: "Identity & Address", rate: 0 },
      { step: "Personal & Bank", rate: 0 },
      { step: "Documents & Selfie", rate: 0 },
      { step: "eSign & Completion", rate: 0 },
    ];

    // 3. Format Live Activity
    const mapAction = (action) => {
      if (action.includes("verified")) return { name: "KYC Approved", color: "#30a46c" };
      if (action.includes("rejected")) return { name: "KYC Rejected", color: "#e5484d" };
      if (action.includes("submitted")) return { name: "KYC Submitted", color: "#0091ff" };
      if (action.includes("review")) return { name: "Moved to Review", color: "#ffb224" };
      if (action.includes("client_update")) return { name: "Backoffice Sync", color: "#8E4EC6" };
      if (action.includes("assigned")) return { name: "Agent Assigned", color: "#0091ff" };
      return { name: action.replace("kyc_", "").replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()), color: "#888" };
    };

    const formatTimeAgo = (date) => {
      const mins = Math.floor((now - date) / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs} hr${hrs !== 1 ? 's' : ''} ago`;
      return `${Math.floor(hrs / 24)} days ago`;
    };

    const liveActivity = recentLogs.map(log => {
      const actionDetails = mapAction(log.action);
      let userName = "System";
      if (log.user?.email) userName = log.user.email.split("@")[0];
      else if (log.user?.phone) userName = log.user.phone;
      else if (log.crmAgentName) userName = log.crmAgentName;

      return {
        action: actionDetails.name,
        user: userName,
        time: formatTimeAgo(log.timestamp),
        color: actionDetails.color
      };
    });

    // 4. Calculate Trends (Always 14-day vs 7-day trailing)
    let totalThisWeek = 0;
    let totalLastWeek = 0;
    
    // We need to count strictly 14 days ago for the WOW trends
    const recentAppsForTrendActual = await prisma.kycApplication.findMany({
      where: { createdAt: { gte: fourteenDaysAgo } },
      select: { createdAt: true }
    });

    recentAppsForTrendActual.forEach(app => {
      if (app.createdAt >= sevenDaysAgo) totalThisWeek++;
      else totalLastWeek++;
    });

    const calculateTrend = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const trends = {
      total: calculateTrend(totalThisWeek, totalLastWeek),
      verified: calculateTrend(verifiedThisWeekCount, verifiedLastWeekCount),
      rejected: calculateTrend(rejectedThisWeekCount, rejectedLastWeekCount)
    };

    res.json({ 
      success: true, 
      total, 
      pending, 
      review, 
      verified, 
      rejected, 
      onHold, 
      recent,
      weeklyTrend, 
      dropOff, 
      liveActivity, 
      trends,
      globeApprovedCount,
      globeRejectedCount,
      pushedToBoCount,
      notPushedToBoCount,
      rejectionReasons,
      averageProcessingTime,
      averageUserCompletionTime,
      deviceStats
    });
  } catch (error) {
    next(error);
  }
};

const getAuditLogs = async (req, res, next) => {
  const { page = 1, limit = 50, severity = "all", search = "", export: isExport } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const skip = (pageNum - 1) * take;

  try {
    const where = {};
    if (severity !== "all") {
      where.details = { path: ["severity"], string_contains: severity };
    }

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { action: { contains: q } },
        { user: { email: { contains: q } } },
        { user: { phone: { contains: q } } }
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        ...(isExport !== "true" && { take, skip }), // Don't paginate if exporting
        include: {
          user: {
            select: { id: true, email: true, phone: true, role: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    if (isExport === "true") {
      const csvLines = ["Log ID,Action,Actor,Target,IP Address,Severity,Timestamp"];
      logs.forEach(log => {
        let details = {};
        try { details = JSON.parse(log.details || "{}"); } catch(e) {}
        
        const logId = `LOG-${String(log.id).padStart(6, "0")}`;
        const action = `"${log.action || 'N/A'}"`;
        const actor = `"${log.user?.email || log.user?.phone || log.crmAgentName || 'System'}"`;
        const target = `"${details.applicationId || details.requestId || log.targetId || '-'}"`;
        const ip = `"${log.ipAddress || '-'}"`;
        const sev = `"${(details.severity || 'info').toLowerCase()}"`;
        const time = `"${new Date(log.timestamp).toLocaleString("en-IN")}"`;
        
        csvLines.push([logId, action, actor, target, ip, sev, time].join(","));
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      return res.send(csvLines.join("\n"));
    }

    res.json({
      success: true,
      logs,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    next(error);
  }
};

const deleteApplication = async (req, res, next) => {
  const { deleteUser = false } = req.query;
  const { id } = req.params;

  try {
    const app = await prisma.kycApplication.findUnique({
      where: { applicationId: id },
      include: { user: true }
    });

    if (!app) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    const userId = app.userId;

    if (deleteUser) {
      // Safety check: Don't let admin delete themselves
      if (userId === req.user.id) {
        return res.status(400).json({ success: false, error: "You cannot delete your own admin account" });
      }

      // Delete user (cascade will handle KycApplication and AuditLogs if configured, otherwise manual)
      // Prisma cascade is defined in schema if set, but we'll do it safely
      await prisma.$transaction([
        prisma.auditLog.deleteMany({ where: { userId } }),
        prisma.kycApplication.deleteMany({ where: { userId } }),
        prisma.user.delete({ where: { id: userId } })
      ]);
      
      const io = req.app.get("io");
      if (io) io.to("staff_room").emit("applications_updated");

      res.json({ success: true, message: "User and all related data deleted permanently" });
    } else {
      // Just delete the application
      await prisma.kycApplication.delete({
        where: { applicationId: id }
      });

      await writeAuditLog({
        userId: req.user.id,
        action: "kyc_deleted",
        details: { applicationId: id, userId },
        ipAddress: req.ip,
      });

      const io = req.app.get("io");
      if (io) io.to("staff_room").emit("applications_updated");

      res.json({ success: true, message: "KYC application deleted permanently" });
    }
  } catch (error) {
    next(error);
  }
};

async function writeAuditLog({ userId, action, details, ipAddress }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        details,
        ipAddress,
      },
    });
  } catch (error) {
    console.error("[AuditLog] Failed to persist log:", error.message);
  }
}

const getUsers = async (req, res, next) => {
  const { search = "", page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
  const skip = (pageNum - 1) * take;

  try {
    const where = {};
    if (search) {
      const q = String(search).trim();
      where.OR = [
        { email: { contains: q } },
        { phone: { contains: q } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: {
          kycApplications: {
            select: {
              applicationId: true,
              status: true,
              updatedAt: true
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      users,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    next(error);
  }
};


const getUserKycDetails = async (req, res, next) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ success: false, error: "Invalid user id" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        kycApplications: {
          orderBy: { updatedAt: "desc" }
        },
        auditLogs: {
          orderBy: { timestamp: "desc" },
          take: 100
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

const getRiskFraud = async (req, res, next) => {
  try {
    const highRisk = await prisma.kycApplication.findMany({
      where: {
        OR: [
          { faceMatchScore: { lt: 80 } },
          { status: "rejected" }
        ]
      },
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { email: true, phone: true } }
      }
    });

    res.json({ success: true, highRisk });
  } catch (error) {
    next(error);
  }
};

const getDocuments = async (req, res, next) => {
  try {
    const apps = await prisma.kycApplication.findMany({
      where: { documents: { not: null } },
      select: { applicationId: true, documents: true, user: { select: { email: true } } }
    });
    
    let allDocs = [];
    apps.forEach(app => {
      const docs = parseJsonField(app.documents, []);
      docs.forEach(d => {
        allDocs.push({ ...d, applicationId: app.applicationId, user: app.user?.email });
      });
    });

    res.json({ success: true, documents: allDocs });
  } catch (error) {
    next(error);
  }
};

const getFaceMatchLogs = async (req, res, next) => {
  try {
    const logs = await prisma.kycApplication.findMany({
      where: { faceMatchScore: { not: null } },
      select: { 
        applicationId: true, 
        faceMatchScore: true, 
        updatedAt: true,
        user: { select: { email: true } } 
      },
      orderBy: { updatedAt: "desc" }
    });
    res.json({ success: true, logs });
  } catch (error) {
    next(error);
  }
};


const refreshFromDigio = async (req, res, next) => {
  try {
    const rawId = String(req.params.id || "").trim();
    const app = await prisma.kycApplication.findFirst({ where: { OR: [{ applicationId: rawId }, { id: Number(rawId) || -1 }] } });
    if (!app) return res.status(404).json({ success: false, error: "Application not found" });

    const digio = app.ocrData?.digio || {};
    const candidates = ["SELFIE", "DIGILOCKER", "PAN_VERIFICATION"].map((k) => ({ type: k, requestId: digio?.[k]?.requestId })).filter((x) => x.requestId);
    if (!candidates.length) return res.status(400).json({ success: false, error: "No Digio request IDs found on this application" });

    const nextSelfieDetails = { ...(parseJsonField(app.selfieDetails, {})) };
    const nextOcrData = { ...(parseJsonField(app.ocrData, {})) };
    let nextFaceMatchScore = app.faceMatchScore;

    const findVal = (obj, keys) => {
      if (!obj || typeof obj !== "object") return null;
      for (const [k, v] of Object.entries(obj)) {
        if (keys.includes(k) && typeof v === "string" && v.trim()) return v;
        if (v && typeof v === "object") {
          const nested = findVal(v, keys);
          if (nested) return nested;
        }
      }
      return null;
    };

    for (const c of candidates) {
      let response;
      try { response = await digioClient.getKycRequestResponse(c.requestId); } catch (_) { continue; }
      nextOcrData.digio = nextOcrData.digio || {};
      nextOcrData.digio[c.type] = { ...(nextOcrData.digio[c.type] || {}), requestId: c.requestId, fetchedAt: new Date().toISOString(), status: response?.status || "fetched", response };

      const image = findVal(response, ["image_url", "imageUrl", "selfie_url", "selfieUrl", "photo", "preview"]);
      const video = findVal(response, ["video_url", "videoUrl", "recording_url", "recordingUrl", "videoPreview", "video"]);
      const geoAddress = findVal(response, ["address", "formatted_address", "location_address"]);
      const geoAccuracy = findVal(response, ["accuracy", "accuracy_in_meters", "accuracyMeters"]);
      const geoLat = findVal(response, ["latitude", "lat"]);
      const geoLng = findVal(response, ["longitude", "lng", "lon"]);
      const score = Number(findVal(response, ["face_match_score", "faceMatchScore", "score", "similarity"]));
      if (!Number.isNaN(score)) nextFaceMatchScore = score <= 1 ? Math.round(score * 100) : Math.round(score);

      if (c.type === "SELFIE" && image) nextSelfieDetails.preview = image;
      if (c.type === "SELFIE" && video) nextSelfieDetails.videoPath = video;
      if (c.type === "SELFIE" && (geoAddress || geoLat || geoLng)) {
        nextSelfieDetails.geo = { address: geoAddress || null, accuracy: geoAccuracy || null, latitude: geoLat || null, longitude: geoLng || null, provider: "digio", fetchedAt: new Date().toISOString() };
      }
    }

    await prisma.kycApplication.update({
      where: { id: app.id },
      data: {
        ocrData: nextOcrData,
        selfieDetails: nextSelfieDetails,
        ...(nextSelfieDetails.preview ? { selfie: nextSelfieDetails.preview } : {}),
        ...(nextFaceMatchScore !== null && nextFaceMatchScore !== undefined ? { faceMatchScore: nextFaceMatchScore } : {}),
      },
    });

    // Notify client via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(rawId).emit("kyc_updated", { action: "digio_refreshed" });
      io.to("staff_room").emit("applications_updated");
    }

    res.json({ success: true, message: "Digio data refreshed successfully" });
  } catch (error) {
    next(error);
  }
};

const sendToBackoffice = async (req, res, next) => {
  const rawId = String(req.params.id || "").trim();
  const numericId = Number(rawId);
  const { clientCode, clientType = "A" } = req.body || {};

  try {
    const app = await prisma.kycApplication.findFirst({
      where: {
        OR: [
          { applicationId: rawId },
          ...(Number.isInteger(numericId) && numericId > 0 ? [{ id: numericId }] : []),
        ],
      },
      include: { user: true },
    });

    if (!app) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    const resolvedClientCode = backofficeService.deriveClientCode(app, clientCode);
    if (!resolvedClientCode) {
      return res.status(400).json({ success: false, error: "clientCode is required because this application does not have a generated client id" });
    }

    let existingData = {};
    try {
      existingData = await backofficeService.fetchExistingClientDetail(resolvedClientCode, clientType);
    } catch (fetchError) {
      const status = fetchError.response?.status;
      if (status && status !== 404) {
        throw fetchError;
      }
      existingData = {};
    }

    const payload = backofficeService.buildModificationPayload(app, existingData, resolvedClientCode, clientType);
    const response = await backofficeService.submitClientModification(resolvedClientCode, payload);

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "backoffice_client_update",
        details: JSON.stringify({
          applicationId: app.applicationId,
          clientCode: resolvedClientCode,
          clientType,
          response,
        }),
        ipAddress: req.ip,
      },
    });

    res.json({ success: true, clientCode: resolvedClientCode, payload, response });
  } catch (error) {
    console.error("Backoffice submission failed:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || error.response?.data?.message || error.message || "Failed to send data to backoffice";
    res.status(status).json({ success: false, error: message, details: error.response?.data || null });
  }
};

const getCrmEmployees = async (req, res, next) => {
  try {
    const { role, department } = req.query;
    const employees = await crmService.getKycEmployees({ role, department });
    res.json({ success: true, employees });
  } catch (error) {
    next(error);
  }
};

const assignApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { crmAgentId, crmAgentName } = req.body;

    if (!crmAgentId) {
      return res.status(400).json({ success: false, error: "crmAgentId is required" });
    }

    const app = await prisma.kycApplication.findUnique({
      where: { applicationId: id },
    });

    if (!app) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    await prisma.kycApplication.update({
      where: { applicationId: id },
      data: { assignedCrmAgentId: Number(crmAgentId) },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id, // the admin who assigned it
        action: "assigned_to_agent",
        details: JSON.stringify({ applicationId: id, crmAgentId, crmAgentName }),
        ipAddress: req.ip,
      },
    });

    const io = req.app.get("io");
    if (io) {
      io.to(id).emit("kyc_updated", { action: "assigned_to_agent" });
      io.to("staff_room").emit("applications_updated");
    }

    res.json({ success: true, message: `Application assigned to ${crmAgentName || crmAgentId}` });
  } catch (error) {
    next(error);
  }
};

const updateUserEstamp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { eStamp } = req.body;
    
    if (!eStamp || typeof eStamp !== "string") {
      return res.status(400).json({ success: false, error: "Valid eStamp is required" });
    }

    // Check if duplicate eStamp exists
    const existing = await prisma.user.findUnique({ where: { eStamp } });
    if (existing && existing.id !== Number(id)) {
      return res.status(400).json({ success: false, error: "This E-Stamp is already assigned to another user" });
    }

    await prisma.user.update({
      where: { id: Number(id) },
      data: { eStamp }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "updated_estamp",
        details: JSON.stringify({ targetUserId: id, eStamp }),
        ipAddress: req.ip,
      },
    });

    res.json({ success: true, message: "E-Stamp updated successfully", eStamp });
  } catch (error) {
    next(error);
  }
};

const updateEstampSequence = async (req, res, next) => {
  try {
    const { nextSequenceValue } = req.body;
    
    if (typeof nextSequenceValue !== "number" || nextSequenceValue < 0) {
      return res.status(400).json({ success: false, error: "Valid numeric sequence value is required" });
    }

    const seq = await prisma.sequence.upsert({
      where: { name: 'eStamp' },
      update: { value: nextSequenceValue - 1 }, // we subtract 1 because generation increments it by 1
      create: { name: 'eStamp', value: nextSequenceValue - 1 }
    });

    res.json({ success: true, message: "E-Stamp sequence updated successfully" });
  } catch (error) {
    next(error);
  }
};

const updateApplicationDetails = async (req, res, next) => {
  const { id } = req.params;
  const { updates, requireEsign } = req.body;
  const agentId = req.user.id;
  const agentName = req.user.email || `Agent ${agentId}`;

  try {
    const app = await prisma.kycApplication.findUnique({
      where: { applicationId: id },
      include: { user: { include: { eStampAssigned: true } } },
    });

    if (!app) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: "No updates provided" });
    }

    // Process updates
    const nextData = {};
    for (const [keyPath, value] of Object.entries(updates)) {
      const parts = keyPath.split(".");
      const topKey = parts[0];
      
      if (topKey === "user" && parts[1] === "eStampAssigned" && parts[2]) {
        nextData.eStampAssigned = nextData.eStampAssigned || {};
        nextData.eStampAssigned[parts[2]] = value;
        continue;
      }

      if (!JSON_FIELD_KEYS.includes(topKey)) continue;

      if (!nextData[topKey]) {
        nextData[topKey] = { ...parseJsonField(app[topKey], {}) };
      }

      let current = nextData[topKey];
      for (let i = 1; i < parts.length - 1; i++) {
        const p = parts[i];
        if (!current[p] || typeof current[p] !== "object") {
          current[p] = {};
        }
        current = current[p];
      }
      current[parts[parts.length - 1]] = value;
    }

    // Convert updated objects to JSON strings
    const updatePayload = {};
    for (const [topKey, value] of Object.entries(nextData)) {
      if (topKey === "eStampAssigned") continue;
      updatePayload[topKey] = JSON.stringify(value);
    }

    if (nextData.eStampAssigned && app.user?.eStampAssigned?.id) {
       await prisma.eStamp.update({
         where: { id: app.user.eStampAssigned.id },
         data: {
           certificateNo: nextData.eStampAssigned.certificateNo,
           serialNo: nextData.eStampAssigned.serialNo
         }
       });
    }

    if (requireEsign) {
      // We force re-sign
      updatePayload.currentStep = 12; // eSign preview
      updatePayload.status = "pending";
      updatePayload.isResubmitted = false;
    }

    await prisma.kycApplication.update({
      where: { applicationId: id },
      data: updatePayload,
    });

    if (requireEsign) {
      // Send email
      const personalDetails = { ...parseJsonField(app.personalDetails, {}), ...(nextData.personalDetails || {}) };
      const userName = personalDetails.fullName || app.user?.email || app.user?.phone || "User";
      const userEmail = personalDetails.email || app.user?.email;

      if (userEmail) {
        const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || "http://localhost:3000";
        const modifyLink = `${frontendUrl}/`;
        const { sendRejectionEmail } = require("../services/emailService");
        try {
          await sendRejectionEmail(
            userEmail,
            userName,
            [{ stepTitle: "Admin Modifications", reason: "Your details were updated by an admin. Please review the changes and re-sign your application to proceed." }],
            modifyLink
          );
        } catch (emailError) {
          console.error("Email sending failed:", emailError.message);
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.role !== "admin" ? null : req.user.id,
        crmAgentId: req.user.role === "admin" ? null : agentId,
        crmAgentName: agentName,
        action: "kyc_admin_updated_details",
        details: JSON.stringify({ applicationId: id, updates }),
        ipAddress: req.ip,
      },
    });

    const io = req.app.get("io");
    if (io) {
      io.to(id).emit("kyc_updated", { action: "admin_updated_details" });
      io.to("staff_room").emit("applications_updated");
    }

    res.json({ success: true, message: "Details updated and re-signing requested" });
  } catch (error) {
    next(error);
  }
};

const generateUserToken = async (req, res, next) => {
  try {
    const { id } = req.params;
    const app = await prisma.kycApplication.findUnique({
      where: { applicationId: id },
      include: { user: true }
    });
    if (!app || !app.user) {
      return res.status(404).json({ success: false, error: "Application or User not found" });
    }
    const jwt = require("jsonwebtoken");
    const JWT_SECRET = process.env.JWT_SECRET || "kyc-secret-key-change-in-production";
    const token = jwt.sign(
      { id: app.user.id, phone: app.user.phone, role: app.user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.json({ success: true, token });
  } catch (error) {
    next(error);
  }
};

const uploadAdminDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { documentType } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const app = await prisma.kycApplication.findUnique({ where: { applicationId: id } });
    if (!app) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    const filePath = `/uploads/${req.file.filename}`;
    const updatePayload = {};

    // Map the documentType (label from UI) to the correct DB JSON field
    if (documentType.includes("Aadhaar Document") || documentType.includes("Aadhaar Image")) {
      const documents = parseJsonField(app.documents, {});
      documents.front = filePath;
      documents.frontPreview = filePath;
      updatePayload.documents = JSON.stringify(documents);
    } else if (documentType.includes("PAN")) {
      const panUpload = parseJsonField(app.panUpload, {});
      panUpload.path = filePath;
      panUpload.filePreview = filePath;
      updatePayload.panUpload = JSON.stringify(panUpload);
    } else if (documentType.includes("Selfie")) {
      const selfieDetails = parseJsonField(app.selfieDetails, {});
      selfieDetails.path = filePath;
      selfieDetails.preview = filePath;
      updatePayload.selfieDetails = JSON.stringify(selfieDetails);
    } else if (documentType.includes("Signature")) {
      const signature = parseJsonField(app.signature, {});
      signature.path = filePath;
      signature.filePreview = filePath;
      updatePayload.signature = JSON.stringify(signature);
    } else if (documentType.includes("Bank")) {
      const bankDetails = parseJsonField(app.bankDetails, {});
      bankDetails.proofPath = filePath;
      bankDetails.proofPreview = filePath;
      updatePayload.bankDetails = JSON.stringify(bankDetails);
    } else if (documentType.includes("F&O") || documentType.includes("Financial")) {
      const financialProof = parseJsonField(app.financialProof, {});
      financialProof.path = filePath;
      financialProof.filePreview = filePath;
      updatePayload.financialProof = JSON.stringify(financialProof);
    } else if (documentType.includes("PEP")) {
      const personalDetails = parseJsonField(app.personalDetails, {});
      personalDetails.pepProof = filePath;
      personalDetails.pepProofPreview = filePath;
      updatePayload.personalDetails = JSON.stringify(personalDetails);
    } else if (documentType.includes("Nominee")) {
      const nomineeDetails = parseJsonField(app.nomineeDetails, {});
      if (Array.isArray(nomineeDetails.nominees)) {
        // Just apply to the first nominee for simplicity unless a specific index is parsed
        if (documentType.includes("Guardian")) {
           nomineeDetails.nominees[0].guardianProofPath = filePath;
        } else {
           nomineeDetails.nominees[0].proofPath = filePath;
        }
      }
      updatePayload.nomineeDetails = JSON.stringify(nomineeDetails);
    }

    if (Object.keys(updatePayload).length > 0) {
      await prisma.kycApplication.update({
        where: { applicationId: id },
        data: updatePayload,
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user.role !== "admin" ? null : req.user.id,
          crmAgentId: req.user.role === "admin" ? null : req.user.id,
          crmAgentName: req.user.email || "Admin",
          action: "kyc_admin_uploaded_document",
          details: JSON.stringify({ applicationId: id, documentType, filePath }),
          ipAddress: req.ip,
        },
      });

      const io = req.app.get("io");
      if (io) {
        io.to(id).emit("kyc_updated", { action: "admin_uploaded_document" });
        io.to("staff_room").emit("applications_updated");
      }
    }

    res.json({ success: true, message: "Document uploaded and replaced successfully", filePath });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getApplications,
  getApplicationById,
  reviewApplication,
  deleteApplication,
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
  generateUserToken,
  assignApplication,
  updateUserEstamp,
  updateEstampSequence,
  updateApplicationDetails,
  uploadAdminDocument
};
