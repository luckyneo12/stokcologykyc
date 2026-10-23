"use client";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/kyc/Logo";
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import { API_BASE_URL } from "@/utils/apiConfig";
import "./globe-login.css";

export default function AdminLogin() {
  useForceLightTheme("globeTheme");
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
      const response = await fetch(`${API_BASE_URL}/api/auth/globe-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("globeToken", data.token);
        localStorage.setItem("adminUser", JSON.stringify(data.user));
        localStorage.removeItem("adminActiveSection");

        if (data.user.role === "globe") {
          router.push("/globe");
        } else {
          setError("Unauthorized access. This portal is for Globe team only.");
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
    <div className="globe-login">
      {/* Illustration + login form on one open page */}
      <div className="globe-login-frame">
        {/* Illustration — tilts and drifts with the mouse, floats gently; hidden on small screens */}
        <div
          ref={heroRef}
          className="globe-login-hero"
          onMouseMove={handleHeroMove}
          onMouseLeave={handleHeroLeave}
          aria-hidden="true"
        >
          <div className="globe-login-hero-glow" />
          <div className="globe-login-hero-art">
            <img src="/globe-login-hero.png" alt="" draggable={false} />
          </div>
          <div className="globe-login-hero-caption">
            <h2>Review and approve, in one place</h2>
            <p>Check KYC applications, verify documents and keep every decision on record.</p>
          </div>
        </div>

        <div className="globe-login-card">
          <div className="globe-login-head">
            <div className="globe-login-brand">
              <Logo width={64} height={64} />
              <span className="globe-login-eyebrow">Globe Portal</span>
            </div>
            <h1 className="globe-login-title">Welcome back</h1>
            <p className="globe-login-sub">Sign in to review and approve KYC applications.</p>
          </div>

          {error && (
            <div className="globe-login-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="globe-login-form">
            <label className="globe-login-label" htmlFor="globe-email">Email address</label>
            <div className="globe-login-field">
              <Mail size={18} className="globe-login-field-icon" aria-hidden="true" />
              <input
                id="globe-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="globe@stockology.com"
                required
              />
            </div>

            <label className="globe-login-label" htmlFor="globe-password">Password</label>
            <div className="globe-login-field">
              <Lock size={18} className="globe-login-field-icon" aria-hidden="true" />
              <input
                id="globe-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className="globe-login-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button className="globe-login-submit" type="submit" disabled={loading}>
              {loading ? "Authenticating..." : (<>Sign In <ArrowRight size={18} /></>)}
            </button>
          </form>

          <div className="globe-login-foot">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Secure access for the Globe team only.</span>
          </div>
          <Link href="/globe/forgot-password" className="globe-login-forgot">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}
