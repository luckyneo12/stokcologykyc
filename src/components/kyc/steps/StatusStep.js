"use client";
import { useKYC } from "@/context/KYCContext";
import { CheckCircleIcon, ShieldIcon } from "../Icons";

export default function StatusStep() {
  const { resetKYC } = useKYC();

  return (
    <div className="container-sm" style={{ height: "100vh", display: "flex", alignItems: "center" }}>
      <div className="text-center animate-slide-up" style={{ width: "100%" }}>
        <div style={{ 
          width: 100, height: 100, borderRadius: "50%", background: "rgba(159, 232, 112, 0.1)", 
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 32px",
          color: "var(--wise-green)", border: "1px solid rgba(159, 232, 112, 0.3)"
        }}>
          <CheckCircleIcon size={48} />
        </div>
        
        <h1 className="text-section" style={{ fontSize: "3rem", marginBottom: 24 }}>Verification complete.</h1>
        <p className="text-body" style={{ maxWidth: 400, margin: "0 auto 48px" }}>
          Your identity has been successfully verified. Your account is now active and 
          ready for use. A confirmation has been sent to your registered email.
        </p>

        <div className="glass-card card-sm" style={{ maxWidth: 400, margin: "0 auto 48px", background: "var(--bg-secondary)" }}>
          <div className="flex items-center gap-md" style={{ textAlign: "left" }}>
            <div style={{ color: "var(--wise-green)" }}><ShieldIcon size={24} /></div>
            <div>
              <p className="text-body-bold" style={{ fontSize: "0.95rem" }}>Bank-Grade Encryption</p>
              <p className="text-caption">Your data is stored securely using AES-256 standards.</p>
            </div>
          </div>
        </div>

        <button className="btn btn-primary btn-lg" onClick={resetKYC} style={{ padding: "18px 48px" }}>
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
