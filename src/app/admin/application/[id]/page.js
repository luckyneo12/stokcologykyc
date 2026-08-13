"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminSidebar from "../../components/AdminSidebar";
import Logo from "@/components/kyc/Logo";
import { API_BASE_URL, resolveAssetUrl } from "@/utils/apiConfig";
import { io } from "socket.io-client";
import "../../admin.css";
function PdfThumbnail({ src, label }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [cloudinaryImgSrc, setCloudinaryImgSrc] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    if (src && src.includes('res.cloudinary.com') && src.toLowerCase().endsWith('.pdf')) {
      const jpgSrc = src.replace(/\.pdf$/i, '.jpg');
      setCloudinaryImgSrc(jpgSrc);
      setLoading(false);
      return;
    }

    async function renderThumbnail() {
      if (!src) return;
      setLoading(true);
      setFailed(false);
      try {
        const pdfjs = await import('pdfjs-dist');
        
        // Ensure worker is set for this instance
        const workerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version || '5.7.284'}/build/pdf.worker.min.mjs`;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        if (isCancelled) return;

        const loadingTask = pdfjs.getDocument({
          url: src,
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version || '5.7.284'}/cmaps/`,
          cMapPacked: true,
        });
        
        const pdf = await loadingTask.promise;
        if (isCancelled) return;
        const page = await pdf.getPage(1);
        if (isCancelled) return;
        
        const viewport = page.getViewport({ scale: 0.8 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        await page.render(renderContext).promise;
        if (!isCancelled) setLoading(false);
      } catch (error) {
        console.error("PDF Preview Error:", error);
        if (!isCancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    }
    renderThumbnail();
    return () => { isCancelled = true; };
  }, [src]);


  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {loading && <div className="loader-sm"></div>}
      {failed && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 16 }}>
          <div style={{ fontWeight: 900 }}>PDF preview unavailable</div>
          <div style={{ marginTop: 4, fontSize: "0.75rem" }}>The file could not be loaded from the server.</div>
        </div>
      )}
      {cloudinaryImgSrc ? (
        <img 
          src={cloudinaryImgSrc} 
          alt="PDF Preview" 
          style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", borderRadius: 8, display: failed ? "none" : "block" }} 
          onError={() => { setFailed(true); setCloudinaryImgSrc(null); }}
        />
      ) : (
        <canvas ref={canvasRef} style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", borderRadius: 8, display: loading || failed ? "none" : "block" }} />
      )}
    </div>
  );
}

const maskAadhaarDisplay = (value) => {
  if (!value) return "XXXXXXXXXXXX";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 4) return value;
  return `XXXXXXXX${digits.slice(-4)}`;
};

function EAadhaarDocumentPreview({ app, photoSrc, compact = false }) {
  const addressLines = [
    app.personalDetails?.fatherName ? `S/O: ${app.personalDetails.fatherName}` : null,
    [app.address?.line1, app.address?.line2, app.address?.line3].filter(Boolean).join(", "),
    [app.address?.city, app.address?.state].filter(Boolean).join(", "),
    app.address?.pincode,
  ].filter(Boolean);

  const rows = [
    ["Document type", "e-Aadhaar generated from DigiLocker verified Aadhaar XML"],
    ["Generation date", new Date().toLocaleString("en-IN")],
    ["Masked Aadhaar number", maskAadhaarDisplay(app.identityDetails?.aadhaar)],
    ["Name", app.personalDetails?.fullName || "N/A"],
    ["Date of Birth", app.personalDetails?.dob || "N/A"],
    ["Gender", app.personalDetails?.gender || "N/A"],
    ["c/o, s/o", app.personalDetails?.fatherName ? `S/O: ${app.personalDetails.fatherName}` : "N/A"],
    ["Address", addressLines.join(", ") || "N/A"],
    ["Locality", app.address?.line3 || app.address?.city || "N/A"],
    ["City / District", app.address?.city || "N/A"],
    ["Pin Code", app.address?.pincode || "N/A"],
    ["State", app.address?.state || "N/A"],
  ];

  return (
    <div
      className={compact ? "eaadhaar-preview--compact" : ""}
      style={{ width: "100%", background: "white", color: "#111", fontFamily: "Arial, sans-serif", fontSize: compact ? "0.58rem" : "0.72rem", lineHeight: 1.35 }}
    >
      <div style={{ padding: compact ? "10px 12px 8px" : "16px 18px 10px", borderBottom: "1px solid #d9d9d9", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div className="eaadhaar-preview__title" style={{ fontSize: compact ? "0.78rem" : "1rem", fontWeight: 700, marginBottom: 4 }}>DigiLocker verified e-Aadhaar</div>
          <div className="eaadhaar-preview__subtitle" style={{ fontSize: compact ? "0.52rem" : "0.62rem", color: "#444", maxWidth: 420 }}>
            This document is generated from verified Aadhaar XML obtained from DigiLocker with due user consent and authentication.
          </div>
        </div>
        <div style={{ textAlign: "center", minWidth: 72 }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", border: "2px solid #1f9d55", color: "#1f9d55", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, margin: "0 auto 4px" }}>✓</div>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#1f9d55" }}>XML verified</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr 72px" : "1fr 110px", gap: 0 }}>
        <div>
          {rows.map(([label, value]) => (
            <div key={label} className="eaadhaar-preview__label-col" style={{ display: "grid", gridTemplateColumns: compact ? "96px 1fr" : "130px 1fr", borderBottom: "1px solid #d9d9d9", borderRight: "1px solid #d9d9d9" }}>
              <div style={{ padding: compact ? "5px 6px" : "7px 8px", background: "#f3f4f6", fontWeight: 700 }}>{label}</div>
              <div style={{ padding: compact ? "5px 6px" : "7px 8px" }}>{value}</div>
            </div>
          ))}
        </div>
        <div className="eaadhaar-preview__photo-col" style={{ borderBottom: "1px solid #d9d9d9", display: "flex", alignItems: "center", justifyContent: "center", padding: compact ? 6 : 8, background: "#f8fafc" }}>
          {photoSrc ? (
            <img src={photoSrc} alt="Aadhaar portrait" style={{ width: "100%", maxHeight: compact ? 100 : 150, objectFit: "cover", border: "1px solid #d0d7de", borderRadius: 4 }} />
          ) : (
            <div style={{ color: "#888", fontWeight: 700, fontSize: "0.65rem" }}>PHOTO</div>
          )}
        </div>
      </div>

      <div style={{ padding: "10px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #d9d9d9" }}>
        <span style={{ color: "#1d4ed8", fontWeight: 700 }}>www.digio.in</span>
        <span style={{ color: "#dc2626", fontWeight: 700, fontSize: "0.62rem" }}>| For Limited Circulation | CONFIDENTIAL</span>
      </div>
    </div>
  );
}

const STEP_LABELS = {
  0: "Step 0: Welcome", 
  1: "Step 1: Phone", 
  2: "Step 2: Email", 
  3: "Step 3: Pricing",
  4: "Step 4: PAN", 
  5: "Step 5: DigiLocker", 
  6: "Step 6: Personal Details",
  7: "Step 7: Nominee Choice", 
  8: "Step 8: Nominee",
  9: "Step 9: Allocation", 
  10: "Step 10: Bank", 
  11: "Step 11: Document Upload",
  12: "Step 12: eSign Preview", 
  13: "Step 13: Aadhaar eSign", 
  14: "Step 14: Completion"
};

const STATUS_MAP = { 
  pending: "badge-pending", under_review: "badge-review",
  verified: "badge-verified", rejected: "badge-rejected", 
  on_hold: "badge-suspended" 
};

const formatPanValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.toUpperCase().match(/[A-Z]{5}[0-9]{4}[A-Z]/);
    return match ? match[0] : value;
  }
  if (typeof value !== "object") return String(value);

  const preferredKeys = ["pan", "pan_no", "pan_number", "panNo", "id_no", "id_number", "number", "document_number"];
  for (const key of preferredKeys) {
    const formatted = formatPanValue(value[key]);
    if (formatted && formatted !== "[object Object]") return formatted;
  }

  for (const nested of Object.values(value)) {
    const formatted = formatPanValue(nested);
    if (formatted && formatted !== "[object Object]") return formatted;
  }

  return "";
};

const fetchWithFallback = async (path, options = {}) => {
  const primaryUrl = `${API_BASE_URL}${path}`;
  const fetchOptions = { ...options, cache: 'no-store' };
  try {
    return await fetch(primaryUrl, fetchOptions);
  } catch (primaryError) {
    if (typeof window !== "undefined") {
      return await fetch(path, fetchOptions);
    }
    throw primaryError;
  }
};

export default function ApplicationDetail() {
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };
  const { id } = useParams();
  const router = useRouter();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingStep, setPendingStep] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [toast, setToast] = useState(null);
  const [collapsedSidebar, setCollapsedSidebar] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [backofficeClientCode, setBackofficeClientCode] = useState("");
  const [backofficeClientType, setBackofficeClientType] = useState("A");
  const [backofficeSubmitting, setBackofficeSubmitting] = useState(false);
  const [showSelfieVideo, setShowSelfieVideo] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleAssign = async () => {
    if (!selectedAgent) return;
    try {
      const token = localStorage.getItem("adminToken");
      const agent = employees.find(e => String(e.id) === String(selectedAgent));
      const res = await fetchWithFallback(`/api/admin/application/${id}/assign`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          crmAgentId: selectedAgent,
          crmAgentName: agent ? agent.name : "" 
        })
      });
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.success) {
          showToast("Agent assigned successfully!");
          fetchDetail();
        } else {
          showToast(data.error || "Assignment failed", "error");
        }
      } else {
        showToast("Server error during assignment", "error");
      }
    } catch (err) {
      showToast("Network error during assignment", "error");
    }
  };

  // Global PDF.js initialization
  useEffect(() => {
    const initPdf = async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version || '5.7.284'}/build/pdf.worker.min.mjs`;
      } catch (e) {
        console.error("Global PDF init failed:", e);
      }
    };
    initPdf();
  }, []);
  
  const openInNewTab = (src) => {
    if (!src) return;
    
    // For Base64 data URIs, convert to Blob to avoid browser "refresh required" bugs
    if (src.startsWith('data:')) {
      try {
        const parts = src.split(',');
        const mime = parts[0].match(/:(.*?);/)[1];
        const b64Data = parts[1];
        const byteCharacters = atob(b64Data);
        const byteArrays = [];
        
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }
        
        const blob = new Blob(byteArrays, { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
      } catch (err) {
        console.error("Blob conversion failed, falling back to direct open", err);
        window.open(src, '_blank');
      }
    } else {
      window.open(src, '_blank');
    }
  };

  const fetchDetail = async () => {
    if (!id || typeof window === "undefined") return;
    try {
      console.log("Fetching detail for ID:", id);
      const token = localStorage.getItem("adminToken");
      const response = await fetchWithFallback(`/api/admin/application/${id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        console.log("Fetch result:", data);
        if (data.success) {
          setApp(data.application);
          const appData = data.application;
          const generatedClientCode = appData?.clientCode || appData?.nsdlResponse?.clientId || appData?.nsdlResponse?.ClientCode || `CLI-${appData?.id || id}`;
          if (generatedClientCode) {
            setBackofficeClientCode((current) => current || generatedClientCode);
          }
        } else {
          showToast(data.error || "Failed to load application", "error");
        }
      } else {
        const text = await response.text();
        console.warn("Expected JSON but got:", text.substring(0, 100));
        if (response.ok) {
           showToast("Server returned invalid format", "error");
        }
      }
    } catch (err) {
      console.error("Fetch failed", err);
      showToast("Network error or server down", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetchWithFallback(`/api/admin/crm-employees`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.success) {
          setEmployees(data.employees || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch employees", err);
    }
  };

  useEffect(() => {
    fetchDetail();
    fetchEmployees();
    
    if (id) {
      const socket = io(API_BASE_URL, { withCredentials: true });
      socket.on("connect", () => socket.emit("join_application", id));
      socket.on("kyc_updated", () => fetchDetail());
      return () => socket.disconnect();
    }
  }, [id]);

  useEffect(() => {
    const isDark = localStorage.getItem("adminTheme") === "dark";
    if (isDark) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  const updateStatus = async (status, extra = {}) => {
    if (typeof window === "undefined") return;
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetchWithFallback(`/api/admin/review/${id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ status, reason: rejectReason || extra.reason, currentStep: extra.currentStep })
      });
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.success) {
          showToast(`Application updated to ${status}`);
          setPendingStep(null);
          fetchDetail();
        } else {
          showToast(data.error || "Update failed", "error");
        }
      } else {
        const text = await response.text();
        console.warn("Expected JSON but got:", text.substring(0, 100));
        showToast("Server error during update", "error");
      }
    } catch (err) {
      showToast("Update failed", "error");
    }
  };

  const requestModifications = async () => {
    if (!id) return;
    try {
      setSendingEmail(true);
      const token = localStorage.getItem("adminToken");
      const response = await fetchWithFallback(`/api/admin/application/${id}/request-modifications`, {
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

  const sendToBackoffice = async () => {
    setBackofficeSubmitting(true);
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetchWithFallback(`/api/admin/application/${id}/send-backoffice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          clientCode: backofficeClientCode.trim() || undefined,
          clientType: backofficeClientType,
        }),
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.success) {
          showToast("Backoffice payload sent successfully");
          if (data.clientCode) {
            setBackofficeClientCode(data.clientCode);
          }
          fetchDetail();
        } else {
          showToast(data.error || "Failed to send to backoffice", "error");
        }
      } else {
        showToast("Backoffice call failed with invalid response", "error");
      }
    } catch (err) {
      console.error("Backoffice call failed", err);
      showToast("Network error while sending backoffice data", "error");
    } finally {
      setBackofficeSubmitting(false);
    }
  };

  const showToast = (msg, type = "success") => { 
    setToast({ msg, type }); 
    setTimeout(() => setToast(null), 3000); 
  };

  if (loading) return <div className="admin-loading">Loading Dossier...</div>;
  if (!app) return <div className="admin-error">Application not found for ID: {id}</div>;

  if (showMetadata) {
    return (
      <div style={{ minHeight: "100vh", background: "#0e0f0c", color: "#a0a0a0", padding: "40px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
            <div>
              <h1 style={{ color: "white", fontSize: "2rem", fontWeight: 900, marginBottom: "8px" }}>Raw System Metadata</h1>
              <p style={{ color: "var(--text-muted)" }}>Technical JSON dossier for Application ID: {app.applicationId}</p>
            </div>
            <button 
              onClick={() => setShowMetadata(false)}
              style={{ padding: "12px 24px", borderRadius: 12, background: "var(--wise-green)", color: "var(--wise-dark-green)", border: "none", fontWeight: 900, cursor: "pointer", fontSize: "1rem" }}
            >
              Close Metadata
            </button>
          </div>
          <div style={{ background: "#1a1a1a", padding: "40px", borderRadius: 24, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 50px 100px rgba(0,0,0,0.5)" }}>
            <pre style={{ fontSize: "0.9rem", lineHeight: 1.6, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", overflowX: "auto" }}>
              {JSON.stringify(app, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  
  const SECTION_STEP_ALIASES = {
    personal: ["personalDetails"],
    pricing: ["pricingSelection"],
    regulatory: ["panVerification", "digilocker"],
    address: ["digilocker"],
    bank: ["bankVerification"],
    nominee: ["nomineeChoice", "nomineeDetails"],
    pan_upload: ["panUpload"],
    financial_proof: ["financialProof"],
    selfie: ["ipv"],
    pep_proof: ["personalDetails"],
  };

  const parseStepStatuses = () => {
    if (!app?.stepStatuses) return {};
    if (typeof app.stepStatuses === "object") return app.stepStatuses;
    try { return JSON.parse(app.stepStatuses || "{}"); } catch(e) { return {}; }
  };

  const getStepStatus = (stepName) => {
    const stepStatuses = parseStepStatuses();
    const keys = [stepName, ...(SECTION_STEP_ALIASES[stepName] || [])];
    const statuses = keys.map((key) => stepStatuses[key]).filter(Boolean);
    return statuses.find((info) => info?.status === "rejected") || statuses.find((info) => info?.status === "approved") || stepStatuses[stepName];
  };

  const getSectionStyle = (stepName) => {
    const info = getStepStatus(stepName);
    if (info?.status === "approved") {
      return {
        background: "var(--accent-green-bg)",
        border: "1px solid rgba(34, 197, 94, 0.25)",
        position: "relative",
        transition: "all 0.3s ease",
        boxShadow: "0 8px 30px rgba(34, 197, 94, 0.08)"
      };
    }
    if (info?.status === "rejected") {
      return {
        background: "var(--accent-red-bg)",
        border: "1px solid rgba(239, 68, 68, 0.25)",
        position: "relative",
        transition: "all 0.3s ease",
        boxShadow: "0 8px 30px rgba(239, 68, 68, 0.08)"
      };
    }
    return { border: "1px solid var(--border-color)", position: "relative", transition: "all 0.3s ease" };
  };

  const renderSectionBadge = (stepName) => {
    const info = getStepStatus(stepName);
    if (info?.status === "approved") {
      return (
        <div style={{ position: "absolute", top: 16, right: 16, display: "flex", alignItems: "center", gap: 6, background: "rgba(34, 197, 94, 0.1)", color: "#22c55e", padding: "6px 14px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", zIndex: 10 }}>
          ✓ Verified
        </div>
      );
    }
    if (info?.status === "rejected") {
      return (
        <div style={{ position: "absolute", top: 16, right: 16, display: "flex", alignItems: "center", gap: 6, background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", padding: "6px 14px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", zIndex: 10 }}>
          ⚠ Rejected
        </div>
      );
    }
    return null;
  };

  const getTrackedSteps = () => {
    const steps = ['personal', 'pricing', 'regulatory', 'address', 'bank'];
    
    // Nominees
    if (app?.nomineeDetails?.nominees?.length > 0) {
      app.nomineeDetails.nominees.forEach((_, idx) => {
        steps.push(`nominee_${idx}`);
      });
    } else {
      steps.push('nominee');
    }
    
    // Documents / Biometrics
    steps.push('selfie');
    if (app?.panUpload?.filePreview) steps.push('pan_upload');
    if (app?.signature?.filePreview) steps.push('signature');
    if (app?.financialProof?.filePreview) steps.push('financial_proof');
    if ((String(app?.personalDetails?.politicallyExposed).toLowerCase() === "yes" || app?.personalDetails?.pepProofPreview || app?.personalDetails?.pepProof) && (app?.personalDetails?.pepProofPreview || app?.personalDetails?.pepProof)) {
      steps.push('pep_proof');
    }

    return steps;
  };

  const getApprovedStepsCount = () => {
    const stepStatuses = parseStepStatuses();
    let count = 0;
    const trackedSteps = getTrackedSteps();
    trackedSteps.forEach(s => {
      if (stepStatuses[s]?.status === 'approved') count++;
    });
    return count;
  };

  const getRejectedStepsCount = () => {
    const stepStatuses = parseStepStatuses();
    let count = 0;
    const trackedSteps = getTrackedSteps();
    trackedSteps.forEach(s => {
      if (stepStatuses[s]?.status === 'rejected') count++;
    });
    return count;
  };
  
  const trackedStepsList = app ? getTrackedSteps() : [];
  const approvedCount = app ? getApprovedStepsCount() : 0;
  const rejectedCount = app ? getRejectedStepsCount() : 0;
  const totalSteps = trackedStepsList.length;
  
  const hasCompletedDetails = app?.currentStep > 6 || !!app?.submittedAt || !!app?.isResubmitted || !!app?.rejectionReason;
  const getDocumentsByKeywords = (keywords) => {
    const docs = Array.isArray(app?.documents) ? app.documents : [];
    const lowered = keywords.map((keyword) => keyword.toLowerCase());
    return docs.filter((doc) => {
      const haystack = JSON.stringify(doc || {}).toLowerCase();
      return lowered.some((keyword) => haystack.includes(keyword));
    });
  };

  const getDocumentByKeywords = (keywords) => getDocumentsByKeywords(keywords)[0];

  const isImageDocumentPath = (docPath = "") => /\.(png|jpe?g|webp)$/i.test(String(getSafePreviewUrl(docPath)).toLowerCase());
  const getSafePreviewUrl = (src) => {
    if (!src) return src;
    if (typeof src === 'string' && src.includes('res.cloudinary.com') && src.endsWith('.pdf')) {
      return src.replace(/\.pdf$/, '.jpg');
    }
    return src;
  };

  const isPdfDocumentPath = (docPath = "") => {
    const pathStr = String(getSafePreviewUrl(docPath)).toLowerCase();
    return pathStr.endsWith(".pdf") || pathStr.startsWith("data:application/pdf") || pathStr.includes("application/pdf");
  };

  const allStoredDocuments = Array.isArray(app?.documents) ? app.documents : [];

  const isPanDocument = (doc) => {
    const type = String(doc?.type || "").toUpperCase();
    const label = String(doc?.label || "").toUpperCase();
    const path = String(doc?.path || "").toLowerCase();
    if (type.includes("AADHAAR") || type.includes("AADHAR") || type.includes("UID")) return false;
    if (path.includes("aadhaar") || path.includes("aadhar")) return false;
    return type.includes("PAN") || label.includes("PAN") || /(^|[/_])pan([/_]|\.)/i.test(path);
  };

  const isAadhaarDocument = (doc) => {
    const type = String(doc?.type || "").toUpperCase();
    const label = String(doc?.label || "").toUpperCase();
    const path = String(doc?.path || "").toLowerCase();
    if (isPanDocument(doc)) return false;
    return (
      type.includes("AADHAAR")
      || type.includes("AADHAR")
      || type.includes("UID")
      || label.includes("AADHAAR")
      || label.includes("AADHAR")
      || path.includes("aadhaar")
      || path.includes("aadhar")
    );
  };

  const pickBestPdf = (docs) => (
    docs.find((doc) => doc?.issued === true && isPdfDocumentPath(doc?.path))
    || docs.find((doc) => isPdfDocumentPath(doc?.path) && !doc?.generated)
    || docs.find((doc) => isPdfDocumentPath(doc?.path) && doc?.generated === true)
    || docs.find((doc) => isPdfDocumentPath(doc?.path))
  );

  const aadhaarPdfDocument = pickBestPdf(allStoredDocuments.filter(isAadhaarDocument));
  const aadhaarPhotoDocument = allStoredDocuments.find(
    (doc) => (doc?.type === "PHOTO" || isImageDocumentPath(doc?.path)) && isAadhaarDocument(doc)
  ) || allStoredDocuments.find((doc) => doc?.type === "PHOTO" && !isPanDocument(doc));
  const aadhaarDocument = aadhaarPdfDocument || allStoredDocuments.find(isAadhaarDocument);
  const panDocument = pickBestPdf(allStoredDocuments.filter(isPanDocument))
    || allStoredDocuments.find(isPanDocument);
  const aadhaarPhotoSrc = aadhaarPhotoDocument?.path ? resolveAssetUrl(aadhaarPhotoDocument.path) : null;
  const aadhaarPdfSrc = aadhaarPdfDocument?.path ? resolveAssetUrl(aadhaarPdfDocument.path) : null;
  const esignDocument = allStoredDocuments.find((doc) => String(doc?.type).toUpperCase() === "ESIGN");
  const panNumber = formatPanValue(app.identityDetails?.pan);
  const selfiePreview = app.selfieDetails?.preview || app.selfieDetails?.path || app.selfie;

  const extractGeoLocation = () => {
    if (!app) return null;
    if (app.selfieDetails?.geo) return app.selfieDetails.geo;
    
    const digioSources = [
      app.ocrData?.digio?.DIGILOCKER?.response,
      app.ocrData?.digio?.SELFIE?.response,
      app.ocrData?.digio?.PAN_VERIFICATION?.response,
      app.ocrData?.digio?.DIGILOCKER,
      app.ocrData?.digio?.SELFIE,
      app.ocrData?.digio?.PAN_VERIFICATION
    ].filter(Boolean);

    for (const res of digioSources) {
      if (res.location || res.geo) return res.location || res.geo;
      if (Array.isArray(res.actions)) {
        for (const action of res.actions) {
          const lat = action?.details?.latitude || action?.details?.lat || action?.details?.location?.lat || action?.details?.location?.latitude;
          const lon = action?.details?.longitude || action?.details?.lon || action?.details?.lng || action?.details?.location?.lon || action?.details?.location?.longitude;
          if (lat && lon) {
             return { latitude: lat, longitude: lon, address: action?.details?.location?.address || action?.details?.address || action?.details?.location_address };
          }
        }
      }
    }
    return null;
  };

  const geoLocation = extractGeoLocation();

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  return (
    <div style={{ 
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      background: "var(--bg-secondary)"
    }}>
      <div style={{ 
        display: "flex", 
        width: "125%",
        height: "125%",
        transform: "scale(0.8)",
        transformOrigin: "top left"
      }}>
      <AdminSidebar 
        active="kyc" 
        onNavigate={(s) => {
          localStorage.setItem("adminActiveSection", s);
          router.push("/admin");
        }} 
        collapsed={collapsedSidebar}
        onToggle={() => setCollapsedSidebar(!collapsedSidebar)}
      />
      
      <main style={{ 
        flex: 1, 
        padding: "16px", 
        width: "100%", 
        height: "100%",
        overflowY: "auto"
      }}>
        {/* Navigation Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button 
            onClick={() => router.push("/admin")}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "var(--text-muted)" }}
          >
            ← Back to Requests
          </button>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(48, 164, 108, 0.1)", color: "#30a46c", padding: "6px 12px", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 800 }}>
              <div style={{ width: 6, height: 6, background: "#30a46c", borderRadius: "50%", animation: "pulse 1.5s infinite" }}></div>
              LIVE SYNC
            </div>
            {app.globeStatus && (
              <span style={{ 
                padding: "8px 20px", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase",
                background: app.globeStatus === 'approved' ? 'rgba(16, 185, 129, 0.1)' : app.globeStatus === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
                color: app.globeStatus === 'approved' ? '#10b981' : app.globeStatus === 'rejected' ? '#ef4444' : '#f59e0b', 
                border: `1px solid ${app.globeStatus === 'approved' ? 'rgba(16,185,129,0.3)' : app.globeStatus === 'rejected' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`
              }}>
                GLOBE {app.globeStatus}
              </span>
            )}
            <span className={`badge ${STATUS_MAP[app.status]}`} style={{ padding: "8px 20px" }}>{app.status?.toUpperCase() || "PENDING"}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 24 }}>
          <input
            type="text"
            value={backofficeClientCode}
            onChange={(e) => setBackofficeClientCode(e.target.value)}
            placeholder="Backoffice Client Code"
            style={{ minWidth: 260, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border-color)", background: "#111", color: "white" }}
          />
          <select
            value={backofficeClientType}
            onChange={(e) => setBackofficeClientType(e.target.value)}
            style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border-color)", background: "#111", color: "white" }}
          >
            <option value="A">A</option>
            <option value="B">B</option>
          </select>
          <button
            onClick={sendToBackoffice}
            disabled={backofficeSubmitting}
            style={{ padding: "12px 18px", borderRadius: 12, border: "none", background: "var(--wise-green)", color: "var(--wise-dark-green)", fontWeight: 900, cursor: backofficeSubmitting ? "not-allowed" : "pointer" }}
          >
            {backofficeSubmitting ? "Sending…" : "Send to Backoffice"}
          </button>
          <div style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
            Uses the generated client ID when available; override it only if backoffice needs a different code.
          </div>
        </div>

        {/* Title Section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 32 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 900, marginBottom: 4 }}>{app.personalDetails?.fullName || "Unnamed Applicant"}</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", margin: 0 }}>ID: <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{app.applicationId}</span></p>
            
            <div style={{ display: "flex", gap: "24px", marginTop: "12px" }}>
              {app.updatedAt && (
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "#1d4ed8" }}>{formatDateTime(app.updatedAt)}</div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "600" }}>Updated At</div>
                </div>
              )}
              {app.createdAt && (
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "#1d4ed8" }}>{formatDateTime(app.createdAt)}</div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "600" }}>Date of KYC</div>
                </div>
              )}
            </div>
          </div>
          {app && (
            <div style={{ minWidth: 320 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-secondary)" }}>Step Verification Status</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 900 }}>
                  <span style={{ color: "#22c55e" }}>{approvedCount} Approved</span>
                  <span style={{ color: "var(--text-muted)", margin: "0 6px" }}>|</span>
                  <span style={{ color: "#ef4444" }}>{rejectedCount} Rejected</span>
                </span>
              </div>
              <div style={{ display: "flex", gap: "4px", width: "100%" }}>
                {trackedStepsList.map((step, idx) => {
                  const status = getStepStatus(step)?.status;
                  let bg = "var(--border-color)";
                  if (status === "approved") bg = "#22c55e";
                  else if (status === "rejected") bg = "#ef4444";
                  return (
                    <div 
                      key={idx} 
                      title={`${step.toUpperCase()}: ${status || 'pending'}`} 
                      style={{ flex: 1, height: 10, background: bg, borderRadius: 5, transition: "all 0.3s ease" }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {rejectedCount > 0 && (
          <div style={{ background: "#fee2e2", border: "1px solid #f87171", color: "#991b1b", padding: 20, borderRadius: 12, marginBottom: 30 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
              <div>
                <strong style={{ display: "block", fontSize: "1.1rem" }}>Application Blocked</strong>
                There are {rejectedCount} rejected steps. They must be resolved before final approval.
              </div>
            </div>
            <button
              disabled={sendingEmail}
              onClick={requestModifications}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 20px", borderRadius: 8, border: "none",
                background: "linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)",
                color: "white", fontWeight: 800, cursor: sendingEmail ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(153, 27, 27, 0.3)",
                transition: "0.2s", opacity: sendingEmail ? 0.7 : 1,
              }}
            >
              {sendingEmail ? "Sending..." : "Send Rejection Email to User"}
            </button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, paddingBottom: 60 }}>
          {/* Main Dossier */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* PRIMARY EVIDENCE SECTION */}
            {(() => {
              const documents = Array.isArray(app.documents) ? app.documents : [];
              const evidenceDocs = documents.filter(d => {
                const haystack = JSON.stringify(d || {}).toLowerCase();
                return d.source === "DIGILOCKER" || d.requestId || haystack.includes("digilocker") || haystack.includes("aadhaar") || haystack.includes("pan");
              });
              
              const hasAadhaarPhoto = !!aadhaarPhotoSrc || evidenceDocs.some((d) => {
                const haystack = JSON.stringify(d || {}).toLowerCase();
                return haystack.includes("aadhaar") && (d?.type === "PHOTO" || isImageDocumentPath(d?.path));
              });
              const hasPanUpload = app.panUpload?.filePreview;

              return (
                <section className="card" style={{ padding: 16, borderLeft: "4px solid var(--wise-green)", background: "linear-gradient(to right, var(--accent-green-bg), var(--bg-card))" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 900, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--wise-green)" strokeWidth="3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Primary KYC Evidence
                  </h3>
                  <div className="documents-biometrics-grid">
                    
                    {/* Synthetic Aadhaar Card from Digilocker Data (FRONT) */}
                    {app.identityDetails?.aadhaar && (
                      <div className="kyc-evidence-card">
                        <div style={{ padding: "8px 16px", background: "#fdf8e2", borderBottom: "1px solid #f1e2a0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                           <span style={{ fontSize: "0.7rem", fontWeight: 900, color: "#9c7e00", letterSpacing: 1 }}>GOVERNMENT OF INDIA - FRONT</span>
                           <span style={{ fontSize: "0.6rem", fontWeight: 800, background: "#fff2b3", padding: "2px 6px", borderRadius: 4, color: "#8a6d00" }}>DIGILOCKER VERIFIED</span>
                        </div>
                        <div className="kyc-evidence-card__body" style={{ display: "flex", gap: 16 }}>
                          <div style={{ width: 80, height: 100, border: "1px solid #ddd", borderRadius: 8, overflow: "hidden", background: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {hasAadhaarPhoto ? (
                              <img src={aadhaarPhotoSrc || resolveAssetUrl((aadhaarPhotoDocument || evidenceDocs.find((d) => {
                                const haystack = JSON.stringify(d || {}).toLowerCase();
                                return haystack.includes("aadhaar") && isImageDocumentPath(d?.path);
                              }))?.path)} alt="Aadhaar Face" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            )}
                          </div>
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                            <div>
                              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700 }}>NAME</div>
                              <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>{app.personalDetails?.fullName || "N/A"}</div>
                            </div>
                            <div style={{ display: "flex", gap: 16 }}>
                              <div>
                                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700 }}>DOB</div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{formatDate(app.personalDetails?.dob) || "N/A"}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700 }}>GENDER</div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{app.personalDetails?.gender || "N/A"}</div>
                              </div>
                            </div>
                            <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px dashed #eee" }}>
                              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700 }}>AADHAAR NUMBER</div>
                              <div style={{ fontSize: "1.1rem", fontWeight: 900, letterSpacing: 2 }}>{app.identityDetails?.aadhaar || "XXXX XXXX XXXX"}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Synthetic Aadhaar Card from Digilocker Data (BACK) */}
                    {app.identityDetails?.aadhaar && (
                      <div className="kyc-evidence-card">
                        <div style={{ padding: "8px 16px", background: "#fdf8e2", borderBottom: "1px solid #f1e2a0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                           <span style={{ fontSize: "0.7rem", fontWeight: 900, color: "#9c7e00", letterSpacing: 1 }}>GOVERNMENT OF INDIA - BACK</span>
                           <span style={{ fontSize: "0.6rem", fontWeight: 800, background: "#fff2b3", padding: "2px 6px", borderRadius: 4, color: "#8a6d00" }}>DIGILOCKER VERIFIED</span>
                        </div>
                        <div className="kyc-evidence-card__body">
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: 4 }}>ADDRESS / पता</div>
                            <div style={{ fontSize: "0.85rem", fontWeight: 700, lineHeight: 1.5, color: "#333" }}>
                              {[app.address?.line1, app.address?.line2, app.address?.line3].filter(Boolean).join(", ")}<br/>
                              {app.address?.city}, {app.address?.state}<br/>
                              {app.address?.pincode}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Synthetic PAN Card from Digilocker Data */}
                    {panNumber && !hasPanUpload && (
                      <div className="kyc-evidence-card">
                        <div style={{ padding: "8px 16px", background: "#eef6ff", borderBottom: "1px solid #cce2ff", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                           <span style={{ fontSize: "0.7rem", fontWeight: 900, color: "#0052cc", letterSpacing: 1 }}>INCOME TAX DEPARTMENT</span>
                           <span style={{ fontSize: "0.6rem", fontWeight: 800, background: "#cce2ff", padding: "2px 6px", borderRadius: 4, color: "#0047b3" }}>DIGILOCKER VERIFIED</span>
                        </div>
                        <div className="kyc-evidence-card__body" style={{ display: "flex", gap: 16 }}>
                          <div style={{ width: 80, height: 100, border: "1px solid #ddd", borderRadius: 8, overflow: "hidden", background: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ textAlign: "center" }}>
                               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><path d="M4 4h16v16H4z"/><path d="M4 8h16"/></svg>
                               <div style={{ fontSize: "0.5rem", color: "#999", marginTop: 4, fontWeight: 800 }}>NO IMAGE</div>
                            </div>
                          </div>
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                            <div>
                              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700 }}>NAME</div>
                              <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>{app.personalDetails?.fullName || "N/A"}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700 }}>FATHER'S NAME</div>
                              <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{app.personalDetails?.fatherName || "N/A"}</div>
                            </div>
                            <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px dashed #eee" }}>
                              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700 }}>PERMANENT ACCOUNT NUMBER</div>
                              <div style={{ fontSize: "1.1rem", fontWeight: 900, letterSpacing: 1, fontFamily: "monospace" }}>{panNumber}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {app.identityDetails?.aadhaar && (
                      <div className="document-preview-card">
                        <span className="inspection-label" style={{ color: "#0052cc" }}>DigiLocker e-Aadhaar</span>
                        <div className="document-preview-frame document-preview-frame--scroll">
                          {aadhaarPdfSrc ? (
                            <PdfThumbnail src={aadhaarPdfSrc} label="DigiLocker e-Aadhaar" />
                          ) : (
                            <EAadhaarDocumentPreview app={app} photoSrc={aadhaarPhotoSrc} compact />
                          )}
                        </div>
                        {aadhaarPdfSrc && (
                          <div className="document-preview-footer" style={{ textAlign: "right", color: "var(--wise-green)" }}>
                            <button type="button" onClick={() => openInNewTab(aadhaarPdfSrc)} style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", fontWeight: 700, cursor: "pointer" }}>OPEN PDF ↗</button>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </section>
              );
            })()}

            <section className="card" style={{ padding: 16, ...getSectionStyle("personal") }}>
{renderSectionBadge("personal")}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 900, display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
                  <div style={{ width: 3, height: 16, background: "var(--wise-green)", borderRadius: 2 }}></div>
                  Identity & Contact Details
                </h3>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px" }}>
                <div><span className="inspection-label">PAN Number</span><div className="inspection-value" style={{ fontFamily: "monospace" }}>{panNumber || "N/A"}</div></div>
                <div><span className="inspection-label">Aadhaar (DigiLocker)</span><div className="inspection-value">{app.identityDetails?.aadhaar || "N/A"}</div></div>
                <div><span className="inspection-label">Email Address</span><div className="inspection-value">{app.email ?? app.personalDetails?.email ?? app.user?.email ?? "N/A"}</div></div>
                <div><span className="inspection-label">Phone Number</span><div className="inspection-value">{app.phone ?? app.user?.phone ?? "N/A"}</div></div>
                <div><span className="inspection-label">Date of Birth</span><div className="inspection-value">{formatDate(app.personalDetails?.dob) || "N/A"}</div></div>
                <div><span className="inspection-label">Father's Name</span><div className="inspection-value">{app.personalDetails?.fatherName || "N/A"}</div></div>
              </div>
            </section>

            <section className="card" style={{ padding: 40, ...getSectionStyle("pricing") }}>
{renderSectionBadge("pricing")}
              <h3 style={{ fontSize: "1.2rem", fontWeight: 900, marginBottom: 32, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 4, height: 20, background: "var(--wise-green)", borderRadius: 2 }}></div>
                Segments & Pricing
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px 60px" }}>
                <div>
                  <span className="inspection-label">Trading Segments</span>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {(!app.segments || app.segments?.equity) ? (
                      <span style={{ padding: "6px 12px", background: "rgba(48, 164, 108, 0.1)", color: "#30a46c", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 700 }}>EQUITY</span>
                    ) : (
                      <span style={{ padding: "6px 12px", background: "rgba(0,0,0,0.05)", color: "#999", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 700 }}>EQUITY</span>
                    )}
                    {app.segments?.derivatives ? (
                      <span style={{ padding: "6px 12px", background: "rgba(48, 164, 108, 0.1)", color: "#30a46c", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 700 }}>DERIVATIVES</span>
                    ) : (
                      <span style={{ padding: "6px 12px", background: "rgba(0,0,0,0.05)", color: "#999", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 700 }}>DERIVATIVES</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="inspection-label">BSDA Preference</span>
                  <div className="inspection-value" style={{ textTransform: 'uppercase', fontSize: '0.9rem', fontWeight: 800 }}>
                    {app.bsda || "OPT-IN"}
                  </div>
                </div>
              </div>
            </section>

            <section className="card" style={{ padding: 16, ...getSectionStyle("regulatory") }}>
{renderSectionBadge("regulatory")}
              <h3 style={{ fontSize: "0.95rem", fontWeight: 900, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 3, height: 16, background: "var(--wise-green)", borderRadius: 2 }}></div>
                Regulatory Details
              </h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px 16px" }}>
                <div><span className="inspection-label">Prefix</span><div className="inspection-value">{app.personalDetails?.prefix || "N/A"}</div></div>
                <div><span className="inspection-label">Mother's Name</span><div className="inspection-value">{app.personalDetails?.motherName || "N/A"}</div></div>
                <div><span className="inspection-label">Gender</span><div className="inspection-value">{app.personalDetails?.gender || "N/A"}</div></div>
                
                <div><span className="inspection-label">Marital Status</span><div className="inspection-value">{app.personalDetails?.maritalStatus || "N/A"}</div></div>
                <div><span className="inspection-label">Education</span><div className="inspection-value">{app.personalDetails?.education || "N/A"}</div></div>
                <div><span className="inspection-label">Annual Income</span><div className="inspection-value">{app.personalDetails?.annualIncome || "N/A"}</div></div>
                
                <div><span className="inspection-label">Trading Experience</span><div className="inspection-value">{app.personalDetails?.experience || "N/A"}</div></div>
                <div><span className="inspection-label">Occupation</span><div className="inspection-value">{app.personalDetails?.occupation || "N/A"}</div></div>
                <div><span className="inspection-label">Politically Exposed</span><div className="inspection-value">
                  {hasCompletedDetails ? app.personalDetails?.politicallyExposed || "N/A" : "N/A"}
                  {hasCompletedDetails && app.personalDetails?.politicallyExposed === "Yes" && app.personalDetails?.pepType && ` (${app.personalDetails.pepType})`}
                </div></div>
                
                <div><span className="inspection-label">Indian Citizen</span><div className="inspection-value">{hasCompletedDetails ? app.personalDetails?.isIndianCitizen || "N/A" : "N/A"}</div></div>
                <div><span className="inspection-label">Tax Resident Outside India</span><div className="inspection-value">{hasCompletedDetails ? app.personalDetails?.taxResidencyOutside || "N/A" : "N/A"}</div></div>
                <div><span className="inspection-label">DDPI Choice</span><div className="inspection-value">{hasCompletedDetails ? app.personalDetails?.ddpi || "N/A" : "N/A"}</div></div>

                {app.personalDetails?.taxResidencyOutside === "Yes" && (
                  <>
                    <div><span className="inspection-label">Country of Birth</span><div className="inspection-value">{app.personalDetails?.countryOfBirth || "N/A"}</div></div>
                    <div><span className="inspection-label">Citizenship</span><div className="inspection-value">{app.personalDetails?.citizenship || "N/A"}</div></div>
                    <div><span className="inspection-label">Place of Birth</span><div className="inspection-value">{app.personalDetails?.placeOfBirth || "N/A"}</div></div>
                    <div><span className="inspection-label">Tax Residence 1</span><div className="inspection-value">{app.personalDetails?.taxResidence1 || "N/A"}</div></div>
                    <div><span className="inspection-label">Tax ID 1</span><div className="inspection-value">{app.personalDetails?.taxId1 || "N/A"}</div></div>
                    <div><span className="inspection-label">TAX Exempt</span><div className="inspection-value">{app.personalDetails?.taxExempt || "N/A"}</div></div>
                    <div><span className="inspection-label">Tax Residence 2</span><div className="inspection-value">{app.personalDetails?.taxResidence2 || "N/A"}</div></div>
                    <div><span className="inspection-label">Tax ID 2</span><div className="inspection-value">{app.personalDetails?.taxId2 || "N/A"}</div></div>
                    <div><span className="inspection-label">Tax Residence 3</span><div className="inspection-value">{app.personalDetails?.taxResidence3 || "N/A"}</div></div>
                    <div><span className="inspection-label">Tax ID 3</span><div className="inspection-value">{app.personalDetails?.taxId3 || "N/A"}</div></div>
                    {app.personalDetails?.taxExempt === "Yes" && (
                      <div style={{ gridColumn: "span 3" }}><span className="inspection-label">Tax Exempt Reason</span><div className="inspection-value">{app.personalDetails?.taxExemptReason || "N/A"}</div></div>
                    )}
                  </>
                )}
              </div>

              <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid var(--border-color)" }}>
                <span className="inspection-label" style={{ marginBottom: 20, display: "block" }}>Regulatory Declarations</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 40px" }}>
                  {[
                    { label: "Delivery Instruction Slip (DIS)", value: hasCompletedDetails ? app.personalDetails?.dis : null },
                    { label: "Receive Credits Automatically", value: hasCompletedDetails ? app.personalDetails?.receiveCredits : null },
                    { label: "E-Statement Preference", value: hasCompletedDetails ? app.personalDetails?.eStatement : null },
                    { label: "Accept Pledge Instructions", value: hasCompletedDetails ? app.personalDetails?.acceptPledgeInstructions : null },
                    { label: "Receive Annual Reports / AGM", value: hasCompletedDetails ? app.personalDetails?.receiveAnnualReports : null },
                    { label: "Account Settlement", value: hasCompletedDetails ? app.personalDetails?.settlement : null },
                    { label: "SMS Alert Facility", value: hasCompletedDetails ? app.personalDetails?.smsAlert : null },
                    { label: "Operated through DDPI", value: hasCompletedDetails ? app.personalDetails?.operatedThroughDDPI : null }
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{item.label}</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 900, color: "var(--text-primary)" }}>{item.value || "N/A"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="card" style={{ padding: 16, ...getSectionStyle("address") }}>
{renderSectionBadge("address")}
              <h3 style={{ fontSize: "0.95rem", fontWeight: 900, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 3, height: 16, background: "var(--wise-green)", borderRadius: 2 }}></div>
                Permanent Address
              </h3>
              <div className="inspection-value" style={{ fontSize: "1.1rem", lineHeight: 1.6, border: "none" }}>
                {[app.address?.line1, app.address?.line2, app.address?.line3].filter(Boolean).join(", ")}<br/>
                {app.address?.city}, {app.address?.state} - {app.address?.pincode}
              </div>
            </section>

            <section className="card" style={{ padding: 16, ...getSectionStyle("bank") }}>
{renderSectionBadge("bank")}
              <h3 style={{ fontSize: "0.95rem", fontWeight: 900, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 3, height: 16, background: "var(--wise-green)", borderRadius: 2 }}></div>
                Bank Details
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px 60px" }}>
                <div><span className="inspection-label">Bank Name</span><div className="inspection-value">{app.bankDetails?.bankName || "N/A"}</div></div>
                <div><span className="inspection-label">Account Number</span><div className="inspection-value">{app.bankDetails?.accountNumber || "N/A"}</div></div>
                <div><span className="inspection-label">IFSC Code</span><div className="inspection-value">{app.bankDetails?.ifsc || "N/A"}</div></div>
                <div><span className="inspection-label">MICR Code</span><div className="inspection-value">{app.bankDetails?.micr || "N/A"}</div></div>
                <div><span className="inspection-label">Account Type</span><div className="inspection-value">{app.bankDetails?.accountType || "N/A"}</div></div>
                <div><span className="inspection-label">Verification Method</span><div className="inspection-value" style={{ textTransform: "uppercase" }}>{app.bankDetails?.method || "N/A"}</div></div>
              </div>
            </section>

            <section className="card" style={{ padding: 16, ...(app.nomineeDetails?.nominees?.length > 0 ? { border: "1px solid var(--border-color)" } : getSectionStyle("nominee")) }}>
{app.nomineeDetails?.nominees?.length > 0 ? null : renderSectionBadge("nominee")}
              <h3 style={{ fontSize: "0.95rem", fontWeight: 900, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 3, height: 16, background: "var(--wise-green)", borderRadius: 2 }}></div>
                Nominee Details
              </h3>
              {app.nomineeDetails?.nominees?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                  {app.nomineeDetails.nominees.map((nom, idx) => (
                    <div key={idx} style={{ padding: 32, background: "var(--bg-secondary)", borderRadius: 24, ...getSectionStyle("nominee_" + idx) }}>
{renderSectionBadge("nominee_" + idx)}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                        <div>
                          <div style={{ fontSize: "1.25rem", fontWeight: 900 }}>{nom.name}</div>
                          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "4px" }}>
                            <div style={{ color: "var(--wise-green)", fontWeight: 700, fontSize: "0.9rem" }}>{nom.relation?.toUpperCase()}</div>
                            {app.nomineeAllocation?.percentages?.[idx] !== undefined && (
                              <div style={{ background: "var(--wise-green)", color: "black", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 900 }}>
                                {app.nomineeAllocation.percentages[idx]}% ALLOCATION
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span className="inspection-label">Nominee {idx + 1}</span>
                        </div>
                      </div>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px 40px" }}>
                        <div><span className="inspection-label">Date of Birth</span><div className="inspection-value">{formatDate(nom.dob) || "N/A"}</div></div>
                        <div><span className="inspection-label">Mobile</span><div className="inspection-value">{nom.mobile || "N/A"}</div></div>
                        <div><span className="inspection-label">Email</span><div className="inspection-value">{nom.email || "N/A"}</div></div>
                        
                        <div style={{ gridColumn: "span 2" }}>
                          <span className="inspection-label">Permanent Address</span>
                          <div className="inspection-value" style={{ border: "none" }}>{nom.address || "N/A"}</div>
                        </div>
                        <div><span className="inspection-label">Identity Proof ({nom.proofType})</span><div className="inspection-value">{nom.proofNumber || "N/A"}</div></div>
                      </div>

                      <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid var(--border-color)" }}>
                        <span className="inspection-label">Identity Proof Image ({nom.proofType})</span>
                        <div style={{ 
                          marginTop: 12, borderRadius: 16, overflow: "hidden", 
                          border: "1px solid var(--border-color)", width: "fit-content",
                          minWidth: 200, minHeight: 120, background: "var(--bg-secondary)",
                          display: "flex", alignItems: "center", justifyContent: "center"
                        }}>
                          {nom.proofPath ? (
                            <img 
                              src={resolveAssetUrl(nom.proofPath)} 
                              alt="Nominee Proof" 
                              style={{ maxHeight: 300, display: "block" }}
                              onError={(e) => { 
                                e.target.parentElement.innerHTML = '<div style="padding: 20px; color: var(--wise-danger); font-weight: 700; border: 1px solid #ff000022; border-radius: 8px;">Image failed to load</div>';
                              }}
                            />
                          ) : (
                            <div style={{ padding: "20px 40px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600 }}>
                              No proof image uploaded by user
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Guardian Details */}
                      {nom.guardianName && (
                        <div style={{ marginTop: 32, paddingTop: 32, borderTop: "2px dashed var(--border-color)" }}>
                          <h4 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 24, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 4, height: 16, background: "var(--wise-green)", borderRadius: 2 }}></div>
                            Guardian Details
                          </h4>
                          
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px 40px" }}>
                            <div><span className="inspection-label">Guardian Name</span><div className="inspection-value">{nom.guardianName}</div></div>
                            <div><span className="inspection-label">Relation</span><div className="inspection-value" style={{ color: "var(--wise-green)", fontWeight: 700 }}>{nom.guardianRelation}</div></div>
                            <div><span className="inspection-label">Date of Birth</span><div className="inspection-value">{formatDate(nom.guardianDob) || "N/A"}</div></div>
                            
                            <div><span className="inspection-label">Mobile</span><div className="inspection-value">{nom.guardianMobile}</div></div>
                            <div><span className="inspection-label">Email</span><div className="inspection-value">{nom.guardianEmail}</div></div>
                            <div><span className="inspection-label">Identity Proof ({nom.guardianProofType})</span><div className="inspection-value">{nom.guardianProofNumber}</div></div>
                            
                            <div style={{ gridColumn: "span 3" }}>
                              <span className="inspection-label">Full Address</span>
                              <div className="inspection-value" style={{ border: "none" }}>
                                {[nom.guardianAddress, nom.guardianCity, nom.guardianState, nom.guardianCountry, nom.guardianPincode].filter(Boolean).join(", ")}
                              </div>
                            </div>
                          </div>

                          <div style={{ marginTop: 24 }}>
                            <span className="inspection-label">Guardian Identity Proof Image ({nom.guardianProofType})</span>
                            <div style={{ 
                              marginTop: 12, borderRadius: 16, overflow: "hidden", 
                              border: "1px solid var(--border-color)", width: "fit-content",
                              minWidth: 200, minHeight: 120, background: "var(--bg-secondary)",
                              display: "flex", alignItems: "center", justifyContent: "center"
                            }}>
                              {nom.guardianProofPath ? (
                                <img 
                                  src={resolveAssetUrl(nom.guardianProofPath)} 
                                  alt="Guardian Proof" 
                                  style={{ maxHeight: 300, display: "block" }}
                                  onError={(e) => { 
                                    e.target.parentElement.innerHTML = '<div style="padding: 20px; color: var(--wise-danger); font-weight: 700; border: 1px solid #ff000022; border-radius: 8px;">Image failed to load</div>';
                                  }}
                                />
                              ) : (
                                <div style={{ padding: "20px 40px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600 }}>
                                  No guardian proof image uploaded
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", background: "var(--bg-secondary)", borderRadius: 24 }}>
                  No nominee details provided for this application.
                </div>
              )}
            </section>

            <section className="card" style={{ padding: 16 }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 900, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 3, height: 16, background: "var(--wise-green)", borderRadius: 2 }}></div>
                Documents & Biometrics
              </h3>
              
              <div className="documents-biometrics-grid">
                {/* Geo Location */}
                {geoLocation && (
                  <div className="document-preview-card" style={getSectionStyle("regulatory")}>
                    <span className="inspection-label">Geo Location (Digio)</span>
                    <div className="document-preview-frame" style={{ display: "flex", flexDirection: "column", padding: "16px", justifyContent: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e03131" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        <div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700 }}>COORDINATES</div>
                          <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>{geoLocation.latitude || geoLocation.lat}, {geoLocation.longitude || geoLocation.lon || geoLocation.lng}</div>
                        </div>
                      </div>
                      {(geoLocation.address || geoLocation.formatted_address) && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700 }}>ADDRESS</div>
                          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.5 }}>
                            {geoLocation.address || geoLocation.formatted_address}
                          </div>
                        </div>
                      )}
                      {(geoLocation.latitude || geoLocation.lat) && (geoLocation.longitude || geoLocation.lon || geoLocation.lng) && (
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${geoLocation.latitude || geoLocation.lat},${geoLocation.longitude || geoLocation.lon || geoLocation.lng}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: "var(--wise-green)", fontWeight: 800, textDecoration: "none", fontSize: "0.8rem", display: "inline-block", marginTop: "auto" }}
                        >
                          VIEW ON MAP ↗
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Selfie / Face Capture */}
                <div className="document-preview-card" style={getSectionStyle("selfie")}>
{renderSectionBadge("selfie")}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <span className="inspection-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      Selfie Capture
                      {app.selfieDetails?.videoPath && (
                        <button
                          onClick={() => setShowSelfieVideo(!showSelfieVideo)}
                          style={{
                            background: showSelfieVideo ? "rgba(48, 164, 108, 0.15)" : "transparent",
                            color: showSelfieVideo ? "var(--wise-green)" : "var(--text-muted)",
                            border: "1px solid var(--border-color)",
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: "0.6rem",
                            fontWeight: 800,
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                          }}
                        >
                          {showSelfieVideo ? "VIEW PHOTO" : "VIEW VIDEO"}
                        </button>
                      )}
                    </span>

                  </div>
                  <div className="document-preview-frame">
                    {showSelfieVideo && app.selfieDetails?.videoPath ? (
                      <video 
                        src={resolveAssetUrl(app.selfieDetails.videoPath)} 
                        controls 
                        autoPlay 
                        loop 
                        muted 
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} 
                      />
                    ) : selfiePreview ? (
                      <img src={resolveAssetUrl(selfiePreview)} alt="Selfie" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                    ) : (
                      <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No selfie captured</div>
                    )}
                  </div>
                </div>

                {/* DigiLocker e-Aadhaar verification document */}
                <div className="document-preview-card" style={getSectionStyle("personal")}>
{renderSectionBadge("personal")}
                  <span className="inspection-label">
                    DigiLocker e-Aadhaar{aadhaarPdfDocument?.issued ? " (Digio)" : aadhaarPdfDocument?.generated ? " (generated)" : ""}
                  </span>
                  <div className="document-preview-frame document-preview-frame--scroll">
                    {aadhaarPdfSrc ? (
                      <PdfThumbnail src={aadhaarPdfSrc} label="DigiLocker e-Aadhaar" />
                    ) : app.identityDetails?.aadhaar ? (
                      <EAadhaarDocumentPreview app={app} photoSrc={aadhaarPhotoSrc} compact />
                    ) : (
                      <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", padding: 16 }}>No Aadhaar document</div>
                    )}
                  </div>
                  {(aadhaarPdfSrc || app.identityDetails?.aadhaar) && (
                    <div className="document-preview-footer" style={{ display: "flex", justifyContent: "flex-end" }}>
                      {aadhaarPdfSrc && (
                        <span style={{ color: "var(--wise-green)", cursor: "pointer" }} onClick={() => openInNewTab(aadhaarPdfSrc)}>OPEN PDF ↗</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Aadhaar portrait photo */}
                {aadhaarPhotoSrc && (
                  <div className="document-preview-card" style={getSectionStyle("personal")}>
                    <span className="inspection-label">Aadhaar Portrait</span>
                    <div className="document-preview-frame">
                      <img src={aadhaarPhotoSrc} alt="Aadhaar portrait" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
                    </div>
                    <div className="document-preview-footer" style={{ textAlign: "right", color: "var(--wise-green)", cursor: "pointer" }} onClick={() => openInNewTab(aadhaarPhotoSrc)}>OPEN PHOTO ↗</div>
                  </div>
                )}

                {/* Manual PAN Upload / Fallback */}
                {(!panDocument?.path || app.panUpload?.filePreview) && (
                  <div className="document-preview-card" style={getSectionStyle("pan_upload")}>
{renderSectionBadge("pan_upload")}
                    <span className="inspection-label">PAN Upload</span>
                    <div className="document-preview-frame document-preview-frame--scroll">
                      {app.panUpload?.filePreview ? (
                        <img src={app.panUpload.filePreview} alt="PAN Upload" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
                      ) : panNumber && !panDocument?.path ? (
                        <div style={{ display: "flex", width: "100%", height: "100%", background: "#fdf8e2", padding: 12, flexDirection: "column", justifyContent: "center", fontSize: "0.75rem" }}>
                          <div style={{ fontSize: "0.55rem", fontWeight: 800, background: "#fff2b3", padding: "4px 8px", borderRadius: 4, color: "#8a6d00", marginBottom: 8, alignSelf: "flex-start" }}>VERIFIED</div>
                          <div style={{ fontWeight: 700, color: "var(--text-muted)", marginBottom: 2 }}>PAN</div>
                          <div style={{ fontSize: "1rem", fontWeight: 900, fontFamily: "monospace" }}>{panNumber}</div>
                        </div>
                      ) : (
                        <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No PAN upload</div>
                      )}
                    </div>
                    {app.panUpload?.filePreview && (
                      <div className="document-preview-footer" style={{ textAlign: "right", color: "var(--wise-green)", cursor: "pointer" }} onClick={() => openInNewTab(resolveAssetUrl(app.panUpload.filePreview))}>OPEN PAN ↗</div>
                    )}
                  </div>
                )}

                {/* DigiLocker Extracted PAN */}
                {panDocument?.path && (
                  <div className="document-preview-card" style={!app.panUpload?.filePreview ? getSectionStyle("pan_upload") : {}}>
                    {!app.panUpload?.filePreview && renderSectionBadge("pan_upload")}
                    <span className="inspection-label">DigiLocker PAN</span>
                    <div className="document-preview-frame document-preview-frame--scroll">
                      {isPdfDocumentPath(panDocument.path) ? (
                        <PdfThumbnail src={getSafePreviewUrl(resolveAssetUrl(panDocument.path))} label="PAN from DigiLocker" />
                      ) : (
                        <img src={getSafePreviewUrl(resolveAssetUrl(panDocument.path))} alt="PAN from DigiLocker" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
                      )}
                    </div>
                    <div className="document-preview-footer" style={{ textAlign: "right", color: "var(--wise-green)", cursor: "pointer" }} onClick={() => openInNewTab(resolveAssetUrl(panDocument.path))}>OPEN PDF ↗</div>
                  </div>
                )}

                {/* Signature Upload */}
                <div className="document-preview-card" style={getSectionStyle("signature")}>
{renderSectionBadge("signature")}
                  <span className="inspection-label">Wet Signature</span>
                  <div className="document-preview-frame" style={{ background: "white" }}>
                    {app.signature?.filePreview ? (
                      <img src={resolveAssetUrl(app.signature.filePreview)} alt="Signature" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
                    ) : (
                      <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No signature uploaded</div>
                    )}
                  </div>
                </div>

                {/* Financial Proof */}
                <div className="document-preview-card" onClick={() => app.financialProof?.filePreview && openInNewTab(app.financialProof.filePreview)} style={{ cursor: app.financialProof?.filePreview ? "pointer" : "default", ...getSectionStyle("financial_proof") }}>
{renderSectionBadge("financial_proof")}
                  <span className="inspection-label">Financial Proof</span>
                  <div className="document-preview-frame">
                    {app.financialProof?.filePreview ? (
                      app.financialProof.filePreview.includes('pdf') || app.financialProof.filePreview.startsWith('data:application/pdf') ? (
                        <iframe 
                          src={`${app.financialProof.filePreview}#toolbar=0&navpanes=0&scrollbar=0`} 
                          title="Financial Proof"
                        />
                      ) : (
                        <img src={app.financialProof.filePreview} alt="Financial Proof" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
                      )
                    ) : (
                      <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No proof provided</div>
                    )}
                  </div>
                  {app.financialProof?.filePreview && (
                    <div className="document-preview-footer" style={{ textAlign: "right", color: "var(--wise-green)" }}>OPEN IN NEW TAB ↗</div>
                  )}
                </div>

                {/* PEP Proof Preview */}
                {(String(app.personalDetails?.politicallyExposed).toLowerCase() === "yes" || app.personalDetails?.pepProofPreview || app.personalDetails?.pepProof) && (
                  <div className="document-preview-card" onClick={() => (app.personalDetails?.pepProofPreview || app.personalDetails?.pepProof) && openInNewTab(resolveAssetUrl(app.personalDetails.pepProofPreview || app.personalDetails.pepProof))} style={{ cursor: "pointer", ...getSectionStyle("pep_proof") }}>
{renderSectionBadge("pep_proof")}
                    <span className="inspection-label" style={{ color: "var(--wise-green)" }}>PEP Proof</span>
                    <div className="document-preview-frame document-preview-frame--scroll">
                      {app.personalDetails?.pepProofPreview || app.personalDetails?.pepProof ? (
                        isPdfDocumentPath(app.personalDetails?.pepProofPreview || app.personalDetails?.pepProof) ? (
                          <PdfThumbnail src={getSafePreviewUrl(resolveAssetUrl(app.personalDetails.pepProofPreview || app.personalDetails.pepProof))} label="PEP Proof" />
                        ) : (
                          <img src={getSafePreviewUrl(resolveAssetUrl(app.personalDetails.pepProofPreview || app.personalDetails.pepProof))} alt="PEP Proof" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
                        )
                      ) : (
                        <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No PEP proof</div>
                      )}
                    </div>
                    {(app.personalDetails?.pepProofPreview || app.personalDetails?.pepProof) && (
                      <div className="document-preview-footer" style={{ textAlign: "right", color: "var(--wise-green)" }} onClick={() => openInNewTab(getSafePreviewUrl(resolveAssetUrl(app.personalDetails.pepProofPreview || app.personalDetails.pepProof)))}>VIEW FULL ↗</div>
                    )}
                  </div>
                )}

                {/* Signed Application (eSign) */}
                {esignDocument?.path && (
                  <div className="document-preview-card" style={{ border: "1px solid var(--wise-green)" }}>
                    <span className="inspection-label" style={{ color: "var(--wise-green)" }}>eSigned Application</span>
                    <div className="document-preview-frame document-preview-frame--scroll">
                      {isPdfDocumentPath(esignDocument.path) ? (
                        <PdfThumbnail src={getSafePreviewUrl(resolveAssetUrl(esignDocument.path))} label="eSigned PDF" />
                      ) : (
                        <img src={getSafePreviewUrl(resolveAssetUrl(esignDocument.path))} alt="eSigned Document" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
                      )}
                    </div>
                    <div className="document-preview-footer" style={{ textAlign: "right", color: "var(--wise-green)", cursor: "pointer" }} onClick={() => openInNewTab(getSafePreviewUrl(resolveAssetUrl(esignDocument.path)))}>OPEN PDF ↗</div>
                  </div>
                )}
              </div>

            </section>

            <section className="card" style={{ padding: 40, ...getSectionStyle("pricing") }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 900, display: "flex", alignItems: "center", gap: 12, margin: 0 }}>
                  <div style={{ width: 4, height: 20, background: "var(--wise-green)", borderRadius: 2 }}></div>
                  Raw System Metadata
                </h3>
                <button 
                  onClick={() => setShowMetadata(true)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", fontSize: "0.8rem", fontWeight: 800, cursor: "pointer" }}
                >
                  View Metadata
                </button>
              </div>
            </section>
          </div>

          {/* Right Sidebar: Actions & Scores */}
          <div style={{ position: "sticky", top: 20, height: "fit-content", display: "flex", flexDirection: "column", gap: 12, alignSelf: "start" }}>
            


            <div className="card" style={{ padding: 20, border: pendingStep !== null && pendingStep !== app.currentStep ? "2px solid var(--wise-green)" : "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="inspection-label">Progress</span>
                {pendingStep !== null && pendingStep !== app.currentStep && (
                  <span style={{ fontSize: "0.6rem", color: "var(--wise-green)", fontWeight: 800 }}>CHANGED</span>
                )}
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--wise-green)", marginTop: 4 }}>{STEP_LABELS[app.currentStep] || "Unknown Step"}</div>
              <select 
                className="admin-select" 
                style={{ width: "100%", marginTop: 12, height: 40, fontSize: "0.8rem" }}
                value={pendingStep !== null ? pendingStep : app.currentStep}
                onChange={e => setPendingStep(parseInt(e.target.value))}
              >
                {Object.entries(STEP_LABELS).map(([num, label]) => <option key={num} value={num}>{label}</option>)}
              </select>
              {pendingStep !== null && pendingStep !== app.currentStep && (
                <button 
                  onClick={() => updateStatus(app.status, { currentStep: pendingStep })}
                  style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 8, background: "var(--wise-green)", color: "white", border: "none", fontWeight: 800, cursor: "pointer", fontSize: "0.85rem", boxShadow: "0 4px 12px rgba(48, 164, 108, 0.3)" }}
                >
                  Save Step Change
                </button>
              )}
            </div>



            <style>{`
              @keyframes pulse {
                0% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(1.2); }
                100% { opacity: 1; transform: scale(1); }
              }
            `}</style>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
              <button 
                onClick={() => {
                  if (getRejectedStepsCount() > 0) {
                    showToast("Cannot approve: Some documents or steps are marked as rejected.", "error");
                    return;
                  }
                  updateStatus("verified");
                }}
                style={{ width: "100%", padding: 16, borderRadius: 16, background: "#30a46c", color: "white", border: "none", fontWeight: 900, fontSize: "1.1rem", cursor: "pointer" }}
              >
                Approve Application
              </button>
              <button 
                onClick={() => setShowReject(true)}
                style={{ width: "100%", padding: 16, borderRadius: 16, background: "rgba(229,72,77,0.1)", color: "#e5484d", border: "none", fontWeight: 800, cursor: "pointer" }}
              >
                Reject Application
              </button>
              <button 
                onClick={() => updateStatus("on_hold")}
                style={{ width: "100%", padding: 12, borderRadius: 16, background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-color)", fontWeight: 700, cursor: "pointer" }}
              >
                Place on Hold
              </button>
            </div>

            {showReject && (
              <div className="card" style={{ padding: 24, border: "2px solid #e5484d", background: "rgba(229,72,77,0.05)" }}>
                <span className="inspection-label" style={{ color: "#e5484d" }}>Specify Reason</span>
                <textarea 
                  className="admin-input" 
                  style={{ width: "100%", marginTop: 12, minHeight: 80 }}
                  placeholder="e.g. Incomplete documentation..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
                <button 
                  onClick={() => { if (rejectReason) updateStatus("rejected"); }}
                  style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 12, background: "#e5484d", color: "white", border: "none", fontWeight: 800, cursor: "pointer" }}
                >
                  Confirm Rejection
                </button>
              </div>
            )}
            
            <div style={{ marginTop: 24, padding: 24, border: "1px dashed var(--border-color)", borderRadius: 16 }}>
              <button 
                onClick={() => {
                  if (confirm("DANGER: This will PERMANENTLY remove this KYC application from the database. This action cannot be undone. Proceed?")) {
                    const deleteUser = confirm("Do you also want to DELETE the USER ACCOUNT associated with this application? (Select Cancel to keep the user but delete the KYC data)");
                    
                    fetchWithFallback(`/api/admin/application/${id}${deleteUser ? "?deleteUser=true" : ""}`, {
                      method: "DELETE",
                      headers: { "Authorization": `Bearer ${localStorage.getItem("adminToken")}` }
                    }).then(r => r.json()).then(data => {
                      if (data.success) {
                        alert(data.message);
                        router.push("/admin");
                      } else {
                        showToast(data.error || "Delete failed", "error");
                      }
                    }).catch(() => showToast("Network error during deletion", "error"));
                  }
                }}
                style={{ width: "100%", padding: "12px", borderRadius: 12, background: "transparent", color: "#e5484d", border: "1px solid #e5484d", fontSize: "0.8rem", fontWeight: 800, cursor: "pointer" }}
              >
                Delete KYC Request
              </button>
              <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 12, textAlign: "center", lineHeight: 1.4 }}>
                Caution: Deleting will remove all uploaded documents, biometric data, and progress history for this request.
              </p>
            </div>
          </div>
        </div>
      </main>

      {toast && (
        <div style={{ position: "fixed", bottom: 40, left: "50%", transform: "translateX(-50%)", background: "white", border: `2px solid ${toast.type === "success" ? "#30a46c" : "#e5484d"}`, color: toast.type === "success" ? "#30a46c" : "#e5484d", borderRadius: 99, padding: "16px 32px", fontWeight: 800, zIndex: 1000001, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
          {toast.type === "success" ? "✓ " : "⚠ "}{toast.msg}
        </div>
      )}
        </div>
      </div>
    );
  }
