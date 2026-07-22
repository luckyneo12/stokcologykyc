"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
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
  User, Phone,
  ChevronDown, ChevronRight, Edit2, Ban, Paperclip, ZoomIn, ZoomOut, RotateCw, LayoutTemplate, Download
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
  // {
  //   id: "phoneVerification",
  //   kycIndex: 1,
  //   title: "Phone Verification",
  //   evidenceTitle: "",
  //   evidenceHint: "Confirm the applicant's verified mobile number and reference their photo.",
  //   fields: (app) => [
  //     ["Mobile number", app.user?.phone, "user.phone"],
  //   ],
  //   evidence: (app) => {
  //     const doc = findDocument(app, ["aadhaar", "digilocker", "photo"], "", ["pan"]);
  //     return doc ? [{ ...doc, label: "" }] : [];
  //   },
  // },
  // {
  //   id: "emailVerification",
  //   kycIndex: 2,
  //   title: "Email Verification",
  //   evidenceTitle: "",
  //   evidenceHint: "Confirm the applicant's verified email address.",
  //   fields: (app) => [
  //     ["Email", app.personalDetails?.email || app.user?.email, "personalDetails.email"],
  //     ["Mobile number", app.user?.phone, "user.phone"],
  //   ],
  //   evidence: () => [],
  // },
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
    fields: (app) => {
      const panMatchData = app.identityDetails?.pan_verification || app.ocrData?.pan_verification?.data || app.ocrData?.pan_verification || {};
      return [
        ["PAN number", app.identityDetails?.pan || app.personalDetails?.pan, "identityDetails.pan"],
        ["Name as per PAN", app.identityDetails?.pan_name || app.identityDetails?.name || app.personalDetails?.fullName, "identityDetails.pan_name"],
        ["Date of birth", app.identityDetails?.dob || app.personalDetails?.dob, "identityDetails.dob"],
        ["PAN verified", panMatchData.status || app.identityDetails?.panVerified],
      ];
    },
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
      const dlAadhaar = app.ocrData?.digio?.DIGILOCKER?.actions?.[0]?.details?.aadhaar;
      const dlPan = app.ocrData?.digio?.DIGILOCKER?.actions?.[0]?.details?.pan;
      const panVerify = app.ocrData?.pan_verification;
      const panMatchData = app.identityDetails?.pan_verification || app.ocrData?.pan_verification?.data || app.ocrData?.pan_verification || {};

      if (tab === "pan") {
        return [
          ["Father's Name", panVerify?.data?.father_name || app.identityDetails?.pan_verification?.father_name || app.identityDetails?.pan_father_name || app.ocrData?.pan?.fatherName || app.personalDetails?.fatherName || "Not Available", "personalDetails.fatherName"],
          ["Name", app.personalDetails?.fullName || "N/A"],
          ["Pan number", app.identityDetails?.pan || app.personalDetails?.pan || "N/A"],
          ["Dob1", app.personalDetails?.dob || "N/A"],
          ["Aadhar seeding status", panMatchData.aadhaar_seeding_status || "Y"],
          ["Dob status", panMatchData.dob_match || panMatchData.date_of_birth_match ? "Y" : "N"],
          ["Name status", panMatchData.name_match || panMatchData.name_as_per_pan_match ? "Y" : "N"],
          ["Pan status", panMatchData.status === "VALID" || panMatchData.status === "valid" || app.identityDetails?.panVerified ? "True" : "False"],
        ];
      }
      return [
        ["Aadhar address", [app.address?.line1, app.address?.line2, app.address?.line3, app.address?.city, app.address?.state].filter(Boolean).join(" ") || "N/A"],
        ["Aadhar country", app.address?.country || "India"],
        ["Aadhar dist", app.address?.district || app.address?.city || "N/A"],
        ["Aadhar dob", app.personalDetails?.dob || "N/A"],
        ["Aadhar fathername", app.personalDetails?.fatherName || ""],
        ["Aadhar gender", app.personalDetails?.gender || "N/A"],
        ["Aadhar house", app.address?.line1 || "N/A"],
        ["Aadhar name", app.identityDetails?.aadhaarName || app.personalDetails?.fullName || "N/A"],
        ["Aadhar no", app.identityDetails?.aadhaar ? `xxxxxxxx${app.identityDetails.aadhaar.slice(-4)}` : "N/A"],
        ["Aadhar pincode", app.address?.pincode || "N/A"],
        ["Aadhar state", app.address?.state || "N/A"]
      ];
    },
    evidence: (app, tab = "aadhaar") => {
      return [
        findDocument(app, ["aadhaar", "digilocker", "uidai"], "Aadhaar Document", ["pan", "photo", "image"]),
        ...getAllPanDocuments(app).filter(doc => doc.label !== "Uploaded PAN Card")
      ].filter(Boolean);
    },
  },
  {
    id: "kra_fetch_new",
    kycIndex: 5.5,
    title: "kra_fetch_new",
    evidenceTitle: "KRA Details",
    evidenceHint: "Review the KRA fetched information.",
    fields: (app) => [
      ["Aadhar address", [app.address?.line1, app.address?.line2, app.address?.line3, app.address?.city, app.address?.state].filter(Boolean).join(" ") || "N/A"],
      ["Aadhar country", app.address?.country || "India"],
      ["Aadhar dist", app.address?.district || app.address?.city || "N/A"],
      ["Aadhar dob", app.personalDetails?.dob || "N/A"],
      ["Aadhar fathername", app.personalDetails?.fatherName || ""],
      ["Aadhar gender", app.personalDetails?.gender || "N/A"],
      ["Aadhar house", app.address?.line1 || "N/A"],
      ["Aadhar name", app.identityDetails?.aadhaarName || app.personalDetails?.fullName || "N/A"],
      ["Aadhar no", app.identityDetails?.aadhaar ? `xxxxxxxx${app.identityDetails.aadhaar.slice(-4)}` : "N/A"],
      ["Aadhar pincode", app.address?.pincode || "N/A"],
      ["Aadhar state", app.address?.state || "N/A"],
      ["Annual income", app.personalDetails?.annualIncome || "N/A"],
      ["Locality", app.address?.line2 || app.address?.city || "N/A"],
      ["Name", app.personalDetails?.fullName || "N/A"],
      ["Pan number", app.identityDetails?.pan || app.personalDetails?.pan || "N/A"]
    ],
    evidence: () => [],
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
      ["Clientcode", app.clientCode || "N/A"],
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
    evidence: (app) => {
      const pepProof = app.personalDetails?.pepProofPreview || app.personalDetails?.pepProof;
      return [
        findDocument(app, ["aadhaar", "digilocker", "uidai"], "Aadhaar Document", ["pan", "photo", "image"]),
        getAllPanDocuments(app).find(doc => doc.label !== "Uploaded PAN Card") || getAllPanDocuments(app)[0],
        (app.personalDetails?.politicallyExposed === "Yes" && pepProof) ? firstMedia(pepProof, "PEP Document") : null
      ].filter(Boolean);
    },
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
      ["Account holder", app.bankDetails?.beneficiaryName || app.bankDetails?.accountHolderName || "N/A"],
      ["Account number", app.bankDetails?.accountNumber || "N/A"],
      ["IFSC", app.bankDetails?.ifsc || "N/A"],
      ["Verification status", app.bankDetails?.status || app.bankDetails?.verificationStatus || (app.bankDetails?.verified ? "Verified" : "Pending")],
      ["Branchname", app.bankDetails?.branch || app.ocrData?.bank?.branch || "N/A"],
      ["Micr", app.bankDetails?.micr || app.ocrData?.bank?.micr || "N/A"],
      ["Pennydrop verify time", app.bankDetails?.verifiedAt ? new Date(app.bankDetails.verifiedAt).toLocaleString() : app.ocrData?.bank?.verifiedAt || "N/A"],
      ["Reenter account number", app.bankDetails?.accountNumber || "N/A"],
      ["Micr1", app.bankDetails?.micr || app.ocrData?.bank?.micr || "N/A"],
      // ["Bank add", app.bankDetails?.address || app.ocrData?.bank?.address || "N/A"],
      // ["Reject reason bank", app.bankDetails?.rejectReason || app.ocrData?.bank?.rejectReason || "N/A"],
      // ["Rejected by bank", app.bankDetails?.rejectedBy || app.ocrData?.bank?.rejectedBy || "N/A"],
      // ["Rejected timestamp bank", app.bankDetails?.rejectedAt ? new Date(app.bankDetails.rejectedAt).toLocaleString() : app.ocrData?.bank?.rejectedAt || "N/A"],
      ["Bankaddress", app.bankDetails?.address || app.ocrData?.bank?.address || "N/A"],
      ["Bankname", app.bankDetails?.bankName || app.ocrData?.bank?.bankName || "N/A"],
      ["Bank city", app.bankDetails?.city || app.ocrData?.bank?.city || "N/A"],
      ["Bank district", app.bankDetails?.district || app.ocrData?.bank?.district || "N/A"],
      ["Bank pincode", app.bankDetails?.pincode || app.ocrData?.bank?.pincode || "N/A"],
      ["Bank state", app.bankDetails?.state || app.ocrData?.bank?.state || "N/A"],
      ["Bank attached pan", app.identityDetails?.pan || app.personalDetails?.pan || "N/A"],
      ["Bank attached aadhar", app.identityDetails?.aadhaar ? `xxxxxxxx${app.identityDetails.aadhaar.slice(-4)}` : app.identityDetails?.uid ? `xxxxxxxx${app.identityDetails.uid.slice(-4)}` : "N/A"],
      ["Name on pan", app.identityDetails?.pan_name || app.identityDetails?.panName || app.personalDetails?.fullName || "N/A"],
      ["Name on bank", app.bankDetails?.beneficiaryName || app.bankDetails?.accountHolderName || "N/A"],
      ["Name match score", app.bankDetails?.name_match_score ? `${app.bankDetails.name_match_score}%` : app.ocrData?.bank?.name_match_score ? `${app.ocrData.bank.name_match_score}%` : "N/A"],
      ["Bank Log", JSON.stringify(app.bankDetails || {})],
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
      ["Name as per aadhar", app.identityDetails?.aadhaarName || "N/A"],
      ["Name as per pan", app.identityDetails?.panName || "N/A"],
      ["Name as per bank", app.bankDetails?.accountHolderName || "N/A"],
      ["Name as per kra", app.personalDetails?.fullName || "N/A"],
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
      ["Latitude", app.selfieDetails?.latitude || "N/A"],
      ["Location", app.selfieDetails?.location || "N/A"],
      ["Longitude", app.selfieDetails?.longitude || "N/A"],
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
      ["Certificate No", app.user?.eStampAssigned?.certificateNo, "user.eStampAssigned.certificateNo"],
      ["Serial No", app.user?.eStampAssigned?.serialNo, "user.eStampAssigned.serialNo"],
    ],
    evidence: (app) => [firstMedia(app.user?.eStampAssigned?.fileUrl, "Assigned E-Stamp")].filter(Boolean),
  },
  {
    id: "esignPreview",
    kycIndex: 16,
    title: "eSign",
    evidenceTitle: "eSigned Document",
    evidenceHint: "Review the e-signed application.",
    fields: (app) => [
      ["Email", app.personalDetails?.email || app.user?.email || "N/A", "personalDetails.email"],
      ["Mobile", app.user?.phone || "N/A", "user.phone"],
      ["Name", app.personalDetails?.fullName || "N/A", "personalDetails.fullName"],
      ["Ip", app.esignDetails?.ip || "N/A", "esignDetails.ip"],
      ["Lat", app.esignDetails?.lat || "N/A", "esignDetails.lat"],
      ["Lng", app.esignDetails?.lng || "N/A", "esignDetails.lng"],
    ],
    evidence: () => [],
  }
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
        const viewport = page.getViewport({ scale: 3.0 });
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
    const fields = [
      [`--- NOMINEE ${index + 1} ---`, " "],
      [`Nominee ${index + 1} name`, nominee.name || nominee.fullName],
      [`Nominee ${index + 1} relation`, nominee.relationship || nominee.relation],
      [`Nominee ${index + 1} DOB`, nominee.dob],
      [`Nominee ${index + 1} allocation`, `${allocation}%`],
    ];
    if (nominee.guardianName) {
      fields.push(
        [`--- GUARDIAN FOR NOMINEE ${index + 1} ---`, " "],
        [`Guardian ${index + 1} name`, nominee.guardianName],
        [`Guardian ${index + 1} DOB`, nominee.guardianDob],
        [`Guardian ${index + 1} relation`, nominee.guardianRelation],
        [`Guardian ${index + 1} mobile`, nominee.guardianMobile],
        [`Guardian ${index + 1} email`, nominee.guardianEmail],
        [`Guardian ${index + 1} address`, [nominee.guardianAddress, nominee.guardianCity, nominee.guardianState, nominee.guardianPincode].filter(Boolean).join(", ")],
        [`Guardian ${index + 1} proof type`, nominee.guardianProofType],
        [`Guardian ${index + 1} proof number`, nominee.guardianProofNumber]
      );
    }
    return fields;
  });
  
  return [...baseFields, ...detailedFields];
}

function nomineeEvidence(app) {
  const nominees = Array.isArray(app.nomineeDetails?.nominees) ? app.nomineeDetails.nominees : [];
  return nominees.map((nominee, index) => firstMedia(nominee.guardianProofPath || nominee.proofPath || nominee.proofPreview, `Nominee ${index + 1} Proof`)).filter(Boolean);
}

function allocationTotal(app) {
  const allocations = app.nomineeAllocation?.percentages || app.nomineeAllocation?.allocations || app.nomineeDetails?.allocations || [];
  if (!Array.isArray(allocations)) return "";
  const total = allocations.reduce((sum, item) => sum + (typeof item === 'object' ? Number(item.percentage || item.allocation || 0) : Number(item || 0)), 0);
  return total > 0 ? `${total}%` : "";
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

function shouldDisplayAsIframe(label) {
  if (!label) return false;
  const l = label.toLowerCase();
  return l.includes("esigned pdf") || l.includes("pep") || l.includes("f&o") || l.includes("financial");
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
      {rows.map(([label, value], i) => {
        const isShiny = label === "Certificate No" || label === "Serial No";
        const isCert = label === "Certificate No";
        const isDivider = label.startsWith("---");
        
        if (isDivider) {
          const headerText = label.replace(/-/g, "").trim();
          return (
            <div key={label + i} style={{
              gridColumn: "1 / -1",
              marginTop: i === 0 ? 0 : 16,
              marginBottom: 4,
              display: "flex",
              alignItems: "center",
              gap: 16
            }}>
              <div style={{
                fontSize: "0.85rem",
                fontWeight: 900,
                color: "var(--text-primary)",
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                whiteSpace: "nowrap"
              }}>
                {headerText}
              </div>
              <div style={{
                flex: 1,
                height: "2px",
                background: "linear-gradient(90deg, rgba(16, 185, 129, 0.7), transparent)",
                borderRadius: "2px",
                boxShadow: "0 0 8px rgba(16, 185, 129, 0.5)"
              }} />
            </div>
          );
        }

        return (
          <div key={label + i} style={{ 
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
                        color: "var(--bg-primary)", 
                        borderRadius: 999, 
                        fontSize: "0.75rem", 
                        fontWeight: 900, 
                        textTransform: "uppercase", 
                        letterSpacing: 0.5,
                        boxShadow: "0 4px 24px rgba(0,0,0,0.02)" 
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
        <div style={{ display: "grid", gridTemplateColumns: evidence.length > 1 ? "1fr 1fr" : "1fr", gap: 14 }}>
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
                background: isActive ? "#f3ffe9" : "var(--bg-primary)", 
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
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} style={{ background: "transparent", border: "none", color: "var(--bg-primary)", cursor: "pointer", padding: "8px 16px", borderRight: "1px solid rgba(255,255,255,0.2)", fontWeight: 800 }}>-</button>
          <div style={{ padding: "8px 16px", color: "var(--bg-primary)", fontWeight: 800, minWidth: 60, textAlign: "center" }}>{Math.round(zoom * 100)}%</div>
          <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} style={{ background: "transparent", border: "none", color: "var(--bg-primary)", cursor: "pointer", padding: "8px 16px", borderLeft: "1px solid rgba(255,255,255,0.2)", fontWeight: 800 }}>+</button>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--bg-primary)", cursor: "pointer", transition: "transform 0.2s" }} onMouseOver={e => e.currentTarget.style.transform="scale(1.1)"} onMouseOut={e => e.currentTarget.style.transform="scale(1)"}>
          <X size={40} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 30, height: "80%", justifyContent: "center", alignItems: "center" }}>
        <div style={{ flex: isSingle ? "none" : 1, width: isSingle ? "80%" : "auto", background: "#1a1a1a", borderRadius: 16, overflow: "hidden", border: "1px solid #333", display: "flex", flexDirection: "column", height: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}>
          <div style={{ padding: 15, background: "#2a2a2a", color: "var(--bg-primary)", fontWeight: 800, textAlign: "center", letterSpacing: 1 }}>{leftLabel}</div>
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", justifyContent: "center", alignItems: "center", padding: 20, overflow: "auto" }}>
            {leftImage ? (
              <div style={{ width: `${100 * zoom}%`, height: `${100 * zoom}%`, display: "flex", justifyContent: "center", alignItems: "center", transition: "width 0.2s, height 0.2s", minWidth: "100%", minHeight: "100%" }}>
                <img src={leftImage} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
              </div>
            ) : <div style={{color:"#666"}}>No Image Available</div>}
          </div>
        </div>
        
        {matchScore !== undefined && matchScore !== null && matchScore !== "" && !isSingle && (
          <div style={{ width: 120, height: 120, borderRadius: 60, background: matchScore >= 70 ? "#dcfce7" : "#fee2e2", border: `4px solid ${matchScore >= 70 ? "#15803d" : "#991b1b"}`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: matchScore >= 70 ? "#15803d" : "#991b1b", zIndex: 10, boxShadow: "0 4px 24px rgba(0,0,0,0.02)", flexShrink: 0 }}>
            <span style={{ fontSize: "2.2rem", fontWeight: 950 }}>{matchScore}%</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase" }}>Match</span>
          </div>
        )}

        {!isSingle && (
          <div style={{ flex: 1, background: "#1a1a1a", borderRadius: 16, overflow: "hidden", border: "1px solid #333", display: "flex", flexDirection: "column", height: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}>
            <div style={{ padding: 15, background: "#2a2a2a", color: "var(--bg-primary)", fontWeight: 800, textAlign: "center", letterSpacing: 1 }}>{rightLabel}</div>
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
    <div className="card" style={{ padding: 24, borderRadius: 12, marginBottom: 20, border: isApproved ? "2px solid #dcfce7" : isRejected ? "2px solid #fee2e2" : "1px solid var(--border-color)", background: "var(--bg-primary)", boxShadow: "0 4px 24px rgba(0,0,0,0.02)", transition: "all 0.3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ width: 28, height: 28, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: isApproved ? "#15803d" : isRejected ? "#b91c1c" : "#f3f4f6", color: isApproved || isRejected ? "var(--bg-primary)" : "var(--text-muted)", fontWeight: 900, fontSize: "0.9rem" }}>
              {isApproved ? <CheckCircle2 size={16} /> : isRejected ? <XCircle size={16} /> : step.kycIndex}
            </span>
            <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 900, color: "var(--text-primary)" }}>{step.title}</h2>
          </div>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem", fontWeight: 600 }}>{step.evidenceHint}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ padding: "6px 12px", borderRadius: 20, fontSize: "0.8rem", fontWeight: 800, background: step.readOnly ? "#e0e7ff" : (isApproved ? "#dcfce7" : isRejected ? "#fee2e2" : "#f3f4f6"), color: step.readOnly ? "#3730a3" : (isApproved ? "#15803d" : isRejected ? "#991b1b" : "var(--text-muted)") }}>
            {step.readOnly ? "Info" : (isApproved ? "Approved" : isRejected ? "Rejected" : "Pending Review")}
          </span>
        </div>
      </div>

      {step.tabs && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, borderBottom: "1px solid var(--border-color)", paddingBottom: 10 }}>
          {step.tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: "8px 16px", borderRadius: 8, background: activeTab === tab.id ? "var(--wise-dark-green)" : "var(--bg-secondary)", color: activeTab === tab.id ? "var(--bg-primary)" : "var(--text-primary)", fontWeight: 800, border: "none", cursor: "pointer", transition: "0.2s" }}>
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
              <div style={{ display: "grid", gridTemplateColumns: evidence.length > 1 ? "1fr 1fr" : "1fr", gap: 10, maxHeight: "60vh", overflowY: "auto", paddingRight: 8 }}>
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
            <button disabled={submitting || isApproved} onClick={() => reviewStep(step, "approved")} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: isApproved ? "#15803d" : "#30a46c", color: "var(--bg-primary)", fontWeight: 800, cursor: submitting || isApproved ? "not-allowed" : "pointer", transition: "0.2s", boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}>
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
            <button onClick={() => setShowReject(false)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ccc", background: "var(--bg-primary)", cursor: "pointer", fontWeight: 700 }}>Cancel</button>
            <button disabled={submitting || !rejectReason.trim()} onClick={() => { reviewStep(step, "rejected", rejectReason); setShowReject(false); }} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#b91c1c", color: "var(--bg-primary)", cursor: rejectReason.trim() ? "pointer" : "not-allowed", fontWeight: 700 }}>Confirm Rejection</button>
          </div>
        </div>
      )}
    </div>
  );
}

function IndependentImageViewer({ src, defaultZoom = 1, defaultOffset = { x: 0, y: 0 }, label }) {
  const [zoom, setZoom] = useState(defaultZoom);
  const [offset, setOffset] = useState(defaultOffset);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  return (
    <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f3f4f6" }}>
      {isPdf(src) && shouldDisplayAsIframe(label) ? (
        <object data={`/api/pdf-proxy?url=${encodeURIComponent(src)}`} type="application/pdf" style={{ flex: 1, width: "100%", height: "100%", border: "none" }}>
          <embed src={`/api/pdf-proxy?url=${encodeURIComponent(src)}`} type="application/pdf" style={{ width: "100%", height: "100%" }} />
        </object>
      ) : (
        <div 
          style={{ flex: 1, position: "relative", overflow: "hidden", cursor: isDragging ? "grabbing" : "grab", userSelect: "none" }}
          onWheel={(e) => {
            if (e.deltaY < 0) {
              setZoom(Math.min(5, zoom + 0.1));
            } else {
              const newZoom = Math.max(0.2, zoom - 0.1);
              setZoom(newZoom);
              if (newZoom <= 1) {
                setOffset({ x: 0, y: 0 });
              }
            }
          }}
          onMouseDown={(e) => {
            if (zoom > 1) {
              setIsDragging(true);
              setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
            }
          }}
          onMouseMove={(e) => {
            if (isDragging && zoom > 1) {
              setOffset({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
              });
            }
          }}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
        >
          <div style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`, 
            transition: isDragging ? "none" : "transform 0.2s ease",
            height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none"
          }}>
            {isPdf(src) ? <PdfThumbnail src={src} /> : <img src={src} alt="Preview" style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain", borderRadius: 4 }} />}
          </div>
        </div>
      )}
      {!(isPdf(src) && shouldDisplayAsIframe(label)) && (
        <div style={{ position: "absolute", bottom: 12, right: 12, display: "flex", gap: 6, background: "var(--bg-primary)", padding: "4px 8px", borderRadius: 20, boxShadow: "0 4px 24px rgba(0,0,0,0.02)", border: "1px solid var(--border-color)", zIndex: 10 }}>
          <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }} title="Zoom Out"><ZoomOut size={14} /></button>
          <button onClick={() => setZoom(Math.min(3, zoom + 0.25))} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }} title="Zoom In"><ZoomIn size={14} /></button>
          <div style={{ width: 1, background: "var(--border-color)", margin: "0 2px" }} />
          <button onClick={() => setRotation(r => r + 90)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }} title="Rotate"><RotateCw size={14} /></button>
          <div style={{ width: 1, background: "var(--border-color)", margin: "0 2px" }} />
          <button onClick={(e) => {
            e.stopPropagation();
            const link = document.createElement('a');
            link.href = src;
            link.target = '_blank';
            link.download = 'document';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }} title="Download"><Download size={14} /></button>
        </div>
      )}
    </div>
  );
}

export default function AgentReview() {
  const params = useParams();
  const id = params?.id;
  const router = useRouter();

  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visitedSteps, setVisitedSteps] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [expandedModule, setExpandedModule] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewRotation, setPreviewRotation] = useState(0);
  const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [editValues, setEditValues] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [showGlobalReject, setShowGlobalReject] = useState(false);
  const [globalRejectReason, setGlobalRejectReason] = useState("");
  const [rejectStepModal, setRejectStepModal] = useState(null);
  const [stepRejectReason, setStepRejectReason] = useState("");
  const fileInputRef = useRef(null);

  const handleZoomChange = useCallback((newZoomVal) => {
    setPreviewZoom(newZoomVal);
    if (newZoomVal <= 1) {
      setPreviewOffset({ x: 0, y: 0 });
    }
  }, []);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchDetail = useCallback(async () => {
    if (!id || typeof window === "undefined") return;
    try {
      const token = localStorage.getItem("globeToken");
      const response = await fetchWithFallback(`/api/globe/application/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        router.push("/globe/login");
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

  useEffect(() => {
    if (id) {
      const stored = localStorage.getItem(`visitedSteps_${id}`);
      if (stored) {
        try {
          setVisitedSteps(new Set(JSON.parse(stored)));
        } catch (e) {
          console.error("Failed to parse visited steps", e);
        }
      }
    }
  }, [id]);

  useEffect(() => {
    if (id && visitedSteps.size > 0) {
      localStorage.setItem(`visitedSteps_${id}`, JSON.stringify(Array.from(visitedSteps)));
    }
  }, [visitedSteps, id]);

  const handleSaveDetails = async (requireEsign = false) => {
    if (Object.keys(editValues).length === 0) {
      showToast("No changes to save.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem("globeToken");
      const res = await fetchWithFallback(`/api/globe/application/${id}/update-details`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ updates: editValues, requireEsign }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(requireEsign ? "Details updated and re-signing requested." : "Details updated successfully.");
        setEditValues({});
        setEditingField(null);
        fetchDetail();
      } else {
        showToast(data.error || "Failed to update details.", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Network error while saving details.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendRejectionMail = async () => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem("globeToken");
      const res = await fetchWithFallback(`/api/globe/application/${id}/request-modifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        showToast("Rejection email sent and application returned to user.");
        fetchDetail();
      } else {
        showToast(data.error || "Failed to send rejection email.", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Network error while rejecting.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGlobalReject = async () => {
    if (!globalRejectReason.trim()) {
      showToast("Rejection reason is required.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem("globeToken");
      const res = await fetchWithFallback(`/api/globe/kycs/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ remarks: globalRejectReason }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Application rejected.");
        setShowGlobalReject(false);
        fetchDetail();
      } else {
        showToast(data.error || "Failed to reject application.", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Network error while rejecting.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGlobalApprove = async () => {
    const currentStatuses = getStepStatuses(app);
    const hasRejectedStep = Object.values(currentStatuses).some(s => s?.status === "rejected");
    if (hasRejectedStep) {
       showToast("Cannot approve: Some documents or steps are marked as rejected.", "error");
       return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("globeToken");
      const res = await fetchWithFallback(`/api/globe/kycs/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ remarks: "" }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Application approved successfully.");
        fetchDetail();
        // Optionally redirect back after a delay
        setTimeout(() => router.push("/globe"), 1500);
      } else {
        showToast(data.error || "Failed to approve application.", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Network error while approving.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectStep = async () => {
    if (!stepRejectReason.trim()) {
      showToast("Rejection reason is required.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem("globeToken");
      const res = await fetchWithFallback(`/api/globe/kyc/${id}/step/${rejectStepModal.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "rejected", reason: stepRejectReason }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Step ${rejectStepModal.title} rejected.`, "error");
        setRejectStepModal(null);
        setStepRejectReason("");
        fetchDetail();
      } else {
        showToast(data.error || "Failed to reject step.", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Network error while rejecting step.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnrejectStep = async (stepId, stepTitle) => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem("globeToken");
      const res = await fetchWithFallback(`/api/globe/kyc/${id}/step/${stepId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "pending", reason: "" }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Rejection removed for ${stepTitle}.`, "success");
        fetchDetail();
      } else {
        showToast(data.error || "Failed to remove rejection.", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Network error while removing rejection.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedDocument) {
      showToast("Please select a document type to replace first", "error");
      return;
    }
    
    const formData = new FormData();
    formData.append("document", file);
    formData.append("documentType", selectedDocument.label || selectedDocument.type || "Document");

    setSubmitting(true);
    try {
      const token = localStorage.getItem("globeToken");
      const res = await fetchWithFallback(`/api/globe/application/${id}/upload-document`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }, // Do not set Content-Type, browser will set it with boundary
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        showToast("Document replaced successfully");
        fetchDetail();
      } else {
        showToast(data.error || "Failed to upload document", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Network error while uploading", "error");
    } finally {
      setSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Collect all documents accurately from the application payload
  const allDocuments = useMemo(() => {
    if (!app) return [];
    const docs = [];
    
    const pushDoc = (doc, stepKey) => {
      if (doc && doc.src && !docs.some(d => d.src === doc.src)) {
        docs.push({ ...doc, stepKey });
      }
    };

    // Aadhaar Documents
    pushDoc(findDocument(app, ["aadhaar", "digilocker", "uidai"], "Aadhaar Document", ["pan", "photo", "image"]), "digilocker");
    pushDoc(findDocument(app, ["aadhaar", "digilocker", "photo"], "Aadhaar Image", ["pan", "pdf"]), "digilocker");

    // PAN Documents
    const panDocs = getAllPanDocuments(app);
    panDocs.forEach(doc => pushDoc(doc, "panUpload"));

    // eSigned PDF
    let esignDoc = null;
    try {
      const docs = Array.isArray(app.documents) ? app.documents : (app.documents ? JSON.parse(app.documents) : []);
      esignDoc = docs.find(doc => doc.type === "ESIGN" || (doc.type === "DIGILOCKER_DOCUMENT" && doc.path?.includes("digio_")));
    } catch(e) {}
    
    if (esignDoc) {
      pushDoc(firstMedia(esignDoc.path, "eSigned PDF"), "aadhaarEsign");
    } else if (app.generatedPdfBase64) {
      pushDoc(firstMedia(app.generatedPdfBase64, "eSigned PDF (Unsigned)"), "aadhaarEsign");
    }

    // PEP Document
    const pepProof = app.personalDetails?.pepProofPreview || app.personalDetails?.pepProof;
    if (pepProof) pushDoc(firstMedia(pepProof, "PEP Document"), "personalDetails");

    // Nominee Documents
    const nominees = Array.isArray(app.nomineeDetails?.nominees) ? app.nomineeDetails.nominees : [];
    nominees.forEach((nominee, i) => {
      pushDoc(firstMedia(nominee.proofPath || nominee.proofPreview || nominee.proof, `Nominee ${i + 1} Document`), "nomineeDetails");
      if (nominee.guardianProofPath || nominee.guardianProofPreview || nominee.guardianProof) {
        pushDoc(firstMedia(nominee.guardianProofPath || nominee.guardianProofPreview || nominee.guardianProof, `Nominee ${i + 1} Guardian Document`), "nomineeDetails");
      }
    });

    // F&O / Financial Proof
    if (app.financialProof) pushDoc(firstMedia(app.financialProof, "F&O Document"), "financialProof");

    // Bank Proof
    pushDoc(firstMedia(app.bankDetails?.proofPreview || app.bankDetails?.proofPath || app.bankDetails?.proof, "Bank Proof"), "bankVerification");

    // Signature
    if (app.signature) pushDoc(firstMedia(app.signature, "Signature"), "signature");

    // Live Selfie
    const selfie = app.selfieDetails?.preview || app.selfieDetails?.path || app.selfie;
    if (selfie) pushDoc(firstMedia(selfie, "Live Selfie"), "ipv");

    // Assigned E-Stamp
    if (app.user?.eStampAssigned?.fileUrl) {
      pushDoc(firstMedia(app.user.eStampAssigned.fileUrl, "Assigned E-Stamp"), "esignPreview");
    }

    return docs;
  }, [app]);
  if (loading) return <div className="admin-loading" style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "1.2rem", fontWeight: 800 }}>Loading Review Dashboard...</div>;
  if (!app) return <div className="admin-error" style={{ padding: 40, textAlign: "center" }}>Application not found for ID: {id}</div>;

  const statuses = getStepStatuses(app);
  const currentUserStep = Number(app.currentStep || 0);
  const isNomineeOptOut = app.nomineeDetails?.choice === "opt-out" || app.nomineeDetails?.nomineeChoice === "opt-out" || nomineeSummary(app) === "Opted out";
  const hasCompletedJourneyOnce = !!app.submittedAt || !!app.isResubmitted || !!app.rejectionReason || Object.keys(statuses).length > 0;

  const unlockedSteps = REVIEW_STEPS.filter((step) => {
    if (!hasCompletedJourneyOnce && currentUserStep < step.kycIndex) return false;
    if ((step.id === "nomineeDetails" || step.id === "nomineeAllocation") && isNomineeOptOut) return false;
    if (step.id === "estampPreview" && !app.user?.eStampAssigned) return false;
    return true;
  });

  const handleModuleClick = (step) => {
    setVisitedSteps(prev => new Set(prev).add(step.id));
    if (expandedModule === step.id) {
      setExpandedModule(null);
    } else {
      setExpandedModule(step.id);
      // Auto-select first document related to this step
      const activeTab = step.tabs ? step.tabs[0].id : null;
      const stepDocs = step.evidence(app, activeTab);
      if (stepDocs && stepDocs.length > 0) {
        setSelectedDocument({ ...stepDocs[0], stepKey: step.id, isModuleView: true });
        setPreviewZoom(1);
        setPreviewRotation(0);
        setPreviewOffset({ x: 0, y: 0 });
      }
    }
  };

  const handleDocumentClick = (doc) => {
    setSelectedDocument({ ...doc, isModuleView: false });
    setPreviewZoom(1);
    setPreviewRotation(0);
    setPreviewOffset({ x: 0, y: 0 });
  };

  const formatDateToYMDHMS = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden", background: "var(--bg-secondary)" }}>
      <div style={{ 
        display: "flex", 
        width: "125%",
        height: "125%",
        minWidth: "125%",
        minHeight: "125%",
        flexShrink: 0,
        transform: "scale(0.8)",
        transformOrigin: "top left"
      }}>
      <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 16 }}><button onClick={() => router.push('/globe')} style={{ padding: '8px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>← Back to Globe</button></div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%", background: "var(--bg-secondary)", overflow: "hidden", fontFamily: "'Inter', sans-serif" }}>
      {/* Top Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", background: "var(--bg-primary)", borderBottom: "1px solid var(--border-color)", boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--wise-green)", color: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "0.9rem" }}>
            {getInitials(getApplicantName(app))}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>{getApplicantName(app)}</h1>
              <span style={{ padding: "2px 6px", background: "#fef3c7", color: "#b45309", borderRadius: 4, fontSize: "0.65rem", fontWeight: "bold", textTransform: "uppercase" }}>Pending Review</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 2 }}>
              <div style={{ fontSize: "0.85rem", color: "var(--wise-green)", fontWeight: "bold", letterSpacing: "0.5px" }}>
                {app.applicationId}
              </div>
              {app.user?.eStampAssigned?.certificateNo && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4, display: "flex", gap: 12 }}>
                  <span><strong style={{ color: "var(--text-primary)" }}>Cert No:</strong> {app.user.eStampAssigned.certificateNo}</span>
                  {app.user.eStampAssigned.serialNo && (
                    <span><strong style={{ color: "var(--text-primary)" }}>Serial No:</strong> {app.user.eStampAssigned.serialNo}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
             <span style={{ fontSize: "0.85rem", color: "var(--wise-dark-green)", fontWeight: "bold", letterSpacing: "0.5px" }}>{formatDateToYMDHMS(app.updatedAt)}</span>
             <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "500", marginTop: 2 }}>Updated At</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
             <span style={{ fontSize: "0.85rem", color: "var(--wise-dark-green)", fontWeight: "bold", letterSpacing: "0.5px" }}>{formatDateToYMDHMS(app.submittedAt || app.createdAt)}</span>
             <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "500", marginTop: 2 }}>Date of KYC</span>
          </div>
          <button onClick={handleGlobalApprove} disabled={submitting} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: "0.8rem", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={14} /> Approve KYC
          </button>
          <button onClick={handleSendRejectionMail} disabled={submitting} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #fecaca", background: "#fef2f2", color: "#ef4444", fontWeight: 600, fontSize: "0.8rem", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}>
            <Mail size={14} /> Send Rejection Mail
          </button>
          <button onClick={() => router.push("/globe")} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={14} /> Back
          </button>
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        
        {/* Left Column: Modules */}
        <div style={{ width: "30%", background: "var(--bg-primary)", borderRight: "1px solid var(--border-color)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", background: "linear-gradient(to bottom, var(--bg-primary), var(--bg-secondary))", borderBottom: "1px solid var(--border-color)", boxShadow: "0 4px 24px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <LayoutTemplate size={16} color="var(--text-primary)" />
            <span style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "1px" }}>Modules</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {unlockedSteps.map((step) => {
              const isExpanded = expandedModule === step.id;
              const activeTab = step.tabs ? step.tabs[0].id : null;
              const fields = step.fields(app, activeTab).filter(([, value]) => value !== undefined && value !== null && value !== "");
              const isRejected = statuses[step.id]?.status === "rejected";
              const isModified = isRejected && app.isResubmitted;
              const displayAsRejected = isRejected && !app.isResubmitted;

              return (
                <div key={step.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <div 
                    onClick={() => handleModuleClick(step)}
                    style={{ 
                      padding: "8px 16px", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between", 
                      cursor: "pointer", 
                      background: isExpanded ? "var(--bg-secondary)" : "var(--bg-primary)",
                      transition: "background 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: displayAsRejected ? "#dc2626" : isModified ? "#ca8a04" : "var(--text-primary)", fontWeight: 500, fontSize: "0.8rem" }}>
                      {step.title}
                      {displayAsRejected && (
                        <span 
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (isRejected) handleUnrejectStep(step.id, step.title);
                          }}
                          style={{ cursor: "context-menu", padding: "2px 6px", background: "#fef2f2", color: "#dc2626", fontSize: "0.6rem", borderRadius: 4, fontWeight: "bold", border: "1px solid #fecaca" }}
                          title="Right-click to Undo Rejection"
                        >
                          REJECTED
                        </span>
                      )}
                      {isModified && (
                        <span 
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (isRejected) handleUnrejectStep(step.id, step.title);
                          }}
                          style={{ cursor: "context-menu", padding: "2px 6px", background: "#fefce8", color: "#ca8a04", fontSize: "0.6rem", borderRadius: 4, fontWeight: "bold", border: "1px solid #fef08a" }}
                          title="Right-click to Undo Rejection"
                        >
                          MODIFIED
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {isExpanded ? <ChevronDown size={18} color="var(--text-muted)" /> : <ChevronRight size={18} color="var(--text-muted)" />}
                      <span 
                        onClick={(e) => { e.stopPropagation(); setRejectStepModal(step); setStepRejectReason(""); }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isRejected) {
                            handleUnrejectStep(step.id, step.title);
                          }
                        }}
                      >
                        {visitedSteps.has(step.id) && !isRejected ? (
                          <CheckCircle2 size={16} color="#16a34a" style={{ cursor: "pointer" }} title="Visited (Click to Reject)" />
                        ) : (
                          <Ban size={16} color={displayAsRejected ? "#dc2626" : isModified ? "#ca8a04" : "#ef4444"} style={{ cursor: "pointer", opacity: (displayAsRejected || isModified) ? 1 : 0.6 }} title={displayAsRejected ? "Rejected (Right-click to Undo)" : isModified ? "Modified (Right-click to Undo)" : "Reject Step"} />
                        )}
                      </span>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div style={{ padding: "10px 16px", background: "var(--bg-secondary)" }}>
                      {(step.tabs || [{ id: null, label: null }]).map((tab, tabIndex) => {
                        const tabFields = step.fields(app, tab.id).filter(([, value]) => {
                          if (value === undefined || value === null || value === "") return false;
                          const str = String(value).trim();
                          if (str === "N/A" || str === "--select--") return false;
                          return true;
                        });
                        
                        if (isRejected && statuses[step.id]?.reason && (!step.tabs || tabIndex === step.tabs.length - 1)) {
                          tabFields.push(
                            [`--- REJECTION DETAILS ---`, " "],
                            [`Reject Reason ${step.title}`, statuses[step.id].reason],
                            [`Rejected Timestamp ${step.title}`, statuses[step.id].reviewedAt ? new Date(statuses[step.id].reviewedAt).toLocaleString() : "N/A"]
                          );
                        }

                        if (tabFields.length === 0) {
                          if (step.tabs) return null;
                          return <div key="empty" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>No details available.</div>;
                        }
                        return (
                          <div key={tab.id || "default"} style={{ marginBottom: step.tabs && tabIndex < step.tabs.length - 1 ? 16 : 0 }}>
                            {tab.label && (
                              <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 8, textTransform: "uppercase", borderBottom: "1px solid var(--border-color)", paddingBottom: 4 }}>
                                {tab.label}
                              </div>
                            )}
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {tabFields.map(([label, value, jsonPath]) => {
                                const isDivider = label.startsWith("---");
                                if (isDivider) {
                                  const headerText = label.replace(/-/g, "").trim();
                                  return (
                                    <div key={label} style={{
                                      marginTop: 12,
                                      marginBottom: 4,
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 16
                                    }}>
                                      <div style={{
                                        fontSize: "0.75rem",
                                        fontWeight: 900,
                                        color: "var(--text-primary)",
                                        letterSpacing: "1px",
                                        textTransform: "uppercase",
                                        whiteSpace: "nowrap"
                                      }}>
                                        {headerText}
                                      </div>
                                      <div style={{
                                        flex: 1,
                                        height: "2px",
                                        background: "linear-gradient(90deg, rgba(16, 185, 129, 0.7), transparent)",
                                        boxShadow: "0 0 8px rgba(16, 185, 129, 0.5)"
                                      }} />
                                    </div>
                                  );
                                }

                                const currentValue = jsonPath && editValues[jsonPath] !== undefined ? editValues[jsonPath] : value;
                                return (
                                  <div key={label} style={{ 
                                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, 
                                    padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: "10px", 
                                    border: "1px solid var(--border-color)", boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
                                  }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                                      {editingField === jsonPath && jsonPath ? (
                                        <input 
                                          autoFocus
                                          className="admin-input"
                                          style={{ fontSize: "0.8rem", width: "100%", padding: "4px 8px", marginTop: 4, borderRadius: 4, border: "1px solid var(--border-color)" }}
                                          value={currentValue || ""}
                                          onChange={e => setEditValues({ ...editValues, [jsonPath]: e.target.value })}
                                          onBlur={() => setEditingField(null)}
                                          onKeyDown={e => { if (e.key === "Enter") setEditingField(null); }}
                                        />
                                      ) : (
                                        <div style={{ fontSize: "0.8rem", color: "var(--text-primary)", wordBreak: "break-word", fontWeight: 500, minHeight: 18 }}>
                                          {label === "Segments" && typeof currentValue === "string" 
                                            ? currentValue.split(",").join(", ") 
                                            : (currentValue !== undefined && currentValue !== null ? String(currentValue) : "")
                                          }
                                        </div>
                                      )}
                                    </div>
                                    {jsonPath && (
                                      <Edit2 onClick={() => setEditingField(jsonPath)} size={14} color="var(--text-muted)" style={{ cursor: "pointer", marginTop: 14 }} />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Middle Column: Documents */}
        <div style={{ width: "25%", background: "var(--bg-primary)", borderRight: "1px solid var(--border-color)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", background: "linear-gradient(to bottom, var(--bg-primary), var(--bg-secondary))", borderBottom: "1px solid var(--border-color)", boxShadow: "0 4px 24px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <FileText size={16} color="var(--text-primary)" />
            <span style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "1px" }}>Documents</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {allDocuments.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>No documents available.</div>
            ) : (
              allDocuments.map((doc, idx) => {
                const isSelected = selectedDocument?.src === doc.src;
                return (
                  <div 
                    key={idx}
                    onClick={() => handleDocumentClick(doc)}
                    style={{ 
                      padding: "8px 16px", 
                      borderBottom: "1px solid var(--border-color)", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      cursor: "pointer",
                      background: isSelected ? "var(--bg-secondary)" : "var(--bg-primary)",
                      color: isSelected ? "#16a34a" : "var(--text-primary)",
                      transition: "background 0.2s"
                    }}
                  >
                    <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>{doc.label || "Document"}</span>
                    <Paperclip size={14} color={isSelected ? "#16a34a" : "var(--text-muted)"} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Preview */}
        <div style={{ flex: 1, background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 16px", background: "linear-gradient(to bottom, var(--bg-primary), var(--bg-secondary))", borderBottom: "1px solid var(--border-color)", boxShadow: "0 4px 24px rgba(0,0,0,0.02)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Maximize2 size={16} color="var(--text-primary)" />
              <span style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "1px" }}>Preview</span>
            </div>
            <button style={{ padding: "6px 14px", background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: "0.7rem", fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 24px rgba(0,0,0,0.02)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Auto Match
            </button>
          </div>
          
          <div 
            style={{ 
              flex: 1, 
              position: "relative", 
              display: "flex", 
              flexDirection: "column", 
              background: "#f3f4f6", 
              overflow: "hidden",
              cursor: isDragging ? "grabbing" : "grab",
              userSelect: "none"
            }}
            onWheel={(e) => {
              if (selectedDocument) {
                if (e.deltaY < 0) {
                  handleZoomChange(Math.min(5, previewZoom + 0.1));
                } else {
                  handleZoomChange(Math.max(0.2, previewZoom - 0.1));
                }
              }
            }}
            onMouseDown={(e) => {
              if (selectedDocument && previewZoom > 1) {
                setIsDragging(true);
                setDragStart({ x: e.clientX - previewOffset.x, y: e.clientY - previewOffset.y });
              }
            }}
            onMouseMove={(e) => {
              if (isDragging && selectedDocument && previewZoom > 1) {
                setPreviewOffset({
                  x: e.clientX - dragStart.x,
                  y: e.clientY - dragStart.y
                });
              }
            }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
          >
            {!selectedDocument ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                 <FileText size={64} style={{ opacity: 0.5, marginBottom: 16 }} />
                 <span style={{ fontWeight: 600, fontSize: "1.1rem" }}>NO DOCUMENT</span>
                 <span style={{ fontSize: "0.9rem" }}>uploaded</span>
              </div>
            ) : selectedDocument.isModuleView === true && (selectedDocument.stepKey === "panUpload" || selectedDocument.stepKey === "signature" || selectedDocument.stepKey === "ipv" || selectedDocument.stepKey === "digilocker" || selectedDocument.stepKey === "personalDetails") && REVIEW_STEPS.find(s => s.id === selectedDocument.stepKey).evidence(app).length > 1 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "row", gap: 16, padding: 16, overflow: "hidden" }}>
                {REVIEW_STEPS.find(s => s.id === selectedDocument.stepKey).evidence(app).map((doc, idx) => (
                  <div key={`${selectedDocument.stepKey}-${idx}`} style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-primary)", borderRadius: 8, border: "1px solid var(--border-color)", overflow: "hidden" }}>
                    <div style={{ padding: "8px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)", fontSize: "0.75rem", fontWeight: 700, textAlign: "center", color: "var(--text-primary)" }}>
                      {doc.label || "Document"}
                    </div>
                    <IndependentImageViewer src={doc.src} defaultZoom={doc.defaultZoom} defaultOffset={doc.defaultOffset} label={doc.label} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden" }}>
                {isPdf(selectedDocument.src) && shouldDisplayAsIframe(selectedDocument.label) ? (
                  <object 
                    data={`/api/pdf-proxy?url=${encodeURIComponent(selectedDocument.src)}`} 
                    type="application/pdf"
                    style={{ width: "100%", height: "100%", border: "none", borderRadius: 4 }} 
                  >
                    <embed src={`/api/pdf-proxy?url=${encodeURIComponent(selectedDocument.src)}`} type="application/pdf" style={{ width: "100%", height: "100%" }} />
                  </object>
                ) : (
                  <div style={{ 
                    transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${previewZoom}) rotate(${previewRotation}deg)`, 
                    transition: isDragging ? "none" : "transform 0.2s ease",
                    maxHeight: "100%",
                    maxWidth: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none"
                  }}>
                    {isPdf(selectedDocument.src) ? (
                      <PdfThumbnail src={selectedDocument.src} />
                    ) : (
                      <img 
                        src={selectedDocument.src} 
                        alt="Preview" 
                        draggable={false}
                        style={{ maxHeight: "70vh", maxWidth: "100%", objectFit: "contain", borderRadius: 4, boxShadow: "0 4px 24px rgba(0,0,0,0.02)", userSelect: "none" }} 
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedDocument && (
               <div style={{ position: "absolute", bottom: 24, right: 24, display: "flex", gap: 8, background: "var(--bg-primary)", padding: "8px 12px", borderRadius: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.02)", border: "1px solid var(--border-color)" }}>
                  <button onClick={() => handleZoomChange(Math.max(0.5, previewZoom - 0.25))} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }} title="Zoom Out"><ZoomOut size={18} /></button>
                  <button onClick={() => handleZoomChange(Math.min(3, previewZoom + 0.25))} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }} title="Zoom In"><ZoomIn size={18} /></button>
                  <div style={{ width: 1, background: "var(--border-color)", margin: "0 4px" }} />
                  <button onClick={() => setPreviewRotation(r => r + 90)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }} title="Rotate"><RotateCw size={18} /></button>
                  <div style={{ width: 1, background: "var(--border-color)", margin: "0 4px" }} />
                  <button onClick={(e) => {
                    e.stopPropagation();
                    const link = document.createElement('a');
                    link.href = selectedDocument.src;
                    link.target = '_blank';
                    link.download = 'document';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }} title="Download"><Download size={18} /></button>
                  <div style={{ width: 1, background: "var(--border-color)", margin: "0 4px" }} />
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "flex", alignItems: "center" }}>{Math.round(previewZoom * 100)}%</span>
               </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div style={{ padding: "10px 20px", background: "var(--bg-primary)", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 10 }}>
               <button onClick={() => {
                  const docMapping = {
                    "Uploaded PAN Card": "panUpload",
                    "Aadhaar Document": "digilocker",
                    "Aadhaar Image": "digilocker",
                    "DigiLocker PAN": "panUpload",
                    "eSigned PDF": "aadhaarEsign",
                    "PEP Document": "personalDetails",
                    "Bank Proof": "bankVerification",
                    "F&O Document": "financialProof",
                    "Signature": "signature",
                    "Live Selfie": "ipv",
                    "Assigned E-Stamp": "esignPreview"
                  };
                  const finalId = selectedDocument.stepKey || docMapping[selectedDocument.label] || selectedDocument.label;
                  setRejectStepModal({ id: finalId, title: selectedDocument.label });
               }} disabled={submitting || !selectedDocument} style={{ padding: "6px 12px", fontSize: "0.8rem", color: "#ef4444", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontWeight: 600, cursor: submitting || !selectedDocument ? "not-allowed" : "pointer", opacity: submitting || !selectedDocument ? 0.6 : 1 }}>
                  Reject
               </button>
               <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleUploadFile} accept="image/*,application/pdf" />
               <button onClick={() => fileInputRef.current?.click()} disabled={submitting || !selectedDocument} style={{ padding: "6px 12px", fontSize: "0.8rem", color: "#16a34a", background: "var(--bg-secondary)", border: "1px solid #bbf7d0", borderRadius: 6, fontWeight: 600, cursor: submitting || !selectedDocument ? "not-allowed" : "pointer", opacity: submitting || !selectedDocument ? 0.6 : 1 }}>
                  Upload File
               </button>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
               <button onClick={() => handleSaveDetails(false)} disabled={submitting || Object.keys(editValues).length === 0} style={{ padding: "6px 16px", fontSize: "0.8rem", color: "var(--text-primary)", background: "#f3f4f6", border: "1px solid var(--border-color)", borderRadius: 6, fontWeight: 600, cursor: submitting || Object.keys(editValues).length === 0 ? "not-allowed" : "pointer", opacity: submitting || Object.keys(editValues).length === 0 ? 0.6 : 1 }}>
                  Save
               </button>
               <button onClick={() => handleSaveDetails(true)} disabled={submitting || Object.keys(editValues).length === 0} style={{ padding: "6px 16px", fontSize: "0.8rem", color: "var(--bg-primary)", background: "#16a34a", border: "none", borderRadius: 6, fontWeight: 600, cursor: submitting || Object.keys(editValues).length === 0 ? "not-allowed" : "pointer", boxShadow: "0 4px 24px rgba(0,0,0,0.02)", opacity: submitting || Object.keys(editValues).length === 0 ? 0.6 : 1 }}>
                  Save & Generate PDF
               </button>
            </div>
          </div>

        </div>
      </div>

      {showGlobalReject && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--bg-primary)", padding: 24, borderRadius: 12, width: 400, maxWidth: "90%", boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}>
            <h3 style={{ margin: "0 0 16px 0", color: "var(--text-primary)" }}>Reject Application</h3>
            <textarea
              className="admin-input"
              autoFocus
              placeholder="Provide a reason for rejecting the application..."
              value={globalRejectReason}
              onChange={e => setGlobalRejectReason(e.target.value)}
              style={{ width: "100%", minHeight: 100, padding: 12, borderRadius: 8, border: "1px solid var(--border-color)", marginBottom: 16 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button onClick={() => setShowGlobalReject(false)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-primary)", fontWeight: 600, cursor: "pointer", color: "var(--text-primary)" }}>
                Cancel
              </button>
              <button onClick={handleGlobalReject} disabled={submitting || !globalRejectReason.trim()} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#ef4444", color: "var(--bg-primary)", fontWeight: 600, cursor: submitting || !globalRejectReason.trim() ? "not-allowed" : "pointer", opacity: submitting || !globalRejectReason.trim() ? 0.6 : 1 }}>
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectStepModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--bg-primary)", padding: 24, borderRadius: 12, width: 400, maxWidth: "90%", boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}>
            <h3 style={{ margin: "0 0 16px 0", color: "var(--text-primary)" }}>Reject Step: {rejectStepModal.title}</h3>
            <textarea
              className="admin-input"
              autoFocus
              placeholder={`Provide a reason for rejecting the ${rejectStepModal.title}...`}
              value={stepRejectReason}
              onChange={e => setStepRejectReason(e.target.value)}
              style={{ width: "100%", minHeight: 100, padding: 12, borderRadius: 8, border: "1px solid var(--border-color)", marginBottom: 16 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button onClick={() => setRejectStepModal(null)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-primary)", fontWeight: 600, cursor: "pointer", color: "var(--text-primary)" }}>
                Cancel
              </button>
              <button onClick={handleRejectStep} disabled={submitting || !stepRejectReason.trim()} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#ef4444", color: "var(--bg-primary)", fontWeight: 600, cursor: submitting || !stepRejectReason.trim() ? "not-allowed" : "pointer", opacity: submitting || !stepRejectReason.trim() ? 0.6 : 1 }}>
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--bg-primary)", border: `2px solid ${toast.type === "error" ? "#b91c1c" : "#30a46c"}`, color: toast.type === "error" ? "#b91c1c" : "#15803d", borderRadius: 8, padding: "14px 22px", fontWeight: 900, zIndex: 1000, boxShadow: "0 4px 24px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: 8 }}>
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.msg}
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
