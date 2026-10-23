const bcrypt = require("bcryptjs");
const { PDFDocument } = require("pdf-lib");
const repo = require("./repository");
const { query, queryOne } = require("./db");
const { signAdminToken } = require("./auth");
const { ROLES, permissionsFor, hasPermission, PERMISSIONS } = require("./permissions");
const { listChanges, requirements } = require("./changes");
const { pushToBackoffice } = require("./backofficePush");
const { uploadBuffer, fetchBuffer } = require("./storage");
const { sendDecisionMail } = require("./mailer");

const { STATUS } = repo;
const STATUS_LABELS = {
  in_progress: "In Progress",
  esigned: "eSigned",
  to_be_verified: "To Be Verified",
  completed: "Completed",
  rejected: "Rejected",
  trashed: "Trash",
};

class AdminError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    const known = error instanceof AdminError;
    if (!known) console.error("[ReKYC admin]", error.response?.data || error.message);
    res.status(known ? error.status : 500).json({ success: false, error: known ? error.message : "Something went wrong. Please try again." });
  }
};

const ip = (req) => req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
const actor = (req) => ({ actorType: "admin", actorId: req.rekycAdmin.id, actorName: req.rekycAdmin.name, ip: ip(req) });

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    roleLabel: ROLES[user.role]?.label || user.role,
    status: user.status,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    linkedToAdminPortal: String(user.password_hash || "").startsWith("LINKED:"),
    permissions: permissionsFor(user.role),
  };
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

// Admin-portal accounts log in here with their Admin portal e-mail + password. Their ReKYC row stores
// "LINKED:<User id>" instead of a password, so the password is always checked against the Admin portal
// (the shared User table is only read, never written).
const LINKED_PREFIX = "LINKED:";
const isLinked = (user) => String(user?.password_hash || "").startsWith(LINKED_PREFIX);

async function adminPortalUser(email) {
  return queryOne("SELECT id, email, password FROM `User` WHERE email = ? AND role = 'admin' LIMIT 1", [email]);
}

async function checkPassword(user, password) {
  if (!isLinked(user)) return bcrypt.compare(password, user.password_hash);
  const linkedId = Number(user.password_hash.slice(LINKED_PREFIX.length));
  const main = await adminPortalUser(user.email);
  return Boolean(main && main.id === linkedId && main.password && (await bcrypt.compare(password, main.password)));
}

/** First ReKYC login of an Admin portal admin → linked ReKYC Super Admin account. */
async function provisionFromAdminPortal(email, password) {
  const main = await adminPortalUser(email);
  if (!main?.password || !(await bcrypt.compare(password, main.password))) return null;
  const name = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  await query("INSERT INTO rekyc_admin_users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'rekyc_admin', 'active')", [
    name,
    email,
    `${LINKED_PREFIX}${main.id}`,
  ]);
  return queryOne("SELECT * FROM rekyc_admin_users WHERE email = ?", [email]);
}

const failedLogins = new Map(); // email → { count, until }

exports.login = wrap(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const lock = failedLogins.get(email);
  if (lock && lock.until > Date.now()) throw new AdminError("Too many failed attempts. Try again in 15 minutes.", 429);

  let user = await queryOne("SELECT * FROM rekyc_admin_users WHERE email = ?", [email]);
  let ok = user ? await checkPassword(user, password) : false;
  if (!user) {
    user = await provisionFromAdminPortal(email, password);
    ok = Boolean(user);
    if (user) await repo.audit({ actorType: "admin", actorId: user.id, actorName: user.name, action: "linked_admin_portal_account", ip: ip(req) });
  }
  if (!ok) {
    const count = (lock?.count || 0) + 1;
    failedLogins.set(email, { count, until: count >= 5 ? Date.now() + 15 * 60 * 1000 : 0 });
    await repo.audit({ actorType: "admin", actorName: email, action: "login_failed", ip: ip(req) });
    throw new AdminError("Invalid e-mail or password.", 401);
  }
  if (user.status !== "active") throw new AdminError("Your account is inactive. Contact the ReKYC administrator.", 403);
  failedLogins.delete(email);
  await query("UPDATE rekyc_admin_users SET last_login_at = NOW() WHERE id = ?", [user.id]);
  await repo.audit({ actorType: "admin", actorId: user.id, actorName: user.name, action: "login", ip: ip(req) });
  res.json({ success: true, token: signAdminToken({ id: user.id }), user: publicUser(user) });
});

exports.me = wrap(async (req, res) => {
  const user = await queryOne("SELECT * FROM rekyc_admin_users WHERE id = ?", [req.rekycAdmin.id]);
  res.json({ success: true, user: publicUser(user) });
});

exports.changePassword = wrap(async (req, res) => {
  const user = await queryOne("SELECT * FROM rekyc_admin_users WHERE id = ?", [req.rekycAdmin.id]);
  if (isLinked(user)) throw new AdminError("Your password is the same as the Admin portal. Change it in the Admin portal.");
  if (!(await bcrypt.compare(String(req.body?.currentPassword || ""), user.password_hash))) throw new AdminError("Current password is incorrect.");
  if (!validPassword(req.body?.newPassword)) throw new AdminError("New password must be at least 8 characters with letters and numbers.");
  await query("UPDATE rekyc_admin_users SET password_hash = ? WHERE id = ?", [await bcrypt.hash(req.body.newPassword, 10), user.id]);
  await repo.audit({ ...actor(req), action: "password_changed" });
  res.json({ success: true });
});

// ─── Requests ──────────────────────────────────────────────────────────────────

function buildFilters(q) {
  const where = [];
  const params = [];
  if (q.status && q.status !== "all") {
    if (q.status === "all_esigned") where.push("esigned_at IS NOT NULL AND status <> 'trashed'");
    else if (q.status === "verify") where.push("status IN ('esigned','to_be_verified')");
    else {
      where.push("status = ?");
      params.push(q.status);
    }
  } else {
    where.push("status <> 'trashed'");
  }
  if (q.workflow && q.workflow !== "all") {
    where.push("workflow = ?");
    params.push(q.workflow);
  }
  if (q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from)) {
    where.push("created_at >= ?");
    params.push(`${q.from} 00:00:00`);
  }
  if (q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to)) {
    where.push("created_at <= ?");
    params.push(`${q.to} 23:59:59`);
  }
  if (q.search) {
    const like = `%${String(q.search).trim()}%`;
    where.push("(client_code LIKE ? OR client_name LIKE ? OR pan LIKE ? OR id LIKE ? OR mobile LIKE ? OR email LIKE ?)");
    params.push(like, like, like, like, like, like);
  }
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

function summary(request) {
  const changes = listChanges(request.changes);
  return {
    id: request.id,
    clientCode: request.client_code,
    name: request.client_name,
    dob: request.dob,
    pan: request.pan,
    mobile: request.mobile,
    email: request.email,
    workflow: request.workflow,
    status: request.status,
    statusLabel: STATUS_LABELS[request.status] || request.status,
    sections: [...new Set(changes.map((c) => c.section))],
    changeCount: changes.length,
    backofficeStatus: request.backoffice_status,
    createdAt: request.created_at,
    esignedAt: request.esigned_at,
    completedAt: request.completed_at,
  };
}

exports.stats = wrap(async (req, res) => {
  const rows = await query("SELECT status, COUNT(*) AS total FROM rekyc_requests GROUP BY status");
  const counts = Object.fromEntries(Object.keys(STATUS_LABELS).map((s) => [s, 0]));
  rows.forEach((r) => (counts[r.status] = Number(r.total)));
  const allEsigned = await queryOne("SELECT COUNT(*) AS total FROM rekyc_requests WHERE esigned_at IS NOT NULL AND status <> 'trashed'");
  const stamps = await query("SELECT status, COUNT(*) AS total FROM rekyc_estamps GROUP BY status");
  res.json({
    success: true,
    counts: { ...counts, all_esigned: Number(allEsigned.total) },
    estamps: Object.fromEntries(stamps.map((s) => [s.status, Number(s.total)])),
  });
});

exports.listRequests = wrap(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const { sql, params } = buildFilters(req.query);
  const total = await queryOne(`SELECT COUNT(*) AS total FROM rekyc_requests ${sql}`, params);
  const rows = await query(`SELECT * FROM rekyc_requests ${sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
  res.json({ success: true, total: Number(total.total), page, limit, requests: rows.map((row) => summary(repo.hydrate(row))) });
});

async function getRequestOr404(id) {
  const request = await repo.getRequest(id);
  if (!request) throw new AdminError("Request not found.", 404);
  return request;
}

async function adminName(id) {
  if (!id) return null;
  const user = await queryOne("SELECT name FROM rekyc_admin_users WHERE id = ?", [id]);
  return user?.name || `#${id}`;
}

exports.getRequest = wrap(async (req, res) => {
  const request = await getRequestOr404(req.params.id);
  const estamp = request.estamp_id ? await queryOne("SELECT id, certificate_no, serial_no, status FROM rekyc_estamps WHERE id = ?", [request.estamp_id]) : null;
  const logs = await query("SELECT actor_type, actor_name, action, details, ip_address, created_at FROM rekyc_audit_logs WHERE request_id = ? ORDER BY created_at DESC LIMIT 200", [request.id]);
  const docs = request.documents || {};
  const files = {
    signedPdf: Boolean(request.signed_pdf_url),
    formPdf: Boolean(request.pdf_url),
    financialProof: Boolean(docs.financialProof?.url),
    nameProof: Boolean(docs.nameProof?.url),
    selfie: Boolean(request.selfie?.url),
    aadhaarPhoto: Boolean(request.verifications?.digilocker?.photoUrl),
  };
  res.json({
    success: true,
    request: {
      ...summary(request),
      profile: request.original_profile,
      changes: request.changes,
      changeList: listChanges(request.changes),
      requirements: requirements(request),
      verifications: request.verifications,
      documents: { financialProof: docs.financialProof ? { type: docs.financialProof.type, name: docs.financialProof.name } : null, nameProof: docs.nameProof ? { type: docs.nameProof.type, name: docs.nameProof.name } : null },
      selfie: request.selfie?.status ? { ...request.selfie, url: undefined } : null,
      esign: request.esign,
      estamp,
      files,
      maker: { id: request.maker_id, name: await adminName(request.maker_id), at: request.maker_action_at, remarks: request.maker_remarks },
      checker: { id: request.checker_id, name: await adminName(request.checker_id), at: request.checker_action_at, remarks: request.checker_remarks },
      rejection: request.rejection_reason ? { reason: request.rejection_reason, by: await adminName(request.rejected_by), at: request.rejected_at } : null,
      backoffice: { status: request.backoffice_status, response: request.backoffice_response, pushedAt: request.pushed_at },
      auditLog: logs.map((l) => ({ ...l, details: (() => { try { return JSON.parse(l.details); } catch (e) { return l.details; } })() })),
    },
  });
});

exports.getFile = wrap(async (req, res) => {
  const request = await getRequestOr404(req.params.id);
  const urls = {
    signedPdf: request.signed_pdf_url,
    formPdf: request.pdf_url,
    financialProof: request.documents?.financialProof?.url,
    nameProof: request.documents?.nameProof?.url,
    selfie: request.selfie?.url,
    aadhaarPhoto: request.verifications?.digilocker?.photoUrl,
  };
  const url = urls[req.params.kind];
  if (!url) throw new AdminError("File not found.", 404);
  const { buffer, contentType } = await fetchBuffer(url);
  const isPdf = buffer.slice(0, 4).toString() === "%PDF";
  res.setHeader("Content-Type", isPdf ? "application/pdf" : contentType || "application/octet-stream");
  res.setHeader("Content-Disposition", `${req.query.download === "1" ? "attachment" : "inline"}; filename="${request.client_code}_${req.params.kind}${isPdf ? ".pdf" : ".jpg"}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(buffer);
});

exports.makerApprove = wrap(async (req, res) => {
  const request = await getRequestOr404(req.params.id);
  if (request.status !== STATUS.ESIGNED) throw new AdminError("Only eSigned requests can be verified by the maker.", 409);
  const remarks = String(req.body?.remarks || "").trim().slice(0, 1000) || null;
  const moved = await repo.transition(request.id, [STATUS.ESIGNED], {
    status: STATUS.TO_BE_VERIFIED, maker_id: req.rekycAdmin.id, maker_action_at: new Date(), maker_remarks: remarks,
  });
  if (!moved) throw new AdminError("This request was already updated by someone else. Refresh the page.", 409);
  await repo.audit({ ...actor(req), requestId: request.id, action: "maker_approved", details: { remarks } });
  res.json({ success: true });
});

exports.checkerApprove = wrap(async (req, res) => {
  const request = await getRequestOr404(req.params.id);
  if (request.status !== STATUS.TO_BE_VERIFIED) throw new AdminError("Only requests verified by a maker can be approved by the checker.", 409);
  if (request.maker_id === req.rekycAdmin.id) throw new AdminError("The maker and the checker of a request must be different people.", 403);
  const remarks = String(req.body?.remarks || "").trim().slice(0, 1000) || null;

  // Back office first: the request is completed only once the modification was accepted there
  let response;
  try {
    response = await pushToBackoffice(request);
  } catch (error) {
    const detail = error.response?.data || error.message;
    await repo.updateRequest(request.id, { backoffice_status: "failed", backoffice_response: { error: detail, at: new Date().toISOString() } });
    await repo.audit({ ...actor(req), requestId: request.id, action: "backoffice_push_failed", details: { error: detail } });
    throw new AdminError(`Back office update failed: ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)}. The request stays in "To Be Verified" — try again.`, 502);
  }

  const now = new Date();
  const moved = await repo.transition(request.id, [STATUS.TO_BE_VERIFIED], {
    status: STATUS.COMPLETED, checker_id: req.rekycAdmin.id, checker_action_at: now, checker_remarks: remarks,
    backoffice_status: "success", backoffice_response: response, pushed_at: now, completed_at: now,
  });
  if (!moved) throw new AdminError("This request was already updated by someone else. Refresh the page.", 409);
  await repo.audit({ ...actor(req), requestId: request.id, action: "checker_approved", details: { remarks, backoffice: response } });
  sendDecisionMail(request, "approved").catch((e) => console.error("[ReKYC] Approval mail failed:", e.message));
  res.json({ success: true, backoffice: response });
});

exports.reject = wrap(async (req, res) => {
  const request = await getRequestOr404(req.params.id);
  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 5) throw new AdminError("Enter the reason for rejection (it is shown to the client).");
  const admin = req.rekycAdmin;
  const allowedFrom = [];
  if (hasPermission(admin.role, PERMISSIONS.MAKER_ACTION)) allowedFrom.push(STATUS.ESIGNED);
  if (hasPermission(admin.role, PERMISSIONS.CHECKER_ACTION)) allowedFrom.push(STATUS.TO_BE_VERIFIED);
  if (!allowedFrom.includes(request.status)) throw new AdminError("You cannot reject this request at its current stage.", 403);

  const moved = await repo.transition(request.id, allowedFrom, {
    status: STATUS.REJECTED, rejection_reason: reason.slice(0, 1000), rejected_by: admin.id, rejected_at: new Date(),
  });
  if (!moved) throw new AdminError("This request was already updated by someone else. Refresh the page.", 409);
  await repo.detachUsedEStamp(request.id);
  await repo.audit({ ...actor(req), requestId: request.id, action: "rejected", details: { reason, stage: request.status } });
  sendDecisionMail({ ...request, rejection_reason: reason }, "rejected").catch((e) => console.error("[ReKYC] Rejection mail failed:", e.message));
  res.json({ success: true });
});

exports.trash = wrap(async (req, res) => {
  const request = await getRequestOr404(req.params.id);
  if ([STATUS.TRASHED, STATUS.COMPLETED].includes(request.status)) throw new AdminError("This request cannot be moved to trash.", 409);
  await repo.transition(request.id, [request.status], { status: STATUS.TRASHED, trashed_from_status: request.status });
  await repo.audit({ ...actor(req), requestId: request.id, action: "trashed", details: { from: request.status } });
  res.json({ success: true });
});

exports.restore = wrap(async (req, res) => {
  const request = await getRequestOr404(req.params.id);
  if (request.status !== STATUS.TRASHED) throw new AdminError("This request is not in trash.", 409);
  const back = request.trashed_from_status || STATUS.IN_PROGRESS;
  await repo.transition(request.id, [STATUS.TRASHED], { status: back, trashed_from_status: null });
  await repo.audit({ ...actor(req), requestId: request.id, action: "restored", details: { to: back } });
  res.json({ success: true });
});

// ─── Reports ───────────────────────────────────────────────────────────────────

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  // Leading = + - @ would run as a formula in Excel
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

exports.exportMis = wrap(async (req, res) => {
  const { sql, params } = buildFilters(req.query);
  const rows = await query(`SELECT * FROM rekyc_requests ${sql} ORDER BY created_at DESC LIMIT 20000`, params);
  const header = ["Request ID", "Client Code", "Name", "PAN", "DOB", "Mobile", "E-mail", "Workflow", "Status", "Sections Changed", "Changes", "Created", "eSigned", "Maker", "Maker At", "Checker", "Checker At", "Completed", "Back Office", "Rejection Reason"];
  const names = Object.fromEntries((await query("SELECT id, name FROM rekyc_admin_users")).map((u) => [u.id, u.name]));
  const fmt = (d) => (d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "");
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    const request = repo.hydrate(row);
    const changes = listChanges(request.changes);
    lines.push([
      request.id, request.client_code, request.client_name, request.pan, request.dob, request.mobile, request.email, request.workflow,
      STATUS_LABELS[request.status] || request.status, [...new Set(changes.map((c) => c.section))].join(" | "),
      changes.map((c) => `${c.field}: ${c.oldValue || "-"} -> ${c.newValue || "-"}`).join(" | "),
      fmt(request.created_at), fmt(request.esigned_at), names[request.maker_id] || "", fmt(request.maker_action_at),
      names[request.checker_id] || "", fmt(request.checker_action_at), fmt(request.completed_at), request.backoffice_status || "", request.rejection_reason || "",
    ].map(csvCell).join(","));
  }
  await repo.audit({ ...actor(req), action: "mis_exported", details: { filters: req.query, rows: rows.length } });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="rekyc_mis_${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send("﻿" + lines.join("\r\n"));
});

exports.exportEsignedPdfs = wrap(async (req, res) => {
  const { sql, params } = buildFilters({ ...req.query, status: req.query.status || "all_esigned" });
  const rows = await query(`SELECT id, client_code, signed_pdf_url FROM rekyc_requests ${sql} AND signed_pdf_url IS NOT NULL ORDER BY created_at DESC LIMIT 50`, params);
  if (!rows.length) throw new AdminError("No eSigned forms match these filters.", 404);
  const merged = await PDFDocument.create();
  for (const row of rows) {
    try {
      const { buffer } = await fetchBuffer(row.signed_pdf_url);
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      (await merged.copyPages(doc, doc.getPageIndices())).forEach((p) => merged.addPage(p));
    } catch (error) {
      console.error(`[ReKYC] Could not add signed PDF of ${row.client_code}:`, error.message);
    }
  }
  await repo.audit({ ...actor(req), action: "esigned_pdfs_exported", details: { filters: req.query, count: rows.length } });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="rekyc_esigned_${new Date().toISOString().slice(0, 10)}.pdf"`);
  res.send(Buffer.from(await merged.save()));
});

// ─── E-stamps (ReKYC's own pool) ───────────────────────────────────────────────

exports.listEStamps = wrap(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const where = [];
  const params = [];
  if (req.query.status && req.query.status !== "all") {
    where.push("s.status = ?");
    params.push(req.query.status);
  }
  if (req.query.search) {
    where.push("(s.certificate_no LIKE ? OR s.serial_no LIKE ? OR r.client_code LIKE ?)");
    const like = `%${req.query.search}%`;
    params.push(like, like, like);
  }
  const sql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const from = "FROM rekyc_estamps s LEFT JOIN rekyc_requests r ON r.id = COALESCE(s.assigned_request_id, s.consumed_request_id)";
  const total = await queryOne(`SELECT COUNT(*) AS total ${from} ${sql}`, params);
  const rows = await query(
    `SELECT s.id, s.certificate_no, s.serial_no, s.status, s.assigned_at, s.used_at, s.created_at, r.id AS request_id, r.client_code ${from} ${sql} ORDER BY s.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  const stats = await query("SELECT status, COUNT(*) AS total FROM rekyc_estamps GROUP BY status");
  res.json({ success: true, total: Number(total.total), page, limit, estamps: rows, stats: Object.fromEntries(stats.map((s) => [s.status, Number(s.total)])) });
});

exports.uploadEStamp = wrap(async (req, res) => {
  const certificateNo = String(req.body?.certificateNo || "").trim();
  const serialNo = String(req.body?.serialNo || "").trim();
  if (!certificateNo && !serialNo) throw new AdminError("Enter the certificate no. or serial no.");
  const file = req.file;
  if (!file) throw new AdminError("Choose the e-stamp file.");
  const isPdf = file.buffer.slice(0, 4).toString() === "%PDF";
  const isImage = ["image/jpeg", "image/png"].includes(file.mimetype);
  if (!isPdf && !isImage) throw new AdminError("E-stamp must be a PDF, JPG or PNG.");
  if (certificateNo && (await queryOne("SELECT id FROM rekyc_estamps WHERE certificate_no = ?", [certificateNo]))) throw new AdminError(`Certificate no. ${certificateNo} already exists.`);
  if (serialNo && (await queryOne("SELECT id FROM rekyc_estamps WHERE serial_no = ?", [serialNo]))) throw new AdminError(`Serial no. ${serialNo} already exists.`);
  const uploaded = await uploadBuffer(file.buffer, `rekyc_estamp_${certificateNo || serialNo}`);
  const result = await query(
    "INSERT INTO rekyc_estamps (certificate_no, serial_no, file_url, status, uploaded_by) VALUES (?, ?, ?, 'available', ?)",
    [certificateNo, serialNo, uploaded.secure_url, req.rekycAdmin.id]
  );
  await repo.audit({ ...actor(req), action: "estamp_uploaded", details: { id: result.insertId, certificateNo, serialNo } });
  res.json({ success: true, id: result.insertId });
});

exports.viewEStamp = wrap(async (req, res) => {
  const stamp = await queryOne("SELECT * FROM rekyc_estamps WHERE id = ?", [req.params.id]);
  if (!stamp) throw new AdminError("E-stamp not found.", 404);
  const { buffer, contentType } = await fetchBuffer(stamp.file_url);
  res.setHeader("Content-Type", buffer.slice(0, 4).toString() === "%PDF" ? "application/pdf" : contentType || "image/jpeg");
  res.setHeader("Cache-Control", "private, no-store");
  res.send(buffer);
});

exports.deleteEStamp = wrap(async (req, res) => {
  const result = await query("DELETE FROM rekyc_estamps WHERE id = ? AND status = 'available'", [req.params.id]);
  if (!result.affectedRows) throw new AdminError("Only available (unused) e-stamps can be deleted.", 409);
  await repo.audit({ ...actor(req), action: "estamp_deleted", details: { id: req.params.id } });
  res.json({ success: true });
});

// ─── Users (ReKYC admin accounts) ──────────────────────────────────────────────

exports.listUsers = wrap(async (req, res) => {
  const users = await query("SELECT * FROM rekyc_admin_users ORDER BY created_at DESC");
  res.json({ success: true, users: users.map(publicUser), roles: Object.entries(ROLES).map(([value, r]) => ({ value, label: r.label, permissions: r.permissions })) });
});

exports.createUser = wrap(async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const mobile = String(req.body?.mobile || "").replace(/\D/g, "").slice(-10) || null;
  const role = req.body?.role;
  if (name.length < 2) throw new AdminError("Enter the name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new AdminError("Enter a valid e-mail.");
  if (!ROLES[role]) throw new AdminError("Select a role.");
  if (!validPassword(req.body?.password)) throw new AdminError("Password must be at least 8 characters with letters and numbers.");
  if (await queryOne("SELECT id FROM rekyc_admin_users WHERE email = ?", [email])) throw new AdminError("A user with this e-mail already exists.");
  const result = await query(
    "INSERT INTO rekyc_admin_users (name, email, mobile, password_hash, role, status, created_by) VALUES (?, ?, ?, ?, ?, 'active', ?)",
    [name, email, mobile, await bcrypt.hash(req.body.password, 10), role, req.rekycAdmin.id]
  );
  await repo.audit({ ...actor(req), action: "user_created", details: { id: result.insertId, email, role } });
  res.json({ success: true, id: result.insertId });
});

exports.updateUser = wrap(async (req, res) => {
  const id = Number(req.params.id);
  const user = await queryOne("SELECT * FROM rekyc_admin_users WHERE id = ?", [id]);
  if (!user) throw new AdminError("User not found.", 404);
  const name = req.body?.name !== undefined ? String(req.body.name).trim() : user.name;
  const mobile = req.body?.mobile !== undefined ? String(req.body.mobile).replace(/\D/g, "").slice(-10) || null : user.mobile;
  const role = req.body?.role !== undefined ? req.body.role : user.role;
  const status = req.body?.status !== undefined ? req.body.status : user.status;
  if (!ROLES[role]) throw new AdminError("Select a valid role.");
  if (!["active", "inactive"].includes(status)) throw new AdminError("Invalid status.");
  if (id === req.rekycAdmin.id && (role !== user.role || status !== "active")) throw new AdminError("You cannot change your own role or deactivate yourself.", 403);
  if (user.role === "rekyc_admin" && (role !== "rekyc_admin" || status !== "active")) {
    const admins = await queryOne("SELECT COUNT(*) AS total FROM rekyc_admin_users WHERE role = 'rekyc_admin' AND status = 'active'");
    if (Number(admins.total) <= 1) throw new AdminError("At least one active Super Admin must remain.", 409);
  }
  await query("UPDATE rekyc_admin_users SET name = ?, mobile = ?, role = ?, status = ? WHERE id = ?", [name, mobile, role, status, id]);
  await repo.audit({ ...actor(req), action: "user_updated", details: { id, role, status } });
  res.json({ success: true });
});

exports.resetUserPassword = wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!validPassword(req.body?.password)) throw new AdminError("Password must be at least 8 characters with letters and numbers.");
  const target = await queryOne("SELECT * FROM rekyc_admin_users WHERE id = ?", [id]);
  if (!target) throw new AdminError("User not found.", 404);
  if (isLinked(target)) throw new AdminError("This user signs in with the Admin portal password. Reset it in the Admin portal.");
  await query("UPDATE rekyc_admin_users SET password_hash = ? WHERE id = ?", [await bcrypt.hash(req.body.password, 10), id]);
  await repo.audit({ ...actor(req), action: "user_password_reset", details: { id } });
  res.json({ success: true });
});

exports.auditLog = wrap(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = 50;
  const rows = await query("SELECT * FROM rekyc_audit_logs ORDER BY id DESC LIMIT ? OFFSET ?", [limit, (page - 1) * limit]);
  res.json({ success: true, page, logs: rows });
});
