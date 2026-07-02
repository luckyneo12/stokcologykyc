"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ResumePage() {
  const router = useRouter();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get("token");
      const appId = searchParams.get("appId");

      if (token && appId) {
        sessionStorage.setItem("kycToken", token);
        sessionStorage.setItem("kycApplicationId", appId);
        
        // This simulates a fresh load which will make KYCContext auto-sync and jump to the right step
        router.replace("/");
      } else {
        setError("Invalid resume link. Missing token or application ID.");
      }
    }
  }, [router]);

  if (error) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)" }}>
        <p className="text-body-bold" style={{ color: "var(--wise-danger)" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", flexDirection: "column", gap: 16 }}>
      <div className="spinner" style={{ width: 40, height: 40, border: "3px solid var(--border-color)", borderTopColor: "var(--wise-green)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <p className="text-body-bold" style={{ color: "var(--text-muted)" }}>Resuming your session...</p>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}
