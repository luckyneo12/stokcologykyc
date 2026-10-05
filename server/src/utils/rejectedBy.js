const prisma = require("../config/db");

/**
 * Rejections saved before "rejectedBy" was recorded don't say who made them. Work it out from the
 * audit log (module reject → stepName, rejection mail → rejectedSteps) and the actor's email
 * (Globe user → "Globe", anyone else → "STK"). Only fills missing values in the response — nothing
 * is written to the database. Never throws: on any error the applications are returned unchanged.
 */
async function annotateRejectedBy(applications) {
  const list = Array.isArray(applications) ? applications : [];
  const parse = (v) => {
    if (!v) return {};
    if (typeof v === "object") return v;
    try { return JSON.parse(v); } catch (e) { return null; }
  };

  // applications with at least one rejected step that doesn't say who rejected it
  const needs = new Map();
  for (const app of list) {
    const ss = parse(app.stepStatuses);
    if (!ss) continue;
    const missing = Object.entries(ss).filter(([, v]) => v && typeof v === "object" && v.status === "rejected" && !v.rejectedBy).map(([k]) => k);
    if (missing.length > 0) needs.set(app.applicationId, { ss, missing });
  }
  if (needs.size === 0) return applications;

  try {
    const [logs, globeUsers] = await Promise.all([
      prisma.auditLog.findMany({
        where: { targetId: { in: [...needs.keys()] }, action: { in: ["MAKER_CHECKER_STEP_REJECTED", "MODIFICATION_REQUEST_SENT"] } },
        orderBy: { timestamp: "asc" },
        select: { targetId: true, action: true, crmAgentName: true, details: true },
      }),
      prisma.user.findMany({ where: { role: "globe" }, select: { email: true } }),
    ]);
    const globeEmails = new Set(globeUsers.map((u) => String(u.email || "").toLowerCase()));

    // latest actor per (application, step)
    const by = {};
    for (const log of logs) {
      const side = globeEmails.has(String(log.crmAgentName || "").toLowerCase()) ? "Globe" : "STK";
      const details = parse(log.details) || {};
      const steps = log.action === "MAKER_CHECKER_STEP_REJECTED"
        ? [details.stepName]
        : (Array.isArray(details.rejectedSteps) ? details.rejectedSteps.map((s) => s?.stepId) : []);
      for (const step of steps.filter(Boolean)) {
        (by[log.targetId] = by[log.targetId] || {})[step] = side;
      }
    }

    return list.map((app) => {
      const need = needs.get(app.applicationId);
      if (!need || !by[app.applicationId]) return app;
      const ss = { ...need.ss };
      for (const step of need.missing) {
        const side = by[app.applicationId][step];
        if (side) ss[step] = { ...ss[step], rejectedBy: side };
      }
      return { ...app, stepStatuses: typeof app.stepStatuses === "string" ? JSON.stringify(ss) : ss };
    });
  } catch (error) {
    console.error("[rejectedBy] Failed to read audit log:", error.message);
    return applications;
  }
}

module.exports = { annotateRejectedBy };
