const fs = require('fs');
const path = 'c:\\\\Users\\\\vampi\\\\OneDrive\\\\Desktop\\\\Kyc-Portal-New-main\\\\src\\\\app\\\\agent\\\\submissions\\\\[id]\\\\page.js';
const code = fs.readFileSync(path, 'utf8');

const splitToken = 'export default function AgentReview() {';
const parts = code.split(splitToken);

if (parts.length !== 2) {
  console.error('Split failed');
  process.exit(1);
}

const newCode = parts[0] + `function ImageComparisonModal({ isOpen, onClose, leftImage, leftLabel, rightImage, rightLabel, matchScore }) {
  if (!isOpen) return null;
  const isSingle = !rightLabel && !rightImage;
  
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", flexDirection: "column", backdropFilter: "blur(8px)", padding: "40px", animation: "fadeIn 0.2s ease-out" }}>
      <div style={{ alignSelf: "flex-end", marginBottom: 20 }}>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer", transition: "transform 0.2s" }} onMouseOver={e => e.currentTarget.style.transform="scale(1.1)"} onMouseOut={e => e.currentTarget.style.transform="scale(1)"}>
          <X size={40} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 30, height: "80%", justifyContent: "center", alignItems: "center" }}>
        <div style={{ flex: isSingle ? "none" : 1, width: isSingle ? "80%" : "auto", background: "#1a1a1a", borderRadius: 16, overflow: "hidden", border: "1px solid #333", display: "flex", flexDirection: "column", height: "100%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
          <div style={{ padding: 15, background: "#2a2a2a", color: "white", fontWeight: 800, textAlign: "center", letterSpacing: 1 }}>{leftLabel}</div>
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}>
            {leftImage ? <img src={leftImage} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} /> : <div style={{color:"#666"}}>No Image Available</div>}
          </div>
        </div>
        
        {matchScore !== undefined && matchScore !== null && matchScore !== "" && !isSingle && (
          <div style={{ width: 120, height: 120, borderRadius: 60, background: matchScore >= 70 ? "#dcfce7" : "#fee2e2", border: \`4px solid \${matchScore >= 70 ? "#15803d" : "#991b1b"}\`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: matchScore >= 70 ? "#15803d" : "#991b1b", zIndex: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
            <span style={{ fontSize: "2.2rem", fontWeight: 950 }}>{matchScore}%</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase" }}>Match</span>
          </div>
        )}

        {!isSingle && (
          <div style={{ flex: 1, background: "#1a1a1a", borderRadius: 16, overflow: "hidden", border: "1px solid #333", display: "flex", flexDirection: "column", height: "100%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
            <div style={{ padding: 15, background: "#2a2a2a", color: "white", fontWeight: 800, textAlign: "center", letterSpacing: 1 }}>{rightLabel}</div>
            <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}>
              {rightImage ? <img src={rightImage} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} /> : <div style={{color:"#666"}}>No Image Available</div>}
            </div>
          </div>
        )}
      </div>
      <style>{\`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      \`}</style>
    </div>
  );
}

function StepCard({ step, app, info, submitting, reviewStep, onImageClick }) {
  const isApproved = info.status === "approved";
  const isRejected = info.status === "rejected";
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const evidence = step.evidence(app);

  return (
    <div className="card" style={{ padding: 24, borderRadius: 12, marginBottom: 20, border: isApproved ? "2px solid #dcfce7" : isRejected ? "2px solid #fee2e2" : "1px solid var(--border-color)", background: "white", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", transition: "all 0.3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ width: 28, height: 28, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: isApproved ? "#15803d" : isRejected ? "#b91c1c" : "#f3f4f6", color: isApproved || isRejected ? "white" : "#4b5563", fontWeight: 900, fontSize: "0.9rem" }}>
              {isApproved ? <CheckCircle2 size={16} /> : isRejected ? <XCircle size={16} /> : step.kycIndex}
            </span>
            <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 900, color: "var(--text-primary)" }}>{step.title}</h2>
          </div>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem", fontWeight: 600 }}>{step.evidenceHint}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ padding: "6px 12px", borderRadius: 20, fontSize: "0.8rem", fontWeight: 800, background: isApproved ? "#dcfce7" : isRejected ? "#fee2e2" : "#f3f4f6", color: isApproved ? "#15803d" : isRejected ? "#991b1b" : "#4b5563" }}>
            {isApproved ? "Approved" : isRejected ? "Rejected" : "Pending Review"}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <h4 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Details</h4>
          <FieldGrid fields={step.fields(app)} />
        </div>
        <div>
          <h4 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{step.evidenceTitle}</h4>
          {evidence.length === 0 ? (
            <div style={{ height: "100%", minHeight: 150, border: "1px dashed var(--border-color)", borderRadius: 8, background: "var(--bg-secondary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
              <AlertCircle size={28} />
              <div style={{ marginTop: 8, fontWeight: 800 }}>No document available</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {evidence.map((item, index) => (
                <div key={index} style={{ border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden", cursor: "pointer", position: "relative" }} onClick={() => onImageClick(item, step)}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>
                    <strong style={{ fontSize: "0.8rem" }}>{item.label || "Evidence"}</strong>
                    <Maximize2 size={14} color="var(--text-muted)" />
                  </div>
                  <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f9fa" }}>
                    {isPdf(item.src) ? (
                      <PdfThumbnail src={item.src} />
                    ) : (
                      <img src={item.src} alt="Evidence" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", gap: 12 }}>
        {!showReject && (
          <button disabled={submitting || isRejected} onClick={() => setShowReject(true)} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #fecaca", background: isRejected ? "#fee2e2" : "transparent", color: isRejected ? "#991b1b" : "#b91c1c", fontWeight: 800, cursor: submitting || isRejected ? "not-allowed" : "pointer", transition: "0.2s" }}>
            {isRejected ? "Rejected" : "Reject Step"}
          </button>
        )}
        {!showReject && (
          <button disabled={submitting || isApproved} onClick={() => reviewStep(step, "approved")} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: isApproved ? "#15803d" : "#30a46c", color: "white", fontWeight: 800, cursor: submitting || isApproved ? "not-allowed" : "pointer", transition: "0.2s", boxShadow: "0 4px 12px rgba(48, 164, 108, 0.3)" }}>
            {isApproved ? "Approved" : "Approve Step"}
          </button>
        )}
      </div>
      
      {showReject && (
        <div style={{ marginTop: 16, background: "#fdf2f2", padding: 16, borderRadius: 8, border: "1px solid #fecaca" }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#991b1b" }}>Provide Rejection Reason</h4>
          <textarea className="admin-input" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection (visible in audit logs)" style={{ minHeight: 80, width: "100%", marginBottom: 12, padding: 12, borderRadius: 8, border: "1px solid #fca5a5" }} />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setShowReject(false)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ccc", background: "white", cursor: "pointer", fontWeight: 700 }}>Cancel</button>
            <button disabled={submitting || !rejectReason.trim()} onClick={() => { reviewStep(step, "rejected", rejectReason); setShowReject(false); }} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#b91c1c", color: "white", cursor: rejectReason.trim() ? "pointer" : "not-allowed", fontWeight: 700 }}>Confirm Rejection</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentReview() {
  const { id } = useParams();
  const router = useRouter();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  
  const [modalState, setModalState] = useState({ isOpen: false });

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchDetail = useCallback(async () => {
    if (!id || typeof window === "undefined") return;
    try {
      const token = localStorage.getItem("agent_token");
      const response = await fetchWithFallback(\`/api/admin/application/\${id}\`, {
        headers: { Authorization: \`Bearer \${token}\` },
      });

      if (response.status === 401) {
        router.push("/agent/login");
        return;
      }

      const data = await response.json();
      if (data.success) {
        setApp(normalizeApp(data.application));
      } else {
        showToast(data.error || "Unable to load application", "error");
      }
    } catch (error) {
      console.error("Fetch failed", error);
      showToast("Network error while loading application", "error");
    } finally {
      setLoading(false);
    }
  }, [id, router, showToast]);

  useEffect(() => {
    fetchDetail();
    
    if (id) {
      const socket = io(API_BASE_URL, { withCredentials: true });
      socket.on("connect", () => socket.emit("join_application", id));
      socket.on("kyc_updated", () => fetchDetail());
      return () => socket.disconnect();
    }
  }, [fetchDetail, id]);

  const updateApplicationStatus = async (status, reason = "") => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem("agent_token");
      const response = await fetchWithFallback(\`/api/admin/review/\${app.applicationId}\`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: \`Bearer \${token}\` },
        body: JSON.stringify({ status, reason }),
      });
      const data = await response.json();
      if (data.success) {
        showToast(\`Application \${status}\`);
        await fetchDetail();
      } else {
        showToast(data.error || "Unable to update application", "error");
      }
    } catch (error) {
      showToast("Network error while updating application", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const reviewStep = async (step, status, reason = "") => {
    if (status === "rejected" && !reason.trim()) {
      showToast("Please add a rejection reason", "error");
      return;
    }
    try {
      setSubmitting(true);
      const token = localStorage.getItem("agent_token");
      const response = await fetchWithFallback(\`/api/agent/kyc/\${app.applicationId}/step/\${step.id}/review\`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: \`Bearer \${token}\` },
        body: JSON.stringify({ status, reason: status === "rejected" ? reason.trim() : undefined }),
      });
      const data = await response.json();
      if (data.success) {
        showToast(status === "approved" ? \`\${step.title} approved\` : \`\${step.title} rejected\`, status === "approved" ? "success" : "error");
        await fetchDetail();
      } else {
        showToast(data.error || "Unable to submit review", "error");
      }
    } catch (error) {
      showToast("Network error while submitting review", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openComparisonModal = (leftImg, leftLbl, rightImg, rightLbl, score) => {
    setModalState({ isOpen: true, leftImage: leftImg?.src || leftImg, leftLabel: leftLbl, rightImage: rightImg?.src || rightImg, rightLabel: rightLbl, matchScore: score });
  };

  const handleImageClick = (item, step) => {
    if (isPdf(item.src)) {
      openInNewTab(item.src);
      return;
    }

    if (step.id === "ipv") {
      const selfieImg = firstMedia(app.selfieDetails?.preview || app.selfieDetails?.path || app.selfie, "Live Selfie");
      const aadhaarImg = findDocument(app, ["aadhaar", "photo", "digilocker"], "Reference Photo", ["pan"]);
      openComparisonModal(selfieImg, "Live Selfie", aadhaarImg, "Aadhaar Photo", app.faceMatchScore);
    } else if (step.id === "panVerification" || step.id === "panUpload") {
      const uploadedPanImg = firstMedia(app.panUpload, "Uploaded PAN Card") || findDocument(app, ["pan"], "PAN Document", ["digilocker"]);
      const digilockerPanImg = findDocument(app, ["pan", "digilocker"], "DigiLocker PAN");
      openComparisonModal(uploadedPanImg, "Uploaded PAN", digilockerPanImg, "DigiLocker PAN", null);
    } else {
      openComparisonModal(item.src, item.label || "Document", null, "", null);
    }
  };

  if (loading) return <div className="admin-loading" style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "1.2rem", fontWeight: 800 }}>Loading Review Dashboard...</div>;
  if (!app) return <div className="admin-error" style={{ padding: 40, textAlign: "center" }}>Application not found for ID: {id}</div>;

  const statuses = getStepStatuses(app);
  const currentUserStep = Number(app.currentStep || 0);
  const unlockedSteps = REVIEW_STEPS.filter((step) => currentUserStep >= step.kycIndex);
  
  const approvedCount = unlockedSteps.filter((step) => statuses[step.id]?.status === "approved").length;
  const rejectedSteps = unlockedSteps.filter(step => statuses[step.id]?.status === "rejected");
  const canApproveApplication = unlockedSteps.length > 0 && approvedCount === unlockedSteps.length && currentUserStep >= 17 && app.status !== "verified" && rejectedSteps.length === 0;
  const progress = unlockedSteps.length ? Math.round((approvedCount / unlockedSteps.length) * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5", padding: "24px 32px", fontFamily: "'Inter', sans-serif" }}>
      <ImageComparisonModal {...modalState} onClose={() => setModalState({ isOpen: false })} />
      
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <button onClick={() => router.push("/agent")} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "none", background: "white", padding: "10px 16px", borderRadius: 8, color: "var(--text-primary)", fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <ArrowLeft size={18} /> Back to Requests
          </button>
          
          {canApproveApplication && (
            <button disabled={submitting} onClick={() => updateApplicationStatus("verified")} style={{ padding: "12px 24px", borderRadius: 8, border: "none", background: "var(--wise-dark-green)", color: "white", fontWeight: 900, cursor: submitting ? "not-allowed" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, boxShadow: "0 4px 15px rgba(0,0,0,0.2)" }}>
              <BadgeCheck size={20} /> Finalize Approval
            </button>
          )}
        </div>

        <div style={{ background: "linear-gradient(135deg, #163300 0%, #2a5a00 100%)", borderRadius: 16, padding: 32, color: "white", marginBottom: 30, boxShadow: "0 10px 30px rgba(22, 51, 0, 0.15)", display: "grid", gridTemplateColumns: "1fr auto", gap: 40, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.2)", padding: "6px 12px", borderRadius: 20, fontSize: "0.8rem", fontWeight: 800, marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>
              <ShieldCheck size={16} /> Comprehensive Review
            </div>
            <h1 style={{ margin: "0 0 8px 0", fontSize: "2.2rem", fontWeight: 900, letterSpacing: -0.5 }}>{getApplicantName(app)}</h1>
            <p style={{ margin: 0, fontSize: "1rem", color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>
              ID: <span style={{ fontWeight: 800 }}>{app.applicationId}</span> &bull; {app.user?.phone || "No phone"} &bull; {app.personalDetails?.email || app.user?.email || "No email"}
            </p>
          </div>
          
          <div style={{ display: "flex", gap: 24, textAlign: "right" }}>
            <div style={{ background: "rgba(0,0,0,0.2)", padding: 20, borderRadius: 12, backdropFilter: "blur(10px)" }}>
              <div style={{ fontSize: "0.85rem", textTransform: "uppercase", fontWeight: 800, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>Overall Progress</div>
              <div style={{ fontSize: "2rem", fontWeight: 900 }}>{progress}%</div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.2)", padding: 20, borderRadius: 12, backdropFilter: "blur(10px)", border: Number(app.faceMatchScore || 0) < 70 ? "2px solid #ef4444" : "none" }}>
              <div style={{ fontSize: "0.85rem", textTransform: "uppercase", fontWeight: 800, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>Face Match</div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: Number(app.faceMatchScore || 0) >= 70 ? "#a7f3d0" : "#fca5a5" }}>{app.faceMatchScore || 0}%</div>
            </div>
          </div>
        </div>

        {rejectedSteps.length > 0 && (
          <div style={{ background: "#fee2e2", border: "1px solid #f87171", color: "#991b1b", padding: 20, borderRadius: 12, marginBottom: 30, display: "flex", gap: 12, alignItems: "center" }}>
            <AlertCircle size={24} />
            <div>
              <strong style={{ display: "block", fontSize: "1.1rem" }}>Application Blocked</strong>
              There are {rejectedSteps.length} rejected steps. They must be resolved before final approval.
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {unlockedSteps.map((step) => (
            <StepCard 
              key={step.id} 
              step={step} 
              app={app} 
              info={statuses[step.id] || {}} 
              submitting={submitting} 
              reviewStep={reviewStep} 
              onImageClick={handleImageClick}
            />
          ))}
          {unlockedSteps.length === 0 && (
            <div className="card" style={{ padding: 60, borderRadius: 12, textAlign: "center", background: "white" }}>
              <Clock3 size={48} color="#9ca3af" style={{ marginBottom: 16 }} />
              <h2 style={{ margin: "0 0 8px", fontSize: "1.5rem", fontWeight: 800 }}>Waiting for User</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "1rem" }}>The applicant has not reached a verifiable KYC step yet.</p>
            </div>
          )}
        </div>

      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "white", border: \`2px solid \${toast.type === "error" ? "#b91c1c" : "#30a46c"}\`, color: toast.type === "error" ? "#b91c1c" : "#15803d", borderRadius: 8, padding: "14px 22px", fontWeight: 900, zIndex: 1000, boxShadow: "0 20px 40px rgba(0,0,0,0.14)", display: "flex", alignItems: "center", gap: 8 }}>
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync(path, newCode);
console.log('Successfully updated page.js');
