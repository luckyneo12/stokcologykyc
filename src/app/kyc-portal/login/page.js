"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/kyc/Logo";

export default function KYCTeamLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/auth/kyc-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("adminToken", data.token); // Reusing the adminToken key for ease of use in the portal, but it's a KYC team token
        localStorage.setItem("adminUser", JSON.stringify(data.user));
        
        if (data.user.role === "kyc_team" || data.user.role === "admin") {
          router.push("/kyc-portal");
        } else {
          setError("Unauthorized access.");
          localStorage.clear();
        }
      } else {
        setError(data.error || "Invalid credentials");
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
          <h1 style={{ fontSize: "1.6rem", fontWeight: 900, marginTop: "16px", color: "var(--wise-dark-green)" }}>KYC Verification Team</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Login to access the verification portal.</p>
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

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "8px", display: "block" }}>Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="team@stockology.com"
              required
              style={{
                width: "100%", padding: "14px", borderRadius: "12px",
                border: "1px solid var(--border-color)", background: "var(--bg-secondary)",
                outline: "none", fontSize: "0.95rem"
              }}
            />
          </div>

          <div style={{ marginBottom: "32px" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "8px", display: "block" }}>Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: "100%", padding: "14px", borderRadius: "12px",
                border: "1px solid var(--border-color)", background: "var(--bg-secondary)",
                outline: "none", fontSize: "0.95rem"
              }}
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
            {loading ? "Authenticating..." : "Login to Portal"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "24px" }}>
           <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
             Are you a new team member?{" "}
             <Link href="/kyc-portal/signup" style={{ color: "var(--wise-dark-green)", textDecoration: "none" }}>
               Register here
             </Link>
           </p>
        </div>
      </div>
    </div>
  );
}
