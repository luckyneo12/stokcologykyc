"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/components/rekyc/adminApi";
import { useAdmin, formatDateTime } from "@/components/rekyc/AdminShell";

export default function RekycAudit() {
  const { can, notify } = useAdmin();
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!can("audit.view")) return;
    adminApi(`/audit?page=${page}`)
      .then((d) => setLogs(d.logs))
      .catch((e) => notify(e.message, "error"));
  }, [page, can, notify]);

  if (!can("audit.view")) return <div className="ra-alert ra-alert-error">You do not have access to the audit log.</div>;

  return (
    <>
      <h1>Audit Log</h1>
      <div className="ra-panel">
        <div className="ra-table-wrap">
          <table className="ra-table">
            <thead><tr><th>Time</th><th>Who</th><th>Action</th><th>Request</th><th>IP</th><th>Details</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(l.created_at)}</td>
                  <td>{l.actor_type === "admin" ? l.actor_name : `${l.actor_type} ${l.actor_id || ""}`}</td>
                  <td>{l.action}</td>
                  <td>{l.request_id ? <Link href={`/rekyc-admin/requests/${l.request_id}`} className="ra-mono">{l.request_id.slice(0, 8)}…</Link> : "-"}</td>
                  <td className="ra-mono">{l.ip_address || "-"}</td>
                  <td className="ra-mono" style={{ maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.details || ""}>{l.details || "-"}</td>
                </tr>
              ))}
              {!logs.length && <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--ra-muted)" }}>No entries.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="ra-pager">
          <span />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="ra-btn ra-btn-ghost ra-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Newer</button>
            <span>Page {page}</span>
            <button className="ra-btn ra-btn-ghost ra-btn-sm" disabled={logs.length < 50} onClick={() => setPage((p) => p + 1)}>Older</button>
          </div>
        </div>
      </div>
    </>
  );
}
