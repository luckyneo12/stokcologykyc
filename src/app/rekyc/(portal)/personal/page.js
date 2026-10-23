"use client";
import { useState } from "react";
import { usePortal, StepFooter } from "@/components/rekyc/PortalShell";
import { rekycApi } from "@/components/rekyc/clientApi";
import { runDigio } from "@/components/rekyc/digio";
import { Icons, Modal, Field, ErrorText, Spinner } from "@/components/rekyc/ui";

function addressText(a = {}) {
  return [a.line1, a.line2, a.line3, a.city, a.state, a.pincode, a.country].filter((v) => String(v || "").trim()).join(", ");
}

function Detail({ label, value, old, sub, onEdit, onUndo, changed }) {
  return (
    <div className="rk-kv">
      <span className="rk-kv-label">
        {label}
        {onEdit && (
          <button className="rk-edit-btn" onClick={onEdit} aria-label={`Edit ${label}`} title={`Edit ${label}`}>
            <Icons.Edit />
          </button>
        )}
        {changed && <span className="rk-badge rk-badge-changed">Changed</span>}
      </span>
      <span className="rk-kv-value">{value || "-"}</span>
      {changed && old !== undefined && <span className="rk-old">{old || "-"}</span>}
      {sub && <span className="rk-kv-sub">{sub}</span>}
      {changed && onUndo && (
        <button className="rk-link-btn rk-undo" style={{ alignSelf: "flex-start", fontSize: "0.85em" }} onClick={onUndo}>
          Undo change
        </button>
      )}
    </div>
  );
}

export default function PersonalStep() {
  const { request, run, notify } = usePortal();
  const [modal, setModal] = useState(null);
  const profile = request.profile;
  const personal = request.changes.personal || {};

  const undo = async (path) => {
    try {
      await run("/changes/undo", { path }, { success: "Change removed." });
    } catch (e) {
      notify(e.message, "error");
    }
  };

  return (
    <section className="rk-card">
      <div className="rk-card-head">
        <h2>Personal Details</h2>
      </div>
      <div className="rk-card-body">
        {request.rejectionReason && (
          <div className="rk-alert rk-alert-error">
            <b>Your request was sent back for correction:</b> {request.rejectionReason}
          </div>
        )}
        <div className="rk-alert rk-alert-info">Updating e-mail and phone number will take up to 48 hours to reflect in your account post verification.</div>
        <div className="rk-details-grid" style={{ marginTop: 22 }}>
          <Detail label="Name" value={personal.name?.new || profile.name} old={profile.name} changed={!!personal.name} onEdit={() => setModal("name")} onUndo={() => undo("personal.name")} />
          <Detail label="Father's Name / Spouse Name" value={personal.fatherName?.new || profile.fatherName} old={profile.fatherName} changed={!!personal.fatherName} onEdit={() => setModal("fatherName")} onUndo={() => undo("personal.fatherName")} />
          <Detail label="Mother's Name" value={personal.motherName?.new || profile.motherName} old={profile.motherName} changed={!!personal.motherName} onEdit={() => setModal("motherName")} onUndo={() => undo("personal.motherName")} />
          <Detail label="Date of Birth" value={profile.dob} />
          <Detail label="Gender" value={profile.gender} />
          <Detail label="Marital Status" value={profile.maritalStatus} />
          <Detail
            label="E-mail"
            value={personal.email?.new || profile.email}
            old={profile.email}
            sub={`Dependency: ${personal.email?.dependency || profile.emailDependency || "Self"}`}
            changed={!!personal.email}
            onEdit={() => setModal("email")}
            onUndo={() => undo("personal.email")}
          />
          <Detail
            label="Mobile"
            value={personal.mobile?.new ? `+91${personal.mobile.new}` : profile.mobile ? `+91${profile.mobile}` : ""}
            old={profile.mobile ? `+91${profile.mobile}` : ""}
            sub={`Dependency: ${personal.mobile?.dependency || profile.mobileDependency || "Self"}`}
            changed={!!personal.mobile}
            onEdit={() => setModal("mobile")}
            onUndo={() => undo("personal.mobile")}
          />
          <Detail
            label="Address"
            value={addressText(personal.address?.new || profile.address)}
            old={addressText(profile.address)}
            sub={personal.address ? "Verified from Aadhaar (DigiLocker)" : null}
            changed={!!personal.address}
            onEdit={() => setModal("address")}
            onUndo={() => undo("personal.address")}
          />
        </div>
      </div>
      <StepFooter step="personal" />

      {modal === "name" && <NameModal current={personal.name?.new || profile.name} onClose={() => setModal(null)} />}
      {(modal === "fatherName" || modal === "motherName") && (
        <RelativeModal field={modal} current={personal[modal]?.new || profile[modal]} onClose={() => setModal(null)} />
      )}
      {(modal === "email" || modal === "mobile") && <ContactModal type={modal} onClose={() => setModal(null)} />}
      {modal === "address" && <AddressModal onClose={() => setModal(null)} />}
    </section>
  );
}

function NameModal({ current, onClose }) {
  const { run } = usePortal();
  const [name, setName] = useState(current || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await run("/personal/name", { name }, { success: "Name verified with your PAN." });
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Update Name"
      onClose={onClose}
      footer={<><button className="rk-btn rk-btn-ghost" onClick={onClose}>Cancel</button><button className="rk-btn" onClick={save} disabled={busy || name.trim().length < 2}>{busy && <Spinner />} Verify &amp; Save</button></>}
    >
      <div className="rk-alert rk-alert-info">Your name must match the name on your PAN card (Income Tax records). You will need to upload a supporting proof in the Document step.</div>
      <ErrorText>{error}</ErrorText>
      <Field label="Full name as per PAN" id="rk-name">
        <input id="rk-name" className="rk-input" value={name} onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z .']/g, ""))} maxLength={100} />
      </Field>
    </Modal>
  );
}

function RelativeModal({ field, current, onClose }) {
  const { run } = usePortal();
  const [value, setValue] = useState(current || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = field === "fatherName" ? "Father's Name / Spouse Name" : "Mother's Name";
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await run("/personal/relative", { field, value }, { success: `${label} updated.` });
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Update ${label}`}
      onClose={onClose}
      footer={<><button className="rk-btn rk-btn-ghost" onClick={onClose}>Cancel</button><button className="rk-btn" onClick={save} disabled={busy || value.trim().length < 2}>{busy && <Spinner />} Save</button></>}
    >
      <div className="rk-alert rk-alert-info">A supporting proof (e.g. marriage certificate or gazette notification) has to be uploaded in the Document step.</div>
      <ErrorText>{error}</ErrorText>
      <Field label={label} id="rk-relative">
        <input id="rk-relative" className="rk-input" value={value} onChange={(e) => setValue(e.target.value.toUpperCase().replace(/[^A-Z .']/g, ""))} maxLength={100} />
      </Field>
    </Modal>
  );
}

function ContactModal({ type, onClose }) {
  const { request, run } = usePortal();
  const [value, setValue] = useState("");
  const [dependency, setDependency] = useState("Self");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState("enter");
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isMobile = type === "mobile";

  const sendOtp = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await rekycApi("/personal/contact/send-otp", { method: "POST", body: { type, value } });
      setSentTo(data.sentTo?.[0] || value);
      setStage("otp");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    setBusy(true);
    setError("");
    try {
      await run("/personal/contact/verify", { type, value, otp, dependency }, { success: `${isMobile ? "Mobile number" : "E-mail"} verified.` });
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isMobile ? "Update Mobile Number" : "Update E-mail"}
      onClose={onClose}
      footer={
        stage === "enter" ? (
          <><button className="rk-btn rk-btn-ghost" onClick={onClose}>Cancel</button><button className="rk-btn" onClick={sendOtp} disabled={busy || !value}>{busy && <Spinner />} Send OTP</button></>
        ) : (
          <><button className="rk-btn rk-btn-ghost" onClick={() => setStage("enter")}>Back</button><button className="rk-btn" onClick={verify} disabled={busy || otp.length !== 6}>{busy && <Spinner />} Verify</button></>
        )
      }
    >
      <ErrorText>{error}</ErrorText>
      {stage === "enter" ? (
        <>
          <Field label={isMobile ? "New mobile number" : "New e-mail address"} id="rk-contact">
            <input
              id="rk-contact"
              className="rk-input"
              inputMode={isMobile ? "numeric" : "email"}
              value={value}
              onChange={(e) => setValue(isMobile ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value.trim())}
              placeholder={isMobile ? "10-digit mobile number" : "name@example.com"}
            />
          </Field>
          <Field label={`This ${isMobile ? "mobile number" : "e-mail"} belongs to`} id="rk-dependency" hint="As per SEBI rules, only your own or your immediate family's contact details can be registered.">
            <select id="rk-dependency" className="rk-select" value={dependency} onChange={(e) => setDependency(e.target.value)}>
              {request.options.dependency.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
        </>
      ) : (
        <>
          <div className="rk-alert rk-alert-info">Enter the OTP sent to {sentTo}.</div>
          <Field label="OTP" id="rk-contact-otp">
            <input id="rk-contact-otp" className="rk-input rk-otp-input" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          </Field>
          <button className="rk-link-btn" onClick={sendOtp} disabled={busy}>Resend OTP</button>
        </>
      )}
    </Modal>
  );
}

function AddressModal({ onClose }) {
  const { run, notify } = usePortal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      let requestId;
      await runDigio({
        create: async () => {
          const data = await rekycApi("/personal/address/digilocker/start", { method: "POST", body: {} });
          requestId = data.requestId;
          return { requestId: data.requestId, identifier: data.customerIdentifier, accessToken: data.accessToken };
        },
      });
      await run("/personal/address/digilocker/complete", { requestId }, { success: "Address updated from your Aadhaar." });
      notify("Address updated. Please complete the live selfie in the Document step.");
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Update Address"
      onClose={onClose}
      footer={<><button className="rk-btn rk-btn-ghost" onClick={onClose}>Cancel</button><button className="rk-btn" onClick={start} disabled={busy}>{busy && <Spinner />} Continue with DigiLocker</button></>}
    >
      <ErrorText>{error}</ErrorText>
      <p style={{ marginTop: 0 }}>Your address is updated from your <b>Aadhaar via DigiLocker</b>. Please make sure your Aadhaar has your latest address.</p>
      <ul style={{ paddingLeft: 20, margin: "12px 0", color: "var(--rk-muted)" }}>
        <li>Keep your Aadhaar-linked mobile handy for the DigiLocker OTP.</li>
        <li>After DigiLocker, a <b>live selfie</b> is required (Document step).</li>
      </ul>
    </Modal>
  );
}
