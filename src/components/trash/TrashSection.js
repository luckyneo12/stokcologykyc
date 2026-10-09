"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { API_BASE_URL } from "@/utils/apiConfig";

/**
 * Trash — KYC applications deleted from the admin / Globe portal.
 * They stay here (hidden from Maker / Checker and every other list) until restored or deleted permanently.
 *
 * Props:
 *   apiBase     "/api/admin" | "/api/globe"
 *   tokenKey    localStorage key of the portal token ("adminToken" | "globeToken")
 *   detailPath  maker-checker detail route ("/admin/maker-checker" | "/globe/maker-checker")
 */
const STATUS_LABELS = {
  pending: "In Progress",
  under_review: "Under Review",
  verified: "Verified",
  rejected: "Rejected",
  on_hold: "On Hold",
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
};

export default function TrashSection({ apiBase, tokenKey, detailPath }) {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${localStorage.getItem(tokenKey)}` }), [tokenKey]);

  const fetchTrash = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}${apiBase}/trash`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Could not load the Trash");
      setItems(Array.isArray(data.data) ? data.data : []);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load the Trash");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [apiBase, authHeaders]);

  useEffect(() => {
    fetchTrash();
    const socket = io(API_BASE_URL, { withCredentials: true });
    socket.on("connect", () => socket.emit("join_staff"));
    socket.on("applications_updated", () => fetchTrash(true));
    return () => socket.disconnect();
  }, [fetchTrash]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      [it.applicationId, it.name, it.pan, it.phone, it.email, it.clientCode, it.deletedBy]
        .some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [items, search]);

  const openApplication = (applicationId) => {
    router.push(`${detailPath}/${encodeURIComponent(applicationId)}?trash=1`);
  };

  const restore = async (item) => {
    if (!confirm(`Restore the KYC application of ${item.name || item.applicationId}? It will go back to Maker / Checker with its earlier status.`)) return;
    setBusyId(item.applicationId);
    try {
      const res = await fetch(`${API_BASE_URL}${apiBase}/trash/${encodeURIComponent(item.applicationId)}/restore`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Restore failed");
      showToast("Application restored");
      setItems((prev) => prev.filter((it) => it.applicationId !== item.applicationId));
    } catch (err) {
      showToast(err.message || "Restore failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  const deleteForever = async (item) => {
    if (!confirm(`PERMANENTLY delete the KYC application of ${item.name || item.applicationId}?\n\nAll its documents, biometric data and progress will be removed. This cannot be undone.`)) return;
    const deleteUser = confirm("Do you also want to DELETE the USER ACCOUNT of this applicant?\n\nOK = delete the user account too\nCancel = keep the user account, delete only this application");
    setBusyId(item.applicationId);
    try {
      const res = await fetch(`${API_BASE_URL}${apiBase}/trash/${encodeURIComponent(item.applicationId)}${deleteUser ? "?deleteUser=true" : ""}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Delete failed");
      showToast(data.message || "Deleted permanently");
      setItems((prev) => prev.filter((it) => it.applicationId !== item.applicationId));
    } catch (err) {
      showToast(err.message || "Delete failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="trs-root">
      <style>{TRASH_STYLES}</style>

      <div className="trs-head">
        <div>
          <h2 className="trs-title">
            <TrashIcon size={22} /> Trash
          </h2>
          <p className="trs-sub">Deleted KYC applications. They are hidden from Maker / Checker and all lists until restored. Open one to view it (read-only).</p>
        </div>
        <div className="trs-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, PAN, mobile, KYC ID…" />
        </div>
      </div>

      <div className="trs-card">
        {loading ? (
          <div className="trs-empty">Loading Trash…</div>
        ) : error ? (
          <div className="trs-empty trs-error">
            {error} <button type="button" className="trs-link" onClick={() => fetchTrash()}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="trs-empty">
            <TrashIcon size={34} />
            <p>{items.length === 0 ? "Trash is empty" : "No deleted application matches your search"}</p>
          </div>
        ) : (
          <div className="trs-scroll">
            <table className="trs-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>KYC ID</th>
                  <th>Mobile / Email</th>
                  <th>Status before delete</th>
                  <th>Deleted by</th>
                  <th>Deleted on</th>
                  <th className="trs-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => {
                  const busy = busyId === it.applicationId;
                  return (
                    <tr key={it.applicationId} onClick={() => openApplication(it.applicationId)} title="Open (view only)">
                      <td>
                        <div className="trs-name">{it.name || "—"}</div>
                        <div className="trs-muted">{it.pan || ""}{it.clientCode ? ` · UCC ${it.clientCode}` : ""}</div>
                      </td>
                      <td className="trs-mono">{it.applicationId}</td>
                      <td>
                        <div>{it.phone || "—"}</div>
                        <div className="trs-muted">{it.email || ""}</div>
                      </td>
                      <td><span className="trs-chip">{STATUS_LABELS[it.previousStatus] || it.previousStatus || "—"}</span></td>
                      <td>
                        <div>{it.deletedBy || "—"}</div>
                        <div className="trs-muted">{it.deletedByRole === "globe" ? "Globe" : it.deletedByRole === "kyc_team" ? "KYC Team" : it.deletedByRole ? "Admin" : ""}</div>
                      </td>
                      <td>{formatDateTime(it.deletedAt)}</td>
                      <td className="trs-right" onClick={(e) => e.stopPropagation()}>
                        <div className="trs-actions">
                          <button type="button" className="trs-btn trs-btn-ghost" onClick={() => openApplication(it.applicationId)}>View</button>
                          <button type="button" className="trs-btn trs-btn-restore" disabled={busy} onClick={() => restore(it)}>Restore</button>
                          <button type="button" className="trs-btn trs-btn-danger" disabled={busy} onClick={() => deleteForever(it)}>Delete permanently</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <div className={`trs-toast trs-toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}

export function TrashIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

const TRASH_STYLES = `
.trs-root { color: var(--text-primary); }
.trs-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
.trs-title { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 1.4rem; font-weight: 800; letter-spacing: -0.3px; }
.trs-sub { margin: 6px 0 0; font-size: 0.85rem; color: var(--text-muted); max-width: 620px; line-height: 1.5; }
.trs-search { display: flex; align-items: center; gap: 8px; padding: 0 12px; height: 40px; min-width: 280px; border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-muted); }
.trs-search input { border: none; outline: none; background: transparent; color: var(--text-primary); font-size: 0.85rem; width: 100%; }
.trs-card { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 14px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.03); }
.trs-scroll { overflow-x: auto; }
.trs-table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
.trs-table th { text-align: left; padding: 12px 16px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); white-space: nowrap; }
.trs-table td { padding: 12px 16px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
.trs-table tbody tr { cursor: pointer; transition: background 0.15s; }
.trs-table tbody tr:hover td { background: var(--bg-secondary); }
.trs-table tbody tr:last-child td { border-bottom: none; }
.trs-right { text-align: right; }
.trs-name { font-weight: 700; }
.trs-muted { font-size: 0.74rem; color: var(--text-muted); margin-top: 2px; }
.trs-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem; }
.trs-chip { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 700; background: var(--bg-secondary); border: 1px solid var(--border-color); white-space: nowrap; }
.trs-actions { display: inline-flex; gap: 8px; justify-content: flex-end; flex-wrap: nowrap; }
.trs-btn { height: 32px; padding: 0 12px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; white-space: nowrap; border: 1px solid transparent; transition: opacity 0.15s, transform 0.1s; }
.trs-btn:active:not(:disabled) { transform: scale(0.97); }
.trs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.trs-btn-ghost { background: var(--bg-secondary); border-color: var(--border-color); color: var(--text-primary); }
.trs-btn-restore { background: rgba(48,164,108,0.12); border-color: rgba(48,164,108,0.4); color: #15803d; }
.trs-btn-danger { background: rgba(229,72,77,0.1); border-color: rgba(229,72,77,0.4); color: #e5484d; }
.trs-empty { padding: 56px 20px; text-align: center; color: var(--text-muted); font-weight: 600; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.trs-empty p { margin: 0; }
.trs-error { color: #e5484d; flex-direction: row; justify-content: center; }
.trs-link { background: none; border: none; padding: 0; color: inherit; text-decoration: underline; font: inherit; cursor: pointer; }
.trs-toast { position: fixed; right: 24px; bottom: 24px; z-index: 1000; padding: 12px 18px; border-radius: 12px; font-size: 0.85rem; font-weight: 700; box-shadow: 0 10px 30px rgba(0,0,0,0.18); }
.trs-toast-success { background: #30a46c; color: #fff; }
.trs-toast-error { background: #e5484d; color: #fff; }
`;
