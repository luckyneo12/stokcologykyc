"use client";
import { useState, useRef, useEffect } from "react";
import { useCorrection } from "@/context/CorrectionContext";
import { uploadDocument } from "@/utils/kycApi";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * CorrectionDocumentStep — Shows the full document module page.
 * - All documents are visible.
 * - ONLY the rejected document slot(s) are cleared for re-upload.
 * - Non-rejected documents are shown as read-only previews.
 *
 * This step handles: financialProof, signature, panUpload, ipv,
 * nominee1Proof, nominee2Proof, nominee3Proof, guardian1Proof, etc.
 */

const getFullUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

// Document sections that appear on the document upload page
const DOCUMENT_SECTIONS = [
  { id: "financialProof", label: "Financial Proof", field: "financialProof", previewKey: "filePreview" },
  { id: "signature", label: "Signature", field: "signature", previewKey: "filePreview" },
  { id: "panUpload", label: "PAN Card Upload", field: "panUpload", previewKey: "filePreview" },
  { id: "ipv", label: "In-Person Verification (Selfie)", field: "selfieDetails", previewKey: "preview" },
];

// Nominee/guardian proof sections
const NOMINEE_SECTIONS = [
  { id: "nominee1Proof", label: "Nominee 1 Document" },
  { id: "nominee2Proof", label: "Nominee 2 Document" },
  { id: "nominee3Proof", label: "Nominee 3 Document" },
  { id: "guardian1Proof", label: "Guardian 1 Document" },
  { id: "guardian2Proof", label: "Guardian 2 Document" },
  { id: "guardian3Proof", label: "Guardian 3 Document" },
];

export default function CorrectionDocumentStep({ stepId, rejectedStep }) {
  const {
    applicationData,
    rejectedSteps,
    drafts,
    saveDraft,
    nextCorrectionStep,
    prevCorrectionStep,
    currentStepIndex,
    addToast,
  } = useCorrection();

  // Find ALL document rejections (there may be multiple on this page)
  const allDocRejections = rejectedSteps.filter(s =>
    [...DOCUMENT_SECTIONS.map(d => d.id), ...NOMINEE_SECTIONS.map(n => n.id)].includes(s.stepId)
  );
  const rejectedDocIds = new Set(allDocRejections.map(r => r.stepId));

  // State for each document slot's new upload
  const [uploads, setUploads] = useState(() => {
    const initial = {};
    for (const docId of rejectedDocIds) {
      initial[docId] = drafts[docId]?.filePreview || drafts[docId]?.preview || null;
    }
    return initial;
  });
  const [uploadTypes, setUploadTypes] = useState(() => {
    const initial = {};
    for (const docId of rejectedDocIds) {
      initial[docId] = drafts[docId]?.type || "";
    }
    return initial;
  });
  const [uploading, setUploading] = useState({});
  const [saving, setSaving] = useState(false);
  const fileRefs = useRef({});

  const handleUpload = async (docId, file) => {
    if (!file) return;
    setUploading(prev => ({ ...prev, [docId]: true }));
    try {
      const result = await uploadDocument(file);
      if (result.success) {
        setUploads(prev => ({ ...prev, [docId]: result.path }));
        addToast(`${docId} uploaded successfully`);
      }
    } catch (error) {
      addToast(error.message || "Failed to upload", "error");
    } finally {
      setUploading(prev => ({ ...prev, [docId]: false }));
    }
  };

  const handleSaveAll = async () => {
    // Validate all rejected docs have uploads
    for (const docId of rejectedDocIds) {
      if (!uploads[docId]) {
        addToast(`Please upload a new ${docId} document`, "error");
        return;
      }
    }

    setSaving(true);
    let allSaved = true;

    for (const docId of rejectedDocIds) {
      const draftData = {
        filePreview: uploads[docId],
        preview: uploads[docId],
        path: uploads[docId],
        ...(uploadTypes[docId] ? { type: uploadTypes[docId] } : {}),
      };

      const success = await saveDraft(docId, draftData);
      if (!success) {
        allSaved = false;
        break;
      }
    }

    setSaving(false);
    if (allSaved) {
      nextCorrectionStep();
    }
  };

  // Render a document section
  const renderDocSection = (section) => {
    const isRejected = rejectedDocIds.has(section.id);
    const rejInfo = allDocRejections.find(r => r.stepId === section.id);

    // Get existing preview from application data
    let existingPreview = null;
    if (section.field) {
      const fieldData = applicationData?.[section.field];
      if (fieldData && section.previewKey) {
        existingPreview = getFullUrl(fieldData[section.previewKey] || fieldData.path);
      }
    }

    if (isRejected) {
      return (
        <div key={section.id} style={{
          padding: 20, borderRadius: 14,
          border: "1.5px solid rgba(239, 68, 68, 0.3)",
          background: "rgba(239, 68, 68, 0.03)",
          marginBottom: 16,
        }}>
          {/* Rejection badge */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h4 style={{ color: "var(--text-primary)", fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>
              {section.label}
            </h4>
            <span style={{
              background: "rgba(239, 68, 68, 0.12)", color: "#ef4444",
              padding: "4px 10px", borderRadius: 8, fontSize: "0.7rem", fontWeight: 800,
              border: "1px solid rgba(239, 68, 68, 0.25)",
            }}>
              REJECTED
            </span>
          </div>

          {/* Rejection reason */}
          <p style={{ color: "#ef4444", fontSize: "0.78rem", fontWeight: 600, marginBottom: 14, margin: "0 0 14px 0" }}>
            Reason: {rejInfo?.reason || "Please re-upload this document"}
          </p>

          {/* Financial proof type selector */}
          {section.id === "financialProof" && (
            <div style={{ marginBottom: 12 }}>
              <select
                value={uploadTypes[section.id] || ""}
                onChange={(e) => setUploadTypes(prev => ({ ...prev, [section.id]: e.target.value }))}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10,
                  background: "var(--input-bg)", border: "1.5px solid var(--border-color)",
                  color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 700,
                  outline: "none",
                }}
              >
                <option value="">Select proof type...</option>
                <option value="Bank Statement">Bank Statement (6 months)</option>
                <option value="ITR">Income Tax Return</option>
                <option value="Salary Slip">Salary Slip (3 months)</option>
                <option value="CA Certificate">CA Certificate</option>
                <option value="Form 16">Form 16</option>
              </select>
            </div>
          )}

          {/* Upload area */}
          {uploads[section.id] ? (
            <div style={{
              padding: 14, borderRadius: 10,
              background: "rgba(159,232,112,0.06)", border: "1px solid rgba(159,232,112,0.2)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 8, overflow: "hidden",
                  border: "1px solid var(--border-color)",
                }}>
                  <img
                    src={getFullUrl(uploads[section.id])}
                    alt="Preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                </div>
                <span style={{ color: "var(--wise-green)", fontWeight: 700, fontSize: "0.85rem" }}>
                  ✓ New document uploaded
                </span>
              </div>
              <button
                onClick={() => {
                  setUploads(prev => ({ ...prev, [section.id]: null }));
                  if (fileRefs.current[section.id]) fileRefs.current[section.id].value = "";
                }}
                style={{
                  background: "none", border: "none", color: "#ef4444",
                  fontSize: "0.8rem", fontWeight: 700, cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>
          ) : (
            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              padding: 28, borderRadius: 12, border: "2px dashed rgba(239, 68, 68, 0.3)",
              cursor: uploading[section.id] ? "wait" : "pointer",
              background: "var(--input-bg)", transition: "all 0.2s",
            }}>
              <input
                ref={el => fileRefs.current[section.id] = el}
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => handleUpload(section.id, e.target.files?.[0])}
                style={{ display: "none" }}
              />
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#ef4444", opacity: 0.6 }}>
                <path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M20 20H4" />
              </svg>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)" }}>
                {uploading[section.id] ? "Uploading..." : "Click to upload new document"}
              </span>
            </label>
          )}
        </div>
      );
    }

    // Non-rejected document — show as read-only preview
    return (
      <div key={section.id} style={{
        padding: 16, borderRadius: 14,
        border: "1px solid var(--border-color)",
        background: "var(--bg-elevated)",
        marginBottom: 12, opacity: 0.7,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h4 style={{ color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>
            {section.label}
          </h4>
          <span style={{
            background: "rgba(159,232,112,0.1)", color: "var(--wise-green)",
            padding: "3px 8px", borderRadius: 6, fontSize: "0.68rem", fontWeight: 700,
          }}>
            APPROVED
          </span>
        </div>
        {existingPreview && (
          <div style={{ marginTop: 8, width: 48, height: 48, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border-color)" }}>
            <img src={existingPreview} alt={section.label} style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { e.target.style.display = "none"; }} />
          </div>
        )}
      </div>
    );
  };

  // Render nominee/guardian proof sections
  const renderNomineeSection = (section) => {
    const isRejected = rejectedDocIds.has(section.id);
    const rejInfo = allDocRejections.find(r => r.stepId === section.id);

    // Try to find existing nominee proof from application data
    const nomineeData = applicationData?.nomineeDetails || {};
    const nominees = Array.isArray(nomineeData.nominees) ? nomineeData.nominees : [];
    const idx = parseInt(section.id.match(/\d+/)?.[0] || "1") - 1;
    const nominee = nominees[idx];
    const isGuardian = section.id.startsWith("guardian");
    const existingProof = isGuardian
      ? getFullUrl(nominee?.guardianProofPreview || nominee?.guardianProof)
      : getFullUrl(nominee?.proofPreview || nominee?.proof);

    if (!isRejected) {
      if (!existingProof && !nominee) return null; // Don't show empty non-rejected sections
      return (
        <div key={section.id} style={{
          padding: 16, borderRadius: 14,
          border: "1px solid var(--border-color)",
          background: "var(--bg-elevated)",
          marginBottom: 12, opacity: 0.7,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h4 style={{ color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>
              {section.label}
            </h4>
            <span style={{
              background: "rgba(159,232,112,0.1)", color: "var(--wise-green)",
              padding: "3px 8px", borderRadius: 6, fontSize: "0.68rem", fontWeight: 700,
            }}>
              OK
            </span>
          </div>
        </div>
      );
    }

    // Rejected nominee/guardian proof
    return (
      <div key={section.id} style={{
        padding: 20, borderRadius: 14,
        border: "1.5px solid rgba(239, 68, 68, 0.3)",
        background: "rgba(239, 68, 68, 0.03)",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h4 style={{ color: "var(--text-primary)", fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>
            {section.label}
          </h4>
          <span style={{
            background: "rgba(239, 68, 68, 0.12)", color: "#ef4444",
            padding: "4px 10px", borderRadius: 8, fontSize: "0.7rem", fontWeight: 800,
            border: "1px solid rgba(239, 68, 68, 0.25)",
          }}>
            REJECTED
          </span>
        </div>
        <p style={{ color: "#ef4444", fontSize: "0.78rem", fontWeight: 600, margin: "0 0 14px 0" }}>
          Reason: {rejInfo?.reason || "Please re-upload this document"}
        </p>

        {uploads[section.id] ? (
          <div style={{
            padding: 14, borderRadius: 10,
            background: "rgba(159,232,112,0.06)", border: "1px solid rgba(159,232,112,0.2)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ color: "var(--wise-green)", fontWeight: 700, fontSize: "0.85rem" }}>✓ New document uploaded</span>
            <button onClick={() => setUploads(prev => ({ ...prev, [section.id]: null }))} style={{
              background: "none", border: "none", color: "#ef4444", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer",
            }}>Remove</button>
          </div>
        ) : (
          <label style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            padding: 28, borderRadius: 12, border: "2px dashed rgba(239, 68, 68, 0.3)",
            cursor: uploading[section.id] ? "wait" : "pointer", background: "var(--input-bg)",
          }}>
            <input ref={el => fileRefs.current[section.id] = el} type="file" accept="image/*,.pdf"
              onChange={(e) => handleUpload(section.id, e.target.files?.[0])} style={{ display: "none" }} />
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)" }}>
              {uploading[section.id] ? "Uploading..." : "Click to upload new document"}
            </span>
          </label>
        )}
      </div>
    );
  };

  // Determine which sections to show
  const hasMainDocRejections = allDocRejections.some(r => DOCUMENT_SECTIONS.some(d => d.id === r.stepId));
  const hasNomineeDocRejections = allDocRejections.some(r => NOMINEE_SECTIONS.some(n => n.id === r.stepId));

  return (
    <div className="step-card" style={{ maxWidth: 600, margin: "0 auto", padding: "32px 28px" }}>
      <h2 style={{ color: "var(--text-primary)", fontSize: "1.15rem", fontWeight: 800, marginBottom: 4 }}>
        Document Corrections
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 24 }}>
        Please re-upload the rejected documents below. Approved documents are shown for reference.
      </p>

      {/* Main document sections */}
      {(hasMainDocRejections || !hasNomineeDocRejections) && (
        <>
          {DOCUMENT_SECTIONS.map(section => renderDocSection(section))}
        </>
      )}

      {/* Nominee/Guardian proof sections */}
      {hasNomineeDocRejections && (
        <>
          <div style={{ height: 1, background: "var(--border-color)", margin: "20px 0" }} />
          <h3 style={{ color: "var(--text-primary)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
            Nominee & Guardian Documents
          </h3>
          {NOMINEE_SECTIONS.map(section => renderNomineeSection(section))}
        </>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
        {currentStepIndex > 0 && (
          <button onClick={prevCorrectionStep} style={{
            flex: 1, padding: "14px", borderRadius: 14,
            background: "var(--bg-elevated)", border: "1.5px solid var(--border-color)",
            color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
          }}>
            Back
          </button>
        )}
        <button onClick={handleSaveAll} disabled={saving} style={{
          flex: 2, padding: "14px", borderRadius: 14,
          background: "var(--wise-green)", border: "none",
          color: "#1a1a2e", fontSize: "0.95rem", fontWeight: 800,
          cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
        }}>
          {saving ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </div>
  );
}
