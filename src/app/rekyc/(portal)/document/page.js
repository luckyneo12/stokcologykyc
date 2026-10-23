"use client";
import { useEffect, useRef, useState } from "react";
import { usePortal, StepFooter } from "@/components/rekyc/PortalShell";
import { rekycApi } from "@/components/rekyc/clientApi";
import SelfieCapture from "@/components/rekyc/SelfieCapture";
import { Icons, Spinner } from "@/components/rekyc/ui";

const MAX_SIZE = 5 * 1024 * 1024;

function UploadRow({ kind, title, required, accept, hint, types }) {
  const { request, setRequest, notify } = usePortal();
  const doc = request.documents?.[kind];
  const [type, setType] = useState(doc?.type || types[0] || "");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!type && types[0]) setType(types[0]);
  }, [types, type]);

  const upload = async (file) => {
    if (!file) return;
    if (file.size > MAX_SIZE) return notify("File should be less than 5MB.", "error");
    const form = new FormData();
    form.append("kind", kind);
    form.append("type", type);
    form.append("file", file);
    setBusy(true);
    try {
      const data = await rekycApi("/documents/upload", { method: "POST", formData: form });
      setRequest(data.request);
      notify("Document uploaded.");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const data = await rekycApi("/documents/remove", { method: "POST", body: { kind } });
      setRequest(data.request);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rk-doc-row">
      <div className="rk-doc-label">
        <h3>{title} {required && <span className="req">*</span>}</h3>
        <div className="rk-hint" style={{ margin: "2px 0 8px" }}>{hint}</div>
        <select className="rk-select" style={{ maxWidth: 340 }} value={type} onChange={(e) => setType(e.target.value)} disabled={busy} aria-label={`${title} type`}>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <input ref={inputRef} type="file" accept={accept} hidden onChange={(e) => upload(e.target.files?.[0])} />
      {doc?.url ? (
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span className="rk-upload-done"><Icons.Check /> UPLOADED</span>
          <span className="rk-hint" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={doc.name}>{doc.name}</span>
          <button className="rk-btn rk-btn-outline rk-btn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>Replace</button>
          <button className="rk-link-btn" style={{ color: "var(--rk-danger)" }} onClick={remove} disabled={busy}>Remove</button>
        </div>
      ) : (
        <button className="rk-btn" onClick={() => inputRef.current?.click()} disabled={busy || !type}>
          {busy ? <Spinner /> : null} {busy ? "Uploading…" : "Upload"}
        </button>
      )}
    </div>
  );
}

export default function DocumentStep() {
  const { request, run } = usePortal();
  const [options, setOptions] = useState({ financialProofTypes: [], nameProofTypes: [] });
  const [selfieOpen, setSelfieOpen] = useState(false);
  const needs = request.requirements.needs;

  useEffect(() => {
    rekycApi("/documents/options").then(setOptions).catch(() => {});
  }, []);

  return (
    <section className="rk-card">
      <div className="rk-card-head">
        <h2>Upload Document</h2>
      </div>
      <div className="rk-card-body">
        <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "0.92em" }}>* indicates required fields.</p>

        <UploadRow
          kind="financialProof"
          title="Financial Proof (only pdf)"
          required={needs.financialProof}
          accept="application/pdf"
          hint={needs.financialProof ? "(File should be less than 5MB) — required to activate FNO" : "(File should be less than 5MB) — optional"}
          types={options.financialProofTypes}
        />

        {needs.nameProof && (
          <UploadRow
            kind="nameProof"
            title="Name Change Proof"
            required
            accept="application/pdf,image/jpeg,image/png"
            hint="(PDF, JPG or PNG, less than 5MB) — for the change of name / father's / mother's name"
            types={options.nameProofTypes}
          />
        )}

        {needs.selfie && (
          <div className="rk-doc-row">
            <div className="rk-doc-label">
              <h3>Live Selfie <span className="req">*</span></h3>
              <div className="rk-hint">Required because you verified your address with DigiLocker. Your face is matched with your Aadhaar photo.</div>
            </div>
            {request.selfie?.status === "passed" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span className="rk-upload-done"><Icons.Check /> VERIFIED</span>
                <button className="rk-btn rk-btn-outline rk-btn-sm" onClick={() => setSelfieOpen(true)}>Retake</button>
              </div>
            ) : (
              <button className="rk-btn" onClick={() => setSelfieOpen(true)}>Take Selfie</button>
            )}
          </div>
        )}
      </div>
      <StepFooter step="document" />
      {selfieOpen && (
        <SelfieCapture
          onClose={() => setSelfieOpen(false)}
          onSubmit={(payload) => run("/selfie", payload, { success: "Selfie verified." })}
        />
      )}
    </section>
  );
}
