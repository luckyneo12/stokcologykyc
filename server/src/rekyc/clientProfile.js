const backofficeService = require("../services/backofficeService");

// Reads a client's current record from the back office (GetOrionEKYCDetail) and turns it into
// the simple profile the ReKYC portal shows. The raw record is kept too (original_data), so the
// final modification is built on top of exactly what the back office returned.

const STATE_NAMES = {
  AN: "Andaman and Nicobar Islands", AP: "Andhra Pradesh", AR: "Arunachal Pradesh", AS: "Assam", BR: "Bihar",
  CH: "Chandigarh", CG: "Chhattisgarh", DN: "Dadra and Nagar Haveli", DD: "Daman and Diu", DL: "Delhi", GA: "Goa",
  GJ: "Gujarat", HR: "Haryana", HP: "Himachal Pradesh", JK: "Jammu and Kashmir", JH: "Jharkhand", KA: "Karnataka",
  KL: "Kerala", LA: "Ladakh", LD: "Lakshadweep", MP: "Madhya Pradesh", MH: "Maharashtra", MN: "Manipur",
  ML: "Meghalaya", MZ: "Mizoram", NL: "Nagaland", OR: "Odisha", PY: "Puducherry", PB: "Punjab", RJ: "Rajasthan",
  SK: "Sikkim", TN: "Tamil Nadu", TS: "Telangana", TR: "Tripura", UP: "Uttar Pradesh", UA: "Uttarakhand",
  UK: "Uttarakhand", WB: "West Bengal",
};

const ANNUAL_INCOME = [
  { code: "01", label: "Below 1 Lac" },
  { code: "02", label: "1-5 Lac" },
  { code: "03", label: "5-10 Lac" },
  { code: "04", label: "10-25 Lac" },
  { code: "05", label: "Above 25 Lac" },
];

const DEPENDENCY = [
  { code: "S", label: "Self" },
  { code: "SP", label: "Spouse" },
  { code: "DC", label: "Dependent Children" },
  { code: "DP", label: "Dependent Parents" },
];

const SEGMENTS = [
  { key: "NSE_CAP", exchange: "NSE", segment: "CAP", label: "CASH" },
  { key: "NSE_FNO", exchange: "NSE", segment: "FNO", label: "FNO" },
];

function str(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function unwrap(raw) {
  let data = raw;
  for (let i = 0; i < 3; i++) {
    if (Array.isArray(data) && data.length === 1) data = data[0];
    else if (data && typeof data === "object" && !data.KYCDetail) {
      const inner = data.Data || data.data || data.Result || data.result || data.ClientDetail;
      if (inner && typeof inner === "object") data = inner;
      else break;
    } else break;
  }
  return data && typeof data === "object" ? data : {};
}

function list(value, childKey) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value[childKey])) return value[childKey];
  if (value && typeof value === "object" && value[childKey] && typeof value[childKey] === "object") return [value[childKey]];
  if (value && typeof value === "object" && Object.keys(value).length) return [value];
  return [];
}

function formatDob(value) {
  const text = str(value);
  if (!text) return "";
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const dmy = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (dmy) return `${dmy[1]}-${dmy[2]}-${dmy[3]}`;
  return text;
}

function genderLabel(code) {
  const c = str(code).toUpperCase();
  if (c === "M" || c === "MALE") return "Male";
  if (c === "F" || c === "FEMALE") return "Female";
  if (c.startsWith("T")) return "Transgender";
  return str(code);
}

function maritalLabel(code) {
  const c = str(code).toUpperCase();
  return { M: "Married", U: "Unmarried", S: "Unmarried", D: "Divorced", W: "Widowed" }[c.charAt(0)] || str(code);
}

function dependencyLabel(code) {
  const c = str(code).toUpperCase() || "S";
  return DEPENDENCY.find((d) => d.code === c)?.label || c;
}

function incomeLabel(code) {
  const c = str(code).padStart(2, "0");
  return ANNUAL_INCOME.find((i) => i.code === c)?.label || str(code);
}

function stateName(value) {
  const v = str(value).toUpperCase();
  return STATE_NAMES[v] || str(value);
}

function isActiveSegment(entry) {
  const inactive = str(entry.InactiveDate || entry.InActiveDate);
  const allowed = str(entry.TradingAllow || "Y").toUpperCase();
  const active = str(entry.ActiveFlag || "Y").toUpperCase();
  return !inactive && allowed !== "N" && active !== "N";
}

// DDPI (Demat Debit and Pledge Instruction) on the client's demat account, from the back office record.
// A dedicated DDPI flag wins over the older POA flag. Returns "yes", "no" or "" when the record has neither.
const DDPI_KEYS = ["DDPIFlag", "DDPI", "DDPIStatus"];
const POA_KEYS = ["POAFlag"];

function flagValue(value) {
  const v = str(value).toUpperCase();
  if (["Y", "YES", "1", "TRUE"].includes(v)) return "yes";
  if (["N", "NO", "0", "FALSE"].includes(v)) return "no";
  return "";
}

function ddpiStatus(data) {
  const sources = [
    ...list(data.DepositoryDetail, "DepositoryDetail"),
    ...list(data.BackOfficeDetail, "BackOfficeDetail"),
    ...list(data.KYCDetail, "KYCDetail"),
  ];
  for (const keys of [DDPI_KEYS, POA_KEYS]) {
    const values = sources.flatMap((s) => keys.map((k) => flagValue(s[k]))).filter(Boolean);
    if (values.includes("yes")) return "yes";
    if (values.includes("no")) return "no";
  }
  return "";
}

function toProfile(rawRecord, clientCode) {
  const data = unwrap(rawRecord);
  const kyc = list(data.KYCDetail, "KYCDetail")[0] || {};
  const addresses = list(data.AddressDetail, "AddressDetail");
  const address = addresses.find((a) => str(a.AddressType).toUpperCase() === "C") || addresses[0] || {};
  const contacts = list(data.ContactDetail, "ContactDetail");
  const mobileContact = contacts.find((c) => str(c.ContactType).toUpperCase() === "M" && str(c.ContactNo)) || {};
  const emailContact = contacts.find((c) => str(c.ContactType).toUpperCase() === "E" && str(c.ContactEmail)) || {};
  const banks = list(data.BankDetail, "BankDetail");
  const backoffice = list(data.BackOfficeDetail, "BackOfficeDetail")[0] || {};
  const segments = list(data.SegmentDetail, "SegmentDetail");
  const nomineeBlock = data.NomineeDetail && !Array.isArray(data.NomineeDetail) ? data.NomineeDetail : {};
  const nominees = list(nomineeBlock.NomineeDetail || (Array.isArray(data.NomineeDetail) ? data.NomineeDetail : []), "NomineeDetail")
    .filter((n) => str(n.NomineeType || "N").toUpperCase() === "N");

  const aadhaarDigits = str(kyc.Aadhar || kyc.IDProofRef).replace(/\D/g, "");
  const clientStatus = str(kyc.ClientStatus || kyc.Status);

  return {
    clientCode: str(kyc.ClientCode) || clientCode,
    name: str(kyc.ClientName),
    accountStatus: ["01", "A", "Y", "ACTIVE", ""].includes(clientStatus.toUpperCase()) ? "ACTIVE" : clientStatus.toUpperCase(),
    pan: str(kyc.PanNo || kyc.PANNo).toUpperCase(),
    ckycNo: str(backoffice.CKYCRefNo || kyc.CKYCNo || kyc.CKYCRefNo),
    aadhaarLast4: aadhaarDigits.length >= 4 ? aadhaarDigits.slice(-4) : "",
    fatherName: str(kyc.FatherName),
    motherName: str(kyc.MotherName),
    dob: formatDob(kyc.Dob || kyc.DOB),
    gender: genderLabel(kyc.Gender),
    maritalStatus: maritalLabel(kyc.MaritalStatus),
    email: str(emailContact.ContactEmail || kyc.Email),
    emailDependency: dependencyLabel(emailContact.RelatedTo),
    mobile: str(mobileContact.ContactNo || kyc.MobileNo).replace(/\D/g, "").slice(-10),
    mobileDependency: dependencyLabel(mobileContact.RelatedTo),
    address: {
      line1: str(address.AddressLine1),
      line2: str(address.AddressLine2),
      line3: str(address.AddressLine3),
      city: str(address.AddressCity),
      district: str(address.District),
      state: stateName(address.AddressState),
      pincode: str(address.AddressPincode),
      country: str(address.AddressCountry) || "IN",
    },
    banks: banks
      .filter((b) => str(b.BankAccountNumber))
      .map((b, index) => ({
        bankName: str(b.BankName),
        accountNumber: str(b.BankAccountNumber),
        ifsc: str(b.BankIFSC).toUpperCase(),
        micr: str(b.BankMICR),
        accountType: str(b.BankAccountType),
        holderName: str(b.ChequePrintName),
        isDefault: str(b.PrimaryFlag).toUpperCase() === "Y" || (index === 0 && !banks.some((x) => str(x.PrimaryFlag).toUpperCase() === "Y")),
        dpType: "Demat and Trading",
      })),
    segments: Object.fromEntries(
      SEGMENTS.map((s) => [
        s.key,
        segments.some(
          (e) => str(e.ExchangeID).toUpperCase() === s.exchange && str(e.SegmentID).toUpperCase() === s.segment && isActiveSegment(e)
        ),
      ])
    ),
    nominee: {
      opted: str(nomineeBlock.NomineeOptFlag || backoffice.NomineeOptFlag).toUpperCase() === "Y" || nominees.length > 0 ? "yes" : "no",
      nominees: nominees.map((n) => ({
        name: str(n.Name),
        relation: str(n.Relation),
        dob: formatDob(n.DOB),
        share: Number(n.SharePercentage) || 0,
      })),
    },
    annualIncome: incomeLabel(kyc.AnnualIncome),
    netWorth: str(kyc.NetWorth),
    ddpi: ddpiStatus(data),
  };
}

function mockRecord(clientCode) {
  const mobile = str(process.env.REKYC_MOCK_MOBILE).replace(/\D/g, "").slice(-10);
  if (mobile.length !== 10) {
    throw new Error("REKYC_BACKOFFICE_MOCK is on but REKYC_MOCK_MOBILE (a 10-digit test number you own) is not set.");
  }
  return {
    KYCDetail: {
      ClientCode: clientCode, ClientName: "TEST CLIENT", PanNo: "ABCDE1234F", Dob: "1991-05-20",
      FatherName: "TEST FATHER", MotherName: "TEST MOTHER", Gender: "M", MaritalStatus: "M",
      AnnualIncome: "03", NetWorth: "10000", ClientStatus: "01", Aadhar: "XXXXXXXX1234",
    },
    AddressDetail: [{
      AddressType: "C", AddressLine1: "123 TEST STREET", AddressLine2: "TEST AREA", AddressCity: "INDORE",
      District: "INDORE", AddressState: "MP", AddressPincode: "452009", AddressCountry: "IN",
    }],
    ContactDetail: [
      { ContactType: "M", ContactNo: mobile, RelatedTo: "S" },
      ...(process.env.REKYC_MOCK_EMAIL ? [{ ContactType: "E", ContactEmail: process.env.REKYC_MOCK_EMAIL, RelatedTo: "S" }] : []),
    ],
    BankDetail: [{
      BankName: "TEST BANK", BankAccountNumber: "000011112222", BankIFSC: "SBIN0000001", PrimaryFlag: "Y",
      BankAccountType: "S", ChequePrintName: "TEST CLIENT",
    }],
    SegmentDetail: [
      { ExchangeID: "NSE", SegmentID: "CAP", TradingAllow: "Y" },
      { ExchangeID: "NSE", SegmentID: "FNO", TradingAllow: "Y" },
    ],
    NomineeDetail: { NomineeOptFlag: "O", NomineeDetail: [] },
    DepositoryDetail: [{ DepositoryType: "CDSL", POAFlag: "N", PrimaryFlag: "Y" }],
    BackOfficeDetail: { CKYCRefNo: "TESTCKYC0001" },
  };
}

function isMock() {
  return String(process.env.REKYC_BACKOFFICE_MOCK || "").toLowerCase() === "true";
}

/** Returns { raw, profile } or null when the back office has no such client. */
async function fetchClient(clientCode) {
  let raw;
  if (isMock()) {
    console.warn(`[ReKYC] REKYC_BACKOFFICE_MOCK=true — using test data for ${clientCode}`);
    raw = mockRecord(clientCode);
  } else {
    try {
      raw = await backofficeService.fetchExistingClientDetail(clientCode, "A");
    } catch (error) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  }
  const profile = toProfile(raw, clientCode);
  if (!profile.name && !profile.pan) return null;
  return { raw, profile };
}

module.exports = { fetchClient, toProfile, unwrap, ANNUAL_INCOME, DEPENDENCY, SEGMENTS, STATE_NAMES, isMock };
