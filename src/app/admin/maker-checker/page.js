"use client";
import { Fragment, useState, useEffect, useRef, useMemo } from "react";
import { downloadExcel, downloadGroupedExcel } from "@/utils/exportExcel";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/utils/apiConfig";
import { io } from "socket.io-client";
import AdminSidebar from "../components/AdminSidebar";
import AdminThemeToggle from "../components/AdminThemeToggle";
import { useDragScroll } from "@/utils/useDragScroll";
import { ListFilter, ArrowUpDown, ArrowUp, ArrowDown, EyeOff } from "lucide-react";
import "@/app/admin/admin.css";

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
  14: "Step 14: eSign Done"
};

// Same as the Pricing Plan module's formatBoid: long stored BOIDs → 16-char DP ID + Client ID
const formatBoid = (boidNum) => {
  if (!boidNum) return "N/A";
  const b = String(boidNum).trim();
  if (b.length > 16) return b.slice(0, 8) + b.slice(-10, -2);
  return b;
};

const STATUS_MAP = { 
  pending: "badge-pending", 
  under_review: "badge-review",
  identity_verified: "badge-verified",
  verified: "badge-verified", 
  rejected: "badge-rejected", 
  on_hold: "badge-suspended",
  approved: "badge-verified"
};

const FRONTEND_STEP_TITLE_MAP = {
  phoneVerification: "Phone", emailVerification: "Email", pricingSelection: "Pricing",
  panVerification: "PAN", digilocker: "DigiLocker", personalDetails: "Personal",
  nomineeChoice: "Nominee Choice", nomineeDetails: "Nominee", nomineeAllocation: "Nominee Allocation",
  bankVerification: "Bank", financialProof: "Financial Proof", signature: "Signature",
  panUpload: "PAN Upload", ipv: "IPV/Selfie", pepProof: "PEP Proof",
  nominee1Proof: "Nominee 1", nominee2Proof: "Nominee 2", nominee3Proof: "Nominee 3",
  guardian1Proof: "Guardian 1", guardian2Proof: "Guardian 2", guardian3Proof: "Guardian 3",
  ovdRequest: "OVD Requested",
  esignPreview: "eSign Preview", aadhaarEsign: "Aadhaar eSign", completion: "Completion"
};

export default function MakerCheckerDashboard() {
  const router = useRouter();
  const [kycs, setKycs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("in_progress");
  const [stageFilter, setStageFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [adminUser, setAdminUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openStatusMenuId, setOpenStatusMenuId] = useState(null);
  const [openRejectionsId, setOpenRejectionsId] = useState(null);
  const [rejectionsPopPos, setRejectionsPopPos] = useState(null); // where the open rejections popup sits on screen
  const rejectionsAnchorRef = useRef(null); // the chip the open popup belongs to
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [changeStatusAppId, setChangeStatusAppId] = useState(null);
  const [pendingStep, setPendingStep] = useState(null);
  const [furthestStep, setFurthestStep] = useState(null); // furthest step the open application has reached
  const [copiedKey, setCopiedKey] = useState(null);
  const handleCopy = (e, text, key) => {
    e.stopPropagation();
    if (!text || text === "N/A" || text === "—") return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleFilterChange = (f) => {
    setFilter(f);
    setFilterOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("makerCheckerFilter", f);
      const url = new URL(window.location);
      url.searchParams.set("filter", f);
      window.history.replaceState({}, '', url);
    }
  };

  const PERMANENT_COLUMNS = ["S.No.", "Actions", "Name", "Client Code", "PAN"];
  const NO_FILTER_SORT_COLUMNS = ["S.No.", "Actions"]; // nothing useful to filter or sort by
  const PERMANENT_WIDTHS = {
    // S.No. and Actions are kept narrow (tighter padding, no filter/sort) so they don't take much space
    "S.No.": 56,
    "Actions": 76,
    "Name": 180,
    "Client Code": 170, // room for the header's filter and sort icons
    "PAN": 130
  };
  const ALL_COLUMNS = ["S.No.", "Actions", "Name", "Client Code", "KYC ID", "BOID", "Number", "Email", "PAN", "Aadhaar", "DOB", "Gender", "Father Name", "Mother Name", "Bank Name", "Account No", "IFSC", "MICR", "Nominees", "Address", "City", "State", "Pincode", "Occupation", "Annual Income", "Step", "Stage", "STK Status", "Globe Status", "STK Approved At", "STK Rejected At", "Globe Approved At", "Globe Rejected At", "E-Stamp Certificate No", "E-Stamp Serial No", "Start Date", "eSign Date", "Date", "Pennydrop Verify", "Aadhaar Seeding", "LiveImage Time", "Sign Upload Time", "Segments Selected", "Total Nominees", "Nominee Opt Date"];
  // Rejections are shown inside the STK Status / Globe Status columns (by who made them)
  const [visibleColumns, setVisibleColumns] = useState(["S.No.", "Actions", "Name", "Client Code", "KYC ID", "Number", "Step", "Stage", "STK Status", "Globe Status", "E-Stamp Certificate No", "E-Stamp Serial No", "Start Date", "eSign Date", "Date"]);
  const [orderedColumns, setOrderedColumns] = useState(ALL_COLUMNS);
  const [draggedColumn, setDraggedColumn] = useState(null);
  const [columnFilters, setColumnFilters] = useState({});
  const [columnValueFilters, setColumnValueFilters] = useState({}); // { [column]: [selected values] }
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [filterPopupPos, setFilterPopupPos] = useState(null); // screen position of the open column-filter popup

  // The column-filter popup is drawn above the page (so the table can't clip it); close it if the
  // page or table scrolls/resizes so it never drifts away from its column
  useEffect(() => {
    if (!activeFilterCol) return;
    const close = (e) => {
      if (e?.target?.closest && e.target.closest('.column-filter-container')) return; // scrolling inside the popup
      setActiveFilterCol(null);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [activeFilterCol]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnSearch, setColumnSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [stageFilterOpen, setStageFilterOpen] = useState(false);
  const [columnsLoaded, setColumnsLoaded] = useState(false);

  const scrollRef = useDragScroll();

  // Fixed columns first (sticky), then the rest in the user's dragged order
  const displayColumns = [
    ...PERMANENT_COLUMNS,
    ...orderedColumns.filter(h => !PERMANENT_COLUMNS.includes(h) && visibleColumns.includes(h)),
  ];

  const getStickyStyle = (colName, isHeader = false) => {
    if (!PERMANENT_COLUMNS.includes(colName)) return {};
    let left = 0;
    for (const c of PERMANENT_COLUMNS) {
      if (c === colName) break;
      left += PERMANENT_WIDTHS[c];
    }
    return {
      position: "sticky",
      left,
      zIndex: isHeader ? 11 : 10,
      minWidth: PERMANENT_WIDTHS[colName],
      maxWidth: PERMANENT_WIDTHS[colName],
      width: PERMANENT_WIDTHS[colName],
      ...(colName === "S.No." || colName === "Actions" ? { paddingLeft: 8, paddingRight: 8 } : {}),
      // Same colour as the other headers / cells, so the frozen columns don't stand out
      backgroundColor: isHeader ? "var(--bg-secondary)" : "var(--bg-sticky)",
      boxShadow: "none",
    };
  };


  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("makerCheckerVisibleColumns");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // The old "Rejections" column became the rejections shown under STK Status / Globe Status —
          // a layout that showed it now shows both status columns. Unknown columns are dropped.
          const mapped = parsed.flatMap(c => c === "Status" ? ["STK Status"] : c === "E-Stamp" ? ["E-Stamp Certificate No", "E-Stamp Serial No"] : c === "Rejections" ? ["STK Status", "Globe Status"] : [c]);
          setVisibleColumns([...new Set(mapped)].filter(c => ALL_COLUMNS.includes(c)));
        } catch (e) {
          console.error("Failed to parse visible columns", e);
        }
      }
      const savedOrder = localStorage.getItem("makerCheckerOrderedColumns");
      if (savedOrder) {
        try {
          const parsedOrder = JSON.parse(savedOrder);
          const mappedOrder = [...new Set(parsedOrder.flatMap(c => c === "Status" ? ["STK Status"] : c === "E-Stamp" ? ["E-Stamp Certificate No", "E-Stamp Serial No"] : [c]))]
            .filter(c => ALL_COLUMNS.includes(c)); // removed columns (e.g. "Rejections") are dropped
          // Columns added later (e.g. BOID) are placed right after their neighbour in ALL_COLUMNS,
          // so they don't end up at the far right of an older saved layout
          ALL_COLUMNS.forEach((c, i) => {
            if (mappedOrder.includes(c)) return;
            const prev = ALL_COLUMNS.slice(0, i).reverse().find(p => mappedOrder.includes(p));
            mappedOrder.splice(prev ? mappedOrder.indexOf(prev) + 1 : 0, 0, c);
          });
          setOrderedColumns(mappedOrder);
        } catch (e) {
          console.error("Failed to parse ordered columns", e);
        }
      }
    }
    setColumnsLoaded(true);
  }, []);

  useEffect(() => {
    if (columnsLoaded && typeof window !== "undefined") {
      localStorage.setItem("makerCheckerVisibleColumns", JSON.stringify(visibleColumns));
      localStorage.setItem("makerCheckerOrderedColumns", JSON.stringify(orderedColumns));
    }
  }, [visibleColumns, orderedColumns, columnsLoaded]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.action-menu-container')) {
        setOpenMenuId(null);
      }
      if (!e.target.closest('.columns-dropdown-container')) {
        setColumnsOpen(false);
      }
      if (!e.target.closest('.filter-dropdown-container')) {
        setFilterOpen(false);
      }
      if (!e.target.closest('.stage-dropdown-container')) {
        setStageFilterOpen(false);
      }
      if (!e.target.closest('.status-dropdown-container')) {
        setOpenStatusMenuId(null);
      }
      if (!e.target.closest('.rejections-dropdown-container')) {
        setOpenRejectionsId(null);
      }
      if (!e.target.closest('.column-filter-container')) {
        setActiveFilterCol(null);
      }
      if (!e.target.closest('.date-filter-dropdown-container')) {
        setDateFilterOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Change Progress: steps up to the furthest one the user has reached can be chosen (so moving an
  // application back can be undone); only steps beyond it are locked
  useEffect(() => {
    if (!changeStatusAppId) { setFurthestStep(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem("adminToken");
        const res = await fetch(`${API_BASE_URL}/api/admin/review/${changeStatusAppId}/furthest-step`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!cancelled && data.success) setFurthestStep(Number(data.furthestStep));
      } catch (e) {
        // keeps the safe default (current step)
      }
    })();
    return () => { cancelled = true; };
  }, [changeStatusAppId]);

  // The rejections popup is drawn above the page (so the table never clips it). It opens below its chip,
  // or above it when there is not enough room below, and stays on screen.
  const getRejectionsPopPos = (chip) => {
    const r = chip.getBoundingClientRect();
    const W = 320, GAP = 8;
    const spaceBelow = window.innerHeight - r.bottom - GAP;
    const spaceAbove = r.top - GAP;
    const above = spaceBelow < 260 && spaceAbove > spaceBelow;
    const left = Math.min(Math.max(12, r.left), window.innerWidth - W - 12);
    return above
      ? { left, bottom: window.innerHeight - r.top + GAP, maxHeight: Math.min(380, spaceAbove - 12) }
      : { left, top: r.bottom + GAP, maxHeight: Math.min(380, spaceBelow - 12) };
  };
  // While open, it follows its chip when the page or table scrolls; it closes once the chip leaves the screen
  useEffect(() => {
    if (!openRejectionsId) return;
    const follow = (e) => {
      if (e?.target?.closest?.(".mc-rej-pop")) return; // scrolling the popup's own list
      const chip = rejectionsAnchorRef.current;
      const r = chip?.isConnected ? chip.getBoundingClientRect() : null;
      if (!r || r.bottom < 0 || r.top > window.innerHeight) { setOpenRejectionsId(null); return; }
      setRejectionsPopPos(getRejectionsPopPos(chip));
    };
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [openRejectionsId]);

  const handleContinueJourney = async (k) => {
    try {
      const adminToken = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/application/${k.id}/generate-token`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("kycApplicationId", k.id);
        sessionStorage.setItem("kycApplicationId", k.id);
        localStorage.setItem("kycToken", data.token);
        sessionStorage.setItem("kycToken", data.token);
        localStorage.setItem("token", data.token);
        window.open("/", "_blank");
      } else {
        alert(data.error || "Failed to generate session for user");
      }
    } catch (e) {
      console.error("Error continuing journey:", e);
      alert("Error starting journey");
    }
  };

  const deleteUser = async (applicationId) => {
    if (!confirm("Move this application to the Trash? You can restore it or delete it permanently from the Trash.")) return;
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/application/${applicationId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        alert("Application moved to Trash");
        fetchApplications(true);
      } else {
        alert(data.error || "Failed to delete");
      }
    } catch (e) {
      alert("Error deleting application");
    }
  };

  const sendToBackoffice = async (applicationId) => {
    if (!confirm("Are you sure you want to send this user's data to the Backoffice?")) return;
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/application/${applicationId}/send-backoffice`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        alert("Sent to Backoffice successfully");
        fetchApplications(true);
      } else {
        alert(data.error || "Failed to send to Backoffice");
      }
    } catch (e) {
      alert("Error sending to Backoffice");
    }
  };

  const [bulkPushing, setBulkPushing] = useState(false);

  // Pushes every application approved by Admin + Globe that has not been pushed yet
  const bulkSendToBackoffice = async () => {
    if (!confirm("Push all applications that are Admin verified, Globe approved and not yet pushed to the Backoffice?")) return;
    setBulkPushing(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/backoffice/bulk-send`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || "Bulk push to Backoffice failed");
      } else if (data.total === 0) {
        alert("No pending applications to push");
      } else if (data.failedCount === 0) {
        alert(`Pushed ${data.pushedCount} application(s) to Backoffice`);
      } else {
        const failedLines = data.failed.map(f => `${f.applicationId}: ${f.error}`).join("\n");
        alert(`Pushed ${data.pushedCount}, failed ${data.failedCount}:\n${failedLines}`);
      }
      fetchApplications(true);
    } catch (e) {
      alert("Error during bulk push to Backoffice");
    } finally {
      setBulkPushing(false);
    }
  };

  const updateStatus = async (applicationId, status, extra = {}) => {
    if (status === "verified") {
      const kycApp = kycs.find((k) => k.id === applicationId);
      if (kycApp && (kycApp.stepNum || 0) < 14) {
        if (!confirm(`This application is only at Step ${kycApp.stepNum || 0}/14. Are you sure you want to approve it?`)) {
          return;
        }
      }
    }
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`${API_BASE_URL}/api/admin/review/${applicationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status, currentStep: extra.currentStep })
      });
      const data = await response.json();
      if (data.success) {
        alert(`Status updated successfully`);
        fetchApplications(true);
      } else {
        alert(data.error || "Operation failed");
      }
    } catch (err) {
      alert("Operation failed");
    }
  };

  useEffect(() => {
    const userStr = localStorage.getItem("adminUser");
    if (userStr && userStr !== "undefined") {
      try {
        setAdminUser(JSON.parse(userStr));
      } catch (e) {
        console.error("Failed to parse adminUser", e);
      }
    }
  }, []);

  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        window.location.href = "/admin/login";
        return;
      }
      try {
        setIsAuthenticated(true);
      } catch (e) {
        console.error("Token verification failed", e);
        setIsAuthenticated(true);
      } finally {
        setLoadingAuth(false);
      }
    };
    verifyToken();
  }, []);


  useEffect(() => {
    if (typeof window !== "undefined") {
      // "On Hold" is no longer a filter — a remembered one falls back to the default
      const storedFilter = localStorage.getItem("makerCheckerFilter");
      const savedFilter = storedFilter === "on_hold" ? null : storedFilter;
      const urlParams = new URLSearchParams(window.location.search);
      const filterParam = urlParams.get("filter");
      
      if (filterParam) {
        setFilter(filterParam);
        localStorage.setItem("makerCheckerFilter", filterParam);
      } else if (savedFilter) {
        setFilter(savedFilter);
        const url = new URL(window.location);
        url.searchParams.set("filter", savedFilter);
        window.history.replaceState({}, '', url);
      } else {
        setFilter("in_progress");
      }
    }
  }, []);

  // One table row from an application returned by the API (used by the table and the exports)
  const mapApplication = (app) => {
    let parsedPersonal = {};
    try { parsedPersonal = typeof app.personalDetails === "string" ? JSON.parse(app.personalDetails) : (app.personalDetails || {}); } catch(e) {}
    
    let parsedIdentity = {};
    try { parsedIdentity = typeof app.identityDetails === "string" ? JSON.parse(app.identityDetails) : (app.identityDetails || {}); } catch(e) {}
    
    let parsedEsign = {};
    try { parsedEsign = typeof app.esignDetails === "string" ? JSON.parse(app.esignDetails) : (app.esignDetails || {}); } catch(e) {}
    
    let parsedBank = {};
    try { parsedBank = typeof app.bankDetails === "string" ? JSON.parse(app.bankDetails) : (app.bankDetails || {}); } catch(e) {}
    
    let parsedAddress = {};
    try { 
      parsedAddress = typeof app.address === "string" ? JSON.parse(app.address) : (app.address || parsedPersonal.address || {}); 
      if (typeof parsedAddress === "string") {
        try { parsedAddress = JSON.parse(parsedAddress); } catch(e) {}
      }
    } catch(e) {}
    
    let parsedNominee = {};
    try { parsedNominee = typeof app.nomineeDetails === "string" ? JSON.parse(app.nomineeDetails) : (app.nomineeDetails || {}); } catch(e) {}

    let parsedSelfie = {};
    try { parsedSelfie = typeof app.selfieDetails === "string" ? JSON.parse(app.selfieDetails) : (app.selfieDetails || {}); } catch(e) {}
    
    let parsedSignature = {};
    try { parsedSignature = typeof app.signature === "string" ? JSON.parse(app.signature) : (app.signature || {}); } catch(e) {}

    let parsedSegments = {};
    try { parsedSegments = typeof app.segments === "string" ? JSON.parse(app.segments) : (app.segments || {}); } catch(e) {}

    let parsedOcr = {};
    try { parsedOcr = typeof app.ocrData === "string" ? JSON.parse(app.ocrData) : (app.ocrData || {}); } catch(e) {}
    
    let parsedDocuments = [];
    try { parsedDocuments = typeof app.documents === "string" ? JSON.parse(app.documents) : (app.documents || []); } catch(e) {}

    let parsedStepStatuses = {};
    try { parsedStepStatuses = typeof app.stepStatuses === "string" ? JSON.parse(app.stepStatuses) : (app.stepStatuses || {}); } catch(e) {}
    
    // Rejections split by who made them — shown under the STK Status / Globe Status columns.
    // A rejection that doesn't say who made it is shown under STK, marked "source unknown".
    const stkRejections = [];
    const globeRejections = [];
    const addRejection = (side, label, reason, unknownSource = false) =>
      (side === "Globe" ? globeRejections : stkRejections).push({ label, reason: reason || "No reason provided", unknownSource });
    Object.entries(parsedStepStatuses)
      .filter(([step, info]) => !step.startsWith("_") && info?.status === "rejected")
      .forEach(([step, info]) => addRejection(info.rejectedBy, info.docLabel || FRONTEND_STEP_TITLE_MAP[step] || step, info.reason, !info.rejectedBy));
    // Document rejections marked but not yet mailed count too
    const pendingDocLabels = parsedStepStatuses._pendingDocumentRejectionLabels || {};
    const pendingDocBy = parsedStepStatuses._pendingDocumentRejectionBy || {};
    Object.entries(parsedStepStatuses._pendingDocumentRejections || {}).forEach(([src, reason]) => {
      addRejection(pendingDocBy[src], pendingDocLabels[src] || "Document", reason, !pendingDocBy[src]);
    });
    // Whole-application rejections (no single step) — their reason
    if (stkRejections.length === 0 && app.status === "rejected" && app.rejectionReason) addRejection("STK", "Application", app.rejectionReason);
    if (globeRejections.length === 0 && app.globeStatus === "rejected" && app.globeRemarks) addRejection("Globe", "Application", app.globeRemarks);

    // Export text: every rejection with who made it
    const rejectionsText = [
      ...stkRejections.map(r => `STK: ${r.label}: ${r.reason}`),
      ...globeRejections.map(r => `Globe: ${r.label}: ${r.reason}`),
    ].join(" | ") || "None";

    const aadhaarRaw = parsedIdentity.aadhaarNumber || parsedIdentity.aadhaar || parsedIdentity.uid || parsedIdentity.maskedAadhaar || parsedPersonal.aadhaar || "";
    const aadhaarFormatted = aadhaarRaw ? (String(aadhaarRaw).length >= 4 ? `xxxxxxxx${String(aadhaarRaw).slice(-4)}` : String(aadhaarRaw)) : "N/A";

    const rawAddr = [
      parsedAddress.line1 || parsedAddress.addressLine1 || (typeof parsedAddress === "object" ? parsedAddress.address : null),
      parsedAddress.line2 || parsedAddress.addressLine2,
      parsedAddress.line3 || parsedAddress.addressLine3,
      parsedAddress.street || parsedAddress.locality
    ].filter(Boolean).join(", ") || (typeof parsedAddress === "string" ? parsedAddress : "") || parsedPersonal.address || "N/A";

    const rawCity = parsedAddress.city || parsedAddress.district || parsedPersonal.city || parsedPersonal.district || "N/A";
    const rawState = parsedAddress.state || parsedPersonal.state || "N/A";
    const rawPincode = parsedAddress.pincode || parsedAddress.pinCode || parsedAddress.zip || parsedPersonal.pincode || parsedPersonal.pinCode || "N/A";

    return {
      id: app.applicationId,
      boid: formatBoid(app.user?.boid || app.user?.boidAssigned?.boidNumber),
      dbId: app.id,
      clientCode: app.clientCode,
      number: app.user?.phone || parsedPersonal.phone || parsedPersonal.mobile || "N/A",
      email: app.user?.email || parsedPersonal.email || "N/A",
      name: parsedPersonal.fullName || parsedPersonal.name || parsedIdentity.name || "N/A",
      pan: parsedIdentity.panNumber || parsedIdentity.pan || parsedPersonal.pan || parsedPersonal.panNumber || "N/A",
      eStampCertNo: app.user?.eStampAssigned?.certificateNo || app.user?.eStamp || "N/A",
      eStampSerialNo: app.user?.eStampAssigned?.serialNo || "N/A",
      stepNum: app.currentStep || 0,
      stepLabel: STEP_LABELS[app.currentStep] || "Onboarding",
      type: "Full KYC",
      status: app.status,
      rejectionSent: !!app.rejectionSent, // "Send Rejection Mail" clicked — only then is it shown as REJECTED
      globeStatus: app.globeStatus || "pending",
      stkApprovedAt: app.stkApprovedAt ? new Date(app.stkApprovedAt).toLocaleString("en-IN") : "N/A",
      stkRejectedAt: app.stkRejectedAt ? new Date(app.stkRejectedAt).toLocaleString("en-IN") : "N/A",
      globeApprovedAt: app.globeApprovedAt ? new Date(app.globeApprovedAt).toLocaleString("en-IN") : "N/A",
      globeRejectedAt: app.globeRejectedAt ? new Date(app.globeRejectedAt).toLocaleString("en-IN") : "N/A",
      isResubmitted: app.isResubmitted,
      riskScore: app.riskScore || 0,
      faceMatch: app.faceMatchScore || 0,
      startDate: app.createdAt ? new Date(app.createdAt).toLocaleString("en-IN") : "N/A",
      esignDate: parsedEsign.timestamp || parsedEsign.signedAt || (app.currentStep >= 14 ? new Date(app.updatedAt).toLocaleString("en-IN") : "Pending"),
      submittedAt: new Date(app.updatedAt || app.createdAt).toLocaleString(),
      aadhaar: aadhaarFormatted,
      dob: parsedPersonal.dob || parsedPersonal.dateOfBirth || parsedIdentity.dob || "N/A",
      gender: parsedPersonal.gender || parsedIdentity.gender || "N/A",
      fatherName: parsedPersonal.fatherName || parsedPersonal.father_name || parsedPersonal.father || "N/A",
      motherName: parsedPersonal.motherName || parsedPersonal.mother_name || parsedPersonal.mother || "N/A",
      bankName: parsedBank.bankName || parsedBank.bank_name || parsedBank.name || "N/A",
      accountNo: parsedBank.accountNumber || parsedBank.account_number || parsedBank.accountNo || "N/A",
      ifsc: parsedBank.ifsc || parsedBank.ifscCode || parsedBank.ifsc_code || "N/A",
      micr: parsedBank.micr || parsedOcr?.bank?.micr || "N/A",
      nominees: Array.isArray(parsedNominee.nominees) ? parsedNominee.nominees.length : (parsedNominee.nominees ? 1 : 0),
      address: rawAddr,
      city: rawCity,
      state: rawState,
      pincode: rawPincode,
      occupation: parsedPersonal.occupation || "N/A",
      annualIncome: parsedPersonal.annualIncome || parsedPersonal.annual_income || "N/A",
      rejections: rejectionsText, // export only
      stkRejections,
      globeRejections,
      pennydropVerify: parsedBank.verified ? "Verified" : (parsedBank.pennyDropStatus || "Pending"),
      aadhaarSeeding: parsedOcr.pan_verification?.data?.aadhaar_seeding_status?.toUpperCase() || parsedIdentity.pan_verification?.aadhaar_seeding_status?.toUpperCase() || parsedIdentity.aadhaarSeedingStatus || parsedIdentity.seedingStatus || "N/A",
      liveImageTime: parsedSelfie.extractedAt || parsedSelfie.timestamp || parsedSelfie.uploadedAt ? new Date(parsedSelfie.extractedAt || parsedSelfie.timestamp || parsedSelfie.uploadedAt).toLocaleString("en-IN") : "N/A",
      signUploadTime: parsedSignature.timestamp || parsedSignature.uploadedAt ? new Date(parsedSignature.timestamp || parsedSignature.uploadedAt).toLocaleString("en-IN") : (parsedSignature.filePreview ? (new Date(app.updatedAt).toLocaleString("en-IN")) : "N/A"),
      segmentsSelected: Object.keys(parsedSegments).filter(k => parsedSegments[k] === true || parsedSegments[k] === "true").join(", ") || "None",
      totalNominees: parsedNominee.numberOfNominees || (Array.isArray(parsedNominee.nominees) ? parsedNominee.nominees.length : (parsedNominee.nominees ? 1 : 0)),
      nomineeOptDate: parsedNominee.optInDate || parsedNominee.optOutDate || parsedNominee.timestamp ? new Date(parsedNominee.optInDate || parsedNominee.optOutDate || parsedNominee.timestamp).toLocaleString("en-IN") : (parsedNominee.opted ? new Date(app.updatedAt).toLocaleString("en-IN") : "N/A"),
    };
  };

  // List API URL with the current filter, stage and dates (the search box is applied here, see matchesSearch)
  const buildListUrl = (pageNum, limit) => {
    const url = new URL(`${API_BASE_URL}/api/agent/applications`);
    if (filter !== "all") url.searchParams.append("status", filter);
    if (stageFilter !== "all") url.searchParams.append("stage", stageFilter);
    if (dateRange.start) url.searchParams.append("startDate", dateRange.start);
    if (dateRange.end) url.searchParams.append("endDate", dateRange.end);
    url.searchParams.append("page", pageNum);
    url.searchParams.append("limit", limit);
    return url;
  };

  // The search box looks only at the columns shown in the table — exactly the text in their cells
  const matchesSearch = (k) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return displayColumns.some(col => String(getCellValue(k, col) ?? "").toLowerCase().includes(term));
  };

  // Every application of the current filter / stage / dates (all pages). Kept while the same filters stay
  // selected, so typing in the search box or paging through the matches doesn't reload the whole list.
  const allRowsCacheRef = useRef(null);
  const loadAllRows = async (fresh = false) => {
    const key = JSON.stringify([filter, stageFilter, dateRange.start, dateRange.end]);
    if (!fresh && allRowsCacheRef.current?.key === key) return allRowsCacheRef.current.rows;
    const token = localStorage.getItem("adminToken");
    const all = [];
    for (let p = 1; ; p++) {
      const res = await fetch(buildListUrl(p, 200), { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
        window.location.href = "/admin/login";
        throw new Error("Unauthorized");
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || data.message || "Failed to load applications");
      const apps = data.applications || [];
      all.push(...apps.map(mapApplication));
      if (apps.length < 200 || p >= (data.totalPages || 1)) break;
    }
    allRowsCacheRef.current = { key, rows: all };
    return all;
  };

  // Only the latest request may update the list — an older, slower search response must not overwrite it
  const fetchSeqRef = useRef(0);
  const fetchApplications = async (isSilent = false) => {
    if (typeof window === "undefined") return;
    const seq = ++fetchSeqRef.current;
    if (!isSilent) setLoading(true);
    try {
      if (search.trim()) {
        // Searching: match the visible columns across every page, then show this page of the matches.
        // A silent refresh (after a change / live update) reloads the list instead of using the kept one.
        const rows = (await loadAllRows(isSilent)).filter(matchesSearch);
        if (seq !== fetchSeqRef.current) return;
        setTotal(rows.length);
        setTotalPages(Math.max(1, Math.ceil(rows.length / 15)));
        setKycs(rows.slice((page - 1) * 15, page * 15));
        return;
      }

      const url = buildListUrl(page, 15);

      const token = localStorage.getItem("adminToken");
      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.status === 401) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
        window.location.href = "/admin/login";
        return;
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (seq !== fetchSeqRef.current) return;
        if (data.success) {
          setTotal(data.total);
          setTotalPages(data.totalPages);
          const mapped = data.applications.map(mapApplication);
          setKycs(mapped);
        }
      }
    } catch (err) {
      console.error("Fetch failed", err);
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [filter, search, stageFilter, dateRange]);

  useEffect(() => {
    if (loadingAuth || !isAuthenticated) return;
    const t = setTimeout(() => {
      fetchApplications();
    }, 500);
    return () => clearTimeout(t);
  }, [search]);

  // Showing / hiding a column changes what the search looks at
  useEffect(() => {
    if (loadingAuth || !isAuthenticated || !search.trim()) return;
    fetchApplications();
  }, [visibleColumns]);

  useEffect(() => {
    if (loadingAuth || !isAuthenticated) return;
    fetchApplications();
  }, [filter, stageFilter, page, loadingAuth, isAuthenticated, dateRange]);

  const fetchRef = useRef(fetchApplications);
  useEffect(() => {
    fetchRef.current = fetchApplications;
  }, [fetchApplications]);

  useEffect(() => {
    if (loadingAuth || !isAuthenticated) return;

    const socket = io(API_BASE_URL, { withCredentials: true });
    socket.on("connect", () => socket.emit("join_staff"));
    socket.on("applications_updated", () => {
      if (fetchRef.current) fetchRef.current(true);
    });
    
    return () => socket.disconnect();
  }, [loadingAuth, isAuthenticated]);

  const getCellValue = (k, col) => {
    if (col === "S.No." || col === "Actions") return "";
    if (col === "Client Code") return k.clientCode;
    if (col === "KYC ID") return k.id;
    if (col === "BOID") return k.boid;
    if (col === "Number") return k.number;
    if (col === "Name") return k.name;
    if (col === "Email") return k.email;
    if (col === "PAN") return k.pan;
    if (col === "Step") return `Step ${k.stepNum || 0}/14`;
    if (col === "Stage") return k.stepLabel && k.stepLabel.includes(':') ? k.stepLabel.split(': ')[1] : (k.stepLabel || "Onboarding");
    if (col === "STK Status") return k.status === "verified" ? "approved" : (k.status === "rejected" && !k.rejectionSent ? "pending" : k.status);
    if (col === "Globe Status") return k.globeStatus === "rejected" && !k.rejectionSent ? "pending" : k.globeStatus;
    if (col === "STK Approved At") return k.stkApprovedAt;
    if (col === "STK Rejected At") return k.stkRejectedAt;
    if (col === "Globe Approved At") return k.globeApprovedAt;
    if (col === "Globe Rejected At") return k.globeRejectedAt;
    if (col === "E-Stamp Certificate No") return k.eStampCertNo;
    if (col === "E-Stamp Serial No") return k.eStampSerialNo;
    if (col === "Aadhaar") return k.aadhaar;
    if (col === "DOB") return k.dob;
    if (col === "Gender") return k.gender;
    if (col === "Father Name") return k.fatherName;
    if (col === "Mother Name") return k.motherName;
    if (col === "Bank Name") return k.bankName;
    if (col === "Account No") return k.accountNo;
    if (col === "IFSC") return k.ifsc;
    if (col === "MICR") return k.micr;
    if (col === "Nominees") return k.nominees;
    if (col === "Address") return k.address;
    if (col === "City") return k.city;
    if (col === "State") return k.state;
    if (col === "Pincode") return k.pincode;
    if (col === "Occupation") return k.occupation;
    if (col === "Annual Income") return k.annualIncome;
    if (col === "Date") return k.submittedAt;
    if (col === "Start Date") return k.startDate;
    if (col === "eSign Date") return k.esignDate;
    if (col === "Pennydrop Verify") return k.pennydropVerify;
    if (col === "Aadhaar Seeding") return k.aadhaarSeeding;
    if (col === "LiveImage Time") return k.liveImageTime;
    if (col === "Sign Upload Time") return k.signUploadTime;
    if (col === "Segments Selected") return k.segmentsSelected;
    if (col === "Total Nominees") return k.totalNominees;
    if (col === "Nominee Opt Date") return k.nomineeOptDate;
    return "";
  };

  // One side's rejections (STK or Globe) as one compact pill: the count opens the list with each reason.
  // With statusLabel (e.g. "REJECTED") the side's status badge is merged into the same pill.
  const renderSideRejections = (k, side, statusLabel) => {
    const items = side === "Globe" ? k.globeRejections : k.stkRejections;
    if (!items || items.length === 0) return null;
    const menuId = `${k.id}-${side}`;
    return (
      <div className="rejections-dropdown-container" style={{ position: "relative", display: "inline-flex" }} onClick={(e) => e.stopPropagation()}>
        <button
          className="mc-rej-chip"
          onClick={(e) => {
            if (openRejectionsId === menuId) { setOpenRejectionsId(null); return; }
            rejectionsAnchorRef.current = e.currentTarget;
            setRejectionsPopPos(getRejectionsPopPos(e.currentTarget));
            setOpenRejectionsId(menuId);
          }}
          title={`${items.length} rejection(s) by ${side}. Click to see the reasons.`}
          aria-expanded={openRejectionsId === menuId}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 10px", borderRadius: 999, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: "0.75rem", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
          {statusLabel && (
            <span style={{ paddingRight: 8, marginRight: 2, borderRight: "1px solid #fecaca", letterSpacing: "0.3px" }}>{statusLabel}</span>
          )}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          {items.length}
        </button>
        {openRejectionsId === menuId && rejectionsPopPos && typeof document !== "undefined" && createPortal((
          // Drawn above the page so the table never clips it; the container class keeps clicks inside from closing it
          <div className="rejections-dropdown-container mc-rej-pop" role="dialog" aria-label={`${side} rejections`}
            style={{ position: "fixed", ...rejectionsPopPos }} onClick={(e) => e.stopPropagation()}>
            <div className="mc-rej-pop-head">
              <span>{side} rejections</span>
              <span className="mc-rej-pop-count">{items.length}</span>
            </div>
            <div className="mc-rej-pop-list">
              {items.map((r, i) => (
                <div key={i} className="mc-rej-pop-item">
                  <div className="mc-rej-pop-label">
                    {r.label}
                    {r.unknownSource && <span className="mc-rej-pop-note" title="Saved before the portal recorded who made each rejection">(source unknown)</span>}
                  </div>
                  <div className="mc-rej-pop-reason">{r.reason}</div>
                </div>
              ))}
            </div>
          </div>
        ), document.body)}
      </div>
    );
  };

  // Value shown in a column's filter list (empty / N/A grouped as "(Blank)")
  const toFilterValue = (v) => {
    const str = String(v ?? "").trim();
    return str === "" || str === "N/A" ? "(Blank)" : str;
  };

  // The table's column filters and sort (also applied to the exports)
  const applyTableFilters = (list) => {
    let result = [...list];

    Object.keys(columnValueFilters).forEach(col => {
      const selected = columnValueFilters[col];
      if (selected && selected.length > 0) {
        result = result.filter(k => selected.includes(toFilterValue(getCellValue(k, col))));
      }
    });

    Object.keys(columnFilters).forEach(col => {
      const term = columnFilters[col]?.toLowerCase();
      if (term) {
        result = result.filter(k => {
          const val = String(getCellValue(k, col) || "").toLowerCase();
          return val.includes(term);
        });
      }
    });

    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aVal = String(getCellValue(a, sortConfig.key) || "").toLowerCase();
        const bVal = String(getCellValue(b, sortConfig.key) || "").toLowerCase();
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filteredAndSortedKycs = useMemo(() => applyTableFilters(kycs), [kycs, columnFilters, columnValueFilters, sortConfig]);

  const handleDragStart = (e, col) => {
    if (PERMANENT_COLUMNS.includes(col)) {
      e.preventDefault();
      return;
    }
    setDraggedColumn(col);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, col) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, targetCol) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetCol) return;
    if (PERMANENT_COLUMNS.includes(draggedColumn) || PERMANENT_COLUMNS.includes(targetCol)) return;
    
    const draggedIdx = orderedColumns.indexOf(draggedColumn);
    const targetIdx = orderedColumns.indexOf(targetCol);
    
    if (draggedIdx === -1 || targetIdx === -1) return;
    
    const newCols = [...orderedColumns];
    newCols.splice(draggedIdx, 1);
    newCols.splice(targetIdx, 0, draggedColumn);
    
    setOrderedColumns(newCols);
    if (typeof window !== "undefined") {
      localStorage.setItem("makerCheckerOrderedColumns", JSON.stringify(newCols));
    }
    setDraggedColumn(null);
  };
  const [exporting, setExporting] = useState(null); // "table" | "all" while an export is being built

  // Every application matching the current filter / stage / search / dates — all pages, not just the
  // one on screen — with the table's column filters and sort applied
  const fetchAllForExport = async () => {
    return applyTableFilters((await loadAllRows(true)).filter(matchesSearch));
  };

  // "all": every stored detail of the same rows, as columns grouped by topic (bank together, each nominee
  // together, …). The rows are exactly the ones "Export Table" would give (same filters, search and sort);
  // the server adds the full details in batches.
  const exportAllGrouped = async (rows) => {
    const token = localStorage.getItem("adminToken");
    const ids = rows.map((k) => k.id).filter(Boolean);
    let groups = null;
    const detailRows = [];
    for (let i = 0; i < ids.length; i += 200) {
      const res = await fetch(`${API_BASE_URL}/api/agent/applications/export-full`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ applicationIds: ids.slice(i, i + 200) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to load the export details");
      groups = groups || data.groups;
      detailRows.push(...data.rows);
    }
    // Files stored on this server are saved as "/uploads/…" — make them full links
    const absolute = (v) => (typeof v === "string" && v.startsWith("/uploads/") ? `${API_BASE_URL}${v}` : v);
    await downloadGroupedExcel(
      `kyc_all_details_${new Date().toISOString().slice(0, 10)}.xlsx`,
      [{ name: "#", columns: ["S.No."] }, ...(groups || [])],
      detailRows.map((r, i) => [i + 1, ...r.map(absolute)]),
    );
  };

  // "table": the columns shown in the table, in the table's order.
  // "all": every stored detail, grouped by topic (exportAllGrouped).
  const exportToExcel = async (mode) => {
    if (exporting) return;
    setExporting(mode);
    try {
      const rows = await fetchAllForExport();
      if (rows.length === 0) {
        alert("No applications to export.");
        return;
      }
      if (mode === "all") {
        await exportAllGrouped(rows);
        return;
      }
      const columns = mode === "table"
        ? displayColumns.filter(c => c !== "Actions")
        : ALL_COLUMNS.filter(c => c !== "Actions").flatMap(c => c === "Step" ? ["Rejections", c] : [c]);
      const data = rows.map((k, i) => columns.map(col =>
        col === "S.No." ? i + 1 : col === "Rejections" ? k.rejections : getCellValue(k, col)
      ));
      await downloadExcel(`kyc_${mode === "table" ? "table" : "all_columns"}_${new Date().toISOString().slice(0, 10)}.xlsx`, columns, data);
    } catch (err) {
      console.error("Export failed", err);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  if (loadingAuth || !isAuthenticated) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg-secondary)" }}>
      <div className="loader"></div>
    </div>
  );

  return (
    <div style={{ 
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      background: "var(--bg-secondary)"
    }}>
      <div style={{ 
        display: "flex", 
        width: "100%",
        height: "100%"
      }}>
        <AdminSidebar 
          active="maker_checker" 
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%", overflowY: "auto" }}>
          {/* Top Header */}
          <header className="admin-header">
            <div className="neu-page-head">
              <h1 className="neu-page-title">Maker / Checker Queue</h1>
              <p className="neu-page-sub">Review applications step-by-step</p>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <AdminThemeToggle />
              <div style={{ display: "flex", alignItems: "center", gap: 12, borderLeft: "1px solid var(--border-color)", paddingLeft: 20 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>Super Admin</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Role: Master Control</div>
                </div>
                <div className="neu-avatar" style={{ width: 40, height: 40, borderRadius: "12px", background: "var(--wise-green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--wise-dark-green)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
              </div>
            </div>
          </header>

          {/* Same background as the table, so the list reads as a plain table (no card) */}
          <main className="neu-main" style={{ padding: "24px", flex: 1, width: "100%", background: "var(--bg-sticky)" }}>
            <div className="admin-animate">

              {/* Controls — kept above the table so their dropdowns are never covered by its sticky header */}
              <div className="mc-toolbar" style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "nowrap", alignItems: "center", position: "relative", zIndex: 30 }}>
                <input className="admin-input" placeholder="Search in the shown columns..." title="Searches only the columns currently shown in the table" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: "1 1 320px", minWidth: 180, maxWidth: 320 }} />
                <div className="filter-dropdown-container" style={{ position: "relative", flex: "0 1 220px", minWidth: 180 }}>
                  <button 
                    onClick={() => setFilterOpen(!filterOpen)}
                    style={{ 
                      width: "100%", padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border-color)", 
                      background: "var(--bg-primary)", color: "var(--text-primary)", fontWeight: 700, 
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                      boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--wise-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                      {filter === "all" ? "All Applications" : filter.replace(/_/g, " ").toUpperCase()}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ transform: filterOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                  {filterOpen && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", zIndex: 10, padding: "8px 0", overflow: "hidden" }}>
                      {["all", "in_progress", "verify", "completed", "rejected", "pushed_to_bo"].map(f => (
                        <div 
                          key={f}
                          onClick={() => handleFilterChange(f)}
                          style={{ 
                            padding: "10px 16px", cursor: "pointer", fontSize: "0.85rem", fontWeight: filter === f ? 700 : 500,
                            color: filter === f ? "var(--wise-green)" : "var(--text-primary)",
                            background: filter === f ? "rgba(48, 164, 108, 0.1)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            transition: "background 0.2s ease"
                          }}
                          onMouseEnter={(e) => { if (filter !== f) e.currentTarget.style.background = "var(--bg-secondary)"; }}
                          onMouseLeave={(e) => { if (filter !== f) e.currentTarget.style.background = "transparent"; }}
                        >
                          {f === "all" ? "All Applications" : f.replace(/_/g, " ").toUpperCase()}
                          {filter === f && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  className="neu-btn-primary"
                  onClick={bulkSendToBackoffice}
                  disabled={bulkPushing}
                  title="Push all Admin-verified, Globe-approved applications not yet sent to Backoffice"
                  style={{ flex: "0 0 auto", padding: "10px 16px", borderRadius: 8, border: "none", background: "var(--wise-green)", color: "var(--wise-dark-green)", fontWeight: 800, fontSize: "0.85rem", whiteSpace: "nowrap", cursor: bulkPushing ? "not-allowed" : "pointer", opacity: bulkPushing ? 0.6 : 1 }}
                >
                  {bulkPushing ? "Pushing…" : "Bulk Push to Backoffice"}
                </button>

                <div className="date-filter-dropdown-container" style={{ position: "relative", flex: "0 1 220px", minWidth: 160 }}>
                  <button 
                    onClick={() => setDateFilterOpen(!dateFilterOpen)}
                    style={{ 
                      width: "100%", padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border-color)", 
                      background: "var(--bg-primary)", color: "var(--text-primary)", fontWeight: 700, 
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                      boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--wise-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      {dateRange.start || dateRange.end ? "Custom Date" : "All Time"}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ transform: dateFilterOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                  {dateFilterOpen && (
                    <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 8, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", zIndex: 10, padding: "16px", minWidth: "280px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                        <button onClick={() => { setDateRange({ start: "", end: "" }); setDateFilterOpen(false); }} style={{ padding: "6px 8px", fontSize: "0.75rem", borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", cursor: "pointer", fontWeight: 600 }}>All Time</button>
                        <button onClick={() => { 
                          const today = new Date().toISOString().split('T')[0];
                          setDateRange({ start: today, end: today }); 
                          setDateFilterOpen(false); 
                        }} style={{ padding: "6px 8px", fontSize: "0.75rem", borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", cursor: "pointer", fontWeight: 600 }}>Today</button>
                        <button onClick={() => { 
                          const end = new Date();
                          const start = new Date();
                          start.setDate(start.getDate() - 7);
                          setDateRange({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }); 
                          setDateFilterOpen(false); 
                        }} style={{ padding: "6px 8px", fontSize: "0.75rem", borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", cursor: "pointer", fontWeight: 600 }}>Last Week</button>
                        <button onClick={() => { 
                          const end = new Date();
                          const start = new Date();
                          start.setDate(start.getDate() - 30);
                          setDateRange({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }); 
                          setDateFilterOpen(false); 
                        }} style={{ padding: "6px 8px", fontSize: "0.75rem", borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", cursor: "pointer", fontWeight: 600 }}>Last Month</button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div>
                          <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>From</label>
                          <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid var(--border-color)", fontSize: "0.85rem" }} />
                        </div>
                        <div>
                          <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>To</label>
                          <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid var(--border-color)", fontSize: "0.85rem" }} />
                        </div>
                        <button onClick={() => setDateFilterOpen(false)} style={{ width: "100%", padding: "8px", marginTop: 4, borderRadius: 6, background: "var(--wise-green)", color: "white", fontWeight: 700, border: "none", cursor: "pointer" }}>Apply Filters</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="stage-dropdown-container" style={{ position: "relative", flex: "0 1 220px", minWidth: 160 }}>
                  <button 
                    onClick={() => setStageFilterOpen(!stageFilterOpen)}
                    style={{ 
                      width: "100%", padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border-color)", 
                      background: "var(--bg-primary)", color: "var(--text-primary)", fontWeight: 700, 
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                      boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--wise-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      {stageFilter === "all" ? "All Stages" : (STEP_LABELS[stageFilter] || `Step ${stageFilter}`)}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ transform: stageFilterOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                  {stageFilterOpen && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", zIndex: 10, padding: "8px 0", maxHeight: "400px", overflowY: "auto" }}>
                      <div 
                        onClick={() => { setStageFilter("all"); setStageFilterOpen(false); }}
                        style={{ 
                          padding: "10px 16px", cursor: "pointer", fontSize: "0.85rem", fontWeight: stageFilter === "all" ? 700 : 500,
                          color: stageFilter === "all" ? "var(--wise-green)" : "var(--text-primary)",
                          background: stageFilter === "all" ? "rgba(48, 164, 108, 0.1)" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          transition: "background 0.2s ease"
                        }}
                        onMouseEnter={(e) => { if (stageFilter !== "all") e.currentTarget.style.background = "var(--bg-secondary)"; }}
                        onMouseLeave={(e) => { if (stageFilter !== "all") e.currentTarget.style.background = "transparent"; }}
                      >
                        All Stages
                        {stageFilter === "all" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </div>
                      {Object.entries(STEP_LABELS).filter(([num]) => num !== "0").map(([num, label]) => (
                        <div 
                          key={num}
                          onClick={() => { setStageFilter(num); setStageFilterOpen(false); }}
                          style={{ 
                            padding: "10px 16px", cursor: "pointer", fontSize: "0.85rem", fontWeight: stageFilter === num ? 700 : 500,
                            color: stageFilter === num ? "var(--wise-green)" : "var(--text-primary)",
                            background: stageFilter === num ? "rgba(48, 164, 108, 0.1)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            transition: "background 0.2s ease"
                          }}
                          onMouseEnter={(e) => { if (stageFilter !== num) e.currentTarget.style.background = "var(--bg-secondary)"; }}
                          onMouseLeave={(e) => { if (stageFilter !== num) e.currentTarget.style.background = "transparent"; }}
                        >
                          {label}
                          {stageFilter === num && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="columns-dropdown-container" style={{ position: "relative", marginLeft: "auto", flexShrink: 0 }}>
                  <button 
                    onClick={() => { setColumnsOpen(!columnsOpen); setColumnSearch(""); }}
                    style={{ 
                      padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border-color)", 
                      background: "var(--bg-primary)", color: "var(--text-primary)", fontWeight: 700, 
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 8 
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                    Columns
                  </button>
                  {columnsOpen && (
                    <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 8, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 10, minWidth: 200, padding: "8px 0", maxHeight: "400px", overflowY: "auto" }}>
                      {/* Header + search stay visible while the column list scrolls */}
                      <div style={{ position: "sticky", top: -8, background: "var(--bg-primary)", zIndex: 1, paddingTop: 8, marginTop: -8 }}>
                        <div style={{ padding: "4px 16px", fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", borderBottom: "1px solid var(--border-color)", paddingBottom: 8, marginBottom: 4 }}>Toggle Columns</div>
                        <div style={{ padding: "4px 12px 8px" }}>
                          <input
                            type="text"
                            autoFocus
                            placeholder="Search columns..."
                            value={columnSearch}
                            onChange={(e) => setColumnSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }}
                          />
                        </div>
                      </div>
                      {columnSearch.trim() && !ALL_COLUMNS.some(col => col.toLowerCase().includes(columnSearch.trim().toLowerCase())) && (
                        <div style={{ padding: "8px 16px", fontSize: "0.82rem", color: "var(--text-muted)" }}>No matching columns</div>
                      )}
                      {ALL_COLUMNS.filter(col => col.toLowerCase().includes(columnSearch.trim().toLowerCase())).map(col => (
                        <label key={col} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", cursor: PERMANENT_COLUMNS.includes(col) ? "not-allowed" : "pointer", fontSize: "0.85rem", color: "var(--text-primary)", opacity: PERMANENT_COLUMNS.includes(col) ? 0.6 : 1 }}>
                          <input 
                            type="checkbox" 
                            checked={visibleColumns.includes(col) || PERMANENT_COLUMNS.includes(col)}
                            disabled={PERMANENT_COLUMNS.includes(col)}
                            onChange={() => {
                              if (PERMANENT_COLUMNS.includes(col)) return;
                              setVisibleColumns(prev => {
                                const next = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
                                localStorage.setItem("makerCheckerVisibleColumns", JSON.stringify(next));
                                return next;
                              });
                            }}
                          />
                          {col}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  className="neu-btn-outline mc-export-btn"
                  onClick={() => exportToExcel("table")}
                  disabled={kycs.length === 0 || !!exporting}
                  title="Excel with the columns shown in the table"
                  style={{
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: "1px solid var(--wise-green)",
                    background: "transparent",
                    color: "var(--wise-green)",
                    fontWeight: 700,
                    cursor: kycs.length === 0 || exporting ? "not-allowed" : "pointer",
                    opacity: kycs.length === 0 || (exporting && exporting !== "table") ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  {exporting === "table" ? "Exporting…" : "Export Table"}
                </button>
                <button
                  className="neu-btn-outline mc-export-btn"
                  onClick={() => exportToExcel("all")}
                  disabled={kycs.length === 0 || !!exporting}
                  title="Excel with every column"
                  style={{
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--wise-green)",
                    color: "white",
                    fontWeight: 700,
                    cursor: kycs.length === 0 || exporting ? "not-allowed" : "pointer",
                    opacity: kycs.length === 0 || (exporting && exporting !== "all") ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  {exporting === "all" ? "Exporting…" : "Export All"}
                </button>
              </div>

              {/* Table */}
              {/* A plain table here — no card (rounded corners, shadow, glass) */}
              <div className="admin-table-container mc-readable" style={{ isolation: "isolate", borderRadius: 0, boxShadow: "none", backdropFilter: "none", WebkitBackdropFilter: "none", background: "var(--bg-sticky)", border: "none", borderTop: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)" }}>
                <div ref={scrollRef} className="mc-scroll" style={{ overflowX: "auto", minHeight: kycs.length < 4 ? "300px" : "auto" }}>
                  <table className="admin-table">
                    <thead><tr>
                      {displayColumns.map(h => (
                        <th 
                          key={h} 
                          style={{
                            position: "relative",
                            ...getStickyStyle(h, true),
                            cursor: PERMANENT_COLUMNS.includes(h) ? "default" : "grab"
                          }}
                          draggable={!PERMANENT_COLUMNS.includes(h)}
                          onDragStart={(e) => handleDragStart(e, h)}
                          onDragOver={(e) => handleDragOver(e, h)}
                          onDrop={(e) => handleDrop(e, h)}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <span style={NO_FILTER_SORT_COLUMNS.includes(h) ? { letterSpacing: "0.02em" } : undefined}>{h}</span>
                            <div style={{ display: "flex", gap: 4 }}>
                              {!NO_FILTER_SORT_COLUMNS.includes(h) && (<>
                              <button 
                                className={`column-filter-container mc-th-btn${(columnFilters[h] || columnValueFilters[h]?.length) ? " is-active" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (activeFilterCol === h) { setActiveFilterCol(null); return; }
                                  const r = e.currentTarget.getBoundingClientRect();
                                  setFilterPopupPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left - 8, window.innerWidth - 232)) });
                                  setActiveFilterCol(h);
                                }}
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: (columnFilters[h] || columnValueFilters[h]?.length) ? "var(--wise-green)" : "var(--text-muted)", padding: 2 }}
                                title="Filter"
                              >
                                <ListFilter size={13} strokeWidth={2.4} />
                              </button>

                              <button
                                className={`mc-th-btn${sortConfig.key === h ? " is-active" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSortConfig(prev => {
                                    if (prev.key === h) {
                                      if (prev.direction === 'asc') return { key: h, direction: 'desc' };
                                      return { key: null, direction: null };
                                    }
                                    return { key: h, direction: 'asc' };
                                  });
                                }}
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: sortConfig.key === h ? "var(--wise-green)" : "var(--text-muted)", padding: 2 }}
                                title="Sort"
                              >
                                {sortConfig.key === h ? (
                                  sortConfig.direction === 'asc' ? <ArrowUp size={13} strokeWidth={2.4} /> : <ArrowDown size={13} strokeWidth={2.4} />
                                ) : (
                                  <ArrowUpDown size={13} strokeWidth={2.4} />
                                )}
                              </button>
                              </>)}

                              {!PERMANENT_COLUMNS.includes(h) && (
                                <button
                                  className="mc-th-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setVisibleColumns(prev => {
                                      const next = prev.filter(c => c !== h);
                                      localStorage.setItem("makerCheckerVisibleColumns", JSON.stringify(next));
                                      return next;
                                    });
                                  }}
                                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}
                                  title="Hide Column"
                                >
                                  <EyeOff size={13} strokeWidth={2.4} />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {activeFilterCol === h && filterPopupPos && createPortal((
                            <div className="column-filter-container" style={{ position: "fixed", top: filterPopupPos.top, left: filterPopupPos.left, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 6, padding: 8, zIndex: 2000, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", textAlign: "left" }} onClick={e => e.stopPropagation()}>
                              <input 
                                type="text"
                                autoFocus
                                placeholder={`Search ${h}...`}
                                value={columnFilters[h] || ""}
                                onChange={(e) => setColumnFilters(prev => ({ ...prev, [h]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    setActiveFilterCol(null);
                                  }
                                }}
                                style={{ padding: "4px 8px", fontSize: "0.8rem", borderRadius: 4, border: "1px solid var(--border-color)", width: 150 }}
                              />
                              {(() => {
                                // Values of this column (current page), narrowed by the search text
                                const term = (columnFilters[h] || "").toLowerCase();
                                const values = Array.from(new Set(kycs.map(k => toFilterValue(getCellValue(k, h)))))
                                  .filter(v => !term || v.toLowerCase().includes(term))
                                  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                                const selected = columnValueFilters[h] || [];
                                const toggleValue = (v) => setColumnValueFilters(prev => {
                                  const cur = prev[h] || [];
                                  const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v];
                                  return { ...prev, [h]: next };
                                });
                                return (
                                  <>
                                    <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 6, width: 200 }}>
                                      {values.length === 0 ? (
                                        <div style={{ padding: "6px 4px", fontSize: "0.78rem", color: "var(--text-muted)" }}>No values</div>
                                      ) : values.map(v => (
                                        <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px", fontSize: "0.78rem", color: "var(--text-primary)", cursor: "pointer", fontWeight: 500, textTransform: "none", letterSpacing: "normal", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={v}>
                                          <input type="checkbox" checked={selected.includes(v)} onChange={() => toggleValue(v)} />
                                          {v}
                                        </label>
                                      ))}
                                    </div>
                                    {(selected.length > 0 || columnFilters[h]) && (
                                      <button
                                        onClick={() => {
                                          setColumnValueFilters(prev => { const next = { ...prev }; delete next[h]; return next; });
                                          setColumnFilters(prev => { const next = { ...prev }; delete next[h]; return next; });
                                        }}
                                        style={{ marginTop: 6, width: "100%", padding: "4px 8px", fontSize: "0.75rem", fontWeight: 700, borderRadius: 4, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", cursor: "pointer" }}
                                      >
                                        Clear filter
                                      </button>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          ), document.body)}
                        </th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {filteredAndSortedKycs.length === 0 ? (
                        <tr>
                          <td colSpan={visibleColumns.length} style={{ textAlign: "center", padding: "40px" }}>
                            {loading ? "Loading..." : "No matching KYC requests found."}
                          </td>
                        </tr>
                      ) : filteredAndSortedKycs.map((k, index) => (
                        <tr
                          key={k.id}
                          style={{ userSelect: "text", WebkitUserSelect: "text" }}
                        >
                          {(() => {
                            // Cells follow the same (draggable) order as the headers
                            const rowCells = {
                              "S.No.": () => ((
                            <td style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-muted)", ...getStickyStyle("S.No.") }}>
                              {(page - 1) * 15 + index + 1}
                            </td>
                          )),
                              "Actions": () => ((<td style={{ ...getStickyStyle("Actions"), zIndex: openMenuId === k.id ? 20 : 2 }}>
                            <div className="action-menu-container" style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  setOpenMenuId(openMenuId === k.id ? null : k.id);
                                }}
                                style={{ padding: "4px 8px", borderRadius: 4, background: "transparent", border: "1px solid var(--border-color)", cursor: "pointer", fontWeight: "bold", fontSize: "1.1rem", color: "var(--text-primary)" }}
                              >
                                ⋮
                              </button>
                              
                              {openMenuId === k.id && (
                                <div className="premium-action-menu" style={{ right: 'auto', left: 0, top: (index >= 3 && index >= kycs.length - 4) ? "auto" : "100%", bottom: (index >= 3 && index >= kycs.length - 4) ? "100%" : "auto" }}>
                                  <button onClick={() => { setOpenMenuId(null); router.push(`/admin/maker-checker/${k.id}`); }} className="premium-action-item">Verify</button>
                                  <button onClick={() => { setOpenMenuId(null); handleContinueJourney(k); }} className="premium-action-item">Continue Journey</button>
                                  <button onClick={() => { setOpenMenuId(null); deleteUser(k.id); }} className="premium-action-item danger">Delete</button>
                                  <button onClick={() => { setOpenMenuId(null); setChangeStatusAppId(k.id); }} className="premium-action-item">Change Status</button>
                                  {k.status === "verified" && k.globeStatus === "approved" && (
                                    <button onClick={() => { setOpenMenuId(null); sendToBackoffice(k.id); }} className="premium-action-item success">Send to Backoffice</button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>)),
                              "Name": () => (<td style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", userSelect: "text", WebkitUserSelect: "text", cursor: "text", ...getStickyStyle("Name") }}>{k.name}</td>),
                              "Client Code": () => ((
                            <td className="mc-client-code" style={{ fontWeight: 800, fontFamily: "monospace", userSelect: "text", WebkitUserSelect: "text", cursor: "text", ...getStickyStyle("Client Code") }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{k.clientCode || "N/A"}</span>
                                {k.clientCode && k.clientCode !== "N/A" && (
                                  <button onClick={(e) => handleCopy(e, k.clientCode, `cc-${k.id}`)} title="Copy Client Code" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `cc-${k.id}` ? "#16a34a" : "var(--text-muted)" }}>
                                    {copiedKey === `cc-${k.id}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                                  </button>
                                )}
                              </div>
                            </td>
                          )),
                              "KYC ID": () => ((
                            <td style={{ fontWeight: 800, fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{k.id}</span>
                                <button onClick={(e) => handleCopy(e, k.id, `id-${k.id}`)} title="Copy KYC ID" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `id-${k.id}` ? "#16a34a" : "var(--text-muted)" }}>
                                  {copiedKey === `id-${k.id}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                                </button>
                              </div>
                            </td>
                          )),
                              "BOID": () => ((
                            <td style={{ fontSize: "0.82rem", fontFamily: "monospace", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{k.boid}</span>
                                {k.boid && k.boid !== "N/A" && (
                                  <button onClick={(e) => handleCopy(e, k.boid, `boid-${k.id}`)} title="Copy BOID" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `boid-${k.id}` ? "#16a34a" : "var(--text-muted)" }}>
                                    {copiedKey === `boid-${k.id}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                                  </button>
                                )}
                              </div>
                            </td>
                          )),
                              "Number": () => ((
                            <td style={{ fontWeight: 600, userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{k.number}</span>
                                {k.number && k.number !== "N/A" && (
                                  <button onClick={(e) => handleCopy(e, k.number, `phone-${k.id}`)} title="Copy Phone Number" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `phone-${k.id}` ? "#16a34a" : "var(--text-muted)" }}>
                                    {copiedKey === `phone-${k.id}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                                  </button>
                                )}
                              </div>
                            </td>
                          )),
                              "Email": () => ((
                            <td style={{ fontSize: "0.82rem", color: "var(--text-primary)", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{k.email}</span>
                                {k.email && k.email !== "N/A" && (
                                  <button onClick={(e) => handleCopy(e, k.email, `email-${k.id}`)} title="Copy Email" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `email-${k.id}` ? "#16a34a" : "var(--text-muted)" }}>
                                    {copiedKey === `email-${k.id}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                                  </button>
                                )}
                              </div>
                            </td>
                          )),
                              "PAN": () => ((
                            <td style={{ fontWeight: 600, userSelect: "text", WebkitUserSelect: "text", cursor: "text", ...getStickyStyle("PAN") }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{k.pan}</span>
                                {k.pan && k.pan !== "N/A" && (
                                  <button onClick={(e) => handleCopy(e, k.pan, `pan-${k.id}`)} title="Copy PAN" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `pan-${k.id}` ? "#16a34a" : "var(--text-muted)" }}>
                                    {copiedKey === `pan-${k.id}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                                  </button>
                                )}
                              </div>
                            </td>
                          )),
                              "Aadhaar": () => (<td style={{ fontWeight: 600, userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.aadhaar}</td>),
                              "DOB": () => (<td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.dob}</td>),
                              "Gender": () => (<td style={{ fontSize: "0.82rem", textTransform: "capitalize", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.gender}</td>),
                              "Father Name": () => (<td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.fatherName}</td>),
                              "Mother Name": () => (<td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.motherName}</td>),
                              "Bank Name": () => (<td style={{ fontSize: "0.82rem", fontWeight: 600, userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.bankName}</td>),
                              "Account No": () => ((
                            <td style={{ fontSize: "0.82rem", fontFamily: "monospace", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{k.accountNo}</span>
                                {k.accountNo && k.accountNo !== "N/A" && (
                                  <button onClick={(e) => handleCopy(e, k.accountNo, `acc-${k.id}`)} title="Copy Account No" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `acc-${k.id}` ? "#16a34a" : "var(--text-muted)" }}>
                                    {copiedKey === `acc-${k.id}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                                  </button>
                                )}
                              </div>
                            </td>
                          )),
                              "IFSC": () => ((
                            <td style={{ fontSize: "0.82rem", fontFamily: "monospace", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{k.ifsc}</span>
                                {k.ifsc && k.ifsc !== "N/A" && (
                                  <button onClick={(e) => handleCopy(e, k.ifsc, `ifsc-${k.id}`)} title="Copy IFSC" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `ifsc-${k.id}` ? "#16a34a" : "var(--text-muted)" }}>
                                    {copiedKey === `ifsc-${k.id}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                                  </button>
                                )}
                              </div>
                            </td>
                          )),
                              "MICR": () => ((
                            <td style={{ fontSize: "0.82rem", fontFamily: "monospace", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{k.micr}</span>
                                {k.micr && k.micr !== "N/A" && (
                                  <button onClick={(e) => handleCopy(e, k.micr, `micr-${k.id}`)} title="Copy MICR" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `micr-${k.id}` ? "#16a34a" : "var(--text-muted)" }}>
                                    {copiedKey === `micr-${k.id}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                                  </button>
                                )}
                              </div>
                            </td>
                          )),
                              "Nominees": () => (<td style={{ fontSize: "0.82rem", textAlign: "center", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.nominees}</td>),
                              "Address": () => (<td style={{ fontSize: "0.82rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }} title={k.address}>{k.address}</td>),
                              "City": () => (<td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.city}</td>),
                              "State": () => (<td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.state}</td>),
                              "Pincode": () => (<td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.pincode}</td>),
                              "Occupation": () => (<td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.occupation}</td>),
                              "Annual Income": () => (<td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.annualIncome}</td>),
                              "Step": () => (<td style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 700 }}>
                            Step {k.stepNum || 0}/14
                          </td>),
                              "Stage": () => (<td style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                            {k.stepLabel && k.stepLabel.includes(':') ? k.stepLabel.split(': ')[1] : (k.stepLabel || "Onboarding")}
                          </td>),
                              "STK Status": () => (<td>
                            <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center" }}>
                              {k.status === 'verified' ? (
                                <span className="badge badge-verified mc-status-badge" style={{ border: "none" }}>APPROVED</span>
                              ) : k.status === 'rejected' ? (
                                // Rejected by STK: status and its rejections in one pill once the rejection mail is sent;
                                // before that it is still under review (PENDING, with the marked rejections next to it)
                                k.rejectionSent
                                  ? (renderSideRejections(k, "STK", "REJECTED") || <span className="badge badge-rejected mc-status-badge" style={{ border: "none" }}>REJECTED</span>)
                                  : <span className="badge badge-pending mc-status-badge" style={{ border: "none" }}>PENDING</span>
                              ) : (k.stepNum || 0) < 14 ? (
                                // eSign not done yet: can't be approved
                                <span className="badge badge-pending mc-status-badge" style={{ border: "none" }} title="Can't be approved until eSign is done">PENDING</span>
                              ) : (
                                <button className="mc-status-badge"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatus(k.id, "verified", {currentStep: k.stepNum});
                                    setKycs(prev => prev.map(app => app.id === k.id ? { ...app, status: "verified" } : app));
                                  }}
                                  style={{ background: "var(--wise-green)", color: "white", border: "none", borderRadius: "12px", fontWeight: 800, cursor: "pointer", fontSize: "0.75rem" }}
                                >
                                  Verify
                                </button>
                              )}
                              {!(k.status === 'rejected' && k.rejectionSent) && renderSideRejections(k, "STK")}
                            </div>
                          </td>),
                              "Globe Status": () => (<td>
                            <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center" }}>
                              {k.globeStatus === "rejected" && k.rejectionSent && renderSideRejections(k, "Globe", "REJECTED") || (
                                <>
                                  {k.globeStatus === "rejected" && !k.rejectionSent
                                    ? <span className="badge badge-pending mc-status-badge" style={{ border: "none" }}>PENDING</span>
                                    : <span className={`badge ${STATUS_MAP[k.globeStatus] || "badge-pending"} mc-status-badge`}>{(k.globeStatus || "PENDING").toUpperCase()}</span>}
                                  {/* Admin sees Globe's rejections only once the mail is sent (Globe sees its unsent ones on the Globe portal) */}
                                  {k.globeStatus !== "rejected" && renderSideRejections(k, "Globe")}
                                </>
                              )}
                            </div>
                          </td>),
                              "STK Approved At": () => (<td style={{ fontSize: "0.82rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{k.stkApprovedAt}</td>),
                              "STK Rejected At": () => (<td style={{ fontSize: "0.82rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{k.stkRejectedAt}</td>),
                              "Globe Approved At": () => (<td style={{ fontSize: "0.82rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{k.globeApprovedAt}</td>),
                              "Globe Rejected At": () => (<td style={{ fontSize: "0.82rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{k.globeRejectedAt}</td>),
                              "E-Stamp Certificate No": () => ((
                            <td style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{k.eStampCertNo}</span>
                                {k.eStampCertNo && k.eStampCertNo !== "N/A" && (
                                  <button onClick={(e) => handleCopy(e, k.eStampCertNo, `estampcert-${k.id}`)} title="Copy Certificate No" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `estampcert-${k.id}` ? "#16a34a" : "var(--text-muted)" }}>
                                    {copiedKey === `estampcert-${k.id}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                                  </button>
                                )}
                              </div>
                            </td>
                          )),
                              "E-Stamp Serial No": () => ((
                            <td style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{k.eStampSerialNo}</span>
                                {k.eStampSerialNo && k.eStampSerialNo !== "N/A" && (
                                  <button onClick={(e) => handleCopy(e, k.eStampSerialNo, `estampserial-${k.id}`)} title="Copy Serial No" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `estampserial-${k.id}` ? "#16a34a" : "var(--text-muted)" }}>
                                    {copiedKey === `estampserial-${k.id}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                                  </button>
                                )}
                              </div>
                            </td>
                          )),
                              "Start Date": () => (<td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{k.startDate}</td>),
                              "eSign Date": () => (<td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{k.esignDate}</td>),
                              "Date": () => (<td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text", color: "var(--text-muted)" }}>{k.submittedAt}</td>),
                              "Pennydrop Verify": () => (<td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                            <span className={`badge ${k.pennydropVerify?.toLowerCase() === 'verified' ? 'badge-verified' : 'badge-pending'}`}>{k.pennydropVerify}</span>
                          </td>),
                              "Aadhaar Seeding": () => (<td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.aadhaarSeeding}</td>),
                              "LiveImage Time": () => (<td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.liveImageTime}</td>),
                              "Sign Upload Time": () => (<td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.signUploadTime}</td>),
                              "Segments Selected": () => (<td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.segmentsSelected}</td>),
                              "Total Nominees": () => (<td style={{ fontSize: "0.82rem", textAlign: "center", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.totalNominees}</td>),
                              "Nominee Opt Date": () => (<td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.nomineeOptDate}</td>),
                            };
                            return displayColumns
                              .map(col => rowCells[col] ? <Fragment key={col}>{rowCells[col]()}</Fragment> : null);
                          })()}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mc-pager" style={{ padding: "14px 24px", borderTop: "1px solid var(--border-color)", fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button 
                      disabled={page <= 1 || loading} 
                      onClick={() => setPage(p => p - 1)}
                      style={{ padding: "4px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", cursor: "pointer", opacity: page <= 1 ? 0.4 : 1 }}
                    >
                      Previous
                    </button>
                    <span style={{ fontWeight: 700 }}>Page {page} of {totalPages}</span>
                    <button 
                      disabled={page >= totalPages || loading} 
                      onClick={() => setPage(p => p + 1)}
                      style={{ padding: "4px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", cursor: "pointer", opacity: page >= totalPages ? 0.4 : 1 }}
                    >
                      Next
                    </button>
                  </div>
                  <span>Total {total} applications</span>
                </div>
              </div>

              {changeStatusAppId && (() => {
                const appForStatus = kycs.find(k => k.id === changeStatusAppId);
                const currentAppStep = appForStatus ? (appForStatus.stepNum || 0) : 0;
                const reached = Math.max(Number(currentAppStep || 0), furthestStep ?? 0);
                const selected = pendingStep !== null ? pendingStep : currentAppStep;
                const changed = pendingStep !== null && pendingStep !== currentAppStep;
                const stepName = (n) => (STEP_LABELS[n] || `Step ${n}`).replace(/^Step \d+:\s*/, "");
                const close = () => { setChangeStatusAppId(null); setPendingStep(null); };
                // Drawn on <body>: an animated parent would otherwise trap this fixed overlay inside the table area
                // The frosted backdrop starts after the sidebar, so the sidebar stays visible
                const sidebarW = typeof document !== "undefined" ? Math.round(document.querySelector(".admin-neu aside")?.getBoundingClientRect().width || 0) : 0;
                return createPortal((
                  <div className="mc-step-overlay" style={{ left: sidebarW }} onClick={close}>
                    <div className="neu-modal mc-step-modal" role="dialog" aria-label="Change progress" onClick={(e) => e.stopPropagation()}>
                      <div className="mc-step-modal-head">
                        <div>
                          <h3>Change Progress</h3>
                          <p>Currently at <strong>Step {currentAppStep} · {stepName(currentAppStep)}</strong></p>
                        </div>
                        <button type="button" className="mc-step-close" onClick={close} aria-label="Close">×</button>
                      </div>

                      {/* Steps 1–14 (Welcome is not a step to move to). Steps the user has not reached are locked. */}
                      <div className="mc-step-grid" role="listbox" aria-label="Move to step">
                        {Object.keys(STEP_LABELS).map(Number).filter(n => n > 0).map(n => {
                          const locked = n > reached;
                          return (
                            <button
                              type="button"
                              key={n}
                              role="option"
                              aria-selected={n === selected}
                              disabled={locked}
                              onClick={() => setPendingStep(n)}
                              title={locked ? "The user has not reached this step yet" : n === currentAppStep ? "Current step" : undefined}
                              className={`mc-step-pill${n === selected ? " is-selected" : ""}${n === currentAppStep ? " is-current" : ""}${locked ? " is-locked" : ""}`}
                            >
                              <span className="mc-step-pill-num">{n}</span>
                              <span className="mc-step-pill-name">{stepName(n)}</span>
                              {locked && (
                                <svg className="mc-step-pill-lock" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mc-step-foot">
                        <span className={`mc-step-summary${changed ? " is-changed" : ""}`}>
                          {changed ? <>Step {currentAppStep} <span aria-hidden="true">→</span> Step {pendingStep}</> : "Choose a step to move to"}
                        </span>
                        <button
                          type="button"
                          className="neu-btn-primary mc-step-save"
                          disabled={!changed}
                          onClick={() => {
                            updateStatus(changeStatusAppId, appForStatus?.status || "pending", { currentStep: pendingStep });
                            setChangeStatusAppId(null);
                            setPendingStep(null);
                          }}
                        >
                          Save Step Change
                        </button>
                      </div>
                    </div>
                  </div>
                ), document.body);
              })()}

            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
