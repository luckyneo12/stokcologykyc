const prisma = require("../config/db");
const bcrypt = require("bcryptjs");
const { z } = require("zod");

const parseJsonField = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

/**
 * GET /api/ap/dashboard
 * Returns dashboard stats for the logged-in AP.
 */
const getApDashboard = async (req, res, next) => {
  try {
    const apId = Number(req.user.id);
    const apCode = `AP${apId}`;

    // Get all users referred by this AP
    const users = await prisma.user.findMany({
      where: { apCode },
      select: {
        id: true,
        kycApplications: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: {
            status: true,
            currentStep: true,
            globeStatus: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    const totalUsers = users.length;

    // Categorize by admin status
    let adminPending = 0;
    let adminApproved = 0;
    let adminRejected = 0;
    let adminUnderReview = 0;

    // Categorize by globe status
    let globePending = 0;
    let globeApproved = 0;
    let globeRejected = 0;

    // Categorize by KYC step stages
    const stageBreakdown = {
      notStarted: 0,    // step 0
      inProgress: 0,    // step 1-16
      submitted: 0,     // step >= 17
    };

    for (const user of users) {
      const app = user.kycApplications?.[0];
      if (!app) {
        stageBreakdown.notStarted++;
        adminPending++;
        globePending++;
        continue;
      }

      // Admin status
      const st = app.status || "pending";
      if (st === "verified") adminApproved++;
      else if (st === "rejected") adminRejected++;
      else if (st === "under_review") adminUnderReview++;
      else adminPending++;

      // Globe status
      const gs = app.globeStatus || "pending";
      if (gs === "approved") globeApproved++;
      else if (gs === "rejected") globeRejected++;
      else globePending++;

      // Stage
      const step = app.currentStep || 0;
      if (step === 0) stageBreakdown.notStarted++;
      else if (step >= 14) stageBreakdown.submitted++;
      else stageBreakdown.inProgress++;
    }

    res.json({
      success: true,
      apCode,
      totalUsers,
      adminActions: {
        pending: adminPending,
        underReview: adminUnderReview,
        approved: adminApproved,
        rejected: adminRejected,
      },
      globeActions: {
        pending: globePending,
        approved: globeApproved,
        rejected: globeRejected,
      },
      stageBreakdown,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ap/users
 * Returns paginated list of users referred by this AP.
 */
const getApUsers = async (req, res, next) => {
  try {
    const apId = Number(req.user.id);
    const apCode = `AP${apId}`;
    const { page = 1, limit = 15, search = "" } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(limit, 10) || 15, 1), 200);
    const skip = (pageNum - 1) * take;

    const where = { apCode };

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { phone: { contains: q } },
        { email: { contains: q } },
      ];
    }

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
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: {
              applicationId: true,
              currentStep: true,
              status: true,
              globeStatus: true,
              updatedAt: true,
              createdAt: true,
              personalDetails: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const formattedUsers = users.map(u => {
      let email = u.email;
      let name = "—";
      let applicationId = "—";
      let lastUpdated = u.createdAt;

      const app = u.kycApplications?.[0];
      if (app) {
        applicationId = app.applicationId || "—";
        lastUpdated = app.updatedAt || u.createdAt;
        if (app.personalDetails) {
          try {
            const pd = JSON.parse(app.personalDetails);
            if (pd.email && !email) email = pd.email;
            if (pd.name) name = pd.name;
            else if (pd.fullName) name = pd.fullName;
          } catch (e) {}
        }
        delete app.personalDetails;
      }
      return { ...u, email, name, applicationId, lastUpdated };
    });

    res.json({
      success: true,
      users: formattedUsers,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / take),
      apCode,
    });
  } catch (error) {
    next(error);
  }
};

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(6, "Password must be at least 6 characters")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

/**
 * POST /api/ap/change-password
 * Allows AP to change their own password.
 */
const changeApPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const userId = Number(req.user.id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, email: true },
    });

    if (!user || !user.password) {
      return res.status(400).json({ error: "User not found" });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "New password must be different from current password" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "AP_PASSWORD_CHANGED",
        details: JSON.stringify({ message: `AP (${user.email}) changed their password` }),
        targetId: userId.toString(),
        targetType: "APUser",
        ipAddress: req.ip || req.connection?.remoteAddress,
      },
    }).catch(err => console.error("[AuditLog Error]", err.message));

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = { getApDashboard, getApUsers, changeApPassword };
