"use client";
import { useState, useEffect, useRef } from "react";
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
          
          <div className="form-grid-2" style={{ gap: 12 }}>
            <div 
              onClick={() => toggleSegment("equity")}
              style={{ 
                padding: "16px", borderRadius: "16px", border: "1px solid var(--border-color)",
                background: "rgba(159, 232, 112, 0.08)",
                borderColor: "var(--wise-green)",
                cursor: "default", transition: "all 0.2s ease", display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center",
                opacity: 0.9
              }}
            >
              <div style={{ 
                width: 20, height: 20, borderRadius: "5px", border: "2px solid var(--border-color)",
                background: selectedSegments.equity ? "var(--wise-green)" : "transparent",
                borderColor: selectedSegments.equity ? "var(--wise-green)" : "var(--border-color)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {selectedSegments.equity && <CheckCircleIcon size={14} style={{ color: "var(--wise-dark-green)" }} />}
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Equity</span>
            </div>

            <div 
              onClick={() => toggleSegment("derivatives")}
              style={{ 
                padding: "16px", borderRadius: "16px", border: "1px solid var(--border-color)",
                background: selectedSegments.derivatives ? "rgba(159, 232, 112, 0.08)" : "var(--bg-secondary)",
                borderColor: selectedSegments.derivatives ? "var(--wise-green)" : "transparent",
                cursor: "pointer", transition: "all 0.2s ease", display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center"
              }}
              className="hover-scale"
            >
              <div style={{ 
                width: 20, height: 20, borderRadius: "5px", border: "2px solid var(--border-color)",
                background: selectedSegments.derivatives ? "var(--wise-green)" : "transparent",
                borderColor: selectedSegments.derivatives ? "var(--wise-green)" : "var(--border-color)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {selectedSegments.derivatives && <CheckCircleIcon size={14} style={{ color: "var(--wise-dark-green)" }} />}
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Derivatives</span>
            </div>
          </div>
        </div>

        <div className="form-grid-2" style={{ gap: 16, marginBottom: 28 }}>
          {/* Brokerage Plan Row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => { 
                setShowBrokerageModal(true); 
                setBrokerageOpened(true);
                setBrokerageAccepted(true);
              }} 
              style={{ flex: 1, padding: "12px", fontSize: "0.85rem", borderRadius: "10px", justifyContent: "center" }}
            >
              Brokerage Plan
            </button>
            <div 
              onClick={() => brokerageOpened && setBrokerageAccepted(!brokerageAccepted)}
              onMouseEnter={() => !brokerageOpened && setShowBrokerageTooltip(true)}
              onMouseLeave={() => setShowBrokerageTooltip(false)}
              style={{ 
                width: 38, height: 38, borderRadius: "10px", background: "var(--bg-secondary)", 
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: brokerageOpened ? "pointer" : "help",
                opacity: brokerageOpened ? 1 : 0.5,
                border: brokerageAccepted ? "2px solid var(--wise-green)" : "1px solid var(--border-color)",
                transition: "all 0.2s ease",
                position: "relative",
                flexShrink: 0
              }}
            >
              {showBrokerageTooltip && (
                <div style={{
                  position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
                  marginBottom: 8, padding: "6px 10px", background: "var(--text-primary)", color: "var(--bg-primary)",
                  fontSize: "0.65rem", borderRadius: "6px", whiteSpace: "nowrap", zIndex: 10,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)", pointerEvents: "none"
                }}>
                  View document first
                </div>
              )}
              <div style={{ 
                width: 16, height: 16, borderRadius: 4, border: "2px solid var(--border-color)",
                background: brokerageAccepted ? "var(--wise-green)" : "transparent",
                borderColor: brokerageAccepted ? "var(--wise-green)" : "var(--border-color)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {brokerageAccepted && <CheckCircleIcon size={12} style={{ color: "var(--wise-dark-green)" }} />}
              </div>
            </div>
          </div>

          {/* DP Tariff Row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => { 
                setShowTariffModal(true); 
                setTariffOpened(true);
                setTariffAccepted(true);
              }} 
              style={{ flex: 1, padding: "12px", fontSize: "0.85rem", borderRadius: "10px", justifyContent: "center" }}
            >
              DP Tariff Sheet
            </button>
            <div 
              onClick={() => tariffOpened && setTariffAccepted(!tariffAccepted)}
              onMouseEnter={() => !tariffOpened && setShowTariffTooltip(true)}
              onMouseLeave={() => setShowTariffTooltip(false)}
              style={{ 
                width: 38, height: 38, borderRadius: "10px", background: "var(--bg-secondary)", 
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: tariffOpened ? "pointer" : "help",
                opacity: tariffOpened ? 1 : 0.5,
                border: tariffAccepted ? "2px solid var(--wise-green)" : "1px solid var(--border-color)",
                transition: "all 0.2s ease",
                position: "relative",
                flexShrink: 0
              }}
            >
              {showTariffTooltip && (
                <div style={{
                  position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
                  marginBottom: 8, padding: "6px 10px", background: "var(--text-primary)", color: "var(--bg-primary)",
                  fontSize: "0.65rem", borderRadius: "6px", whiteSpace: "nowrap", zIndex: 10,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)", pointerEvents: "none"
                }}>
                  View document first
                </div>
              )}
              <div style={{ 
                width: 16, height: 16, borderRadius: 4, border: "2px solid var(--border-color)",
                background: tariffAccepted ? "var(--wise-green)" : "transparent",
                borderColor: tariffAccepted ? "var(--wise-green)" : "var(--border-color)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {tariffAccepted && <CheckCircleIcon size={12} style={{ color: "var(--wise-dark-green)" }} />}
              </div>
            </div>
          </div>
        </div>

        <div className="input-group" style={{ marginBottom: 32 }}>
          <label className="text-body-bold" style={{ display: "block", marginBottom: 10, fontSize: "0.9rem" }}>Continue with BSDA?</label>
          <select 
            className="input-field" 
            style={{ height: "54px", fontSize: "0.95rem", fontWeight: 600, borderRadius: "12px" }}
            value={bsdaPreference}
            onChange={(e) => setBsdaPreference(e.target.value)}
          >
            <option value="opt-in">Opt-in</option>
            <option value="opt-out">Opt-out</option>
          </select>
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
      {showModal && (
        <div style={{ 
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div className="glass-card animate-slide-up" style={{ maxWidth: 500, padding: 32, borderRadius: "12px" }}>
            <h3 style={{ fontSize: "1.5rem", fontWeight: 500, marginBottom: 20, color: "var(--text-primary)" }}>Enable F&O / Currency / Commodity</h3>
            
            <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.4 }}>
              <p style={{ marginBottom: 12 }}>To enable F&O/Currency/Commodity, you need to provide one of the below proof. <strong style={{ color: "var(--text-primary)" }}>(ANY one is required)</strong></p>
              <ol style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, listStyleType: "decimal" }}>
                <li>Bank account statement for last 6 months.</li>
                <li>Copy of Demat account holding statement.</li>
                <li>Salary Slip</li>
                <li>Copy of Form 16.</li>
                <li>Copy of ITR Acknowledgement.</li>
                <li>Copy of Annual Accounts.</li>
                <li>Net worth certificate</li>
              </ol>
            </div>

            <h4 style={{ fontSize: "1.4rem", fontWeight: 500, marginBottom: 16, color: "var(--text-primary)" }}>RISK DISCLOSURES ON DERIVATIVES</h4>
            <ul style={{ fontSize: "0.9rem", display: "flex", flexDirection: "column", gap: 12, listStyle: "none", color: "var(--text-secondary)", paddingLeft: 0, marginBottom: 32 }}>
              <li style={{ display: "flex", gap: 8 }}><span>•</span> 9 out of 10 individual traders in equity Futures and Options Segment incurred net losses.</li>
              <li style={{ display: "flex", gap: 8 }}><span>•</span> On average, loss makers registered net trading loss close to ₹ 50,000.</li>
              <li style={{ display: "flex", gap: 8 }}><span>•</span> Loss makers expended an additional 28% of net trading losses as transaction costs.</li>
              <li style={{ display: "flex", gap: 8 }}><span>•</span> Profit makers incurred between 15% to 50% of such profits as transaction cost.</li>
            </ul>

            <div className="flex justify-center">
              <button className="btn" onClick={() => setShowModal(false)} style={{ background: "var(--text-primary)", color: "var(--bg-primary)", padding: "10px 40px", borderRadius: "6px", fontWeight: 600 }}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brokerage Plan Modal */}
      {showBrokerageModal && (
        <div style={{ 
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)",
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div className="glass-card animate-slide-up" style={{ width: "100%", maxWidth: 500, padding: 0, overflow: "hidden" }}>
            <div style={{ background: "var(--wise-green)", color: "var(--wise-dark-green)", padding: "20px", textAlign: "center", fontWeight: 800, fontSize: "1.1rem" }}>
              Select Brokerage Plan
            </div>
            <div style={{ padding: "32px" }}>
              <div style={{ border: "1px solid var(--border-color)", borderRadius: 16, overflow: "hidden" }}>
                <div style={{ background: "var(--bg-secondary)", padding: "12px", textAlign: "center", fontWeight: 700, borderBottom: "1px solid var(--border-color)" }}>
                  Tariff Plan
                </div>
                <div style={{ padding: 20 }}>
                  {[
                    { label: "Equity Delivery", value: "0.30%" },
                    { label: "Equity Intra Day", value: "0.03%" },
                    { label: "Equity Futures", value: "0.03%" },
                    { label: "Futures Option", value: "50/per lot" }
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: idx === 3 ? 24 : 16 }}>
                      <span className="text-body" style={{ fontWeight: 500 }}>{item.label}</span>
                      <span className="text-body-bold" style={{ color: theme === "dark" ? "var(--wise-green)" : "var(--wise-dark-green)" }}>{item.value}</span>
                    </div>
                  ))}
                  <button className="btn btn-primary" onClick={() => setShowBrokerageModal(false)} style={{ width: "100%", borderRadius: "100px" }}>
                    Select Plan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DP Tariff Modal */}
      {showTariffModal && (
        <div style={{ 
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)",
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div className="glass-card animate-slide-up" style={{ 
            width: "100%", maxWidth: 800, height: "80vh", borderRadius: "16px",
            display: "flex", flexDirection: "column", overflow: "hidden"
          }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card)" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>DP Tariff Sheet</h3>
              <button 
                onClick={() => setShowTariffModal(false)} 
                style={{ background: "none", border: "none", fontSize: "1.8rem", cursor: "pointer", color: "var(--text-secondary)", lineHeight: 1 }}
              >
                &times;
              </button>
            </div>
            <div style={{ flex: 1, background: "#f0f2f5" }}>
              <iframe 
                src="/schedule_of_charges.pdf" 
                style={{ width: "100%", height: "100%", border: "none" }} 
                title="DP Tariff Sheet PDF"
              />
            </div>
            <div style={{ padding: "12px 24px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "center", background: "var(--bg-card)" }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowTariffModal(false)} 
                style={{ padding: "10px 60px", borderRadius: "8px", fontSize: "0.9rem", fontWeight: 600 }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
