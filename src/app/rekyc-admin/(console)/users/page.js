"use client";
import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/components/rekyc/adminApi";
import { useAdmin, AdminModal, formatDateTime } from "@/components/rekyc/AdminShell";

const PERMISSION_LABELS = {
  "dashboard.view": "Dashboard",
  "request.view": "View requests",
  "request.maker": "Maker approve / reject",
  "request.checker": "Checker approve / reject",
  "request.backoffice": "Update back office",
  "request.trash": "Trash / restore",
  "report.export": "MIS & PDF export",
  "estamp.manage": "Stamp paper",
  "user.manage": "Users & roles",
  "audit.view": "Audit log",
};
const EMPTY = { name: "", email: "", mobile: "", role: "rekyc_maker", password: "" };

export default function RekycUsers() {
  const { user: me, can, notify } = useAdmin();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await adminApi("/users");
      setUsers(data.users);
      setRoles(data.roles);
    } catch (e) {
      notify(e.message, "error");
    }
  }, [notify]);

  useEffect(() => {
    if (can("user.manage")) load();
  }, [load, can]);

  if (!can("user.manage")) return <div className="ra-alert ra-alert-error">You do not have access to user management.</div>;

  const submit = async () => {
    setBusy(true);
    try {
      if (modal.type === "create") {
        await adminApi("/users", { method: "POST", body: form });
        notify("User created.");
      } else if (modal.type === "edit") {
        await adminApi(`/users/${modal.user.id}`, { method: "PUT", body: { name: form.name, mobile: form.mobile, role: form.role, status: form.status } });
        notify("User updated.");
      } else {
        await adminApi(`/users/${modal.user.id}/reset-password`, { method: "POST", body: { password: form.password } });
        notify("Password reset.");
      }
      setModal(null);
      load();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const open = (type, user) => {
    setForm(user ? { ...EMPTY, name: user.name, email: user.email, mobile: user.mobile || "", role: user.role, status: user.status } : EMPTY);
    setModal({ type, user });
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1>Users &amp; Roles</h1>
        <button className="ra-btn" onClick={() => open("create")}>+ Add user</button>
      </div>
      <p className="ra-hint" style={{ marginTop: -8 }}>Admin portal admins sign in here with the same e-mail and password (their account is added on first login as Super Admin). Other users below are ReKYC-only accounts.</p>

      <div className="ra-panel">
        <div className="ra-table-wrap">
          <table className="ra-table">
            <thead><tr><th>Name</th><th>E-mail</th><th>Mobile</th><th>Role</th><th>Status</th><th>Last login</th><th>Action</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}{u.id === me.id && <span className="ra-hint"> (you)</span>}</td>
                  <td>{u.email}</td>
                  <td>{u.mobile || "-"}</td>
                  <td><span className="ra-pill ra-pill-in_progress">{u.roleLabel}</span></td>
                  <td><span className={`ra-pill ${u.status === "active" ? "ra-pill-completed" : "ra-pill-trashed"}`}>{u.status}</span></td>
                  <td>{formatDateTime(u.lastLoginAt)}</td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="ra-btn ra-btn-outline ra-btn-sm" onClick={() => open("edit", u)}>Edit</button>
                    {u.linkedToAdminPortal ? (
                      <span className="ra-pill ra-pill-tag" title="Signs in with the Admin portal e-mail and password">Admin portal login</span>
                    ) : (
                      <button className="ra-btn ra-btn-ghost ra-btn-sm" onClick={() => open("password", u)}>Reset password</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ra-panel">
        <h2>What each role can do</h2>
        <div className="ra-table-wrap">
          <table className="ra-table" style={{ minWidth: 640 }}>
            <thead><tr><th>Permission</th>{roles.map((r) => <th key={r.value}>{r.label}</th>)}</tr></thead>
            <tbody>
              {Object.entries(PERMISSION_LABELS).map(([perm, label]) => (
                <tr key={perm}>
                  <td>{label}</td>
                  {roles.map((r) => <td key={r.value} className={r.permissions.includes(perm) ? "ra-ok" : "ra-hint"}>{r.permissions.includes(perm) ? "✓" : "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ra-hint" style={{ marginTop: 8 }}>A request needs two different people: a Maker approves first, then a Checker gives the final approval.</p>
      </div>

      {modal && (
        <AdminModal
          title={modal.type === "create" ? "Add user" : modal.type === "edit" ? `Edit ${modal.user.name}` : `Reset password — ${modal.user.name}`}
          onClose={() => setModal(null)}
          footer={<><button className="ra-btn ra-btn-ghost" onClick={() => setModal(null)}>Cancel</button><button className="ra-btn" onClick={submit} disabled={busy}>{busy && <span className="ra-spinner" />} Save</button></>}
        >
          {modal.type !== "password" && (
            <>
              <div className="ra-field"><label htmlFor="u-name">Name</label><input id="u-name" className="ra-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="ra-field"><label htmlFor="u-email">E-mail</label><input id="u-email" className="ra-input" type="email" value={form.email} disabled={modal.type === "edit"} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
              <div className="ra-field"><label htmlFor="u-mobile">Mobile</label><input id="u-mobile" className="ra-input" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))} /></div>
              <div className="ra-field">
                <label htmlFor="u-role">Role</label>
                <select id="u-role" className="ra-select" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                  {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {modal.type === "edit" && (
                <div className="ra-field">
                  <label htmlFor="u-status">Status</label>
                  <select id="u-status" className="ra-select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}
            </>
          )}
          {modal.type !== "edit" && (
            <div className="ra-field">
              <label htmlFor="u-pass">{modal.type === "create" ? "Password" : "New password"}</label>
              <input id="u-pass" className="ra-input" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
              <span className="ra-hint">At least 8 characters with letters and numbers.</span>
            </div>
          )}
        </AdminModal>
      )}
    </>
  );
}
