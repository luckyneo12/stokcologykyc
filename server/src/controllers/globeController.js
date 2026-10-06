const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const backofficeService = require("../services/backofficeService");
const { attachDecisionTimestamps } = require("../utils/decisionTimestamps");
const { annotateRejectedBy } = require("../utils/rejectedBy");
const { isRejectable, NOT_REJECTABLE_ERROR } = require("../utils/rejectionGuard");
const { parseStepStatuses, getPendingDocRejections, getRejectionMailState, clearPendingDocStatusFlip } = require("../utils/rejectionMail");

// Document rejections marked but not yet mailed — the application can't be approved while they exist
const hasPendingDocRejections = async (where) => {
  const app = await prisma.kycApplication.findUnique({ where, select: { stepStatuses: true } });
  return Object.keys(getPendingDocRejections(parseStepStatuses(app?.stepStatuses))).length > 0;
};
const PENDING_DOC_APPROVE_ERROR = "Cannot approve: some documents are marked as rejected. Remove those rejections or send the rejection mail first.";

class GlobeController {
  async getDashboardKPIs(req, res) {
    try {
      // 1. Total KYC (Verified by Admin)
      const totalKyc = await prisma.kycApplication.count({
        where: { status: "verified" },
      });

      // 2. Approved by Globe
      const approvedByGlobe = await prisma.kycApplication.count({
        where: { globeStatus: "approved" },
      });

      // 3. Rejected by Globe
      const rejectedByGlobe = await prisma.kycApplication.count({
        where: { globeStatus: "rejected" },
      });

      // 4. Pushed to Backoffice
      const pushedToBackoffice = await prisma.kycApplication.count({
        where: { pushedToBackoffice: true },
      });

      // 5. Calculate Status Distribution for Pie Chart
      const pendingByGlobe = totalKyc - (approvedByGlobe + rejectedByGlobe);

      // 6. Calculate daily activity for last 7 days for Area Chart
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentActivity = await prisma.kycApplication.findMany({
        where: {
          globeReviewedAt: { gte: sevenDaysAgo },
          globeStatus: { in: ['approved', 'rejected'] }
        },
        select: {
          globeStatus: true,
          globeReviewedAt: true
        }
      });
      
      const activityMap = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0].substring(5); // e.g. "07-06"
        activityMap[dateStr] = { date: dateStr, approvals: 0, rejections: 0 };
      }
      
      recentActivity.forEach(app => {
        if (app.globeReviewedAt) {
          const dateStr = app.globeReviewedAt.toISOString().split('T')[0].substring(5);
          if (activityMap[dateStr]) {
            if (app.globeStatus === 'approved') activityMap[dateStr].approvals++;
            if (app.globeStatus === 'rejected') activityMap[dateStr].rejections++;
          }
        }
      });

      // 7. Average Turnaround Time (TAT)
      const reviewedApps = await prisma.kycApplication.findMany({
        where: { globeReviewedAt: { not: null } },
        select: { createdAt: true, globeReviewedAt: true }
      });
      let totalTatHours = 0;
      reviewedApps.forEach(app => {
        const diffMs = new Date(app.globeReviewedAt) - new Date(app.createdAt);
        totalTatHours += diffMs / (1000 * 60 * 60);
      });
      const avgTatHours = reviewedApps.length > 0 ? (totalTatHours / reviewedApps.length).toFixed(1) : 0;

      // 8. Aging Report (Pending Age)
      const pendingApps = await prisma.kycApplication.findMany({
        where: { status: "verified", globeStatus: "pending" },
        select: { createdAt: true }
      });
      
      let aging = { "< 24h": 0, "24-48h": 0, "> 48h": 0 };
      const now = new Date();
      pendingApps.forEach(app => {
        const diffMs = now - new Date(app.createdAt);
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours < 24) aging["< 24h"]++;
        else if (diffHours < 48) aging["24-48h"]++;
        else aging["> 48h"]++;
      });
      const agingChart = [
        { name: "< 24h", value: aging["< 24h"] },
        { name: "24-48h", value: aging["24-48h"] },
        { name: "> 48h", value: aging["> 48h"] }
      ];

      // 9. Rejection Reasons Breakdown
      const rejectedApps = await prisma.kycApplication.findMany({
        where: { globeStatus: "rejected", globeRemarks: { not: null } },
        select: { globeRemarks: true }
      });
      
      const reasonsMap = {};
      rejectedApps.forEach(app => {
        // Group by exact remark (or first 20 chars if it's too long)
        let remark = app.globeRemarks.substring(0, 25).trim();
        if (app.globeRemarks.length > 25) remark += "...";
        reasonsMap[remark] = (reasonsMap[remark] || 0) + 1;
      });
      const reasonsChart = Object.keys(reasonsMap)
        .map(key => ({ name: key, value: reasonsMap[key] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5); // top 5

      res.status(200).json({
        success: true,
        data: {
          totalKyc,
          approvedByGlobe,
          rejectedByGlobe,
          pushedToBackoffice,
          avgTatHours,
          statusDistribution: [
            { name: "Pending", value: Math.max(0, pendingByGlobe) },
            { name: "Approved", value: approvedByGlobe },
            { name: "Rejected", value: rejectedByGlobe }
          ],
          activityChart: Object.values(activityMap),
          agingChart,
          reasonsChart
        },
      });
    } catch (error) {
      console.error("Error in getDashboardKPIs:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  async getPendingKYCs(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const globeStatus = req.query.globeStatus;
      const stage = req.query.stage;
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      const whereClause = {};
      if (globeStatus === "in_progress" || globeStatus === "pending") {
        // Globe "In Progress": verified by STK, but no action taken on the Globe portal yet
        whereClause.status = "verified";
        whereClause.globeStatus = "pending";
      } else if (globeStatus === "verify") {
        // Awaiting Globe's decision: STK-verified, eSign done, Globe status still pending.
        // Pushing to back office is done by admin, so it doesn't affect what Globe sees.
        whereClause.currentStep = { gte: 14 };
        whereClause.status = "verified";
        whereClause.globeStatus = "pending";
      } else if (globeStatus === "completed" || globeStatus === "approved") {
        // Approved by Globe (STK-verified)
        whereClause.status = "verified";
        whereClause.globeStatus = "approved";
      } else if (globeStatus && globeStatus !== "all") {
        // e.g. "rejected": rejected on the Globe portal (Reject button, module/document reject or rejection mail)
        whereClause.globeStatus = globeStatus;
        whereClause.status = "verified";
      } else {
        // All: Globe only ever sees applications verified by STK — if STK later changes that, they drop out
        whereClause.status = "verified";
      }
      if (stage && stage !== "all" && !isNaN(parseInt(stage))) {
        whereClause.currentStep = parseInt(stage);
      }

      if (startDate || endDate) {
        whereClause.updatedAt = {};
        if (startDate) {
          whereClause.updatedAt.gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          whereClause.updatedAt.lte = end;
        }
      }

      const search = req.query.search ? String(req.query.search).trim() : "";
      if (search) {
        const terms = Array.from(new Set([
          search,
          search.toLowerCase(),
          search.toUpperCase(),
          search.charAt(0).toUpperCase() + search.slice(1).toLowerCase()
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

        if (!isNaN(parseInt(search, 10)) && String(parseInt(search, 10)) === search) {
          searchConditions.push({ userId: parseInt(search, 10) });
        }

        if (whereClause.OR) {
          // Keep the filter's own OR (e.g. "All") and the search — both must match
          whereClause.AND = [{ OR: whereClause.OR }, { OR: searchConditions }];
          delete whereClause.OR;
        } else {
          whereClause.OR = searchConditions;
        }
      }

      console.log(`[Globe API] fetching getPendingKYCs. globeStatus=${globeStatus}, search=${search}`);
      console.log(`[Globe API] whereClause:`, JSON.stringify(whereClause, null, 2));

      const [applications, total] = await Promise.all([
        prisma.kycApplication.findMany({
          where: whereClause,
          include: {
            user: {
              select: {
                phone: true,
                email: true,
                eStamp: true,
                boid: true,
                boidAssigned: { select: { boidNumber: true } },
                eStampAssigned: { select: { serialNo: true, certificateNo: true } }
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.kycApplication.count({
          where: whereClause,
        }),
      ]);

      res.status(200).json({
        success: true,
        // rejectionMail.mailPending → "Mail not sent" tag on rejected applications
        data: await attachDecisionTimestamps(await annotateRejectedBy(applications.map((app) => ({ ...app, rejectionMail: getRejectionMailState(app) })))),
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page,
          limit,
        },
      });
    } catch (error) {
      console.error("Error in getPendingKYCs:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  async approveKYC(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const approveWhere = !isNaN(parseInt(id)) && parseInt(id).toString() === id.toString() ? { id: parseInt(id) } : { applicationId: id };
      if (await hasPendingDocRejections(approveWhere)) {
        return res.status(400).json({ success: false, message: PENDING_DOC_APPROVE_ERROR });
      }
      await clearPendingDocStatusFlip(prisma, approveWhere, "Globe");

      let application;
      if (!isNaN(parseInt(id)) && parseInt(id).toString() === id.toString()) {
        application = await prisma.kycApplication.update({
          where: { id: parseInt(id) },
          data: {
            globeStatus: "approved",
            globeReviewedAt: new Date(),
            globeReviewedBy: userId,
          },
        });
      } else {
        application = await prisma.kycApplication.update({
          where: { applicationId: id },
          data: {
            globeStatus: "approved",
            globeReviewedAt: new Date(),
            globeReviewedBy: userId,
          },
        });
      }

      const globeUserEmail = req.user.email || `Globe User ${userId}`;
      await prisma.auditLog.create({
        data: {
          action: "GLOBE_APPROVED_KYC",
          details: JSON.stringify({ 
            message: `Globe reviewer (${globeUserEmail}) approved application ${application.applicationId}`,
            applicationId: application.applicationId,
            globeStatus: "approved",
            actor: globeUserEmail
          }),
          targetId: String(application.applicationId || id),
          targetType: "KycApplication",
          userId: userId,
          ipAddress: req.ip || req.connection?.remoteAddress,
        },
      });

      res.status(200).json({ success: true, data: application });
    } catch (error) {
      console.error("Error in approveKYC:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  async rejectKYC(req, res) {
    try {
      const { id } = req.params;
      const { remarks } = req.body;
      const userId = req.user.id;

      if (!remarks) {
        return res.status(400).json({ success: false, message: "Remarks are required for rejection" });
      }

      const queryId = !isNaN(parseInt(id)) && parseInt(id).toString() === id.toString()
        ? { id: parseInt(id) }
        : { applicationId: id };

      const existing = await prisma.kycApplication.findUnique({ where: queryId, select: { currentStep: true } });
      if (!existing) {
        return res.status(404).json({ success: false, message: "Application not found" });
      }
      if (!isRejectable(existing)) {
        return res.status(400).json({ success: false, message: NOT_REJECTABLE_ERROR });
      }
      await clearPendingDocStatusFlip(prisma, queryId, "Globe");

      const application = await prisma.kycApplication.update({
        where: queryId,
        data: {
          globeStatus: "rejected",
          globeRemarks: remarks,
          globeReviewedAt: new Date(),
          globeReviewedBy: userId,
        },
      });

      const globeUserEmail = req.user.email || `Globe User ${userId}`;
      await prisma.auditLog.create({
        data: {
          action: "GLOBE_REJECTED_KYC",
          details: JSON.stringify({ 
            message: `Globe reviewer (${globeUserEmail}) rejected application ${application.applicationId}. Reason: ${remarks}`,
            applicationId: application.applicationId,
            reason: remarks,
            globeStatus: "rejected",
            actor: globeUserEmail
          }),
          targetId: String(application.applicationId || id),
          targetType: "KycApplication",
          userId: userId,
          ipAddress: req.ip || req.connection?.remoteAddress,
        },
      });

      res.status(200).json({ success: true, data: application });
    } catch (error) {
      console.error("Error in rejectKYC:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  async pushToBackoffice(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const application = await prisma.kycApplication.findUnique({
        where: { id: parseInt(id) },
        include: {
          user: true,
        },
      });

      if (!application) {
        return res.status(404).json({ success: false, message: "Application not found" });
      }

      if (application.globeStatus !== "approved") {
        return res.status(400).json({ success: false, message: "Only approved applications can be pushed to backoffice" });
      }

      const clientCode = backofficeService.deriveClientCode(application);
      
      let existingData = {};
      try {
      } catch (err) {
        console.warn("Could not fetch existing data, continuing with empty context", err.message);
      }

      const payload = backofficeService.buildModificationPayload(application, existingData, clientCode);
      const response = await backofficeService.submitClientModification(clientCode, payload);
      
      const updatedApplication = await prisma.kycApplication.update({
        where: { id: parseInt(id) },
        data: {
          pushedToBackoffice: true,
          pushedToBackofficeAt: new Date(),
        },
      });

      const globeUserEmail = req.user.email || `Globe User ${userId}`;
      await prisma.auditLog.create({
        data: {
          action: "GLOBE_PUSHED_BACKOFFICE",
          details: JSON.stringify({
            message: `Globe reviewer (${globeUserEmail}) pushed application ${application.applicationId} to Backoffice`,
            applicationId: application.applicationId,
            clientCode,
            actor: globeUserEmail
          }),
          targetId: String(application.applicationId || id),
          targetType: "KycApplication",
          userId: userId,
          ipAddress: req.ip || req.connection?.remoteAddress,
        },
      });

      res.status(200).json({ success: true, data: updatedApplication, backofficeResponse: response });
    } catch (error) {
      console.error("Error in pushToBackoffice:", error);
      res.status(500).json({ success: false, message: "Internal server error pushing to backoffice" });
    }
  }

  async updateGlobeStatus(req, res) {
    try {
      const { id } = req.params;
      const { globeStatus, remarks } = req.body;
      const userId = req.user.id;

      if (!['pending', 'approved', 'rejected'].includes(globeStatus)) {
        return res.status(400).json({ success: false, message: "Invalid globe status" });
      }

      let queryId = {};
      if (!isNaN(parseInt(id)) && parseInt(id).toString() === id.toString()) {
        queryId = { id: parseInt(id) };
      } else {
        queryId = { applicationId: id };
      }

      if (globeStatus === "rejected") {
        const existing = await prisma.kycApplication.findUnique({ where: queryId, select: { currentStep: true } });
        if (!existing) {
          return res.status(404).json({ success: false, message: "Application not found" });
        }
        if (!isRejectable(existing)) {
          return res.status(400).json({ success: false, message: NOT_REJECTABLE_ERROR });
        }
      }
      if (globeStatus === "approved" && await hasPendingDocRejections(queryId)) {
        return res.status(400).json({ success: false, message: PENDING_DOC_APPROVE_ERROR });
      }
      await clearPendingDocStatusFlip(prisma, queryId, "Globe");

      const application = await prisma.kycApplication.update({
        where: queryId,
        data: {
          globeStatus,
          globeRemarks: remarks || null,
          globeReviewedAt: new Date(),
          globeReviewedBy: userId,
        },
      });

      const globeUserEmail = req.user.email || `Globe User ${userId}`;
      await prisma.auditLog.create({
        data: {
          action: `GLOBE_STATUS_${globeStatus.toUpperCase()}`,
          details: JSON.stringify({ 
            message: `Globe reviewer (${globeUserEmail}) updated status of application ${application.applicationId} to ${globeStatus}${remarks ? '. Reason: ' + remarks : ''}`,
            applicationId: application.applicationId,
            globeStatus,
            remarks: remarks || null,
            actor: globeUserEmail
          }),
          targetId: String(application.applicationId || id),
          targetType: "KycApplication",
          userId: userId,
          ipAddress: req.ip || req.connection?.remoteAddress,
        },
      });

      const io = req.app.get("io");
      if (io) {
        io.to("staff_room").emit("applications_updated");
      }

      res.status(200).json({ success: true, data: application });
    } catch (error) {
      console.error("Error in updateGlobeStatus:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }
}

module.exports = new GlobeController();
