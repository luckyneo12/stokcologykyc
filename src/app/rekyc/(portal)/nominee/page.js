"use client";
import { useState } from "react";
import { usePortal, StepFooter } from "@/components/rekyc/PortalShell";
import { ErrorText, Field } from "@/components/rekyc/ui";

const RELATIONS = ["Spouse", "Father", "Mother", "Son", "Daughter", "Brother", "Sister", "Other"];
const ID_TYPES = ["PAN", "Aadhaar (last 4 digits)", "Driving Licence", "Passport"];
const EMPTY = { name: "", relation: "", dob: "", share: "", idType: "PAN", idNumber: "", mobile: "", email: "", address: "" };

export default function NomineeStep() {
  const { request, run } = usePortal();
  const saved = request.changes.nominee?.new || request.profile.nominee || { opted: "no", nominees: [] };
  const [opted, setOpted] = useState(saved.opted === "yes" ? "yes" : "no");
  const [nominees, setNominees] = useState(
    saved.opted === "yes" && saved.nominees?.length ? saved.nominees.map((n) => ({ ...EMPTY, ...n, share: String(n.share ?? "") })) : [{ ...EMPTY, share: "100" }]
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const existingNominees = request.profile.nominee?.opted === "yes" && !request.changes.nominee;
  const total = nominees.reduce((s, n) => s + (Number(n.share) || 0), 0);

  const [editing, setEditing] = useState(!existingNominees);
  const update = (i, key, value) => setNominees((list) => list.map((n, idx) => (idx === i ? { ...n, [key]: value } : n)));

  const save = async () => {
    // Existing nominees shown read-only and untouched → nothing to save
    if (existingNominees && opted === "yes" && !editing) return true;
    setBusy(true);
    setError("");
    try {
      await run("/nominee", { opted, nominees: opted === "yes" ? nominees.map((n) => ({ ...n, share: Number(n.share) || 0 })) : [] });
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
        <h2>Nominee Details</h2>
      </div>
      <div className="rk-card-body">
        <ErrorText>{error}</ErrorText>
        <p style={{ margin: "0 0 8px", color: "var(--rk-muted)" }}>Do you want to add nominee</p>
        <div style={{ display: "flex", gap: "clamp(24px, 18vw, 240px)", flexWrap: "wrap", fontSize: "0.85em" }}>
          <label className="rk-check"><input type="checkbox" checked={opted === "yes"} onChange={() => { setOpted("yes"); }} /> YES (OPT IN)</label>
          <label className="rk-check"><input type="checkbox" checked={opted === "no"} onChange={() => { setOpted("no"); setEditing(true); }} /> NO (OPT OUT)</label>
        </div>

        {opted === "no" && (
          <div className="rk-alert rk-alert-info" style={{ marginTop: 18 }}>
            I/We hereby confirm that I/We do not wish to appoint any nominee(s) in my/our trading and demat account and understand the issues involved in non-appointment of nominee(s).
          </div>
        )}

        {opted === "yes" && existingNominees && !editing && (
          <div style={{ marginTop: 18 }}>
            {request.profile.nominee.nominees.map((n, i) => (
              <div className="rk-nominee-card" key={i}>
                <h3>Nominee {i + 1}</h3>
                <div className="rk-grid-3">
                  <div className="rk-kv"><span className="rk-kv-label">Name</span><span className="rk-kv-value">{n.name}</span></div>
                  <div className="rk-kv"><span className="rk-kv-label">Relation</span><span className="rk-kv-value">{n.relation || "-"}</span></div>
                  <div className="rk-kv"><span className="rk-kv-label">Share</span><span className="rk-kv-value">{n.share}%</span></div>
                </div>
              </div>
            ))}
            <button className="rk-btn rk-btn-outline" onClick={() => { setNominees([{ ...EMPTY, share: "100" }]); setEditing(true); }}>Change nominees</button>
          </div>
        )}

        {opted === "yes" && editing && (
          <div style={{ marginTop: 18 }}>
            {nominees.map((n, i) => (
              <div className="rk-nominee-card" key={i}>
                <h3>
                  Nominee {i + 1}
                  {nominees.length > 1 && (
                    <button className="rk-link-btn" style={{ color: "var(--rk-danger)" }} onClick={() => setNominees((l) => l.filter((_, idx) => idx !== i))}>Remove</button>
                  )}
                </h3>
                <div className="rk-grid-3">
                  <Field label="Full name" id={`n${i}-name`}>
                    <input id={`n${i}-name`} className="rk-input" value={n.name} onChange={(e) => update(i, "name", e.target.value.toUpperCase().replace(/[^A-Z .']/g, ""))} />
                  </Field>
                  <Field label="Relationship" id={`n${i}-rel`}>
                    <select id={`n${i}-rel`} className="rk-select" value={n.relation} onChange={(e) => update(i, "relation", e.target.value)}>
                      <option value="">Select</option>
                      {RELATIONS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </Field>
                  <Field label="Date of birth" id={`n${i}-dob`}>
                    <input id={`n${i}-dob`} type="date" className="rk-input" value={n.dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => update(i, "dob", e.target.value)} />
                  </Field>
                  <Field label="ID proof" id={`n${i}-idt`}>
                    <select id={`n${i}-idt`} className="rk-select" value={n.idType} onChange={(e) => update(i, "idType", e.target.value)}>
                      {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="ID number" id={`n${i}-idn`}>
                    <input id={`n${i}-idn`} className="rk-input" value={n.idNumber} onChange={(e) => update(i, "idNumber", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20))} />
                  </Field>
                  <Field label="Share (%)" id={`n${i}-share`}>
                    <input id={`n${i}-share`} className="rk-input" inputMode="numeric" value={n.share} onChange={(e) => update(i, "share", e.target.value.replace(/\D/g, "").slice(0, 3))} />
                  </Field>
                  <Field label="Mobile (optional)" id={`n${i}-mob`}>
                    <input id={`n${i}-mob`} className="rk-input" inputMode="numeric" value={n.mobile} onChange={(e) => update(i, "mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                  </Field>
                  <Field label="E-mail (optional)" id={`n${i}-email`}>
                    <input id={`n${i}-email`} className="rk-input" value={n.email} onChange={(e) => update(i, "email", e.target.value.trim())} />
                  </Field>
                  <Field label="Address (optional)" id={`n${i}-addr`}>
                    <input id={`n${i}-addr`} className="rk-input" value={n.address} onChange={(e) => update(i, "address", e.target.value)} />
                  </Field>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button className="rk-btn rk-btn-outline" disabled={nominees.length >= 3} onClick={() => setNominees((l) => [...l, { ...EMPTY }])}>+ Add another nominee</button>
              <span style={{ fontWeight: 700, color: total === 100 ? "var(--rk-success)" : "var(--rk-danger)" }}>Total share: {total}%</span>
            </div>
          </div>
        )}
      </div>
      <StepFooter step="nominee" onNext={save} busy={busy} disabled={opted === "yes" && editing && total !== 100} />
    </section>
  );
}
