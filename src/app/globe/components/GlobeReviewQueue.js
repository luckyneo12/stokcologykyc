import { useState, useEffect } from "react";
import { useDragScroll } from "@/utils/useDragScroll";
import "@/app/admin/admin.css";

function formatTimePending(createdAt) {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays} days`;
  if (diffHours > 0) return `${diffHours} hours`;
  return `${diffMins} mins`;
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
  pending: "badge-pending", 
  under_review: "badge-review",
  identity_verified: "badge-verified",
  verified: "badge-verified", 
  rejected: "badge-rejected", 
  on_hold: "badge-suspended",
  approved: "badge-verified"
};

const PERMANENT_COLUMNS = ["S.No.", "Actions", "Name", "Client Code"];
const PERMANENT_WIDTHS = {
  "S.No.": 60,
  "Actions": 320, // This will be dynamically overridden in the component
  "Name": 180,
  "Client Code": 120
};
const ALL_COLUMNS = ["S.No.", "Actions", "Name", "Client Code", "KYC ID", "Number", "Email", "PAN", "Step", "Stage", "Status", "Globe Status", "Time Pending", "E-Stamp", "Start Date", "eSign Date", "Date"];

export default function GlobeReviewQueue({ applications, handleAction, activeSection }) {
  const isPending = activeSection === "pending";
  const title = isPending ? "Pending Applications" : activeSection === "approved" ? "Approved Applications" : activeSection === "rejected" ? "Rejected Applications" : "Review Queue";
  
  const [visibleColumns, setVisibleColumns] = useState(["S.No.", "Actions", "Name", "Client Code", "KYC ID", "Number", "Step", "Stage", "Status", "Globe Status", "Time Pending", "Date"]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnsLoaded, setColumnsLoaded] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const scrollRef = useDragScroll();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("globeVisibleColumns");
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
      localStorage.setItem("globeVisibleColumns", JSON.stringify(visibleColumns));
    }
  }, [visibleColumns, columnsLoaded]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.columns-dropdown-container')) {
        setColumnsOpen(false);
      }
      if (!e.target.closest('.action-menu-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const getStickyStyle = (colName, isHeader = false) => {
    if (!PERMANENT_COLUMNS.includes(colName)) return {};
    
    // Dynamically adjust Actions width based on whether we need space for Approve/Reject buttons
    const actionsWidth = isPending ? 320 : 80;
    
    let left = 0;
    for (const c of PERMANENT_COLUMNS) {
      if (c === colName) break;
      const w = c === "Actions" ? actionsWidth : PERMANENT_WIDTHS[c];
      left += w;
    }
    
    const width = colName === "Actions" ? actionsWidth : PERMANENT_WIDTHS[colName];
    
    return {
      position: "sticky",
      left,
      zIndex: isHeader ? 11 : 10,
      minWidth: width,
      maxWidth: width,
      width: width,
      backgroundColor: "var(--bg-sticky)",
      boxShadow: "none",
    };
  };

  const exportToCSV = () => {
    if (!applications || applications.length === 0) return;
    const headers = ALL_COLUMNS.filter(c => c !== "Actions" && c !== "S.No.");
    const rows = applications.map(app => {
      let parsedPersonal = {};
      try { parsedPersonal = typeof app.personalDetails === "string" ? JSON.parse(app.personalDetails) : (app.personalDetails || {}); } catch(e) {}
      let parsedIdentity = {};
      try { parsedIdentity = typeof app.identityDetails === "string" ? JSON.parse(app.identityDetails) : (app.identityDetails || {}); } catch(e) {}
      let parsedEsign = {};
      try { parsedEsign = typeof app.esignDetails === "string" ? JSON.parse(app.esignDetails) : (app.esignDetails || {}); } catch(e) {}
      
      const name = parsedPersonal.fullName || parsedPersonal.name || "N/A";
      const number = app.user?.phone || "N/A";
      const email = app.user?.email || parsedPersonal.email || "N/A";
      const pan = parsedIdentity.panNumber || parsedIdentity.pan || parsedPersonal.pan || "N/A";
      const eStamp = app.user?.eStampAssigned?.serialNo || app.user?.eStamp || "N/A";
      const stepNum = app.currentStep || 0;
      const stepLabel = STEP_LABELS[app.currentStep] || "Onboarding";
      const startDate = app.createdAt ? new Date(app.createdAt).toLocaleString("en-IN") : "N/A";
      const esignDate = parsedEsign.timestamp || (app.currentStep >= 14 ? new Date(app.updatedAt).toLocaleString("en-IN") : "Pending");
      const submittedAt = new Date(app.updatedAt || app.createdAt).toLocaleString();

      return headers.map(col => {
        if (col === "KYC ID") return app.applicationId || app.id;
        if (col === "Client Code") return app.clientCode || "N/A";
        if (col === "Number") return number;
        if (col === "Name") return `"${name}"`;
        if (col === "Email") return `"${email}"`;
        if (col === "PAN") return pan;
        if (col === "Step") return `Step ${stepNum}/14`;
        if (col === "Stage") return `"${(stepLabel.includes(':')) ? stepLabel.split(': ')[1] : stepLabel}"`;
        if (col === "Status") return app.status;
        if (col === "Globe Status") return app.globeStatus;
        if (col === "Time Pending") return isPending ? formatTimePending(app.createdAt) : "-";
        if (col === "E-Stamp") return eStamp;
        if (col === "Start Date") return `"${startDate}"`;
        if (col === "eSign Date") return `"${esignDate}"`;
        if (col === "Date") return `"${submittedAt}"`;
        return "";
      });
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `globe_export_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: "1.8rem", fontWeight: 900, letterSpacing: "-0.5px", margin: 0, color: "var(--text-primary)" }}>
            {title}
          </h2>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontWeight: 600 }}>
            {isPending ? "Manage and process pending KYC applications" : `View ${activeSection} KYC applications`}
          </p>
        </div>
        
        <div style={{ display: "flex", gap: 12 }}>
          <div className="columns-dropdown-container" style={{ position: "relative" }}>
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
              <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 8, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 50, minWidth: 200, padding: "8px 0" }}>
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
            disabled={!applications || applications.length === 0}
            style={{ 
              padding: "10px 16px", 
              borderRadius: 8, 
              border: "none", 
              background: "var(--wise-green)", 
              color: "white", 
              fontWeight: 700, 
              cursor: (!applications || applications.length === 0) ? "not-allowed" : "pointer",
              opacity: (!applications || applications.length === 0) ? 0.6 : 1,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Export CSV
          </button>
        </div>
      </div>

      <div className="admin-table-container">
        <div ref={scrollRef} style={{ overflowX: "auto", minHeight: (!applications || applications.length < 4) ? "300px" : "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                {ALL_COLUMNS.filter(h => visibleColumns.includes(h) || PERMANENT_COLUMNS.includes(h)).map(h => <th key={h} style={getStickyStyle(h, true)}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(!applications || applications.length === 0) ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: "40px" }}>
                    No matching KYC requests found.
                  </td>
                </tr>
              ) : applications.map((app, index) => {
                let parsedPersonal = {};
                try { parsedPersonal = typeof app.personalDetails === "string" ? JSON.parse(app.personalDetails) : (app.personalDetails || {}); } catch(e) {}
                let parsedIdentity = {};
                try { parsedIdentity = typeof app.identityDetails === "string" ? JSON.parse(app.identityDetails) : (app.identityDetails || {}); } catch(e) {}
                let parsedEsign = {};
                try { parsedEsign = typeof app.esignDetails === "string" ? JSON.parse(app.esignDetails) : (app.esignDetails || {}); } catch(e) {}
                
                const name = parsedPersonal.fullName || parsedPersonal.name || "N/A";
                const number = app.user?.phone || "N/A";
                const email = app.user?.email || parsedPersonal.email || "N/A";
                const pan = parsedIdentity.panNumber || parsedIdentity.pan || parsedPersonal.pan || "N/A";
                const eStamp = app.user?.eStampAssigned?.serialNo || app.user?.eStamp || "N/A";
                const stepNum = app.currentStep || 0;
                const stepLabel = STEP_LABELS[app.currentStep] || "Onboarding";
                const startDate = app.createdAt ? new Date(app.createdAt).toLocaleString("en-IN") : "N/A";
                const esignDate = parsedEsign.timestamp || (app.currentStep >= 14 ? new Date(app.updatedAt).toLocaleString("en-IN") : "Pending");
                const submittedAt = new Date(app.updatedAt || app.createdAt).toLocaleString();
                const routeId = app.id || app.applicationId;
                const displayKycId = app.applicationId || app.id;

                return (
                  <tr key={routeId} style={{ cursor: "pointer" }} onClick={(e) => {
                    if (!e.target.closest('.action-menu-container') && !e.target.closest('button')) {
                      window.location.href = `/globe/maker-checker/${routeId}`;
                    }
                  }}>
                    {visibleColumns.includes("S.No.") && (
                      <td style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-muted)", ...getStickyStyle("S.No.") }}>
                        {index + 1}
                      </td>
                    )}
                    {visibleColumns.includes("Actions") && (<td style={{ ...getStickyStyle("Actions"), zIndex: 2 }}>
                      <div style={{ display: "flex", gap: "10px" }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => window.location.href = `/globe/maker-checker/${routeId}`} style={{ padding: "8px 16px", background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", transition: "all 0.2s ease" }}>View</button>
                        {app.globeStatus === "pending" && (
                          <>
                            <button onClick={() => handleAction(routeId, 'approve')} style={{ padding: "8px 16px", background: "#10b981", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", transition: "all 0.2s ease" }}>Approve</button>
                            <button onClick={() => handleAction(routeId, 'reject')} style={{ padding: "8px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", transition: "all 0.2s ease" }}>Reject</button>
                          </>
                        )}
                      </div>
                    </td>)}
                    {visibleColumns.includes("Name") && <td style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", ...getStickyStyle("Name") }}>{name}</td>}
                    {visibleColumns.includes("Client Code") && <td style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--wise-green)", ...getStickyStyle("Client Code") }}>{app.clientCode || "N/A"}</td>}
                    {visibleColumns.includes("KYC ID") && <td style={{ fontWeight: 800, fontSize: "0.82rem" }}>{displayKycId}</td>}
                    {visibleColumns.includes("Number") && <td style={{ fontWeight: 600 }}>{number}</td>}
                    {visibleColumns.includes("Email") && <td style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>{email}</td>}
                    {visibleColumns.includes("PAN") && <td style={{ fontWeight: 600 }}>{pan}</td>}
                    {visibleColumns.includes("Step") && <td style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 700 }}>
                      Step {stepNum}/14
                    </td>}
                    {visibleColumns.includes("Stage") && <td style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      {stepLabel.includes(':') ? stepLabel.split(': ')[1] : stepLabel}
                    </td>}
                    {visibleColumns.includes("Status") && <td>
                      <span className={`badge ${STATUS_MAP[app.status === 'under_review' ? 'pending' : app.status] || "badge-pending"}`}>
                        {(app.status === 'under_review' ? 'pending' : app.status).replace("_", " ").toUpperCase()}
                      </span>
                    </td>}
                    {visibleColumns.includes("Globe Status") && <td>
                      <span style={{ 
                        padding: "6px 12px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: 800, 
                        background: app.globeStatus === 'approved' ? '#10b98120' : app.globeStatus === 'rejected' ? '#ef444420' : '#f59e0b20', 
                        color: app.globeStatus === 'approved' ? '#10b981' : app.globeStatus === 'rejected' ? '#ef4444' : '#f59e0b', 
                        textTransform: 'uppercase' 
                      }}>
                        {app.globeStatus}
                      </span>
                    </td>}
                    {visibleColumns.includes("Time Pending") && <td style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600 }}>
                      {isPending ? formatTimePending(app.createdAt) : "-"}
                    </td>}
                    {visibleColumns.includes("E-Stamp") && <td style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.82rem" }}>{eStamp}</td>}
                    {visibleColumns.includes("Start Date") && <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{startDate}</td>}
                    {visibleColumns.includes("eSign Date") && <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{esignDate}</td>}
                    {visibleColumns.includes("Date") && <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{submittedAt}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

