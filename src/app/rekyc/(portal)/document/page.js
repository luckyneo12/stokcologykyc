"use client";
import { useEffect, useRef, useState } from "react";
import { usePortal, StepFooter } from "@/components/rekyc/PortalShell";
import { rekycApi } from "@/components/rekyc/clientApi";
import SelfieCapture from "@/components/rekyc/SelfieCapture";
import { runDigio } from "@/components/rekyc/digio";
import { Icons, Spinner } from "@/components/rekyc/ui";

const MAX_SIZE = 5 * 1024 * 1024;
const FINANCIAL_PROOF_ACCEPT = [
  ".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".webp",
  "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png", "image/webp",
].join(",");

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
  const { request, run, notify } = usePortal();
  const [options, setOptions] = useState({ financialProofTypes: [], nameProofTypes: [] });
  const [selfieOpen, setSelfieOpen] = useState(false);
  const [digilockerBusy, setDigilockerBusy] = useState(false);
  const needs = request.requirements.needs;
  // Everything this step still needs before Review & eSign can open
  const pending = request.requirements.missing.filter((m) => m.step === "document");

  useEffect(() => {
    rekycApi("/documents/options").then(setOptions).catch(() => {});
  }, []);

  const verifyDigilocker = async () => {
    setDigilockerBusy(true);
    try {
      let requestId;
      await runDigio({
        create: async () => {
          const data = await rekycApi("/personal/address/digilocker/start", { method: "POST", body: {} });
          requestId = data.requestId;
          return { requestId: data.requestId, identifier: data.customerIdentifier, accessToken: data.accessToken };
        },
      });
      await run("/personal/address/digilocker/complete", { requestId, purpose: "contact" }, { success: "Aadhaar verified. Please take the live selfie." });
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setDigilockerBusy(false);
    }
  };

  const next = () => {
    if (!pending.length) return true;
    notify(pending[0].message, "error");
    return false;
  };

  return (
    <section className="rk-card">
      <div className="rk-card-head">
        <h2>Upload Document</h2>
      </div>
      <div className="rk-card-body">
        <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "0.92em" }}>* indicates required fields.</p>

        <UploadRow
          kind="financialProof"
          title="Financial Proof"
          required={needs.financialProof}
          accept={FINANCIAL_PROOF_ACCEPT}
          hint={`(PDF, DOC, DOCX, JPG, JPEG or PNG, less than 5MB) — ${needs.financialProof ? "required to activate FNO" : "optional"}`}
          types={options.financialProofTypes}
        />

        {needs.digilocker && (
          <div className="rk-doc-row">
            <div className="rk-doc-label">
              <h3>Aadhaar verification (DigiLocker) <span className="req">*</span></h3>
              <div className="rk-hint">Required because you changed your personal details. A live selfie follows.</div>
            </div>
            {request.verifications?.digilocker ? (
              <span className="rk-upload-done"><Icons.Check /> VERIFIED</span>
            ) : (
              <button className="rk-btn" onClick={verifyDigilocker} disabled={digilockerBusy}>
                {digilockerBusy && <Spinner />} {digilockerBusy ? "Please wait…" : "Verify with DigiLocker"}
              </button>
            )}
          </div>
        )}

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
              <div className="rk-hint">Required because you verified your Aadhaar with DigiLocker. Your face is matched with your Aadhaar photo.</div>
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
        {pending.length > 0 && (
          <div className="rk-alert rk-alert-warn" style={{ marginTop: 18 }}>
            <b>Complete these to continue to Review &amp; eSign:</b>
            <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
              {pending.map((m, i) => <li key={i}>{m.message}</li>)}
            </ul>
          </div>
        )}
      </div>
      <StepFooter step="document" onNext={next} disabled={pending.length > 0} />
      {selfieOpen && (
        <SelfieCapture
          onClose={() => setSelfieOpen(false)}
          onSubmit={(payload) => run("/selfie", payload, { success: "Selfie verified." })}
        />
      )}
    </section>
  );
}
