"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Lock,
  ShieldCheck,
  XCircle,
  Maximize2,
  X,
  Mail,
  User, Phone
} from "lucide-react";
import { API_BASE_URL, resolveAssetUrl } from "@/utils/apiConfig";
import { io } from "socket.io-client";
import "@/app/admin/admin.css";

const USER_STEP_LABELS = {
  0: "Welcome", 
  1: "Phone", 
  2: "Email", 
  3: "Pricing",
  4: "PAN", 
  5: "DigiLocker", 
  6: "Personal Details",
  7: "Nominee Choice", 
  8: "Nominee",
  9: "Allocation", 
  10: "Bank", 
  11: "Document Upload",
  12: "eSign Preview", 
  13: "Aadhaar eSign", 
  14: "Completion"
};

const REVIEW_STEPS = [
  {
    id: "phoneVerification",
    kycIndex: 1,
    title: "Phone Verification",
    evidenceTitle: "",
    evidenceHint: "Confirm the applicant's verified mobile number and reference their photo.",
    fields: (app) => [
      ["Mobile number", app.user?.phone],
    ],
    evidence: (app) => {
      const doc = findDocument(app, ["aadhaar", "digilocker", "photo"], "", ["pan"]);
      return doc ? [{ ...doc, label: "" }] : [];
    },
  },
  {
    id: "emailVerification",
    kycIndex: 2,
    title: "Email Verification",
    evidenceTitle: "",
    evidenceHint: "Confirm the applicant's verified email address.",
    fields: (app) => [
      ["Email", app.personalDetails?.email || app.user?.email],
      ["Mobile number", app.user?.phone],
    ],
    evidence: () => [],
  },
  {
    id: "pricingSelection",
    kycIndex: 3,
    title: "Pricing Plan",
    evidenceTitle: "",
    evidenceHint: "Verify the plan and segment choices before moving ahead.",
    fields: (app) => [
      ["Selected plan", app.pricingSelection?.plan || app.segments?.pricingPlan || app.segments?.plan],
      ["Segments", formatList(app.segments?.selected || app.segments?.segments || app.segments)],
      ["BSDA", app.bsda],
    ],
    evidence: () => [],
  },
  {
    id: "panVerification",
    kycIndex: 4,
    title: "PAN Verification",
    evidenceTitle: "PAN Data",
    evidenceHint: "Match PAN number, name, and date of birth with uploaded PAN evidence when available.",
    fields: (app) => [
      ["PAN number", app.identityDetails?.pan || app.personalDetails?.pan],
      ["Name as per PAN", app.identityDetails?.pan_name || app.identityDetails?.name || app.personalDetails?.fullName],
      ["Date of birth", app.identityDetails?.dob || app.personalDetails?.dob],
      ["PAN verified", app.identityDetails?.pan_verification?.status || app.identityDetails?.panVerified],
    ],
    evidence: (app) => [firstMedia(app.panUpload, "Uploaded PAN Card") || findDocument(app, ["pan"], "PAN Document")].filter(Boolean),
  },
  {
    id: "digilocker",
    kycIndex: 5,
    title: "DigiLocker",
    evidenceTitle: "Extracted Document",
    evidenceHint: "Use the extracted Aadhaar or PAN document to verify identity details.",
    tabs: [
      { id: "aadhaar", label: "Aadhaar Details" },
      { id: "pan", label: "PAN Details" }
    ],
    fields: (app, tab = "aadhaar") => {
      if (tab === "pan") {
        return [
          ["PAN number", app.identityDetails?.pan || app.personalDetails?.pan],
          ["Name on PAN", app.identityDetails?.pan_name || app.identityDetails?.name || app.personalDetails?.fullName],
          ["Father's Name", app.identityDetails?.pan_verification?.father_name || app.identityDetails?.pan_father_name || app.ocrData?.pan?.fatherName || app.personalDetails?.fatherName],
          ["Date of birth", app.identityDetails?.dob || app.personalDetails?.dob],
          ["Aadhaar Seeding Status", app.identityDetails?.pan_verification?.aadhaar_seeding_status],
          ["PAN verified", app.identityDetails?.pan_verification?.status || app.identityDetails?.panVerified],
        ];
      }
      return [
        ["Identity method", app.identityMethod],
        ["Aadhaar reference", app.identityDetails?.aadhaar || app.identityDetails?.aadhaarNumber || app.identityDetails?.uid],
        ["Name on Aadhaar", app.identityDetails?.name || app.ocrData?.digilocker?.name],
        ["Date of birth", app.identityDetails?.dob || app.ocrData?.digilocker?.dob],
        ["Gender", app.identityDetails?.gender || app.ocrData?.digilocker?.gender],
        ["Address", typeof app.address === 'object' ? app.address?.permanentAddress || app.address?.currentAddress || app.address?.address || app.identityDetails?.address : app.address || app.identityDetails?.address],
        ["DigiLocker status", app.identityDetails?.digilocker?.status || app.ocrData?.digilocker?.status],
      ];
    },
    evidence: (app, tab = "aadhaar") => {
      if (tab === "pan") {
        return [findDocument(app, ["pan", "digilocker"], "DigiLocker PAN", ["aadhaar", "photo"])].filter(Boolean);
      }
      return [findDocument(app, ["aadhaar", "digilocker", "uidai"], "Aadhaar Document", ["pan", "photo", "image"])].filter(Boolean);
    },
  },
  {
    id: "personalDetails",
    kycIndex: 6,
    title: "Personal Details",
    evidenceTitle: "Extracted Documents",
    evidenceHint: "Compare details with the Aadhaar photo, Aadhaar document, and PAN document.",
    fields: (app) => [
      ["Full name", app.personalDetails?.fullName, "personalDetails.fullName"],
      ["Father/Spouse name", app.personalDetails?.fatherName || app.personalDetails?.spouseName, "personalDetails.fatherName"],
      ["Mother's name", app.personalDetails?.motherName, "personalDetails.motherName"],
      ["Date of birth", app.personalDetails?.dob, "personalDetails.dob"],
      ["Gender", app.personalDetails?.gender, "personalDetails.gender"],
      ["Marital status", app.personalDetails?.maritalStatus, "personalDetails.maritalStatus"],
      ["Education", app.personalDetails?.education, "personalDetails.education"],
      ["Annual income", app.personalDetails?.annualIncome, "personalDetails.annualIncome"],
      ["Trading experience", app.personalDetails?.experience, "personalDetails.experience"],
      ["Sms alert", app.personalDetails?.smsAlert || "Yes", "personalDetails.smsAlert"],
      ["Operate ddpi", app.personalDetails?.operateDdpi || "Yes", "personalDetails.operateDdpi"],
      ["Stampaper number", app.user?.eStampAssigned?.certificateNo || app.user?.eStampAssigned?.serialNo || "N/A"],
      ["Nsdl4 communication in electronic form", app.personalDetails?.nsdl4Communication || "Yes", "personalDetails.nsdl4Communication"],
      ["Namematch1", app.identityDetails?.pan_name || app.identityDetails?.panName || app.personalDetails?.fullName || "N/A"],
      ["Dobmatch1", app.identityDetails?.dob || app.personalDetails?.dob || "N/A"],
      ["Modeofjourney", app.identityDetails?.journeyMode || "DIGILOCKER"],
      ["Account settlement", app.personalDetails?.accountSettlement || "Quarterly", "personalDetails.accountSettlement"],
      ["Reject reason personal details", app.personalDetails?.rejectReason || "N/A"],
      ["Rejected by personal details", app.personalDetails?.rejectedBy || "N/A"],
      ["Rejected timestamp personal details", app.personalDetails?.rejectedAt ? new Date(app.personalDetails.rejectedAt).toLocaleString() : "N/A"],
      ["Country of tax residence1", app.personalDetails?.taxResidenceCountry1 || "N/A", "personalDetails.taxResidenceCountry1"],
      ["Tax payer identification number1", app.personalDetails?.taxPayerId1 || "N/A", "personalDetails.taxPayerId1"],
      ["Country of tax residence2", app.personalDetails?.taxResidenceCountry2 || "N/A", "personalDetails.taxResidenceCountry2"],
      ["Tax payer identification number2", app.personalDetails?.taxPayerId2 || "N/A", "personalDetails.taxPayerId2"],
      ["Country tax residence3", app.personalDetails?.taxResidenceCountry3 || "N/A", "personalDetails.taxResidenceCountry3"],
      ["Tax payer identification number3", app.personalDetails?.taxPayerId3 || "N/A", "personalDetails.taxPayerId3"],
      ["Place of birth", app.personalDetails?.placeOfBirth || "N/A", "personalDetails.placeOfBirth"],
      ["Tax exempt", app.personalDetails?.taxExempt || "--select--", "personalDetails.taxExempt"],
      ["Tax exempt reason", app.personalDetails?.taxExemptReason || "N/A", "personalDetails.taxExemptReason"],
      ["Ddpi", app.personalDetails?.ddpi || "Yes", "personalDetails.ddpi"],
      ["State code", app.address?.state || "N/A"],
      ["Clientcode", app.applicationId || "N/A"],
      ["Dis booklet", app.personalDetails?.disBooklet || "No", "personalDetails.disBooklet"],
      ["Nsdl1 receive credit", app.personalDetails?.nsdl1ReceiveCredit || "Yes", "personalDetails.nsdl1ReceiveCredit"],
      ["Nsdl2 e statement", app.personalDetails?.nsdl2EStatement || "Yes", "personalDetails.nsdl2EStatement"],
      ["Nsdl3 pledge instruction", app.personalDetails?.nsdl3PledgeInstruction || "No", "personalDetails.nsdl3PledgeInstruction"],
      ["Politically exposed", app.personalDetails?.politicallyExposed, "personalDetails.politicallyExposed"],
      ["Politically exposed category", app.personalDetails?.pepType || "--select--", "personalDetails.pepType"],
      ["Comment", app.personalDetails?.pepComment || "N/A", "personalDetails.pepComment"],
      ["Occupation", app.personalDetails?.occupation, "personalDetails.occupation"],
      ["Are ypu citizen of india", app.personalDetails?.citizenOfIndia || "Yes", "personalDetails.citizenOfIndia"],
      ["Tax residency outside", app.personalDetails?.taxResidencyOutside || "No", "personalDetails.taxResidencyOutside"],
      ["Country birth1", app.personalDetails?.countryBirth1 || "N/A", "personalDetails.countryBirth1"],
      ["Citizen1", app.personalDetails?.citizen1 || "N/A", "personalDetails.citizen1"],
    ],
    evidence: (app) => [
      findDocument(app, ["aadhaar", "digilocker", "uidai"], "Aadhaar Document", ["pan", "photo", "image"]),
      findDocument(app, ["aadhaar", "digilocker", "photo"], "Aadhaar Photo", ["pan", "pdf"]),
      findDocument(app, ["pan", "digilocker"], "DigiLocker PAN", ["aadhaar", "photo"]) || firstMedia(app.panUpload, "Uploaded PAN Card"),
      firstMedia(app.personalDetails?.pepProofPreview || app.personalDetails?.pepProof, "PEP Proof"),
    ].filter(Boolean),
  },
  // {
  //   id: "nomineeChoice",
  //   kycIndex: 7,
  //   title: "Nominee Choice",
  //   evidenceTitle: "",
  //   evidenceHint: "Confirm whether the applicant added or opted out of nominee registration.",
  //   fields: (app) => [
  //     ["Nominee preference", app.nomineeDetails?.choice || app.nomineeDetails?.nomineeChoice || nomineeSummary(app)],
  //     ["Nominees added", Array.isArray(app.nomineeDetails?.nominees) ? app.nomineeDetails.nominees.length : 0],
  //   ],
  //   evidence: () => [],
  // },
  {
    id: "nomineeDetails",
    kycIndex: 8,
    title: "Nominee Details",
    evidenceTitle: "Nominee Identity Proof",
    evidenceHint: "Check nominee name, relation, date of birth, guardian details, and allocation.",
    fields: (app) => nomineeFields(app),
    evidence: (app) => nomineeEvidence(app),
  },
  // {
  //   id: "nomineeAllocation",
  //   kycIndex: 9,
  //   title: "Nominee Allocation",
  //   evidenceTitle: "",
  //   evidenceHint: "Confirm nominee percentages add up correctly.",
  //   fields: (app) => {
  //     const percentages = app.nomineeAllocation?.percentages || app.nomineeAllocation?.allocations || app.nomineeDetails?.allocations || [];
  //     const nominees = app.nomineeDetails?.nominees || [];
  //     
  //     let details = "";
  //     if (Array.isArray(percentages) && percentages.length > 0 && Array.isArray(nominees) && nominees.length > 0) {
  //       details = nominees.map((nom, i) => `Nominee ${i+1}: ${typeof percentages[i] === 'object' ? (percentages[i].percentage || percentages[i].allocation) : percentages[i]}%`).join(" | ");
  //     } else {
  //       details = formatList(percentages);
  //     }
  //     
  //     return [
  //       ["Allocation details", details],
  //     ];
  //   },
  //   evidence: () => [],
  // },
  {
    id: "bankVerification",
    kycIndex: 10,
    title: "Bank Verification",
    evidenceTitle: "Bank Account Proof",
    evidenceHint: "Verify account holder name, account number, IFSC, and bank proof if uploaded.",
    fields: (app) => [
      ["Account holder", app.bankDetails?.beneficiaryName || app.bankDetails?.accountHolderName],
      ["Account number", app.bankDetails?.accountNumber],
      ["IFSC", app.bankDetails?.ifsc],
      ["Bank name", app.bankDetails?.bankName],
      ["Branch", app.bankDetails?.branch],
      ["Address", app.bankDetails?.address],
      ["City", app.bankDetails?.city],
      ["District", app.bankDetails?.district],
      ["State", app.bankDetails?.state],
      ["Verification status", app.bankDetails?.status || app.bankDetails?.verificationStatus],
    ],
    evidence: (app) => [firstMedia(app.bankDetails?.proofPreview || app.bankDetails?.proofPath || app.bankDetails?.proof, "Bank Proof")].filter(Boolean),
  },
  {
    id: "financialProof",
    kycIndex: 11,
    title: "Financial Proof",
    evidenceTitle: "Income / Financial Document",
    evidenceHint: "Review the uploaded bank statement, salary slip, ITR, or other financial proof.",
    fields: (app) => [
      ["Proof type", app.financialProof?.type || app.financialProof?.documentType],
      ["Annual income", app.personalDetails?.annualIncome || app.financialProof?.annualIncome],
      ["Trading experience", app.personalDetails?.tradingExperience],
    ],
    evidence: (app) => [firstMedia(app.financialProof, "Financial Proof")].filter(Boolean),
  },
  {
    id: "signature",
    kycIndex: 12,
    title: "Signature Upload",
    evidenceTitle: "Wet Signature",
    evidenceHint: "Check that the signature is clear and matches the signature on the PAN card.",
    fields: (app) => [
      ["Signature captured", app.signature ? "Yes" : "No"],
      ["Applicant", app.personalDetails?.fullName],
    ],
    evidence: (app) => {
      const panDocs = getAllPanDocuments(app);
      const manualPan = panDocs.find(p => p.label === "Uploaded PAN Card") || panDocs[0];
      const signatureDoc = firstMedia(app.signature, "Signature");
      if (manualPan && signatureDoc) {
        return [
          signatureDoc,
          { ...manualPan, defaultZoom: 2.5, defaultOffset: { x: 0, y: -150 } }
        ];
      }
      return [signatureDoc].filter(Boolean);
    },
  },
  {
    id: "panUpload",
    kycIndex: 13,
    title: "PAN Card Upload",
    evidenceTitle: "PAN Card Image",
    evidenceHint: "Compare the PAN image against the PAN details verified earlier.",
    fields: (app) => [
      ["PAN number", app.identityDetails?.pan || app.personalDetails?.pan],
      ["Name", app.personalDetails?.fullName],
    ],
    evidence: (app) => getAllPanDocuments(app),
  },
  {
    id: "ipv",
    kycIndex: 14,
    title: "IPV",
    evidenceTitle: "Live Selfie",
    evidenceHint: "Compare live selfie with Aadhaar/PAN photo and face match score.",
    fields: (app) => [
      ["Face match score", app.faceMatchScore !== null && app.faceMatchScore !== undefined ? `${app.faceMatchScore}%` : ""],
      ["Selfie captured", app.selfie || app.selfieDetails?.preview || app.selfieDetails?.path ? "Yes" : "No"],
      ["Applicant", app.personalDetails?.fullName],
    ],
    evidence: (app) => [
      firstMedia(app.selfieDetails?.preview || app.selfieDetails?.path || app.selfie, "Live Selfie"),
      findDocument(app, ["aadhaar", "photo", "digilocker"], "Reference Photo", ["pan"]),
      firstMedia(app.panUpload, "Uploaded PAN Card") || findDocument(app, ["pan"], "PAN Document"),
    ].filter(Boolean),
  },
  {
    id: "estampPreview",
    kycIndex: 15,
    title: "E-Stamp Assigned",
    evidenceTitle: "E-Stamp Document",
    evidenceHint: "Review the e-stamp assigned to this user.",
    readOnly: true,
    fields: (app) => [
      ["Certificate No", app.user?.eStampAssigned?.certificateNo],
      ["Serial No", app.user?.eStampAssigned?.serialNo],
    ],
    evidence: (app) => [firstMedia(app.user?.eStampAssigned?.fileUrl, "Assigned E-Stamp")].filter(Boolean),
  },
];

function PdfThumbnail({ src }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function renderThumbnail() {
      if (!src) return;
      setLoading(true);
      setFailed(false);
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version || "5.7.284"}/build/pdf.worker.min.mjs`;
        const pdf = await pdfjs.getDocument({ url: src }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.9 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        if (!cancelled) setLoading(false);
      } catch (error) {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    }

    renderThumbnail();
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {loading && <div style={{ color: "var(--text-muted)", fontWeight: 800 }}>Loading PDF...</div>}
      {failed && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>
          <FileText size={34} />
          <div style={{ marginTop: 10, fontWeight: 900 }}>PDF preview unavailable</div>
          <div style={{ marginTop: 6, fontSize: "0.82rem", fontWeight: 700 }}>The uploaded file could not be loaded from the server.</div>
        </div>
      )}
      <canvas ref={canvasRef} style={{ maxWidth: "100%", maxHeight: "100%", display: loading || failed ? "none" : "block" }} />
    </div>
  );
}

const fetchWithFallback = async (path, options = {}) => {
  try {
    return await fetch(`${API_BASE_URL}${path}`, options);
  } catch (error) {
    if (typeof window !== "undefined") return fetch(path, options);
    throw error;
  }
};

const safeJson = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeApp = (raw) => {
  const jsonFields = [
    "personalDetails",
    "identityDetails",
    "ocrData",
    "address",
    "bankDetails",
    "nomineeDetails",
    "nomineeAllocation",
    "panUpload",
    "signature",
    "financialProof",
    "selfieDetails",
    "documents",
    "nsdlRequest",
    "nsdlResponse",
    "segments",
    "pricingSelection",
    "esignDetails",
  ];
  const app = { ...raw };
  jsonFields.forEach((field) => {
    app[field] = safeJson(raw?.[field], field === "documents" ? [] : {});
  });
  return app;
};

const getApplicantName = (app) => {
  return (
    app?.personalDetails?.fullName ||
    app?.personalDetails?.name ||
    app?.identityDetails?.pan_name ||
    app?.identityDetails?.name ||
    app?.user?.email ||
    app?.user?.phone ||
    "Unnamed Applicant"
  );
};

function firstMedia(value, label) {
  if (!value) return null;
  if (typeof value === "string") return mediaFromString(value, label);
  const candidates = [
    value.filePreview,
    value.preview,
    value.path,
    value.url,
    value.fileUrl,
    value.proofPath,
    value.proofPreview,
    value.signedPdf,
    value.base64,
    value.image,
    value.photo,
  ];
  for (const candidate of candidates) {
    const media = firstMedia(candidate, label || value.type || value.name);
    if (media) return media;
  }
  return null;
}

function mediaFromString(value, label) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) return { label, src: trimmed };
  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("http") || trimmed.toLowerCase().endsWith(".pdf")) {
    return { label, src: resolveAssetUrl(trimmed) };
  }
  if (trimmed.length > 500 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed.slice(0, 120))) {
    const compact = trimmed.replace(/\s/g, "");
    const mime = compact.startsWith("JVBERi") ? "application/pdf" : "image/jpeg";
    return { label, src: `data:${mime};base64,${compact}` };
  }
  return null;
}

function normalizeDocuments(app) {
  const docs = app.documents;
  if (Array.isArray(docs)) return docs;
  if (docs && typeof docs === "object") return Object.values(docs).flat().filter(Boolean);
  return [];
}

function findDocument(app, keywords, label, excludeKeywords = []) {
  const lowerKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const lowerExclude = excludeKeywords.map((k) => k.toLowerCase());
  const docs = normalizeDocuments(app);
  
  for (const doc of docs) {
    const haystack = JSON.stringify(doc || {}).toLowerCase();
    
    const matchesKeyword = lowerKeywords.some((keyword) => haystack.includes(keyword));
    const matchesExclude = lowerExclude.some((keyword) => haystack.includes(keyword));
    
    if (matchesKeyword && !matchesExclude) {
      const media = firstMedia(doc, label || doc.type || doc.name || "Document");
      if (media) return media;
    }
  }
  return null;
}

function getAllPanDocuments(app) {
  const pans = [];
  const manual = firstMedia(app.panUpload, "Uploaded PAN Card");
  if (manual) pans.push(manual);

  const docs = normalizeDocuments(app);
  docs.forEach(doc => {
    const type = String(doc?.type || "").toUpperCase();
    const label = String(doc?.label || "").toUpperCase();
    const path = String(doc?.path || "").toLowerCase();
    
    if (type.includes("AADHAAR") || type.includes("AADHAR") || type.includes("UID")) return;
    if (path.includes("aadhaar") || path.includes("aadhar")) return;

    if (type.includes("PAN") || label.includes("PAN") || /(^|[\/_])pan([\/_]|\.)/i.test(path)) {
      const media = firstMedia(doc, doc.label || doc.type || "DigiLocker PAN");
      if (media && !pans.some(p => p.src === media.src)) {
        pans.push(media);
      }
    }
  });

  return pans;
}

function formatList(value) {
  if (!value) return "";
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "object" ? Object.values(item).filter(Boolean).join(" - ") : item)).join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([key, val]) => val !== false)
      .map(([key, val]) => val === true ? key : `${key}: ${Array.isArray(val) ? val.join(", ") : val}`)
      .join(", ");
  }
  return value;
}

function nomineeSummary(app) {
  if (Array.isArray(app.nomineeDetails?.nominees) && app.nomineeDetails.nominees.length > 0) return "Nominee added";
  if (app.nomineeDetails?.optOut || app.nomineeDetails?.skipNominee) return "Opted out";
  return "";
}

function nomineeFields(app) {
  const preference = app.nomineeDetails?.choice || app.nomineeDetails?.nomineeChoice || nomineeSummary(app);
  const nominees = Array.isArray(app.nomineeDetails?.nominees) ? app.nomineeDetails.nominees : [];
  const percentages = app.nomineeAllocation?.percentages || app.nomineeAllocation?.allocations || app.nomineeDetails?.allocations || [];
  
  const baseFields = [
    ["Nominee preference", preference],
    ["Nominees added", nominees.length],
  ];

  if (!nominees.length) return [...baseFields, ["Nominee details", "No nominee details submitted"]];
  
  const detailedFields = nominees.flatMap((nominee, index) => {
    let allocation = "N/A";
    if (Array.isArray(percentages) && percentages[index] !== undefined) {
      allocation = typeof percentages[index] === 'object' ? (percentages[index].percentage || percentages[index].allocation) : percentages[index];
    }
    return [
      [`Nominee ${index + 1} name`, nominee.name || nominee.fullName],
      [`Nominee ${index + 1} relation`, nominee.relationship || nominee.relation],
      [`Nominee ${index + 1} DOB`, nominee.dob],
      [`Nominee ${index + 1} guardian`, nominee.guardianName],
      [`Nominee ${index + 1} allocation`, `${allocation}%`],
    ];
  });
  
  return [...baseFields, ...detailedFields];
}

function nomineeEvidence(app) {
  const nominees = Array.isArray(app.nomineeDetails?.nominees) ? app.nomineeDetails.nominees : [];
  return nominees.map((nominee, index) => firstMedia(nominee.guardianProofPath || nominee.proofPath || nominee.proofPreview, `Nominee ${index + 1} Proof`)).filter(Boolean);
}

function allocationTotal(app) {
  const allocations = app.nomineeAllocation?.allocations || app.nomineeDetails?.allocations || [];
  if (!Array.isArray(allocations)) return "";
  const total = allocations.reduce((sum, item) => sum + Number(item.percentage || item.allocation || 0), 0);
  return total ? `${total}%` : "";
}

function getStepStatuses(app) {
  const statuses = safeJson(app?.stepStatuses, {});
  // Automatically approve phone and email as they are OTP verified unless explicitly set
  if (!statuses.phoneVerification || !statuses.phoneVerification.status) {
    statuses.phoneVerification = { status: "approved" };
  }
  if (!statuses.emailVerification || !statuses.emailVerification.status) {
    statuses.emailVerification = { status: "approved" };
  }
  return statuses;
}

function isPdf(src) {
  return src?.startsWith("data:application/pdf") || src?.toLowerCase().includes(".pdf");
}

function openInNewTab(src) {
  if (!src) return;
  if (src.startsWith("data:")) {
    try {
      const [meta, base64] = src.split(",");
      const mime = meta.match(/:(.*?);/)?.[1] || "application/octet-stream";
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      window.open(URL.createObjectURL(new Blob([bytes], { type: mime })), "_blank");
      return;
    } catch (error) {
      console.error("Unable to open data URI", error);
    }
  }
  window.open(src, "_blank", "noopener,noreferrer");
}

function FieldGrid({ fields }) {
  const rows = fields.filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (!rows.length) {
    return <div style={{ color: "var(--text-muted)", fontWeight: 700 }}>No submitted values for this step yet.</div>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
      {rows.map(([label, value]) => {
        const isShiny = label === "Certificate No" || label === "Serial No";
        const isCert = label === "Certificate No";
        
        return (
          <div key={label} style={{ 
            padding: 14, 
            border: "1px solid var(--border-color)", 
            borderRadius: 8, 
            background: "var(--bg-secondary)",
            gridColumn: isCert ? "1 / -1" : undefined
          }}>
            <span className="inspection-label" style={{ marginBottom: 4 }}>{label}</span>
            <div style={{ 
              fontSize: "0.95rem", 
              fontWeight: 850, 
              color: isShiny ? "#10b981" : "var(--text-primary)", 
              textShadow: isShiny ? "0 0 12px rgba(16, 185, 129, 0.4)" : "none",
              overflowWrap: isCert ? "normal" : "anywhere",
              whiteSpace: isCert ? "nowrap" : "normal",
              overflowX: isCert ? "auto" : "visible"
            }}>
              {label === "Segments" && typeof value === "string" ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                  {value.split(",").map(seg => seg.trim()).filter(Boolean).map(seg => (
                    <span key={seg} style={{ 
                      padding: "6px 14px", 
                      background: "linear-gradient(135deg, #059669 0%, #047857 100%)", 
                      color: "white", 
                      borderRadius: 999, 
                      fontSize: "0.75rem", 
                      fontWeight: 900, 
                      textTransform: "uppercase", 
                      letterSpacing: 0.5,
                      boxShadow: "0 4px 10px rgba(5, 150, 105, 0.4), inset 0 2px 2px rgba(255, 255, 255, 0.3)" 
                    }}>
                      {seg}
                    </span>
                  ))}
                </div>
              ) : (
                String(value)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EvidencePanel({ step, app }) {
  const evidence = step.evidence(app);

  return (
    <div className="card" style={{ padding: 20, borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 14 }}>
        <div>
          <span className="inspection-label" style={{ marginBottom: 4 }}>{step.evidenceTitle}</span>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.86rem", fontWeight: 650, lineHeight: 1.5 }}>{step.evidenceHint}</p>
        </div>
        <FileText size={22} color="#163300" />
      </div>

      {evidence.length === 0 ? (
        <div style={{ minHeight: 320, border: "1px dashed var(--border-color)", borderRadius: 8, background: "var(--bg-secondary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
          <AlertCircle size={32} />
          <div style={{ marginTop: 12, fontWeight: 900 }}>No document captured for this step</div>
          <div style={{ marginTop: 6, fontSize: "0.84rem", maxWidth: 420 }}>The agent can still review the submitted fields, but should reject if this proof is mandatory for the application.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {evidence.map((item, index) => (
            <div key={`${item.label}-${index}`} style={{ border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>
                <strong style={{ fontSize: "0.86rem" }}>{item.label || "Evidence"}</strong>
                <button onClick={() => openInNewTab(item.src)} title="Open evidence" style={{ border: "none", background: "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, color: "var(--wise-dark-green)" }}>
                  <ExternalLink size={16} /> Open
                </button>
              </div>
              <div style={{ height: 420, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f9fa" }}>
                {isPdf(item.src) ? (
                  <PdfThumbnail src={item.src} />
                ) : (
                  <img src={item.src} alt={item.label || "Evidence"} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 14 }} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepRail({ unlockedSteps, activeStepId, statuses, onSelectStep }) {
  return (
    <div className="card" style={{ padding: 14, borderRadius: 8, position: "sticky", top: 16 }}>
      <span className="inspection-label">Review Queue</span>
      <div style={{ display: "grid", gap: 8 }}>
        {unlockedSteps.map((step, index) => {
          const info = statuses[step.id];
          const isActive = step.id === activeStepId;
          const approved = info?.status === "approved";
          const rejected = info?.status === "rejected";
          const isAccessible = index === 0 || unlockedSteps.slice(0, index).every(s => statuses[s.id]?.status === "approved" || statuses[s.id]?.status === "rejected");

          return (
            <div 
              key={step.id} 
              onClick={() => {
                if (isAccessible && onSelectStep) onSelectStep(step.id);
              }} 
              style={{ 
                display: "grid", gridTemplateColumns: "28px 1fr", gap: 10, alignItems: "center", padding: 10, 
                borderRadius: 8, border: isActive ? "2px solid var(--wise-green)" : "1px solid var(--border-color)", 
                background: isActive ? "#f3ffe9" : "white", 
                cursor: (isAccessible && onSelectStep) ? "pointer" : "not-allowed",
                opacity: isAccessible ? 1 : 0.5
              }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: approved ? "#dcfce7" : rejected ? "#fee2e2" : "var(--bg-secondary)", color: approved ? "#15803d" : rejected ? "#b91c1c" : "var(--text-muted)" }}>
                {approved ? <CheckCircle2 size={16} /> : rejected ? <XCircle size={16} /> : index + 1}
              </div>
              <div>
                <div style={{ fontSize: "0.84rem", fontWeight: 900 }}>{step.title}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase" }}>
                  {approved ? "Approved" : rejected ? "Rejected" : isActive ? "Ready to verify" : isAccessible ? "Pending review" : "Locked by previous step"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ImageComparisonModal({ isOpen, onClose, leftImage, leftLabel, rightImage, rightLabel, matchScore }) {
  const [zoom, setZoom] = useState(1);
  
  useEffect(() => {
    if (isOpen) setZoom(1);
  }, [isOpen, leftImage, rightImage]);

  if (!isOpen) return null;
  const isSingle = !rightLabel && !rightImage;
  
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", flexDirection: "column", backdropFilter: "blur(8px)", padding: "40px", animation: "fadeIn 0.2s ease-out" }}>
      <div style={{ alignSelf: "flex-end", marginBottom: 20, display: "flex", gap: 20, alignItems: "center" }}>
        <div style={{ display: "flex", background: "rgba(255,255,255,0.1)", borderRadius: 8, overflow: "hidden" }}>
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer", padding: "8px 16px", borderRight: "1px solid rgba(255,255,255,0.2)", fontWeight: 800 }}>-</button>
          <div style={{ padding: "8px 16px", color: "white", fontWeight: 800, minWidth: 60, textAlign: "center" }}>{Math.round(zoom * 100)}%</div>
          <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer", padding: "8px 16px", borderLeft: "1px solid rgba(255,255,255,0.2)", fontWeight: 800 }}>+</button>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer", transition: "transform 0.2s" }} onMouseOver={e => e.currentTarget.style.transform="scale(1.1)"} onMouseOut={e => e.currentTarget.style.transform="scale(1)"}>
          <X size={40} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 30, height: "80%", justifyContent: "center", alignItems: "center" }}>
        <div style={{ flex: isSingle ? "none" : 1, width: isSingle ? "80%" : "auto", background: "#1a1a1a", borderRadius: 16, overflow: "hidden", border: "1px solid #333", display: "flex", flexDirection: "column", height: "100%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
          <div style={{ padding: 15, background: "#2a2a2a", color: "white", fontWeight: 800, textAlign: "center", letterSpacing: 1 }}>{leftLabel}</div>
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", justifyContent: "center", alignItems: "center", padding: 20, overflow: "auto" }}>
            {leftImage ? (
              <div style={{ width: `${100 * zoom}%`, height: `${100 * zoom}%`, display: "flex", justifyContent: "center", alignItems: "center", transition: "width 0.2s, height 0.2s", minWidth: "100%", minHeight: "100%" }}>
                <img src={leftImage} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
              </div>
            ) : <div style={{color:"#666"}}>No Image Available</div>}
          </div>
        </div>
        
        {matchScore !== undefined && matchScore !== null && matchScore !== "" && !isSingle && (
          <div style={{ width: 120, height: 120, borderRadius: 60, background: matchScore >= 70 ? "#dcfce7" : "#fee2e2", border: `4px solid ${matchScore >= 70 ? "#15803d" : "#991b1b"}`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: matchScore >= 70 ? "#15803d" : "#991b1b", zIndex: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.3)", flexShrink: 0 }}>
            <span style={{ fontSize: "2.2rem", fontWeight: 950 }}>{matchScore}%</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase" }}>Match</span>
          </div>
        )}

        {!isSingle && (
          <div style={{ flex: 1, background: "#1a1a1a", borderRadius: 16, overflow: "hidden", border: "1px solid #333", display: "flex", flexDirection: "column", height: "100%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
            <div style={{ padding: 15, background: "#2a2a2a", color: "white", fontWeight: 800, textAlign: "center", letterSpacing: 1 }}>{rightLabel}</div>
            <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", justifyContent: "center", alignItems: "center", padding: 20, overflow: "auto" }}>
              {rightImage ? (
                <div style={{ width: `${100 * zoom}%`, height: `${100 * zoom}%`, display: "flex", justifyContent: "center", alignItems: "center", transition: "width 0.2s, height 0.2s", minWidth: "100%", minHeight: "100%" }}>
                  <img src={rightImage} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
                </div>
              ) : <div style={{color:"#666"}}>No Image Available</div>}
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}


function getInitials(name) {
  if (!name) return "??";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function InfoField({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div>
      <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

function StepCard({ step, app, info, submitting, reviewStep, onImageClick }) {
  const isApproved = info.status === "approved";
  const isRejected = info.status === "rejected";
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [activeTab, setActiveTab] = useState(step.tabs ? step.tabs[0].id : null);

  const evidence = step.evidence(app, activeTab);
  const fields = step.fields(app, activeTab);

  return (
    <div className="card" style={{ padding: 24, borderRadius: 12, marginBottom: 20, border: isApproved ? "2px solid #dcfce7" : isRejected ? "2px solid #fee2e2" : "1px solid var(--border-color)", background: "white", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", transition: "all 0.3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ width: 28, height: 28, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: isApproved ? "#15803d" : isRejected ? "#b91c1c" : "#f3f4f6", color: isApproved || isRejected ? "white" : "#4b5563", fontWeight: 900, fontSize: "0.9rem" }}>
              {isApproved ? <CheckCircle2 size={16} /> : isRejected ? <XCircle size={16} /> : step.kycIndex}
            </span>
            <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 900, color: "var(--text-primary)" }}>{step.title}</h2>
          </div>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem", fontWeight: 600 }}>{step.evidenceHint}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ padding: "6px 12px", borderRadius: 20, fontSize: "0.8rem", fontWeight: 800, background: step.readOnly ? "#e0e7ff" : (isApproved ? "#dcfce7" : isRejected ? "#fee2e2" : "#f3f4f6"), color: step.readOnly ? "#3730a3" : (isApproved ? "#15803d" : isRejected ? "#991b1b" : "#4b5563") }}>
            {step.readOnly ? "Info" : (isApproved ? "Approved" : isRejected ? "Rejected" : "Pending Review")}
          </span>
        </div>
      </div>

      {step.tabs && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, borderBottom: "1px solid var(--border-color)", paddingBottom: 10 }}>
          {step.tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: "8px 16px", borderRadius: 8, background: activeTab === tab.id ? "var(--wise-dark-green)" : "var(--bg-secondary)", color: activeTab === tab.id ? "white" : "var(--text-primary)", fontWeight: 800, border: "none", cursor: "pointer", transition: "0.2s" }}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: (evidence.length === 0 && !step.evidenceTitle) ? "1fr" : "1fr 1fr", gap: 24 }}>
        <div>
          <h4 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Details</h4>
          <FieldGrid fields={fields} />
        </div>
        {(evidence.length > 0 || step.evidenceTitle) && (
          <div>
            {step.evidenceTitle && (
              <h4 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{step.evidenceTitle}</h4>
            )}
            {evidence.length === 0 ? (
              <div style={{ height: "100%", minHeight: 150, border: "1px dashed var(--border-color)", borderRadius: 8, background: "var(--bg-secondary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                <AlertCircle size={28} />
                <div style={{ marginTop: 8, fontWeight: 800 }}>No document available</div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10, maxHeight: "60vh", overflowY: "auto", paddingRight: 8 }}>
                {evidence.map((item, index) => (
                  <div key={index} style={{ border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden", cursor: "pointer", position: "relative" }} onClick={() => onImageClick(item, step)}>
                    {item.label !== "" && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>
                        <strong style={{ fontSize: "0.8rem" }}>{item.label || "Evidence"}</strong>
                        <Maximize2 size={14} color="var(--text-muted)" />
                      </div>
                    )}
                    <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f9fa" }}>
                      {isPdf(item.src) ? (
                        <PdfThumbnail src={item.src} />
                      ) : (
                        <img src={item.src} alt="Evidence" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!step.readOnly && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", gap: 12 }}>
          {!showReject && (
            <button disabled={submitting || isRejected} onClick={() => setShowReject(true)} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #fecaca", background: isRejected ? "#fee2e2" : "transparent", color: isRejected ? "#991b1b" : "#b91c1c", fontWeight: 800, cursor: submitting || isRejected ? "not-allowed" : "pointer", transition: "0.2s" }}>
              {isRejected ? "Rejected" : "Reject Step"}
            </button>
          )}
          {!showReject && (
            <button disabled={submitting || isApproved} onClick={() => reviewStep(step, "approved")} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: isApproved ? "#15803d" : "#30a46c", color: "white", fontWeight: 800, cursor: submitting || isApproved ? "not-allowed" : "pointer", transition: "0.2s", boxShadow: "0 4px 12px rgba(48, 164, 108, 0.3)" }}>
              {isApproved ? "Approved" : "Approve Step"}
            </button>
          )}
        </div>
      )}
      
      {showReject && !step.readOnly && (
        <div style={{ marginTop: 16, background: "#fdf2f2", padding: 16, borderRadius: 8, border: "1px solid #fecaca" }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#991b1b" }}>Provide Rejection Reason</h4>
          <textarea className="admin-input" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection (visible in audit logs)" style={{ minHeight: 80, width: "100%", marginBottom: 12, padding: 12, borderRadius: 8, border: "1px solid #fca5a5" }} />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setShowReject(false)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ccc", background: "white", cursor: "pointer", fontWeight: 700 }}>Cancel</button>
            <button disabled={submitting || !rejectReason.trim()} onClick={() => { reviewStep(step, "rejected", rejectReason); setShowReject(false); }} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#b91c1c", color: "white", cursor: rejectReason.trim() ? "pointer" : "not-allowed", fontWeight: 700 }}>Confirm Rejection</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentReview() {
  const { id } = useParams();
  const router = useRouter();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [toast, setToast] = useState(null);
  
  const [modalState, setModalState] = useState({ isOpen: false });

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchDetail = useCallback(async () => {
    if (!id || typeof window === "undefined") return;
    try {
      const token = localStorage.getItem("agent_token");
      const response = await fetchWithFallback(`/api/admin/application/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        router.push("/agent/login");
        return;
      }

      const data = await response.json();
      if (data.success) {
        setApp(normalizeApp(data.application));
      } else {
        showToast(data.error || "Unable to load application", "error");
      }
    } catch (error) {
      console.error("Fetch failed", error);
      showToast("Network error while loading application", "error");
    } finally {
      setLoading(false);
    }
  }, [id, router, showToast]);

  useEffect(() => {
    fetchDetail();
    
    if (id) {
      const socket = io(API_BASE_URL, { withCredentials: true });
      socket.on("connect", () => socket.emit("join_application", id));
      socket.on("kyc_updated", () => fetchDetail());
      return () => socket.disconnect();
    }
  }, [fetchDetail, id]);

  const updateApplicationStatus = async (status, reason = "") => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem("agent_token");
      const response = await fetchWithFallback(`/api/admin/review/${app.applicationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, reason }),
      });
      const data = await response.json();
      if (data.success) {
        showToast(`Application ${status}`);
        await fetchDetail();
      } else {
        showToast(data.error || "Unable to update application", "error");
      }
    } catch (error) {
      showToast("Network error while updating application", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const reviewStep = async (step, status, reason = "") => {
    if (status === "rejected" && !reason.trim()) {
      showToast("Please add a rejection reason", "error");
      return;
    }
    try {
      setSubmitting(true);
      const token = localStorage.getItem("agent_token");
      const response = await fetchWithFallback(`/api/agent/kyc/${app.applicationId}/step/${step.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, reason: status === "rejected" ? reason.trim() : undefined }),
      });
      const data = await response.json();
      if (data.success) {
        showToast(status === "approved" ? `${step.title} approved` : `${step.title} rejected`, status === "approved" ? "success" : "error");
        await fetchDetail();
      } else {
        showToast(data.error || "Unable to submit review", "error");
      }
    } catch (error) {
      showToast("Network error while submitting review", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const requestModifications = async () => {
    if (!app?.applicationId) return;
    try {
      setSendingEmail(true);
      const token = localStorage.getItem("agent_token");
      const response = await fetchWithFallback(`/api/agent/kyc/${app.applicationId}/request-modifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        showToast(`Rejection email sent — ${data.message}`);
        await fetchDetail();
      } else {
        showToast(data.error || "Failed to send rejection email", "error");
      }
    } catch (error) {
      showToast("Network error while sending rejection email", "error");
    } finally {
      setSendingEmail(false);
    }
  };

  const openComparisonModal = (leftImg, leftLbl, rightImg, rightLbl, score) => {
    setModalState({ isOpen: true, leftImage: leftImg?.src || leftImg, leftLabel: leftLbl, rightImage: rightImg?.src || rightImg, rightLabel: rightLbl, matchScore: score });
  };

  const handleImageClick = (item, step) => {
    if (isPdf(item.src)) {
      openInNewTab(item.src);
      return;
    }

    if (step.id === "ipv") {
      const selfieImg = firstMedia(app.selfieDetails?.preview || app.selfieDetails?.path || app.selfie, "Live Selfie");
      const aadhaarImg = findDocument(app, ["aadhaar", "photo", "digilocker"], "Reference Photo", ["pan"]);
      openComparisonModal(selfieImg, "Live Selfie", aadhaarImg, "Aadhaar Photo", app.faceMatchScore);
    } else if (step.id === "panVerification" || step.id === "panUpload") {
      const uploadedPanImg = firstMedia(app.panUpload, "Uploaded PAN Card") || findDocument(app, ["pan"], "PAN Document", ["digilocker"]);
      const digilockerPanImg = findDocument(app, ["pan", "digilocker"], "DigiLocker PAN");
      openComparisonModal(uploadedPanImg, "Uploaded PAN", digilockerPanImg, "DigiLocker PAN", null);
    } else if (step.id === "signature") {
      const sigImg = firstMedia(app.signature, "Signature");
      const panImg = findDocument(app, ["pan", "digilocker"], "DigiLocker PAN", ["aadhaar", "photo"]) || firstMedia(app.panUpload, "Uploaded PAN Card");
      openComparisonModal(sigImg, "Wet Signature", panImg, "PAN Card", null);
    } else {
      openComparisonModal(item.src, item.label || "Document", null, "", null);
    }
  };

  if (loading) return <div className="admin-loading" style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "1.2rem", fontWeight: 800 }}>Loading Review Dashboard...</div>;
  if (!app) return <div className="admin-error" style={{ padding: 40, textAlign: "center" }}>Application not found for ID: {id}</div>;

  const statuses = getStepStatuses(app);
  const currentUserStep = Number(app.currentStep || 0);
  const isNomineeOptOut = app.nomineeDetails?.choice === "opt-out" || app.nomineeDetails?.nomineeChoice === "opt-out" || nomineeSummary(app) === "Opted out";

  const hasCompletedJourneyOnce = !!app.submittedAt || !!app.isResubmitted || !!app.rejectionReason || Object.keys(statuses).length > 0;

  const unlockedSteps = REVIEW_STEPS.filter((step) => {
    // If the application has already completed the journey once, we show all steps (ignoring currentUserStep)
    // so the agent can still review the entire application.
    if (!hasCompletedJourneyOnce && currentUserStep < step.kycIndex) return false;
    if ((step.id === "nomineeDetails" || step.id === "nomineeAllocation") && isNomineeOptOut) return false;
    if (step.id === "estampPreview" && !app.user?.eStampAssigned) return false;
    return true;
  });
  
  const reviewableSteps = unlockedSteps.filter(s => !s.readOnly);
  const approvedCount = reviewableSteps.filter((step) => statuses[step.id]?.status === "approved").length;
  const rejectedSteps = reviewableSteps.filter(step => statuses[step.id]?.status === "rejected");
  const canApproveApplication = reviewableSteps.length > 0 && approvedCount === reviewableSteps.length && currentUserStep >= 14 && app.status !== "verified" && rejectedSteps.length === 0;
  const progress = reviewableSteps.length ? Math.round((approvedCount / reviewableSteps.length) * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", padding: "24px 32px", fontFamily: "'Inter', sans-serif" }}>
      <ImageComparisonModal {...modalState} onClose={() => setModalState({ isOpen: false })} />
      
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Top Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, padding: "16px 24px", background: "white", borderRadius: 12, border: "1px solid var(--border-color)", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 8, background: "#3b82f6", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "1.2rem", boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)" }}>
              {getInitials(getApplicantName(app))}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 900, color: "var(--text-primary)" }}>{getApplicantName(app)}</h1>
                <span style={{ padding: "4px 8px", background: "#fef3c7", color: "#b45309", borderRadius: 4, fontSize: "0.65rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5 }}>Pending Review</span>
                <span style={{ padding: "4px 8px", background: "#dcfce7", color: "#15803d", borderRadius: 4, fontSize: "0.65rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5 }}>Low Risk</span>
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, marginTop: 4 }}>
                KYC-{app.applicationId.substring(0,8).toUpperCase()} • Submitted {new Date(app.submittedAt || Date.now()).toLocaleString("en-IN", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => router.push("/agent")} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid var(--border-color)", background: "white", padding: "10px 16px", borderRadius: 6, color: "var(--text-primary)", fontWeight: 700, cursor: "pointer" }}>
              <ArrowLeft size={16} /> Back
            </button>
            {rejectedSteps.length > 0 && (
              <button disabled={sendingEmail} onClick={requestModifications} style={{ padding: "10px 16px", borderRadius: 6, border: "1px solid var(--border-color)", background: "white", color: "var(--text-primary)", fontWeight: 700, cursor: sendingEmail ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <Mail size={16} /> Request Re-upload
              </button>
            )}
            {canApproveApplication && (
              <button disabled={submitting} onClick={() => updateApplicationStatus("verified")} style={{ padding: "10px 24px", borderRadius: 6, border: "none", background: "#10b981", color: "white", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer" }}>
                Approve Complete Form
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: 32, alignItems: "start" }}>
          {/* Left Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24, position: "sticky", top: 24 }}>
            {/* Personal Info Card */}
            <div style={{ background: "white", borderRadius: 12, border: "1px solid var(--border-color)", padding: "24px 24px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
              <h3 style={{ margin: "0 0 24px", fontSize: "1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                <User size={18} /> Personal Information
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <InfoField label="FULL LEGAL NAME" value={app.personalDetails?.fullName || app.personalDetails?.name} />
                <InfoField label="FATHER'S NAME" value={app.personalDetails?.fatherName} />
                <InfoField label="MOTHER'S NAME" value={app.personalDetails?.motherName} />
                <InfoField label="DATE OF BIRTH" value={app.personalDetails?.dob} />
                <InfoField label="GENDER" value={app.personalDetails?.gender} />
                <InfoField label="MARITAL STATUS" value={app.personalDetails?.maritalStatus} />
                <InfoField label="NATIONALITY" value="Indian" />
                <InfoField label="OCCUPATION" value={app.personalDetails?.occupation} />
                <InfoField label="ANNUAL INCOME" value={app.personalDetails?.annualIncome} />
                <InfoField label="SOURCE OF FUNDS" value={app.personalDetails?.sourceOfFunds || "Salary"} />
              </div>
            </div>
            
            {/* Contact & Address Card */}
            <div style={{ background: "white", borderRadius: 12, border: "1px solid var(--border-color)", padding: "24px 24px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
               <h3 style={{ margin: "0 0 24px", fontSize: "1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                <Phone size={18} /> Contact & Address
              </h3>
               <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <InfoField label="MOBILE" value={app.user?.phone} />
                <InfoField label="EMAIL" value={app.user?.email || app.personalDetails?.email} />
                <InfoField label="ADDRESS" value={typeof app.address === 'object' ? app.address?.permanentAddress || app.address?.currentAddress || app.address?.address || app.identityDetails?.address : app.address || app.identityDetails?.address} />
              </div>
            </div>
          </div>

          {/* Right Content - Verification Steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
             {unlockedSteps.map((step) => (
              <StepCard 
                key={step.id} 
                step={step} 
                app={app} 
                info={statuses[step.id] || {}} 
                submitting={submitting} 
                reviewStep={reviewStep} 
                onImageClick={handleImageClick}
              />
            ))}
            {unlockedSteps.length === 0 && (
              <div style={{ padding: 60, borderRadius: 12, textAlign: "center", background: "white", border: "1px solid var(--border-color)" }}>
                <Clock3 size={48} color="#9ca3af" style={{ marginBottom: 16 }} />
                <h2 style={{ margin: "0 0 8px", fontSize: "1.5rem", fontWeight: 800 }}>Waiting for User</h2>
                <p style={{ color: "var(--text-muted)", fontSize: "1rem" }}>The applicant has not reached a verifiable KYC step yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "white", border: `2px solid ${toast.type === "error" ? "#b91c1c" : "#30a46c"}`, color: toast.type === "error" ? "#b91c1c" : "#15803d", borderRadius: 8, padding: "14px 22px", fontWeight: 900, zIndex: 1000, boxShadow: "0 20px 40px rgba(0,0,0,0.14)", display: "flex", alignItems: "center", gap: 8 }}>
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
