const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getVariableValue(variableName, appData) {
  const safeJsonParse = (str) => {
    try { return typeof str === 'string' ? JSON.parse(str) : str; } catch { return str; }
  };

  const pDetails = safeJsonParse(appData.personalDetails) || {};
  const iDetails = safeJsonParse(appData.identityDetails) || {};
  const aDetails = safeJsonParse(appData.address) || {};
  const bDetails = safeJsonParse(appData.bankDetails) || {};
  const fProof = safeJsonParse(appData.financialProof) || {};
  const docs = safeJsonParse(appData.documents) || [];
  const docTypesString = Array.isArray(docs) ? docs.map(d => d.type || d.name || '').join(' ') : '';
  
  switch(variableName) {
    case 'applicationId': return appData.applicationId;
    case 'status': return appData.status;
    case 'formNo': return appData.applicationId;
    case 'clientCode': return appData.clientCode || '';
    case 'openingDate': return appData.submittedAt ? new Date(appData.submittedAt).toLocaleDateString('en-GB') : (appData.createdAt ? new Date(appData.createdAt).toLocaleDateString('en-GB') : '');
    case 'ipvDate': {
      const ocrData = safeJsonParse(appData.ocrData) || {};
      const selfieDate = ocrData?.digio?.SELFIE?.createdAt || ocrData?.digio?.LIVENESS?.createdAt;
      if (selfieDate) {
        return new Date(selfieDate).toLocaleDateString('en-GB');
      }
      return appData.submittedAt ? new Date(appData.submittedAt).toLocaleDateString('en-GB') : (appData.createdAt ? new Date(appData.createdAt).toLocaleDateString('en-GB') : '');
    }
    case 'alwaysTrueOvd': return true;
    case 'isContactRelationSelf': return true;
    case 'isContactRelationSpouse': return false;
    case 'isContactRelationChildren': return false;
    case 'isContactRelationParents': return false;
    case 'isSmsFacilityYes': return true;
    case 'isSmsFacilityNo': return false;
    
    // KYC Mode
    case 'isKycModeNormal': return false;
    case 'isKycModeEkycOtp': {
      const ocrData = safeJsonParse(appData.ocrData) || {};
      const isDigilocker = !!(ocrData.digio && (ocrData.digio.DIGILOCKER || ocrData.digio.AADHAAR));
      if (isDigilocker) return false;
      return appData.identityMethod === 'aadhaar' || !!iDetails.aadhaar;
    }
    case 'isKycModeEkycBiometric': return false;
    case 'isKycModeOnlineKyc': {
      const ocrData = safeJsonParse(appData.ocrData) || {};
      const isDigilocker = !!(ocrData.digio && (ocrData.digio.DIGILOCKER || ocrData.digio.AADHAAR));
      return !isDigilocker;
    }
    case 'isKycModeOfflineEkyc': return false;
    case 'isKycModeDigilocker': {
      const ocrData = safeJsonParse(appData.ocrData) || {};
      return !!(ocrData.digio && (ocrData.digio.DIGILOCKER || ocrData.digio.AADHAAR));
    }
    
    // Standing Instructions
    case 'isContractNoteElectronic': return true;
    case 'isContractNotePhysical': return false;
    case 'isSettlementMonthly': { const d = safeJsonParse(appData.declarations) || {}; return d.settlement === 'Monthly'; }
    case 'isSettlementQuarterly': { const d = safeJsonParse(appData.declarations) || {}; return d.settlement !== 'Monthly'; } // Default Quarterly
    case 'isInternetTradingYes': return true;
    case 'isInternetTradingNo': return false;
    case 'isStdDocsElectronic': return true;
    case 'isStdDocsPhysical': return false;
    case 'isDigitallySignedYes': return true;
    case 'isDigitallySignedNo': return false;
    case 'isTaxResidencyOtherYes': { const p = safeJsonParse(appData.personalDetails) || {}; return p.taxResidencyOutside === 'Yes'; }
    case 'isTaxResidencyOtherNo': { const p = safeJsonParse(appData.personalDetails) || {}; return p.taxResidencyOutside !== 'Yes'; }
    
    // Segments
    case 'isSegmentCash': { const s = safeJsonParse(appData.segments) || {}; return s.equity !== false; }
    case 'isSegmentEquity': { const s = safeJsonParse(appData.segments) || {}; return s.equity !== false; }
    case 'isSegmentFnO': { const s = safeJsonParse(appData.segments) || {}; return !!s.derivatives; }
    case 'isSegmentDerivatives': { const s = safeJsonParse(appData.segments) || {}; return !!s.derivatives; }
    case 'isSegmentCurrency': { const s = safeJsonParse(appData.segments) || {}; return !!s.currency || !!s.derivatives; }
    case 'isSegmentDebt': { const s = safeJsonParse(appData.segments) || {}; return !!s.debt; }
    case 'isSegmentCommodity': { const s = safeJsonParse(appData.segments) || {}; return !!s.commodity; }
    
    // Page 8 Checkboxes
    case 'isPanChecked': return !!iDetails.pan;
    case 'isPhotoChecked': return !!appData.selfieDetails;
    case 'isAadhaarPoiChecked': return !!iDetails.aadhaar;
    case 'isAadhaarPoaChecked': return !!iDetails.aadhaar || String(aDetails.addressProof || aDetails.proofType || '').toLowerCase().includes('01') || String(aDetails.addressProof || aDetails.proofType || '').toLowerCase().includes('aadhar') || String(aDetails.addressProof || aDetails.proofType || '').toLowerCase().includes('aadhaar');
    
    // Additional Proof of Identity
    case 'isPoiPassportChecked': return appData.identityMethod === 'passport' || !!iDetails.passportNo || String(iDetails.proofType || '').toLowerCase().includes('passport');
    case 'isPoiVoterIdChecked': return appData.identityMethod === 'voter' || !!iDetails.voterId || String(iDetails.proofType || '').toLowerCase().includes('voter');
    case 'isPoiDrivingLicenseChecked': return appData.identityMethod === 'dl' || !!iDetails.dlNo || String(iDetails.proofType || '').toLowerCase().includes('driving');
    case 'isPoiOthersChecked': {
      const isAadhaar = appData.identityMethod === 'aadhaar' || !!iDetails.aadhaar;
      const isPassport = appData.identityMethod === 'passport' || !!iDetails.passportNo;
      const isVoter = appData.identityMethod === 'voter' || !!iDetails.voterId;
      const isDl = appData.identityMethod === 'dl' || !!iDetails.dlNo;
      const isPan = appData.identityMethod === 'pan' || !!iDetails.pan;
      return !isAadhaar && !isPassport && !isVoter && !isDl && !isPan && !!iDetails.proofType;
    }

    // Proof of Address
    case 'isPoaAadhaarChecked': return String(aDetails.addressProof || aDetails.proofType || docTypesString).toLowerCase().includes('01') || String(aDetails.addressProof || aDetails.proofType || docTypesString).toLowerCase().includes('aadhar') || String(aDetails.addressProof || aDetails.proofType || docTypesString).toLowerCase().includes('aadhaar');
    case 'isPoaPassportChecked': return String(aDetails.addressProof || aDetails.proofType || docTypesString).toLowerCase().includes('02') || String(aDetails.addressProof || aDetails.proofType || docTypesString).toLowerCase().includes('passport');
    case 'isPoaVoterIdChecked': return String(aDetails.addressProof || aDetails.proofType || docTypesString).toLowerCase().includes('03') || String(aDetails.addressProof || aDetails.proofType || docTypesString).toLowerCase().includes('voter');
    case 'isPoaDrivingLicenseChecked': return String(aDetails.addressProof || aDetails.proofType || docTypesString).toLowerCase().includes('04') || String(aDetails.addressProof || aDetails.proofType || docTypesString).toLowerCase().includes('dl') || String(aDetails.addressProof || aDetails.proofType || docTypesString).toLowerCase().includes('driving');
    case 'isPoaBankerLetterChecked': return String(aDetails.addressProof || aDetails.proofType || docTypesString).toLowerCase().includes('banker');
    case 'isPoaElectricityBillChecked': return String(aDetails.addressProof || aDetails.proofType || docTypesString).toLowerCase().includes('electricity');
    case 'isPoaLandlineBillChecked': return String(aDetails.addressProof || aDetails.proofType || docTypesString).toLowerCase().includes('landline') || String(aDetails.addressProof || aDetails.proofType || docTypesString).toLowerCase().includes('telephone');
    case 'isPoaIdentityCardChecked': return String(aDetails.addressProof || aDetails.proofType || docTypesString).toLowerCase().includes('identity card');
    case 'isPoaLeaseChecked': return String(aDetails.addressProof || aDetails.proofType || docTypesString).toLowerCase().includes('lease') || String(aDetails.addressProof || aDetails.proofType || docTypesString).toLowerCase().includes('rent');

    // Bank Proof
    case 'isPennyDropChecked': return !!bDetails.verified || !!bDetails.accountNumber;
    case 'isBankStatementChecked': return String(bDetails.proofType || bDetails.documentType || bDetails.type || '').toLowerCase().includes('statement');
    case 'isBankerCertificateChecked': return String(bDetails.proofType || bDetails.documentType || bDetails.type || '').toLowerCase().includes('certificate');
    case 'isCancelledChequeChecked': return String(bDetails.proofType || bDetails.documentType || bDetails.type || '').toLowerCase().includes('cheque') || String(bDetails.proofType || bDetails.documentType || bDetails.type || '').toLowerCase().includes('check');

    case 'isIncomeItrChecked': return String(fProof.proofType || fProof.type || '').toLowerCase().includes('itr');
    case 'isIncomeSalaryChecked': return String(fProof.proofType || fProof.type || '').toLowerCase().includes('salary');
    case 'isIncomeNetworthChecked': return String(fProof.proofType || fProof.type || '').toLowerCase().includes('networth');
    case 'isIncomeDematChecked': return String(fProof.proofType || fProof.type || '').toLowerCase().includes('demat');
    case 'isIncomeBankChecked': return String(fProof.proofType || fProof.type || '').toLowerCase().includes('bank');
    case 'isIncomeAnnualChecked': return String(fProof.proofType || fProof.type || '').toLowerCase().includes('annual');
    case 'isIncomeSelfDecChecked': return String(fProof.proofType || fProof.type || '').toLowerCase().includes('self');
    case 'isIncomeOthersChecked': return String(fProof.proofType || fProof.type || '').toLowerCase().includes('other');
    case 'isNriClientChecked': {
      const isIndian = String(pDetails.nationality || 'Indian').toLowerCase() === 'indian';
      const isTaxOutside = String(pDetails.taxResidencyOutside).toLowerCase() === 'yes' || pDetails.taxResidencyOutside === true || String(pDetails.taxResidencyOutside).toLowerCase() === 'true';
      return (!isIndian || isTaxOutside);
    }
    
    case 'plan': return safeJsonParse(appData.pricingPlan)?.name || 'Standard';
    case 'isNewKyc': return !appData.isResubmitted;
    case 'isModificationKyc': return !!appData.isResubmitted;
    case 'isPoiAadhaar': return appData.identityMethod === 'aadhaar' || !!iDetails.aadhaar;
    case 'isPoiPassport': return appData.identityMethod === 'passport' || !!iDetails.passportNo;
    case 'isPoiDrivingLicense': return appData.identityMethod === 'dl' || !!iDetails.dlNo;
    case 'isPoiVoterId': return appData.identityMethod === 'voter' || !!iDetails.voterId;
    case 'isPoiPan': return appData.identityMethod === 'pan' || !!iDetails.pan;
    case 'date': {
      const esignParsed = safeJsonParse(appData.esignDetails) || {};
      const eDate = esignParsed.updatedAt || appData.submittedAt || appData.createdAt;
      return eDate ? new Date(eDate).toLocaleDateString('en-GB') : '';
    }
    case 'place': {
      const selfie = safeJsonParse(appData.selfieDetails) || {};
      const esign = safeJsonParse(appData.esignDetails) || {};
      const geoAddress = esign.geo?.address || safeJsonParse(appData.geoDetails)?.address || selfie.geo?.address || '';
      return geoAddress.split(',')[0] || aDetails.city || '';
    }
    case 'fullName': return pDetails.fullName;
    case 'fatherName': return pDetails.fatherName;
    case 'motherName': return pDetails.motherName;
    case 'dob': return pDetails.dob;
    case 'gender': return pDetails.gender;
    case 'gender_male_tick': return String(pDetails.gender || '').toLowerCase() === 'male';
    case 'gender_female_tick': return String(pDetails.gender || '').toLowerCase() === 'female';
    case 'gender_transgender_tick': return String(pDetails.gender || '').toLowerCase() === 'transgender' || String(pDetails.gender || '').toLowerCase() === 'other';
    case 'pan': return iDetails.pan;
    case 'aadhaar': return iDetails.aadhaar;
    case 'maritalStatus': return pDetails.maritalStatus;
    case 'marital_single_tick': return String(pDetails.maritalStatus || '').toLowerCase() === 'single';
    case 'marital_married_tick': return String(pDetails.maritalStatus || '').toLowerCase() === 'married';
    
    case 'occupation': return pDetails.occupation;
    case 'education': return pDetails.education;
    case 'static.emailBelongsToSelf': return 'Self';
    case 'static.mobileBelongsToSelf': return 'Self';
    case 'static.yes': return 'Yes';
    case 'static.no': return 'No';
    case 'static.true': return true;
    case 'static.false': return false;
    case 'esign': {
      const name = pDetails.fullName || 'User';
      const esignDate = appData.esignDetails ? (safeJsonParse(appData.esignDetails)?.updatedAt || appData.updatedAt) : appData.updatedAt;
      const dateStr = esignDate ? new Date(esignDate).toLocaleString('en-GB') : new Date().toLocaleString('en-GB');
      return `Digitally signed by ${name}\nDate: ${dateStr}\nReason: KYC Application`;
    }
    case 'esignOptOut': {
      const n = safeJsonParse(appData.nomineeDetails) || {};
      if (n.opted !== 'No') return '';
      const name = pDetails.fullName || 'User';
      const esignDate = appData.esignDetails ? (safeJsonParse(appData.esignDetails)?.updatedAt || appData.updatedAt) : appData.updatedAt;
      const dateStr = esignDate ? new Date(esignDate).toLocaleString('en-GB') : new Date().toLocaleString('en-GB');
      return `Digitally signed by ${name}\nDate: ${dateStr}\nReason: KYC Application`;
    }
    case 'esignOptIn': {
      const n = safeJsonParse(appData.nomineeDetails) || {};
      if (!(n.opted === 'Yes' && n.nominees && n.nominees.length > 0)) return '';
      const name = pDetails.fullName || 'User';
      const esignDate = appData.esignDetails ? (safeJsonParse(appData.esignDetails)?.updatedAt || appData.updatedAt) : appData.updatedAt;
      const dateStr = esignDate ? new Date(esignDate).toLocaleString('en-GB') : new Date().toLocaleString('en-GB');
      return `Digitally signed by ${name}\nDate: ${dateStr}\nReason: KYC Application`;
    }
    case 'esignNominee2': {
      const n = safeJsonParse(appData.nomineeDetails) || {};
      if (!(n.opted === 'Yes' && n.nominees && n.nominees.length > 1 && n.nominees[1].name)) return '';
      const name = pDetails.fullName || 'User';
      const esignDate = appData.esignDetails ? (safeJsonParse(appData.esignDetails)?.updatedAt || appData.updatedAt) : appData.updatedAt;
      const dateStr = esignDate ? new Date(esignDate).toLocaleString('en-GB') : new Date().toLocaleString('en-GB');
      return `Digitally signed by ${name}\nDate: ${dateStr}\nReason: KYC Application`;
    }
    case 'esignNominee3': {
      const n = safeJsonParse(appData.nomineeDetails) || {};
      if (!(n.opted === 'Yes' && n.nominees && n.nominees.length > 2 && n.nominees[2].name)) return '';
      const name = pDetails.fullName || 'User';
      const esignDate = appData.esignDetails ? (safeJsonParse(appData.esignDetails)?.updatedAt || appData.updatedAt) : appData.updatedAt;
      const dateStr = esignDate ? new Date(esignDate).toLocaleString('en-GB') : new Date().toLocaleString('en-GB');
      return `Digitally signed by ${name}\nDate: ${dateStr}\nReason: KYC Application`;
    }
    case 'isOccGovt': return String(pDetails.occupation || '').toLowerCase().includes('govt');
    case 'isOccPublic': return String(pDetails.occupation || '').toLowerCase().includes('public');
    case 'isOccAgri': return String(pDetails.occupation || '').toLowerCase().includes('agri');
    case 'isOccProf': return String(pDetails.occupation || '').toLowerCase().includes('professional');
    case 'isOccBus': return String(pDetails.occupation || '').toLowerCase().includes('business');
    case 'isOccHousewife': return String(pDetails.occupation || '').toLowerCase().includes('housewife');
    case 'isOccPrivate': return String(pDetails.occupation || '').toLowerCase().includes('private');
    case 'isOccRetired': return String(pDetails.occupation || '').toLowerCase().includes('retired');
    case 'isOccStudent': return String(pDetails.occupation || '').toLowerCase().includes('student');
    case 'isOccOthers': return String(pDetails.occupation || '').toLowerCase().includes('other');
    case 'annualIncome': return pDetails.annualIncome || pDetails.incomeRange;
    case 'isIncomeBelow1Lac': { const i = String(pDetails.annualIncome || pDetails.incomeRange || '').toLowerCase(); return i.includes('below 1') || i.includes('<1'); }
    case 'isIncome1To5Lacs': { const i = String(pDetails.annualIncome || pDetails.incomeRange || '').toLowerCase(); return i.includes('1-5') || i.includes('1 to 5'); }
    case 'isIncome5To10Lacs': { const i = String(pDetails.annualIncome || pDetails.incomeRange || '').toLowerCase(); return i.includes('5-10') || i.includes('5 to 10'); }
    case 'isIncome10To25Lacs': { const i = String(pDetails.annualIncome || pDetails.incomeRange || '').toLowerCase(); return i.includes('10-25') || i.includes('10 to 25'); }
    case 'isIncomeAbove25Lacs': { const i = String(pDetails.annualIncome || pDetails.incomeRange || '').toLowerCase(); return i.includes('>25') || i.includes('above 25') || i.includes('more than 25'); }
    case 'nationality': return pDetails.nationality || 'Indian';
    case 'nationality_indian_tick': return String(pDetails.nationality || 'Indian').toLowerCase() === 'indian';
    case 'nationality_other_tick': return String(pDetails.nationality || 'Indian').toLowerCase() !== 'indian';
    
    case 'residentialStatus': {
      const isIndian = String(pDetails.nationality || 'Indian').toLowerCase() === 'indian';
      const isTaxOutside = String(pDetails.taxResidencyOutside).toLowerCase() === 'yes' || pDetails.taxResidencyOutside === true || String(pDetails.taxResidencyOutside).toLowerCase() === 'true';
      if (!isIndian || isTaxOutside) {
        return 'Non Resident Indian';
      }
      return 'Resident Individual';
    }
    case 'residential_resident_tick': {
      const isIndian = String(pDetails.nationality || 'Indian').toLowerCase() === 'indian';
      const isTaxOutside = String(pDetails.taxResidencyOutside).toLowerCase() === 'yes' || pDetails.taxResidencyOutside === true || String(pDetails.taxResidencyOutside).toLowerCase() === 'true';
      return isIndian && !isTaxOutside;
    }
    case 'residential_nri_tick': {
      const isIndian = String(pDetails.nationality || 'Indian').toLowerCase() === 'indian';
      const isTaxOutside = String(pDetails.taxResidencyOutside).toLowerCase() === 'yes' || pDetails.taxResidencyOutside === true || String(pDetails.taxResidencyOutside).toLowerCase() === 'true';
      return !isIndian || isTaxOutside;
    }
    case 'residential_foreign_tick': {
      return String(pDetails.nationality || 'Indian').toLowerCase() !== 'indian';
    }
    case 'residential_pio_tick': {
      return false; // Assuming PIO is not currently supported in the standard flow, but preventing it from being accidentally checked by a true-evaluating string
    }
    case 'email': return appData.email || pDetails.email || appData.user?.email;
    case 'phone': return appData.phone || pDetails.phone || appData.user?.phone;
    case 'mobile': return appData.mobile || pDetails.mobile || appData.user?.mobile || appData.user?.phone;
    case 'boid': return appData.user?.boid || appData.boid || '';
    case 'addressLine1': return aDetails.line1;
    case 'addressLine2': return aDetails.line2;
    case 'landmark': return aDetails.landmark || '';
    case 'city': return aDetails.city;
    case 'district': return aDetails.district || aDetails.city;
    case 'state': return aDetails.state;
    case 'country': return aDetails.country || 'India';
    case 'pincode': return aDetails.pincode;
    case 'isAddrTypeResBus': return (aDetails.addressType || 'Residential') === 'Residential/Business';
    case 'isAddrTypeRes': return (aDetails.addressType || 'Residential') === 'Residential';
    case 'isAddrTypeBus': return aDetails.addressType === 'Business';
    case 'isAddrTypeRegOff': return aDetails.addressType === 'Registered Office';
    case 'isAddrTypeUnspec': return aDetails.addressType === 'Unspecified';
    case 'fullAddress': 
      const addr = `${aDetails.line1 || ''}, ${aDetails.line2 || ''}, ${aDetails.city || ''}, ${aDetails.state || ''} - ${aDetails.pincode || ''}`;
      return addr.replace(/^[,\s]+|[,\s]+$/g, '');
    case 'bankName': return bDetails.bankName;
    case 'branchName': return bDetails.branchName || '';
    case 'bankAddress': return bDetails.bankAddress || bDetails.address || '';
    case 'accountNumber': return bDetails.accountNumber;
    case 'ifsc': return bDetails.ifsc;
    case 'micr': return bDetails.micr || '';
    case 'accountType': {
      const type = bDetails.accountType || 'Savings';
      if (type === "10" || type === 10 || type === "Savings") return "Saving Account";
      if (type === "11" || type === 11 || type === "Current") return "Current Account";
      return type;
    }
    
    // New variables
    case 'prefix': return pDetails.prefix || pDetails.title;
    case 'experience': return pDetails.experience || pDetails.tradingExperience;
    case 'politicallyExposed': { const p = String(pDetails.politicallyExposed || '').toLowerCase(); return (p === 'yes' || p === 'true') ? 'Yes' : 'No'; }
    case 'pepText': { const p = String(pDetails.politicallyExposed || '').toLowerCase(); return (p === 'yes' || p === 'true') ? 'Yes' : 'No'; }
    case 'isPepYes': { const p = String(pDetails.politicallyExposed || '').toLowerCase(); return p === 'yes' || p === 'true'; }
    case 'isPepNo': { const p = String(pDetails.politicallyExposed || '').toLowerCase(); return p === 'no' || p === 'false' || p === ''; }
    case 'pepType': return pDetails.pepType;
    case 'isIndianCitizen': return pDetails.isIndianCitizen;
    case 'taxResidencyOutside': return pDetails.taxResidencyOutside;
    case 'countryOfBirth': return pDetails.countryOfBirth || '';
    case 'citizenship': return pDetails.citizenship || '';
    case 'taxResidence1': return pDetails.taxResidence1 || '';
    case 'taxId1': return pDetails.taxId1 || '';
    case 'taxAddress1': return pDetails.taxAddress1 || '';
    case 'taxIdType1': return pDetails.taxIdType1 || '';
    case 'taxResidence2': return pDetails.taxResidence2 || '';
    case 'taxId2': return pDetails.taxId2 || '';
    case 'taxAddress2': return pDetails.taxAddress2 || '';
    case 'taxIdType2': return pDetails.taxIdType2 || '';
    case 'taxResidence3': return pDetails.taxResidence3 || '';
    case 'taxId3': return pDetails.taxId3 || '';
    case 'taxAddress3': return pDetails.taxAddress3 || '';
    case 'taxIdType3': return pDetails.taxIdType3 || '';
    case 'ddpi': return pDetails.ddpi || appData.ddpi;
    
    // Declarations
    case 'dis': { const d = safeJsonParse(appData.declarations) || {}; return d.dis || appData.dis; }
    case 'isDisOption1': { const d = safeJsonParse(appData.declarations) || {}; const val = d.dis || appData.dis; return val === 'Yes' || val === 'Option 1'; }
    case 'isDisOption2': { const d = safeJsonParse(appData.declarations) || {}; const val = d.dis || appData.dis; return val === 'No' || val === 'Option 2'; }
    case 'receiveCredits': { const d = safeJsonParse(appData.declarations) || {}; return d.receiveCredits; }
    case 'eStatement': { const d = safeJsonParse(appData.declarations) || {}; return d.eStatement; }
    case 'acceptPledgeInstructions': { const d = safeJsonParse(appData.declarations) || {}; return d.acceptPledgeInstructions; }
    case 'receiveAnnualReports': { const d = safeJsonParse(appData.declarations) || {}; return d.receiveAnnualReports; }
    case 'settlement': { const d = safeJsonParse(appData.declarations) || {}; return d.settlement; }
    case 'smsAlert': { const d = safeJsonParse(appData.declarations) || {}; return d.smsAlert; }
    case 'operatedThroughDDPI': { const d = safeJsonParse(appData.declarations) || {}; return d.operatedThroughDDPI; }
    
    // Segments
    case 'bsda': return appData.bsda;
    case 'isBsdaAvail': return appData.bsda === 'opt-in';
    case 'isBsdaOptOut': return appData.bsda === 'opt-out';
    case 'segments.equity': { const s = safeJsonParse(appData.segments) || {}; return s.equity ? 'Yes' : 'No'; }
    case 'segments.derivatives': { const s = safeJsonParse(appData.segments) || {}; return s.derivatives ? 'Yes' : 'No'; }
    
    // Nominee
    case 'nomineeDetails.nominees[0].name': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.name; }
    case 'nomineeDetails.nominees[0].relation': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.relation; }
    case 'nomineeAllocation.percentages[0]': { const a = safeJsonParse(appData.nomineeAllocation) || {}; return a.percentages?.[0] || a.nominees?.[0]?.percentage; }
    case 'nomineeDetails.nominees[0].dob': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.dob; }
    case 'nomineeDetails.nominees[0].mobile': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.mobile; }
    case 'nomineeDetails.nominees[0].email': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.email; }
    case 'nomineeDetails.nominees[0].address': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.address; }
    case 'nomineeDetails.nominees[0].proofType': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.proofType; }
    case 'nomineeDetails.nominees[0].proofNumber': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.proofNumber; }
    case 'nomineeDetails.nominees[0].guardianName': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.guardianName; }
    case 'nomineeDetails.nominees[0].guardianRelation': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.guardianRelation; }
    case 'nomineeDetails.nominees[0].city': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.city; }
    case 'nomineeDetails.nominees[0].state': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.state; }
    case 'nomineeDetails.nominees[0].pincode': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.pincode; }
    case 'nomineeDetails.nominees[0].country': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.country; }
    case 'nomineeDetails.nominees[0].guardianDob': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.guardianDob; }
    case 'nomineeDetails.nominees[0].guardianMobile': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.guardianMobile; }
    case 'nomineeDetails.nominees[0].guardianEmail': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.guardianEmail; }
    case 'nomineeDetails.nominees[0].guardianAddress': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.guardianAddress; }
    case 'nomineeDetails.nominees[0].guardianCity': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.guardianCity; }
    case 'nomineeDetails.nominees[0].guardianState': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.guardianState; }
    case 'nomineeDetails.nominees[0].guardianPincode': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.guardianPincode; }
    case 'nomineeDetails.nominees[0].guardianCountry': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.guardianCountry; }
    case 'nomineeDetails.nominees[0].guardianProofType': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.guardianProofType; }
    case 'nomineeDetails.nominees[0].guardianProofNumber': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[0]?.guardianProofNumber; }
    
    // Nominee 2
    case 'nomineeDetails.nominees[1].name': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.name; }
    case 'nomineeDetails.nominees[1].relation': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.relation; }
    case 'nomineeAllocation.percentages[1]': { const a = safeJsonParse(appData.nomineeAllocation) || {}; return a.percentages?.[1] || a.nominees?.[1]?.percentage; }
    case 'nomineeDetails.nominees[1].dob': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.dob; }
    case 'nomineeDetails.nominees[1].mobile': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.mobile; }
    case 'nomineeDetails.nominees[1].email': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.email; }
    case 'nomineeDetails.nominees[1].address': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.address; }
    case 'nomineeDetails.nominees[1].city': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.city; }
    case 'nomineeDetails.nominees[1].state': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.state; }
    case 'nomineeDetails.nominees[1].pincode': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.pincode; }
    case 'nomineeDetails.nominees[1].country': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.country; }
    case 'nomineeDetails.nominees[1].proofType': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.proofType; }
    case 'nomineeDetails.nominees[1].proofNumber': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.proofNumber; }
    case 'nomineeDetails.nominees[1].guardianName': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.guardianName; }
    case 'nomineeDetails.nominees[1].guardianRelation': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.guardianRelation; }
    case 'nomineeDetails.nominees[1].guardianDob': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.guardianDob; }
    case 'nomineeDetails.nominees[1].guardianMobile': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.guardianMobile; }
    case 'nomineeDetails.nominees[1].guardianEmail': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.guardianEmail; }
    case 'nomineeDetails.nominees[1].guardianAddress': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.guardianAddress; }
    case 'nomineeDetails.nominees[1].guardianCity': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.guardianCity; }
    case 'nomineeDetails.nominees[1].guardianState': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.guardianState; }
    case 'nomineeDetails.nominees[1].guardianPincode': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.guardianPincode; }
    case 'nomineeDetails.nominees[1].guardianCountry': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.guardianCountry; }
    case 'nomineeDetails.nominees[1].guardianProofType': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.guardianProofType; }
    case 'nomineeDetails.nominees[1].guardianProofNumber': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[1]?.guardianProofNumber; }
    
    // Nominee 3
    case 'nomineeDetails.nominees[2].name': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.name; }
    case 'nomineeDetails.nominees[2].relation': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.relation; }
    case 'nomineeAllocation.percentages[2]': { const a = safeJsonParse(appData.nomineeAllocation) || {}; return a.percentages?.[2] || a.nominees?.[2]?.percentage; }
    case 'nomineeDetails.nominees[2].dob': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.dob; }
    case 'nomineeDetails.nominees[2].mobile': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.mobile; }
    case 'nomineeDetails.nominees[2].email': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.email; }
    case 'nomineeDetails.nominees[2].address': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.address; }
    case 'nomineeDetails.nominees[2].city': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.city; }
    case 'nomineeDetails.nominees[2].state': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.state; }
    case 'nomineeDetails.nominees[2].pincode': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.pincode; }
    case 'nomineeDetails.nominees[2].country': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.country; }
    case 'nomineeDetails.nominees[2].proofType': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.proofType; }
    case 'nomineeDetails.nominees[2].proofNumber': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.proofNumber; }
    case 'nomineeDetails.nominees[2].guardianName': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.guardianName; }
    case 'nomineeDetails.nominees[2].guardianRelation': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.guardianRelation; }
    case 'nomineeDetails.nominees[2].guardianDob': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.guardianDob; }
    case 'nomineeDetails.nominees[2].guardianMobile': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.guardianMobile; }
    case 'nomineeDetails.nominees[2].guardianEmail': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.guardianEmail; }
    case 'nomineeDetails.nominees[2].guardianAddress': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.guardianAddress; }
    case 'nomineeDetails.nominees[2].guardianCity': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.guardianCity; }
    case 'nomineeDetails.nominees[2].guardianState': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.guardianState; }
    case 'nomineeDetails.nominees[2].guardianPincode': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.guardianPincode; }
    case 'nomineeDetails.nominees[2].guardianCountry': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.guardianCountry; }
    case 'nomineeDetails.nominees[2].guardianProofType': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.guardianProofType; }
    case 'nomineeDetails.nominees[2].guardianProofNumber': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.nominees?.[2]?.guardianProofNumber; }
    
    case 'isNomineeOptOut': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.opted === 'No'; }
    case 'isNomineeOptIn': { const n = safeJsonParse(appData.nomineeDetails) || {}; return n.opted === 'Yes' && n.nominees && n.nominees.length > 0; }
    
    // Audit Trail & Application Details
    case 'geo.latitude': { 
      const selfie = safeJsonParse(appData.selfieDetails) || {};
      const esign = safeJsonParse(appData.esignDetails) || {};
      return selfie.geo?.latitude || selfie.latitude || selfie.lat || esign.geo?.latitude || esign.latitude || esign.lat || ''; 
    }
    case 'geo.longitude': { 
      const selfie = safeJsonParse(appData.selfieDetails) || {};
      const esign = safeJsonParse(appData.esignDetails) || {};
      return selfie.geo?.longitude || selfie.longitude || selfie.lng || esign.geo?.longitude || esign.longitude || esign.lng || ''; 
    }
    case 'geo.address': { 
      const selfie = safeJsonParse(appData.selfieDetails) || {};
      const g = safeJsonParse(appData.geoDetails) || {}; 
      return selfie.geo?.address || g.address || ''; 
    }
    case 'updatedAt': return appData.updatedAt ? new Date(appData.updatedAt).toLocaleString() : '';
    case 'ipAddress': return appData.ipAddress;
    case 'deviceType': return appData.deviceType;
    case 'riskCategory': return appData.riskCategory;
    case 'riskScore': return appData.riskScore;
    
    default: return '';
  }
}

async function generateKycPdf(applicationData, options = {}) {
  try {
    const safeJsonParse = (str) => {
      let result = str;
      while (typeof result === 'string') {
        try {
          const parsed = JSON.parse(result);
          if (typeof parsed === 'string' && parsed === result) break;
          result = parsed;
        } catch {
          break;
        }
      }
      return result;
    };

    const parsedSelfieDetails = safeJsonParse(applicationData.selfieDetails) || {};
    const parsedSignature = safeJsonParse(applicationData.signature) || {};
    let _parsedDocuments = safeJsonParse(applicationData.documents);
    const parsedDocuments = Array.isArray(_parsedDocuments) ? _parsedDocuments : [];
    const parsedPanUpload = safeJsonParse(applicationData.panUpload) || {};
    const parsedFinancialProof = safeJsonParse(applicationData.financialProof) || {};
    const parsedBankDetails = safeJsonParse(applicationData.bankDetails) || {};
    const parsedPersonalDetails = safeJsonParse(applicationData.personalDetails) || {};
    const parsedNomineeDetails = safeJsonParse(applicationData.nomineeDetails) || {};

    // Check if an active template exists
    const activeTemplate = await prisma.pdfTemplate.findFirst({
      where: { isActive: true }
    });

    let officialPdfPath = path.join(__dirname, '../../../public/official_form.pdf');
    if (activeTemplate && activeTemplate.basePdfUrl) {
      // Strip leading slash to prevent path.join from treating it as an absolute path
      const safeRelPath = activeTemplate.basePdfUrl.replace(/^\/+/, '');
      const candidatePath = path.join(__dirname, '../../', safeRelPath);
      if (fs.existsSync(candidatePath)) officialPdfPath = candidatePath;
    }

    if (!fs.existsSync(officialPdfPath)) {
      const fallbacks = [
        path.join(__dirname, '../../../public/official_form.pdf'),
        path.join(__dirname, '../../../public_html/official_form.pdf'),
        path.join(__dirname, '../../public/official_form.pdf'),
        path.join(__dirname, '../../official_form.pdf'),
        path.join(process.cwd(), 'public/official_form.pdf'),
        path.join(process.cwd(), 'official_form.pdf'),
        path.join(process.cwd(), '../public/official_form.pdf'),
        path.join(__dirname, '../../../../public/official_form.pdf')
      ];
      
      // Let's dynamically find it by walking up
      let currentDir = __dirname;
      for (let i = 0; i < 5; i++) {
        fallbacks.push(path.join(currentDir, 'public/official_form.pdf'));
        fallbacks.push(path.join(currentDir, 'official_form.pdf'));
        currentDir = path.join(currentDir, '..');
      }

      console.error("[PDF Gen] Initial path failed:", officialPdfPath);
      for (const fallback of fallbacks) {
        if (fs.existsSync(fallback)) {
          console.log("[PDF Gen] Found base PDF at fallback:", fallback);
          officialPdfPath = fallback;
          break;
        }
      }
    }

    if (!fs.existsSync(officialPdfPath)) {
      console.error("[PDF Gen] FINAL PATH FAILED. Checked multiple locations.");
      throw new Error("Base PDF not found at any known locations.");
    }

    const officialPdfBytes = fs.readFileSync(officialPdfPath);
    const pdfDoc = await PDFDocument.load(officialPdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const dingbats = await pdfDoc.embedFont(StandardFonts.ZapfDingbats);

    let esignCoordinatesMap = {};

    // If template exists, populate fields over the existing pages
    if (activeTemplate) {
      let parsedFields = safeJsonParse(activeTemplate.fields);
      let fields = [];
      if (Array.isArray(parsedFields)) {
        fields = parsedFields;
      } else if (parsedFields && Array.isArray(parsedFields.variables)) {
        fields = parsedFields.variables;
      }
      const pages = pdfDoc.getPages();
      const embeddedMediaCache = new Map();

      for (const field of fields) {
        const pageIndex = (field.page || 1) - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) continue;
        
        const page = pages[pageIndex];
        const { height } = page.getSize();
        // pdf-lib's y coordinate is from bottom. The frontend will likely send y from top.
        // We will assume frontend sends y from top, so we do height - y.
        const yPos = height - field.y; 

        const imageVariables = [
          'selfie', 'signature', 'signatureOptOut', 'signatureOptIn', 
          'signatureNominee2', 'signatureNominee3',
          'panImage', 'aadhaarImage', 
          'bankProof', 'incomeProof', 'pepProof', 
          'nominee1Proof', 'nominee2Proof', 'nominee3Proof', 
          'guardian1Proof', 'guardian2Proof', 'guardian3Proof', 
          'addressProof', 'panDocument'
        ];

        if (imageVariables.includes(field.variable)) {
          let imgRelPath = null;
          if (field.variable === 'selfie') {
            imgRelPath = (typeof parsedSelfieDetails === 'string' ? parsedSelfieDetails : (parsedSelfieDetails.filePreview || parsedSelfieDetails.path || parsedSelfieDetails.preview)) 
                         || (typeof applicationData.selfie === 'string' ? applicationData.selfie : applicationData.selfie?.preview);
          } else if (field.variable === 'signature' || field.variable === 'signatureOptOut' || field.variable === 'signatureOptIn' || field.variable === 'signatureNominee2' || field.variable === 'signatureNominee3') {
            let shouldShow = false;
            const n = safeJsonParse(applicationData.nomineeDetails) || {};
            if (field.variable === 'signature') shouldShow = true;
            else if (field.variable === 'signatureOptOut' && n.opted === 'No') shouldShow = true;
            else if (field.variable === 'signatureOptIn' && n.opted === 'Yes' && n.nominees && n.nominees.length > 0) shouldShow = true;
            else if (field.variable === 'signatureNominee2' && n.opted === 'Yes' && n.nominees && n.nominees.length > 1 && n.nominees[1].name) shouldShow = true;
            else if (field.variable === 'signatureNominee3' && n.opted === 'Yes' && n.nominees && n.nominees.length > 2 && n.nominees[2].name) shouldShow = true;
            
            if (shouldShow) {
              imgRelPath = typeof parsedSignature === 'string' ? parsedSignature : (parsedSignature.filePreview || parsedSignature.path || parsedSignature.preview);
            }

          } else if (field.variable === 'panImage') {
            imgRelPath = typeof parsedPanUpload === 'string' ? parsedPanUpload : (parsedPanUpload?.filePreview || parsedPanUpload?.path || parsedPanUpload?.preview);
            if (!imgRelPath) {
              const panDoc = parsedDocuments.find(d => d.path && /digilocker_pan|_pan_issued|(^|[\/_])pan([\/_]|\.)/i.test(d.path));
              if (panDoc) imgRelPath = panDoc.path;
            }
          } else if (field.variable === 'panDocument') {
            const panDoc = [...parsedDocuments].reverse().find(d => d.type === 'PAN') 
                        || [...parsedDocuments].reverse().find(d => d.path && /digilocker_pan|_pan_issued/i.test(d.path));
            if (panDoc) imgRelPath = panDoc.path;
          } else if (field.variable === 'aadhaarImage') {
            const aadhaarDoc = [...parsedDocuments].reverse().find(d => d.type === 'AADHAAR') 
                            || [...parsedDocuments].reverse().find(d => d.path && d.type !== 'PHOTO' && /digilocker_aadhaar|_aadhaar_issued|aadhaar|aadhar|uid/i.test(d.path));
            if (aadhaarDoc) imgRelPath = aadhaarDoc.path;
          } else if (field.variable === 'bankProof') {
            imgRelPath = typeof parsedBankDetails === 'string' ? parsedBankDetails : (parsedBankDetails?.proofPath || parsedBankDetails?.proofPreview || parsedBankDetails?.proof);
          } else if (field.variable === 'incomeProof') {
            imgRelPath = typeof parsedFinancialProof === 'string' ? parsedFinancialProof : (parsedFinancialProof?.path || parsedFinancialProof?.filePreview || parsedFinancialProof?.preview);
          } else if (field.variable === 'pepProof') {
            imgRelPath = typeof parsedPersonalDetails === 'string' ? parsedPersonalDetails : (parsedPersonalDetails?.pepProof || parsedPersonalDetails?.pepProofPreview);
          } else if (field.variable === 'nominee1Proof') {
            imgRelPath = parsedNomineeDetails?.nominees?.[0]?.proofPath || parsedNomineeDetails?.nominees?.[0]?.proofPreview || parsedNomineeDetails?.nominees?.[0]?.preview;
          } else if (field.variable === 'nominee2Proof') {
            imgRelPath = parsedNomineeDetails?.nominees?.[1]?.proofPath || parsedNomineeDetails?.nominees?.[1]?.proofPreview || parsedNomineeDetails?.nominees?.[1]?.preview;
          } else if (field.variable === 'nominee3Proof') {
            imgRelPath = parsedNomineeDetails?.nominees?.[2]?.proofPath || parsedNomineeDetails?.nominees?.[2]?.proofPreview || parsedNomineeDetails?.nominees?.[2]?.preview;
          } else if (field.variable === 'guardian1Proof') {
            imgRelPath = parsedNomineeDetails?.nominees?.[0]?.guardianProofPath || parsedNomineeDetails?.nominees?.[0]?.guardianProofPreview || parsedNomineeDetails?.nominees?.[0]?.guardianPreview;
          } else if (field.variable === 'guardian2Proof') {
            imgRelPath = parsedNomineeDetails?.nominees?.[1]?.guardianProofPath || parsedNomineeDetails?.nominees?.[1]?.guardianProofPreview || parsedNomineeDetails?.nominees?.[1]?.guardianPreview;
          } else if (field.variable === 'guardian3Proof') {
            imgRelPath = parsedNomineeDetails?.nominees?.[2]?.guardianProofPath || parsedNomineeDetails?.nominees?.[2]?.guardianProofPreview || parsedNomineeDetails?.nominees?.[2]?.guardianPreview;
          } else if (field.variable === 'addressProof') {
            const addrDoc = parsedDocuments.find(d => d.path && /address_proof|driving_license|voter|passport/i.test(d.path));
            if (addrDoc) imgRelPath = addrDoc.path;
          }

          if (imgRelPath) {
            try {
              let embeddedMedia = embeddedMediaCache.get(imgRelPath);
              
              if (!embeddedMedia) {
                let imgBytes;
                let isPng = false;
                let isPdf = false;
                
                if (imgRelPath.startsWith('data:image')) {
                  const base64Data = imgRelPath.split(',')[1];
                  imgBytes = Buffer.from(base64Data, 'base64');
                  isPng = imgRelPath.includes('image/png');
                } else if (imgRelPath.startsWith('http://') || imgRelPath.startsWith('https://')) {
                  // If it's a cloudinary URL, safely force PNG/JPG format
                  if (imgRelPath.includes('cloudinary.com')) {
                    if (imgRelPath.toLowerCase().endsWith('.pdf')) {
                      imgRelPath = imgRelPath.slice(0, -4) + '.png';
                    } else if (!imgRelPath.includes('f_jpg') && !imgRelPath.includes('f_png')) {
                      imgRelPath = imgRelPath.replace('/upload/', '/upload/f_jpg/');
                    }
                  }
                  console.log(`[PDF Gen] Fetching image from URL: ${imgRelPath}`);
                  try {
                    const axios = require('axios');
                    const response = await axios.get(imgRelPath, { 
                      responseType: 'arraybuffer',
                      validateStatus: () => true,
                      timeout: 10000 // 10s timeout to prevent hanging
                    });
                    
                    if (response.status >= 200 && response.status < 300) {
                      imgBytes = Buffer.from(response.data);
                      const lowerPath = imgRelPath.toLowerCase();
                      isPng = lowerPath.endsWith('.png') || imgRelPath.includes('image/png') || imgRelPath.includes('f_png');
                      isPdf = lowerPath.endsWith('.pdf') || imgRelPath.includes('application/pdf');
                    } else {
                      console.error(`[PDF Gen] Error fetching image URL: HTTP ${response.status}`);
                    }
                  } catch (err) {
                    console.error(`[PDF Gen] Error fetching image URL: ${imgRelPath}`, err.message);
                  }
                } else {
                  const cleanPath = imgRelPath.startsWith('/') ? imgRelPath.substring(1) : imgRelPath;
                  const imgPath = path.join(__dirname, '../../', cleanPath);
                  console.log(`[PDF Gen] Checking imgPath: ${imgPath}`);
                  if (fs.existsSync(imgPath)) {
                    imgBytes = fs.readFileSync(imgPath);
                    const lowerPath = imgPath.toLowerCase();
                    isPng = lowerPath.endsWith('.png');
                    isPdf = lowerPath.endsWith('.pdf');
                  } else {
                    console.error(`[PDF Gen] Img not found at path: ${imgPath}`);
                  }
                }

                if (imgBytes) {
                  if (isPdf) {
                    const [embeddedPage] = await pdfDoc.embedPdf(imgBytes, [0]);
                    embeddedMedia = { type: 'pdf', object: embeddedPage };
                  } else {
                    let image;
                    try {
                      image = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
                    } catch (e1) {
                      try {
                        image = isPng ? await pdfDoc.embedJpg(imgBytes) : await pdfDoc.embedPng(imgBytes);
                      } catch (e2) {
                        throw new Error("Could not embed image as JPG or PNG. " + e1.message);
                      }
                    }
                    embeddedMedia = { type: 'image', object: image };
                  }
                  // Save to cache for reuse in this PDF generation
                  embeddedMediaCache.set(imgRelPath, embeddedMedia);
                }
              }

              if (embeddedMedia) {
                const w = field.width || 100;
                const h = field.height || 100;

                if (embeddedMedia.type === 'pdf') {
                  page.drawPage(embeddedMedia.object, { x: field.x, y: yPos - h, width: w, height: h });
                } else {
                  page.drawImage(embeddedMedia.object, { x: field.x, y: yPos - h, width: w, height: h });
                }
              }
            } catch(e) { console.error("[PDF Gen] Img embed fail for", field.variable, ":", e.message); }
          }
        } else if (field.type === 'checkbox') {
          const val = getVariableValue(field.variable, applicationData);
          const isMatch = field.matchValue 
            ? String(val).toLowerCase() === String(field.matchValue).toLowerCase()
            : !!val; // if no match value, act as boolean flag
            
          if (isMatch) {
            page.drawText('✔', { // '✔' in pdf-lib's ZapfDingbats mapping is a heavy checkmark
              x: field.x + 2,
              y: yPos - (field.height || 20) + 2,
              size: (field.height || 20) - 2,
              font: dingbats,
              color: rgb(0, 0, 0)
            });
          }
        } else {
          // Handle Text
          let val = getVariableValue(field.variable, applicationData);
          
          if (field.variable && field.variable.startsWith('esign')) {
             // Always extract coordinates if it's an esign field (val must evaluate to true, which it does from getVariableValue)
             if (val) {
               const boxWidth = field.width || 150;
               const boxHeight = field.height || 30;
               const pageNum = String((field.page || 1));
               if (!esignCoordinatesMap[pageNum]) esignCoordinatesMap[pageNum] = [];
               esignCoordinatesMap[pageNum].push({
                 x: field.x,
                 y: yPos - boxHeight, 
                 width: boxWidth,
                 height: boxHeight
               });
             }
             // Force val to be empty so it NEVER manually draws the text!
             val = "";
          }

          if (val) {
            const boxWidth = field.width || 150;
            const boxHeight = field.height || 30;
            const textStr = String(val);
            
            let fontSize = field.fontSize || 12; 
            
            const getLines = (text, size, maxW) => {
              const cleanText = text.replace(/\r/g, '');
              const paragraphs = cleanText.split('\n');
              const allLines = [];
              for (const p of paragraphs) {
                const words = p.split(' ');
                let currentLine = words[0] || '';
                for (let i = 1; i < words.length; i++) {
                  const word = words[i];
                  const testLine = currentLine ? currentLine + ' ' + word : word;
                  if (font.widthOfTextAtSize(testLine, size) > maxW) {
                    allLines.push(currentLine);
                    currentLine = word;
                  } else {
                    currentLine = testLine;
                  }
                }
                allLines.push(currentLine);
              }
              return allLines;
            };

            let lines = getLines(textStr, fontSize, boxWidth - 4);
            let textHeight = lines.length * (fontSize * 1.2);

            while ((textHeight > boxHeight || lines.some(line => font.widthOfTextAtSize(line, fontSize) > boxWidth - 4)) && fontSize > 4) {
              fontSize -= 0.5;
              lines = getLines(textStr, fontSize, boxWidth - 4);
              textHeight = lines.length * (fontSize * 1.2);
            }

            const totalTextHeight = lines.length * (fontSize * 1.2);
            const verticalOffset = Math.max(0, (boxHeight - totalTextHeight) / 2);
            
            let currentY = yPos - verticalOffset - (fontSize * 0.9);

            for (const line of lines) {
              page.drawText(line, {
                x: field.x + 2, 
                y: currentY,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
              });
              currentY -= (fontSize * 1.2);
            }
          }
        }
      }
    } else {
      // FALLBACK TO ANNEXURE PAGE (OLD BEHAVIOR)
      const page = pdfDoc.addPage([595.28, 841.89]);
      const { width, height } = page.getSize();
      page.drawText('KYC SUMMARY ANNEXURE', { x: 50, y: height - 50, size: 18, font: boldFont, color: rgb(0, 0, 0) });

      let currentY = height - 90;
      const lineHeight = 18;

      const drawSection = (title) => {
        currentY -= 10;
        page.drawRectangle({ x: 45, y: currentY - 5, width: width - 90, height: 20, color: rgb(0.9, 0.9, 0.95) });
        page.drawText(title.toUpperCase(), { x: 50, y: currentY, size: 10, font: boldFont, color: rgb(0.1, 0.1, 0.4) });
        currentY -= 25;
      };

      const drawField = (label, value) => {
        const displayValue = String(value || 'Not Provided');
        page.drawText(`${label}:`, { x: 50, y: currentY, size: 9, font: boldFont });
        if (displayValue.length > 60) {
          page.drawText(displayValue.substring(0, 60), { x: 180, y: currentY, size: 9, font: font });
          currentY -= lineHeight - 4;
          page.drawText(displayValue.substring(60), { x: 180, y: currentY, size: 9, font: font });
        } else {
          page.drawText(displayValue, { x: 180, y: currentY, size: 9, font: font });
        }
        currentY -= lineHeight;
      };

      drawSection('Application Information');
      drawField('Application ID', applicationData.applicationId);
      drawField('Status', applicationData.status);

      drawSection('Personal & Identity Details');
      drawField('Full Name', getVariableValue('fullName', applicationData));
      drawField('PAN Number', getVariableValue('pan', applicationData));
      drawField('Aadhaar Number', getVariableValue('aadhaar', applicationData));
      drawField('Phone', getVariableValue('phone', applicationData));

      currentY -= 20;

      // Embed Selfie and Signature on Annexure
      const selfieRel = parsedSelfieDetails?.filePreview || parsedSelfieDetails?.path || parsedSelfieDetails?.preview || applicationData?.selfie?.preview;
      if (selfieRel) {
        try {
          let b, isPng;
          if (selfieRel.startsWith('data:image')) {
            b = Buffer.from(selfieRel.split(',')[1], 'base64');
            isPng = selfieRel.includes('image/png');
          } else {
            const clean = selfieRel.startsWith('/') ? selfieRel.substring(1) : selfieRel;
            const p = path.join(__dirname, '../../', clean);
            if (fs.existsSync(p)) {
              b = fs.readFileSync(p);
              isPng = p.toLowerCase().endsWith('.png');
            }
          }
          if (b) {
            const img = isPng ? await pdfDoc.embedPng(b) : await pdfDoc.embedJpg(b);
            const imgDims = img.scaleToFit(120, 120);
            page.drawImage(img, { x: 50, y: currentY - 140 + (120 - imgDims.height), width: imgDims.width, height: imgDims.height });
            page.drawText('CUSTOMER SELFIE', { x: 50, y: currentY - 155, size: 8, font: boldFont });
          }
        } catch (e) { console.error(e); }
      }

      const sigRel = parsedSignature?.filePreview || parsedSignature?.path || parsedSignature?.preview;
      if (sigRel) {
        try {
          let b, isPng;
          if (sigRel.startsWith('data:image')) {
            b = Buffer.from(sigRel.split(',')[1], 'base64');
            isPng = sigRel.includes('image/png');
          } else {
            const clean = sigRel.startsWith('/') ? sigRel.substring(1) : sigRel;
            const p = path.join(__dirname, '../../', clean);
            if (fs.existsSync(p)) {
              b = fs.readFileSync(p);
              isPng = p.toLowerCase().endsWith('.png');
            }
          }
          if (b) {
            const img = isPng ? await pdfDoc.embedPng(b) : await pdfDoc.embedJpg(b);
            const imgDims = img.scaleToFit(120, 60);
            page.drawImage(img, { x: 350, y: currentY - 140 + (60 - imgDims.height), width: imgDims.width, height: imgDims.height });
            page.drawText('CUSTOMER SIGNATURE', { x: 350, y: currentY - 155, size: 8, font: boldFont });
          }
        } catch (e) { console.error(e); }
      }
    }

    // 5. Append Uploaded and Extracted Documents (ALWAYS RUNS)
    const appendDocument = async (docPathRel, title) => {
      if (!docPathRel) return;
      try {
        let bytes;
        let lowerPath = docPathRel.toLowerCase();
        let isPdf = lowerPath.endsWith('.pdf') || docPathRel.includes('application/pdf') || docPathRel.includes('f_pdf');
        let isPng = lowerPath.endsWith('.png') || docPathRel.includes('image/png') || docPathRel.includes('f_png');
        
        if (docPathRel.startsWith('http://') || docPathRel.startsWith('https://')) {
          const axios = require('axios');
          const response = await axios.get(docPathRel, { 
            responseType: 'arraybuffer',
            timeout: 10000 // 10s timeout
          });
          if (response.status === 200) {
            bytes = response.data;
            const contentType = response.headers['content-type'] || '';
            if (contentType.includes('image')) {
              isPdf = false;
              isPng = contentType.includes('png');
            } else if (contentType.includes('pdf')) {
              isPdf = true;
              isPng = false;
            }
          } else {
            console.error(`[PDF Gen] Error fetching doc URL: HTTP ${response.status}`);
            return;
          }
        } else {
          const cleanPath = docPathRel.startsWith('/') ? docPathRel.substring(1) : docPathRel;
          const docPath = path.join(__dirname, '../../', cleanPath);
          if (!fs.existsSync(docPath)) return;
          bytes = fs.readFileSync(docPath);
          lowerPath = docPath.toLowerCase();
          isPdf = lowerPath.endsWith('.pdf');
          isPng = lowerPath.endsWith('.png');
        }

        if (isPdf) {
          const externalPdf = await PDFDocument.load(bytes);
          const copied = await pdfDoc.copyPages(externalPdf, externalPdf.getPageIndices());
          copied.forEach((p, idx) => {
            const addedPage = pdfDoc.addPage(p);
            if (title) {
              const { width: pWidth, height: pHeight } = addedPage.getSize();
              const pageTitle = copied.length > 1 ? `${title.toUpperCase()} (PAGE ${idx + 1} OF ${copied.length})` : title.toUpperCase();
              const textWidth = boldFont.widthOfTextAtSize(pageTitle, 14);
              // Draw white background for text readability over PDFs
              addedPage.drawRectangle({ x: pWidth - textWidth - 55, y: pHeight - 65, width: textWidth + 10, height: 20, color: rgb(1,1,1) });
              addedPage.drawText(pageTitle, { x: pWidth - textWidth - 50, y: pHeight - 50, size: 14, font: boldFont, color: rgb(0,0,0) });
            }
          });
        } else if (isPng || lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg') || docPathRel.includes('image/')) {
          let img;
          try {
            img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
          } catch (e1) {
            try {
              // Fallback in case the extension doesn't match the actual format
              img = isPng ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
            } catch (e2) {
              console.error(`[PDF Gen] Failed to embed image ${docPathRel}`);
              return;
            }
          }
          const imgPage = pdfDoc.addPage([595.28, 841.89]); // A4
          const { width: pWidth, height: pHeight } = imgPage.getSize();
          
          if (title) {
            const pageTitle = title.toUpperCase();
            const textWidth = boldFont.widthOfTextAtSize(pageTitle, 14);
            imgPage.drawText(pageTitle, { x: pWidth - textWidth - 50, y: pHeight - 50, size: 14, font: boldFont, color: rgb(0,0,0) });
          }

          const imgDims = img.scaleToFit(pWidth - 100, pHeight - 100);
          imgPage.drawImage(img, {
            x: pWidth / 2 - imgDims.width / 2,
            y: pHeight / 2 - imgDims.height / 2,
            width: imgDims.width,
            height: imgDims.height,
          });
        }
      } catch (e) {
        console.error(`[PDF Gen] Failed to append document ${docPathRel}:`, e.message);
      }
    };

      const docsToAppend = [];
      const seenTypes = new Set();
      
      // Reverse the array so we process the newest documents first
      [...parsedDocuments].reverse().forEach(doc => {
        if (doc?.path && doc.type !== 'ESIGN' && doc.type !== 'ESIGN_DOCUMENT' && doc.type !== 'DIGILOCKER_DOCUMENT') {
          // Use the document type as a unique identifier
          const typeKey = doc.type || doc.name || doc.path;
          
          if (!seenTypes.has(typeKey)) {
            seenTypes.add(typeKey);
            // unshift puts the newest documents at the front so the chronological order is preserved
            docsToAppend.unshift({ path: doc.path, title: doc.type || 'Document' });
          }
        }
      });
    
    const panPath = parsedPanUpload?.path || parsedPanUpload?.filePreview || parsedPanUpload?.preview;
    if (panPath) docsToAppend.push({ path: panPath, title: 'PAN Upload' });
    
    const finPath = parsedFinancialProof?.path || parsedFinancialProof?.filePreview || parsedFinancialProof?.preview;
    if (finPath) docsToAppend.push({ path: finPath, title: 'Financial Proof' });
    
    const bankPath = parsedBankDetails?.proofPath || parsedBankDetails?.proofPreview || parsedBankDetails?.proof;
    if (bankPath) docsToAppend.push({ path: bankPath, title: 'Bank Proof' });
    
    const pepPath = parsedPersonalDetails?.pepProof || parsedPersonalDetails?.pepProofPreview;
    if (pepPath) docsToAppend.push({ path: pepPath, title: 'PEP Proof' });
    
    if (parsedNomineeDetails?.nominees && Array.isArray(parsedNomineeDetails.nominees)) {
      parsedNomineeDetails.nominees.forEach((nom, idx) => {
        const nomPath = nom.proofPath || nom.proofPreview || nom.preview;
        if (nomPath) docsToAppend.push({ path: nomPath, title: `Nominee ${idx + 1} Proof` });
        
        const guardPath = nom.guardianProofPath || nom.guardianProofPreview || nom.guardianPreview;
        if (guardPath) docsToAppend.push({ path: guardPath, title: `Nominee ${idx + 1} Guardian Proof` });
      });
    }

    if (!options.skipDocumentAppend) {
      const seenPaths = new Set();
      for (const doc of docsToAppend) {
        if (seenPaths.has(doc.path)) continue;
        seenPaths.add(doc.path);
        await appendDocument(doc.path, doc.title);
      }
    }

    console.log(`[PDF Gen] Successfully generated PDF`);
    const pdfBase64 = await pdfDoc.saveAsBase64();
    if (options.extractEsignCoordinates) {
      return { pdfBase64, esignCoordinatesMap };
    }
    return pdfBase64;
  } catch (error) {
    console.error("[PDF Gen] Fatal error:", error);
    throw error;
  }
}

module.exports = { generateKycPdf };
