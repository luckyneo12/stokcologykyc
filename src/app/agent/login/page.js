"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";
import { API_BASE_URL } from "@/utils/apiConfig";

export default function AgentLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/agent/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (data.success) {
        localStorage.setItem("agent_token", data.token);
        localStorage.setItem("agent_user", JSON.stringify(data.user));
        router.push("/agent");
      } else {
        setError(data.error || "Login failed");
      }
    } catch (error) {
      setError("Invalid credentials or unauthorized connection");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-secondary)", fontFamily: "inherit", padding: "20px"
    }}>
      <div style={{ 
        width: "100%", maxWidth: "420px", padding: "40px", background: "var(--bg-primary)",
        borderRadius: "24px", border: "1px solid var(--border-color)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.05)", relative: "relative"
      }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ 
            width: "64px", height: "64px", borderRadius: "16px", 
            background: "rgba(159, 232, 112, 0.15)", display: "flex", 
            alignItems: "center", justifyContent: "center", margin: "0 auto 20px auto"
          }}>
            <ShieldCheck style={{ width: "32px", height: "32px", color: "var(--wise-positive)" }} />
          </div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 900, marginTop: "16px" }}>Agent Portal</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Sign in with your CRM credentials.</p>
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
              placeholder="agent@stockology.com"
              required
              style={{
                width: "100%", padding: "14px", borderRadius: "12px",
                border: "1px solid var(--border-color)", background: "var(--bg-secondary)",
                color: "var(--text-primary)", outline: "none", fontSize: "0.95rem"
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
                color: "var(--text-primary)", outline: "none", fontSize: "0.95rem"
              }}
            />
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%", padding: "16px", borderRadius: "12px", border: "none",
              background: "var(--wise-green)", color: "var(--wise-dark-green)",
              fontWeight: 800, fontSize: "1rem", cursor: isLoading ? "not-allowed" : "pointer",
              transition: "transform 0.2s ease", display: "flex", alignItems: "center", justifyContent: "center"
            }}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Access Portal"}
          </button>
        </form>
      </div>
    </div>
  );
}
