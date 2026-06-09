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
    evidenceTitle: "Registered Mobile",
    evidenceHint: "Confirm the applicant's verified mobile number.",
    fields: (app) => [
      ["Mobile number", app.user?.phone],
      ["Application status", app.status],
    ],
    evidence: () => [],
  },
  {
    id: "emailVerification",
    kycIndex: 2,
    title: "Email Verification",
    evidenceTitle: "Registered Email",
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
    evidenceTitle: "Selected Brokerage Plan",
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
    evidenceTitle: "DigiLocker Aadhaar Evidence",
    evidenceHint: "Use the Aadhaar image or DigiLocker document to verify identity details.",
    fields: (app) => [
      ["Identity method", app.identityMethod],
      ["Aadhaar reference", app.identityDetails?.aadhaar || app.identityDetails?.aadhaarNumber || app.identityDetails?.uid],
      ["DigiLocker status", app.identityDetails?.digilocker?.status || app.ocrData?.digilocker?.status],
    ],
    evidence: (app) => [findDocument(app, ["aadhaar", "digilocker", "uidai"], "Aadhaar / DigiLocker Document", ["pan", "photo", "image"])].filter(Boolean),
  },
  {
    id: "personalDetails",
    kycIndex: 6,
    title: "Personal Details",
    evidenceTitle: "Aadhaar Photo",
    evidenceHint: "Compare name, DOB, gender, and Aadhaar photo with the applicant's details.",
    fields: (app) => [
      ["Full name", app.personalDetails?.fullName],
      ["Father/Spouse name", app.personalDetails?.fatherName || app.personalDetails?.spouseName],
      ["Date of birth", app.personalDetails?.dob],
      ["Gender", app.personalDetails?.gender],
      ["Occupation", app.personalDetails?.occupation],
      ["PEP status", app.personalDetails?.politicallyExposed],
    ],
    evidence: (app) => [
      findDocument(app, ["aadhaar", "digilocker", "photo"], "Aadhaar Photo", ["pan"]),
      firstMedia(app.personalDetails?.pepProofPreview || app.personalDetails?.pepProof, "PEP Proof"),
    ].filter(Boolean),
  },
  {
    id: "nomineeChoice",
    kycIndex: 7,
    title: "Nominee Choice",
    evidenceTitle: "Nominee Declaration",
    evidenceHint: "Confirm whether the applicant added or opted out of nominee registration.",
    fields: (app) => [
      ["Nominee preference", app.nomineeDetails?.choice || app.nomineeDetails?.nomineeChoice || nomineeSummary(app)],
      ["Nominees added", Array.isArray(app.nomineeDetails?.nominees) ? app.nomineeDetails.nominees.length : 0],
    ],
    evidence: () => [],
  },
  {
    id: "nomineeDetails",
    kycIndex: 8,
    title: "Nominee Details",
    evidenceTitle: "Nominee Identity Proof",
    evidenceHint: "Check nominee name, relation, date of birth, and guardian details if nominee is a minor.",
    fields: (app) => nomineeFields(app),
    evidence: (app) => nomineeEvidence(app),
  },
  {
    id: "nomineeAllocation",
    kycIndex: 9,
    title: "Nominee Allocation",
    evidenceTitle: "Allocation Split",
    evidenceHint: "Confirm nominee percentages add up correctly.",
    fields: (app) => [
      ["Allocation total", allocationTotal(app)],
      ["Allocation details", formatList(app.nomineeAllocation?.allocations || app.nomineeDetails?.allocations)],
    ],
    evidence: () => [],
  },
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
    evidenceHint: "Check that the signature is clear and belongs to the applicant.",
    fields: (app) => [
      ["Signature captured", app.signature ? "Yes" : "No"],
      ["Applicant", app.personalDetails?.fullName],
    ],
    evidence: (app) => [firstMedia(app.signature, "Signature")].filter(Boolean),
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
    evidence: (app) => [firstMedia(app.panUpload, "PAN Card Image") || findDocument(app, ["pan"], "PAN Card Image")].filter(Boolean),
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
    ].filter(Boolean),
  },
  {
    id: "esignPreview",
    kycIndex: 15,
    title: "eSign Preview",
    evidenceTitle: "Application PDF Preview",
    evidenceHint: "Review the generated form before Aadhaar eSign.",
    fields: (app) => [
      ["Generated PDF", app.generatedPdfBase64 ? "Available" : "Not available"],
      ["Applicant", app.personalDetails?.fullName],
    ],
    evidence: (app) => [firstMedia(app.generatedPdfBase64, "Generated KYC PDF")].filter(Boolean),
  },
  {
    id: "aadhaarEsign",
    kycIndex: 16,
    title: "Aadhaar eSign",
    evidenceTitle: "eSign Status",
    evidenceHint: "Confirm Aadhaar eSign completion and signed document availability.",
    fields: (app) => [
      ["eSign status", app.nsdlResponse?.status || app.esignDetails?.status || app.status],
      ["Aadhaar reference", app.identityDetails?.aadhaar || app.identityDetails?.uid],
    ],
    evidence: (app) => [
      firstMedia(app.nsdlResponse?.signedPdf || app.esignDetails?.signedPdf || app.generatedPdfBase64, "Signed PDF"),
      findDocument(app, ["aadhaar", "digilocker"], "Aadhaar Evidence", ["pan"]),
    ].filter(Boolean),
  },
  {
    id: "completion",
    kycIndex: 17,
    title: "Completion",
    evidenceTitle: "Final Dossier",
    evidenceHint: "Final check before approving the full application.",
    fields: (app) => [
      ["Applicant", app.personalDetails?.fullName],
      ["PAN", app.identityDetails?.pan || app.personalDetails?.pan],
      ["Mobile", app.user?.phone],
      ["Email", app.user?.email],
      ["Current application status", app.status],
    ],
    evidence: (app) => [firstMedia(app.generatedPdfBase64, "Final KYC PDF")].filter(Boolean),
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
  const nominees = Array.isArray(app.nomineeDetails?.nominees) ? app.nomineeDetails.nominees : [];
  if (!nominees.length) return [["Nominee details", "No nominee details submitted"]];
  return nominees.flatMap((nominee, index) => [
    [`Nominee ${index + 1} name`, nominee.name || nominee.fullName],
    [`Nominee ${index + 1} relation`, nominee.relationship || nominee.relation],
    [`Nominee ${index + 1} DOB`, nominee.dob],
    [`Nominee ${index + 1} guardian`, nominee.guardianName],
  ]);
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
      {rows.map(([label, value]) => (
        <div key={label} style={{ padding: 14, border: "1px solid var(--border-color)", borderRadius: 8, background: "var(--bg-secondary)" }}>
          <span className="inspection-label" style={{ marginBottom: 4 }}>{label}</span>
          <div style={{ fontSize: "0.95rem", fontWeight: 850, color: "var(--text-primary)", overflowWrap: "anywhere" }}>
            {String(value)}
          </div>
        </div>
      ))}
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

export default function AgentReview() {
  const { id } = useParams();
  const router = useRouter();
  const [app, setApp] = useState(null);
  const [selectedStepId, setSelectedStepId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

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

  // Keep selected step synced when app changes
  useEffect(() => {
    if (!app) return;
    const statuses = getStepStatuses(app);
    const currentUserStep = Number(app.currentStep || 0);
    const unlockedSteps = REVIEW_STEPS.filter((step) => currentUserStep >= step.kycIndex);
    const firstPendingIndex = unlockedSteps.findIndex((step) => statuses[step.id]?.status !== "approved" && statuses[step.id]?.status !== "rejected");
    const visibleSteps = firstPendingIndex === -1 ? unlockedSteps : unlockedSteps.slice(0, firstPendingIndex + 1);
    const rejectedStep = visibleSteps.find((step) => statuses[step.id]?.status === "rejected");
    const defaultActive = rejectedStep?.id || visibleSteps.find((step) => statuses[step.id]?.status !== "approved")?.id || (visibleSteps[0] && visibleSteps[0].id);
    setSelectedStepId((prev) => {
      if (prev && visibleSteps.some((step) => step.id === prev)) return prev;
      return defaultActive;
    });
  }, [app]);

  const updateApplicationStatus = async (status, reason = "") => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem("agent_token");
      const response = await fetchWithFallback(`/api/admin/review/${app.applicationId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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

  const reviewStep = async (step, status) => {
    if (status === "rejected" && !rejectReason.trim()) {
      showToast("Please add a rejection reason", "error");
      return;
    }
    try {
      setSubmitting(true);
      const token = localStorage.getItem("agent_token");
      const response = await fetchWithFallback(`/api/agent/kyc/${app.applicationId}/step/${step.id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, reason: status === "rejected" ? rejectReason.trim() : undefined }),
      });
      const data = await response.json();
      if (data.success) {
        showToast(status === "approved" ? `${step.title} approved` : `${step.title} rejected`, status === "approved" ? "success" : "error");
        setRejectReason("");
        setShowReject(false);
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

  if (loading) return <div className="admin-loading">Loading Review</div>;
  if (!app) return <div className="admin-error">Application not found for ID: {id}</div>;

  const statuses = getStepStatuses(app);
  const currentUserStep = Number(app.currentStep || 0);
  const unlockedSteps = REVIEW_STEPS.filter((step) => currentUserStep >= step.kycIndex);
  // Visible steps stop at the first unlocked step that is not approved.
  const firstPendingIndex = unlockedSteps.findIndex((step) => statuses[step.id]?.status !== "approved" && statuses[step.id]?.status !== "rejected");
  const visibleSteps = firstPendingIndex === -1 ? unlockedSteps : unlockedSteps.slice(0, firstPendingIndex + 1);
  const rejectedStep = visibleSteps.find((step) => statuses[step.id]?.status === "rejected");
  const activeStep = REVIEW_STEPS.find((s) => s.id === selectedStepId) || rejectedStep || visibleSteps.find((step) => statuses[step.id]?.status !== "approved") || visibleSteps[0];
  const approvedCount = unlockedSteps.filter((step) => statuses[step.id]?.status === "approved").length;
  const canApproveApplication = unlockedSteps.length > 0 && approvedCount === unlockedSteps.length && currentUserStep >= 17 && app.status !== "verified";
  const progress = unlockedSteps.length ? Math.round((approvedCount / unlockedSteps.length) * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-secondary)", padding: 16 }}>
      <div style={{ maxWidth: 1480, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/agent")} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "none", background: "transparent", color: "var(--text-muted)", fontWeight: 850, cursor: "pointer" }}>
            <ArrowLeft size={18} /> Back to requests
          </button>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className={`badge ${app.status === "verified" ? "badge-verified" : app.status === "rejected" ? "badge-rejected" : app.status === "on_hold" ? "badge-suspended" : "badge-review"}`}>
              {String(app.status || "pending").replace("_", " ")}
            </span>
          </div>
        </div>

        <div className="card" style={{ borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--wise-dark-green)", marginBottom: 8 }}>
                <ShieldCheck size={24} />
                <span style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "0.76rem", letterSpacing: 0.6 }}>Agent step review</span>
              </div>
              <h1 style={{ margin: 0, fontSize: "1.55rem", fontWeight: 950 }}>{getApplicantName(app)}</h1>
              <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontWeight: 750 }}>
                {app.applicationId} | {app.user?.phone || "No phone"} | {app.personalDetails?.email || app.user?.email || "No email"}
              </p>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 12 }}>
                <span style={{ color: "var(--text-muted)", fontWeight: 850 }}>User is currently on</span>
                <span style={{ fontWeight: 950 }}>Step {currentUserStep}/17</span>
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 950, color: "var(--wise-dark-green)", marginBottom: 10 }}>
                {USER_STEP_LABELS[currentUserStep] || "Unknown step"}
              </div>
              <div style={{ height: 10, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, Math.round((currentUserStep / 17) * 100))}%`, height: "100%", background: "var(--wise-green)" }} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr) 320px", gap: 16, alignItems: "start" }}>
          <StepRail unlockedSteps={unlockedSteps} activeStepId={selectedStepId} statuses={statuses} onSelectStep={(id) => { setSelectedStepId(id); setShowReject(false); }} />

          <main style={{ display: "grid", gap: 16 }}>
            {!activeStep ? (
              <div className="card" style={{ padding: 40, borderRadius: 8, textAlign: "center" }}>
                <Clock3 size={40} color="#6b7280" />
                <h2 style={{ margin: "14px 0 8px", fontSize: "1.3rem" }}>No step is ready for review</h2>
                <p style={{ color: "var(--text-muted)", fontWeight: 700, margin: 0 }}>The applicant has not reached a verifiable KYC step yet.</p>
              </div>
            ) : (
              <>
                <div className="card" style={{ padding: 20, borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 18 }}>
                    <div>
                      <span className="inspection-label">Current verification step</span>
                      <h2 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 950 }}>{activeStep.title}</h2>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 8, padding: "9px 12px", background: rejectedStep ? "#fee2e2" : "#f3ffe9", color: rejectedStep ? "#991b1b" : "var(--wise-dark-green)", fontWeight: 900 }}>
                      {rejectedStep ? <XCircle size={18} /> : <Lock size={16} />}
                      {rejectedStep ? "Rejected" : "Only this step is open"}
                    </div>
                  </div>
                  <FieldGrid fields={activeStep.fields(app)} />
                </div>
                <EvidencePanel step={activeStep} app={app} />
              </>
            )}
          </main>

          <aside style={{ display: "grid", gap: 16, position: "sticky", top: 16 }}>
            <div className="card" style={{ padding: 20, borderRadius: 8 }}>
              <span className="inspection-label">Step progress</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: "2rem", fontWeight: 950, color: "var(--wise-dark-green)", whiteSpace: "nowrap" }}>{progress}%</div>
                <div style={{ color: "var(--text-muted)", fontWeight: 750 }}>{approvedCount} of {unlockedSteps.length} unlocked steps approved</div>
              </div>
              <div style={{ height: 10, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, height: "100%", background: "var(--wise-green)" }} />
              </div>
            </div>

            <div className="card" style={{ padding: 20, borderRadius: 8 }}>
              <span className="inspection-label">Face confidence</span>
              <div style={{ fontSize: "2rem", fontWeight: 950, color: Number(app.faceMatchScore || 0) >= 70 ? "#15803d" : "#b91c1c", whiteSpace: "nowrap" }}>
                {app.faceMatchScore || 0}%
              </div>
            </div>

            {activeStep && (
              <div className="card" style={{ padding: 20, borderRadius: 8 }}>
                <span className="inspection-label">Decision</span>
                {(() => {
                  const info = statuses[activeStep.id] || {};
                  const isApproved = info.status === "approved";
                  const isRejected = info.status === "rejected";
                  return (
                    <>
                      <button disabled={submitting || isApproved} onClick={() => reviewStep(activeStep, "approved")} style={{ width: "100%", padding: 14, borderRadius: 8, border: "none", background: "#30a46c", color: "white", fontWeight: 950, cursor: submitting || isApproved ? "not-allowed" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <CheckCircle2 size={18} /> {isApproved ? "Step approved" : isRejected ? "Approve rejected step" : "Approve step"}
                      </button>
                      <button disabled={submitting || isRejected} onClick={() => setShowReject((value) => !value)} style={{ width: "100%", padding: 14, borderRadius: 8, border: "1px solid #fecaca", background: "#fee2e2", color: "#991b1b", fontWeight: 900, cursor: submitting || isRejected ? "not-allowed" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                        <XCircle size={18} /> {isRejected ? "Step rejected" : isApproved ? "Reject approved step" : "Reject step"}
                      </button>
                    </>
                  );
                })()}
                {showReject && (
                  <div style={{ marginTop: 12 }}>
                    <textarea className="admin-input" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Reason visible in audit history" style={{ minHeight: 92, resize: "vertical" }} />
                    <button disabled={submitting || !rejectReason.trim()} onClick={() => reviewStep(activeStep, "rejected")} style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 8, border: "none", background: rejectReason.trim() ? "#b91c1c" : "var(--border-color)", color: "white", fontWeight: 900, cursor: rejectReason.trim() ? "pointer" : "not-allowed" }}>
                      Confirm rejection
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="card" style={{ padding: 20, borderRadius: 8 }}>
              <span className="inspection-label">Final application</span>
              {canApproveApplication ? (
                <button disabled={submitting} onClick={() => updateApplicationStatus("verified")} style={{ width: "100%", padding: 14, borderRadius: 8, border: "none", background: "var(--wise-green)", color: "var(--wise-dark-green)", fontWeight: 950, cursor: submitting ? "not-allowed" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                  <BadgeCheck size={18} /> Approve application
                </button>
              ) : (
                <div style={{ color: "var(--text-muted)", fontWeight: 750, lineHeight: 1.5 }}>
                  Approve every unlocked step first. The final approval opens after the applicant reaches completion.
                </div>
              )}
              {rejectedStep && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "#fee2e2", color: "#991b1b", fontWeight: 800 }}>
                  This application is stopped at {rejectedStep.title}.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "white", border: `2px solid ${toast.type === "error" ? "#b91c1c" : "#30a46c"}`, color: toast.type === "error" ? "#b91c1c" : "#15803d", borderRadius: 8, padding: "14px 22px", fontWeight: 900, zIndex: 1000, boxShadow: "0 20px 40px rgba(0,0,0,0.14)", display: "flex", alignItems: "center", gap: 8 }}>
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.msg}
        </div>
      )}

      <style>{`
        @media (max-width: 1180px) {
          div[style*="grid-template-columns: 300px minmax(0, 1fr) 320px"] {
            grid-template-columns: 1fr !important;
          }
          aside, div[style*="position: sticky"] {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}
