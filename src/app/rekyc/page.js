"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { rekycApi, getClientToken, setClientToken } from "@/components/rekyc/clientApi";

const RESEND_SECONDS = 30;

export default function RekycLogin() {
  const router = useRouter();
  const [stage, setStage] = useState("code");
  const [clientCode, setClientCode] = useState("");
  const [otp, setOtp] = useState("");
  const [sentTo, setSentTo] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (getClientToken()) router.replace("/rekyc/personal");
  }, [router]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const sendOtp = async (e) => {
    e?.preventDefault();
    const code = clientCode.trim().toUpperCase();
    if (!code) return setError("Enter your client code.");
    setBusy(true);
    setError("");
    try {
      const data = await rekycApi("/auth/send-otp", { method: "POST", body: { clientCode: code } });
      // Test client codes (server setting REKYC_TEST_LOGIN) are logged in straight away, without an OTP
      if (data.testLogin && data.token) {
        setClientToken(data.token);
        router.replace(data.request.status === "in_progress" ? "/rekyc/personal" : "/rekyc/status");
        return;
      }
      setSentTo(data.sentTo || []);
      setStage("otp");
      setOtp("");
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit OTP.");
    setBusy(true);
    setError("");
    try {
      const data = await rekycApi("/auth/verify-otp", { method: "POST", body: { clientCode: clientCode.trim().toUpperCase(), otp } });
      setClientToken(data.token);
      router.replace(data.request.status === "in_progress" ? "/rekyc/personal" : "/rekyc/status");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <main className="rk-login-wrap">
      <div className="rk-login-card">
        <img src="/stklogo.png" alt="Stockology" />
        <h1>STOCKOLOGY SECURITIES PVT. LTD.</h1>
        <div className="rk-sub">Modification</div>

        {error && <div className="rk-alert rk-alert-error" role="alert">{error}</div>}

        {stage === "code" ? (
          <form onSubmit={sendOtp} noValidate>
            <div className="rk-field">
              <label htmlFor="rk-client-code">Client Code</label>
              <input
                id="rk-client-code"
                className="rk-input"
                placeholder="ENTER YOUR CLIENT CODE"
                value={clientCode}
                onChange={(e) => setClientCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20))}
                autoComplete="off"
                autoFocus
              />
            </div>
            <button className="rk-btn rk-btn-block" type="submit" disabled={busy}>
              {busy ? <span className="rk-spinner" /> : <PlaneIcon />} Send OTP
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} noValidate>
            <div className="rk-alert rk-alert-info">
              OTP sent to {sentTo.join(" and ") || "your registered contact details"}.
            </div>
            <div className="rk-field">
              <label htmlFor="rk-otp">Enter OTP</label>
              <input
                id="rk-otp"
                className="rk-input rk-otp-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoFocus
              />
            </div>
            <button className="rk-btn rk-btn-block" type="submit" disabled={busy || otp.length !== 6}>
              {busy && <span className="rk-spinner" />} Verify &amp; Continue
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: "0.92em" }}>
              <button type="button" className="rk-link-btn" onClick={() => { setStage("code"); setError(""); }}>
                Change client code
              </button>
              <button type="button" className="rk-link-btn" onClick={sendOtp} disabled={wait > 0 || busy}>
                {wait > 0 ? `Resend OTP in ${wait}s` : "Resend OTP"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function PlaneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 2 11 13" stroke="currentColor" strokeWidth="0" />
      <path d="M22 2 15 22l-4-9-9-4 20-7z" />
    </svg>
  );
}
