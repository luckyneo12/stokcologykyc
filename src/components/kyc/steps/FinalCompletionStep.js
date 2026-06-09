"use client";
import { useKYC } from "@/context/KYCContext";
import Logo from "../Logo";

export default function FinalCompletionStep() {
  const { resetKYC } = useKYC();

  return (
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      padding: 24,
      background: "var(--bg-primary)"
    }}>
      <div className="card animate-slide-up text-center">
        
        {/* Success Icon */}
        

        {/* Title */}
        <h1 className="text-section" style={{ marginBottom: 24 }}>
          All set!
        </h1>

        {/* Description */}
        <p className="text-body" style={{ marginBottom: 16, fontSize: "1.25rem", fontWeight: 600 }}>
          Your KYC journey is complete.
        </p>

        <p className="text-body" style={{ marginBottom: 40, fontSize: "1.1rem" }}>
          Our team will verify your documents shortly. You'll receive a confirmation email once your account is active.
        </p>

        <button 
          onClick={() => {
            resetKYC();
            window.location.href = "/";
          }}
          className="btn-primary"
          style={{ 
            padding: "16px 40px", 
            borderRadius: "16px", 
            fontSize: "1.1rem", 
            fontWeight: 800,
            background: "var(--text-primary)",
            color: "var(--bg-primary)",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)"
          }}
        >
          Logout Session
        </button>
      </div>
    </div>
  );
}
