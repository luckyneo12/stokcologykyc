"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi, adminFile, toQuery } from "./adminApi";
import { useAdmin, STATUS_LABELS, formatDateTime } from "./AdminShell";

const CARD_ICON = (d) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const CARDS = [
  { status: "in_progress", label: "In Progress", color: "#3b82f6", icon: CARD_ICON(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2.5" /></>) },
  { status: "to_be_verified", label: "To Be Verified", color: "#e03131", icon: CARD_ICON(<><path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" /><path d="M9 12l2 2 4-4" /></>) },
  { status: "esigned", label: "Esigned", color: "#e64980", icon: CARD_ICON(<><path d="M4 20l4-1 10-10-3-3L5 16l-1 4z" /><path d="M13 7l3 3" /></>) },
  { status: "completed", label: "Completed", color: "#40c057", icon: CARD_ICON(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 13l2 2 4-4" /></>) },
  { status: "rejected", label: "Rejected", color: "#fd7e14", icon: CARD_ICON(<><path d="M5 6h14M5 10h14M5 14h6" /><circle cx="17" cy="17" r="4" /><path d="M15.5 15.5l3 3M18.5 15.5l-3 3" /></>) },
];

const EMPTY_FILTERS = { workflow: "modification", from: "", to: "", search: "" };

/**
 * Request list. On the dashboard the status cards filter the list; on a queue page
 * the status is fixed (fixedStatus) and the cards are hidden.
 */
export default function RequestsBoard({ fixedStatus, title = "Maker-Checker" }) {
  const router = useRouter();
  const { can, counts, notify, refreshCounts } = useAdmin();
  const [status, setStatus] = useState(fixedStatus || "all");
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [data, setData] = useState({ requests: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminApi(`/requests${toQuery({ ...filters, status, page, limit })}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters, status, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const apply = () => {
    setPage(1);
    setFilters(draft);
  };
  const clear = () => {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const download = async (kind) => {
    setDownloading(kind);
    try {
      const params = toQuery({ ...filters, status: kind === "pdf" ? (status === "all" ? "all_esigned" : status) : status });
      if (kind === "mis") await adminFile(`/export/mis${params}`, { download: true, filename: `rekyc_mis_${new Date().toISOString().slice(0, 10)}.csv` });
      else await adminFile(`/export/esigned-pdfs${params}`, { download: true, filename: `rekyc_esigned_${new Date().toISOString().slice(0, 10)}.pdf` });
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setDownloading("");
    }
  };

  const pages = Math.max(1, Math.ceil(data.total / limit));

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1>{title}</h1>
        <button className="ra-btn ra-btn-ghost ra-btn-sm" onClick={() => { load(); refreshCounts(); }}>Refresh</button>
      </div>

      <div className="ra-panel">
        {!fixedStatus && (
          <>
            <div className="ra-hero" role="button" tabIndex={0} onClick={() => { setStatus("all_esigned"); setPage(1); }} onKeyDown={(e) => e.key === "Enter" && setStatus("all_esigned")}>
              <div>
                <b>All Esigned Entries</b>
                <div className="ra-hint">Across all workflows</div>
              </div>
              <div className="num">{counts?.all_esigned ?? "–"}</div>
            </div>
            <div className="ra-cards">
              {CARDS.map((c) => (
                <button key={c.status} className="ra-stat" aria-pressed={status === c.status} onClick={() => { setStatus(status === c.status ? "all" : c.status); setPage(1); }}>
                  <span className="ra-stat-icon" style={{ background: c.color }}>{c.icon}</span>
                  <div className="num">{counts?.[c.status] ?? "–"}</div>
                  <div className="lbl">{c.label}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {can("report.export") && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <button className="ra-btn" onClick={() => download("mis")} disabled={!!downloading}>{downloading === "mis" && <span className="ra-spinner" />} Download MIS File</button>
            <button className="ra-btn" onClick={() => download("pdf")} disabled={!!downloading}>{downloading === "pdf" && <span className="ra-spinner" />} Download All Esigned PDF</button>
          </div>
        )}

        <div className="ra-toolbar">
          <label className="ra-mini">
            <span style={{ color: "var(--ra-muted)" }}>Per Page</span>
            <select className="ra-select" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} style={{ width: 80 }}>
              {[10, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          <label className="ra-mini">
            <span>Workflow</span>
            <select className="ra-select" value={draft.workflow} onChange={(e) => setDraft((d) => ({ ...d, workflow: e.target.value }))} style={{ width: 170 }}>
              <option value="modification">modification</option>
              <option value="all">all</option>
            </select>
          </label>
          <label className="ra-mini">
            <span>From</span>
            <input type="date" className="ra-input" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} style={{ width: 160 }} />
          </label>
          <label className="ra-mini">
            <span>To</span>
            <input type="date" className="ra-input" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} style={{ width: 160 }} />
          </label>
          <button className="ra-btn ra-btn-sm" style={{ minHeight: 40 }} onClick={apply} aria-label="Apply filters">Filter</button>
          <button className="ra-btn ra-btn-ghost ra-btn-sm" style={{ minHeight: 40 }} onClick={clear} aria-label="Clear filters">✕</button>
          <span className="grow" />
          <input
            className="ra-input"
            placeholder="Search..."
            value={draft.search}
            onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            style={{ width: 240 }}
            aria-label="Search by client code, name, PAN, mobile, e-mail or request ID"
          />
        </div>

        {!fixedStatus && status !== "all" && (
          <div className="ra-alert ra-alert-info" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Showing: <b>{status === "all_esigned" ? "All eSigned" : STATUS_LABELS[status]}</b></span>
            <button className="ra-btn ra-btn-ghost ra-btn-sm" onClick={() => setStatus("all")}>Show all</button>
          </div>
        )}
        {error && <div className="ra-alert ra-alert-error">{error}</div>}

        <div className="ra-table-wrap">
          <table className="ra-table">
            <thead>
              <tr>
                <th>Action</th><th>Client Code</th><th>User Identity</th><th>Name</th><th>DOB</th><th>PAN</th><th>Changes</th><th>Status</th><th>Created Date-Time</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: 28 }}><span className="ra-spinner" /></td></tr>
              )}
              {!loading && data.requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button className="ra-btn ra-btn-sm" onClick={() => router.push(`/rekyc-admin/requests/${r.id}`)}>
                      {["esigned", "to_be_verified"].includes(r.status) ? "Verify" : "View"}
                    </button>
                  </td>
                  <td style={{ fontWeight: 600 }}>{r.clientCode}</td>
                  <td className="ra-mono">{r.id}</td>
                  <td>{r.name || "-"}</td>
                  <td>{r.dob || "-"}</td>
                  <td>{r.pan || "-"}</td>
                  <td className="wrap" style={{ minWidth: 160 }}>{r.sections.length ? r.sections.map((s) => <span key={s} className="ra-pill ra-pill-tag">{s}</span>) : <span className="ra-hint">None yet</span>}</td>
                  <td><span className={`ra-pill ra-pill-${r.status}`}>{r.statusLabel}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.createdAt)}</td>
                </tr>
              ))}
              {!loading && !data.requests.length && (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: 28, color: "var(--ra-muted)" }}>No requests found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="ra-pager">
          <span className="ra-hint">
            {data.total ? `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, data.total)} of ${data.total}` : ""}
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="ra-btn ra-btn-ghost ra-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span>Page {page} of {pages}</span>
            <button className="ra-btn ra-btn-ghost ra-btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>
    </>
  );
}
