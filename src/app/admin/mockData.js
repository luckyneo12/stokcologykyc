// Shared mock data for the entire admin dashboard
export const MOCK_USERS = Array.from({ length: 20 }, (_, i) => ({
  id: `USR-${String(1000 + i).padStart(4, "0")}`,
  name: ["Arjun Sharma", "Priya Patel", "Rahul Verma", "Sneha Gupta", "Vikram Singh", "Ananya Mishra", "Rohan Mehta", "Kavya Nair", "Aditya Kumar", "Pooja Rao"][i % 10],
  email: `user${1000 + i}@example.com`,
  phone: `+91 98${String(10000000 + i * 9876543).slice(0, 8)}`,
  status: ["active", "pending", "suspended", "active", "active", "active", "suspended", "active", "pending", "active"][i % 10],
  kycStatus: ["verified", "pending", "rejected", "verified", "under_review", "verified", "pending", "verified", "rejected", "verified"][i % 10],
  riskScore: 10 + (i * 7) % 85,
  joinedAt: new Date(Date.now() - i * 7 * 86400000).toLocaleDateString("en-IN"),
  country: "India",
  pan: `ABCDE${1234 + i}F`,
  aadhaar: `XXXX XXXX ${1000 + i}`,
}));

export const MOCK_KYC = Array.from({ length: 25 }, (_, i) => ({
  id: `KYC-${String(2000 + i).padStart(4, "0")}`,
  userId: `USR-${String(1000 + (i % 20)).padStart(4, "0")}`,
  name: ["Arjun Sharma", "Priya Patel", "Rahul Verma", "Sneha Gupta", "Vikram Singh"][i % 5],
  type: ["PAN + Aadhaar", "Passport", "Driving License", "PAN Only"][i % 4],
  status: ["pending", "verified", "rejected", "under_review", "on_hold"][i % 5],
  riskScore: 5 + (i * 11) % 90,
  faceMatch: 75 + (i * 3) % 25,
  submittedAt: new Date(Date.now() - i * 1.5 * 86400000).toLocaleDateString("en-IN"),
  reviewer: i % 3 === 0 ? "Agent Priyanka" : i % 3 === 1 ? "Agent Rahul" : "Unassigned",
  flags: i % 7 === 0 ? ["Duplicate Identity"] : i % 11 === 0 ? ["Face Mismatch"] : [],
  notes: i % 4 === 0 ? "Requires manual review - document quality low." : "",
  documents: { front: true, back: i % 3 !== 2, selfie: true },
  ocrData: { name: ["Arjun Sharma", "Priya Patel", "Rahul Verma", "Sneha Gupta", "Vikram Singh"][i % 5], dob: "1990-0" + ((i % 9) + 1) + "-15", pan: `ABCDE${1234 + i}F` },
}));

export const MOCK_AUDIT_LOGS = Array.from({ length: 30 }, (_, i) => ({
  id: `LOG-${String(3000 + i).padStart(5, "0")}`,
  action: ["Approved KYC", "Rejected KYC", "User Suspended", "Risk Score Updated", "Config Changed", "Role Assigned", "Document Verified", "Flag Added", "User Reactivated", "Bulk Approve"][i % 10],
  actor: ["Admin Suresh", "Agent Priyanka", "Agent Rahul", "SuperAdmin"][i % 4],
  target: `KYC-${String(2000 + i).padStart(4, "0")}`,
  ip: `192.168.${10 + (i % 5)}.${100 + i}`,
  timestamp: new Date(Date.now() - i * 3600000).toLocaleString("en-IN"),
  severity: ["info", "warning", "info", "info", "warning", "info", "info", "warning", "info", "info"][i % 10],
}));

export const MOCK_ROLES = [
  { id: 1, name: "Super Admin", users: 2, permissions: ["all"], color: "#e5484d" },
  { id: 2, name: "KYC Agent", users: 8, permissions: ["view_kyc", "edit_kyc", "approve_kyc", "reject_kyc"], color: "#0091ff" },
  { id: 3, name: "Reviewer", users: 5, permissions: ["view_kyc", "approve_kyc", "reject_kyc", "add_notes"], color: "#9fe870" },
  { id: 4, name: "Auditor", users: 3, permissions: ["view_kyc", "view_logs", "export"], color: "#ffb224" },
];

export const DASHBOARD_STATS = {
  total: 1284, pending: 42, verified: 1105, rejected: 137, flagged: 18,
  approvalRate: 86.1, avgTime: "4.2 hrs", todaySubmissions: 38,
  weeklyTrend: [45, 62, 38, 71, 55, 88, 64, 79, 43, 95, 71, 38, 82, 66],
  dropOff: [{ step: "Phone OTP", rate: 12 }, { step: "Details", rate: 8 }, { step: "Document", rate: 18 }, { step: "Selfie", rate: 11 }, { step: "Address", rate: 5 }],
};

export const MOCK_NOTIFICATIONS = [
  { id: 1, type: "OTP SMS", template: "Your SecureKYC OTP is {{otp}}. Valid for 10 minutes. Do not share.", active: true },
  { id: 2, type: "Approval Email", template: "Dear {{name}}, your KYC has been approved. Welcome aboard!", active: true },
  { id: 3, type: "Rejection Email", template: "Dear {{name}}, your KYC was rejected. Reason: {{reason}}. Please re-apply.", active: true },
  { id: 4, type: "Reminder SMS", template: "Hi {{name}}, your KYC is pending. Complete it now to unlock all features.", active: false },
];

export const MOCK_RULES = {
  minAge: 18, maxRetries: 3, faceMatchThreshold: 80,
  acceptedDocs: ["PAN Card", "Aadhaar", "Passport", "Driving License"],
  autoApproveRiskBelow: 20, slaHours: 24,
  features: { ocr: true, faceVerification: true, videoKyc: false, manualReview: true, liveness: true, autoApprove: false },
};
