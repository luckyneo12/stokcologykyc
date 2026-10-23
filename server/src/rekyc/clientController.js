const repo = require("./repository");
const otp = require("./otp");
const { signClientToken } = require("./auth");
const { fetchClient, ANNUAL_INCOME, DEPENDENCY, STATE_NAMES } = require("./clientProfile");
const { requirements, listChanges } = require("./changes");
const { uploadBuffer, fetchBuffer } = require("./storage");
const { buildModificationPdf } = require("./pdf");
const rekycEsign = require("./esign");
const { readPennyDrop, readLiveness, readFaceMatch, nameSimilarity, MIN_FACE_MATCH } = require("./verify");
const panService = require("../services/panService");
const bankService = require("../services/bankService");
const digilockerService = require("../services/digilockerService");
const digioClient = require("../services/digioClient");

const { STATUS } = repo;
const EDITABLE = [STATUS.IN_PROGRESS];
const MAX_BANKS = 3;
const pendingLogins = new Map(); // clientCode → { raw, profile, expiresAt } between "send OTP" and "verify OTP"

class ClientError extends Error {
  constructor(message, status = 400, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    // Only our own errors reach the client as-is; third-party (Digio, back office, SMS) errors become a generic 500
    const known = error instanceof ClientError || error.expose === true;
    if (!known) console.error("[ReKYC client]", error.response?.data || error.message);
    res.status(known ? error.status || 400 : 500).json({
      success: false,
      code: known ? error.code : undefined,
      error: known ? error.message : "Something went wrong. Please try again.",
    });
  }
};

const ip = (req) => req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
const normalizeCode = (value) => String(value || "").trim().toUpperCase();

function dobToIso(dob) {
  const m = String(dob || "").match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : dob;
}

/** The request of the logged-in client, optionally only when it can still be edited. */
async function loadRequest(req, { editable = false } = {}) {
  const request = await repo.getRequest(req.rekycClient.requestId);
  if (!request || request.client_code !== req.rekycClient.clientCode) throw new ClientError("Request not found. Please log in again.", 404);
  if (editable && !EDITABLE.includes(request.status)) {
    throw new ClientError("This request has already been submitted and can no longer be changed.", 409, "LOCKED");
  }
  return request;
}

function identifierFor(request) {
  const profile = request.original_profile || {};
  return profile.mobile || profile.email;
}

function view(request) {
  const req = requirements(request);
  const { digilocker = {}, panName } = request.verifications || {};
  return {
    requestId: request.id,
    status: request.status,
    rejectionReason: request.rejection_reason || null,
    profile: request.original_profile,
    changes: request.changes,
    changeList: listChanges(request.changes),
    verifications: {
      panName: panName ? { passed: panName.passed, name: panName.name } : null,
      digilocker: digilocker.completedAt
        ? { completedAt: digilocker.completedAt, aadhaarLast4: digilocker.aadhaarLast4, name: digilocker.name, nameMatch: digilocker.nameMatch }
        : null,
    },
    documents: request.documents,
    selfie: request.selfie?.status ? { status: request.selfie.status, faceMatchScore: request.selfie.faceMatchScore, capturedAt: request.selfie.capturedAt } : null,
    esign: request.esign?.status ? { status: request.esign.status, signedAt: request.esign.signedAt } : null,
    requirements: req,
    options: { annualIncome: ANNUAL_INCOME.map((i) => i.label), dependency: DEPENDENCY.map((d) => d.label), states: Object.values(STATE_NAMES) },
  };
}

async function save(request, fields, action, req, details) {
  const updated = await repo.updateRequest(request.id, fields);
  if (action) {
    await repo.audit({ actorType: "client", actorId: request.client_code, requestId: request.id, action, details, ip: ip(req) });
  }
  return updated;
}

function setChange(changes, path, value) {
  const [section, key] = path.split(".");
  const next = { ...changes, [section]: { ...(changes[section] || {}) } };
  if (value === undefined) delete next[section][key];
  else next[section][key] = value;
  if (!Object.keys(next[section]).length) delete next[section];
  return next;
}

// ─── Login ─────────────────────────────────────────────────────────────────────

// ReKYC is only for accounts where DDPI was not executed ("No" in the back office record).
// Off for now (testing with back office pushes): every client may enter until REKYC_DDPI_CHECK=true.
function assertDdpiAllowed(profile) {
  if (String(process.env.REKYC_DDPI_CHECK || "").toLowerCase() !== "true") return;
  if (profile.ddpi === "no") return;
  if (profile.ddpi === "yes") {
    throw new ClientError("Online modification (ReKYC) is available only for accounts without DDPI. DDPI is active on your account, so please contact support to update your details.", 403, "DDPI_ACTIVE");
  }
  throw new ClientError("We could not confirm the DDPI status of your account, so online modification (ReKYC) is not available. Please contact support.", 403, "DDPI_UNKNOWN");
}

// TESTING ONLY: log in with the client code alone (no OTP). Needs REKYC_TEST_LOGIN=true AND the code listed in
// REKYC_TEST_CLIENT_CODES (comma-separated) — every other client still needs the OTP. Remove both for real clients.
function isTestLogin(clientCode) {
  if (String(process.env.REKYC_TEST_LOGIN || "").toLowerCase() !== "true") return false;
  const codes = String(process.env.REKYC_TEST_CLIENT_CODES || "")
    .split(",")
    .map(normalizeCode)
    .filter(Boolean);
  return codes.includes(clientCode);
}

/** After a successful login: opens (or reopens) the client's request and returns the session. */
async function startSession(clientCode, client, req, action) {
  let request = await repo.getOpenRequestForClient(clientCode);
  if (request?.status === STATUS.REJECTED) {
    // Sent back by the reviewer: the client corrects it and signs again
    await repo.transition(request.id, [STATUS.REJECTED], { status: STATUS.IN_PROGRESS, esign: {}, signed_pdf_url: null, pdf_url: null });
    request = await repo.getRequest(request.id);
  }
  if (!request) request = await repo.createRequest({ clientCode, raw: client.raw, profile: client.profile });

  await repo.audit({ actorType: "client", actorId: clientCode, requestId: request.id, action, ip: ip(req) });
  return { token: signClientToken({ clientCode, requestId: request.id }), request: view(request) };
}

exports.sendLoginOtp = wrap(async (req, res) => {
  const clientCode = normalizeCode(req.body?.clientCode);
  if (!/^[A-Z0-9]{3,20}$/.test(clientCode)) throw new ClientError("Enter a valid client code.");

  let client;
  try {
    client = await fetchClient(clientCode);
  } catch (error) {
    console.error(`[ReKYC] Back office lookup failed for ${clientCode}:`, error.message);
    throw new ClientError("We could not reach our records right now. Please try again later.", 503);
  }
  if (!client) throw new ClientError("No account found for this client code.", 404);
  const { profile } = client;
  assertDdpiAllowed(profile);
  if (isTestLogin(clientCode)) {
    console.warn(`[ReKYC] TEST LOGIN without OTP for ${clientCode} (REKYC_TEST_LOGIN is on)`);
    const session = await startSession(clientCode, client, req, "login_test_no_otp");
    return res.json({ success: true, testLogin: true, ...session });
  }
  if (!profile.mobile && !profile.email) {
    throw new ClientError("No registered mobile or e-mail found for this account. Please contact support.", 422);
  }

  const result = await otp.sendOtp(`login:${clientCode}`, { phone: profile.mobile, email: profile.email });
  pendingLogins.set(clientCode, { ...client, expiresAt: Date.now() + 10 * 60 * 1000 });
  await repo.audit({ actorType: "client", actorId: clientCode, action: "login_otp_sent", ip: ip(req) });
  res.json({ success: true, sentTo: result.sentTo });
});

exports.verifyLoginOtp = wrap(async (req, res) => {
  const clientCode = normalizeCode(req.body?.clientCode);
  const check = otp.verifyOtp(`login:${clientCode}`, req.body?.otp);
  if (!check.ok) throw new ClientError(check.error, 401);

  const pending = pendingLogins.get(clientCode);
  pendingLogins.delete(clientCode);
  let client = pending && pending.expiresAt > Date.now() ? pending : null;
  if (!client) client = await fetchClient(clientCode);
  if (!client) throw new ClientError("No account found for this client code.", 404);
  assertDdpiAllowed(client.profile);

  const session = await startSession(clientCode, client, req, "login");
  res.json({ success: true, ...session });
});

exports.me = wrap(async (req, res) => {
  res.json({ success: true, request: view(await loadRequest(req)) });
});

// ─── Personal ──────────────────────────────────────────────────────────────────

exports.changeName = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const profile = request.original_profile;
  const name = String(req.body?.name || "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!/^[A-Z][A-Z .']{1,99}$/.test(name)) throw new ClientError("Enter your full name (letters only).");

  if (name === String(profile.name).toUpperCase()) {
    const saved = await save(request, { changes: setChange(request.changes, "personal.name", undefined) }, "name_change_undone", req);
    return res.json({ success: true, request: view(saved) });
  }

  // Same check as onboarding: the name must match the Income Tax (PAN) record
  const result = await panService.verifyPan(profile.pan, name, dobToIso(profile.dob));
  const verifications = { ...request.verifications, panName: { passed: Boolean(result.success), name, checkedAt: new Date().toISOString() } };
  if (!result.success) {
    await save(request, { verifications }, "name_pan_check_failed", req, { name, message: result.message });
    throw new ClientError(result.message || "The name does not match your PAN record.", 422, "PAN_NAME_MISMATCH");
  }
  const saved = await save(
    request,
    { verifications, changes: setChange(request.changes, "personal.name", { old: profile.name, new: name }) },
    "name_changed",
    req,
    { name }
  );
  res.json({ success: true, request: view(saved) });
});

exports.changeRelative = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const field = req.body?.field;
  if (!["fatherName", "motherName"].includes(field)) throw new ClientError("Invalid field.");
  const value = String(req.body?.value || "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!/^[A-Z][A-Z .']{1,99}$/.test(value)) throw new ClientError("Enter a valid name (letters only).");
  const old = request.original_profile[field];
  const change = value === String(old).toUpperCase() ? undefined : { old, new: value };
  const saved = await save(request, { changes: setChange(request.changes, `personal.${field}`, change) }, `${field}_changed`, req, { value });
  res.json({ success: true, request: view(saved) });
});

function contactKey(request, type, value) {
  return `${type}:${request.id}:${String(value).toLowerCase()}`;
}

function cleanContact(type, value) {
  if (type === "mobile") {
    const digits = String(value || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    if (!/^[6-9]\d{9}$/.test(digits)) throw new ClientError("Enter a valid 10-digit mobile number.");
    return digits;
  }
  if (type === "email") {
    const email = String(value || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new ClientError("Enter a valid e-mail address.");
    return email;
  }
  throw new ClientError("Invalid contact type.");
}

exports.sendContactOtp = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const type = req.body?.type;
  const value = cleanContact(type, req.body?.value);
  if (value === String(request.original_profile[type] || "").toLowerCase()) throw new ClientError(`This is already your registered ${type}.`);
  const result = await otp.sendOtp(contactKey(request, type, value), type === "mobile" ? { phone: value } : { email: value });
  res.json({ success: true, sentTo: result.sentTo });
});

exports.verifyContactOtp = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const type = req.body?.type;
  const value = cleanContact(type, req.body?.value);
  const dependency = DEPENDENCY.find((d) => d.label === req.body?.dependency)?.label;
  if (!dependency) throw new ClientError("Select whose " + type + " this is.");
  const check = otp.verifyOtp(contactKey(request, type, value), req.body?.otp);
  if (!check.ok) throw new ClientError(check.error, 401);
  const change = { old: request.original_profile[type], new: value, dependency, verifiedAt: new Date().toISOString() };
  const saved = await save(request, { changes: setChange(request.changes, `personal.${type}`, change) }, `${type}_changed`, req, { dependency });
  res.json({ success: true, request: view(saved) });
});

// Address: fetched from Aadhaar via DigiLocker (not typed in). A DigiLocker check makes the live selfie mandatory.
exports.startDigilocker = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const identifier = identifierFor(request);
  const result = await digilockerService.createRequest(identifier, null, ["AADHAAR"], request.original_profile.name);
  if (!result?.id) throw new ClientError("Could not start DigiLocker. Please try again.", 502);
  await save(request, { verifications: { ...request.verifications, digilocker: { ...(request.verifications.digilocker || {}), requestId: result.id, startedAt: new Date().toISOString() } } }, "digilocker_started", req);
  res.json({
    success: true,
    requestId: result.id,
    customerIdentifier: result.customer_identifier || identifier,
    accessToken: typeof result.access_token === "object" ? result.access_token?.id : result.access_token,
  });
});

function findValue(node, keys) {
  if (!node || typeof node !== "object") return null;
  for (const key of keys) if (node[key] && typeof node[key] !== "object") return node[key];
  for (const value of Object.values(node)) {
    const found = findValue(value, keys);
    if (found) return found;
  }
  return null;
}

function extractAadhaar(response) {
  const action = (response?.actions || []).find((a) => String(a?.type || "").toLowerCase() === "digilocker");
  const details = action?.details || {};
  const aadhaar = details.aadhaar || details.AADHAAR || details;
  const stripCareOf = (v) => String(v || "").replace(/^(S\/O|W\/O|D\/O|C\/O)[:\s]+[^,]+,?\s*/i, "").trim();
  const addressNode = aadhaar.current_address_details || aadhaar.permanent_address_details || aadhaar.address_details || aadhaar;
  const house = stripCareOf(findValue(addressNode, ["house", "house_no"]));
  const parts = [house, findValue(addressNode, ["street"]), findValue(addressNode, ["landmark"]), findValue(addressNode, ["loc", "location", "locality_or_post_office"])]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  let line = parts.join(", ");
  if (!line) line = stripCareOf(findValue(addressNode, ["address", "current_address", "permanent_address"]));
  const state = String(findValue(addressNode, ["state"]) || "").trim();
  return {
    status: String(action?.status || response?.status || "").toLowerCase(),
    aadhaarNumber: String(aadhaar.id_number || aadhaar.aadhaar_no || "").trim(),
    name: String(aadhaar.name || "").trim(),
    dob: String(aadhaar.dob || "").trim(),
    photo: findValue(aadhaar, ["image", "photo", "photo_base64"]),
    address: {
      line1: line.slice(0, 100),
      line2: line.slice(100, 200),
      line3: line.slice(200, 300),
      city: String(findValue(addressNode, ["vtc", "city", "district_or_city"]) || "").trim(),
      district: String(findValue(addressNode, ["dist", "district", "district_or_city"]) || "").trim(),
      state: STATE_NAMES[state.toUpperCase()] || state,
      pincode: String(findValue(addressNode, ["pc", "pincode", "pin_code"]) || "").trim(),
      country: "IN",
    },
  };
}

function sameDob(a, b) {
  const norm = (v) => {
    const s = String(v || "").trim();
    let m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (m) return `${m[3]}${m[2]}${m[1]}`;
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}${m[2]}${m[3]}` : "";
  };
  const x = norm(a);
  const y = norm(b);
  return !x || !y ? null : x === y;
}

exports.completeDigilocker = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const started = request.verifications.digilocker || {};
  if (!started.requestId || started.requestId !== req.body?.requestId) throw new ClientError("Please start DigiLocker again.", 409);

  const response = await digioClient.getKycRequestResponse(started.requestId);
  const data = extractAadhaar(response);
  if (!["approved", "approval_pending", "success", "completed"].includes(data.status) || !data.address.line1) {
    throw new ClientError("DigiLocker was not completed. Please try again.", 422, "DIGILOCKER_INCOMPLETE");
  }

  const profile = request.original_profile;
  const dobMatch = sameDob(data.dob, profile.dob);
  if (dobMatch === false) {
    await save(request, {}, "digilocker_dob_mismatch", req, { requestId: started.requestId });
    throw new ClientError("The Aadhaar in DigiLocker does not belong to this account (date of birth does not match).", 422, "AADHAAR_MISMATCH");
  }
  const nameMatch = Math.round(nameSimilarity(data.name, profile.name) * 100);

  let photoUrl = null;
  if (typeof data.photo === "string" && data.photo.length > 100) {
    try {
      const buffer = Buffer.from(data.photo.replace(/^data:[^;]+;base64,/, ""), "base64");
      photoUrl = (await uploadBuffer(buffer, `rekyc_aadhaar_photo_${request.id}`, { format: "jpg" })).secure_url;
    } catch (error) {
      console.error("[ReKYC] Aadhaar photo upload failed:", error.message);
    }
  }

  const digits = data.aadhaarNumber.replace(/\D/g, "");
  const verifications = {
    ...request.verifications,
    digilocker: {
      requestId: started.requestId,
      startedAt: started.startedAt,
      completedAt: new Date().toISOString(),
      aadhaar: data.aadhaarNumber ? `XXXXXXXX${digits.slice(-4)}` : null,
      aadhaarLast4: digits.length >= 4 ? digits.slice(-4) : null,
      name: data.name,
      dobMatch,
      nameMatch,
      photoUrl,
    },
  };
  const change = { old: profile.address, new: data.address, source: "digilocker", verifiedAt: new Date().toISOString() };
  // A new DigiLocker check needs a new selfie
  const saved = await save(
    request,
    { verifications, selfie: {}, changes: setChange(request.changes, "personal.address", change) },
    "address_changed_digilocker",
    req,
    { nameMatch, dobMatch }
  );
  res.json({ success: true, request: view(saved) });
});

exports.undoChange = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const allowed = ["personal.name", "personal.fatherName", "personal.motherName", "personal.email", "personal.mobile", "personal.address", "segment", "nominee", "others"];
  const path = req.body?.path;
  if (!allowed.includes(path)) throw new ClientError("Invalid change.");
  const changes = path.includes(".") ? setChange(request.changes, path, undefined) : { ...request.changes };
  if (!path.includes(".")) delete changes[path];
  const saved = await save(request, { changes }, "change_undone", req, { path });
  res.json({ success: true, request: view(saved) });
});

// ─── Bank ──────────────────────────────────────────────────────────────────────

function currentBanks(request) {
  const bank = request.changes.bank || {};
  const removed = new Set((bank.removed || []).map((b) => b.accountNumber));
  const defaultAccount = bank.defaultAccount?.new || (request.original_profile.banks || []).find((b) => b.isDefault)?.accountNumber;
  return [
    ...(request.original_profile.banks || []).map((b) => ({ ...b, isNew: false })),
    ...(bank.added || []).map((b) => ({ ...b, isNew: true })),
  ]
    .filter((b) => !removed.has(b.accountNumber))
    .map((b) => ({ ...b, isDefault: b.accountNumber === defaultAccount }));
}

function bankChanges(request, patch) {
  const next = { added: [], removed: [], ...(request.changes.bank || {}), ...patch };
  const originalDefault = (request.original_profile.banks || []).find((b) => b.isDefault)?.accountNumber || null;
  if (next.defaultAccount && next.defaultAccount.new === originalDefault) delete next.defaultAccount;
  const changes = { ...request.changes };
  if (!next.added.length && !next.removed.length && !next.defaultAccount) delete changes.bank;
  else changes.bank = next;
  return changes;
}

exports.lookupIfsc = wrap(async (req, res) => {
  const ifsc = String(req.body?.ifsc || "").trim().toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new ClientError("Enter a valid IFSC code.");
  const result = await bankService.verifyIfsc(ifsc).catch(() => null);
  const data = result?.data || result?.result || result?.details || result || {};
  if (!data || (!data.bank && !data.bank_name && !data.BANK)) throw new ClientError("IFSC code not found.", 404);
  res.json({
    success: true,
    bank: {
      ifsc,
      bankName: data.bank_name || data.bank || data.BANK || "",
      branch: data.branch || data.BRANCH || "",
      address: data.address || data.bank_address || data.ADDRESS || "",
      city: data.city || data.CITY || "",
      state: data.state || data.STATE || "",
      micr: data.micr || data.MICR || "",
    },
  });
});

exports.addBank = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const accountNumber = String(req.body?.accountNumber || "").replace(/\s/g, "");
  const ifsc = String(req.body?.ifsc || "").trim().toUpperCase();
  const accountType = ["Savings", "Current"].includes(req.body?.accountType) ? req.body.accountType : "Savings";
  if (!/^\d{6,20}$/.test(accountNumber)) throw new ClientError("Enter a valid account number.");
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new ClientError("Enter a valid IFSC code.");

  const banks = currentBanks(request);
  if (banks.length >= MAX_BANKS) throw new ClientError(`Maximum ${MAX_BANKS} bank accounts can be linked to your trading account.`);
  if (banks.some((b) => b.accountNumber === accountNumber)) throw new ClientError("This bank account is already linked.");

  // Same as onboarding: penny drop, then the name at the bank must match the client's name (≥ 90%)
  const clientName = request.changes.personal?.name?.new || request.original_profile.name;
  const result = await bankService.verifyAccount(accountNumber, ifsc, clientName);
  const penny = readPennyDrop(result, clientName);
  if (!penny.verified) {
    await save(request, {}, "bank_penny_drop_failed", req, { ifsc });
    throw new ClientError("Invalid bank account details. Please check your account number and IFSC code.", 422, "PENNY_DROP_FAILED");
  }
  if (!penny.nameMatched) {
    await save(request, {}, "bank_name_mismatch", req, { ifsc, score: penny.score });
    throw new ClientError(`The account holder name at the bank (${penny.nameAtBank || "unknown"}) does not match your name. Only accounts in your own name can be linked.`, 422, "BANK_NAME_MISMATCH");
  }

  const branch = await bankService.verifyIfsc(ifsc).then((r) => r?.data || r?.result || r?.details || r || {}).catch(() => ({}));
  const added = {
    accountNumber,
    ifsc,
    accountType,
    bankName: result.bank_name || result.bank || branch.bank_name || branch.bank || "",
    micr: result.micr || branch.micr || "",
    holderName: penny.nameAtBank,
    branchAddress: branch.address || branch.bank_address || branch.branch || "",
    city: branch.city || "",
    state: branch.state || "",
    nameMatchScore: penny.score,
    pennyDropId: result.id || null,
    verifiedAt: new Date().toISOString(),
    dpType: "Demat and Trading",
  };
  const bank = request.changes.bank || {};
  const saved = await save(request, { changes: bankChanges(request, { added: [...(bank.added || []), added] }) }, "bank_added", req, { ifsc, score: penny.score });
  res.json({ success: true, request: view(saved), banks: currentBanks(saved) });
});

exports.removeBank = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const accountNumber = String(req.body?.accountNumber || "");
  const banks = currentBanks(request);
  const target = banks.find((b) => b.accountNumber === accountNumber);
  if (!target) throw new ClientError("Bank account not found.", 404);
  if (target.isDefault) throw new ClientError("You cannot remove the default bank. Set another account as default first.");
  if (banks.length <= 1) throw new ClientError("At least one bank account must stay linked.");
  const bank = request.changes.bank || {};
  const patch = target.isNew
    ? { added: (bank.added || []).filter((b) => b.accountNumber !== accountNumber) }
    : { removed: [...(bank.removed || []), (request.original_profile.banks || []).find((b) => b.accountNumber === accountNumber)] };
  const saved = await save(request, { changes: bankChanges(request, patch) }, "bank_removed", req);
  res.json({ success: true, request: view(saved), banks: currentBanks(saved) });
});

exports.restoreBank = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const accountNumber = String(req.body?.accountNumber || "");
  const bank = request.changes.bank || {};
  if (!(bank.removed || []).some((b) => b.accountNumber === accountNumber)) throw new ClientError("This account is not marked for removal.", 404);
  if (currentBanks(request).length >= MAX_BANKS) throw new ClientError(`Maximum ${MAX_BANKS} bank accounts can be linked. Remove a new account first.`);
  const saved = await save(request, { changes: bankChanges(request, { removed: bank.removed.filter((b) => b.accountNumber !== accountNumber) }) }, "bank_restored", req);
  res.json({ success: true, request: view(saved), banks: currentBanks(saved) });
});

exports.setDefaultBank = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const accountNumber = String(req.body?.accountNumber || "");
  if (!currentBanks(request).some((b) => b.accountNumber === accountNumber)) throw new ClientError("Bank account not found.", 404);
  const originalDefault = (request.original_profile.banks || []).find((b) => b.isDefault)?.accountNumber || null;
  const saved = await save(request, { changes: bankChanges(request, { defaultAccount: { old: originalDefault, new: accountNumber } }) }, "bank_default_changed", req);
  res.json({ success: true, request: view(saved), banks: currentBanks(saved) });
});

exports.listBanks = wrap(async (req, res) => {
  res.json({ success: true, banks: currentBanks(await loadRequest(req)) });
});

// ─── Segment / Nominee / Others ────────────────────────────────────────────────

exports.saveSegment = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  if (req.body?.fatca !== true) throw new ClientError("Please accept the FATCA / tax residency declaration.");
  const old = request.original_profile.segments || {};
  const next = { NSE_CAP: Boolean(req.body?.segments?.NSE_CAP), NSE_FNO: Boolean(req.body?.segments?.NSE_FNO) };
  if (!next.NSE_CAP && !next.NSE_FNO) throw new ClientError("Keep at least one segment active.");
  const changed = next.NSE_CAP !== Boolean(old.NSE_CAP) || next.NSE_FNO !== Boolean(old.NSE_FNO);
  const changes = { ...request.changes, declarations: { ...(request.changes.declarations || {}), fatca: true } };
  if (changed) changes.segment = { old, new: next };
  else delete changes.segment;
  const saved = await save(request, { changes }, changed ? "segment_changed" : null, req, next);
  res.json({ success: true, request: view(saved) });
});

const RELATIONS = ["Spouse", "Father", "Mother", "Son", "Daughter", "Brother", "Sister", "Other"];
const ID_TYPES = ["PAN", "Aadhaar (last 4 digits)", "Driving Licence", "Passport"];

exports.saveNominee = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const old = request.original_profile.nominee || { opted: "no", nominees: [] };
  const opted = req.body?.opted === "yes" ? "yes" : "no";
  let nominees = [];
  if (opted === "yes") {
    nominees = (Array.isArray(req.body?.nominees) ? req.body.nominees : []).map((n) => ({
      name: String(n.name || "").trim().toUpperCase(),
      relation: RELATIONS.includes(n.relation) ? n.relation : "",
      dob: String(n.dob || "").trim(),
      share: Number(n.share) || 0,
      idType: ID_TYPES.includes(n.idType) ? n.idType : "",
      idNumber: String(n.idNumber || "").trim().toUpperCase(),
      mobile: String(n.mobile || "").replace(/\D/g, "").slice(-10),
      email: String(n.email || "").trim().toLowerCase(),
      address: String(n.address || "").trim(),
    }));
    if (!nominees.length || nominees.length > 3) throw new ClientError("Add between 1 and 3 nominees.");
    for (const [i, n] of nominees.entries()) {
      if (!/^[A-Z][A-Z .']{1,99}$/.test(n.name)) throw new ClientError(`Nominee ${i + 1}: enter a valid name.`);
      if (!n.relation) throw new ClientError(`Nominee ${i + 1}: select the relationship.`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(n.dob) || new Date(n.dob) > new Date()) throw new ClientError(`Nominee ${i + 1}: enter a valid date of birth.`);
      if (!n.idType || !n.idNumber) throw new ClientError(`Nominee ${i + 1}: enter an ID proof.`);
      if (n.idType === "PAN" && !/^[A-Z]{5}\d{4}[A-Z]$/.test(n.idNumber)) throw new ClientError(`Nominee ${i + 1}: enter a valid PAN.`);
      if (n.idType.startsWith("Aadhaar") && !/^\d{4}$/.test(n.idNumber)) throw new ClientError(`Nominee ${i + 1}: enter only the last 4 digits of Aadhaar.`);
      if (n.share <= 0 || n.share > 100) throw new ClientError(`Nominee ${i + 1}: share must be between 1 and 100%.`);
    }
    const total = nominees.reduce((s, n) => s + n.share, 0);
    if (total !== 100) throw new ClientError(`Nominee shares must add up to 100% (now ${total}%).`);
  }
  const unchanged = opted === old.opted && opted === "no";
  const changes = { ...request.changes };
  if (unchanged) delete changes.nominee;
  else changes.nominee = { old, new: { opted, nominees }, declaredAt: new Date().toISOString() };
  const saved = await save(request, { changes }, unchanged ? null : "nominee_changed", req, { opted, count: nominees.length });
  res.json({ success: true, request: view(saved) });
});

exports.saveOthers = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const profile = request.original_profile;
  const income = ANNUAL_INCOME.find((i) => i.label === req.body?.annualIncome)?.label;
  if (!income) throw new ClientError("Select your annual income.");
  const netWorth = String(req.body?.netWorth ?? "").replace(/[^\d]/g, "");
  if (req.body?.ecn !== true) throw new ClientError("Please accept to receive documents electronically.");
  const others = {};
  if (income !== profile.annualIncome) others.annualIncome = { old: profile.annualIncome, new: income };
  if (netWorth && netWorth !== String(profile.netWorth || "")) others.netWorth = { old: profile.netWorth, new: netWorth };
  const changes = { ...request.changes, declarations: { ...(request.changes.declarations || {}), ecn: true } };
  if (Object.keys(others).length) changes.others = others;
  else delete changes.others;
  const saved = await save(request, { changes }, Object.keys(others).length ? "others_changed" : null, req, others);
  res.json({ success: true, request: view(saved) });
});

// ─── Documents & selfie ────────────────────────────────────────────────────────

const FINANCIAL_PROOF_TYPES = [
  "Bank account statement for last 6 months",
  "Copy of ITR acknowledgement",
  "Copy of Form 16",
  "Net worth certificate",
  "Salary slip",
  "Copy of demat account holding statement",
];
const NAME_PROOF_TYPES = ["Marriage certificate", "Gazette notification", "Passport", "Other"];

exports.documentOptions = (req, res) => res.json({ success: true, financialProofTypes: FINANCIAL_PROOF_TYPES, nameProofTypes: NAME_PROOF_TYPES });

exports.uploadDocument = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const kind = req.body?.kind;
  const file = req.file;
  if (!file) throw new ClientError("Choose a file to upload.");
  if (file.size > 5 * 1024 * 1024) throw new ClientError("File should be less than 5MB.");
  const isPdf = file.mimetype === "application/pdf" && file.buffer.slice(0, 4).toString() === "%PDF";
  let type;
  if (kind === "financialProof") {
    type = FINANCIAL_PROOF_TYPES.find((t) => t === req.body?.type);
    if (!isPdf) throw new ClientError("Financial proof must be a PDF.");
  } else if (kind === "nameProof") {
    type = NAME_PROOF_TYPES.find((t) => t === req.body?.type);
    const isImage = ["image/jpeg", "image/png"].includes(file.mimetype);
    if (!isPdf && !isImage) throw new ClientError("Upload a PDF, JPG or PNG file.");
  } else {
    throw new ClientError("Invalid document.");
  }
  if (!type) throw new ClientError("Select the document type.");

  const uploaded = await uploadBuffer(file.buffer, `rekyc_${kind}_${request.id}`);
  const documents = { ...request.documents, [kind]: { type, url: uploaded.secure_url, name: file.originalname, size: file.size, uploadedAt: new Date().toISOString() } };
  const saved = await save(request, { documents }, "document_uploaded", req, { kind, type });
  res.json({ success: true, request: view(saved) });
});

exports.removeDocument = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const kind = req.body?.kind;
  if (!["financialProof", "nameProof"].includes(kind)) throw new ClientError("Invalid document.");
  const documents = { ...request.documents };
  delete documents[kind];
  const saved = await save(request, { documents }, "document_removed", req, { kind });
  res.json({ success: true, request: view(saved) });
});

exports.submitSelfie = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const digilocker = request.verifications.digilocker || {};
  if (!digilocker.completedAt) throw new ClientError("The selfie is only needed after DigiLocker.", 409);

  const image = String(req.body?.image || "");
  if (!/^data:image\/(jpeg|png);base64,/.test(image) || image.length > 4 * 1024 * 1024) throw new ClientError("Selfie image is missing or invalid.");
  const lat = Number(req.body?.location?.lat);
  const lng = Number(req.body?.location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new ClientError("Location is required for the selfie. Please allow location access and try again.", 400, "LOCATION_REQUIRED");
  }
  const buffer = Buffer.from(image.replace(/^data:image\/[a-z]+;base64,/, ""), "base64");
  const ref = `${request.id.slice(0, 8)}_${Date.now()}`;

  let liveness;
  try {
    liveness = readLiveness(await digioClient.checkPassiveLiveness(buffer, `REKYC_L_${ref}`));
  } catch (error) {
    throw new ClientError("Liveness verification is temporarily unavailable. Please try again in a moment.", 502);
  }
  if (!liveness.ok) {
    await save(request, {}, "selfie_liveness_failed", req);
    throw new ClientError(liveness.error, 422, "LIVENESS_FAILED");
  }

  // Face match against the Aadhaar photo from DigiLocker (when DigiLocker returned one)
  let faceMatch = { skipped: true };
  if (digilocker.photoUrl) {
    let source;
    try {
      source = (await fetchBuffer(digilocker.photoUrl)).buffer;
    } catch (error) {
      console.error("[ReKYC] Aadhaar photo fetch failed:", error.message);
    }
    if (source) {
      try {
        faceMatch = readFaceMatch(await digioClient.checkFaceMatch(source, buffer, `REKYC_F_${ref}`, MIN_FACE_MATCH));
      } catch (error) {
        const status = error.response?.status;
        if (status && status >= 400 && status < 500) {
          throw new ClientError("Couldn't match your face with your Aadhaar photo. Face the light, look straight and retake.", 422, "FACE_MATCH_FAILED");
        }
        throw new ClientError("Face match is temporarily unavailable. Please try again in a moment.", 502);
      }
      if (!faceMatch.ok) {
        await save(request, {}, "selfie_face_match_failed", req, { score: faceMatch.score });
        throw new ClientError("Your face doesn't match your Aadhaar photo clearly enough. Face the light, look straight and retake.", 422, "FACE_MATCH_LOW");
      }
    }
  }

  const uploaded = await uploadBuffer(buffer, `rekyc_selfie_${request.id}`, { format: "jpg" });
  const selfie = {
    status: "passed",
    url: uploaded.secure_url,
    livenessScore: liveness.score,
    faceMatchScore: faceMatch.score ?? null,
    faceMatchSkipped: Boolean(faceMatch.skipped),
    location: { lat, lng, accuracy: Number(req.body?.location?.accuracy) || null },
    ip: ip(req),
    capturedAt: new Date().toISOString(),
  };
  const saved = await save(request, { selfie }, "selfie_passed", req, { livenessScore: liveness.score, faceMatchScore: faceMatch.score ?? null });
  res.json({ success: true, request: view(saved) });
});

// ─── Review & eSign ────────────────────────────────────────────────────────────

exports.startEsign = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const check = requirements(request);
  if (!check.ok) throw new ClientError(check.missing[0].message, 422, "REQUIREMENTS_PENDING");

  const estamp = await repo.assignEStamp(request.id);
  if (!estamp) {
    await repo.audit({ actorType: "system", requestId: request.id, action: "estamp_pool_empty" });
    throw new ClientError("We are unable to generate your form right now. Please try again after some time or contact support.", 503, "NO_ESTAMP");
  }

  const pdfBuffer = await buildModificationPdf({ request, estamp });
  const pdf = await uploadBuffer(pdfBuffer, `rekyc_form_${request.id}`, { format: "pdf" });
  const identifier = identifierFor(request);
  const sign = await rekycEsign.createSignRequest({
    pdfBuffer,
    identifier,
    signerName: request.changes.personal?.name?.new || request.original_profile.name,
    fileName: `Modification_${request.client_code}.pdf`,
  });

  const esign = { documentId: sign.id, status: "requested", identifier, requestedAt: new Date().toISOString() };
  await save(request, { esign, pdf_url: pdf.secure_url, estamp_id: estamp.id }, "esign_started", req, { documentId: sign.id, estampId: estamp.id });
  res.json({
    success: true,
    documentId: sign.id,
    identifier,
    accessToken: typeof sign.access_token === "object" ? sign.access_token?.id : sign.access_token,
  });
});

exports.completeEsign = wrap(async (req, res) => {
  const request = await loadRequest(req, { editable: true });
  const documentId = request.esign?.documentId;
  if (!documentId || documentId !== req.body?.documentId) throw new ClientError("Please start the eSign again.", 409);

  const details = await rekycEsign.getDetails(documentId);
  const expected = request.verifications.digilocker?.aadhaarLast4 || request.original_profile.aadhaarLast4 || null;
  const signer = rekycEsign.checkSigner(details, expected);
  if (signer.status === "not_signed") throw new ClientError("The eSign was not completed. Please try again.", 422, "ESIGN_INCOMPLETE");
  if (signer.status === "mismatch") {
    await save(request, { esign: { ...request.esign, status: "aadhaar_mismatch", signer } }, "esign_aadhaar_mismatch", req, signer);
    throw new ClientError(
      `The Aadhaar used for eSign (ending ${signer.signedSuffix}) doesn't match your Aadhaar (ending ${signer.expectedSuffix}). Please eSign again using your own Aadhaar.`,
      409,
      "ESIGN_AADHAAR_MISMATCH"
    );
  }

  const download = await rekycEsign.download(documentId);
  const signed = await uploadBuffer(Buffer.from(download.data), `rekyc_signed_${request.id}`, { format: "pdf" });
  const now = new Date();
  const moved = await repo.transition(request.id, [STATUS.IN_PROGRESS], {
    status: STATUS.ESIGNED,
    esign: { ...request.esign, status: "signed", signedAt: now.toISOString(), signer },
    signed_pdf_url: signed.secure_url,
    esigned_at: now,
    rejection_reason: null,
  });
  if (!moved) throw new ClientError("This request was already submitted.", 409);
  await repo.markEStampUsed(request.id);
  await repo.audit({ actorType: "client", actorId: request.client_code, requestId: request.id, action: "esigned", details: signer, ip: ip(req) });
  res.json({ success: true, request: view(await repo.getRequest(request.id)) });
});

exports.downloadSignedPdf = wrap(async (req, res) => {
  const request = await loadRequest(req);
  if (!request.signed_pdf_url) throw new ClientError("The signed form is not available yet.", 404);
  const { buffer } = await fetchBuffer(request.signed_pdf_url);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="Modification_${request.client_code}.pdf"`);
  res.send(buffer);
});
