const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const backofficeService = require("../services/backofficeService");

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

      const whereClause = { status: "verified" };
      if (globeStatus && globeStatus !== "all") {
        whereClause.globeStatus = globeStatus;
      }
      if (stage && stage !== "all" && !isNaN(parseInt(stage))) {
        whereClause.currentStep = parseInt(stage);
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

        whereClause.OR = searchConditions;
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
        data: applications,
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

      await prisma.auditLog.create({
        data: {
          action: "GLOBE_APPROVED_KYC",
          details: JSON.stringify({ message: `KYC Application ${application.applicationId} approved by Globe user` }),
          targetId: id.toString(),
          targetType: "KycApplication",
          userId: userId,
          ipAddress: req.ip || req.connection.remoteAddress,
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

      let application;
      if (!isNaN(parseInt(id)) && parseInt(id).toString() === id.toString()) {
        application = await prisma.kycApplication.update({
          where: { id: parseInt(id) },
          data: {
            globeStatus: "rejected",
            globeRemarks: remarks,
            globeReviewedAt: new Date(),
            globeReviewedBy: userId,
          },
        });
      } else {
        application = await prisma.kycApplication.update({
          where: { applicationId: id },
          data: {
            globeStatus: "rejected",
            globeRemarks: remarks,
            globeReviewedAt: new Date(),
            globeReviewedBy: userId,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          action: "GLOBE_REJECTED_KYC",
          details: JSON.stringify({ message: `KYC Application ${application.applicationId} rejected by Globe user. Reason: ${remarks}` }),
          targetId: id.toString(),
          targetType: "KycApplication",
          userId: userId,
          ipAddress: req.ip || req.connection.remoteAddress,
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

      // Check if client code exists (via NSDL response or app ID)
      const clientCode = backofficeService.deriveClientCode(application);
      
      let existingData = {};
      try {
        // Fetch existing data if needed, or send empty
        // existingData = await backofficeService.fetchExistingClientDetail(clientCode);
      } catch (err) {
        console.warn("Could not fetch existing data, continuing with empty context", err.message);
      }

      const payload = backofficeService.buildModificationPayload(application, existingData, clientCode);

      // Make the actual push
      const response = await backofficeService.submitClientModification(clientCode, payload);

      // Check success response based on their API standard (assuming status is success or similar)
      // Usually checking if no error thrown is a good start, but some APIs return 200 with error details.
      
      const updatedApplication = await prisma.kycApplication.update({
        where: { id: parseInt(id) },
        data: {
          pushedToBackoffice: true,
          pushedToBackofficeAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          action: "GLOBE_PUSHED_BACKOFFICE",
          details: `KYC Application ${application.applicationId} pushed to Backoffice`,
          targetId: id.toString(),
          targetType: "KycApplication",
          userId: userId,
          ipAddress: req.ip || req.connection.remoteAddress,
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

      const application = await prisma.kycApplication.update({
        where: queryId,
        data: {
          globeStatus,
          globeRemarks: remarks || null,
          globeReviewedAt: new Date(),
          globeReviewedBy: userId,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: `GLOBE_STATUS_${globeStatus.toUpperCase()}`,
          details: JSON.stringify({ message: `KYC Application ${application.applicationId} globe status updated to ${globeStatus}${remarks ? '. Reason: ' + remarks : ''}` }),
          targetId: id.toString(),
          targetType: "KycApplication",
          userId: userId,
          ipAddress: req.ip || req.connection.remoteAddress,
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
