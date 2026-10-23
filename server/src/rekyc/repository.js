const crypto = require("crypto");
const { query, queryOne, parseJson, toJson, getPool } = require("./db");

const JSON_FIELDS = ["changes", "verifications", "documents", "selfie", "esign", "backoffice_response"];
const UPDATABLE = new Set([
  "status", "client_name", "pan", "dob", "mobile", "email", "changes", "verifications", "documents", "selfie", "esign",
  "estamp_id", "pdf_url", "signed_pdf_url", "maker_id", "maker_action_at", "maker_remarks", "checker_id",
  "checker_action_at", "checker_remarks", "rejection_reason", "rejected_by", "rejected_at", "backoffice_status",
  "backoffice_response", "pushed_at", "trashed_from_status", "esigned_at", "completed_at",
]);

// Statuses: in_progress → esigned (waiting for maker) → to_be_verified (waiting for checker) → completed.
// rejected = sent back to the client; trashed = hidden by an admin (restorable).
const STATUS = {
  IN_PROGRESS: "in_progress",
  ESIGNED: "esigned",
  TO_BE_VERIFIED: "to_be_verified",
  COMPLETED: "completed",
  REJECTED: "rejected",
  TRASHED: "trashed",
};

function hydrate(row) {
  if (!row) return null;
  const original = parseJson(row.original_data, {});
  const request = { ...row, original_data: original.raw || {}, original_profile: original.profile || {} };
  for (const field of JSON_FIELDS) request[field] = parseJson(row[field], field === "backoffice_response" ? null : {});
  return request;
}

async function getRequest(id) {
  return hydrate(await queryOne("SELECT * FROM rekyc_requests WHERE id = ?", [id]));
}

/** The client's request that is still open (being edited, rejected back to them, or under review). */
async function getOpenRequestForClient(clientCode) {
  return hydrate(
    await queryOne(
      "SELECT * FROM rekyc_requests WHERE client_code = ? AND status IN ('in_progress','rejected','esigned','to_be_verified') ORDER BY created_at DESC LIMIT 1",
      [clientCode]
    )
  );
}

async function createRequest({ clientCode, raw, profile }) {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO rekyc_requests (id, client_code, workflow, status, client_name, pan, dob, mobile, email, original_data, changes, verifications, documents, selfie, esign)
     VALUES (?, ?, 'modification', 'in_progress', ?, ?, ?, ?, ?, ?, '{}', '{}', '{}', '{}', '{}')`,
    [id, clientCode, profile.name, profile.pan, profile.dob, profile.mobile, profile.email, toJson({ raw, profile })]
  );
  return getRequest(id);
}

async function updateRequest(id, fields) {
  const keys = Object.keys(fields).filter((k) => UPDATABLE.has(k));
  if (!keys.length) return getRequest(id);
  const values = keys.map((k) => (JSON_FIELDS.includes(k) ? toJson(fields[k]) : fields[k]));
  await query(`UPDATE rekyc_requests SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`, [...values, id]);
  return getRequest(id);
}

/** Moves a request only if it is still in the expected status (two admins clicking at once can't both win). */
async function transition(id, fromStatuses, fields) {
  const keys = Object.keys(fields).filter((k) => UPDATABLE.has(k));
  const values = keys.map((k) => (JSON_FIELDS.includes(k) ? toJson(fields[k]) : fields[k]));
  const from = Array.isArray(fromStatuses) ? fromStatuses : [fromStatuses];
  const result = await query(
    `UPDATE rekyc_requests SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ? AND status IN (${from.map(() => "?").join(",")})`,
    [...values, id, ...from]
  );
  return result.affectedRows === 1;
}

async function audit({ actorType, actorId, actorName, requestId, action, details, ip }) {
  try {
    await query(
      "INSERT INTO rekyc_audit_logs (actor_type, actor_id, actor_name, request_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [actorType, actorId != null ? String(actorId) : null, actorName || null, requestId || null, action, toJson(details || null), ip || null]
    );
  } catch (error) {
    console.error("[ReKYC] Audit log failed:", error.message);
  }
}

// E-stamp life: available → assigned (form generated, reused if the eSign is retried) → used (form signed).
// A used stamp of a rejected request is detached (consumed_request_id) so the corrected form gets a fresh one.
async function markEStampUsed(requestId) {
  await query("UPDATE rekyc_estamps SET status = 'used', used_at = NOW() WHERE assigned_request_id = ? AND status = 'assigned'", [requestId]);
}

async function detachUsedEStamp(requestId) {
  await query(
    "UPDATE rekyc_estamps SET consumed_request_id = assigned_request_id, assigned_request_id = NULL WHERE assigned_request_id = ? AND status = 'used'",
    [requestId]
  );
}

/** Gives the request one e-stamp from the ReKYC pool (or the one it already has). */
async function assignEStamp(requestId) {
  const existing = await queryOne("SELECT * FROM rekyc_estamps WHERE assigned_request_id = ?", [requestId]);
  if (existing) return existing;
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT * FROM rekyc_estamps WHERE status = 'available' ORDER BY id ASC LIMIT 1 FOR UPDATE");
    const stamp = rows[0];
    if (!stamp) {
      await connection.rollback();
      return null;
    }
    await connection.query(
      "UPDATE rekyc_estamps SET status = 'assigned', assigned_request_id = ?, assigned_at = NOW() WHERE id = ?",
      [requestId, stamp.id]
    );
    await connection.query("UPDATE rekyc_requests SET estamp_id = ? WHERE id = ?", [stamp.id, requestId]);
    await connection.commit();
    return { ...stamp, status: "assigned", assigned_request_id: requestId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  STATUS, getRequest, getOpenRequestForClient, createRequest, updateRequest, transition, audit,
  assignEStamp, markEStampUsed, detachUsedEStamp, hydrate,
};
