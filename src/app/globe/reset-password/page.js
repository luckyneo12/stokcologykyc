"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/kyc/Logo";
import { API_BASE_URL } from "@/utils/apiConfig";

const inputStyle = {
  width: "100%", padding: "14px", borderRadius: "12px",
  border: "1px solid var(--border-color)", background: "var(--bg-secondary)",
  color: "var(--text-primary)", outline: "none", fontSize: "0.95rem"
};

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(token ? "" : "This reset link is invalid. Please request a new one.");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6 || !/[^A-Za-z0-9]/.test(password)) {
      setError("Password must be at least 6 characters and contain at least one special character.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/globe-reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });

      const data = await response.json();

      if (data.success) {
        setDone(true);
      } else {
        setError(data.error || "Could not reset the password. Please try again.");
      }
    } catch (err) {
      setError("Connection error. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-secondary)", fontFamily: "inherit"
    }}>
      <div style={{
        width: "100%", maxWidth: "400px", padding: "40px", background: "var(--bg-primary)",
        borderRadius: "24px", border: "1px solid var(--border-color)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.05)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <Logo width={100} height={100} />
          <h1 style={{ fontSize: "1.8rem", fontWeight: 900, marginTop: "16px" }}>Reset Password</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Set a new password for your Globe portal account.</p>
        </div>

        {error && (
          <div style={{
            padding: "12px", background: "rgba(229,72,77,0.1)", color: "#e5484d",
            borderRadius: "12px", marginBottom: "20px", fontSize: "0.85rem", fontWeight: 600,
            textAlign: "center"
          }}>
            {error}
          </div>
        )}

        {done ? (
          <div style={{
            padding: "12px", background: "rgba(48,164,108,0.1)", color: "#30a46c",
            borderRadius: "12px", marginBottom: "20px", fontSize: "0.85rem", fontWeight: 600,
            textAlign: "center"
          }}>
            Your password has been reset. You can now sign in with your new password.
          </div>
        ) : token && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "8px", display: "block" }}>New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "32px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "8px", display: "block" }}>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "16px", borderRadius: "12px", border: "none",
                background: "var(--wise-green)", color: "var(--wise-dark-green)",
                fontWeight: 800, fontSize: "1rem", cursor: loading ? "not-allowed" : "pointer",
                transition: "transform 0.2s ease"
              }}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <Link href={done ? "/globe/login" : "/globe/forgot-password"} style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", textDecoration: "underline" }}>
            {done ? "Go to Sign In" : "Request a new reset link"}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function GlobeResetPassword() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg-secondary)" }} />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
