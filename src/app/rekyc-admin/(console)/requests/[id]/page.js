"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { adminApi, adminFile } from "@/components/rekyc/adminApi";
import { useAdmin, AdminModal, formatDateTime } from "@/components/rekyc/AdminShell";

const FILES = [
  ["signedPdf", "Signed modification form"],
  ["formPdf", "Unsigned form"],
  ["financialProof", "Financial proof"],
  ["nameProof", "Name change proof"],
  ["selfie", "Live selfie"],
  ["aadhaarPhoto", "Aadhaar photo (DigiLocker)"],
];

const ACTION_LABELS = {
  login: "Client logged in",
  name_changed: "Name changed (PAN verified)",
  name_pan_check_failed: "Name failed PAN check",
  fatherName_changed: "Father's / spouse name changed",
  motherName_changed: "Mother's name changed",
  mobile_changed: "Mobile changed (OTP verified)",
  email_changed: "E-mail changed (OTP verified)",
  digilocker_started: "DigiLocker started",
  address_changed_digilocker: "Address updated from DigiLocker",
  digilocker_dob_mismatch: "DigiLocker DOB mismatch",
  bank_added: "Bank added (penny drop verified)",
  bank_penny_drop_failed: "Penny drop failed",
  bank_name_mismatch: "Bank name mismatch",
  bank_removed: "Bank marked for removal",
  bank_restored: "Bank removal undone",
  bank_default_changed: "Default bank changed",
  segment_changed: "Segments changed",
  nominee_changed: "Nominee changed",
  others_changed: "Income / net worth changed",
  document_uploaded: "Document uploaded",
  document_removed: "Document removed",
  selfie_passed: "Selfie verified",
  selfie_liveness_failed: "Selfie liveness failed",
  selfie_face_match_failed: "Selfie face match failed",
  esign_started: "eSign started",
  esign_aadhaar_mismatch: "eSign Aadhaar mismatch",
  esigned: "Form eSigned",
  change_undone: "Change undone",
  maker_approved: "Approved by maker",
  checker_approved: "Approved by checker · back office updated",
  backoffice_push_failed: "Back office update failed",
  rejected: "Rejected",
  trashed: "Moved to trash",
  restored: "Restored from trash",
};

function Check({ label, ok, children }) {
  return (
    <div className="ra-check-row">
      <span>{label}</span>
      <span className={ok === true ? "ra-ok" : ok === false ? "ra-bad" : ""} style={{ textAlign: "right" }}>{children}</span>
    </div>
  );
}

export default function RekycRequestDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { user, can, notify, refreshCounts } = useAdmin();
  const [request, setRequest] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [modal, setModal] = useState(null);
  const [remarks, setRemarks] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await adminApi(`/requests/${id}`);
      setRequest(data.request);
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (path, body, success) => {
    setBusy(path);
    try {
      await adminApi(`/requests/${id}/${path}`, { method: "POST", body });
      notify(success);
      setModal(null);
      setRemarks("");
      await load();
      refreshCounts();
    } catch (e) {
      notify(e.message, "error");
      await load();
    } finally {
      setBusy("");
    }
  };

  const openFile = async (kind) => {
    try {
      await adminFile(`/requests/${id}/files/${kind}`);
    } catch (e) {
      notify(e.message, "error");
    }
  };

  if (error) return <div className="ra-alert ra-alert-error">{error}</div>;
  if (!request) return <span className="ra-spinner" />;

  const r = request;
  const p = r.profile || {};
  const v = r.verifications || {};
  const isMaker = r.status === "esigned" && can("request.maker");
  const isChecker = r.status === "to_be_verified" && can("request.checker");
  const sameAsMaker = r.maker?.id === user.id;
  const addedBanks = r.changes?.bank?.added || [];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <button className="ra-btn ra-btn-ghost ra-btn-sm" onClick={() => router.back()} style={{ marginBottom: 10 }}>← Back</button>
          <h1 style={{ margin: 0 }}>
            {r.clientCode} · {p.name || r.name} <span className={`ra-pill ra-pill-${r.status}`} style={{ verticalAlign: "middle" }}>{r.statusLabel}</span>
          </h1>
          <div className="ra-hint ra-mono" style={{ marginTop: 4 }}>Request {r.id} · Created {formatDateTime(r.createdAt)} · eSigned {formatDateTime(r.esignedAt)}</div>
        </div>
        <div className="ra-actions">
          {isMaker && (
            <>
              <button className="ra-btn ra-btn-success" onClick={() => setModal("maker")} disabled={!!busy}>Approve (Maker)</button>
              <button className="ra-btn ra-btn-danger" onClick={() => setModal("reject")} disabled={!!busy}>Reject</button>
            </>
          )}
          {isChecker && (
            <>
              <button className="ra-btn ra-btn-success" onClick={() => setModal("checker")} disabled={!!busy || sameAsMaker} title={sameAsMaker ? "You verified this as maker — another person must approve." : ""}>
                Approve &amp; Update Back Office
              </button>
              <button className="ra-btn ra-btn-danger" onClick={() => setModal("reject")} disabled={!!busy}>Reject</button>
            </>
          )}
          {can("request.trash") && r.status !== "trashed" && r.status !== "completed" && (
            <button className="ra-btn ra-btn-ghost" onClick={() => act("trash", {}, "Moved to trash.")} disabled={!!busy}>Move to Trash</button>
          )}
          {can("request.trash") && r.status === "trashed" && (
            <button className="ra-btn ra-btn-outline" onClick={() => act("restore", {}, "Request restored.")} disabled={!!busy}>Restore</button>
          )}
        </div>
      </div>

      {isChecker && sameAsMaker && <div className="ra-alert ra-alert-warn">You approved this request as the maker. A different checker must give the final approval.</div>}
      {r.backoffice?.status === "failed" && (
        <div className="ra-alert ra-alert-error">
          <b>Back office update failed</b> — the request is still waiting for the checker. Details: <span className="ra-mono">{JSON.stringify(r.backoffice.response?.error || r.backoffice.response).slice(0, 400)}</span>
        </div>
      )}
      {r.rejection && <div className="ra-alert ra-alert-warn"><b>Rejected by {r.rejection.by}</b> on {formatDateTime(r.rejection.at)}: {r.rejection.reason}</div>}
      {r.status === "in_progress" && !r.requirements?.ok && (
        <div className="ra-alert ra-alert-info">The client has not finished yet: {r.requirements.missing.map((m) => m.message).join(" · ")}</div>
      )}

      <div className="ra-detail-grid">
        <div>
          <section className="ra-panel">
            <h2>Requested changes ({r.changeList.length})</h2>
            {r.changeList.length ? (
              <div className="ra-table-wrap">
                <table className="ra-table ra-diff" style={{ minWidth: 640 }}>
                  <thead><tr><th>Section</th><th>Field</th><th>Existing (back office)</th><th>New</th></tr></thead>
                  <tbody>
                    {r.changeList.map((c, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{c.section}</td>
                        <td>{c.field}</td>
                        <td className="old">{c.oldValue || "-"}</td>
                        <td className="new">{c.newValue || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ra-hint">No changes yet.</p>
            )}
            {r.changes?.nominee?.new?.opted === "yes" && (
              <div style={{ marginTop: 14 }}>
                <h2 style={{ fontSize: "1em" }}>New nominees</h2>
                <div className="ra-table-wrap">
                  <table className="ra-table" style={{ minWidth: 640 }}>
                    <thead><tr><th>Name</th><th>Relation</th><th>DOB</th><th>ID</th><th>Share</th><th>Mobile / E-mail</th></tr></thead>
                    <tbody>
                      {r.changes.nominee.new.nominees.map((n, i) => (
                        <tr key={i}><td>{n.name}</td><td>{n.relation}</td><td>{n.dob}</td><td>{n.idType}: {n.idNumber}</td><td>{n.share}%</td><td>{[n.mobile, n.email].filter(Boolean).join(" / ") || "-"}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className="ra-panel">
            <h2>Client record (back office, at login)</h2>
            <div className="ra-kv-grid">
              {[
                ["Client code", p.clientCode], ["Name", p.name], ["PAN", p.pan], ["CKYC No.", p.ckycNo], ["DOB", p.dob], ["Gender", p.gender],
                ["Marital status", p.maritalStatus], ["Father / spouse", p.fatherName], ["Mother", p.motherName], ["Mobile", p.mobile], ["E-mail", p.email],
                ["Annual income", p.annualIncome], ["Net worth", p.netWorth], ["Aadhaar (last 4)", p.aadhaarLast4 ? `XXXX ${p.aadhaarLast4}` : "-"], ["Account status", p.accountStatus],
              ].map(([k, val]) => (
                <div className="ra-kv" key={k}><span>{k}</span><span>{val || "-"}</span></div>
              ))}
            </div>
            <div className="ra-kv" style={{ marginTop: 12 }}>
              <span>Address</span>
              <span>{[p.address?.line1, p.address?.line2, p.address?.line3, p.address?.city, p.address?.state, p.address?.pincode].filter(Boolean).join(", ") || "-"}</span>
            </div>
            <div className="ra-kv" style={{ marginTop: 12 }}>
              <span>Bank accounts</span>
              <span>{(p.banks || []).map((b) => `${b.bankName} ${b.accountNumber} (${b.ifsc})${b.isDefault ? " · default" : ""}`).join("  |  ") || "-"}</span>
            </div>
          </section>

          <section className="ra-panel">
            <h2>Activity</h2>
            <ul className="ra-timeline">
              {r.auditLog.map((l, i) => (
                <li key={i}>
                  <b>{ACTION_LABELS[l.action] || l.action}</b>
                  <span className="ra-hint"> · {l.actor_type === "admin" ? l.actor_name : l.actor_type} · {formatDateTime(l.created_at)}</span>
                  {l.details?.remarks && <div className="ra-hint">Remarks: {l.details.remarks}</div>}
                  {l.details?.reason && <div className="ra-hint">Reason: {l.details.reason}</div>}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div>
          <section className="ra-panel">
            <h2>Verifications</h2>
            {r.changes?.personal?.name && (
              <Check label="New name vs PAN (Income Tax)" ok={v.panName?.passed}>{v.panName?.passed ? `Matched (${v.panName.name})` : "Not verified"}</Check>
            )}
            {r.changes?.personal?.mobile && <Check label="New mobile OTP" ok>Verified · {r.changes.personal.mobile.dependency}</Check>}
            {r.changes?.personal?.email && <Check label="New e-mail OTP" ok>Verified · {r.changes.personal.email.dependency}</Check>}
            {v.digilocker?.completedAt && (
              <>
                <Check label="DigiLocker Aadhaar" ok>{v.digilocker.aadhaar || "Fetched"}</Check>
                <Check label="Aadhaar name vs client name" ok={v.digilocker.nameMatch >= 80 ? true : false}>{v.digilocker.nameMatch}% ({v.digilocker.name || "-"})</Check>
                <Check label="Aadhaar DOB vs client DOB" ok={v.digilocker.dobMatch === true ? true : v.digilocker.dobMatch === false ? false : undefined}>
                  {v.digilocker.dobMatch === true ? "Matched" : v.digilocker.dobMatch === false ? "Mismatch" : "Not available"}
                </Check>
              </>
            )}
            {r.selfie && (
              <>
                <Check label="Selfie liveness" ok={r.selfie.status === "passed"}>{r.selfie.livenessScore != null ? `${r.selfie.livenessScore}%` : "Passed"}</Check>
                <Check label="Selfie vs Aadhaar photo" ok={r.selfie.faceMatchSkipped ? undefined : true}>{r.selfie.faceMatchSkipped ? "No Aadhaar photo — check manually" : `${r.selfie.faceMatchScore ?? "-"}%`}</Check>
                {r.selfie.location && (
                  <Check label="Selfie location">
                    <a href={`https://www.google.com/maps?q=${r.selfie.location.lat},${r.selfie.location.lng}`} target="_blank" rel="noopener noreferrer">
                      {Number(r.selfie.location.lat).toFixed(4)}, {Number(r.selfie.location.lng).toFixed(4)}
                    </a>
                  </Check>
                )}
              </>
            )}
            {addedBanks.map((b) => (
              <Check key={b.accountNumber} label={`Penny drop ${b.accountNumber}`} ok>{b.holderName} · {b.nameMatchScore}%</Check>
            ))}
            {r.esign?.status && (
              <Check label="Aadhaar eSign" ok={r.esign.status === "signed"}>
                {r.esign.status === "signed"
                  ? `Signed ${r.esign.signer?.signerName ? `by ${r.esign.signer.signerName}` : ""} ${r.esign.signer?.signedSuffix ? `(Aadhaar ••${r.esign.signer.signedSuffix}${r.esign.signer.status === "matched" ? ", matched" : ""})` : ""}`
                  : r.esign.status}
              </Check>
            )}
            {r.estamp && <Check label="E-stamp">{r.estamp.certificate_no || r.estamp.serial_no}</Check>}
            {!r.changeList.length && <p className="ra-hint">Nothing to verify yet.</p>}
          </section>

          <section className="ra-panel">
            <h2>Documents</h2>
            <div className="ra-file-list">
              {FILES.filter(([k]) => r.files[k]).map(([k, label]) => (
                <button key={k} className="ra-btn ra-btn-outline ra-btn-sm" onClick={() => openFile(k)}>{label}</button>
              ))}
              {!FILES.some(([k]) => r.files[k]) && <span className="ra-hint">No documents yet.</span>}
            </div>
            {r.documents?.financialProof && <div className="ra-hint" style={{ marginTop: 8 }}>Financial proof: {r.documents.financialProof.type}</div>}
            {r.documents?.nameProof && <div className="ra-hint">Name proof: {r.documents.nameProof.type}</div>}
          </section>

          <section className="ra-panel">
            <h2>Review</h2>
            <Check label="Maker">{r.maker?.name ? `${r.maker.name} · ${formatDateTime(r.maker.at)}` : "-"}</Check>
            {r.maker?.remarks && <div className="ra-hint">“{r.maker.remarks}”</div>}
            <Check label="Checker">{r.checker?.name ? `${r.checker.name} · ${formatDateTime(r.checker.at)}` : "-"}</Check>
            {r.checker?.remarks && <div className="ra-hint">“{r.checker.remarks}”</div>}
            <Check label="Back office" ok={r.backoffice?.status === "success" ? true : r.backoffice?.status === "failed" ? false : undefined}>
              {r.backoffice?.status ? `${r.backoffice.status} ${r.backoffice.pushedAt ? `· ${formatDateTime(r.backoffice.pushedAt)}` : ""}` : "Not sent"}
            </Check>
          </section>
          <p className="ra-hint" style={{ marginTop: 10 }}><Link href="/rekyc-admin/dashboard">Back to dashboard</Link></p>
        </div>
      </div>

      {(modal === "maker" || modal === "checker") && (
        <AdminModal
          title={modal === "maker" ? "Approve as Maker" : "Final Approval (Checker)"}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="ra-btn ra-btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="ra-btn ra-btn-success" disabled={!!busy} onClick={() => act(modal === "maker" ? "maker-approve" : "checker-approve", { remarks }, modal === "maker" ? "Sent to the checker." : "Approved and updated in the back office.")}>
                {busy && <span className="ra-spinner" />} Approve
              </button>
            </>
          }
        >
          <p style={{ marginTop: 0 }}>
            {modal === "maker"
              ? "Confirm that you checked the changes, verifications and documents. The request goes to a checker for final approval."
              : "The changes will be sent to the back office now. The request is completed only if the back office accepts them."}
          </p>
          <div className="ra-field">
            <label htmlFor="ra-remarks">Remarks (optional)</label>
            <textarea id="ra-remarks" className="ra-textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={1000} />
          </div>
        </AdminModal>
      )}
      {modal === "reject" && (
        <AdminModal
          title="Reject Request"
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="ra-btn ra-btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="ra-btn ra-btn-danger" disabled={!!busy || remarks.trim().length < 5} onClick={() => act("reject", { reason: remarks }, "Request rejected. The client has been informed.")}>
                {busy && <span className="ra-spinner" />} Reject
              </button>
            </>
          }
        >
          <p style={{ marginTop: 0 }}>The client will see this reason, correct the request and sign it again.</p>
          <div className="ra-field">
            <label htmlFor="ra-reason">Reason *</label>
            <textarea id="ra-reason" className="ra-textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={1000} placeholder="e.g. Name change proof is not clear. Please upload a clear copy of the gazette notification." />
          </div>
        </AdminModal>
      )}
    </>
  );
}
