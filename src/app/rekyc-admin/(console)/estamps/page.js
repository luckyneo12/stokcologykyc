"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { adminApi, adminFile, toQuery } from "@/components/rekyc/adminApi";
import { useAdmin, formatDateTime } from "@/components/rekyc/AdminShell";

export default function RekycEStamps() {
  const { can, notify } = useAdmin();
  const [data, setData] = useState({ estamps: [], total: 0, stats: {} });
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ certificateNo: "", serialNo: "" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setData(await adminApi(`/estamps${toQuery({ status, search, page, limit: 20 })}`));
    } catch (e) {
      notify(e.message, "error");
    }
  }, [status, search, page, notify]);

  useEffect(() => {
    if (can("estamp.manage")) load();
  }, [load, can]);

  if (!can("estamp.manage")) return <div className="ra-alert ra-alert-error">You do not have access to stamp paper.</div>;

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return notify("Choose the e-stamp file.", "error");
    const fd = new FormData();
    fd.append("certificateNo", form.certificateNo.trim());
    fd.append("serialNo", form.serialNo.trim());
    fd.append("file", file);
    setBusy(true);
    try {
      await adminApi("/estamps", { method: "POST", formData: fd });
      notify("E-stamp added to the ReKYC pool.");
      setForm({ certificateNo: "", serialNo: "" });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this unused e-stamp?")) return;
    try {
      await adminApi(`/estamps/${id}`, { method: "DELETE" });
      notify("E-stamp deleted.");
      load();
    } catch (e) {
      notify(e.message, "error");
    }
  };

  const pages = Math.max(1, Math.ceil(data.total / 20));
  const available = data.stats.available || 0;

  return (
    <>
      <h1>Stamp Paper (ReKYC)</h1>
      <p className="ra-hint" style={{ marginTop: -8 }}>This pool is used only for ReKYC modification forms. One stamp is used per signed form; the onboarding portal&apos;s e-stamps are separate.</p>

      <div className="ra-cards" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginTop: 26 }}>
        {[["available", "Available", "#40c057"], ["assigned", "Reserved (form generated)", "#3b82f6"], ["used", "Used (signed)", "#868e96"]].map(([k, label, color]) => (
          <button key={k} className="ra-stat" aria-pressed={status === k} onClick={() => { setStatus(status === k ? "all" : k); setPage(1); }}>
            <span className="ra-stat-icon" style={{ background: color, width: 40, height: 40 }} />
            <div className="num">{data.stats[k] || 0}</div>
            <div className="lbl">{label}</div>
          </button>
        ))}
      </div>
      {available < 10 && <div className="ra-alert ra-alert-warn">Only {available} e-stamp(s) left. Clients cannot sign when the pool is empty — upload more.</div>}

      <form className="ra-panel" onSubmit={upload}>
        <h2>Add e-stamp</h2>
        <div className="ra-toolbar">
          <label className="ra-mini" style={{ flex: 1, minWidth: 180 }}>
            <span style={{ color: "var(--ra-text)" }}>Certificate No.</span>
            <input className="ra-input" value={form.certificateNo} onChange={(e) => setForm((f) => ({ ...f, certificateNo: e.target.value }))} placeholder="IN-DL12345678901234X" />
          </label>
          <label className="ra-mini" style={{ flex: 1, minWidth: 160 }}>
            <span style={{ color: "var(--ra-text)" }}>Serial No.</span>
            <input className="ra-input" value={form.serialNo} onChange={(e) => setForm((f) => ({ ...f, serialNo: e.target.value }))} />
          </label>
          <label className="ra-mini" style={{ flex: 1, minWidth: 200 }}>
            <span style={{ color: "var(--ra-text)" }}>File (PDF / JPG / PNG)</span>
            <input ref={fileRef} type="file" className="ra-input" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <button className="ra-btn" type="submit" disabled={busy}>{busy && <span className="ra-spinner" />} Upload</button>
        </div>
      </form>

      <div className="ra-panel">
        <div className="ra-toolbar">
          <span className="grow" />
          <input className="ra-input" style={{ width: 260 }} placeholder="Search certificate / serial / client" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="ra-table-wrap">
          <table className="ra-table" style={{ minWidth: 760 }}>
            <thead><tr><th>#</th><th>Certificate No.</th><th>Serial No.</th><th>Status</th><th>Client / Request</th><th>Added</th><th>Action</th></tr></thead>
            <tbody>
              {data.estamps.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td className="ra-mono">{s.certificate_no || "-"}</td>
                  <td className="ra-mono">{s.serial_no || "-"}</td>
                  <td><span className={`ra-pill ${s.status === "available" ? "ra-pill-completed" : s.status === "assigned" ? "ra-pill-in_progress" : "ra-pill-trashed"}`}>{s.status}</span></td>
                  <td>{s.request_id ? <Link href={`/rekyc-admin/requests/${s.request_id}`}>{s.client_code}</Link> : "-"}</td>
                  <td>{formatDateTime(s.created_at)}</td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="ra-btn ra-btn-outline ra-btn-sm" onClick={() => adminFile(`/estamps/${s.id}/file`).catch((e) => notify(e.message, "error"))}>View</button>
                    {s.status === "available" && <button className="ra-btn ra-btn-ghost ra-btn-sm" onClick={() => remove(s.id)}>Delete</button>}
                  </td>
                </tr>
              ))}
              {!data.estamps.length && <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--ra-muted)" }}>No e-stamps.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="ra-pager">
          <span className="ra-hint">{data.total} total</span>
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
