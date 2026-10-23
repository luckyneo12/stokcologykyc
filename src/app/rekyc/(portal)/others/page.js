"use client";
import { useState } from "react";
import { usePortal, StepFooter } from "@/components/rekyc/PortalShell";
import { ErrorText, Field } from "@/components/rekyc/ui";

export default function OthersStep() {
  const { request, run } = usePortal();
  const others = request.changes.others || {};
  const [annualIncome, setAnnualIncome] = useState(others.annualIncome?.new || request.profile.annualIncome || "");
  const [netWorth, setNetWorth] = useState(others.netWorth?.new || request.profile.netWorth || "");
  const [ecn, setEcn] = useState(request.changes.declarations?.ecn ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await run("/others", { annualIncome, netWorth, ecn });
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rk-card">
      <div className="rk-card-head">
        <h2>Other Details</h2>
      </div>
      <div className="rk-card-body">
        <ErrorText>{error}</ErrorText>
        <div className="rk-grid-2" style={{ maxWidth: 1040 }}>
          <Field label="Annual Income as on date *" id="rk-income">
            <select id="rk-income" className="rk-select" value={annualIncome} onChange={(e) => setAnnualIncome(e.target.value)}>
              <option value="">Select</option>
              {request.options.annualIncome.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Networth" id="rk-networth" hint="In rupees (optional)">
            <input id="rk-networth" className="rk-input" inputMode="numeric" value={netWorth} onChange={(e) => setNetWorth(e.target.value.replace(/\D/g, "").slice(0, 15))} />
          </Field>
        </div>
        <label className="rk-check" style={{ fontSize: "0.88em", marginTop: 8 }}>
          <input type="checkbox" checked={ecn} onChange={(e) => setEcn(e.target.checked)} />
          <span>I wish to receive Electronic Contract Note, Transaction Statement, Ledger, Communication, Information, Intimation, Annual Report from RTA, CAS statement, etc. through SMS/Email on my registered contact details.</span>
        </label>
      </div>
      <StepFooter step="others" onNext={save} busy={busy} disabled={!annualIncome || !ecn} />
    </section>
  );
}
