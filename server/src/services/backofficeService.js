const axios = require("axios");
const fs = require("fs");
const path = require("path");

const BACKOFFICE_BASE_URL = (process.env.BACKOFFICE_BASE_URL || "http://61.247.230.203:15000/api").replace(/\/+$/, "");
const BACKOFFICE_USERNAME = process.env.BACKOFFICE_USERNAME;
const BACKOFFICE_PASSWORD = process.env.BACKOFFICE_PASSWORD;
const BACKOFFICE_FIRM_ID = Object.prototype.hasOwnProperty.call(process.env, "BACKOFFICE_FIRM_ID")
  ? process.env.BACKOFFICE_FIRM_ID
  : "1001";
const BACKOFFICE_FINANCIAL_YEAR = Object.prototype.hasOwnProperty.call(process.env, "BACKOFFICE_FINANCIAL_YEAR")
  ? process.env.BACKOFFICE_FINANCIAL_YEAR
  : "";
const BACKOFFICE_MODIFY_PATH = process.env.BACKOFFICE_MODIFY_PATH || "Masters/OrionEKYCModifyService";
const BACKOFFICE_BRANCH_ID = process.env.BACKOFFICE_BRANCH_ID || "HO";
const BACKOFFICE_SUB_BRANCH_ID = process.env.BACKOFFICE_SUB_BRANCH_ID || "HO1";

let tokenCache = {
  accessToken: null,
  expiresAt: 0,
};

function parseJsonField(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function formatDate(value) {
  if (!value) return null;
  if (typeof value !== "string") value = String(value);
  
  // Handle DD/MM/YYYY format from Digilocker
  if (value.includes("/")) {
    const parts = value.split("/");
    if (parts.length === 3 && parts[2].length === 4) {
      // Convert to YYYY-MM-DD
      value = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
}

function buildString(value) {
  if (value === undefined || value === null) return null;
  return String(value).trim() || null;
}

function stripDataUri(value) {
  const raw = buildString(value);
  if (!raw) return null;
  
  if (raw.startsWith("/uploads/")) {
    try {
      const rootPath = path.join(__dirname, "../../", raw.replace(/^\//, ""));
      const publicPath = path.join(__dirname, "../../public", raw.replace(/^\//, ""));
      if (fs.existsSync(rootPath)) {
        return "data:image/jpeg;base64," + fs.readFileSync(rootPath, "base64");
      } else if (fs.existsSync(publicPath)) {
        return "data:image/jpeg;base64," + fs.readFileSync(publicPath, "base64");
      }
    } catch (err) {
      console.warn("Could not read local file for base64 conversion:", raw, err.message);
    }
    return null;
  }

  // The manual explicitly shows pure base64 without prefixes
  // Example: "DocData": "iVBORw0KGgo..."
  const commaIndex = raw.indexOf(",");
  return raw.startsWith("data:") && commaIndex >= 0 ? raw.slice(commaIndex + 1) : raw;
}

function pickFirst(...values) {
  for (const value of values) {
    const picked = buildString(value);
    if (picked) return picked;
  }
  return null;
}

function arrayFromBackoffice(value, childKey) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[childKey])) return value[childKey];
  return [];
}

function mapGender(value) {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  if (["M", "MALE"].includes(normalized)) return "M";
  if (["F", "FEMALE"].includes(normalized)) return "F";
  if (normalized.includes("TRANS")) return "T";
  return normalized.charAt(0);
}

function mapNomineeGender(value) {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  if (["M", "MALE"].includes(normalized)) return "M";
  if (["F", "FEMALE"].includes(normalized)) return "F";
  if (normalized.includes("TRANS")) return "TG";
  return normalized.charAt(0);
}

function mapMaritalStatus(value) {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  if (["MARRIED", "M"].includes(normalized)) return "M";
  if (["UNMARRIED", "U", "SINGLE"].includes(normalized)) return "U";
  if (["DIVORCE", "DIVORCED", "D"].includes(normalized)) return "D";
  if (["WIDOW", "WIDOWER", "WIDOWED", "W"].includes(normalized)) return "W";
  return normalized.charAt(0);
}

function mapAccountType(value) {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  if (["10", "S", "SAVING", "SAVINGS", "SAVING ACCOUNT"].includes(normalized)) return "S";
  if (["11", "C", "CURRENT", "CURRENT ACCOUNT"].includes(normalized)) return "C";
  if (["O", "OTHER", "OTHER ACCOUNT"].includes(normalized)) return "O";
  return normalized;
}

function mapYesNo(value, defaultValue = null) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value ? "Y" : "N";
  const normalized = String(value).trim().toUpperCase();
  if (["Y", "YES", "TRUE", "1", "OPT-IN"].includes(normalized)) return "Y";
  if (["N", "NO", "FALSE", "0", "OPT-OUT"].includes(normalized)) return "N";
  return defaultValue;
}

function mapNomineeOptFlag(nomineeDetails) {
  const opted = String(nomineeDetails?.opted || "").trim().toUpperCase();
  if (["NO", "N", "OPT-OUT"].includes(opted)) return "O";
  if (Array.isArray(nomineeDetails?.nominees) && nomineeDetails.nominees.length > 0) return "Y";
  return "N";
}

function mapRelation(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const relationMap = {
    brother: "B",
    daughter: "G",
    father: "F",
    mother: "M",
    self: "S",
    sister: "SI",
    son: "SO",
    spouse: "SP",
    wife: "SP",
    husband: "SP",
    other: "O",
  };
  return relationMap[normalized] || buildString(value) || "NP";
}

function mapProofType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized.includes("AADHAAR") || normalized.includes("UID")) return "05";
  if (normalized.includes("PAN")) return "03";
  if (normalized.includes("PASSPORT")) return "01";
  if (normalized.includes("DRIVING")) return "04";
  if (normalized.includes("VOTER")) return "02";
  return null;
}

function mapNomineeAddressProof(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized.includes("AADHAAR") || normalized.includes("UID")) return "01";
  if (normalized.includes("PASSPORT")) return "02";
  if (normalized.includes("DRIVING")) return "03";
  if (normalized.includes("VOTER")) return "04";
  if (normalized.includes("NREGA")) return "05";
  if (normalized.includes("BANK")) return "06";
  if (normalized.includes("GAS")) return "07";
  if (normalized.includes("TELEPHONE")) return "08";
  if (normalized.includes("ELECTRICITY") || normalized.includes("BILL")) return "09";
  return null;
}

function mapState(value) {
  const normalized = String(value || "").trim().toUpperCase();
  const stateMap = {
    "ANDHRA PRADESH": "AP",
    "ARUNACHAL PRADESH": "AR",
    ASSAM: "AS",
    BIHAR: "BR",
    CHANDIGARH: "CH",
    CHHATTISGARH: "CG",
    DELHI: "DL",
    GOA: "GA",
    GUJARAT: "GJ",
    HARYANA: "HR",
    "HIMACHAL PRADESH": "HP",
    JHARKHAND: "JH",
    KARNATAKA: "KA",
    KERALA: "KL",
    "MADHYA PRADESH": "MP",
    MAHARASHTRA: "MH",
    MANIPUR: "MN",
    MEGHALAYA: "ML",
    MIZORAM: "MZ",
    NAGALAND: "NL",
    ODISHA: "OR",
    ORISSA: "OR",
    PUNJAB: "PB",
    RAJASTHAN: "RJ",
    SIKKIM: "SK",
    "TAMIL NADU": "TN",
    TELANGANA: "TS",
    TRIPURA: "TR",
    "UTTAR PRADESH": "UP",
    UTTARAKHAND: "UA",
    "WEST BENGAL": "WB",
  };
  if (normalized.length <= 3) return normalized || null;
  return stateMap[normalized] || normalized.slice(0, 2);
}

function mapEducation(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("high")) return "01";
  if (normalized.includes("post")) return "03";
  if (normalized.includes("doctor")) return "04";
  if (normalized.includes("professional")) return "05";
  if (normalized.includes("under")) return "06";
  if (normalized.includes("illiterate")) return "07";
  if (normalized.includes("graduate")) return "02";
  if (normalized) return "08";
  return null;
}

function mapAnnualIncome(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("below") || normalized.includes("<1")) return "01";
  if (normalized.includes("1") && normalized.includes("5")) return "02";
  if (normalized.includes("5") && normalized.includes("10")) return "03";
  if (normalized.includes("10") && normalized.includes("25")) return "04";
  if (normalized.includes("25")) return "05";
  return null;
}

function mapOccupation(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("public")) return "01";
  if (normalized.includes("private")) return "02";
  if (normalized.includes("government")) return "03";
  if (normalized.includes("professional")) return "04";
  if (normalized.includes("self")) return "05";
  if (normalized.includes("retired")) return "06";
  if (normalized.includes("house")) return "07";
  if (normalized.includes("student")) return "08";
  if (normalized.includes("business")) return "09";
  return "99";
}

function mapPep(value) {
  return mapYesNo(value, "N") === "Y" ? "01" : "03";
}

function buildAddressLines(address = {}) {
  const fullAddress = pickFirst(address.fullAddress, address.address);
  if (fullAddress && !address.line1 && !address.addressLine1) {
    return {
      line1: fullAddress.slice(0, 100),
      line2: fullAddress.slice(100, 200) || null,
      line3: fullAddress.slice(200, 300) || null,
    };
  }

  return {
    line1: pickFirst(address.line1, address.addressLine1)?.slice(0, 100) || null,
    line2: pickFirst(address.line2, address.addressLine2)?.slice(0, 100) || null,
    line3: pickFirst(address.line3, address.addressLine3)?.slice(0, 100) || null,
  };
}

class BackofficeService {
  async getToken() {
    const now = Date.now();
    if (tokenCache.accessToken && tokenCache.expiresAt > now + 60 * 1000) {
      return tokenCache.accessToken;
    }

    if (!BACKOFFICE_USERNAME || !BACKOFFICE_PASSWORD) {
      throw new Error("Backoffice credentials are not configured in BACKOFFICE_USERNAME and BACKOFFICE_PASSWORD");
    }

    const url = `${BACKOFFICE_BASE_URL}/token`;
    const body = new URLSearchParams({
      UserName: BACKOFFICE_USERNAME,
      Password: BACKOFFICE_PASSWORD,
      Grant_type: "password",
    }).toString();

    const response = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 60000,
    });

    const token = response.data?.access_token;
    const expiresIn = Number(response.data?.expires_in) || 3600;
    if (!token) {
      throw new Error("Backoffice token response did not contain access_token");
    }

    tokenCache = {
      accessToken: token,
      expiresAt: now + expiresIn * 1000,
    };

    return token;
  }

  async requestHeaders() {
    const token = await this.getToken();
    return {
      FIRMID: BACKOFFICE_FIRM_ID,
      FINANCIALYEAR: BACKOFFICE_FINANCIAL_YEAR,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  async fetchExistingClientDetail(clientCode, clientType = "A") {
    const url = `${BACKOFFICE_BASE_URL}/GetOrionEKYCDetail/Get?Code=${encodeURIComponent(clientCode)}&ClientType=${encodeURIComponent(clientType)}`;
    const response = await axios.get(url, {
      headers: await this.requestHeaders(),
      timeout: 60000,
    });
    return response.data;
  }

  async submitClientModification(clientCode, payload) {
    if (payload && Array.isArray(payload.ClientDocumentDetail)) {
      const promises = payload.ClientDocumentDetail.map(async (doc) => {
        if (doc.FilePath && !doc.DocData) {
          if (doc.FilePath.startsWith("http")) {
            try {
              const res = await axios.get(doc.FilePath, { responseType: 'arraybuffer' });
              doc.DocData = Buffer.from(res.data, 'binary').toString('base64');
              doc.FilePath = null;
            } catch (e) {
              console.error(`Failed to fetch image for backoffice: ${doc.FilePath}`, e.message);
            }
          } else {
            // Bypass: If it's not a URL, assume it's already raw Base64/XML from Digilocker
            doc.DocData = doc.FilePath;
            doc.FilePath = null;
          }
        }
      });
      await Promise.all(promises);
    }

    const url = `${BACKOFFICE_BASE_URL}/${BACKOFFICE_MODIFY_PATH}`;
    const response = await axios.post(url, payload, {
      headers: await this.requestHeaders(),
      timeout: 60000,
    });
    return response.data;
  }

  deriveClientCode(application, requestedClientCode) {
    const nsdlResponse = parseJsonField(application.nsdlResponse, {});
    return pickFirst(requestedClientCode, application.clientCode, nsdlResponse.clientId, nsdlResponse.ClientCode, application.clientId, application.applicationId);
  }

  buildModificationPayload(application, existingData = {}, clientCode, clientType = "A") {
    const existing = parseJsonField(existingData, {});
    const personalDetails = parseJsonField(application.personalDetails, {});
    const identityDetails = parseJsonField(application.identityDetails, {});
    const address = parseJsonField(application.address, {});
    const bankDetails = parseJsonField(application.bankDetails, {});
    const documents = parseJsonField(application.documents, []);
    const nomineeDetails = parseJsonField(application.nomineeDetails, {});
    const nomineeAllocation = parseJsonField(application.nomineeAllocation, {});
    const signature = parseJsonField(application.signature, {});
    const panUpload = parseJsonField(application.panUpload, {});
    const financialProof = parseJsonField(application.financialProof, {});
    const selfieDetails = parseJsonField(application.selfieDetails, {});
    const segments = parseJsonField(application.segments, {});
    const nsdlResponse = parseJsonField(application.nsdlResponse, {});
    const openDate = formatDate(application.submittedAt || application.createdAt || new Date());

    const existingKycArray = arrayFromBackoffice(existing.KYCDetail, "KYCDetail");
    const existingKyc = existingKycArray[0] || {};
    const existingAddress = arrayFromBackoffice(existing.AddressDetail, "AddressDetail")[0] || {};
    const existingContact = arrayFromBackoffice(existing.ContactDetail, "ContactDetail")[0] || {};
    const existingBank = (Array.isArray(existing.BankDetail) ? existing.BankDetail[0] : existing.BankDetail?.BankDetail) || {};
    const existingBackoffice = (Array.isArray(existing.BackOfficeDetail) ? existing.BackOfficeDetail[0] : existing.BackOfficeDetail?.BackOfficeDetail) || {};
    const addressLines = buildAddressLines(address);
    const nomineeOptFlag = mapNomineeOptFlag(nomineeDetails);
    const phoneValue = pickFirst(personalDetails.phone, application.user?.phone, existingContact.ContactNo, existingKyc.MobileNo);
    const emailValue = pickFirst(personalDetails.email, application.user?.email, existingContact.ContactEmail, existingKyc.Email);
    const aadhaar = pickFirst(identityDetails.aadhaar, identityDetails.aadhar, existingKyc.Aadhar, existingKyc.IDProofRef);

    const mergedKyc = {
      FirmID: existingKyc.FirmID || BACKOFFICE_FIRM_ID,
      ClientCode: clientCode,
      OpenDate: formatDate(existingKyc.OpenDate) || openDate,
      CloseDate: formatDate(existingKyc.CloseDate) || null,
      PanNo: buildString(identityDetails.pan || existingKyc.PanNo || existingKyc.PANNo)?.toUpperCase() || null,
      ClientType: existingKyc.ClientType || "I",
      ClientStatus: existingKyc.ClientStatus || "01",
      ClientName: buildString(personalDetails.fullName || existingKyc.ClientName) || null,
      Dob: formatDate(personalDetails.dob || identityDetails.dob || identityDetails.dateOfBirth || identityDetails.ocrData?.pan?.dob || nsdlResponse.dob || nsdlResponse.dateOfBirth || existingKyc.Dob || existingKyc.DOB) || null,
      FatherOrSpouse: existingKyc.FatherOrSpouse || "F",
      FatherPrefix: existingKyc.FatherPrefix || "Mr",
      FatherName: buildString(personalDetails.fatherName || existingKyc.FatherName) || null,
      MotherPrefix: existingKyc.MotherPrefix || "Mrs",
      MotherName: buildString(personalDetails.motherName || existingKyc.MotherName) || null,
      MaidenName: existingKyc.MaidenName || null,
      Gender: mapGender(personalDetails.gender || existingKyc.Gender) || null,
      MaritalStatus: mapMaritalStatus(personalDetails.maritalStatus || existingKyc.MaritalStatus) || null,
      ResidentialStatus: existingKyc.ResidentialStatus || "RI",
      Citizenship: existingKyc.Citizenship || "IN",
      IDProof: existingKyc.IDProof || (aadhaar ? "05" : null),
      IDProofRef: aadhaar,
      Aadhar: aadhaar,
      AnnualIncome: mapAnnualIncome(personalDetails.annualIncome) || existingKyc.AnnualIncome || null,
      AnnualIncomeDate: formatDate(existingKyc.AnnualIncomeDate) || openDate,
      NetWorth: parseInt(existingKyc.NetWorth || personalDetails.networth, 10) || null,
      NetWorthDate: formatDate(existingKyc.NetWorthDate || personalDetails.networthDate) || openDate,
      Occupation: mapOccupation(personalDetails.occupation) || existingKyc.Occupation || null,
      PEP: mapPep(personalDetails.politicallyExposed || existingKyc.PEP),
      FamilyGroup: existingKyc.FamilyGroup || "Y",
      AadharSeeded: existingKyc.AadharSeeded || "Y",
      BranchID: existingKyc.BranchID || BACKOFFICE_BRANCH_ID,
      SubBranchID: existingKyc.SubBranchID || BACKOFFICE_SUB_BRANCH_ID,
      TypeOfDoc: existingKyc.TypeOfDoc || "04",
      Status: existingKyc.Status || "Y",
    };

    const addressEntry = {
      AddressID: existingAddress.AddressID || null,
      FirmID: existingAddress.FirmID || BACKOFFICE_FIRM_ID,
      ClientCode: clientCode,
      AddressType: existingAddress.AddressType || "C",
      AddressLine1: addressLines.line1 || existingAddress.AddressLine1 || null,
      AddressLine2: addressLines.line2 || existingAddress.AddressLine2 || null,
      AddressLine3: addressLines.line3 || existingAddress.AddressLine3 || null,
      AddressCity: buildString(address.city || address.cityName || existingAddress.AddressCity) || null,
      AddressPincode: buildString(address.pincode || address.postalCode || existingAddress.AddressPincode) || null,
      District: buildString(address.district || existingAddress.District || address.city) || null,
      AddressState: mapState(address.state || existingAddress.AddressState) || null,
      AddressCountry: buildString(address.country || existingAddress.AddressCountry) === "India" ? "IN" : buildString(address.country || existingAddress.AddressCountry) || "IN",
      AddressPrimary: existingAddress.AddressPrimary || "Y",
      AddressProof: buildString(address.addressProof || existingAddress.AddressProof) || (aadhaar ? "01" : null),
      AddressProofOther: buildString(address.addressProofOther || existingAddress.AddressProofOther) || null,
      AddressProofDate: formatDate(address.addressProofDate || existingAddress.AddressProofDate) || openDate,
      AddressProofExpiry: formatDate(address.addressProofExpiry || existingAddress.AddressProofExpiry) || null,
      AddressProofRef: buildString(address.addressProofRef || existingAddress.AddressProofRef || aadhaar) || null,
      AddressStateOther: existingAddress.AddressStateOther || null,
      Delete: "N",
      AddressProofIssuedBy: existingAddress.AddressProofIssuedBy || "UIDAI",
      SameAsCorrespondence: existingAddress.SameAsCorrespondence || "Y",
    };

    const permanentAddressEntry = {
      ...addressEntry,
      AddressID: null,
      AddressType: "P",
    };

    const addressEntries = [addressEntry, permanentAddressEntry];

    const contactEntries = [];

    if (emailValue) {
      contactEntries.push({
        ContactID: existingContact.ContactID || null,
        FirmID: existingContact.FirmID || BACKOFFICE_FIRM_ID,
        ClientCode: clientCode,
        ContactType: "E",
        ISD: null,
        STD: null,
        ContactNo: null,
        ContactEmail: emailValue,
        PrimaryFlag: "Y",
        ActiveFlag: "Y",
        InactiveDate: null,
        Remark: null,
        Delete: "N",
        RelatedTo: "S",
      });
    }

    if (phoneValue) {
      contactEntries.push({
        ContactID: existingContact.ContactID || null,
        FirmID: existingContact.FirmID || BACKOFFICE_FIRM_ID,
        ClientCode: clientCode,
        ContactType: "M",
        ISD: "91",
        STD: null,
        ContactNo: phoneValue,
        ContactEmail: null,
        PrimaryFlag: "Y",
        ActiveFlag: "Y",
        InactiveDate: null,
        Remark: null,
        Delete: "N",
        RelatedTo: "S",
      });
    }

    const bankEntry = {
      BankID: existingBank.BankID || null,
      FirmID: existingBank.FirmID || BACKOFFICE_FIRM_ID,
      ClientCode: clientCode,
      PrimaryFlag: "Y",
      BankAccountNumber: buildString(bankDetails.accountNumber || existingBank.BankAccountNumber) || null,
      BankAccountType: mapAccountType(bankDetails.accountType || existingBank.BankAccountType) || "S",
      BankIFSC: buildString(bankDetails.ifsc || existingBank.BankIFSC) || null,
      BankMICR: buildString(bankDetails.micr || existingBank.BankMICR) || null,
      ChequePrintName: buildString(bankDetails.accountHolderName || existingBank.ChequePrintName) || null,
      BankCode: buildString(bankDetails.bankCode || existingBank.BankCode) || "NA",
      BankName: buildString(bankDetails.bankName || existingBank.BankName) || null,
      BankAddress1: buildString(bankDetails.branchAddress || bankDetails.address1 || existingBank.BankAddress1) || "NOT PROVIDED",
      BankAddress2: buildString(bankDetails.address2 || existingBank.BankAddress2) || null,
      BankAddress3: buildString(bankDetails.address3 || existingBank.BankAddress3) || null,
      BankCity: buildString(bankDetails.city || existingBank.BankCity) || "NOT PROVIDED",
      BankPincode: buildString(bankDetails.pincode || existingBank.BankPincode || address.pincode || address.postalCode || existingAddress.AddressPincode) || "000000",
      BankState: mapState(bankDetails.state || existingBank.BankState) || mapState(address.state || existingAddress.AddressState) || "OT",
      BankSateOther: existingBank.BankSateOther || null,
      BankCountry: buildString(bankDetails.country || existingBank.BankCountry) || "IN",
      PennyDropStatus: existingBank.PennyDropStatus || (bankDetails.verified === false ? "N" : "Y"),
      PaymentMode: existingBank.PaymentMode || null,
      ECSMandateDate: formatDate(existingBank.ECSMandateDate) || null,
      ECSFromDate: formatDate(existingBank.ECSFromDate) || null,
      ECSToDate: formatDate(existingBank.ECSToDate) || null,
      ECSUntilCancel: existingBank.ECSUntilCancel || null,
      ECSStatus: existingBank.ECSStatus || null,
      ECSFrequency: existingBank.ECSFrequency || null,
      ECSLimit: existingBank.ECSLimit || null,
      AutoDebit: existingBank.AutoDebit || null,
      RejectionReason: existingBank.RejectionReason || null,
      RBIApprovalNo: existingBank.RBIApprovalNo || null,
      PISAccountNo: existingBank.PISAccountNo || null,
      BankShortCode: existingBank.BankShortCode || null,
      PGCode: existingBank.PGCode || null,
      BankDomain: existingBank.BankDomain || null,
      FundMandate: existingBank.FundMandate || null,
      TradingAccountType: existingBank.TradingAccountType || null,
    };

    const existingDepositoryArray = arrayFromBackoffice(existing.DepositoryDetail, "DepositoryDetail");
    const depositoryEntries = existingDepositoryArray.length > 0 ? existingDepositoryArray.map(dep => ({
      ...dep,
      FirmID: dep.FirmID || BACKOFFICE_FIRM_ID,
      ClientCode: clientCode,
    })) : (application.boid ? [
      {
        FirmID: BACKOFFICE_FIRM_ID,
        ClientCode: clientCode,
        DepositoryType: application.boid.startsWith('IN') ? 'NSDL' : 'CDSL',
        DepositoryID: application.boid.substring(0, 8),
        DepositoryClientID: application.boid.substring(8),
        POAFlag: "N",
        POAMarginFlag: "N",
        PrimaryFlag: "Y",
      }
    ] : []);

    const brokerageMappingDetail = {
      FirmID: BACKOFFICE_FIRM_ID,
      ClientCode: clientCode,
      CurrencySlabID: existing.BrokerageMappingDetail?.CurrencySlabID || null,
      CapitalSlabID: existing.BrokerageMappingDetail?.CapitalSlabID || null,
      CommoditySlabID: existing.BrokerageMappingDetail?.CommoditySlabID || null,
      DerivativeSlabID: existing.BrokerageMappingDetail?.DerivativeSlabID || null,
      CurrencyFlag: "N",
      CapitalFlag: "Y",
      CommodityFlag: "N",
      DerivativeFlag: segments.derivatives ? "Y" : "N",
    };

    const activeDate = openDate;
    const exchangeEntries = [
      { ExchangeID: "NSE", CategoryCode: "1" },
      { ExchangeID: "BSE", CategoryCode: "I" },
    ].map((exchange) => ({
      FirmID: BACKOFFICE_FIRM_ID,
      ClientCode: clientCode,
      ExchangeName: null,
      Remark: null,
      ActiveFlag: "Y",
      UCC: clientCode,
      ...exchange,
    }));

    const segmentEntries = [
      { ExchangeID: "NSE", SegmentID: "CAP", enabled: segments.equity !== false },
      { ExchangeID: "BSE", SegmentID: "CAP", enabled: segments.equity !== false },
      { ExchangeID: "NSE", SegmentID: "FNO", enabled: Boolean(segments.derivatives) },
    ]
      .filter((segment) => segment.enabled)
      .map(({ enabled, ...segment }) => ({
        FirmID: BACKOFFICE_FIRM_ID,
        ClientCode: clientCode,
        ExchangeName: null,
        SegmentName: null,
        ActiveDate: activeDate,
        InactiveDate: null,
        TradingAllow: "Y",
        Remarks: null,
        Chnage: null,
        CPCode: null,
        CMID: null,
        UCCExported: "N",
        UCCExportDate: null,
        UCCExportBy: null,
        UCCSuccess: "N",
        UCCClassification: null,
        ...segment,
      }));

    const nomineeEntries = nomineeOptFlag === "Y" ? (nomineeDetails.nominees || []).flatMap((nominee, index) => {
      const allocation = nomineeAllocation.percentages?.[index] ?? (index === 0 ? 100 : 0);
      const nomineeProof = mapProofType(nominee.proofType);
      const nomineeAddressProof = mapNomineeAddressProof(nominee.proofType);
      
      const entries = [];
      const nomineeEntry = {
        FirmID: BACKOFFICE_FIRM_ID,
        ClientCode: clientCode,
        NomineeType: "N",
        Relation: mapRelation(nominee.relation).substring(0, 5),
        PreFix: nominee.prefix || null,
        Name: buildString(nominee.name),
        FatherSpouse: "F",
        FatherPreFix: null,
        FatherName: null,
        MotherPreFix: null,
        MotherName: null,
        MaidenPreFix: null,
        MaidenName: null,
        DOB: formatDate(nominee.dob),
        PANNO: nomineeProof === "03" ? buildString(nominee.proofNumber)?.toUpperCase() : null,
        UID: nomineeProof === "05" ? buildString(nominee.proofNumber) : null,
        Gender: mapNomineeGender(nominee.gender),
        NomineeGender: mapNomineeGender(nominee.gender),
        MaritalStatus: mapMaritalStatus(nominee.maritalStatus),
        ResidentialStatus: "RI",
        Nationnality: "IN",
        Occupation: null,
        OccupationOther: null,
        IDProof: nomineeProof,
        IDProofRefNo: buildString(nominee.proofNumber),
        Address1: buildString(nominee.address || addressEntry.AddressLine1)?.substring(0, 100) || null,
        Address2: buildString(nominee.address2 || addressEntry.AddressLine2),
        Address3: buildString(nominee.address3 || addressEntry.AddressLine3),
        City: buildString(nominee.city || addressEntry.AddressCity),
        Pincode: buildString(nominee.pincode || addressEntry.AddressPincode),
        District: buildString(nominee.district || addressEntry.District),
        State: mapState(nominee.state || addressEntry.AddressState),
        StateOther: null,
        Country: buildString(nominee.country) === "India" ? "IN" : buildString(nominee.country) || "IN",
        AddressProof: nomineeAddressProof,
        AddressProofOther: null,
        AddressProofRef: nomineeAddressProof ? buildString(nominee.proofNumber) : null,
        AddressProofDate: null,
        AddressProofDateExpiry: null,
        Delete: "N",
        SharePercentage: Number(allocation) || 0,
          EmailID: buildString(nominee.email),
          ISD: "91",
          Mobile: buildString(nominee.mobile),
          MinorInd: nominee.guardianName ? "Y" : "N",
          NomineeSerialNo: index + 1,
          NomineeStatusFlag: "S",
        NomineeStatusCheck: null,
      };
      entries.push(nomineeEntry);

      if (nominee.guardianName) {
        const guardianProof = mapProofType(nominee.guardianProofType || nominee.guardianProof);
        const guardianAddressProof = mapNomineeAddressProof(nominee.guardianProofType || nominee.guardianProof);
        entries.push({
          FirmID: BACKOFFICE_FIRM_ID,
          ClientCode: clientCode,
          NomineeType: "NG",
          Relation: mapRelation(nominee.guardianRelation).substring(0, 5),
          PreFix: null,
          Name: buildString(nominee.guardianName),
          FatherSpouse: "F",
          FatherPreFix: null,
          FatherName: null,
          MotherPreFix: null,
          MotherName: null,
          MaidenPreFix: null,
          MaidenName: null,
          DOB: formatDate(nominee.guardianDob) || null,
          PANNO: guardianProof === "03" ? buildString(nominee.guardianProofNumber)?.toUpperCase() : null,
          UID: guardianProof === "05" ? buildString(nominee.guardianProofNumber) : null,
          Gender: null,
          MaritalStatus: null,
          ResidentialStatus: "RI",
          Nationnality: "IN",
          Occupation: null,
          OccupationOther: null,
          IDProof: guardianProof,
          IDProofRefNo: buildString(nominee.guardianProofNumber),
          Address1: buildString(nominee.guardianAddress || nomineeEntry.Address1)?.substring(0, 100) || null,
          Address2: buildString(nominee.guardianAddress2 || nomineeEntry.Address2),
          Address3: buildString(nominee.guardianAddress3 || nomineeEntry.Address3),
          City: buildString(nominee.guardianCity || nomineeEntry.City),
          Pincode: buildString(nominee.guardianPincode || nomineeEntry.Pincode),
          District: buildString(nominee.guardianDistrict || nomineeEntry.District),
          State: mapState(nominee.guardianState || nomineeEntry.State),
          StateOther: null,
          Country: "IN",
          AddressProof: guardianAddressProof,
          AddressProofOther: null,
          AddressProofRef: guardianAddressProof ? buildString(nominee.guardianProofNumber) : null,
          AddressProofDate: null,
          AddressProofDateExpiry: null,
          Delete: "N",
          SharePercentage: 0,
          EmailID: buildString(nominee.guardianEmail || nomineeEntry.EmailID),
          ISD: "91",
          Mobile: buildString(nominee.guardianMobile || nomineeEntry.Mobile),
          MinorInd: "N",
          NomineeSerialNo: index + 1,
          NomineeStatusFlag: "S",
          NomineeStatusCheck: null,
        });
      }

      return entries;
    }) : [];

    const documentEntriesMap = new Map();
    const addDocument = (documentId, name, value) => {
      const docData = stripDataUri(value);
      if (!docData) return;
      
      const safeName = buildString(Array.isArray(name) ? name[0] : name) || "document";
      const safeDocId = buildString(Array.isArray(documentId) ? documentId[0] : documentId) || "OTHER";

      // Deduplicate by DocumentID + Name to allow multiple of the same type (like Aadhaar Front/Back)
      const uniqueKey = `${safeDocId}_${safeName}`;
      if (!documentEntriesMap.has(uniqueKey)) {
        documentEntriesMap.set(uniqueKey, {
          ClientCode: clientCode,
          DocumentID: safeDocId,
          DocumentName: safeName,
          DocumentFileName: safeName,
          Remarks: null,
          DataAvilable: null, // Match UserManual.pdf (was "Y")
          FilePath: docData,  // Pass the URL to FilePath
          DocData: null,      // Force null to see if backend throws NullReferenceException
        });
      }
    };

    addDocument("SIGN", "signature.jpeg", signature.filePreview || signature.preview || signature.image);
    addDocument("PAN", "pan.jpeg", panUpload.filePreview || panUpload.preview || identityDetails.panImage);
    addDocument("PHOTO", "photo.jpeg", application.selfie || selfieDetails.preview || selfieDetails.image);
    addDocument("BANK", "financial-proof", financialProof.filePreview || financialProof.preview);
    if (Array.isArray(documents)) {
      documents.forEach((document, index) => {
        let docId = document.documentId || document.type || "OTHER";
        if (docId.startsWith("DOC")) docId = "OTHER";
        addDocument(docId, document.name || document.filename || `document-${index + 1}`, document.filePreview || document.preview || document.data);
      });
    } else {
      addDocument("UID", "aadhaar-front.jpeg", documents.frontPreview || documents.front);
      addDocument("UID", "aadhaar-back.jpeg", documents.backPreview || documents.back);
    }

    addDocument("BANK", "bank-proof.jpeg", bankDetails.proofPath || bankDetails.proofPreview || bankDetails.image);
    addDocument("OVD", "pep-proof.jpeg", personalDetails.pepProof || personalDetails.pepProofPreview);

    if (nomineeOptFlag === "Y" && Array.isArray(nomineeDetails.nominees)) {
      nomineeDetails.nominees.forEach((nominee, i) => {
        if (nominee.proofPath || nominee.proofPreview) {
          addDocument("OTHER", `nominee-${i+1}-proof.jpeg`, nominee.proofPath || nominee.proofPreview);
        }
        if (nominee.guardianProofPath || nominee.guardianProofPreview) {
          addDocument("OTHER", `guardian-${i+1}-proof.jpeg`, nominee.guardianProofPath || nominee.guardianProofPreview);
        }
      });
    }

    if (application.generatedPdfBase64) {
      addDocument("KYCFORM", "application.pdf", application.generatedPdfBase64);
    }

    const backOfficeEntry = {
      FirmID: existingBackoffice.FirmID || BACKOFFICE_FIRM_ID,
      ClientCode: clientCode,
      ProtectedAccount: existingBackoffice.ProtectedAccount || "N",
      ModifyRemark: existingBackoffice.ModifyRemark || `KYC push from ${application.applicationId}`,
      UIDEnrollmentNo: existingBackoffice.UIDEnrollmentNo || null,
      PayoutFlag: existingBackoffice.PayoutFlag || "Y",
      SettlementDay: existingBackoffice.SettlementDay || null,
      CKYCRefNo: existingBackoffice.CKYCRefNo || null,
      KYCMode: existingBackoffice.KYCMode || (application.identityMethod === "digilocker" ? "DIG" : "ODE"),
      CKYCExportUser: existingBackoffice.CKYCExportUser || null,
      KRAType: existingBackoffice.KRAType || null,
      RiskCategory: (application.riskCategory || existingBackoffice.RiskCategory || "LOW").toUpperCase(),
      RGESSFlag: existingBackoffice.RGESSFlag || "N",
      TradingSoftwareType: existingBackoffice.TradingSoftwareType || "NONE",
      CTCLExport: existingBackoffice.CTCLExport || "N",
      BuyBackPosting: existingBackoffice.BuyBackPosting || "EXP",
      KYCReferenceNo: existingBackoffice.KYCReferenceNo || nsdlResponse.clientId || application.applicationId,
      PaymentType: existingBackoffice.PaymentType || null,
      AadharVirtualID: existingBackoffice.AadharVirtualID || null,
      GSTRegistrationNo: existingBackoffice.GSTRegistrationNo || null,
      UPIID: existingBackoffice.UPIID || bankDetails.upiId || null,
      FATCAFlag: existingBackoffice.FATCAFlag || mapYesNo(personalDetails.taxResidencyOutside, "N"),
      MinorFlag: existingBackoffice.MinorFlag || "N",
      MTFStatus: existingBackoffice.MTFStatus || null,
      MTFRemarks: existingBackoffice.MTFRemarks || null,
      ModifiedBy: existingBackoffice.ModifiedBy || "KYC_PORTAL",
      Status: existingBackoffice.Status || null,
      StatusDesc: existingBackoffice.StatusDesc || null,
      NomineeOptFlag: existingBackoffice.NomineeOptFlag || nomineeOptFlag,
      UnTracedFlag: existingBackoffice.UnTracedFlag || "N",
      EducationCode: existingBackoffice.EducationCode || mapEducation(personalDetails.education),
      OtherMktExperience: String(existingBackoffice.OtherMktExperience || personalDetails.experience || "0").substring(0, 2),
      StockMktExperience: String(existingBackoffice.StockMktExperience || personalDetails.experience || "0").substring(0, 2),
      DerivativeMktExperience: String(existingBackoffice.DerivativeMktExperience || (segments.derivatives ? personalDetails.experience || "0" : "0")).substring(0, 2),
      LanguageCode: existingBackoffice.LanguageCode || "01",
    };

    const payload = {
      KYCDetail: mergedKyc,
      AddressDetail: addressEntries,
      ContactDetail: contactEntries.length > 0 ? contactEntries : (Object.keys(existingContact).length > 0 ? [existingContact] : []),
      BankDetail: bankEntry,
      DepositoryDetail: depositoryEntries,
      BrokerageMappingDetail: brokerageMappingDetail,
      BackOfficeDetail: backOfficeEntry,
      ExchangeDetail: exchangeEntries,
      SegmentDetail: segmentEntries,
      NomineeDetail: {
        ClientCode: clientCode,
        NomineeOptFlag: nomineeOptFlag,
        NomineeDetail: nomineeEntries,
      },
    };

    const documentEntries = Array.from(documentEntriesMap.values());

    if (documentEntries.length) {
      payload.ClientDocumentDetail = documentEntries;
    } else if (Array.isArray(existing.ClientDocumentDetail) && existing.ClientDocumentDetail.length) {
      payload.ClientDocumentDetail = existing.ClientDocumentDetail;
    }

    if (Array.isArray(existing.ClientBackOfficeDetail) && existing.ClientBackOfficeDetail.length) {
      payload.ClientBackOfficeDetail = existing.ClientBackOfficeDetail;
    }

    return payload;
  }
}

module.exports = new BackofficeService();
