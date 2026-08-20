import { ChevronDown, ChevronRight, Edit2, Ban, Paperclip, ZoomIn, ZoomOut, RotateCw } from "lucide-react";

export default function AgentReview() {
  const { id } = useParams();
  const router = useRouter();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const [expandedModule, setExpandedModule] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewRotation, setPreviewRotation] = useState(0);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchDetail = useCallback(async () => {
    if (!id || typeof window === "undefined") return;
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetchWithFallback(`/api/admin/application/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        router.push("/admin/login");
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

  if (loading) return <div className="admin-loading" style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "1.2rem", fontWeight: 800 }}>Loading Review Dashboard...</div>;
  if (!app) return <div className="admin-error" style={{ padding: 40, textAlign: "center" }}>Application not found for ID: {id}</div>;

  const statuses = getStepStatuses(app);
  const currentUserStep = Number(app.currentStep || 0);
  const isNomineeOptOut = app.nomineeDetails?.choice === "opt-out" || app.nomineeDetails?.nomineeChoice === "opt-out" || nomineeSummary(app) === "Opted out";
  const hasCompletedJourneyOnce = !!app.submittedAt || !!app.isResubmitted || !!app.rejectionReason || Object.keys(statuses).length > 0;

  const unlockedSteps = REVIEW_STEPS.filter((step) => {
    if (!hasCompletedJourneyOnce && currentUserStep < step.kycIndex) return false;
    if ((step.id === "nomineeDetails" || step.id === "nomineeAllocation") && isNomineeOptOut) return false;
    if (step.id === "estampPreview" && !app.user?.eStampAssigned) return false;
    return true;
  });

  // Collect all documents
  const allDocumentsMap = new Map();
  unlockedSteps.forEach((step) => {
    const resolvedTabs = typeof step.tabs === 'function' ? step.tabs(app) : step.tabs;
    const activeTab = resolvedTabs && resolvedTabs.length > 0 ? resolvedTabs[0].id : null;
    const ev = step.evidence(app, activeTab);
    ev.forEach((doc) => {
      if (doc && doc.src && !allDocumentsMap.has(doc.src)) {
        allDocumentsMap.set(doc.src, doc);
      }
    });
  });
  const allDocuments = Array.from(allDocumentsMap.values());

  const handleModuleClick = (step) => {
    if (expandedModule === step.id) {
      setExpandedModule(null);
    } else {
      setExpandedModule(step.id);
      // Auto-select first document related to this step
      const resolvedTabs = typeof step.tabs === 'function' ? step.tabs(app) : step.tabs;
      const activeTab = resolvedTabs && resolvedTabs.length > 0 ? resolvedTabs[0].id : null;
      const stepDocs = step.evidence(app, activeTab);
      if (stepDocs && stepDocs.length > 0) {
        setSelectedDocument(stepDocs[0]);
        setPreviewZoom(1);
        setPreviewRotation(0);
      }
    }
  };

  const handleDocumentClick = (doc) => {
    setSelectedDocument(doc);
    setPreviewZoom(1);
    setPreviewRotation(0);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5", display: "flex", flexDirection: "column", fontFamily: "'Inter', sans-serif" }}>
      {/* Top Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", background: "white", borderBottom: "1px solid #d1d5db", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#3b82f6", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "1.1rem" }}>
            {getInitials(getApplicantName(app))}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#111827" }}>{getApplicantName(app)}</h1>
              <span style={{ padding: "4px 8px", background: "#fef3c7", color: "#b45309", borderRadius: 4, fontSize: "0.7rem", fontWeight: "bold", textTransform: "uppercase" }}>Pending Review</span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 2 }}>
              KYC-{app.applicationId.substring(0,8).toUpperCase()}
            </div>
          </div>
        </div>
        
        <div>
          <button onClick={() => router.push("/admin/maker-checker")} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        
        {/* Left Column: Modules */}
        <div style={{ width: "30%", background: "white", borderRight: "1px solid #d1d5db", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", background: "#f9fafb", borderBottom: "1px solid #d1d5db", fontWeight: 600, color: "#374151", display: "flex", justifyContent: "center" }}>
            Modules
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {unlockedSteps.map((step) => {
              const isExpanded = expandedModule === step.id;
              const resolvedTabs = typeof step.tabs === 'function' ? step.tabs(app) : step.tabs;
              const activeTab = resolvedTabs && resolvedTabs.length > 0 ? resolvedTabs[0].id : null;
              const fields = step.fields(app, activeTab).filter(([, value]) => value !== undefined && value !== null && value !== "");
              const isRejected = statuses[step.id]?.status === "rejected";

              return (
                <div key={step.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <div 
                    onClick={() => handleModuleClick(step)}
                    style={{ 
                      padding: "12px 16px", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between", 
                      cursor: "pointer", 
                      background: isExpanded ? "#f3f4f6" : "white",
                      transition: "background 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#374151", fontWeight: 500, fontSize: "0.9rem" }}>
                      {step.title}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {isExpanded ? <ChevronDown size={18} color="#9ca3af" /> : <ChevronRight size={18} color="#9ca3af" />}
                      <Ban size={16} color="#ef4444" style={{ cursor: "pointer" }} title="Reject Step" />
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div style={{ padding: "12px 16px", background: "#f9fafb" }}>
                      {fields.length === 0 ? (
                         <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>No details available.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {fields.map(([label, value]) => (
                            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
                                <div style={{ fontSize: "0.9rem", color: "#111827", wordBreak: "break-word", fontWeight: 500 }}>
                                  {label === "Segments" && typeof value === "string" 
                                    ? value.split(",").join(", ") 
                                    : String(value)
                                  }
                                </div>
                              </div>
                              <Edit2 size={14} color="#6b7280" style={{ cursor: "pointer", marginTop: 14 }} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Middle Column: Documents */}
        <div style={{ width: "25%", background: "white", borderRight: "1px solid #d1d5db", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", background: "#f9fafb", borderBottom: "1px solid #d1d5db", fontWeight: 600, color: "#374151", display: "flex", justifyContent: "center" }}>
            Documents
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {allDocuments.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: "0.9rem" }}>No documents available.</div>
            ) : (
              allDocuments.map((doc, idx) => {
                const isSelected = selectedDocument?.src === doc.src;
                return (
                  <div 
                    key={idx}
                    onClick={() => handleDocumentClick(doc)}
                    style={{ 
                      padding: "12px 16px", 
                      borderBottom: "1px solid #e5e7eb", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      cursor: "pointer",
                      background: isSelected ? "#eef2ff" : "white",
                      color: isSelected ? "#4f46e5" : "#374151",
                      transition: "background 0.2s"
                    }}
                  >
                    <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{doc.label || "Document"}</span>
                    <Paperclip size={16} color={isSelected ? "#4f46e5" : "#9ca3af"} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Preview */}
        <div style={{ flex: 1, background: "white", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", background: "#f9fafb", borderBottom: "1px solid #d1d5db", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, color: "#374151", fontSize: "0.95rem" }}>Preview</span>
            <button style={{ padding: "6px 12px", background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 4, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>
              Auto Verification Match
            </button>
          </div>
          
          <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", background: "#f3f4f6", overflow: "hidden" }}>
            {!selectedDocument ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
                 <FileText size={64} style={{ opacity: 0.5, marginBottom: 16 }} />
                 <span style={{ fontWeight: 600, fontSize: "1.1rem" }}>NO DOCUMENT</span>
                 <span style={{ fontSize: "0.9rem" }}>uploaded</span>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflow: "auto" }}>
                <div style={{ 
                  transform: `scale(${previewZoom}) rotate(${previewRotation}deg)`, 
                  transition: "transform 0.2s ease",
                  maxHeight: "100%",
                  maxWidth: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  {isPdf(selectedDocument.src) ? (
                    <PdfThumbnail src={selectedDocument.src} />
                  ) : (
                    <img 
                      src={selectedDocument.src} 
                      alt="Preview" 
                      style={{ maxHeight: "70vh", maxWidth: "100%", objectFit: "contain", borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} 
                    />
                  )}
                </div>
              </div>
            )}

            {selectedDocument && (
               <div style={{ position: "absolute", bottom: 24, right: 24, display: "flex", gap: 8, background: "white", padding: "8px 12px", borderRadius: 24, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", border: "1px solid #e5e7eb" }}>
                  <button onClick={() => setPreviewZoom(z => Math.max(0.5, z - 0.25))} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#4b5563" }} title="Zoom Out"><ZoomOut size={18} /></button>
                  <button onClick={() => setPreviewZoom(z => Math.min(3, z + 0.25))} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#4b5563" }} title="Zoom In"><ZoomIn size={18} /></button>
                  <div style={{ width: 1, background: "#d1d5db", margin: "0 4px" }} />
                  <button onClick={() => setPreviewRotation(r => r + 90)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#4b5563" }} title="Rotate"><RotateCw size={18} /></button>
                  <div style={{ width: 1, background: "#d1d5db", margin: "0 4px" }} />
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#6b7280", display: "flex", alignItems: "center" }}>{Math.round(previewZoom * 100)}%</span>
               </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div style={{ padding: "16px 24px", background: "white", borderTop: "1px solid #d1d5db", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 12 }}>
               <button style={{ padding: "8px 16px", color: "#ef4444", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}>
                  Reject
               </button>
               <button style={{ padding: "8px 16px", color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}>
                  Upload File
               </button>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
               <button style={{ padding: "8px 24px", color: "#374151", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}>
                  Save
               </button>
               <button style={{ padding: "8px 24px", color: "white", background: "#2563eb", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)" }}>
                  Save & Generate PDF
               </button>
            </div>
          </div>

        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "white", border: `2px solid ${toast.type === "error" ? "#b91c1c" : "#30a46c"}`, color: toast.type === "error" ? "#b91c1c" : "#15803d", borderRadius: 8, padding: "14px 22px", fontWeight: 900, zIndex: 1000, boxShadow: "0 20px 40px rgba(0,0,0,0.14)", display: "flex", alignItems: "center", gap: 8 }}>
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
