"use client";
import { useKYC } from "@/context/KYCContext";
import { ShieldIcon, ZapIcon, ArrowRightIcon } from "../Icons";
import Logo from "../Logo";

export default function WelcomeStep() {
  const { nextStep } = useKYC();

  return (
    <div className="container-md" style={{ 
      minHeight: "100vh", 
      display: "flex", 
      flexDirection: "column", 
      justifyContent: "center",
      paddingTop: "80px",
      paddingBottom: "40px"
    }}>
      <div className="grid" style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
        gap: "48px",
        alignItems: "center" 
      }}>
        <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div style={{ marginBottom: "32px" }}>
            <Logo width={180} height={60} />
          </div>
          <h1 className="text-mega" style={{ marginBottom: "24px", color: "var(--text-primary)" }}>
            The future of <span style={{ color: "var(--wise-green)" }}>onboarding</span> is here.
          </h1>
          <p className="text-body" style={{ marginBottom: "40px", fontSize: "1.25rem", maxWidth: "480px" }}>
            Verify your identity in minutes with our bank-grade secure KYC process. 
            Simple, fast, and completely digital.
          </p>
          
          <div className="flex gap-md" style={{ marginBottom: "48px" }}>
            <button className="btn btn-primary btn-lg" onClick={() => nextStep()} style={{ padding: "20px 40px", fontSize: "1.25rem" }}>
              Get Started <ArrowRightIcon size={24} />
            </button>
          </div>

          <div className="flex gap-md">
            <div className="flex items-center gap-sm">
              <div style={{ color: "var(--wise-green)" }}><ShieldIcon size={20} /></div>
              <span className="text-caption" style={{ fontWeight: 600 }}>Bank-grade security</span>
            </div>
            <div className="flex items-center gap-sm">
              <div style={{ color: "var(--wise-green)" }}><ZapIcon size={20} /></div>
              <span className="text-caption" style={{ fontWeight: 600 }}>Instant verification</span>
            </div>
          </div>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <div className="glass-card" style={{ position: "relative", overflow: "hidden", padding: "48px" }}>
            <div style={{ 
              position: "absolute", top: "-20%", right: "-20%", 
              width: "200px", height: "200px", 
              background: "var(--wise-green)", opacity: 0.1, 
              filter: "blur(60px)", borderRadius: "50%" 
            }} />
            
            <div style={{ marginBottom: "32px" }}>
              <div className="icon-container">
                <ShieldIcon size={32} />
              </div>
              <h3 className="text-title" style={{ marginBottom: "12px" }}>Identity Protection</h3>
              <p className="text-body">Your data is encrypted end-to-end and never shared with third parties without your consent.</p>
            </div>

            <div style={{ marginBottom: "32px" }}>
              <div className="icon-container" style={{ background: "rgba(56, 200, 255, 0.1)", color: "#38c8ff" }}>
                <ZapIcon size={32} />
              </div>
              <h3 className="text-title" style={{ marginBottom: "12px" }}>Seamless Experience</h3>
              <p className="text-body">Our AI-powered system guides you through every step, ensuring a smooth and error-free process.</p>
            </div>

            <div className="flex items-center gap-md" style={{ 
              background: "var(--bg-secondary)", 
              padding: "16px 24px", 
              borderRadius: "20px",
              border: "1px solid var(--border-color)"
            }}>
              <div style={{ 
                width: "12px", height: "12px", 
                borderRadius: "50%", background: "var(--wise-green)",
                boxShadow: "0 0 10px var(--wise-green)"
              }} />
              <span className="text-body-bold" style={{ fontSize: "0.9rem" }}>System Status: Operational</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
