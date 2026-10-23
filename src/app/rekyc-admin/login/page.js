"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi, getAdminToken, setAdminToken } from "@/components/rekyc/adminApi";

export default function RekycAdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (getAdminToken()) router.replace("/rekyc-admin/dashboard");
  }, [router]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await adminApi("/auth/login", { method: "POST", body: { email, password } });
      setAdminToken(data.token);
      router.replace("/rekyc-admin/dashboard");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <main className="ra-login">
      <form className="ra-login-card" onSubmit={submit}>
        <img src="/stklogo.png" alt="Stockology" />
        <h1>ReKYC Admin</h1>
        <p className="sub">Sign in with your Admin portal e-mail and password</p>
        {error && <div className="ra-alert ra-alert-error" role="alert">{error}</div>}
        <div className="ra-field">
          <label htmlFor="ra-email">E-mail</label>
          <input id="ra-email" className="ra-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="ra-field">
          <label htmlFor="ra-password">Password</label>
          <input id="ra-password" className="ra-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="ra-btn" type="submit" disabled={busy} style={{ width: "100%", marginTop: 6 }}>
          {busy && <span className="ra-spinner" />} Sign in
        </button>
      </form>
    </main>
  );
}
