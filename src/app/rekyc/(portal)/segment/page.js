"use client";
import { useState } from "react";
import { usePortal, StepFooter } from "@/components/rekyc/PortalShell";
import { ErrorText } from "@/components/rekyc/ui";

export default function SegmentStep() {
  const { request, run } = usePortal();
  const initial = request.changes.segment?.new || request.profile.segments || {};
  const original = request.profile.segments || {};
  // CASH (equity) is always on. FNO can only be added: once active on the account it stays on.
  const fnoLocked = Boolean(original.NSE_FNO);
  const [segments, setSegments] = useState({ NSE_CAP: true, NSE_FNO: fnoLocked || !!initial.NSE_FNO });
  // The declaration starts unticked; it stays ticked once the client has accepted it
  const [fatca, setFatca] = useState(request.changes.declarations?.fatca === true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activatingFno = segments.NSE_FNO && !original.NSE_FNO;

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await run("/segment", { segments, fatca });
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toggleFno = () => setSegments((s) => ({ ...s, NSE_FNO: fnoLocked || !s.NSE_FNO }));

  return (
    <section className="rk-card">
      <div className="rk-card-head">
        <h2>Segment Details</h2>
      </div>
      <div className="rk-card-body">
        <ErrorText>{error}</ErrorText>
        <div className="rk-segment-box">
          <div className="rk-segment-ex">NSE</div>
          <div className="rk-segment-opts">
            <label className="rk-check" title="CASH is always active"><input type="checkbox" checked disabled /> CASH</label>
            <label className="rk-check" title={fnoLocked ? "FNO is already active on your account" : undefined}>
              <input type="checkbox" checked={segments.NSE_FNO} disabled={fnoLocked} onChange={toggleFno} /> FNO
            </label>
          </div>
        </div>
        <p className="rk-hint" style={{ marginTop: 8 }}>
          {fnoLocked ? "CASH and FNO are both active on your account." : "CASH is always active. Tick FNO if you want to trade in derivatives."}
        </p>
        {activatingFno && (
          <div className="rk-alert rk-alert-warn" style={{ marginTop: 14 }}>
            To activate FNO (derivatives) you need to upload a financial proof in the Document step.
          </div>
        )}

        <h3 style={{ fontSize: "1em", margin: "26px 0 8px" }}>My sole country of tax residency India</h3>
        <label className="rk-check" style={{ fontSize: "0.9em" }}>
          <input type="checkbox" checked={fatca} onChange={(e) => setFatca(e.target.checked)} />
          <span>
            I have understood the information requirements of this Form (read along with FATCA &amp; CRS Instructions) and hereby confirm that the information provided by me/us on this form is true, correct and complete. I also confirm that I have read and understood the FATCA &amp; terms and conditions below and hereby accept the same. Name for your account will be updated as per the Income Tax database due to Exchange regulations.
          </span>
        </label>
      </div>
      <StepFooter step="segment" onNext={save} busy={busy} disabled={!fatca} />
    </section>
  );
}
