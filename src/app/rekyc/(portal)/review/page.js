"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePortal } from "@/components/rekyc/PortalShell";
import { rekycApi } from "@/components/rekyc/clientApi";
import { runDigio } from "@/components/rekyc/digio";
import { ErrorText, Spinner } from "@/components/rekyc/ui";

export default function ReviewStep() {
  const router = useRouter();
  const { request, setRequest, notify } = usePortal();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { ok, missing } = request.requirements;
  const changes = request.changeList || [];

  const esign = async () => {
    setBusy(true);
    setError("");
    try {
      let documentId;
      await runDigio({
        create: async () => {
          const data = await rekycApi("/esign/start", { method: "POST", body: {} });
          documentId = data.documentId;
          return { requestId: data.documentId, identifier: data.identifier, accessToken: data.accessToken };
        },
      });
      const data = await rekycApi("/esign/complete", { method: "POST", body: { documentId } });
      setRequest(data.request);
      notify("Your request has been submitted.");
      router.replace("/rekyc/status");
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <section className="rk-card">
      <div className="rk-card-head">
        <h2>Review &amp; eSign</h2>
      </div>
      <div className="rk-card-body">
        <ErrorText>{error}</ErrorText>
        {changes.length > 0 ? (
          <div className="rk-review-list">
            <div className="rk-review-item" style={{ fontWeight: 700, border: 0, paddingBottom: 0 }}>
              <span>Section</span><span>Field</span><span>Existing</span><span>New</span>
            </div>
            {changes.map((c, i) => (
              <div className="rk-review-item" key={i}>
                <span className="sec">{c.section}</span>
                <span>{c.field}</span>
                <span className="rk-old" style={{ textDecoration: "none" }}>{c.oldValue || "-"}</span>
                <span style={{ fontWeight: 600 }}>{c.newValue || "-"}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rk-alert rk-alert-info">You have not changed anything yet. Use the pencil icons in the steps to update your details.</div>
        )}

        {!ok && (
          <div className="rk-alert rk-alert-warn" style={{ marginTop: 18 }}>
            <b>Complete these before signing:</b>
            <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
              {missing.map((m, i) => (
                <li key={i}>
                  {m.message} <Link href={`/rekyc/${m.step}`}>Go to {m.step}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ok && (
          <>
            <label className="rk-check" style={{ marginTop: 20, fontSize: "0.92em" }}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>I confirm the above changes are correct and request Stockology Securities Pvt. Ltd. to update my account. I will sign the modification form with my Aadhaar eSign (OTP on my Aadhaar-linked mobile).</span>
            </label>
            <p className="rk-hint" style={{ marginTop: 10 }}>The form includes your e-stamp paper. After signing, your request goes for verification and you will be informed by e-mail.</p>
          </>
        )}
      </div>
      <div className="rk-card-foot">
        <button className="rk-btn rk-btn-outline" onClick={() => router.push("/rekyc/document")} style={{ minWidth: 132 }}>Previous</button>
        <button className="rk-btn" onClick={esign} disabled={!ok || !agree || busy} style={{ minWidth: 170 }}>
          {busy && <Spinner />} {busy ? "Please wait…" : "Proceed to eSign"}
        </button>
      </div>
    </section>
  );
}
