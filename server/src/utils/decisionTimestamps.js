const prisma = require("../config/db");

// Audit-log actions that record an STK (admin / KYC team) or Globe decision on an application.
const STK_APPROVED = ["ADMIN_STATUS_VERIFIED"];
const STK_REJECTED = ["ADMIN_STATUS_REJECTED"];
const GLOBE_APPROVED = ["GLOBE_STATUS_APPROVED", "GLOBE_APPROVED_KYC"];
const GLOBE_REJECTED = ["GLOBE_STATUS_REJECTED", "GLOBE_REJECTED_KYC"];
// "Send Rejection Mail" — sent from either portal; the sender tells STK and Globe apart.
const REJECTION_MAIL = "MODIFICATION_REQUEST_SENT";

/**
 * Adds stkApprovedAt / stkRejectedAt / globeApprovedAt / globeRejectedAt (latest of each) to a page
 * of applications, read from the audit log. The application row only keeps one "last reviewed" time
 * per side, which step reviews also overwrite, so the audit log is the reliable source.
 * Never throws: on any error the applications are returned unchanged.
 */
async function attachDecisionTimestamps(applications) {
  const ids = (applications || []).map((a) => a.applicationId).filter(Boolean);
  if (ids.length === 0) return applications;

  try {
    const [logs, globeUsers] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          targetId: { in: ids },
          action: { in: [...STK_APPROVED, ...STK_REJECTED, ...GLOBE_APPROVED, ...GLOBE_REJECTED, REJECTION_MAIL] },
        },
        select: { targetId: true, action: true, timestamp: true, crmAgentName: true },
      }),
      prisma.user.findMany({ where: { role: "globe" }, select: { email: true } }),
    ]);

    const globeEmails = new Set(globeUsers.map((u) => String(u.email || "").toLowerCase()));
    const latest = {};

    for (const log of logs) {
      let key = null;
      if (STK_APPROVED.includes(log.action)) key = "stkApprovedAt";
      else if (STK_REJECTED.includes(log.action)) key = "stkRejectedAt";
      else if (GLOBE_APPROVED.includes(log.action)) key = "globeApprovedAt";
      else if (GLOBE_REJECTED.includes(log.action)) key = "globeRejectedAt";
      else if (log.action === REJECTION_MAIL) {
        key = globeEmails.has(String(log.crmAgentName || "").toLowerCase()) ? "globeRejectedAt" : "stkRejectedAt";
      }
      if (!key) continue;

      const entry = (latest[log.targetId] = latest[log.targetId] || {});
      if (!entry[key] || log.timestamp > entry[key]) entry[key] = log.timestamp;
    }

    return applications.map((a) => ({ ...a, ...(latest[a.applicationId] || {}) }));
  } catch (error) {
    console.error("[decisionTimestamps] Failed to read audit log:", error.message);
    return applications;
  }
}

module.exports = { attachDecisionTimestamps };
