"use client";
import { usePortal } from "@/components/rekyc/PortalShell";
import { downloadSignedForm } from "@/components/rekyc/clientApi";
import { Icons } from "@/components/rekyc/ui";

const STATUS_TEXT = {
  esigned: { title: "Request submitted", text: "Your modification request has been signed and submitted. Our team is verifying it.", Icon: Icons.Clock },
  to_be_verified: { title: "Under verification", text: "Your modification request is being verified. You will receive an e-mail once it is approved.", Icon: Icons.Clock },
  completed: { title: "Request approved", text: "Your account details have been updated. Changes to e-mail and mobile number may take up to 48 hours to reflect.", Icon: Icons.Done },
};

export default function RekycStatus() {
  const { request, notify } = usePortal();
  const info = STATUS_TEXT[request.status] || STATUS_TEXT.esigned;

  return (
    <section className="rk-card">
      <div className="rk-status-screen">
        <div className="rk-status-icon"><info.Icon /></div>
        <h2>{info.title}</h2>
        <p style={{ color: "var(--rk-muted)", maxWidth: 560, margin: "0 auto 16px" }}>{info.text}</p>
        <p style={{ fontSize: "0.9em" }}>Request ID: <b>{request.requestId}</b></p>
        {(request.changeList || []).length > 0 && (
          <div className="rk-review-list" style={{ maxWidth: 820, margin: "22px auto", textAlign: "left" }}>
            {request.changeList.map((c, i) => (
              <div className="rk-review-item" key={i}>
                <span className="sec">{c.section}</span>
                <span>{c.field}</span>
                <span className="rk-old" style={{ textDecoration: "none" }}>{c.oldValue || "-"}</span>
                <span style={{ fontWeight: 600 }}>{c.newValue || "-"}</span>
              </div>
            ))}
          </div>
        )}
        {request.esign?.status === "signed" && (
          <button className="rk-btn rk-btn-outline" onClick={() => downloadSignedForm().catch((e) => notify(e.message, "error"))}>
            Download signed form
          </button>
        )}
      </div>
    </section>
  );
}
