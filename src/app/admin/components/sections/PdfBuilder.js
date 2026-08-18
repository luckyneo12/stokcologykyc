import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { API_BASE_URL } from "@/utils/apiConfig";

// ─── SVG Icon helpers ────────────────────────────────────────────────
const Icon = ({ d, size = 16, stroke = 'currentColor', fill = 'none', sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{typeof d === 'string' ? <path d={d}/> : d}</svg>
);
const Icons = {
  upload: <Icon d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>,
  undo: <Icon d={<><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6.69 3L3 13"/></>}/>,
  redo: <Icon d={<><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016.69 3L21 13"/></>}/>,
  zoomIn: <Icon d={<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></>}/>,
  zoomOut: <Icon d={<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></>}/>,
  chevLeft: <Icon d="M15 18l-6-6 6-6" size={14}/>,
  chevRight: <Icon d="M9 18l6-6-6-6" size={14}/>,
  analyze: <Icon d={<><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></>}/>,
  trash: <Icon d={<><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></>}/>,
  copy: <Icon d={<><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>}/>,
  settings: <Icon d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>}/>,
  text: <Icon d={<><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5"/><path d="M11.828 15H9v-2.828l8.586-8.586a2 2 0 112.828 2.828L11.828 15z"/></>} size={14}/>,
  image: <Icon d={<><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>} size={14}/>,
  check: <Icon d="M20 6L9 17l-5-5" size={14}/>,
  compile: <Icon d={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>}/>,
  panelLeft: <Icon d={<><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></>} size={14}/>,
  panelRight: <Icon d={<><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="15" y1="3" x2="15" y2="21"/></>} size={14}/>,
  crosshair: <Icon d={<><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></>} size={40}/>,
  addPage: <Icon d={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></>}/>,
  deletePage: <Icon d={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></>}/>,
  replace: <Icon d={<><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></>}/>,
  alignLine: <Icon d={<><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></>} size={14}/>,
  normalizeFont: <Icon d={<><path d="M4 7V4h16v3"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></>} size={14}/>,
};

// ─── Available Variables ──────────────────────────────────────────────
const BASE_VARIABLES = [
  // Application
  { name: 'Application ID', key: 'applicationId', type: 'text', group: 'Application' },
  { name: 'Status', key: 'status', type: 'text', group: 'Application' },
  { name: 'Pricing Plan', key: 'plan', type: 'text', group: 'Application' },
  { name: 'Submission Date', key: 'date', type: 'text', group: 'Application' },
  { name: 'Submission Place', key: 'place', type: 'text', group: 'Application' },
  { name: 'New KYC (Check)', key: 'isNewKyc', type: 'checkbox', group: 'Application' },
  { name: 'Modification KYC (Check)', key: 'isModificationKyc', type: 'checkbox', group: 'Application' },
  { name: 'Form No', key: 'formNo', type: 'text', group: 'Application' },
  { name: 'Date of Opening KYC', key: 'openingDate', type: 'text', group: 'Application' },
  { name: 'Client Code', key: 'clientCode', type: 'text', group: 'Application' },
  { name: 'IPV Date', key: 'ipvDate', type: 'text', group: 'Application' },
  { name: 'Self Certified OVD (Check)', key: 'alwaysTrueOvd', type: 'checkbox', group: 'Application' },
  { name: 'Relation: Self (Check)', key: 'isContactRelationSelf', type: 'checkbox', group: 'Application' },
  { name: 'Relation: Spouse (Check)', key: 'isContactRelationSpouse', type: 'checkbox', group: 'Application' },
  { name: 'Relation: Children (Check)', key: 'isContactRelationChildren', type: 'checkbox', group: 'Application' },
  { name: 'Relation: Parents (Check)', key: 'isContactRelationParents', type: 'checkbox', group: 'Application' },
  { name: 'SMS Facility: Yes (Check)', key: 'isSmsFacilityYes', type: 'checkbox', group: 'Application' },
  { name: 'SMS Facility: No (Check)', key: 'isSmsFacilityNo', type: 'checkbox', group: 'Application' },
  
  { name: 'KYC Mode: Normal (Check)', key: 'isKycModeNormal', type: 'checkbox', group: 'Application' },
  { name: 'KYC Mode: EKYC OTP (Check)', key: 'isKycModeEkycOtp', type: 'checkbox', group: 'Application' },
  { name: 'KYC Mode: EKYC Biometric (Check)', key: 'isKycModeEkycBiometric', type: 'checkbox', group: 'Application' },
  { name: 'KYC Mode: Online KYC (Check)', key: 'isKycModeOnlineKyc', type: 'checkbox', group: 'Application' },
  { name: 'KYC Mode: Offline EKYC (Check)', key: 'isKycModeOfflineEkyc', type: 'checkbox', group: 'Application' },
  { name: 'KYC Mode: Digilocker (Check)', key: 'isKycModeDigilocker', type: 'checkbox', group: 'Application' },
  
  // Standing Instructions / Preferences
  { name: 'Contract Note: Electronic', key: 'isContractNoteElectronic', type: 'checkbox', group: 'Application' },
  { name: 'Contract Note: Physical', key: 'isContractNotePhysical', type: 'checkbox', group: 'Application' },
  { name: 'Settlement: Monthly', key: 'isSettlementMonthly', type: 'checkbox', group: 'Application' },
  { name: 'Settlement: Quarterly', key: 'isSettlementQuarterly', type: 'checkbox', group: 'Application' },
  { name: 'Internet Trading: Yes', key: 'isInternetTradingYes', type: 'checkbox', group: 'Application' },
  { name: 'Internet Trading: No', key: 'isInternetTradingNo', type: 'checkbox', group: 'Application' },
  { name: 'Std Docs: Electronic', key: 'isStdDocsElectronic', type: 'checkbox', group: 'Application' },
  { name: 'Std Docs: Physical', key: 'isStdDocsPhysical', type: 'checkbox', group: 'Application' },
  { name: 'Digitally Signed: Yes (Check)', key: 'isDigitallySignedYes', type: 'checkbox', group: 'Application' },
  { name: 'Digitally Signed: No (Check)', key: 'isDigitallySignedNo', type: 'checkbox', group: 'Application' },
  { name: 'Tax Residency Other: Yes (Check)', key: 'isTaxResidencyOtherYes', type: 'checkbox', group: 'Application' },
  { name: 'Tax Residency Other: No (Check)', key: 'isTaxResidencyOtherNo', type: 'checkbox', group: 'Application' },
  
  // Segments
  { name: 'Segment: Cash/Mutual Fund', key: 'isSegmentCash', type: 'checkbox', group: 'Application' },
  { name: 'Segment: F&O', key: 'isSegmentFnO', type: 'checkbox', group: 'Application' },
  { name: 'Segment: Currency', key: 'isSegmentCurrency', type: 'checkbox', group: 'Application' },
  { name: 'Segment: Debt', key: 'isSegmentDebt', type: 'checkbox', group: 'Application' },
  { name: 'Segment: Commodity', key: 'isSegmentCommodity', type: 'checkbox', group: 'Application' },

  // Static Elements
  { name: 'Static Text: Yes', key: 'static.yes', type: 'text', group: 'Static Elements' },
  { name: 'Static Text: No', key: 'static.no', type: 'text', group: 'Static Elements' },
  { name: 'Static Checkbox (Ticked)', key: 'static.true', type: 'checkbox', group: 'Static Elements' },
  { name: 'Static Checkbox (Unticked)', key: 'static.false', type: 'checkbox', group: 'Static Elements' },

  // Personal
  { name: 'Gender: Male', key: 'gender_male_tick', type: 'checkbox', group: 'Personal' },
  { name: 'Gender: Female', key: 'gender_female_tick', type: 'checkbox', group: 'Personal' },
  { name: 'Gender: Transgender', key: 'gender_transgender_tick', type: 'checkbox', group: 'Personal' },
  { name: 'Marital Status: Single', key: 'marital_single_tick', type: 'checkbox', group: 'Personal' },
  { name: 'Marital Status: Married', key: 'marital_married_tick', type: 'checkbox', group: 'Personal' },
  { name: 'Nationality: Indian', key: 'nationality_indian_tick', type: 'checkbox', group: 'Personal' },
  { name: 'Nationality: Other', key: 'nationality_other_tick', type: 'checkbox', group: 'Personal' },
  { name: 'Nationality: Other Text', key: 'nationality_other_text', type: 'text', group: 'Personal' },
  { name: 'Res Status: Resident', key: 'residential_resident_tick', type: 'checkbox', group: 'Personal' },
  { name: 'Res Status: NRI', key: 'residential_nri_tick', type: 'checkbox', group: 'Personal' },
  { name: 'Res Status: Foreign', key: 'residential_foreign_tick', type: 'checkbox', group: 'Personal' },
  { name: 'Res Status: PIO', key: 'residential_pio_tick', type: 'checkbox', group: 'Personal' },
  { name: 'Prefix', key: 'prefix', type: 'text', group: 'Personal' },
  { name: 'BOID', key: 'boid', type: 'text', group: 'Personal' },
  { name: 'Full Name', key: 'fullName', type: 'text', group: 'Personal' },
  { name: 'Father/Spouse Name', key: 'fatherName', type: 'text', group: 'Personal' },
  { name: "Mother's Name", key: 'motherName', type: 'text', group: 'Personal' },
  { name: 'Gender', key: 'gender', type: 'text', group: 'Personal' },
  { name: 'Date of Birth', key: 'dob', type: 'text', group: 'Personal' },
  { name: 'Nationality', key: 'nationality', type: 'text', group: 'Personal' },
  { name: 'Marital Status', key: 'maritalStatus', type: 'text', group: 'Personal' },
  { name: 'Occupation', key: 'occupation', type: 'text', group: 'Personal' },
  { name: 'Education', key: 'education', type: 'text', group: 'Personal' },
  { name: 'Occ: Govt Service (Check)', key: 'isOccGovt', type: 'checkbox', group: 'Personal' },
  { name: 'Occ: Public Sector (Check)', key: 'isOccPublic', type: 'checkbox', group: 'Personal' },
  { name: 'Occ: Agriculturist (Check)', key: 'isOccAgri', type: 'checkbox', group: 'Personal' },
  { name: 'Occ: Professional (Check)', key: 'isOccProf', type: 'checkbox', group: 'Personal' },
  { name: 'Occ: Business (Check)', key: 'isOccBus', type: 'checkbox', group: 'Personal' },
  { name: 'Occ: Housewife (Check)', key: 'isOccHousewife', type: 'checkbox', group: 'Personal' },
  { name: 'Occ: Private Sector (Check)', key: 'isOccPrivate', type: 'checkbox', group: 'Personal' },
  { name: 'Occ: Retired (Check)', key: 'isOccRetired', type: 'checkbox', group: 'Personal' },
  { name: 'Occ: Student (Check)', key: 'isOccStudent', type: 'checkbox', group: 'Personal' },
  { name: 'Occ: Others (Check)', key: 'isOccOthers', type: 'checkbox', group: 'Personal' },
  { name: 'Annual Income', key: 'annualIncome', type: 'text', group: 'Personal' },
  { name: 'Income: Below 1 Lac (Check)', key: 'isIncomeBelow1Lac', type: 'checkbox', group: 'Personal' },
  { name: 'Income: 1-5 Lacs (Check)', key: 'isIncome1To5Lacs', type: 'checkbox', group: 'Personal' },
  { name: 'Income: 5-10 Lacs (Check)', key: 'isIncome5To10Lacs', type: 'checkbox', group: 'Personal' },
  { name: 'Income: 10-25 Lacs (Check)', key: 'isIncome10To25Lacs', type: 'checkbox', group: 'Personal' },
  { name: 'Income: >25 Lacs (Check)', key: 'isIncomeAbove25Lacs', type: 'checkbox', group: 'Personal' },
  
  // Tax Residency outside India
  { name: 'Tax Residency Outside India?', key: 'taxResidencyOutside', type: 'text', group: 'Personal' },
  { name: 'Country of Birth', key: 'countryOfBirth', type: 'text', group: 'Personal' },
  { name: 'Citizenship', key: 'citizenship', type: 'text', group: 'Personal' },
  { name: 'Tax Residence 1 (Country)', key: 'taxResidence1', type: 'text', group: 'Personal' },
  { name: 'Tax Residence 1 (TIN)', key: 'taxId1', type: 'text', group: 'Personal' },
  { name: 'Tax Residence 1 (Address)', key: 'taxAddress1', type: 'text', group: 'Personal' },
  { name: 'Tax Residence 1 (Type)', key: 'taxIdType1', type: 'text', group: 'Personal' },
  { name: 'Tax Residence 2 (Country)', key: 'taxResidence2', type: 'text', group: 'Personal' },
  { name: 'Tax Residence 2 (TIN)', key: 'taxId2', type: 'text', group: 'Personal' },
  { name: 'Tax Residence 2 (Address)', key: 'taxAddress2', type: 'text', group: 'Personal' },
  { name: 'Tax Residence 2 (Type)', key: 'taxIdType2', type: 'text', group: 'Personal' },
  { name: 'Tax Residence 3 (Country)', key: 'taxResidence3', type: 'text', group: 'Personal' },
  { name: 'Tax Residence 3 (TIN)', key: 'taxId3', type: 'text', group: 'Personal' },
  { name: 'Tax Residence 3 (Address)', key: 'taxAddress3', type: 'text', group: 'Personal' },
  { name: 'Tax Residence 3 (Type)', key: 'taxIdType3', type: 'text', group: 'Personal' },

  // Regulatory / Profile
  { name: 'Trading Experience', key: 'experience', type: 'text', group: 'Regulatory' },
  { name: 'Politically Exposed', key: 'politicallyExposed', type: 'text', group: 'Regulatory' },
  { name: 'PEP (Yes/No)', key: 'pepText', type: 'text', group: 'Regulatory' },
  { name: 'Is PEP (Check)', key: 'isPepYes', type: 'checkbox', group: 'Regulatory' },
  { name: 'Is Not PEP (Check)', key: 'isPepNo', type: 'checkbox', group: 'Regulatory' },
  { name: 'PEP Type', key: 'pepType', type: 'text', group: 'Regulatory' },
  { name: 'Indian Citizen', key: 'isIndianCitizen', type: 'text', group: 'Regulatory' },
  { name: 'Tax Resident Outside', key: 'taxResidencyOutside', type: 'text', group: 'Regulatory' },
  { name: 'Resident Individual (Check)', key: 'isResidentIndividual', type: 'checkbox', group: 'Regulatory' },
  { name: 'Non Resident Indian (Check)', key: 'isNonResidentIndian', type: 'checkbox', group: 'Regulatory' },
  { name: 'DDPI Choice', key: 'ddpi', type: 'text', group: 'Regulatory' },

  { name: 'Email Belongs To (Self)', key: 'static.emailBelongsToSelf', type: 'text', group: 'Personal' },
  { name: 'Mobile Belongs To (Self)', key: 'static.mobileBelongsToSelf', type: 'text', group: 'Personal' },

  // Declarations
  { name: 'DIS Preference', key: 'dis', type: 'text', group: 'Declarations' },
  { name: 'DIS Option 1 (Check)', key: 'isDisOption1', type: 'checkbox', group: 'Declarations' },
  { name: 'DIS Option 2 (Check)', key: 'isDisOption2', type: 'checkbox', group: 'Declarations' },
  { name: 'Receive Credits', key: 'receiveCredits', type: 'text', group: 'Declarations' },
  { name: 'E-Statement', key: 'eStatement', type: 'text', group: 'Declarations' },
  { name: 'Accept Pledge Inst.', key: 'acceptPledgeInstructions', type: 'text', group: 'Declarations' },
  { name: 'Receive Annual Reports', key: 'receiveAnnualReports', type: 'text', group: 'Declarations' },
  { name: 'Account Settlement', key: 'settlement', type: 'text', group: 'Declarations' },
  { name: 'SMS Alert Facility', key: 'smsAlert', type: 'text', group: 'Declarations' },
  { name: 'Operated Through DDPI', key: 'operatedThroughDDPI', type: 'text', group: 'Declarations' },

  // Segments
  { name: 'BSDA Preference', key: 'bsda', type: 'text', group: 'Segments' },
  { name: 'BSDA Avail (Check)', key: 'isBsdaAvail', type: 'checkbox', group: 'Segments' },
  { name: 'BSDA Opt-Out (Check)', key: 'isBsdaOptOut', type: 'checkbox', group: 'Segments' },
  { name: 'Segment - Equity (Text)', key: 'segments.equity', type: 'text', group: 'Segments' },
  { name: 'Segment - Derivatives (Text)', key: 'segments.derivatives', type: 'text', group: 'Segments' },
  { name: 'Segment - Equity (Check)', key: 'isSegmentEquity', type: 'checkbox', group: 'Segments' },
  { name: 'Segment - Derivatives (Check)', key: 'isSegmentDerivatives', type: 'checkbox', group: 'Segments' },

  // Identity & Contact
  { name: 'PAN Number', key: 'pan', type: 'text', group: 'Identity' },
  { name: 'Aadhaar Number', key: 'aadhaar', type: 'text', group: 'Identity' },
  { name: 'POI Aadhaar (Check)', key: 'isPoiAadhaar', type: 'checkbox', group: 'Identity' },
  { name: 'POI Passport (Check)', key: 'isPoiPassport', type: 'checkbox', group: 'Identity' },
  { name: 'POI Driving License (Check)', key: 'isPoiDrivingLicense', type: 'checkbox', group: 'Identity' },
  { name: 'POI Voter ID (Check)', key: 'isPoiVoterId', type: 'checkbox', group: 'Identity' },
  { name: 'POI PAN (Check)', key: 'isPoiPan', type: 'checkbox', group: 'Identity' },
  { name: 'Phone', key: 'phone', type: 'text', group: 'Contact' },
  { name: 'Email Address', key: 'email', type: 'text', group: 'Contact' },
  
  // Address
  { name: 'Address Line 1', key: 'addressLine1', type: 'text', group: 'Address' },
  { name: 'Address Line 2', key: 'addressLine2', type: 'text', group: 'Address' },
  { name: 'Landmark', key: 'landmark', type: 'text', group: 'Address' },
  { name: 'City', key: 'city', type: 'text', group: 'Address' },
  { name: 'District', key: 'district', type: 'text', group: 'Address' },
  { name: 'State', key: 'state', type: 'text', group: 'Address' },
  { name: 'Country', key: 'country', type: 'text', group: 'Address' },
  { name: 'Pincode', key: 'pincode', type: 'text', group: 'Address' },
  { name: 'Full Address', key: 'address.fullAddress', type: 'text', group: 'Address' },
  { name: 'Addr Type Res/Bus (Check)', key: 'isAddrTypeResBus', type: 'checkbox', group: 'Address' },
  { name: 'Addr Type Residential (Check)', key: 'isAddrTypeRes', type: 'checkbox', group: 'Address' },
  { name: 'Addr Type Business (Check)', key: 'isAddrTypeBus', type: 'checkbox', group: 'Address' },
  { name: 'Addr Type Registered Off (Check)', key: 'isAddrTypeRegOff', type: 'checkbox', group: 'Address' },
  { name: 'Addr Type Unspecified (Check)', key: 'isAddrTypeUnspec', type: 'checkbox', group: 'Address' },
  
  // Bank
  { name: 'Bank Name', key: 'bankName', type: 'text', group: 'Bank' },
  { name: 'Branch Name', key: 'branchName', type: 'text', group: 'Bank' },
  { name: 'Bank Address', key: 'bankAddress', type: 'text', group: 'Bank' },
  { name: 'Account Num', key: 'accountNumber', type: 'text', group: 'Bank' },
  { name: 'IFSC Code', key: 'ifsc', type: 'text', group: 'Bank' },
  { name: 'MICR Code', key: 'micr', type: 'text', group: 'Bank' },
  { name: 'Account Type', key: 'accountType', type: 'text', group: 'Bank' },

  // Nominee
  { name: 'Nominee 1 Name', key: 'nomineeDetails.nominees[0].name', type: 'text', group: 'Nominee 1' },
  { name: 'Nominee 1 Relation', key: 'nomineeDetails.nominees[0].relation', type: 'text', group: 'Nominee 1' },
  { name: 'Nominee 1 Allocation %', key: 'nomineeAllocation.percentages[0]', type: 'text', group: 'Nominee 1' },
  { name: 'Nominee 1 DOB', key: 'nomineeDetails.nominees[0].dob', type: 'text', group: 'Nominee 1' },
  { name: 'Nominee 1 Mobile', key: 'nomineeDetails.nominees[0].mobile', type: 'text', group: 'Nominee 1' },
  { name: 'Nominee 1 Email', key: 'nomineeDetails.nominees[0].email', type: 'text', group: 'Nominee 1' },
  { name: 'Nominee 1 Address', key: 'nomineeDetails.nominees[0].address', type: 'text', group: 'Nominee 1' },
  { name: 'Nominee 1 City', key: 'nomineeDetails.nominees[0].city', type: 'text', group: 'Nominee 1' },
  { name: 'Nominee 1 State', key: 'nomineeDetails.nominees[0].state', type: 'text', group: 'Nominee 1' },
  { name: 'Nominee 1 Pincode', key: 'nomineeDetails.nominees[0].pincode', type: 'text', group: 'Nominee 1' },
  { name: 'Nominee 1 Country', key: 'nomineeDetails.nominees[0].country', type: 'text', group: 'Nominee 1' },
  { name: 'Nominee 1 ID Proof', key: 'nomineeDetails.nominees[0].proofType', type: 'text', group: 'Nominee 1' },
  { name: 'Nominee 1 ID Number', key: 'nomineeDetails.nominees[0].proofNumber', type: 'text', group: 'Nominee 1' },
  { name: 'Nominee 1 Guardian Name', key: 'nomineeDetails.nominees[0].guardianName', type: 'text', group: 'Nominee Details' },
  { name: 'Nominee 1 Guardian Relation', key: 'nomineeDetails.nominees[0].guardianRelation', type: 'text', group: 'Nominee Details' },
  { name: 'Nominee 1 Guardian DOB', key: 'nomineeDetails.nominees[0].guardianDob', type: 'text', group: 'Nominee Details' },
  { name: 'Nominee 1 Guardian Mobile', key: 'nomineeDetails.nominees[0].guardianMobile', type: 'text', group: 'Nominee Details' },
  { name: 'Nominee 1 Guardian Email', key: 'nomineeDetails.nominees[0].guardianEmail', type: 'text', group: 'Nominee Details' },
  { name: 'Nominee 1 Guardian Address', key: 'nomineeDetails.nominees[0].guardianAddress', type: 'text', group: 'Nominee Details' },
  { name: 'Nominee 1 Guardian City', key: 'nomineeDetails.nominees[0].guardianCity', type: 'text', group: 'Nominee Details' },
  { name: 'Nominee 1 Guardian State', key: 'nomineeDetails.nominees[0].guardianState', type: 'text', group: 'Nominee Details' },
  { name: 'Nominee 1 Guardian Pincode', key: 'nomineeDetails.nominees[0].guardianPincode', type: 'text', group: 'Nominee Details' },
  { name: 'Nominee 1 Guardian Country', key: 'nomineeDetails.nominees[0].guardianCountry', type: 'text', group: 'Nominee Details' },
  { name: 'Nominee 1 Guardian Proof Type', key: 'nomineeDetails.nominees[0].guardianProofType', type: 'text', group: 'Nominee Details' },
  { name: 'Nominee 1 Guardian Proof Number', key: 'nomineeDetails.nominees[0].guardianProofNumber', type: 'text', group: 'Nominee Details' },
  { name: 'Opting Out of Nomination (Check)', key: 'isNomineeOptOut', type: 'checkbox', group: 'Nominee Details' },
  { name: 'Opting In of Nomination (Check)', key: 'isNomineeOptIn', type: 'checkbox', group: 'Nominee Details' },
  
  // Nominee 2
  { name: 'Nominee 2 Name', key: 'nomineeDetails.nominees[1].name', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Relation', key: 'nomineeDetails.nominees[1].relation', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Share %', key: 'nomineeAllocation.percentages[1]', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 DOB', key: 'nomineeDetails.nominees[1].dob', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Mobile', key: 'nomineeDetails.nominees[1].mobile', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Email', key: 'nomineeDetails.nominees[1].email', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Address', key: 'nomineeDetails.nominees[1].address', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 City', key: 'nomineeDetails.nominees[1].city', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 State', key: 'nomineeDetails.nominees[1].state', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Pincode', key: 'nomineeDetails.nominees[1].pincode', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Country', key: 'nomineeDetails.nominees[1].country', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 ID Proof', key: 'nomineeDetails.nominees[1].proofType', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 ID Number', key: 'nomineeDetails.nominees[1].proofNumber', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Guardian Name', key: 'nomineeDetails.nominees[1].guardianName', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Guardian Relation', key: 'nomineeDetails.nominees[1].guardianRelation', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Guardian DOB', key: 'nomineeDetails.nominees[1].guardianDob', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Guardian Mobile', key: 'nomineeDetails.nominees[1].guardianMobile', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Guardian Email', key: 'nomineeDetails.nominees[1].guardianEmail', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Guardian Address', key: 'nomineeDetails.nominees[1].guardianAddress', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Guardian City', key: 'nomineeDetails.nominees[1].guardianCity', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Guardian State', key: 'nomineeDetails.nominees[1].guardianState', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Guardian Pincode', key: 'nomineeDetails.nominees[1].guardianPincode', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Guardian Country', key: 'nomineeDetails.nominees[1].guardianCountry', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Guardian Proof Type', key: 'nomineeDetails.nominees[1].guardianProofType', type: 'text', group: 'Nominee 2' },
  { name: 'Nominee 2 Guardian Proof Number', key: 'nomineeDetails.nominees[1].guardianProofNumber', type: 'text', group: 'Nominee 2' },

  // Nominee 3
  { name: 'Nominee 3 Name', key: 'nomineeDetails.nominees[2].name', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Relation', key: 'nomineeDetails.nominees[2].relation', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Share %', key: 'nomineeAllocation.percentages[2]', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 DOB', key: 'nomineeDetails.nominees[2].dob', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Mobile', key: 'nomineeDetails.nominees[2].mobile', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Email', key: 'nomineeDetails.nominees[2].email', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Address', key: 'nomineeDetails.nominees[2].address', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 City', key: 'nomineeDetails.nominees[2].city', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 State', key: 'nomineeDetails.nominees[2].state', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Pincode', key: 'nomineeDetails.nominees[2].pincode', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Country', key: 'nomineeDetails.nominees[2].country', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 ID Proof', key: 'nomineeDetails.nominees[2].proofType', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 ID Number', key: 'nomineeDetails.nominees[2].proofNumber', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Guardian Name', key: 'nomineeDetails.nominees[2].guardianName', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Guardian Relation', key: 'nomineeDetails.nominees[2].guardianRelation', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Guardian DOB', key: 'nomineeDetails.nominees[2].guardianDob', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Guardian Mobile', key: 'nomineeDetails.nominees[2].guardianMobile', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Guardian Email', key: 'nomineeDetails.nominees[2].guardianEmail', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Guardian Address', key: 'nomineeDetails.nominees[2].guardianAddress', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Guardian City', key: 'nomineeDetails.nominees[2].guardianCity', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Guardian State', key: 'nomineeDetails.nominees[2].guardianState', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Guardian Pincode', key: 'nomineeDetails.nominees[2].guardianPincode', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Guardian Country', key: 'nomineeDetails.nominees[2].guardianCountry', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Guardian Proof Type', key: 'nomineeDetails.nominees[2].guardianProofType', type: 'text', group: 'Nominee 3' },
  { name: 'Nominee 3 Guardian Proof Number', key: 'nomineeDetails.nominees[2].guardianProofNumber', type: 'text', group: 'Nominee 3' },

  // Digital Audit Trail
  { name: 'Geo Latitude', key: 'geo.latitude', type: 'text', group: 'Audit Trail' },
  { name: 'Geo Longitude', key: 'geo.longitude', type: 'text', group: 'Audit Trail' },
  { name: 'Geo Address', key: 'geo.address', type: 'text', group: 'Audit Trail' },
  { name: 'Execution Timestamp', key: 'updatedAt', type: 'text', group: 'Audit Trail' },
  { name: 'Selfie Date', key: 'selfieDate', type: 'text', group: 'Audit Trail' },
  { name: 'Selfie IP', key: 'selfieIp', type: 'text', group: 'Audit Trail' },
  { name: 'IP Address', key: 'ipAddress', type: 'text', group: 'Audit Trail' },
  { name: 'Device Type', key: 'deviceType', type: 'text', group: 'Audit Trail' },
  { name: 'Risk Category', key: 'riskCategory', type: 'text', group: 'Audit Trail' },
  { name: 'Risk Score', key: 'riskScore', type: 'text', group: 'Audit Trail' },

  // Page 8 - Acceptable Documents
  { name: 'Check: PAN Card', key: 'isPanChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: Photograph', key: 'isPhotoChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: POI Aadhaar', key: 'isAadhaarPoiChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: POI Passport', key: 'isPoiPassportChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: POI Voter ID', key: 'isPoiVoterIdChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: POI Driving License', key: 'isPoiDrivingLicenseChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: POI Others', key: 'isPoiOthersChecked', type: 'checkbox', group: 'Documents' },
  
  { name: 'Check: POA Aadhaar', key: 'isPoaAadhaarChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: POA Passport', key: 'isPoaPassportChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: POA Voter ID', key: 'isPoaVoterIdChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: POA Driving License', key: 'isPoaDrivingLicenseChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: POA Banker Letter', key: 'isPoaBankerLetterChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: POA Electricity Bill', key: 'isPoaElectricityBillChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: POA Landline Bill', key: 'isPoaLandlineBillChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: POA Identity Card', key: 'isPoaIdentityCardChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: POA Registered Lease', key: 'isPoaLeaseChecked', type: 'checkbox', group: 'Documents' },
  
  { name: 'Check: Bank Penny Drop', key: 'isPennyDropChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: Bank Statement', key: 'isBankStatementChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: Bank Certificate', key: 'isBankerCertificateChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: Cancelled Cheque', key: 'isCancelledChequeChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: Income ITR', key: 'isIncomeItrChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: Income Salary', key: 'isIncomeSalaryChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: Income Networth', key: 'isIncomeNetworthChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: Income Demat', key: 'isIncomeDematChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: Income Bank', key: 'isIncomeBankChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: Income Annual', key: 'isIncomeAnnualChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: Income Self Dec', key: 'isIncomeSelfDecChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: Income Others', key: 'isIncomeOthersChecked', type: 'checkbox', group: 'Documents' },
  { name: 'Check: NRI Client', key: 'isNriClientChecked', type: 'checkbox', group: 'Documents' },

  // Media & Proofs
  { name: 'Selfie Image', key: 'selfie', type: 'image', group: 'Images/Signatures' },
  { name: 'Signature (Always)', key: 'signature', type: 'image', group: 'Images/Signatures' },
  { name: 'Signature (Opt-Out Only)', key: 'signatureOptOut', type: 'image', group: 'Images/Signatures' },
  { name: 'Signature (Opt-In Only)', key: 'signatureOptIn', type: 'image', group: 'Images/Signatures' },
  { name: 'Signature (Nominee 2 Filled)', key: 'signatureNominee2', type: 'image', group: 'Images/Signatures' },
  { name: 'Signature (Nominee 3 Filled)', key: 'signatureNominee3', type: 'image', group: 'Images/Signatures' },
  { name: 'E-Sign Image (Always)', key: 'esign', type: 'image', group: 'Images/Signatures' },
  { name: 'E-Sign (Opt-Out Only)', key: 'esignOptOut', type: 'image', group: 'Images/Signatures' },
  { name: 'E-Sign (Opt-In Only)', key: 'esignOptIn', type: 'image', group: 'Images/Signatures' },
  { name: 'E-Sign (Nominee 2 Filled)', key: 'esignNominee2', type: 'image', group: 'Images/Signatures' },
  { name: 'E-Sign (Nominee 3 Filled)', key: 'esignNominee3', type: 'image', group: 'Images/Signatures' },
  { name: 'PAN Image', key: 'panImage', type: 'image', group: 'Images/Signatures' },
  { name: 'PAN Document', key: 'panDocument', type: 'image', group: 'Media' },
  { name: 'Aadhaar Image', key: 'aadhaarImage', type: 'image', group: 'Media' },
  { name: 'Bank Proof', key: 'bankProof', type: 'image', group: 'Media' },
  { name: 'Income Proof', key: 'incomeProof', type: 'image', group: 'Media' },
  { name: 'Address Proof', key: 'addressProof', type: 'image', group: 'Media' },
  { name: 'PEP Proof', key: 'pepProof', type: 'image', group: 'Media' },
  { name: 'Nominee 1 Proof Image', key: 'nominee1Proof', type: 'image', group: 'Media' },
  { name: 'Nominee 2 Proof Image', key: 'nominee2Proof', type: 'image', group: 'Media' },
  { name: 'Nominee 3 Proof Image', key: 'nominee3Proof', type: 'image', group: 'Media' },
  { name: 'Guardian 1 Proof Image', key: 'guardian1Proof', type: 'image', group: 'Media' },
  { name: 'Guardian 2 Proof Image', key: 'guardian2Proof', type: 'image', group: 'Media' },
  { name: 'Guardian 3 Proof Image', key: 'guardian3Proof', type: 'image', group: 'Media' },
];

// ─── Main Component ──────────────────────────────────────────────────
export default function PdfBuilder() {
  // Core state
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [fields, setFields] = useState([]);
  const [pages, setPages] = useState([]);
  const [basePdfUrl, setBasePdfUrl] = useState('/official_form.pdf');
  const [scale, setScale] = useState(1.0);
  const [canvasNaturalSize, setCanvasNaturalSize] = useState({ width: 0, height: 0 });

  // UI state
  const [loading, setLoading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [replacingPage, setReplacingPage] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [customVars, setCustomVars] = useState([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customForm, setCustomForm] = useState({ name: '', key: '', type: 'text' });
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // {x, y, fieldId}
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error' | 'unsaved'
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [showDimTooltip, setShowDimTooltip] = useState(null); // {id, w, h}

  // Undo/Redo
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Refs
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const containerRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  // All available variables (base + custom)
  const availableVariables = useMemo(() => [...BASE_VARIABLES, ...customVars], [customVars]);

  // Grouped variables for sidebar
  const groupedVariables = useMemo(() => {
    const groups = {};
    const filtered = availableVariables.filter(v =>
      !searchQuery || v.name.toLowerCase().includes(searchQuery.toLowerCase()) || v.key.toLowerCase().includes(searchQuery.toLowerCase())
    );
    filtered.forEach(v => {
      const g = v.group || 'Custom';
      if (!groups[g]) groups[g] = [];
      groups[g].push(v);
    });
    return groups;
  }, [availableVariables, searchQuery]);

  // Placed variable keys on current page
  const placedKeys = useMemo(() => {
    return new Set(fields.filter(f => f.page === pageNum).map(f => f.variable));
  }, [fields, pageNum]);

  // Selected field object
  const selectedField = useMemo(() => fields.find(f => f.id === selectedFieldId), [fields, selectedFieldId]);

  // ─── Auto-save logic ──────────────────────────────────────────────
  const triggerAutoSave = useCallback(() => {
    setSaveStatus('unsaved');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      performSave(false);
    }, 800);
  }, []);

  const performSave = async (compilePdf = false, overridePages = null, overrideBaseUrl = null) => {
    console.log(`[performSave] compilePdf=${compilePdf}`);
    const currentFields = fieldsRef.current;
    setSaveStatus('saving');
    setLoading(compilePdf);
    try {
      let currentPages = overridePages || pages;
      const currentBase = overrideBaseUrl || basePdfUrl;

      // If compiling but pages array is empty, reconstruct from the loaded PDF document
      if (compilePdf && (!currentPages || currentPages.length === 0) && pdfDoc) {
        currentPages = Array.from({ length: pdfDoc.numPages }, (_, i) => ({ type: 'pdf', pageNumberInSource: i + 1 }));
        console.log(`[Compile] Reconstructed ${currentPages.length} pages from loaded PDF`);
      }

      console.log(`[performSave] Sending ${currentPages?.length || 0} pages to backend...`);
      const res = await fetch(`${API_BASE_URL}/api/admin/pdf-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          name: 'Default Template',
          isActive: true,
          basePdfUrl: currentBase ? (currentBase.startsWith(API_BASE_URL) ? currentBase.replace(API_BASE_URL, '') : currentBase) : null,
          fields: currentFields,
          pages: currentPages,
          compilePdf
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSaveStatus('saved');
        if (compilePdf && data.template && data.template.basePdfUrl) {
          if (data.template.basePdfUrl.startsWith('/uploads/')) {
            setBasePdfUrl(`${API_BASE_URL}${data.template.basePdfUrl}`);
          } else {
            setBasePdfUrl(data.template.basePdfUrl.startsWith('http') ? data.template.basePdfUrl : data.template.basePdfUrl);
          }
          setPages([]);
          window.alert("Compilation Successful! The base PDF has been successfully merged and finalized.");
        }
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
      if (compilePdf) {
        window.alert(`Compile failed: ${err.message}. See console for details.`);
      }
    }
    setLoading(false);
  };

  // ─── Undo / Redo ──────────────────────────────────────────────────
  const pushUndo = useCallback((prevFields) => {
    setUndoStack(prev => [...prev.slice(-30), JSON.parse(JSON.stringify(prevFields))]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, JSON.parse(JSON.stringify(fieldsRef.current))]);
    setUndoStack(u => u.slice(0, -1));
    setFields(prev);
    triggerAutoSave();
  }, [undoStack, triggerAutoSave]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, JSON.parse(JSON.stringify(fieldsRef.current))]);
    setRedoStack(r => r.slice(0, -1));
    setFields(next);
    triggerAutoSave();
  }, [redoStack, triggerAutoSave]);

  // ─── Init: Load pdfjs + saved template ────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version || '5.7.284'}/build/pdf.worker.min.mjs`;

        const res = await fetch(`${API_BASE_URL}/api/admin/pdf-templates/active`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.fields) {
            const parsedFields = JSON.parse(data.fields);
            if (Array.isArray(parsedFields)) {
              setFields(parsedFields);
            } else {
              setFields(parsedFields.variables || []);
              if (parsedFields.pages && parsedFields.pages.length > 0) {
                setPages(parsedFields.pages);
              }
            }
            if (data.basePdfUrl && data.basePdfUrl.startsWith('/uploads/')) {
              setBasePdfUrl(`${API_BASE_URL}${data.basePdfUrl}`);
            } else if (data.basePdfUrl) {
              // Handle non-upload URLs (e.g. /official_form.pdf) - keep as relative path
              // so it loads from the frontend Next.js server (public directory)
              setBasePdfUrl(data.basePdfUrl.startsWith('http') ? data.basePdfUrl : data.basePdfUrl);
            }
          }
        }
      } catch (err) {
        console.error("Error initializing PDF Builder:", err);
      }
    };
    init();
  }, []);

  // ─── Load PDF document ────────────────────────────────────────────
  useEffect(() => {
    const loadPdf = async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const loadingTask = pdfjs.getDocument(basePdfUrl);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setPageNum(1);
        setPages(prev => {
          if (prev.length > 0) return prev;
          return Array.from({ length: pdf.numPages }, (_, i) => ({ type: 'pdf', pageNumberInSource: i + 1 }));
        });
      } catch (err) {
        console.error("Error loading PDF:", err);
      }
    };
    if (basePdfUrl) loadPdf();
  }, [basePdfUrl]);

  // ─── Render current page ──────────────────────────────────────────
  useEffect(() => {
    if (pages[pageNum - 1]?.type === 'html') {
      setCanvasNaturalSize({ width: 595.28, height: 841.89 });
    } else if (pdfDoc && canvasRef.current) {
      renderPage(pageNum);
    }
  }, [pdfDoc, pageNum, scale, pages]);

  const renderPage = async (num) => {
    try {
      const pageInfo = pages[num - 1];
      if (pageInfo?.type !== 'pdf') return;
      const sourcePageNum = pageInfo.pageNumberInSource || num;
      const page = await pdfDoc.getPage(sourcePageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const naturalViewport = page.getViewport({ scale: 1 });
      setCanvasNaturalSize({ width: naturalViewport.width, height: naturalViewport.height });

      if (renderTaskRef.current) renderTaskRef.current.cancel();
      renderTaskRef.current = page.render({ canvasContext: context, viewport });
      await renderTaskRef.current.promise;
      renderTaskRef.current = null;
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') console.error("Render Error:", err);
    }
  };

  // ─── Field operations ─────────────────────────────────────────────
  const addVariable = useCallback((variable) => {
    pushUndo(fieldsRef.current);
    const newField = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      variable: variable.key,
      type: variable.type || 'text',
      matchValue: variable.matchValue || '',
      page: pageNum,
      x: 100,
      y: 100,
      width: variable.type === 'image' ? 120 : (variable.type === 'checkbox' ? 20 : 150),
      height: variable.type === 'image' ? 60 : (variable.type === 'checkbox' ? 20 : 24),
      fontSize: variable.type === 'checkbox' ? 16 : 10
    };
    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newField.id);
    triggerAutoSave();
  }, [pageNum, pushUndo, triggerAutoSave]);

  const updateField = useCallback((id, changes) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...changes } : f));
    triggerAutoSave();
  }, [triggerAutoSave]);

  const updateFieldWithUndo = useCallback((id, changes) => {
    pushUndo(fieldsRef.current);
    updateField(id, changes);
  }, [pushUndo, updateField]);

  const removeField = useCallback((id) => {
    pushUndo(fieldsRef.current);
    setFields(prev => prev.filter(f => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
    triggerAutoSave();
  }, [selectedFieldId, pushUndo, triggerAutoSave]);

  const duplicateField = useCallback((fieldToCopy) => {
    pushUndo(fieldsRef.current);
    const newField = {
      ...fieldToCopy,
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      x: fieldToCopy.x + 15,
      y: fieldToCopy.y + 15
    };
    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newField.id);
    triggerAutoSave();
  }, [pushUndo, triggerAutoSave]);

  // ─── Align Fields to Reference Line ─────────────────────────────
  const [referenceFieldId, setReferenceFieldId] = useState(null);
  const [alignSelectedIds, setAlignSelectedIds] = useState(new Set());

  // Clear reference when page changes or reference field is deleted
  useEffect(() => {
    if (referenceFieldId) {
      const refField = fields.find(f => f.id === referenceFieldId);
      if (!refField || refField.page !== pageNum) {
        setReferenceFieldId(null);
        setAlignSelectedIds(new Set());
      }
    }
  }, [pageNum, fields, referenceFieldId]);

  const handleSetReference = useCallback((fieldId) => {
    setReferenceFieldId(fieldId);
    setAlignSelectedIds(new Set());
  }, []);

  const handleClearReference = useCallback(() => {
    setReferenceFieldId(null);
    setAlignSelectedIds(new Set());
  }, []);

  const handleToggleAlignField = useCallback((fieldId) => {
    setAlignSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  }, []);

  const handleSelectAllForAlign = useCallback(() => {
    const pageFields = fields.filter(f => f.page === pageNum && f.id !== referenceFieldId);
    const allSelected = pageFields.every(f => alignSelectedIds.has(f.id));
    if (allSelected) {
      setAlignSelectedIds(new Set());
    } else {
      setAlignSelectedIds(new Set(pageFields.map(f => f.id)));
    }
  }, [fields, pageNum, referenceFieldId, alignSelectedIds]);

  const handleAlignToReference = useCallback(() => {
    if (!referenceFieldId || alignSelectedIds.size === 0) return;
    const refField = fieldsRef.current.find(f => f.id === referenceFieldId);
    if (!refField) return;
    pushUndo(fieldsRef.current);

    // Move all selected fields to the same X-position (same vertical column) as the reference field
    setFields(prev => prev.map(f => {
      if (!alignSelectedIds.has(f.id)) return f;
      return { ...f, x: refField.x };
    }));
    triggerAutoSave();
    // Clear selections after aligning
    setAlignSelectedIds(new Set());
    setReferenceFieldId(null);
  }, [referenceFieldId, alignSelectedIds, pushUndo, triggerAutoSave]);

  // Reference field object
  const referenceField = useMemo(() => fields.find(f => f.id === referenceFieldId), [fields, referenceFieldId]);

  // ─── Normalize Font Size for All Fields (user-specified size) ─────
  const [normalizeFontSize, setNormalizeFontSize] = useState(10);
  const handleNormalizeStyle = useCallback((fontSize, applyToAll = true) => {
    if (fieldsRef.current.length === 0) return;
    const size = parseFloat(fontSize);
    if (!size || size < 1) return;
    pushUndo(fieldsRef.current);

    // Apply the user-specified font size to text variables (all pages or current page)
    setFields(prev => prev.map(f => {
      if (f.type !== 'text') return f;
      if (!applyToAll && f.page !== pageNum) return f;
      // Adjust height if it's too small for the new font size (adding some padding)
      const newHeight = Math.max(f.height || 24, size + 6);
      return { ...f, fontSize: size, height: newHeight };
    }));
    triggerAutoSave();
  }, [pushUndo, triggerAutoSave, pageNum]);

  // ─── Custom Variable ──────────────────────────────────────────────
  const handleAddCustomVar = () => {
    if (!customForm.name || !customForm.key) return;
    setCustomVars(prev => [...prev, { ...customForm, group: 'Custom' }]);
    setCustomForm({ name: '', key: '', type: 'text' });
    setShowCustomForm(false);
  };

  // ─── PDF Upload ───────────────────────────────────────────────────
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPdf(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      if (file.type === 'application/pdf') {
        const res = await fetch(`${API_BASE_URL}/api/admin/pdf-templates/upload-base`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          setBasePdfUrl(`${API_BASE_URL}${data.url}`);
          setFields([]);
          setPages([]);
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/api/admin/pdf-templates/convert-to-html`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          setBasePdfUrl(null);
          setPdfDoc(null);
          setPageNum(1);
          setPages([{ type: 'html', content: data.html }]);
          setFields([]);
        }
      }
    } catch (err) { console.error("Upload error", err); }
    setUploadingPdf(false);
  };

  // ─── Replace Page ─────────────────────────────────────────────────
  const handleReplacePage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setReplacingPage(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      if (file.type === 'application/pdf') {
        formData.append('basePdfUrl', basePdfUrl || '');
        formData.append('pageIndex', pageNum - 1);
        const res = await fetch(`${API_BASE_URL}/api/admin/pdf-templates/replace-page`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          const newBase = `${API_BASE_URL}${data.url}`;
          setBasePdfUrl(newBase);
          performSave(false, pages, newBase);
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/api/admin/pdf-templates/convert-to-html`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          const newPages = [...pages];
          newPages[pageNum - 1] = { type: 'html', content: data.html };
          setPages(newPages);
          performSave(false, newPages, basePdfUrl);
        }
      }
    } catch (err) { console.error("Replace error", err); }
    setReplacingPage(false);
  };

  // ─── PDF Analysis ─────────────────────────────────────────────────
  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisResults(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/pdf-templates/analyze-page`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          basePdfUrl: basePdfUrl ? (basePdfUrl.startsWith(API_BASE_URL) ? basePdfUrl.replace(API_BASE_URL, '') : basePdfUrl) : null,
          pageNumber: pages[pageNum - 1]?.pageNumberInSource || pageNum
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysisResults(data.suggestions || []);
      } else {
        setAnalysisResults([]);
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setAnalysisResults([]);
    }
    setAnalyzing(false);
  };

  const acceptSuggestion = (suggestion) => {
    pushUndo(fieldsRef.current);
    const newField = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      variable: suggestion.variable,
      type: suggestion.type || 'text',
      matchValue: '',
      page: pageNum,
      x: suggestion.x,
      y: suggestion.y,
      width: suggestion.width || 150,
      height: suggestion.height || 24,
      fontSize: suggestion.fontSize || 10
    };
    setFields(prev => [...prev, newField]);
    setAnalysisResults(prev => prev.filter(s => s.variable !== suggestion.variable));
    triggerAutoSave();
  };

  // ─── Keyboard shortcuts ───────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedFieldId) {
          e.preventDefault();
          removeField(selectedFieldId);
        }
      } else if (e.key === 'Escape') {
        setSelectedFieldId(null);
        setContextMenu(null);
        setAnalysisResults(null);
      } else if (selectedFieldId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        const delta = { ArrowUp: { y: -step }, ArrowDown: { y: step }, ArrowLeft: { x: -step }, ArrowRight: { x: step } };
        const d = delta[e.key];
        const f = fieldsRef.current.find(f => f.id === selectedFieldId);
        if (f) {
          if (!e._undoPushed) { pushUndo(fieldsRef.current); e._undoPushed = true; }
          updateField(selectedFieldId, {
            x: Math.max(0, f.x + (d.x || 0)),
            y: Math.max(0, f.y + (d.y || 0))
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFieldId, handleUndo, handleRedo, removeField, pushUndo, updateField]);

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  // ─── Computed display values ──────────────────────────────────────
  const scaleFactor = canvasNaturalSize.width > 0 ? (canvasNaturalSize.width * scale) / canvasNaturalSize.width : 1;
  const displayW = canvasNaturalSize.width * scale;
  const displayH = canvasNaturalSize.height * scale;

  // ─── RENDER ───────────────────────────────────────────────────────
  return (
    <div className="pdfb">
      {/* ══════════════ LEFT PANEL: Variable Palette ══════════════ */}
      <div className={`pdfb-left${leftCollapsed ? ' collapsed' : ''}`}>
        <div className="pdfb-left-header">
          <h3>Variables</h3>
          <p>Click or drag to place on page</p>
        </div>

        <div style={{ position: 'relative', margin: '12px 20px 0' }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            className="pdfb-search"
            placeholder="Search variables..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32, margin: 0, width: '100%' }}
          />
        </div>

        <div className="pdfb-var-list">
          {Object.entries(groupedVariables).map(([group, vars]) => (
            <div key={group}>
              <div className="pdfb-var-group-title">{group}</div>
              {vars.map(v => (
                <button
                  key={v.key}
                  className="pdfb-var-item"
                  onClick={() => addVariable(v)}
                  title={`Click to add {{${v.key}}} to page ${pageNum}`}
                >
                  <div className={`pdfb-var-icon ${v.type}`}>
                    {v.type === 'image' ? Icons.image : v.type === 'checkbox' ? Icons.check : Icons.text}
                  </div>
                  <span className="pdfb-var-label">{v.name}</span>
                  {placedKeys.has(v.key) && <span className="pdfb-placed-indicator" title="Placed on this page"/>}
                </button>
              ))}
            </div>
          ))}

          {/* Custom Variable */}
          <div style={{ marginTop: 8, borderTop: '1px dashed var(--border-color)', paddingTop: 12 }}>
            {!showCustomForm ? (
              <button
                className="pdfb-var-item"
                onClick={() => setShowCustomForm(true)}
                style={{ justifyContent: 'center', color: 'var(--text-muted)', border: '1.5px dashed var(--border-color)' }}
              >
                + Add Custom Variable
              </button>
            ) : (
              <div className="pdfb-custom-form">
                <input placeholder="Label (e.g. Nominee)" value={customForm.name} onChange={e => setCustomForm({...customForm, name: e.target.value})}/>
                <input placeholder="Data Key (e.g. nomineeName)" value={customForm.key} onChange={e => setCustomForm({...customForm, key: e.target.value})}/>
                <select value={customForm.type} onChange={e => setCustomForm({...customForm, type: e.target.value})}>
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="checkbox">Checkbox</option>
                </select>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button className="pdfb-tbtn primary" style={{ flex: 1, fontSize: '0.72rem' }} onClick={handleAddCustomVar}>Add</button>
                  <button className="pdfb-tbtn" style={{ flex: 1, fontSize: '0.72rem', border: '1px solid var(--border-color)' }} onClick={() => setShowCustomForm(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════ CENTER: Toolbar + Canvas ══════════════ */}
      <div className="pdfb-center">
        {/* Toolbar */}
        <div className="pdfb-toolbar">
          <div className="pdfb-toolbar-group">
            {/* Panel toggles */}
            <button className={`pdfb-tbtn${!leftCollapsed ? ' active' : ''}`} onClick={() => setLeftCollapsed(!leftCollapsed)} title="Toggle variables panel">
              {Icons.panelLeft}
            </button>
            <div className="pdfb-toolbar-divider"/>

            {/* Upload / Replace */}
            <label className="pdfb-tbtn" title="Upload Base PDF" style={{ cursor: 'pointer' }}>
              {Icons.upload} <span>{uploadingPdf ? 'Uploading...' : 'Upload'}</span>
              <input type="file" accept=".pdf,.doc,.docx,.html" style={{ display: 'none' }} onChange={handlePdfUpload} disabled={uploadingPdf}/>
            </label>
            <label className="pdfb-tbtn" title="Replace current page" style={{ cursor: 'pointer' }}>
              {Icons.replace} <span>{replacingPage ? 'Replacing...' : 'Replace'}</span>
              <input type="file" accept=".pdf,.doc,.docx,.html" style={{ display: 'none' }} onChange={handleReplacePage} disabled={replacingPage || pages.length === 0}/>
            </label>

            <div className="pdfb-toolbar-divider"/>

            {/* Page Navigation */}
            <button className="pdfb-tbtn" onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1} title="Previous page">
              {Icons.chevLeft}
            </button>
            <span className="pdfb-page-indicator">
              {pageNum} / {pages.length || '—'}
            </span>
            <button className="pdfb-tbtn" onClick={() => setPageNum(p => Math.min(pages.length, p + 1))} disabled={pageNum >= pages.length} title="Next page">
              {Icons.chevRight}
            </button>

            <div className="pdfb-toolbar-divider"/>

            {/* Page operations */}
            <button className="pdfb-tbtn" title="Add page after current" onClick={() => {
              const newPages = [...pages];
              newPages.splice(pageNum, 0, { type: 'html', content: '<div style="font-family: Arial; padding: 20px;">New Blank Page</div>' });
              setPages(newPages);
              setPageNum(p => p + 1);
              performSave(false, newPages, basePdfUrl);
            }}>
              {Icons.addPage}
            </button>
            <button className="pdfb-tbtn danger" title="Delete current page" disabled={pages.length <= 1} onClick={() => {
              if (window.confirm('Delete this page?')) {
                const newPages = pages.filter((_, i) => i !== pageNum - 1);
                setPages(newPages);
                setPageNum(p => Math.max(1, p - 1));
                performSave(false, newPages, basePdfUrl);
              }
            }}>
              {Icons.deletePage}
            </button>

            <div className="pdfb-toolbar-divider"/>

            {/* Undo / Redo */}
            <button className="pdfb-tbtn" onClick={handleUndo} disabled={undoStack.length === 0} title="Undo (Ctrl+Z)">
              {Icons.undo}
            </button>
            <button className="pdfb-tbtn" onClick={handleRedo} disabled={redoStack.length === 0} title="Redo (Ctrl+Y)">
              {Icons.redo}
            </button>
          </div>

          <div className="pdfb-toolbar-group">
            {/* Auto-save status */}
            <div className={`pdfb-save-status ${saveStatus}`}>
              <span className="pdfb-save-dot"/>
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Error' : 'Unsaved'}
            </div>

            <div className="pdfb-toolbar-divider"/>

            {/* Analyze */}
            <button className="pdfb-tbtn" onClick={handleAnalyze} disabled={analyzing || !basePdfUrl} title="AI Analyze PDF">
              {Icons.analyze} <span>{analyzing ? 'Analyzing...' : 'Analyze'}</span>
            </button>

            <div className="pdfb-toolbar-divider"/>

            {/* Zoom */}
            <button className="pdfb-tbtn" onClick={() => setScale(s => Math.max(0.4, +(s - 0.15).toFixed(2)))} title="Zoom out">{Icons.zoomOut}</button>
            <span className="pdfb-zoom-value">{(scale * 100).toFixed(0)}%</span>
            <button className="pdfb-tbtn" onClick={() => setScale(s => Math.min(2.5, +(s + 0.15).toFixed(2)))} title="Zoom in">{Icons.zoomIn}</button>

            <div className="pdfb-toolbar-divider"/>

            {/* Compile */}
            <button className="pdfb-tbtn primary" onClick={() => performSave(true)} disabled={loading} title="Compile & finalize PDF">
              {Icons.compile} <span>{loading ? 'Compiling...' : 'Compile PDF'}</span>
            </button>

            <div className="pdfb-toolbar-divider"/>
            <button className={`pdfb-tbtn${!rightCollapsed ? ' active' : ''}`} onClick={() => setRightCollapsed(!rightCollapsed)} title="Toggle properties panel">
              {Icons.panelRight}
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div
          className="pdfb-canvas-wrapper"
          onClick={(e) => {
            if (e.target === e.currentTarget || e.target.closest('.pdfb-canvas-container') === containerRef.current) {
              if (!e.target.closest('.pdfb-field')) setSelectedFieldId(null);
            }
          }}
        >
          {/* Analysis Panel Overlay */}
          {analysisResults !== null && (
            <div className="pdfb-analysis-panel" style={{ position: 'fixed', top: 'auto', right: 16, bottom: 16, maxHeight: 400, borderRadius: 16, border: '1px solid var(--border-color)' }}>
              <div className="pdfb-analysis-header">
                <h4>📊 Suggested Variables ({analysisResults.length})</h4>
                <button className="pdfb-tbtn danger" onClick={() => setAnalysisResults(null)} style={{ padding: '4px 8px' }}>✕</button>
              </div>
              <div className="pdfb-analysis-list">
                {analysisResults.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: 20 }}>No suggestions found for this page.</p>
                ) : (
                  analysisResults.map((s, i) => (
                    <div key={i} className="pdfb-analysis-item" style={{ cursor: 'pointer' }} onClick={() => acceptSuggestion(s)}>
                      <div className={`pdfb-var-icon ${s.type || 'text'}`} style={{ width: 24, height: 24, borderRadius: 6 }}>
                        {(s.type === 'image') ? Icons.image : Icons.text}
                      </div>
                      <span className="label">{s.name || s.variable}</span>
                      <span className="confidence">{s.confidence ? `${(s.confidence * 100).toFixed(0)}%` : ''}</span>
                      <button className="pdfb-tbtn primary" style={{ padding: '3px 8px', fontSize: '0.65rem' }} onClick={(e) => { e.stopPropagation(); acceptSuggestion(s); }}>
                        Place
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div
            ref={containerRef}
            className="pdfb-canvas-container"
            style={{ width: displayW || 'auto', height: displayH || 'auto' }}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          >
            {pages[pageNum - 1]?.type === 'html' ? (
              <div
                contentEditable={true}
                suppressContentEditableWarning={true}
                onBlur={(e) => {
                  const newContent = e.currentTarget.innerHTML;
                  setPages(prev => {
                    const newPages = [...prev];
                    newPages[pageNum - 1] = { ...newPages[pageNum - 1], content: newContent };
                    return newPages;
                  });
                  triggerAutoSave();
                }}
                dangerouslySetInnerHTML={{ __html: pages[pageNum - 1].content }}
                style={{
                  width: 794,
                  minHeight: 1123,
                  boxSizing: 'border-box',
                  outline: 'none',
                  transform: `scale(${scale * (595.28 / 794)})`,
                  transformOrigin: 'top left',
                  background: 'white'
                }}
              />
            ) : (
              <canvas ref={canvasRef} style={{ display: 'block' }}/>
            )}

            {/* Render Fields */}
            {canvasNaturalSize.width > 0 && fields.filter(f => f.page === pageNum).map(f => (
              <FieldOverlay
                key={f.id}
                field={f}
                scale={scale}
                isSelected={selectedFieldId === f.id}
                onSelect={() => setSelectedFieldId(f.id)}
                onUpdate={updateField}
                onUpdateWithUndo={updateFieldWithUndo}
                onRemove={removeField}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({ x: e.clientX, y: e.clientY, fieldId: f.id });
                  setSelectedFieldId(f.id);
                }}
                onResizeStart={() => setShowDimTooltip({ id: f.id, w: f.width, h: f.height })}
                onResize={(w, h) => setShowDimTooltip({ id: f.id, w, h })}
                onResizeEnd={() => setShowDimTooltip(null)}
                showDimTooltip={showDimTooltip?.id === f.id ? showDimTooltip : null}
                canvasNaturalSize={canvasNaturalSize}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════ RIGHT PANEL: Property Inspector ══════════════ */}
      <div className={`pdfb-right${rightCollapsed ? ' collapsed' : ''}`}>
        <div className="pdfb-right-header">
          <h4>Properties</h4>
        </div>

        {/* ── Page-level Actions (always visible) ── */}
        <div className="pdfb-page-actions">
          <p className="pdfb-prop-section" style={{ borderTop: 'none', paddingTop: 0, margin: '0 0 8px 0' }}>Page Actions</p>

          {/* ── Align to Reference ── */}
          {!referenceFieldId ? (
            <div className="pdfb-align-hint">
              {Icons.alignLine}
              <span>{selectedField ? 'Set selected variable as reference to align others' : 'Select a variable first, then set it as reference'}</span>
              {selectedField && (
                <button
                  className="pdfb-tbtn primary"
                  onClick={() => handleSetReference(selectedFieldId)}
                  style={{ padding: '4px 10px', fontSize: '0.68rem', borderRadius: 6, marginLeft: 'auto', flexShrink: 0 }}
                >
                  Set Reference
                </button>
              )}
            </div>
          ) : (
            <div className="pdfb-align-section">
              <div className="pdfb-align-ref-badge">
                <span className="pdfb-align-ref-label">Reference:</span>
                <span className="pdfb-align-ref-name">{`{{${referenceField?.variable || '?'}}}`}</span>
                <button className="pdfb-align-ref-clear" onClick={handleClearReference} title="Clear reference">✕</button>
              </div>

              <div className="pdfb-align-pick-header">
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>Select variables to align:</span>
                <button
                  className="pdfb-tbtn"
                  onClick={handleSelectAllForAlign}
                  style={{ padding: '2px 6px', fontSize: '0.62rem' }}
                >
                  {fields.filter(f => f.page === pageNum && f.id !== referenceFieldId).every(f => alignSelectedIds.has(f.id)) ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="pdfb-align-pick-list">
                {fields.filter(f => f.page === pageNum && f.id !== referenceFieldId).map(f => (
                  <label key={f.id} className={`pdfb-align-pick-item${alignSelectedIds.has(f.id) ? ' checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={alignSelectedIds.has(f.id)}
                      onChange={() => handleToggleAlignField(f.id)}
                    />
                    <span className={`pdfb-var-icon ${f.type}`} style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0 }}>
                      {f.type === 'image' ? Icons.image : f.type === 'checkbox' ? Icons.check : Icons.text}
                    </span>
                    <span className="pdfb-align-pick-label">{f.type === 'checkbox' ? `✓ ${f.matchValue || f.variable}` : `{{${f.variable}}}`}</span>
                  </label>
                ))}
              </div>

              <button
                className="pdfb-tbtn primary pdfb-page-action-btn"
                onClick={handleAlignToReference}
                disabled={alignSelectedIds.size === 0}
                style={{ marginTop: 6 }}
              >
                {Icons.alignLine}
                <span>Align to Reference ({alignSelectedIds.size})</span>
              </button>
            </div>
          )}

          {/* ── Normalize Font Size ── */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10, marginTop: 6 }}>
            <div className="pdfb-normalize-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <div className="pdfb-normalize-input-group">
                {Icons.normalizeFont}
                <input
                  className="pdfb-prop-input"
                  type="number"
                  min="1"
                  max="72"
                  step="0.5"
                  value={normalizeFontSize}
                  onChange={e => setNormalizeFontSize(e.target.value)}
                  placeholder="Size"
                  style={{ flex: 1, fontSize: '0.72rem' }}
                />
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>pt</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="pdfb-tbtn primary"
                  onClick={() => handleNormalizeStyle(normalizeFontSize, false)}
                  disabled={fields.length === 0}
                  title="Apply to current page only"
                  style={{ flex: 1, padding: '6px', fontSize: '0.65rem', borderRadius: 6, justifyContent: 'center' }}
                >
                  This Page
                </button>
                <button
                  className="pdfb-tbtn primary"
                  onClick={() => handleNormalizeStyle(normalizeFontSize, true)}
                  disabled={fields.length === 0}
                  title="Apply to all pages"
                  style={{ flex: 1, padding: '6px', fontSize: '0.65rem', borderRadius: 6, justifyContent: 'center', backgroundColor: 'var(--text-color)', color: 'var(--bg-color)' }}
                >
                  All Pages
                </button>
              </div>
            </div>
          </div>
        </div>

        {selectedField ? (
          <div className="pdfb-props">
            <p className="pdfb-prop-section" style={{ borderTop: 'none', paddingTop: 0 }}>Variable</p>
            <div className="pdfb-prop-row">
              <span className="pdfb-prop-label">Key</span>
              <input className="pdfb-prop-input" value={selectedField.variable} onChange={e => updateFieldWithUndo(selectedField.id, { variable: e.target.value })}/>
            </div>
            <div className="pdfb-prop-row">
              <span className="pdfb-prop-label">Type</span>
              <select className="pdfb-prop-input" style={{ fontFamily: 'var(--font-sans)' }} value={selectedField.type} onChange={e => updateFieldWithUndo(selectedField.id, { type: e.target.value })}>
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="checkbox">Checkbox</option>
              </select>
            </div>
            {selectedField.type === 'checkbox' && (
              <div className="pdfb-prop-row">
                <span className="pdfb-prop-label">Match</span>
                <input className="pdfb-prop-input" value={selectedField.matchValue || ''} onChange={e => updateFieldWithUndo(selectedField.id, { matchValue: e.target.value })} placeholder="Value to match"/>
              </div>
            )}

            <p className="pdfb-prop-section">Position</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="pdfb-prop-row" style={{ margin: 0 }}>
                <span className="pdfb-prop-label" style={{ width: 16 }}>X</span>
                <input className="pdfb-prop-input" type="number" step="1" value={Math.round(selectedField.x)} onChange={e => updateFieldWithUndo(selectedField.id, { x: parseFloat(e.target.value) || 0 })}/>
              </div>
              <div className="pdfb-prop-row" style={{ margin: 0 }}>
                <span className="pdfb-prop-label" style={{ width: 16 }}>Y</span>
                <input className="pdfb-prop-input" type="number" step="1" value={Math.round(selectedField.y)} onChange={e => updateFieldWithUndo(selectedField.id, { y: parseFloat(e.target.value) || 0 })}/>
              </div>
            </div>

            <p className="pdfb-prop-section">Size</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="pdfb-prop-row" style={{ margin: 0 }}>
                <span className="pdfb-prop-label" style={{ width: 16 }}>W</span>
                <input className="pdfb-prop-input" type="number" step="1" value={Math.round(selectedField.width)} onChange={e => updateFieldWithUndo(selectedField.id, { width: parseFloat(e.target.value) || 10 })}/>
              </div>
              <div className="pdfb-prop-row" style={{ margin: 0 }}>
                <span className="pdfb-prop-label" style={{ width: 16 }}>H</span>
                <input className="pdfb-prop-input" type="number" step="1" value={Math.round(selectedField.height)} onChange={e => updateFieldWithUndo(selectedField.id, { height: parseFloat(e.target.value) || 10 })}/>
              </div>
            </div>

            {selectedField.type === 'text' && (
              <>
                <p className="pdfb-prop-section">Typography</p>
                <div className="pdfb-prop-row">
                  <span className="pdfb-prop-label">Size</span>
                  <input className="pdfb-prop-input" type="number" step="0.5" min="4" max="72" value={selectedField.fontSize || 10} onChange={e => updateFieldWithUndo(selectedField.id, { fontSize: parseFloat(e.target.value) || 10 })}/>
                </div>
              </>
            )}

            <p className="pdfb-prop-section">Page</p>
            <div className="pdfb-prop-row">
              <span className="pdfb-prop-label">Page</span>
              <input className="pdfb-prop-input" type="number" min="1" max={pages.length} value={selectedField.page} onChange={e => updateFieldWithUndo(selectedField.id, { page: parseInt(e.target.value) || 1 })}/>
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 6 }}>
              <button className="pdfb-tbtn" style={{ flex: 1, border: '1px solid var(--border-color)', justifyContent: 'center' }} onClick={() => {
                const f = fields.find(f => f.id === selectedFieldId);
                if (f) duplicateField(f);
              }}>
                {Icons.copy} Duplicate
              </button>
              <button className="pdfb-tbtn danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => removeField(selectedFieldId)}>
                {Icons.trash} Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="pdfb-no-selection">
            {Icons.crosshair}
            <p>Select a field on the canvas to inspect and edit its properties</p>
          </div>
        )}
      </div>

      {/* ══════════════ Context Menu ══════════════ */}
      {contextMenu && (
        <div className="pdfb-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          <button className="pdfb-ctx-item" onClick={() => {
            const f = fields.find(f => f.id === contextMenu.fieldId);
            if (f) duplicateField(f);
            setContextMenu(null);
          }}>
            {Icons.copy} Duplicate <span className="pdfb-ctx-shortcut">Ctrl+D</span>
          </button>
          <button className="pdfb-ctx-item" onClick={() => {
            const newVar = window.prompt("Rename variable key:", fields.find(f => f.id === contextMenu.fieldId)?.variable);
            if (newVar?.trim()) updateFieldWithUndo(contextMenu.fieldId, { variable: newVar.trim() });
            setContextMenu(null);
          }}>
            {Icons.text} Rename Variable
          </button>
          <div className="pdfb-ctx-sep"/>
          <button className="pdfb-ctx-item" onClick={() => {
            const f = fields.find(f => f.id === contextMenu.fieldId);
            if (f && canvasNaturalSize.width > 0) {
              updateFieldWithUndo(f.id, { x: (canvasNaturalSize.width - f.width) / 2 });
            }
            setContextMenu(null);
          }}>
            Center Horizontally
          </button>
          <button className="pdfb-ctx-item" onClick={() => {
            const f = fields.find(f => f.id === contextMenu.fieldId);
            if (f) updateFieldWithUndo(f.id, { x: 0 });
            setContextMenu(null);
          }}>
            Align Left
          </button>
          <button className="pdfb-ctx-item" onClick={() => {
            const f = fields.find(f => f.id === contextMenu.fieldId);
            if (f && canvasNaturalSize.width > 0) {
              updateFieldWithUndo(f.id, { x: canvasNaturalSize.width - f.width });
            }
            setContextMenu(null);
          }}>
            Align Right
          </button>
          <div className="pdfb-ctx-sep"/>
          <button className="pdfb-ctx-item danger" onClick={() => { removeField(contextMenu.fieldId); setContextMenu(null); }}>
            {Icons.trash} Delete <span className="pdfb-ctx-shortcut">Del</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Field Overlay Component ────────────────────────────────────────
// Renders a single draggable, resizable field on the canvas.
// All coordinates are stored in PDF points (natural/unscaled).
// Display position = naturalPos * scale
function FieldOverlay({
  field: f,
  scale,
  isSelected,
  onSelect,
  onUpdate,
  onUpdateWithUndo,
  onRemove,
  onContextMenu,
  onResizeStart,
  onResize,
  onResizeEnd,
  showDimTooltip,
  canvasNaturalSize
}) {
  const dragRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [resizeStart, setResizeStart] = useState(null);

  // Display position in pixels
  const displayX = f.x * scale;
  const displayY = f.y * scale;
  const displayW = f.width * scale;
  const displayH = f.height * scale;

  // Font size for display label
  const labelFontSize = f.type === 'text'
    ? (f.fontSize ? f.fontSize * scale : Math.max(7, Math.min(f.height * 0.55 * scale, 14)))
    : 11;

  // ─── Drag handlers ───────────────────────────────────────────────
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // left-click only
    if (e.target.closest('.pdfb-handle') || e.target.closest('.pdfb-field-delete')) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect();

    const startMouse = { x: e.clientX, y: e.clientY };
    const startPos = { x: f.x, y: f.y };
    let hasMoved = false;

    const onMove = (me) => {
      if (!hasMoved) {
        hasMoved = true;
        onUpdateWithUndo(f.id, {}); // push undo on first move
        setIsDragging(true);
      }
      const dx = (me.clientX - startMouse.x) / scale;
      const dy = (me.clientY - startMouse.y) / scale;
      const newX = Math.max(0, Math.min(startPos.x + dx, canvasNaturalSize.width - f.width));
      const newY = Math.max(0, Math.min(startPos.y + dy, canvasNaturalSize.height - f.height));
      onUpdate(f.id, { x: newX, y: newY });
    };

    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ─── Resize handlers ─────────────────────────────────────────────
  const handleResizeMouseDown = (e, handle) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();

    const startMouse = { x: e.clientX, y: e.clientY };
    const startRect = { x: f.x, y: f.y, w: f.width, h: f.height };
    let hasMoved = false;

    onResizeStart?.();

    const minW = f.type === 'image' ? 30 : (f.type === 'checkbox' ? 12 : 20);
    const minH = f.type === 'image' ? 20 : (f.type === 'checkbox' ? 12 : 10);

    const onMove = (me) => {
      if (!hasMoved) {
        hasMoved = true;
        onUpdateWithUndo(f.id, {}); // push undo on first resize
        setIsResizing(true);
      }

      const dx = (me.clientX - startMouse.x) / scale;
      const dy = (me.clientY - startMouse.y) / scale;

      let newX = startRect.x, newY = startRect.y, newW = startRect.w, newH = startRect.h;

      // Handle based on which corner/edge
      if (handle.includes('r')) { newW = Math.max(minW, startRect.w + dx); }
      if (handle.includes('l')) { newW = Math.max(minW, startRect.w - dx); newX = startRect.x + startRect.w - newW; }
      if (handle.includes('b')) { newH = Math.max(minH, startRect.h + dy); }
      if (handle.includes('t')) { newH = Math.max(minH, startRect.h - dy); newY = startRect.y + startRect.h - newH; }

      // Clamp to canvas
      newX = Math.max(0, newX);
      newY = Math.max(0, newY);
      if (newX + newW > canvasNaturalSize.width) newW = canvasNaturalSize.width - newX;
      if (newY + newH > canvasNaturalSize.height) newH = canvasNaturalSize.height - newY;

      onUpdate(f.id, { x: newX, y: newY, width: newW, height: newH });
      onResize?.(newW, newH);
    };

    const onUp = () => {
      setIsResizing(false);
      onResizeEnd?.();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const typeClass = `type-${f.type || 'text'}`;

  return (
    <div
      className={`pdfb-field ${typeClass}${isSelected ? ' selected' : ''}${!isDragging && !isResizing ? ' pdfb-field-new' : ''}`}
      style={{
        left: displayX,
        top: displayY,
        width: displayW,
        height: displayH,
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={onContextMenu}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div className="pdfb-field-inner">
        <span className="pdfb-field-label" style={{ fontSize: labelFontSize }}>
          {f.type === 'checkbox' ? `✓ ${f.matchValue || ''}` : `{{${f.variable}}}`}
        </span>
      </div>

      {/* Delete button */}
      <button className="pdfb-field-delete" onClick={(e) => { e.stopPropagation(); onRemove(f.id); }} title="Delete">×</button>

      {/* 8 Resize handles */}
      {['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'].map(h => (
        <div key={h} className={`pdfb-handle ${h}`} onMouseDown={(e) => handleResizeMouseDown(e, h)}/>
      ))}

      {/* Dimension tooltip during resize */}
      {showDimTooltip && (
        <div className="pdfb-dim-tooltip">
          {Math.round(showDimTooltip.w)} × {Math.round(showDimTooltip.h)} pt
        </div>
      )}
    </div>
  );
}
