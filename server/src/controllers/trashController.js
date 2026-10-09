// Trash for KYC applications (admin + Globe portals).
// "Delete" moves an application here; from here it can be restored or deleted permanently.
// Uses the unfiltered client — the shared one (config/db.js) hides trashed applications.
const prisma = require("../config/prismaBase");
const { TRASH_STATUS, TRASH_KEY } = require("../utils/trashStatus");
const { getApplicationById } = require("./adminController");

const parseJson = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
};

const actorOf = (req) => ({
  id: req.user?.id ?? null,
  name: req.user?.name || req.user?.fullName || req.user?.email || req.user?.phone || null,
  role: req.user?.role || null,
});

const notify = (req, applicationId) => {
  const io = req.app.get("io");
  if (!io) return;
  io.to("staff_room").emit("applications_updated");
  if (applicationId) io.to(applicationId).emit("kyc_updated");
};

async function writeTrashAudit(req, action, applicationId, details = {}) {
  try {
    const actor = actorOf(req);
    // KYC-team ids belong to the CRM database, not the local users table
    const isCrmAgent = actor.role === "kyc_team";
    await prisma.auditLog.create({
      data: {
        userId: isCrmAgent ? null : actor.id,
        crmAgentId: isCrmAgent ? Number(actor.id) || null : null,
        crmAgentName: isCrmAgent ? actor.name : null,
        action,
        details: JSON.stringify({ applicationId, by: actor.name, role: actor.role, ...details }),
        targetId: String(applicationId),
        targetType: "KycApplication",
        ipAddress: req.ip,
      },
    });
  } catch (error) {
    console.error(`[Trash] Audit log failed (${action}):`, error.message);
  }
}

/** DELETE /application/:id — moves the application to the Trash (nothing is removed). */
const moveToTrash = async (req, res, next) => {
  try {
    const { id } = req.params;
    const app = await prisma.kycApplication.findUnique({ where: { applicationId: id } });
    if (!app) return res.status(404).json({ success: false, error: "Application not found" });
    if (app.status === TRASH_STATUS) {
      return res.status(409).json({ success: false, error: "This application is already in the Trash" });
    }

    const actor = actorOf(req);
    const statuses = parseJson(app.stepStatuses, {}) || {};
    statuses[TRASH_KEY] = {
      previousStatus: app.status,
      deletedAt: new Date().toISOString(),
      deletedBy: actor.name,
      deletedById: actor.id,
      deletedByRole: actor.role,
    };

    await prisma.kycApplication.update({
      where: { applicationId: id },
      data: { status: TRASH_STATUS, stepStatuses: JSON.stringify(statuses) },
    });

    await writeTrashAudit(req, "kyc_moved_to_trash", id, { previousStatus: app.status });
    notify(req, id);
    res.json({ success: true, message: "KYC application moved to Trash" });
  } catch (error) {
    next(error);
  }
};

/** GET /trash — every application in the Trash, most recently deleted first. */
const listTrash = async (req, res, next) => {
  try {
    const apps = await prisma.kycApplication.findMany({
      where: { status: TRASH_STATUS },
      select: {
        applicationId: true,
        personalDetails: true,
        identityDetails: true,
        stepStatuses: true,
        globeStatus: true,
        clientCode: true,
        currentStep: true,
        createdAt: true,
        user: { select: { phone: true, email: true } },
      },
    });

    const data = apps.map((app) => {
      const pd = parseJson(app.personalDetails, {}) || {};
      const identity = parseJson(app.identityDetails, {}) || {};
      const trash = (parseJson(app.stepStatuses, {}) || {})[TRASH_KEY] || {};
      return {
        applicationId: app.applicationId,
        name: pd.fullName || pd.name || identity.panName || identity.pan_name || identity.name || "",
        pan: pd.pan || identity.pan || identity.manualPan || "",
        phone: app.user?.phone || pd.mobile || pd.phone || "",
        email: app.user?.email || pd.email || "",
        clientCode: app.clientCode || "",
        currentStep: app.currentStep,
        globeStatus: app.globeStatus,
        previousStatus: trash.previousStatus || "",
        deletedAt: trash.deletedAt || null,
        deletedBy: trash.deletedBy || "",
        deletedByRole: trash.deletedByRole || "",
        createdAt: app.createdAt,
      };
    });
    data.sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/** GET /trash/:appId — the full application (same shape as /application/:id), view only. */
const getTrashedApplication = (req, res, next) => {
  req.trashView = true;
  req.params.id = req.params.appId;
  return getApplicationById(req, res, next);
};

/** POST /trash/:appId/restore — puts the application back exactly where it was. */
const restoreFromTrash = async (req, res, next) => {
  try {
    const { appId } = req.params;
    const app = await prisma.kycApplication.findUnique({ where: { applicationId: appId } });
    if (!app || app.status !== TRASH_STATUS) {
      return res.status(404).json({ success: false, error: "Application not found in the Trash" });
    }

    const statuses = parseJson(app.stepStatuses, {}) || {};
    const restoredStatus = statuses[TRASH_KEY]?.previousStatus || "pending";
    delete statuses[TRASH_KEY];

    await prisma.kycApplication.update({
      where: { applicationId: appId },
      data: { status: restoredStatus, stepStatuses: JSON.stringify(statuses) },
    });

    await writeTrashAudit(req, "kyc_restored_from_trash", appId, { restoredStatus });
    notify(req, appId);
    res.json({ success: true, message: "KYC application restored", status: restoredStatus });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /trash/:appId — permanently deletes an application that is in the Trash.
 * ?deleteUser=true also deletes the applicant's user account with all its data (as the old delete did).
 */
const deletePermanently = async (req, res, next) => {
  try {
    const { appId } = req.params;
    const deleteUser = req.query.deleteUser === "true";
    const app = await prisma.kycApplication.findUnique({ where: { applicationId: appId } });
    if (!app || app.status !== TRASH_STATUS) {
      return res.status(404).json({ success: false, error: "Application not found in the Trash" });
    }

    const userId = app.userId;
    if (deleteUser) {
      if (userId === req.user.id) {
        return res.status(400).json({ success: false, error: "You cannot delete your own account" });
      }
      // Release the BOID assigned to this user
      const boid = await prisma.boid.findFirst({ where: { assignedTo: userId } });
      if (boid) {
        const coolingPeriodEnds = new Date();
        coolingPeriodEnds.setDate(coolingPeriodEnds.getDate() + 7);
        await prisma.boid.update({
          where: { id: boid.id },
          data: { status: "cooling_period", assignedTo: null, coolingPeriodEnds },
        });
      }
      await prisma.$transaction([
        prisma.auditLog.deleteMany({ where: { userId } }),
        prisma.kycApplication.deleteMany({ where: { userId } }),
        prisma.user.delete({ where: { id: userId } }),
      ]);
    } else {
      await prisma.kycApplication.delete({ where: { applicationId: appId } });
    }

    await writeTrashAudit(req, "kyc_deleted_permanently", appId, { userId, deleteUser });
    notify(req, appId);
    res.json({
      success: true,
      message: deleteUser ? "Application and user account deleted permanently" : "KYC application deleted permanently",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * router.param("id") guard: a trashed application can be viewed from the Trash but not changed —
 * every non-GET action on it (approve, reject, edit, mail, push…) is refused until it is restored.
 */
const rejectIfTrashed = async (req, res, next, id) => {
  if (req.method === "GET" || req.method === "HEAD") return next();
  try {
    const app = await prisma.kycApplication.findUnique({
      where: { applicationId: String(id) },
      select: { status: true },
    });
    if (app?.status === TRASH_STATUS) {
      return res.status(409).json({
        success: false,
        code: "APPLICATION_IN_TRASH",
        error: "This application is in the Trash. Restore it before making any changes.",
      });
    }
  } catch (error) {
    // Lookup failed — let the route handle the request as before
  }
  next();
};

module.exports = {
  moveToTrash,
  listTrash,
  getTrashedApplication,
  restoreFromTrash,
  deletePermanently,
  rejectIfTrashed,
};
