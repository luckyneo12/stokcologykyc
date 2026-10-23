const backofficeService = require("../services/backofficeService");
const { unwrap, ANNUAL_INCOME, DEPENDENCY, isMock } = require("./clientProfile");

// Turns an approved ReKYC request into the back office modification call. The existing payload
// builder (shared with the Admin / Globe push) is used as-is; afterwards only the fields this
// request changed are adjusted, so unchanged sections stay exactly as the back office returned them.

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function finalBanks(profile, bankChanges = {}) {
  const removed = new Set((bankChanges.removed || []).map((b) => b.accountNumber));
  const banks = [...(profile.banks || []), ...(bankChanges.added || [])].filter((b) => !removed.has(b.accountNumber));
  const defaultNumber = bankChanges.defaultAccount?.new || profile.banks?.find((b) => b.isDefault)?.accountNumber;
  return banks.map((b) => ({ ...b, isDefault: b.accountNumber === defaultNumber }));
}

function buildApplication(request) {
  const profile = request.original_profile || {};
  const changes = request.changes || {};
  const personal = changes.personal || {};
  const others = changes.others || {};
  const banks = finalBanks(profile, changes.bank);
  const defaultBank = banks.find((b) => b.isDefault) || banks[0] || {};
  const newAddress = personal.address?.new;
  const segments = changes.segment?.new || profile.segments || {};
  const documents = request.documents || {};

  const docList = [];
  if (request.signed_pdf_url) docList.push({ type: "ESIGN_DOCUMENT", path: request.signed_pdf_url, name: "modification-form" });
  if (documents.nameProof?.url) docList.push({ type: "OTHER", path: documents.nameProof.url, name: "name-change-proof" });

  return {
    applicationId: request.id,
    personalDetails: {
      fullName: personal.name?.new || profile.name,
      fatherName: personal.fatherName?.new || profile.fatherName,
      motherName: personal.motherName?.new || profile.motherName,
      email: personal.email?.new || profile.email,
      phone: personal.mobile?.new || profile.mobile,
      networth: others.netWorth?.new || profile.netWorth,
    },
    identityDetails: {
      pan: profile.pan,
      ...(request.verifications?.digilocker?.aadhaar ? { aadhaar: request.verifications.digilocker.aadhaar } : {}),
    },
    address: newAddress
      ? { line1: newAddress.line1, line2: newAddress.line2, line3: newAddress.line3, city: newAddress.city, district: newAddress.district, state: newAddress.state, pincode: newAddress.pincode, country: "IN", addressProof: "01" }
      : {},
    bankDetails: {
      accountNumber: defaultBank.accountNumber,
      ifsc: defaultBank.ifsc,
      micr: defaultBank.micr,
      bankName: defaultBank.bankName,
      accountHolderName: defaultBank.holderName,
      accountType: defaultBank.accountType,
      branchAddress: defaultBank.branchAddress,
      city: defaultBank.city,
      state: defaultBank.state,
      verified: Boolean(defaultBank.verifiedAt),
    },
    segments: { equity: Boolean(segments.NSE_CAP), derivatives: Boolean(segments.NSE_FNO) },
    nomineeDetails: changes.nominee
      ? {
          opted: changes.nominee.new.opted === "yes" ? "yes" : "NO",
          nominees: (changes.nominee.new.nominees || []).map((n) => ({
            name: n.name, relation: n.relation, dob: n.dob, proofType: n.idType, proofNumber: n.idNumber,
            mobile: n.mobile, email: n.email, address: n.address,
          })),
        }
      : {},
    nomineeAllocation: changes.nominee ? { percentages: (changes.nominee.new.nominees || []).map((n) => Number(n.share) || 0) } : {},
    financialProof: documents.financialProof?.url ? { filePreview: documents.financialProof.url } : {},
    selfie: request.selfie?.status === "passed" ? request.selfie.url : null,
    documents: docList,
    user: { phone: personal.mobile?.new || profile.mobile, email: personal.email?.new || profile.email },
    createdAt: request.created_at,
    submittedAt: request.esigned_at,
  };
}

function buildPayload(request) {
  const raw = unwrap(request.original_data || {});
  const profile = request.original_profile || {};
  const changes = request.changes || {};
  const personal = changes.personal || {};
  const payload = backofficeService.buildModificationPayload(buildApplication(request), raw, request.client_code, "A");

  // Annual income: the label → back office code (01–05) directly
  if (changes.others?.annualIncome) {
    const code = ANNUAL_INCOME.find((i) => i.label === changes.others.annualIncome.new)?.code;
    if (code) {
      payload.KYCDetail.AnnualIncome = code;
      payload.KYCDetail.AnnualIncomeDate = today();
    }
  }

  // Contact dependency (Self / Spouse / Dependent children / parents) for a changed mobile or e-mail
  const dependencyCode = (label) => DEPENDENCY.find((d) => d.label === label)?.code || "S";
  for (const contact of payload.ContactDetail || []) {
    if (contact.ContactType === "M" && personal.mobile) {
      contact.RelatedTo = dependencyCode(personal.mobile.dependency);
      contact.ContactID = null;
    }
    if (contact.ContactType === "E" && personal.email) {
      contact.RelatedTo = dependencyCode(personal.email.dependency);
      contact.ContactID = null;
    }
  }

  // A different default bank is a new bank record, not an edit of the old one
  const existingDefault = (profile.banks || []).find((b) => b.isDefault);
  if (payload.BankDetail && existingDefault && payload.BankDetail.BankAccountNumber !== existingDefault.accountNumber) {
    const bank = buildApplication(request).bankDetails;
    Object.assign(payload.BankDetail, {
      BankID: null,
      BankMICR: bank.micr || null,
      ChequePrintName: bank.accountHolderName || null,
      BankName: bank.bankName || null,
      PennyDropStatus: bank.verified ? "Y" : "N",
    });
  }

  // Segments switched off are sent as inactive from today
  if (changes.segment) {
    const off = [];
    if (changes.segment.old?.NSE_CAP && !changes.segment.new?.NSE_CAP) off.push("CAP");
    if (changes.segment.old?.NSE_FNO && !changes.segment.new?.NSE_FNO) off.push("FNO");
    for (const segmentId of off) {
      payload.SegmentDetail = payload.SegmentDetail || [];
      payload.SegmentDetail.push({
        FirmID: payload.KYCDetail.FirmID, ClientCode: request.client_code, ExchangeID: "NSE", SegmentID: segmentId,
        ActiveDate: null, InactiveDate: today(), TradingAllow: "N",
      });
    }
  }

  // Nomination: unchanged → exactly what the back office has; changed → the new opt flag wins
  if (!changes.nominee) {
    if (raw.NomineeDetail) {
      payload.NomineeDetail = raw.NomineeDetail;
      if (raw.NomineeDetail.NomineeOptFlag) payload.BackOfficeDetail.NomineeOptFlag = raw.NomineeDetail.NomineeOptFlag;
    }
  } else {
    payload.BackOfficeDetail.NomineeOptFlag = payload.NomineeDetail.NomineeOptFlag;
  }

  return payload;
}

async function pushToBackoffice(request) {
  const payload = buildPayload(request);
  if (isMock()) {
    console.warn(`[ReKYC] REKYC_BACKOFFICE_MOCK=true — modification for ${request.client_code} NOT sent to the back office`);
    return { mock: true, message: "Mock mode: payload built, not sent", sections: Object.keys(payload) };
  }
  return backofficeService.submitClientModification(request.client_code, payload);
}

module.exports = { pushToBackoffice, buildPayload, finalBanks };
