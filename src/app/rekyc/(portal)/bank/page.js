"use client";
import { useEffect, useState } from "react";
import { usePortal, StepFooter } from "@/components/rekyc/PortalShell";
import { rekycApi } from "@/components/rekyc/clientApi";
import { Icons, Modal, Field, ErrorText, Spinner } from "@/components/rekyc/ui";

const MAX_BANKS = 3;

function bankRows(request) {
  const bank = request.changes.bank || {};
  const removed = new Set((bank.removed || []).map((b) => b.accountNumber));
  const original = request.profile.banks || [];
  const defaultAccount = bank.defaultAccount?.new || original.find((b) => b.isDefault)?.accountNumber;
  return [
    ...original.map((b) => ({ ...b, isNew: false, isRemoved: removed.has(b.accountNumber) })),
    ...(bank.added || []).map((b) => ({ ...b, isNew: true, isRemoved: false })),
  ].map((b) => ({ ...b, isDefault: b.accountNumber === defaultAccount }));
}

export default function BankStep() {
  const { request, run, notify } = usePortal();
  const [adding, setAdding] = useState(false);
  const [busyAccount, setBusyAccount] = useState(null);
  const rows = bankRows(request);
  const active = rows.filter((b) => !b.isRemoved);

  const act = async (path, accountNumber, success) => {
    setBusyAccount(accountNumber);
    try {
      await run(path, { accountNumber }, { success });
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusyAccount(null);
    }
  };

  return (
    <section className="rk-card">
      <div className="rk-card-head">
        <h2>Bank Details</h2>
        <button className="rk-btn" onClick={() => setAdding(true)} disabled={active.length >= MAX_BANKS}>
          <Icons.Plus /> Add Account
        </button>
      </div>
      <div className="rk-card-body">
        <div className="rk-alert rk-alert-info">
          <b>Addition of Bank Account:</b> Please link those bank accounts only, in which you are primary/secondary account holder. Maximum {MAX_BANKS} accounts can be linked to your trading account.
        </div>
        <div className="rk-table-wrap">
          <table className="rk-table">
            <thead>
              <tr>
                <th>S. No.</th><th>Bank Name</th><th>Account number</th><th>IFSC Code</th><th>Default Bank</th><th>Account DP type</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b, i) => (
                <tr key={b.accountNumber} className={b.isRemoved ? "rk-row-removed" : ""}>
                  <td>{String(i + 1).padStart(2, "0")}</td>
                  <td>
                    {b.bankName || "-"}{" "}
                    {b.isNew && <span className="rk-badge rk-badge-new">New · Verified</span>}
                    {b.isRemoved && <span className="rk-badge rk-badge-removed">Removing</span>}
                  </td>
                  <td>{b.accountNumber}</td>
                  <td>{b.ifsc}</td>
                  <td>
                    <label className="rk-radio">
                      <input
                        type="radio"
                        name="rk-default-bank"
                        checked={b.isDefault}
                        disabled={b.isRemoved || busyAccount !== null}
                        onChange={() => act("/bank/default", b.accountNumber, "Default bank updated.")}
                      />
                      Set as Default
                    </label>
                  </td>
                  <td>{b.dpType || "Demat and Trading"}</td>
                  <td>
                    {busyAccount === b.accountNumber ? (
                      <Spinner />
                    ) : b.isRemoved ? (
                      <button className="rk-link-btn" style={{ textDecoration: "none" }} onClick={() => act("/bank/restore", b.accountNumber, "Bank account kept.")}>
                        Keep
                      </button>
                    ) : (
                      <button
                        className="rk-trash"
                        aria-label={`Remove account ${b.accountNumber}`}
                        title={b.isDefault ? "Set another account as default first" : "Remove"}
                        disabled={b.isRemoved || b.isDefault || active.length <= 1}
                        onClick={() => act("/bank/remove", b.accountNumber, "Bank account will be removed.")}
                      >
                        <Icons.Trash />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--rk-muted)" }}>No bank account found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <StepFooter step="bank" />
      {adding && <AddBankModal onClose={() => setAdding(false)} />}
    </section>
  );
}

function AddBankModal({ onClose }) {
  const { run } = usePortal();
  const [ifsc, setIfsc] = useState("");
  const [branch, setBranch] = useState(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accountType, setAccountType] = useState("Savings");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setBranch(null);
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return;
    let cancelled = false;
    rekycApi("/bank/ifsc", { method: "POST", body: { ifsc } })
      .then((d) => !cancelled && setBranch(d.bank))
      .catch((e) => !cancelled && setBranch({ error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [ifsc]);

  const valid = branch && !branch.error && /^\d{6,20}$/.test(accountNumber) && accountNumber === confirm;

  const add = async () => {
    setBusy(true);
    setError("");
    try {
      await run("/bank/add", { ifsc, accountNumber, accountType }, { success: "Bank account verified and added." });
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Add Bank Account"
      onClose={onClose}
      footer={<><button className="rk-btn rk-btn-ghost" onClick={onClose}>Cancel</button><button className="rk-btn" onClick={add} disabled={busy || !valid}>{busy && <Spinner />} Verify &amp; Add</button></>}
    >
      <div className="rk-alert rk-alert-info">We will deposit ₹1 into this account to verify it (penny drop). The account must be in your name.</div>
      <ErrorText>{error}</ErrorText>
      <Field label="IFSC Code" id="rk-ifsc">
        <input id="rk-ifsc" className="rk-input" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))} placeholder="e.g. SBIN0001234" />
      </Field>
      {branch && !branch.error && (
        <div className="rk-alert rk-alert-success" style={{ marginTop: -6 }}>
          <b>{branch.bankName}</b>{branch.branch ? ` — ${branch.branch}` : ""}
          {branch.city ? `, ${branch.city}` : ""}
        </div>
      )}
      {branch?.error && <div className="rk-alert rk-alert-error" style={{ marginTop: -6 }}>{branch.error}</div>}
      <Field label="Account Number" id="rk-acc">
        <input id="rk-acc" className="rk-input" inputMode="numeric" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 20))} />
      </Field>
      <Field label="Confirm Account Number" id="rk-acc2" hint={confirm && confirm !== accountNumber ? "Account numbers do not match." : null}>
        <input id="rk-acc2" className="rk-input" inputMode="numeric" value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 20))} onPaste={(e) => e.preventDefault()} />
      </Field>
      <Field label="Account Type" id="rk-acc-type">
        <select id="rk-acc-type" className="rk-select" value={accountType} onChange={(e) => setAccountType(e.target.value)}>
          <option>Savings</option>
          <option>Current</option>
        </select>
      </Field>
    </Modal>
  );
}
