"use client";
import { useState } from "react";
import { usePortal, StepFooter } from "@/components/rekyc/PortalShell";
import { ErrorText } from "@/components/rekyc/ui";

export default function SegmentStep() {
  const { request, run } = usePortal();
  const initial = request.changes.segment?.new || request.profile.segments || {};
  const [segments, setSegments] = useState({ NSE_CAP: !!initial.NSE_CAP, NSE_FNO: !!initial.NSE_FNO });
  const [fatca, setFatca] = useState(request.changes.declarations?.fatca ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const original = request.profile.segments || {};
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

  const toggle = (key) => setSegments((s) => ({ ...s, [key]: !s[key] }));

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
            <label className="rk-check"><input type="checkbox" checked={segments.NSE_CAP} onChange={() => toggle("NSE_CAP")} /> CASH</label>
            <label className="rk-check"><input type="checkbox" checked={segments.NSE_FNO} onChange={() => toggle("NSE_FNO")} /> FNO</label>
          </div>
        </div>
        {activatingFno && (
          <div className="rk-alert rk-alert-warn" style={{ marginTop: 14 }}>
            To activate FNO (derivatives) you need to upload a financial proof in the Document step.
          </div>
        )}
        {original.NSE_FNO && !segments.NSE_FNO && (
          <div className="rk-alert rk-alert-warn" style={{ marginTop: 14 }}>FNO will be deactivated. Close any open derivative positions first.</div>
        )}

        <h3 style={{ fontSize: "1em", margin: "26px 0 8px" }}>My sole country of tax residency India</h3>
        <label className="rk-check" style={{ fontSize: "0.9em" }}>
          <input type="checkbox" checked={fatca} onChange={(e) => setFatca(e.target.checked)} />
          <span>
            I have understood the information requirements of this Form (read along with FATCA &amp; CRS Instructions) and hereby confirm that the information provided by me/us on this form is true, correct and complete. I also confirm that I have read and understood the FATCA &amp; terms and conditions below and hereby accept the same. Name for your account will be updated as per the Income Tax database due to Exchange regulations.
          </span>
        </label>
      </div>
      <StepFooter step="segment" onNext={save} busy={busy} disabled={!fatca || (!segments.NSE_CAP && !segments.NSE_FNO)} />
    </section>
  );
}
