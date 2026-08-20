"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/utils/apiConfig";
import { io } from "socket.io-client";
import AdminSidebar from "../components/AdminSidebar";
import AdminThemeToggle from "../components/AdminThemeToggle";
import { useDragScroll } from "@/utils/useDragScroll";
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
  14: "Step 14: Completion"
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

export default function MakerCheckerDashboard() {
  const router = useRouter();
  const [kycs, setKycs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
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
  const [changeStatusAppId, setChangeStatusAppId] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const handleCopy = (e, text, key) => {
    e.stopPropagation();
    if (!text || text === "N/A" || text === "—") return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const PERMANENT_COLUMNS = ["S.No.", "Actions", "Name", "Client Code"];
  const PERMANENT_WIDTHS = {
    "S.No.": 60,
    "Actions": 80,
    "Name": 180,
    "Client Code": 120
  };
  const ALL_COLUMNS = ["S.No.", "Actions", "Name", "Client Code", "KYC ID", "Number", "Email", "PAN", "Aadhaar", "DOB", "Gender", "Father Name", "Mother Name", "Bank Name", "Account No", "IFSC", "Nominees", "Address", "City", "State", "Pincode", "Occupation", "Annual Income", "Step", "Stage", "Status", "Globe Status", "E-Stamp", "Start Date", "eSign Date", "Date"];
  const [visibleColumns, setVisibleColumns] = useState(["S.No.", "Actions", "Name", "Client Code", "KYC ID", "Number", "Step", "Stage", "Status", "E-Stamp", "Start Date", "eSign Date", "Date"]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [stageFilterOpen, setStageFilterOpen] = useState(false);
  const [columnsLoaded, setColumnsLoaded] = useState(false);

  const scrollRef = useDragScroll();

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
      backgroundColor: "var(--bg-sticky)",
      boxShadow: "none",
    };
  };


  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("makerCheckerVisibleColumns");
      if (saved) {
        try {
          setVisibleColumns(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse visible columns", e);
        }
      }
    }
    setColumnsLoaded(true);
  }, []);

  useEffect(() => {
    if (columnsLoaded && typeof window !== "undefined") {
      localStorage.setItem("makerCheckerVisibleColumns", JSON.stringify(visibleColumns));
    }
  }, [visibleColumns, columnsLoaded]);

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
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

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
    if (!confirm("Are you sure you want to delete this application?")) return;
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/application/${applicationId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        alert("Application deleted successfully");
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


  const fetchApplications = async (isSilent = false) => {
    if (typeof window === "undefined") return;
    if (!isSilent) setLoading(true);
    try {
      const url = new URL(`${API_BASE_URL}/api/agent/applications`);
      if (filter !== "all") url.searchParams.append("status", filter);
      if (stageFilter !== "all") url.searchParams.append("stage", stageFilter);
      if (search) url.searchParams.append("search", search);
      url.searchParams.append("page", page);
      url.searchParams.append("limit", 15);

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
        if (data.success) {
          setTotal(data.total);
          setTotalPages(data.totalPages);
          const mapped = data.applications.map(app => {
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
              dbId: app.id,
              clientCode: app.clientCode,
              number: app.user?.phone || parsedPersonal.phone || parsedPersonal.mobile || "N/A",
              email: app.user?.email || parsedPersonal.email || "N/A",
              name: parsedPersonal.fullName || parsedPersonal.name || parsedIdentity.name || "N/A",
              pan: parsedIdentity.panNumber || parsedIdentity.pan || parsedPersonal.pan || parsedPersonal.panNumber || "N/A",
              eStamp: app.user?.eStampAssigned?.serialNo || app.user?.eStampAssigned?.certificateNo || app.user?.eStamp || "N/A",
              stepNum: app.currentStep || 0,
              stepLabel: STEP_LABELS[app.currentStep] || "Onboarding",
              type: "Full KYC",
              status: app.status,
              globeStatus: app.globeStatus || "pending",
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
              nominees: Array.isArray(parsedNominee.nominees) ? parsedNominee.nominees.length : (parsedNominee.nominees ? 1 : 0),
              address: rawAddr,
              city: rawCity,
              state: rawState,
              pincode: rawPincode,
              occupation: parsedPersonal.occupation || "N/A",
              annualIncome: parsedPersonal.annualIncome || parsedPersonal.annual_income || "N/A",
            };
          });
          setKycs(mapped);
        }
      }
    } catch (err) {
      console.error("Fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [filter, search, stageFilter]);

  useEffect(() => {
    if (loadingAuth || !isAuthenticated) return;
    const t = setTimeout(() => {
      fetchApplications();
    }, 500);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (loadingAuth || !isAuthenticated) return;
    fetchApplications();
  }, [filter, stageFilter, page, loadingAuth, isAuthenticated]);

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
  const exportToCSV = () => {
    if (!kycs || kycs.length === 0) return;
    const headers = ALL_COLUMNS.filter(c => c !== "Actions" && c !== "S.No.");
    const rows = kycs.map(k => headers.map(col => {
      if (col === "KYC ID") return k.id;
      if (col === "Number") return k.number;
      if (col === "Name") return `"${k.name || ""}"`;
      if (col === "Email") return `"${k.email || ""}"`;
      if (col === "PAN") return k.pan;
      if (col === "Step") return `Step ${k.stepNum || 0}/14`;
      if (col === "Stage") return `"${(k.stepLabel && k.stepLabel.includes(':')) ? k.stepLabel.split(': ')[1] : (k.stepLabel || "Onboarding")}"`;
      if (col === "Status") return k.status;
      if (col === "Globe Status") return k.globeStatus;
      if (col === "E-Stamp") return k.eStamp;
      if (col === "Aadhaar") return k.aadhaar;
      if (col === "DOB") return `"${k.dob || ""}"`;
      if (col === "Gender") return k.gender;
      if (col === "Father Name") return `"${k.fatherName || ""}"`;
      if (col === "Mother Name") return `"${k.motherName || ""}"`;
      if (col === "Bank Name") return `"${k.bankName || ""}"`;
      if (col === "Account No") return `"${k.accountNo || ""}"`;
      if (col === "IFSC") return k.ifsc;
      if (col === "Nominees") return k.nominees;
      if (col === "Address") return `"${k.address || ""}"`;
      if (col === "City") return `"${k.city || ""}"`;
      if (col === "State") return `"${k.state || ""}"`;
      if (col === "Pincode") return k.pincode;
      if (col === "Occupation") return `"${k.occupation || ""}"`;
      if (col === "Annual Income") return `"${k.annualIncome || ""}"`;
      if (col === "Date") return `"${k.submittedAt || ""}"`;
      return "";
    }));
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kyc_export_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <div style={{ fontWeight: 700, color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Admin / <span style={{ color: "var(--text-primary)", textTransform: "capitalize" }}>Maker / Checker</span>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <AdminThemeToggle />
              <div style={{ display: "flex", alignItems: "center", gap: 12, borderLeft: "1px solid var(--border-color)", paddingLeft: 20 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>Super Admin</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Role: Master Control</div>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: "12px", background: "var(--wise-green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--wise-dark-green)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
              </div>
            </div>
          </header>

          <main style={{ padding: "24px", flex: 1, width: "100%" }}>
            <div className="admin-animate">
              <h1 className="admin-section-title">Maker / Checker Queue</h1>
              <p className="admin-section-subtitle">Review applications step-by-step.</p>

              {/* Controls */}
              <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
                <input className="admin-input" placeholder="Search by name, ID, phone, PAN, bank, eStamp..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 320 }} />
                <div className="filter-dropdown-container" style={{ position: "relative", width: "220px" }}>
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
                      {["all", "pending", "verified", "rejected", "on_hold", "pushed_to_bo", "not_pushed_to_bo"].map(f => (
                        <div 
                          key={f}
                          onClick={() => { setFilter(f); setFilterOpen(false); }}
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

                <div className="stage-dropdown-container" style={{ position: "relative", width: "220px" }}>
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
                
                <div className="columns-dropdown-container" style={{ position: "relative", marginLeft: "auto" }}>
                  <button 
                    onClick={() => setColumnsOpen(!columnsOpen)}
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
                      <div style={{ padding: "4px 16px", fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", borderBottom: "1px solid var(--border-color)", paddingBottom: 8, marginBottom: 4 }}>Toggle Columns</div>
                      {ALL_COLUMNS.map(col => (
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
                  onClick={exportToCSV}
                  disabled={kycs.length === 0}
                  style={{ 
                    padding: "10px 16px", 
                    borderRadius: 8, 
                    border: "none", 
                    background: "var(--wise-green)", 
                    color: "white", 
                    fontWeight: 700, 
                    cursor: kycs.length === 0 ? "not-allowed" : "pointer",
                    opacity: kycs.length === 0 ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Export CSV
                </button>
              </div>

              {/* Table */}
              <div className="admin-table-container">
                <div ref={scrollRef} style={{ overflowX: "auto", minHeight: kycs.length < 4 ? "300px" : "auto" }}>
                  <table className="admin-table">
                    <thead><tr>
                      {ALL_COLUMNS.filter(h => visibleColumns.includes(h) || PERMANENT_COLUMNS.includes(h)).map(h => <th key={h} style={getStickyStyle(h, true)}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {kycs.length === 0 ? (
                        <tr>
                          <td colSpan="9" style={{ textAlign: "center", padding: "40px" }}>
                            {loading ? "Loading..." : "No matching KYC requests found."}
                          </td>
                        </tr>
                      ) : kycs.map((k, index) => (
                        <tr 
                          key={k.id} 
                          onClick={() => {
                            const sel = window.getSelection();
                            if (sel && sel.toString().length > 0) return;
                            router.push(`/admin/maker-checker/${k.id}`);
                          }} 
                          style={{ cursor: "pointer", userSelect: "text", WebkitUserSelect: "text" }}
                        >
                          {visibleColumns.includes("S.No.") && (
                            <td style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-muted)", ...getStickyStyle("S.No.") }}>
                              {(page - 1) * 15 + index + 1}
                            </td>
                          )}
                          {visibleColumns.includes("Actions") && (<td style={{ ...getStickyStyle("Actions"), zIndex: openMenuId === k.id ? 20 : 2 }}>
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
                                  {k.status === "verified" && (
                                    <button onClick={() => { setOpenMenuId(null); sendToBackoffice(k.id); }} className="premium-action-item success">Send to Backoffice</button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>)}
                          {visibleColumns.includes("Name") && <td style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", userSelect: "text", WebkitUserSelect: "text", cursor: "text", ...getStickyStyle("Name") }}>{k.name}</td>}
                          {visibleColumns.includes("Client Code") && (
                            <td style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--wise-green)", userSelect: "text", WebkitUserSelect: "text", cursor: "text", ...getStickyStyle("Client Code") }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{k.clientCode || "N/A"}</span>
                                {k.clientCode && k.clientCode !== "N/A" && (
                                  <button onClick={(e) => handleCopy(e, k.clientCode, `cc-${k.id}`)} title="Copy Client Code" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `cc-${k.id}` ? "#16a34a" : "var(--text-muted)" }}>
                                    {copiedKey === `cc-${k.id}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.includes("KYC ID") && (
                            <td style={{ fontWeight: 800, fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{k.id}</span>
                                <button onClick={(e) => handleCopy(e, k.id, `id-${k.id}`)} title="Copy KYC ID" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `id-${k.id}` ? "#16a34a" : "var(--text-muted)" }}>
                                  {copiedKey === `id-${k.id}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                                </button>
                              </div>
                            </td>
                          )}
                          {visibleColumns.includes("Number") && (
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
                          )}
                          {visibleColumns.includes("Email") && (
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
                          )}
                          {visibleColumns.includes("PAN") && (
                            <td style={{ fontWeight: 600, userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{k.pan}</span>
                                {k.pan && k.pan !== "N/A" && (
                                  <button onClick={(e) => handleCopy(e, k.pan, `pan-${k.id}`)} title="Copy PAN" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `pan-${k.id}` ? "#16a34a" : "var(--text-muted)" }}>
                                    {copiedKey === `pan-${k.id}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.includes("Aadhaar") && <td style={{ fontWeight: 600, userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.aadhaar}</td>}
                          {visibleColumns.includes("DOB") && <td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.dob}</td>}
                          {visibleColumns.includes("Gender") && <td style={{ fontSize: "0.82rem", textTransform: "capitalize", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.gender}</td>}
                          {visibleColumns.includes("Father Name") && <td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.fatherName}</td>}
                          {visibleColumns.includes("Mother Name") && <td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.motherName}</td>}
                          {visibleColumns.includes("Bank Name") && <td style={{ fontSize: "0.82rem", fontWeight: 600, userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.bankName}</td>}
                          {visibleColumns.includes("Account No") && (
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
                          )}
                          {visibleColumns.includes("IFSC") && (
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
                          )}
                          {visibleColumns.includes("Nominees") && <td style={{ fontSize: "0.82rem", textAlign: "center", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.nominees}</td>}
                          {visibleColumns.includes("Address") && <td style={{ fontSize: "0.82rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }} title={k.address}>{k.address}</td>}
                          {visibleColumns.includes("City") && <td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.city}</td>}
                          {visibleColumns.includes("State") && <td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.state}</td>}
                          {visibleColumns.includes("Pincode") && <td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.pincode}</td>}
                          {visibleColumns.includes("Occupation") && <td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.occupation}</td>}
                          {visibleColumns.includes("Annual Income") && <td style={{ fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>{k.annualIncome}</td>}
                          {visibleColumns.includes("Step") && <td style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 700 }}>
                            Step {k.stepNum || 0}/14
                          </td>}
                          {visibleColumns.includes("Stage") && <td style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                            {k.stepLabel && k.stepLabel.includes(':') ? k.stepLabel.split(': ')[1] : (k.stepLabel || "Onboarding")}
                          </td>}
                          {visibleColumns.includes("Status") && <td>
                            <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center" }}>
                              <div className="status-dropdown-container" style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                                <div 
                                  onClick={() => setOpenStatusMenuId(openStatusMenuId === k.id ? null : k.id)}
                                  className={`badge ${STATUS_MAP[k.status === 'under_review' ? 'pending' : k.status] || "badge-pending"}`}
                                  style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, border: "none" }}
                                >
                                  {(k.status === 'under_review' ? 'pending' : k.status).replace("_", " ").toUpperCase()}
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: openStatusMenuId === k.id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                                {openStatusMenuId === k.id && (
                                  <div style={{ position: "absolute", top: (index >= kycs.length - 3 && kycs.length > 3) ? "auto" : "100%", bottom: (index >= kycs.length - 3 && kycs.length > 3) ? "100%" : "auto", marginTop: (index >= kycs.length - 3 && kycs.length > 3) ? 0 : 4, marginBottom: (index >= kycs.length - 3 && kycs.length > 3) ? 4 : 0, left: 0, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 50, padding: "4px", minWidth: "120px" }}>
                                    {[
                                      { value: "pending", label: "PENDING" },
                                      { value: "verified", label: "VERIFIED" },
                                      { value: "rejected", label: "REJECTED" },
                                      { value: "on_hold", label: "ON HOLD" }
                                    ].map(opt => (
                                      <div 
                                        key={opt.value}
                                        onClick={() => {
                                          if ((k.status === 'under_review' ? 'pending' : k.status) !== opt.value) {
                                            updateStatus(k.id, opt.value);
                                            setKycs(prev => prev.map(app => app.id === k.id ? { ...app, status: opt.value } : app));
                                          }
                                          setOpenStatusMenuId(null);
                                        }}
                                        style={{ 
                                          padding: "8px 12px", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700, borderRadius: 6,
                                          color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "space-between",
                                          background: "transparent", transition: "background 0.2s"
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-secondary)"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                      >
                                        {opt.label}
                                        {(k.status === 'under_review' ? 'pending' : k.status) === opt.value && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--wise-green)" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {k.isResubmitted && (
                                <span style={{ fontSize: "0.65rem", fontWeight: 800, background: "#fef3c7", color: "#b45309", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", border: "1px solid #fde68a" }}>Modified</span>
                              )}
                            </div>
                          </td>}

                          {visibleColumns.includes("Globe Status") && <td><span className={`badge ${STATUS_MAP[k.globeStatus] || "badge-pending"}`}>{(k.globeStatus || "PENDING").toUpperCase()}</span></td>}
                          {visibleColumns.includes("E-Stamp") && (
                            <td style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{k.eStamp}</span>
                                {k.eStamp && k.eStamp !== "N/A" && (
                                  <button onClick={(e) => handleCopy(e, k.eStamp, `estamp-${k.id}`)} title="Copy E-Stamp" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `estamp-${k.id}` ? "#16a34a" : "var(--text-muted)" }}>
                                    {copiedKey === `estamp-${k.id}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.includes("Start Date") && <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{k.startDate}</td>}
                          {visibleColumns.includes("eSign Date") && <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{k.esignDate}</td>}
                          {visibleColumns.includes("Date") && <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{k.submittedAt}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-color)", fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

              {changeStatusAppId && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ background: "var(--bg-primary)", padding: 24, borderRadius: 12, width: 320, border: "1px solid var(--border-color)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <h3 style={{ margin: 0 }}>Change Progress</h3>
                      <button onClick={() => { setChangeStatusAppId(null); setPendingStep(null); }} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "var(--text-muted)" }}>×</button>
                    </div>
                    
                    {/* Progress Section */}
                    {(() => {
                      const appForStatus = kycs.find(k => k.id === changeStatusAppId);
                      const currentAppStep = appForStatus ? (appForStatus.stepNum || 0) : 0;
                      return (
                        <div style={{ padding: 16, border: pendingStep !== null && pendingStep !== currentAppStep ? "2px solid var(--wise-green)" : "1px solid var(--border-color)", borderRadius: 8, background: "var(--bg-secondary)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>PROGRESS</span>
                            {pendingStep !== null && pendingStep !== currentAppStep && (
                              <span style={{ fontSize: "0.6rem", color: "var(--wise-green)", fontWeight: 800 }}>CHANGED</span>
                            )}
                          </div>
                          <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--wise-green)", marginTop: 8, marginBottom: 4, lineHeight: "1.4", paddingBottom: "2px" }}>
                            {STEP_LABELS[currentAppStep] || `Step ${currentAppStep}`}
                          </div>
                          <select 
                            className="admin-select" 
                            style={{ width: "100%", marginTop: 12, height: "44px", fontSize: "0.95rem", padding: "8px 12px", borderRadius: "8px" }}
                            value={pendingStep !== null ? pendingStep : currentAppStep}
                            onChange={e => setPendingStep(parseInt(e.target.value))}
                          >
                            {Object.entries(STEP_LABELS).map(([num, label]) => <option key={num} value={num}>{label}</option>)}
                          </select>
                          {pendingStep !== null && pendingStep !== currentAppStep && (
                            <button 
                              onClick={() => {
                                updateStatus(changeStatusAppId, appForStatus?.status || "pending", { currentStep: pendingStep });
                                setChangeStatusAppId(null);
                                setPendingStep(null);
                              }}
                              style={{ width: "100%", marginTop: 16, padding: "12px", borderRadius: 8, background: "var(--wise-green)", color: "white", border: "none", fontWeight: 800, cursor: "pointer", fontSize: "0.95rem", boxShadow: "0 4px 12px rgba(48, 164, 108, 0.3)", transition: "all 0.2s ease" }}
                            >
                              Save Step Change
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
