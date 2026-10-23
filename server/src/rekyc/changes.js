// What the client changed, in one place: used by the client portal (requirements before eSign),
// the modification form PDF, the admin old-vs-new view and the back office push.

const SEGMENT_LABELS = { NSE_CAP: "NSE - CASH", NSE_FNO: "NSE - FNO" };

function addressText(address = {}) {
  return [address.line1, address.line2, address.line3, address.city, address.district, address.state, address.pincode, address.country]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(", ");
}

function segmentText(segments = {}) {
  const active = Object.keys(SEGMENT_LABELS).filter((k) => segments[k]).map((k) => SEGMENT_LABELS[k]);
  return active.length ? active.join(", ") : "None";
}

function nomineeText(nominee = {}) {
  if (nominee.opted !== "yes") return "Opted out";
  const list = nominee.nominees || [];
  if (!list.length) return "Opted in";
  return list.map((n, i) => `${i + 1}. ${n.name} (${n.relation || "-"}, ${n.share || 0}%)`).join("; ");
}

function bankText(bank) {
  return `${bank.bankName || "Bank"} - A/c ${bank.accountNumber} - IFSC ${bank.ifsc}`;
}

/** Flat list of every change: [{ section, field, oldValue, newValue }] */
function listChanges(changes = {}) {
  const rows = [];
  const personal = changes.personal || {};
  const labels = { name: "Name", fatherName: "Father's / Spouse Name", motherName: "Mother's Name" };
  for (const key of ["name", "fatherName", "motherName"]) {
    if (personal[key]) rows.push({ section: "Personal", field: labels[key], oldValue: personal[key].old, newValue: personal[key].new });
  }
  if (personal.email) {
    rows.push({ section: "Personal", field: "E-mail", oldValue: personal.email.old, newValue: `${personal.email.new} (Dependency: ${personal.email.dependency || "Self"})` });
  }
  if (personal.mobile) {
    rows.push({ section: "Personal", field: "Mobile", oldValue: personal.mobile.old, newValue: `${personal.mobile.new} (Dependency: ${personal.mobile.dependency || "Self"})` });
  }
  if (personal.address) {
    rows.push({ section: "Personal", field: "Address (Aadhaar via DigiLocker)", oldValue: addressText(personal.address.old), newValue: addressText(personal.address.new) });
  }

  const bank = changes.bank || {};
  for (const added of bank.added || []) {
    rows.push({ section: "Bank", field: "Add bank account", oldValue: "-", newValue: `${bankText(added)} (penny drop verified)` });
  }
  for (const removed of bank.removed || []) {
    rows.push({ section: "Bank", field: "Remove bank account", oldValue: bankText(removed), newValue: "Removed" });
  }
  if (bank.defaultAccount && bank.defaultAccount.old !== bank.defaultAccount.new) {
    rows.push({ section: "Bank", field: "Default bank account", oldValue: bank.defaultAccount.old || "-", newValue: bank.defaultAccount.new });
  }

  if (changes.segment) {
    rows.push({ section: "Segment", field: "Active segments", oldValue: segmentText(changes.segment.old), newValue: segmentText(changes.segment.new) });
  }
  if (changes.nominee) {
    rows.push({ section: "Nominee", field: "Nomination", oldValue: nomineeText(changes.nominee.old), newValue: nomineeText(changes.nominee.new) });
  }
  const others = changes.others || {};
  if (others.annualIncome) rows.push({ section: "Others", field: "Annual income", oldValue: others.annualIncome.old, newValue: others.annualIncome.new });
  if (others.netWorth) rows.push({ section: "Others", field: "Net worth", oldValue: others.netWorth.old, newValue: others.netWorth.new });
  return rows;
}

/**
 * The checks a request must pass before it can be eSigned (same checks as the onboarding portal).
 * Returns { ok, missing: [{ step, message }], needs: { selfie, financialProof, nameProof } }.
 */
function requirements(request) {
  const changes = request.changes || {};
  const verifications = request.verifications || {};
  const documents = request.documents || {};
  const selfie = request.selfie || {};
  const personal = changes.personal || {};
  const missing = [];

  const needs = {
    selfie: Boolean(verifications.digilocker?.completedAt),
    nameProof: Boolean(personal.name || personal.fatherName || personal.motherName),
    financialProof: Boolean(changes.segment && changes.segment.new?.NSE_FNO && !changes.segment.old?.NSE_FNO),
  };

  if (!listChanges(changes).length) missing.push({ step: "personal", message: "You have not made any change yet." });

  if (personal.name) {
    const check = verifications.panName;
    if (!check?.passed || String(check.name || "").toUpperCase() !== String(personal.name.new || "").toUpperCase()) {
      missing.push({ step: "personal", message: "The new name must match the name on your PAN (verify it again)." });
    }
  }
  if (needs.nameProof && !documents.nameProof?.url) {
    missing.push({ step: "document", message: "Upload a supporting proof for the name change." });
  }
  if (needs.financialProof && !documents.financialProof?.url) {
    missing.push({ step: "document", message: "Upload a financial proof to activate the FNO segment." });
  }
  if (needs.selfie && selfie.status !== "passed") {
    missing.push({ step: "document", message: "Complete the live selfie (required after DigiLocker)." });
  }
  if (changes.nominee?.new?.opted === "yes") {
    const nominees = changes.nominee.new.nominees || [];
    const total = nominees.reduce((sum, n) => sum + (Number(n.share) || 0), 0);
    if (!nominees.length || nominees.length > 3 || total !== 100) {
      missing.push({ step: "nominee", message: "Add 1 to 3 nominees whose shares add up to 100%." });
    }
  }
  if (!changes.declarations?.fatca) missing.push({ step: "segment", message: "Accept the FATCA / tax residency declaration." });

  return { ok: missing.length === 0, missing, needs };
}

module.exports = { listChanges, requirements, addressText, segmentText, nomineeText, SEGMENT_LABELS };
