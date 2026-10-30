"use client";
import { useRef, useState } from "react";
import { usePortal, StepFooter } from "@/components/rekyc/PortalShell";
import { rekycApi } from "@/components/rekyc/clientApi";
import { ErrorText, Field, Icons, Spinner } from "@/components/rekyc/ui";

// Same nominee form as the onboarding portal's nominee step
const RELATIONS = ["Brother", "Daughter", "Father", "Nephew", "Grand-father", "Grand-mother", "Cousin", "Mother", "Son", "Sister", "Spouse", "Friend", "Uncle", "Aunty"];
// Only one nominee can have one of these relations
const UNIQUE_RELATIONS = ["Mother", "Father", "Grand-father", "Grand-mother"];
const PROOF_TYPES = ["PAN CARD", "AADHAAR CARD"];
const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];
const PERSON = { name: "", relation: "", dob: "", mobile: "", email: "", sameAddress: false, address: "", city: "", state: "", pincode: "", country: "India", proofType: "PAN CARD", proofNumber: "", proofUrl: "", proofName: "" };
const GUARDIAN = Object.fromEntries(Object.entries(PERSON).map(([k, v]) => [`guardian${k.charAt(0).toUpperCase()}${k.slice(1)}`, v]));
const EMPTY = { ...PERSON, ...GUARDIAN, share: "" };
const MAX_NOMINEES = 3;
const MAX_FILE = 5 * 1024 * 1024;

const keyOf = (prefix, k) => (prefix ? `${prefix}${k.charAt(0).toUpperCase()}${k.slice(1)}` : k);
const today = () => new Date().toISOString().slice(0, 10);

function ageOf(dob) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob || "")) return null;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

const toForm = (n) => ({
  ...EMPTY,
  ...n,
  proofType: n.proofType || (String(n.idType || "").startsWith("Aadhaar") ? "AADHAAR CARD" : "PAN CARD"),
  proofNumber: n.proofNumber || n.idNumber || "",
  share: n.share === undefined || n.share === null ? "" : String(n.share),
});

// Shares: the last nominee always gets what is left, so the total is always 100%
function withRemainder(list) {
  if (!list.length) return list;
  const others = list.slice(0, -1).reduce((s, n) => s + (Number(n.share) || 0), 0);
  return list.map((n, i) => (i === list.length - 1 ? { ...n, share: String(Math.max(0, 100 - others)) } : n));
}
function splitEqually(list) {
  const base = Math.floor(100 / list.length);
  return list.map((n, i) => ({ ...n, share: String(i === 0 ? 100 - base * (list.length - 1) : base) }));
}
function normalizeShares(list) {
  const others = list.slice(0, -1).reduce((s, n) => s + (Number(n.share) || 0), 0);
  return others >= 100 || list.slice(0, -1).some((n) => !Number(n.share)) ? splitEqually(list) : withRemainder(list);
}

function PersonFields({ n, i, prefix, label, onChange, onPincode, onUpload, uploading, relationOptions, knownIds, requireEmail }) {
  const v = (k) => n[keyOf(prefix, k)];
  const set = (k, value) => onChange(i, keyOf(prefix, k), value);
  const id = (k) => `n${i}-${prefix || "nom"}-${k}`;
  const fileRef = useRef(null);
  const same = v("sameAddress");
  const onRecord = knownIds.has(String(v("proofNumber") || "").toUpperCase());
  const proofLabel = v("proofType") === "PAN CARD" ? "PAN card" : "Aadhaar card";

  return (
    <>
      <div className="rk-grid-3">
        <Field label={`${label} name *`} id={id("name")}>
          <input id={id("name")} className="rk-input" value={v("name")} maxLength={100} onChange={(e) => set("name", e.target.value.toUpperCase().replace(/[^A-Z .']/g, ""))} />
        </Field>
        <Field label="Relation *" id={id("rel")}>
          <select id={id("rel")} className="rk-select" value={v("relation")} onChange={(e) => set("relation", e.target.value)}>
            <option value="">Choose relation</option>
            {relationOptions.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Date of birth *" id={id("dob")}>
          <input id={id("dob")} type="date" className="rk-input" value={v("dob")} max={today()} onChange={(e) => set("dob", e.target.value)} />
        </Field>
        <Field label="Mobile *" id={id("mob")}>
          <input id={id("mob")} className="rk-input" inputMode="numeric" value={v("mobile")} onChange={(e) => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} />
        </Field>
        <Field label={requireEmail ? "E-mail *" : "E-mail (optional)"} id={id("email")}>
          <input id={id("email")} type="email" className="rk-input" value={v("email")} onChange={(e) => set("email", e.target.value.trim())} />
        </Field>
      </div>

      <label className="rk-check" style={{ margin: "4px 0 12px", fontSize: "0.9em" }}>
        <input type="checkbox" checked={Boolean(same)} onChange={(e) => set("sameAddress", e.target.checked)} />
        <span>Address same as mine</span>
      </label>
      <div className="rk-grid-3">
        <Field label="Address *" id={id("addr")}>
          <input id={id("addr")} className="rk-input" value={v("address")} disabled={same} maxLength={300} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="Pincode *" id={id("pin")}>
          <input id={id("pin")} className="rk-input" inputMode="numeric" value={v("pincode")} disabled={same} onChange={(e) => onPincode(i, prefix, e.target.value.replace(/\D/g, "").slice(0, 6))} />
        </Field>
        <Field label="City *" id={id("city")}>
          <input id={id("city")} className="rk-input" value={v("city")} disabled={same} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="State *" id={id("state")}>
          <input id={id("state")} className="rk-input" list="rk-states" value={v("state")} disabled={same} onChange={(e) => set("state", e.target.value)} />
        </Field>
        <Field label="Country" id={id("country")}>
          <input id={id("country")} className="rk-input" value="India" disabled />
        </Field>
      </div>

      <div className="rk-grid-3">
        <Field label="ID proof *" id={id("pt")}>
          <select id={id("pt")} className="rk-select" value={v("proofType")} onChange={(e) => set("proofType", e.target.value)}>
            {PROOF_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label={v("proofType") === "PAN CARD" ? "PAN number *" : "Aadhaar (last 4 digits) *"} id={id("pn")}>
          <input
            id={id("pn")}
            className="rk-input"
            inputMode={v("proofType") === "PAN CARD" ? "text" : "numeric"}
            value={v("proofNumber")}
            onChange={(e) => set("proofNumber", v("proofType") === "PAN CARD" ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) : e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </Field>
        <Field
          label={`${proofLabel} copy ${onRecord ? "(optional)" : "*"}`}
          hint={onRecord ? "Already on record — upload only to replace it." : v("proofType") === "AADHAAR CARD" ? "PDF, JPG or PNG, less than 5MB. The Aadhaar number is masked automatically." : "PDF, JPG or PNG, less than 5MB."}
        >
          <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" hidden onChange={(e) => { onUpload(i, prefix, e.target.files?.[0]); e.target.value = ""; }} />
          {v("proofUrl") ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minHeight: 44 }}>
              <span className="rk-upload-done"><Icons.Check /> UPLOADED</span>
              <button className="rk-btn rk-btn-outline rk-btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>Replace</button>
            </div>
          ) : (
            <button className="rk-btn rk-btn-outline" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: "100%" }}>
              {uploading ? <Spinner /> : null} {uploading ? "Uploading…" : `Upload ${proofLabel}`}
            </button>
          )}
        </Field>
      </div>
    </>
  );
}

export default function NomineeStep() {
  const { request, run, notify } = usePortal();
  const profileNominee = request.profile.nominee || { opted: "no", nominees: [] };
  const recordNominees = profileNominee.opted === "yes" ? profileNominee.nominees || [] : [];
  const saved = request.changes.nominee?.new;
  const existingNominees = recordNominees.length > 0 && !request.changes.nominee;

  const [opted, setOpted] = useState((saved || profileNominee).opted === "yes" ? "yes" : "no");
  const [nominees, setNominees] = useState(() => {
    if (saved?.opted === "yes" && saved.nominees?.length) return saved.nominees.map(toForm);
    // The nominees on record are the starting point for an edit (never an empty form)
    if (recordNominees.length) return normalizeShares(recordNominees.map(toForm));
    return [{ ...EMPTY, share: "100" }];
  });
  const [editing, setEditing] = useState(!existingNominees);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");
  const topRef = useRef(null);

  // IDs the back office already holds: those nominees need no new proof copy
  const knownIds = new Set(recordNominees.flatMap((n) => [n.proofNumber, n.guardianProofNumber]).filter(Boolean).map((v) => String(v).toUpperCase()));
  const myAddress = request.changes.personal?.address?.new || request.profile.address || {};
  const total = nominees.reduce((s, n) => s + (Number(n.share) || 0), 0);

  const showError = (message) => {
    setError(message);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const update = (i, key, value) =>
    setNominees((list) => {
      const next = list.map((n, idx) => {
        if (idx !== i) return n;
        const changed = { ...n, [key]: value };
        // Same as onboarding: a different ID proof type needs a new number and copy
        if (key.endsWith("roofType")) {
          const prefix = key === "proofType" ? "" : "guardian";
          changed[keyOf(prefix, "proofNumber")] = "";
          changed[keyOf(prefix, "proofUrl")] = "";
          changed[keyOf(prefix, "proofName")] = "";
        }
        if (key.endsWith("ameAddress") && value) {
          const prefix = key === "sameAddress" ? "" : "guardian";
          Object.assign(changed, {
            [keyOf(prefix, "address")]: [myAddress.line1, myAddress.line2, myAddress.line3].filter(Boolean).join(", "),
            [keyOf(prefix, "city")]: myAddress.city || myAddress.district || "",
            [keyOf(prefix, "state")]: myAddress.state || "",
            [keyOf(prefix, "pincode")]: myAddress.pincode || "",
            [keyOf(prefix, "country")]: "India",
          });
        }
        return changed;
      });
      return key === "share" ? withRemainder(next) : next;
    });

  const changeShare = (i, raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 3);
    // Every other nominee keeps at least 1%: the last one takes the rest
    const othersBefore = nominees.slice(0, -1).reduce((s, n, idx) => s + (idx === i ? 0 : Number(n.share) || 0), 0);
    const max = 100 - othersBefore - 1;
    const value = digits === "" ? "" : String(Math.min(Number(digits), Math.max(max, 1)));
    update(i, "share", value);
  };

  const lookupPincode = async (i, prefix, pin) => {
    update(i, keyOf(prefix, "pincode"), pin);
    if (pin.length !== 6) return;
    try {
      const data = await rekycApi(`/pincode/${pin}`);
      if (data.city) update(i, keyOf(prefix, "city"), data.city);
      if (data.state) update(i, keyOf(prefix, "state"), data.state);
    } catch (e) {
      // Unknown pincode: the city and state are typed in
    }
  };

  const uploadProof = async (i, prefix, file) => {
    if (!file) return;
    if (file.size > MAX_FILE) return notify("File should be less than 5MB.", "error");
    const proofType = nominees[i][keyOf(prefix, "proofType")];
    const form = new FormData();
    form.append("proofType", proofType);
    form.append("file", file);
    setUploading(`${i}-${prefix}`);
    try {
      const data = await rekycApi("/nominee/proof", { method: "POST", formData: form });
      update(i, keyOf(prefix, "proofUrl"), data.url);
      update(i, keyOf(prefix, "proofName"), data.name || file.name);
      notify(proofType === "AADHAAR CARD" ? "Aadhaar card masked and uploaded." : "PAN card uploaded.");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setUploading("");
    }
  };

  const addNominee = () => setNominees((list) => (list.length >= MAX_NOMINEES ? list : splitEqually([...list, { ...EMPTY }])));
  const removeNominee = (i) => setNominees((list) => splitEqually(list.filter((_, idx) => idx !== i)));

  const startEditing = () => {
    setNominees(normalizeShares(recordNominees.map(toForm)));
    setError("");
    setEditing(true);
  };
  const cancelEditing = () => {
    setEditing(false);
    setOpted("yes");
    setError("");
  };
  const undoChange = async () => {
    setBusy(true);
    try {
      await run("/changes/undo", { path: "nominee" }, { success: "Nominee change removed." });
      setOpted(profileNominee.opted === "yes" ? "yes" : "no");
      setNominees(recordNominees.length ? normalizeShares(recordNominees.map(toForm)) : [{ ...EMPTY, share: "100" }]);
      setEditing(!recordNominees.length);
      setError("");
    } catch (e) {
      showError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const relationOptions = (i) => {
    const takenByOthers = nominees.filter((_, idx) => idx !== i).map((n) => n.relation);
    return RELATIONS.filter((r) => !UNIQUE_RELATIONS.includes(r) || !takenByOthers.includes(r) || nominees[i].relation === r);
  };

  const save = async () => {
    // Existing nominees shown read-only and untouched → nothing to save
    if (existingNominees && opted === "yes" && !editing) return true;
    if (opted === "yes") {
      if (nominees.some((n) => !(Number(n.share) >= 1))) {
        showError("Every nominee needs a share of at least 1%.");
        return false;
      }
      if (total !== 100) {
        showError(`Nominee shares must add up to 100% (now ${total}%).`);
        return false;
      }
    }
    setBusy(true);
    setError("");
    try {
      await run("/nominee", { opted, nominees: opted === "yes" ? nominees.map((n) => ({ ...n, share: Number(n.share) || 0 })) : [] });
      return true;
    } catch (e) {
      showError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rk-card" ref={topRef}>
      <div className="rk-card-head">
        <h2>Nominee Details</h2>
        {request.changes.nominee && (
          <button className="rk-link-btn" onClick={undoChange} disabled={busy}>Undo nominee change</button>
        )}
      </div>
      <div className="rk-card-body">
        <ErrorText>{error}</ErrorText>
        <datalist id="rk-states">{STATES.map((s) => <option key={s} value={s} />)}</datalist>
        <p style={{ margin: "0 0 8px", color: "var(--rk-muted)" }}>Do you want to add nominee</p>
        <div style={{ display: "flex", gap: "clamp(24px, 18vw, 240px)", flexWrap: "wrap", fontSize: "0.85em" }}>
          <label className="rk-check"><input type="checkbox" checked={opted === "yes"} onChange={() => setOpted("yes")} /> YES (OPT IN)</label>
          <label className="rk-check"><input type="checkbox" checked={opted === "no"} onChange={() => setOpted("no")} /> NO (OPT OUT)</label>
        </div>

        {opted === "no" && (
          <div className="rk-alert rk-alert-info" style={{ marginTop: 18 }}>
            I/We hereby confirm that I/We do not wish to appoint any nominee(s) in my/our trading and demat account and understand the issues involved in non-appointment of nominee(s).
          </div>
        )}

        {opted === "yes" && existingNominees && !editing && (
          <div style={{ marginTop: 18 }}>
            {recordNominees.map((n, i) => (
              <div className="rk-nominee-card" key={i}>
                <h3>Nominee {i + 1}</h3>
                <div className="rk-grid-3">
                  <div className="rk-kv"><span className="rk-kv-label">Name</span><span className="rk-kv-value">{n.name || "-"}</span></div>
                  <div className="rk-kv"><span className="rk-kv-label">Relation</span><span className="rk-kv-value">{n.relation || "-"}</span></div>
                  <div className="rk-kv"><span className="rk-kv-label">Share</span><span className="rk-kv-value">{n.share}%</span></div>
                  <div className="rk-kv"><span className="rk-kv-label">Date of birth</span><span className="rk-kv-value">{n.dob ? n.dob.split("-").reverse().join("-") : "-"}</span></div>
                  <div className="rk-kv"><span className="rk-kv-label">Mobile</span><span className="rk-kv-value">{n.mobile || "-"}</span></div>
                  {n.guardianName && <div className="rk-kv"><span className="rk-kv-label">Guardian</span><span className="rk-kv-value">{n.guardianName}</span></div>}
                </div>
              </div>
            ))}
            <button className="rk-btn rk-btn-outline" onClick={startEditing}><Icons.Edit /> Edit nominees</button>
          </div>
        )}

        {opted === "yes" && editing && (
          <div style={{ marginTop: 18 }}>
            {nominees.map((n, i) => {
              const minor = (ageOf(n.dob) ?? 18) < 18;
              const isLast = i === nominees.length - 1;
              return (
                <div className="rk-nominee-card" key={i}>
                  <h3>
                    Nominee {i + 1}
                    {nominees.length > 1 && (
                      <button className="rk-link-btn" style={{ color: "var(--rk-danger)" }} onClick={() => removeNominee(i)}>Remove</button>
                    )}
                  </h3>
                  <PersonFields
                    n={n} i={i} prefix="" label="Nominee" onChange={update} onPincode={lookupPincode} onUpload={uploadProof}
                    uploading={uploading === `${i}-`} relationOptions={relationOptions(i)} knownIds={knownIds} requireEmail={false}
                  />
                  <div className="rk-grid-3">
                    <Field
                      label="Share (%) *"
                      id={`n${i}-share`}
                      hint={nominees.length === 1 ? "A single nominee gets 100%." : isLast ? "Set automatically so the total is 100%." : `Up to ${100 - nominees.slice(0, -1).reduce((s, x, idx) => s + (idx === i ? 0 : Number(x.share) || 0), 0) - 1}%`}
                    >
                      <input
                        id={`n${i}-share`}
                        className="rk-input"
                        inputMode="numeric"
                        value={n.share}
                        disabled={nominees.length === 1 || isLast}
                        onChange={(e) => changeShare(i, e.target.value)}
                      />
                    </Field>
                  </div>

                  {minor && (
                    <div style={{ marginTop: 8, paddingTop: 14, borderTop: "1px dashed var(--rk-line)" }}>
                      <h4 style={{ margin: "0 0 4px" }}>Guardian details (minor nominee)</h4>
                      <p className="rk-hint" style={{ margin: "0 0 12px" }}>The nominee is under 18, so a legal guardian is required.</p>
                      <PersonFields
                        n={n} i={i} prefix="guardian" label="Guardian" onChange={update} onPincode={lookupPincode} onUpload={uploadProof}
                        uploading={uploading === `${i}-guardian`} relationOptions={RELATIONS} knownIds={knownIds} requireEmail
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="rk-btn rk-btn-outline" disabled={nominees.length >= MAX_NOMINEES} onClick={addNominee}>+ Add another nominee</button>
                {existingNominees && <button className="rk-btn rk-btn-ghost" onClick={cancelEditing}>Cancel</button>}
              </div>
              <span style={{ fontWeight: 700, color: total === 100 ? "var(--rk-success)" : "var(--rk-danger)" }}>Total share: {total}%</span>
            </div>
          </div>
        )}
      </div>
      <StepFooter step="nominee" onNext={save} busy={busy || Boolean(uploading)} disabled={opted === "yes" && editing && total !== 100} />
    </section>
  );
}
