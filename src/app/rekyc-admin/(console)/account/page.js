"use client";
import { useState } from "react";
import { adminApi } from "@/components/rekyc/adminApi";
import { useAdmin } from "@/components/rekyc/AdminShell";

export default function RekycAccount() {
  const { user, notify } = useAdmin();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return notify("New passwords do not match.", "error");
    setBusy(true);
    try {
      await adminApi("/auth/change-password", { method: "POST", body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      notify("Password changed.");
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>My Account</h1>
      <div className="ra-panel" style={{ maxWidth: 520 }}>
        <div className="ra-kv-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 18 }}>
          <div className="ra-kv"><span>Name</span><span>{user.name}</span></div>
          <div className="ra-kv"><span>Role</span><span>{user.roleLabel}</span></div>
          <div className="ra-kv"><span>E-mail</span><span>{user.email}</span></div>
        </div>
        {user.linkedToAdminPortal ? (
          <div className="ra-alert ra-alert-info">You sign in with your Admin portal e-mail and password. To change the password, change it in the Admin portal.</div>
        ) : (
        <form onSubmit={submit}>
          <h2>Change password</h2>
          {[["currentPassword", "Current password", "current-password"], ["newPassword", "New password", "new-password"], ["confirm", "Confirm new password", "new-password"]].map(([key, label, ac]) => (
            <div className="ra-field" key={key}>
              <label htmlFor={`pw-${key}`}>{label}</label>
              <input id={`pw-${key}`} className="ra-input" type="password" autoComplete={ac} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} required />
            </div>
          ))}
          <button className="ra-btn" type="submit" disabled={busy}>{busy && <span className="ra-spinner" />} Change password</button>
        </form>
        )}
      </div>
    </>
  );
}
