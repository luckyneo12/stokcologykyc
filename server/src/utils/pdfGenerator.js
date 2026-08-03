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
    case 'isTaxResidencyOtherYes': { const d = safeJsonParse(appData.declarations) || {}; return d.taxResidencyOutside === 'Yes'; }
    case 'isTaxResidencyOtherNo': { const d = safeJsonParse(appData.declarations) || {}; return d.taxResidencyOutside !== 'Yes'; }
    
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
    case 'isAadhaarPoaChecked': return !!iDetails.aadhaar;
    case 'isPennyDropChecked': return !!bDetails.verified || !!bDetails.accountNumber;
    case 'isIncomeItrChecked': return String(safeJsonParse(appData.financialProof)?.proofType || '').toLowerCase().includes('itr');
    case 'isIncomeSalaryChecked': return String(safeJsonParse(appData.financialProof)?.proofType || '').toLowerCase().includes('salary');
    case 'isIncomeNetworthChecked': return String(safeJsonParse(appData.financialProof)?.proofType || '').toLowerCase().includes('networth');
    case 'isIncomeDematChecked': return String(safeJsonParse(appData.financialProof)?.proofType || '').toLowerCase().includes('demat');
    case 'isIncomeBankChecked': return String(safeJsonParse(appData.financialProof)?.proofType || '').toLowerCase().includes('bank');
    case 'isIncomeAnnualChecked': return String(safeJsonParse(appData.financialProof)?.proofType || '').toLowerCase().includes('annual');
    case 'isIncomeSelfDecChecked': return String(safeJsonParse(appData.financialProof)?.proofType || '').toLowerCase().includes('self');
    case 'isIncomeOthersChecked': return String(safeJsonParse(appData.financialProof)?.proofType || '').toLowerCase().includes('other');
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
      return `Digitally Signed by ${name}\nDate: ${dateStr}\nReason: KYC Application`;
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
    case 'annualIncome': return pDetails.incomeRange || pDetails.annualIncome;
    case 'isIncomeBelow1Lac': { const i = String(pDetails.incomeRange || pDetails.annualIncome || '').toLowerCase(); return i.includes('below 1') || i.includes('<1'); }
    case 'isIncome1To5Lacs': { const i = String(pDetails.incomeRange || pDetails.annualIncome || '').toLowerCase(); return i.includes('1-5') || i.includes('1 to 5'); }
    case 'isIncome5To10Lacs': { const i = String(pDetails.incomeRange || pDetails.annualIncome || '').toLowerCase(); return i.includes('5-10') || i.includes('5 to 10'); }
    case 'isIncome10To25Lacs': { const i = String(pDetails.incomeRange || pDetails.annualIncome || '').toLowerCase(); return i.includes('10-25') || i.includes('10 to 25'); }
    case 'isIncomeAbove25Lacs': { const i = String(pDetails.incomeRange || pDetails.annualIncome || '').toLowerCase(); return i.includes('>25') || i.includes('above 25') || i.includes('more than 25'); }
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
    case 'ddpi': return pDetails.ddpi || appData.ddpi;
    
    // Declarations
    case 'dis': { const d = safeJsonParse(appData.declarations) || {}; return d.dis || appData.dis; }
    case 'receiveCredits': { const d = safeJsonParse(appData.declarations) || {}; return d.receiveCredits; }
    case 'eStatement': { const d = safeJsonParse(appData.declarations) || {}; return d.eStatement; }
    case 'acceptPledgeInstructions': { const d = safeJsonParse(appData.declarations) || {}; return d.acceptPledgeInstructions; }
    case 'receiveAnnualReports': { const d = safeJsonParse(appData.declarations) || {}; return d.receiveAnnualReports; }
    case 'settlement': { const d = safeJsonParse(appData.declarations) || {}; return d.settlement; }
    case 'smsAlert': { const d = safeJsonParse(appData.declarations) || {}; return d.smsAlert; }
    case 'operatedThroughDDPI': { const d = safeJsonParse(appData.declarations) || {}; return d.operatedThroughDDPI; }
    
    // Segments
    case 'bsda': return appData.bsda;
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

async function generateKycPdf(applicationData) {
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

      for (const field of fields) {
        const pageIndex = (field.page || 1) - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) continue;
        
        const page = pages[pageIndex];
        const { height } = page.getSize();
        // pdf-lib's y coordinate is from bottom. The frontend will likely send y from top.
        // We will assume frontend sends y from top, so we do height - y.
        const yPos = height - field.y; 

        const imageVariables = [
          'selfie', 'signature', 'panImage', 'aadhaarImage', 
          'bankProof', 'incomeProof', 'pepProof', 'nomineeProof', 'addressProof', 'panDocument'
        ];

        if (imageVariables.includes(field.variable)) {
          let imgRelPath = null;
          if (field.variable === 'selfie') {
            imgRelPath = (typeof parsedSelfieDetails === 'string' ? parsedSelfieDetails : (parsedSelfieDetails.filePreview || parsedSelfieDetails.path || parsedSelfieDetails.preview)) 
                         || (typeof applicationData.selfie === 'string' ? applicationData.selfie : applicationData.selfie?.preview);
          } else if (field.variable === 'signature') {
            imgRelPath = typeof parsedSignature === 'string' ? parsedSignature : (parsedSignature.filePreview || parsedSignature.path || parsedSignature.preview);
          } else if (field.variable === 'esign') {
            const esignDoc = parsedDocuments.find(d => d.type === 'ESIGN');
            if (esignDoc) {
              imgRelPath = 'data:image/png;base64,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';
            } else {
              imgRelPath = null;
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
          } else if (field.variable === 'nomineeProof') {
            imgRelPath = typeof parsedNomineeDetails === 'string' ? parsedNomineeDetails : (parsedNomineeDetails?.nominees?.[0]?.proofPath || parsedNomineeDetails?.nominees?.[0]?.proofPreview || parsedNomineeDetails?.nominees?.[0]?.preview);
          } else if (field.variable === 'addressProof') {
            const addrDoc = parsedDocuments.find(d => d.path && /address_proof|driving_license|voter|passport/i.test(d.path));
            if (addrDoc) imgRelPath = addrDoc.path;
          }

          if (imgRelPath) {
            try {
              let imgBytes;
              let isPng = false;
              let isPdf = false;
              
              if (imgRelPath.startsWith('data:image')) {
                const base64Data = imgRelPath.split(',')[1];
                imgBytes = Buffer.from(base64Data, 'base64');
                isPng = imgRelPath.includes('image/png');
              } else if (imgRelPath.startsWith('http://') || imgRelPath.startsWith('https://')) {
                console.log(`[PDF Gen] Fetching image from URL: ${imgRelPath}`);
                try {
                  const https = require('https');
                  const http = require('http');
                  const client = imgRelPath.startsWith('https') ? https : http;
                  imgBytes = await new Promise((resolve, reject) => {
                    client.get(imgRelPath, (res) => {
                      if (res.statusCode >= 200 && res.statusCode < 300) {
                        const chunks = [];
                        res.on('data', chunk => chunks.push(chunk));
                        res.on('end', () => resolve(Buffer.concat(chunks)));
                      } else {
                        reject(new Error(`Status Code: ${res.statusCode}`));
                      }
                    }).on('error', reject);
                  });
                  const lowerPath = imgRelPath.toLowerCase();
                  isPng = lowerPath.endsWith('.png') || imgRelPath.includes('image/png');
                  isPdf = lowerPath.endsWith('.pdf') || imgRelPath.includes('application/pdf');
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
                const w = field.width || 100;
                const h = field.height || 100;

                if (isPdf) {
                  const [embeddedPage] = await pdfDoc.embedPdf(imgBytes, [0]);
                  page.drawPage(embeddedPage, { x: field.x, y: yPos - h, width: w, height: h });
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
                  page.drawImage(image, { x: field.x, y: yPos - h, width: w, height: h });
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
          const val = getVariableValue(field.variable, applicationData);
          if (val) {
            const textStr = String(val);
            const boxWidth = field.width || 150;
            const boxHeight = field.height || 30;
            
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
        const cleanPath = docPathRel.startsWith('/') ? docPathRel.substring(1) : docPathRel;
        const docPath = path.join(__dirname, '../../', cleanPath);
        if (!fs.existsSync(docPath)) return;

        const bytes = fs.readFileSync(docPath);
        const lowerPath = docPath.toLowerCase();

        if (lowerPath.endsWith('.pdf')) {
          const externalPdf = await PDFDocument.load(bytes);
          const copied = await pdfDoc.copyPages(externalPdf, externalPdf.getPageIndices());
          copied.forEach((p) => pdfDoc.addPage(p));
        } else if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg') || lowerPath.endsWith('.png')) {
          const img = lowerPath.endsWith('.png') ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
          const imgPage = pdfDoc.addPage([595.28, 841.89]); // A4
          const { width: pWidth, height: pHeight } = imgPage.getSize();
          
          if (title) {
            imgPage.drawText(title.toUpperCase(), { x: 50, y: pHeight - 50, size: 14, font: boldFont, color: rgb(0,0,0) });
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
    
    parsedDocuments.forEach(doc => {
      if (doc?.path && doc.type !== 'ESIGN' && doc.type !== 'DIGILOCKER_DOCUMENT') {
        docsToAppend.push({ path: doc.path, title: doc.type || 'Document' });
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

    const seenPaths = new Set();
    for (const doc of docsToAppend) {
      if (seenPaths.has(doc.path)) continue;
      seenPaths.add(doc.path);
      await appendDocument(doc.path, doc.title);
    }

    console.log(`[PDF Gen] Successfully generated PDF`);
    return await pdfDoc.saveAsBase64();
  } catch (error) {
    console.error("[PDF Gen] Fatal error:", error);
    throw error;
  }
}

module.exports = { generateKycPdf };
