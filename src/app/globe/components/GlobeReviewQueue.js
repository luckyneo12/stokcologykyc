import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ListFilter, ArrowUpDown, ArrowUp, ArrowDown, EyeOff } from "lucide-react";
import "../globe-table.css";

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
  14: "Step 14: eSign Done"
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
  "Name": 210, // room for the label + filter / sort buttons
  "Client Code": 200
};
const NO_FILTER_SORT_COLUMNS = ["S.No.", "Actions"]; // nothing useful to filter or sort by

/** Text shown in a column for an application (used by the column filters and sorting). */
function getCellValue(app, col) {
  const parse = (v) => { try { return typeof v === "string" ? JSON.parse(v) : (v || {}); } catch (e) { return {}; } };
  const personal = parse(app.personalDetails);
  const identity = parse(app.identityDetails);
  const esign = parse(app.esignDetails);
  const stepLabel = STEP_LABELS[app.currentStep] || "Onboarding";
  switch (col) {
    case "Name": return personal.fullName || personal.name || "N/A";
    case "Client Code": return app.clientCode || "N/A";
    case "KYC ID": return app.applicationId || app.id;
    case "Number": return app.user?.phone || "N/A";
    case "Email": return app.user?.email || personal.email || "N/A";
    case "PAN": return identity.panNumber || identity.pan || personal.pan || "N/A";
    case "Step": return `Step ${app.currentStep || 0}/14`;
    case "Stage": return stepLabel.includes(":") ? stepLabel.split(": ")[1] : stepLabel;
    case "Status": return (app.status === "under_review" ? "pending" : app.status || "").replace("_", " ").toUpperCase();
    case "Globe Status": return String(app.globeStatus || "").toUpperCase();
    case "Time Pending": return app.globeStatus === "pending" ? formatTimePending(app.updatedAt || app.createdAt) : "-";
    case "E-Stamp Certificate No": return app.user?.eStampAssigned?.certificateNo || app.user?.eStamp || "N/A";
    case "E-Stamp Serial No": return app.user?.eStampAssigned?.serialNo || "N/A";
    case "Start Date": return app.createdAt ? new Date(app.createdAt).toLocaleString("en-IN") : "N/A";
    case "eSign Date": return esign.timestamp || (app.currentStep >= 14 ? new Date(app.updatedAt).toLocaleString("en-IN") : "Pending");
    case "Date": return new Date(app.updatedAt || app.createdAt).toLocaleString();
    default: return "";
  }
}

const ALL_COLUMNS = ["S.No.", "Actions", "Name", "Client Code", "KYC ID", "Number", "Email", "PAN", "Step", "Stage", "Status", "Globe Status", "Time Pending", "E-Stamp Certificate No", "E-Stamp Serial No", "Start Date", "eSign Date", "Date"];

export default function GlobeReviewQueue({ applications, handleAction, activeSection }) {
  const isPending = activeSection === "pending";
  const title = isPending ? "Pending Applications" : activeSection === "approved" ? "Approved Applications" : activeSection === "rejected" ? "Rejected Applications" : "Review Queue";
  
  const [visibleColumns, setVisibleColumns] = useState(["S.No.", "Actions", "Name", "Client Code", "KYC ID", "Number", "Step", "Stage", "Status", "Globe Status", "Time Pending", "Date"]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnsLoaded, setColumnsLoaded] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  // Column filters / sort (same as the Maker / Checker list)
  const [columnFilters, setColumnFilters] = useState({});
  const [columnValueFilters, setColumnValueFilters] = useState({}); // { [column]: [selected values] }
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [filterPopupPos, setFilterPopupPos] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const toFilterValue = (v) => {
    const str = String(v ?? "").trim();
    return str === "" || str === "N/A" ? "(Blank)" : str;
  };
  const displayApps = useMemo(() => {
    let result = [...(applications || [])];
    Object.keys(columnValueFilters).forEach(col => {
      const selected = columnValueFilters[col];
      if (selected && selected.length > 0) result = result.filter(a => selected.includes(toFilterValue(getCellValue(a, col))));
    });
    Object.keys(columnFilters).forEach(col => {
      const term = columnFilters[col]?.toLowerCase();
      if (term) result = result.filter(a => String(getCellValue(a, col) || "").toLowerCase().includes(term));
    });
    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aVal = String(getCellValue(a, sortConfig.key) || "").toLowerCase();
        const bVal = String(getCellValue(b, sortConfig.key) || "").toLowerCase();
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applications, columnFilters, columnValueFilters, sortConfig]);

  // The filter popup is drawn above the page; close it when the page / table scrolls or resizes
  useEffect(() => {
    if (!activeFilterCol) return;
    const close = (e) => {
      if (e?.target?.closest && e.target.closest(".column-filter-container")) return;
      setActiveFilterCol(null);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [activeFilterCol]);
  const handleCopy = (e, text, key) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text || text === "N/A" || text === "Pending" || text === "—") return;
    navigator.clipboard.writeText(String(text));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("globeVisibleColumns");
      if (saved) {
        try {
          setVisibleColumns(JSON.parse(saved).flatMap(c => c === "E-Stamp" ? ["E-Stamp Certificate No", "E-Stamp Serial No"] : [c]));
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
      if (!e.target.closest('.column-filter-container')) {
        setActiveFilterCol(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const getStickyStyle = (colName, isHeader = false) => {
    if (!PERMANENT_COLUMNS.includes(colName)) return {};
    
    // Dynamically adjust Actions width based on whether we need space for Approve/Reject buttons
    // (120: room for the View button plus the cell padding, so it is never clipped)
    const actionsWidth = isPending ? 320 : 120;
    
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
    if (!displayApps || displayApps.length === 0) return;
    const headers = ALL_COLUMNS.filter(c => c !== "Actions" && c !== "S.No.");
    const rows = displayApps.map(app => {
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
      const eStampCertNo = app.user?.eStampAssigned?.certificateNo || app.user?.eStamp || "N/A";
      const eStampSerialNo = app.user?.eStampAssigned?.serialNo || "N/A";
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
        if (col === "E-Stamp Certificate No") return eStampCertNo;
        if (col === "E-Stamp Serial No") return eStampSerialNo;
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
          <h2 className="admin-section-title" style={{ fontSize: "1.8rem", fontWeight: 900, letterSpacing: "-0.5px", margin: 0, color: "var(--text-primary)" }}>
            {title}
          </h2>
          <p className="admin-section-subtitle" style={{ margin: "4px 0 0", color: "var(--text-muted)", fontWeight: 600 }}>
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
        <div style={{ overflowX: "auto", minHeight: (!applications || applications.length < 4) ? "300px" : "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                {ALL_COLUMNS.filter(h => visibleColumns.includes(h) || PERMANENT_COLUMNS.includes(h)).map(h => (
                  <th key={h} style={getStickyStyle(h, true)}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span>{h}</span>
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
                                  if (prev.direction === "asc") return { key: h, direction: "desc" };
                                  return { key: null, direction: null };
                                }
                                return { key: h, direction: "asc" };
                              });
                            }}
                            style={{ background: "transparent", border: "none", cursor: "pointer", color: sortConfig.key === h ? "var(--wise-green)" : "var(--text-muted)", padding: 2 }}
                            title="Sort"
                          >
                            {sortConfig.key === h ? (
                              sortConfig.direction === "asc" ? <ArrowUp size={13} strokeWidth={2.4} /> : <ArrowDown size={13} strokeWidth={2.4} />
                            ) : (
                              <ArrowUpDown size={13} strokeWidth={2.4} />
                            )}
                          </button>
                        </>)}
                        {!PERMANENT_COLUMNS.includes(h) && (
                          <button
                            className="mc-th-btn"
                            onClick={(e) => { e.stopPropagation(); setVisibleColumns(prev => prev.filter(c => c !== h)); }}
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
                          onKeyDown={(e) => { if (e.key === "Enter") setActiveFilterCol(null); }}
                          style={{ padding: "4px 8px", fontSize: "0.8rem", borderRadius: 4, border: "1px solid var(--border-color)", width: 150 }}
                        />
                        {(() => {
                          // Values of this column, narrowed by the search text
                          const term = (columnFilters[h] || "").toLowerCase();
                          const values = Array.from(new Set((applications || []).map(a => toFilterValue(getCellValue(a, h)))))
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
              </tr>
            </thead>
            <tbody>
              {(!displayApps || displayApps.length === 0) ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: "40px" }}>
                    No matching KYC requests found.
                  </td>
                </tr>
              ) : displayApps.map((app, index) => {
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
                const eStampCertNo = app.user?.eStampAssigned?.certificateNo || app.user?.eStamp || "N/A";
                const eStampSerialNo = app.user?.eStampAssigned?.serialNo || "N/A";
                const stepNum = app.currentStep || 0;
                const stepLabel = STEP_LABELS[app.currentStep] || "Onboarding";
                const startDate = app.createdAt ? new Date(app.createdAt).toLocaleString("en-IN") : "N/A";
                const esignDate = parsedEsign.timestamp || (app.currentStep >= 14 ? new Date(app.updatedAt).toLocaleString("en-IN") : "Pending");
                const submittedAt = new Date(app.updatedAt || app.createdAt).toLocaleString();
                const routeId = app.applicationId || app.id; // application ID — the review page's actions look it up by this
                const displayKycId = app.applicationId || app.id;

                return (
                  <tr 
                    key={routeId} 
                    style={{ userSelect: "text", WebkitUserSelect: "text" }}
                  >
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
                            {/* No Reject here: rejecting is done inside the application (sections / documents + Send Rejection Mail) */}
                          </>
                        )}
                      </div>
                    </td>)}
                    {visibleColumns.includes("Name") && <td style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", userSelect: "text", WebkitUserSelect: "text", cursor: "text", ...getStickyStyle("Name") }}>{name}</td>}
                    {visibleColumns.includes("Client Code") && (
                      <td style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--wise-green)", userSelect: "text", WebkitUserSelect: "text", cursor: "text", ...getStickyStyle("Client Code") }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span>{app.clientCode || "N/A"}</span>
                          {app.clientCode && app.clientCode !== "N/A" && (
                            <button onClick={(e) => handleCopy(e, app.clientCode, `cc-${routeId}`)} title="Copy Client Code" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `cc-${routeId}` ? "#16a34a" : "var(--text-muted)" }}>
                              {copiedKey === `cc-${routeId}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes("KYC ID") && (
                      <td style={{ fontWeight: 800, fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span>{displayKycId}</span>
                          <button onClick={(e) => handleCopy(e, displayKycId, `id-${routeId}`)} title="Copy KYC ID" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `id-${routeId}` ? "#16a34a" : "var(--text-muted)" }}>
                            {copiedKey === `id-${routeId}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                          </button>
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes("Number") && (
                      <td style={{ fontWeight: 600, userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span>{number}</span>
                          {number && number !== "N/A" && (
                            <button onClick={(e) => handleCopy(e, number, `phone-${routeId}`)} title="Copy Phone Number" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `phone-${routeId}` ? "#16a34a" : "var(--text-muted)" }}>
                              {copiedKey === `phone-${routeId}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes("Email") && (
                      <td style={{ fontSize: "0.82rem", color: "var(--text-primary)", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span>{email}</span>
                          {email && email !== "N/A" && (
                            <button onClick={(e) => handleCopy(e, email, `email-${routeId}`)} title="Copy Email" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `email-${routeId}` ? "#16a34a" : "var(--text-muted)" }}>
                              {copiedKey === `email-${routeId}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes("PAN") && (
                      <td style={{ fontWeight: 600, userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span>{pan}</span>
                          {pan && pan !== "N/A" && (
                            <button onClick={(e) => handleCopy(e, pan, `pan-${routeId}`)} title="Copy PAN" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `pan-${routeId}` ? "#16a34a" : "var(--text-muted)" }}>
                              {copiedKey === `pan-${routeId}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
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
                      {isPending ? formatTimePending(app.updatedAt || app.createdAt) : "-"}
                    </td>}
                    {visibleColumns.includes("E-Stamp Certificate No") && (
                      <td style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span>{eStampCertNo}</span>
                          {eStampCertNo && eStampCertNo !== "N/A" && (
                            <button onClick={(e) => handleCopy(e, eStampCertNo, `estampcert-${routeId}`)} title="Copy Certificate No" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `estampcert-${routeId}` ? "#16a34a" : "var(--text-muted)" }}>
                              {copiedKey === `estampcert-${routeId}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes("E-Stamp Serial No") && (
                      <td style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.82rem", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span>{eStampSerialNo}</span>
                          {eStampSerialNo && eStampSerialNo !== "N/A" && (
                            <button onClick={(e) => handleCopy(e, eStampSerialNo, `estampserial-${routeId}`)} title="Copy Serial No" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: copiedKey === `estampserial-${routeId}` ? "#16a34a" : "var(--text-muted)" }}>
                              {copiedKey === `estampserial-${routeId}` ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
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

