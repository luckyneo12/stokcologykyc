"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useKYC } from "@/context/KYCContext";
import { ZapIcon, ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon } from "../Icons";
import Logo from "../Logo";

export default function PricingStep() {
  const { segments, bsda, updateState, nextStep, prevStep, theme, addToast, emailVerified, syncProgress } = useKYC();
  const [selectedSegments, setSelectedSegments] = useState(segments || { equity: true, derivatives: false });
  const [bsdaPreference, setBsdaPreference] = useState(bsda || "opt-in");
  const [showModal, setShowModal] = useState(false);
  const [showBrokerageModal, setShowBrokerageModal] = useState(false);
  const [showTariffModal, setShowTariffModal] = useState(false);
  const [brokerageOpened, setBrokerageOpened] = useState(false);
  const [tariffOpened, setTariffOpened] = useState(false);
  const [brokerageAccepted, setBrokerageAccepted] = useState(false);
  const [tariffAccepted, setTariffAccepted] = useState(false);
  const [showBrokerageTooltip, setShowBrokerageTooltip] = useState(false);
  const [showTariffTooltip, setShowTariffTooltip] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const lastAutoSaveValues = useRef({
    segments: segments || { equity: true, derivatives: false },
    bsda: bsda || "opt-in"
  });

  // Auto-sync preferences to prevent data loss if user refreshes or closes tab
  useEffect(() => {
    if (!mounted) return;
    
    // Determine if the local state has changed compared to our last explicit save
    const segmentsChangedLocally = 
      selectedSegments?.equity !== lastAutoSaveValues.current.segments?.equity || 
      selectedSegments?.derivatives !== lastAutoSaveValues.current.segments?.derivatives;
      
    const bsdaChangedLocally = bsdaPreference !== lastAutoSaveValues.current.bsda;
    
    if (segmentsChangedLocally || bsdaChangedLocally) {
      lastAutoSaveValues.current = {
        segments: selectedSegments,
        bsda: bsdaPreference
      };
      updateState({ segments: selectedSegments, bsda: bsdaPreference });
      syncProgress({ segments: selectedSegments, bsda: bsdaPreference });
    }
  }, [selectedSegments, bsdaPreference, mounted, syncProgress, updateState]);

  // Sync with global context state (important for DDPI 'No' uncheck logic and server polls)
  useEffect(() => {
    if (segments) {
      setSelectedSegments(prev => {
        if (segments.equity !== prev?.equity || segments.derivatives !== prev?.derivatives) {
          lastAutoSaveValues.current.segments = segments;
          return { ...prev, ...segments };
        }
        return prev;
      });
    }
    if (bsda) {
      setBsdaPreference(prev => {
        if (bsda !== prev) {
          lastAutoSaveValues.current.bsda = bsda;
          return bsda;
        }
        return prev;
      });
    }
  }, [segments, bsda]);

  const toggleSegment = (key) => {
    if (key === "equity") return; // Equity is mandatory
    const next = { ...selectedSegments, [key]: !selectedSegments[key] };
    setSelectedSegments(next);
    if (key === "derivatives" && next.derivatives) {
      setShowModal(true);
    }
  };

  const handleContinue = () => {
    if (!brokerageAccepted || !tariffAccepted) {
      addToast("Please review and accept both Brokerage Plan and DP Tariff Sheet.", "error");
      return;
    }
    nextStep({ segments: selectedSegments, bsda: bsdaPreference });
  };

  if (!mounted) return null;

  return (
    <div className="container-sm">
      <div className="text-center animate-slide-up" style={{ marginBottom: 48 }}>
        
        <h2 className="text-section" style={{ marginBottom: 16 }}>Segments & Pricing</h2>
        <p className="text-body" style={{ fontWeight: 600 }}>Please select the Trading preferences you wish to continue with</p>
      </div>

      <div className="card animate-slide-up">
        <div style={{ marginBottom: 28 }}>
          <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
            <label className="text-body-bold" style={{ fontSize: "0.95rem" }}>Trading Segments</label>
            <span style={{ fontSize: "0.75rem", background: "var(--bg-secondary)", padding: "4px 10px", borderRadius: "100px", fontWeight: 700, color: "var(--text-secondary)" }}>
              {Object.values(selectedSegments).filter(Boolean).length} Selected
            </span>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="segment-card selected locked">
              <div style={{ flex: 1, textAlign: "left" }}>
                <div className="flex items-center gap-sm" style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>Equity</span>
                  <span style={{ fontSize: "0.7rem", background: "var(--wise-green)", color: "var(--wise-dark-green)", padding: "2px 8px", borderRadius: "100px", fontWeight: 800, letterSpacing: "0.5px" }}>MANDATORY</span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>Cash, Intraday, and Mutual Funds</div>
              </div>
              <CheckCircleIcon size={24} style={{ color: "var(--wise-dark-green)" }} />
            </div>

            <div 
              className={`segment-card ${selectedSegments.derivatives ? 'selected' : ''}`}
              onClick={() => toggleSegment("derivatives")}
            >
              <div style={{ flex: 1, textAlign: "left" }}>
                <div className="flex items-center gap-sm" style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>Derivatives</span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>F&O</div>
              </div>
              <div style={{ 
                width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--border-color)",
                background: selectedSegments.derivatives ? "var(--wise-green)" : "transparent",
                borderColor: selectedSegments.derivatives ? "var(--wise-green)" : "var(--border-color)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {selectedSegments.derivatives && <CheckCircleIcon size={16} style={{ color: "var(--wise-dark-green)" }} />}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <div 
            className={`action-row ${brokerageAccepted ? 'accepted' : ''}`}
            onClick={() => { setShowBrokerageModal(true); setBrokerageOpened(true); }}
            style={{ cursor: "pointer" }}
          >
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontWeight: 800, fontSize: "1rem" }}>Brokerage Plan</div>
            </div>
            <div 
              onClick={(e) => { e.stopPropagation(); setBrokerageAccepted(!brokerageAccepted); }}
              style={{ 
                width: 32, height: 32, borderRadius: "8px", background: "var(--bg-secondary)", 
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                border: brokerageAccepted ? "2px solid var(--wise-green)" : "2px solid var(--border-color)",
                transition: "all 0.2s ease"
              }}
            >
              {brokerageAccepted && <CheckCircleIcon size={18} style={{ color: "var(--wise-dark-green)" }} />}
            </div>
          </div>

          <div 
            className={`action-row ${tariffAccepted ? 'accepted' : ''}`}
            onClick={() => { setShowTariffModal(true); setTariffOpened(true); }}
            style={{ cursor: "pointer" }}
          >
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontWeight: 800, fontSize: "1rem" }}>DP Tariff Sheet</div>
            </div>
            <div 
              onClick={(e) => { e.stopPropagation(); setTariffAccepted(!tariffAccepted); }}
              style={{ 
                width: 32, height: 32, borderRadius: "8px", background: "var(--bg-secondary)", 
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                border: tariffAccepted ? "2px solid var(--wise-green)" : "2px solid var(--border-color)",
                transition: "all 0.2s ease"
              }}
            >
              {tariffAccepted && <CheckCircleIcon size={18} style={{ color: "var(--wise-dark-green)" }} />}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 40 }}>
          <label className="text-body-bold" style={{ display: "block", marginBottom: 12, fontSize: "0.95rem" }}>Continue with BSDA?</label>
          <div className="segmented-control">
            <button 
              className={`segment-btn ${bsdaPreference === 'opt-in' ? 'active' : ''}`}
              onClick={() => setBsdaPreference('opt-in')}
            >
              Opt-in
            </button>
            <button 
              className={`segment-btn ${bsdaPreference === 'opt-out' ? 'active' : ''}`}
              onClick={() => setBsdaPreference('opt-out')}
            >
              Opt-out
            </button>
          </div>
        </div>

        <div className="flex gap-md">
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              if (emailVerified) {
                addToast("Email verified. You cannot go back to the verification step.", "info");
              } else {
                prevStep();
              }
            }} 
            style={{ flex: 1, opacity: emailVerified ? 0.6 : 1 }}
          >
            Back
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleContinue} 
            style={{ flex: 1.5, opacity: (!brokerageAccepted || !tariffAccepted) ? 0.6 : 1 }}
          >
            Submit <ArrowRightIcon size={18} />
          </button>
        </div>
      </div>

      {/* Derivatives Modal */}
      {showModal && createPortal(
        <div style={{ 
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
          zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", boxSizing: "border-box"
        }}>
          <div className="glass-card animate-slide-up" style={{ width: "100%", maxWidth: 650, padding: "clamp(24px, 6vw, 32px)", borderRadius: "24px", display: "flex", flexDirection: "column", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }}>
            <h3 style={{ fontSize: "clamp(1.1rem, 4vw, 1.4rem)", fontWeight: 800, marginBottom: "clamp(12px, 3vw, 16px)", color: "var(--text-primary)", lineHeight: 1.3 }}>Enable F&O / Currency / Commodity</h3>
            
            <div style={{ fontSize: "clamp(0.75rem, 2.8vw, 0.95rem)", color: "var(--text-secondary)", marginBottom: "clamp(16px, 4vw, 20px)", lineHeight: 1.4 }}>
              <p style={{ marginBottom: 12 }}>To enable F&O/Currency/Commodity, you need to provide one of the below proof. <strong style={{ color: "var(--text-primary)" }}>(ANY one is required)</strong></p>
              <ol style={{ paddingLeft: "clamp(12px, 4vw, 16px)", margin: 0, display: "flex", flexDirection: "column", gap: 4, listStyleType: "decimal", fontWeight: 500 }}>
                <li>Bank account statement of latest 6 months.</li>
                <li>Salary Slip (latest 3 months).</li>
                <li>Copy of Form 16.</li>
                <li>Copy of ITR Acknowledgement.</li>
                <li>Copy of Annual Accounts.</li>
                <li>Net worth certificate</li>
              </ol>
            </div>

            <h4 style={{ fontSize: "clamp(0.9rem, 3.5vw, 1.1rem)", fontWeight: 800, marginBottom: "clamp(10px, 2vw, 12px)", color: "var(--text-primary)" }}>RISK DISCLOSURES ON DERIVATIVES</h4>
            <ul style={{ fontSize: "clamp(0.75rem, 2.8vw, 0.9rem)", margin: 0, display: "flex", flexDirection: "column", gap: 6, listStyle: "none", color: "var(--text-secondary)", paddingLeft: 0, marginBottom: "clamp(20px, 5vw, 24px)", fontWeight: 500, lineHeight: 1.4 }}>
              <li style={{ display: "flex", gap: 8 }}><span style={{ color: "var(--wise-green)", fontSize: "clamp(0.9rem, 3vw, 1.2rem)" }}>•</span> 9 out of 10 individual traders in equity Futures and Options Segment incurred net losses.</li>
              <li style={{ display: "flex", gap: 8 }}><span style={{ color: "var(--wise-green)", fontSize: "clamp(0.9rem, 3vw, 1.2rem)" }}>•</span> On average, loss makers registered net trading loss close to ₹ 50,000.</li>
              <li style={{ display: "flex", gap: 8 }}><span style={{ color: "var(--wise-green)", fontSize: "clamp(0.9rem, 3vw, 1.2rem)" }}>•</span> Loss makers expended an additional 28% of net trading losses as transaction costs.</li>
              <li style={{ display: "flex", gap: 8 }}><span style={{ color: "var(--wise-green)", fontSize: "clamp(0.9rem, 3vw, 1.2rem)" }}>•</span> Profit makers incurred between 15% to 50% of such profits as transaction cost.</li>
            </ul>

            <div className="flex justify-center">
              <button className="btn btn-primary" onClick={() => setShowModal(false)} style={{ width: "100%", padding: "16px", borderRadius: "12px", fontSize: "1rem" }}>
                OK
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Brokerage Plan Modal */}
      {showBrokerageModal && createPortal(
        <div style={{ 
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)",
          zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div className="glass-card animate-slide-up" style={{ width: "100%", maxWidth: 450, padding: 0, borderRadius: "24px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card)" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)" }}>Select Brokerage Plan</h3>
              <button 
                onClick={() => setShowBrokerageModal(false)} 
                style={{ background: "none", border: "none", fontSize: "1.8rem", cursor: "pointer", color: "var(--text-secondary)", lineHeight: 1 }}
              >
                &times;
              </button>
            </div>
            
            <div style={{ padding: "24px", background: "var(--bg-primary)" }}>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "16px", overflow: "hidden", marginBottom: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
                <div style={{ background: "var(--bg-secondary)", padding: "16px", textAlign: "center", fontWeight: 800, borderBottom: "1px solid var(--border-color)", fontSize: "0.95rem" }}>
                  Tariff Plan
                </div>
                <div style={{ padding: "0 20px" }}>
                  {[
                    { label: "Equity Delivery", value: "0.30%" },
                    { label: "Equity Intra Day", value: "0.03%" },
                    { label: "Equity Futures", value: "0.03%" },
                    { label: "Futures Option", value: "50/per lot" }
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: idx === 3 ? "none" : "1px solid var(--border-color)" }}>
                      <span className="text-body" style={{ fontWeight: 600 }}>{item.label}</span>
                      <span className="text-body-bold" style={{ color: "var(--wise-green)", fontWeight: 800 }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => setShowBrokerageModal(false)} style={{ width: "100%", padding: "16px", borderRadius: "12px", fontSize: "1rem" }}>
                Accept & Continue
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* DP Tariff Modal */}
      {showTariffModal && createPortal(
        <div style={{ 
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)",
          zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div className="glass-card animate-slide-up" style={{ 
            width: "100%", maxWidth: 800, height: "85vh", borderRadius: "24px", padding: 0,
            display: "flex", flexDirection: "column", overflow: "hidden"
          }}>
            <div style={{ padding: "24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card)" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)" }}>DP Tariff Sheet</h3>
              <button 
                onClick={() => setShowTariffModal(false)} 
                style={{ background: "none", border: "none", fontSize: "1.8rem", cursor: "pointer", color: "var(--text-secondary)", lineHeight: 1 }}
              >
                &times;
              </button>
            </div>
            
            <div style={{ flex: 1, background: "var(--bg-primary)", padding: "24px" }}>
              <div style={{ height: "100%", border: "1px solid var(--border-color)", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
                <iframe 
                  src="/schedule_of_charges.pdf" 
                  style={{ width: "100%", height: "100%", border: "none", display: "block" }} 
                  title="DP Tariff Sheet PDF"
                />
              </div>
            </div>
            
            <div style={{ padding: "20px 24px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "center", background: "var(--bg-card)" }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowTariffModal(false)} 
                style={{ width: "100%", padding: "16px", borderRadius: "12px", fontSize: "1rem" }}
              >
                Accept & Continue
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
