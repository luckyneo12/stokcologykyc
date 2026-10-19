"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/kyc/Logo";
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import { API_BASE_URL } from "@/utils/apiConfig";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  // Illustration follows the mouse (3D tilt + parallax). Written to CSS variables directly — no re-render.
  const heroRef = useRef(null);
  const handleHeroMove = (e) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5; // -0.5 … 0.5
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 10).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * 12).toFixed(2)}deg`);
    el.style.setProperty("--tx", `${(x * 18).toFixed(1)}px`);
    el.style.setProperty("--ty", `${(y * 14).toFixed(1)}px`);
    el.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(1)}%`);
  };
  const handleHeroLeave = () => {
    const el = heroRef.current;
    if (!el) return;
    for (const v of ["--rx", "--ry", "--tx", "--ty"]) el.style.setProperty(v, v.startsWith("--r") ? "0deg" : "0px");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("adminToken", data.token);
        localStorage.setItem("adminUser", JSON.stringify(data.user));
        localStorage.removeItem("adminActiveSection");
        
        if (data.user.role === "admin") {
          router.push("/admin");
        } else {
          setError("Unauthorized access. This portal is for Super Admins only.");
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
    }} className="neu-login-shell">
      {/* One card: illustration panel + login form, so they read as one page */}
      <div className="neu-login-frame">
      {/* Illustration — tilts and drifts with the mouse, floats gently; hidden on small screens */}
      <div
        ref={heroRef}
        className="neu-login-hero"
        onMouseMove={handleHeroMove}
        onMouseLeave={handleHeroLeave}
        aria-hidden="true"
      >
        <div className="neu-login-hero-glow" />
        <div className="neu-login-hero-art">
          <img src="/admin-login-hero.png" alt="" draggable={false} />
        </div>
        <div className="neu-login-hero-caption">
          <h2>Everything in one place</h2>
          <p>Review KYC, manage users, approve and push to the back office — securely.</p>
        </div>
      </div>

      <div className="card neu-login-card" style={{
        width: "100%", maxWidth: "400px", padding: "40px", background: "var(--bg-primary)",
        borderRadius: "24px", border: "1px solid var(--border-color)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.05)"
      }}>
        <div className="neu-login-head">
          <div className="neu-login-brand">
            <Logo width={64} height={64} />
            <span className="neu-login-eyebrow">Super Admin Portal</span>
          </div>
          <h1 className="neu-login-title">Welcome back</h1>
          <p className="neu-login-sub">Sign in to manage KYC reviews, approvals and the back office.</p>
        </div>

        {error && (
          <div className="neu-login-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="neu-login-form">
          <label className="neu-login-label" htmlFor="admin-email">Email address</label>
          <div className="neu-login-field">
            <Mail size={18} className="neu-login-field-icon" aria-hidden="true" />
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@stockology.com"
              required
            />
          </div>

          <label className="neu-login-label" htmlFor="admin-password">Password</label>
          <div className="neu-login-field">
            <Lock size={18} className="neu-login-field-icon" aria-hidden="true" />
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              className="neu-login-eye"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            className="neu-btn-primary neu-login-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? "Authenticating..." : (<>Sign In <ArrowRight size={18} /></>)}
          </button>
        </form>

        <div className="neu-login-foot">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>Secure access for system administrators only.</span>
        </div>
        <p className="neu-login-help">Forgot password? Contact your system administrator.</p>
      </div>
      </div>
    </div>
  );
}
