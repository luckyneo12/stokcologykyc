"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { rekycApi, getClientToken, setClientToken } from "./clientApi";
import { useRekyc } from "./RekycRoot";
import { Icons, Spinner } from "./ui";

export const STEPS = [
  { id: "personal", label: "Personal", Icon: Icons.Personal },
  { id: "bank", label: "Bank", Icon: Icons.Bank },
  { id: "segment", label: "Segment", Icon: Icons.Segment },
  { id: "nominee", label: "Nominee", Icon: Icons.Nominee },
  { id: "others", label: "Others", Icon: Icons.Others },
  { id: "document", label: "Document", Icon: Icons.Document },
  { id: "review", label: "Review & eSign", Icon: Icons.Review },
];

const SECTION_OF_STEP = { personal: "Personal", bank: "Bank", segment: "Segment", nominee: "Nominee", others: "Others" };

const PortalContext = createContext(null);
export const usePortal = () => useContext(PortalContext);

export function nextStep(id) {
  const i = STEPS.findIndex((s) => s.id === id);
  return STEPS[i + 1]?.id;
}
export function prevStep(id) {
  const i = STEPS.findIndex((s) => s.id === id);
  return STEPS[i - 1]?.id;
}

function Header({ request, onLogout }) {
  const { theme, setTheme, font, setFont } = useRekyc();
  const [speaking, setSpeaking] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const notesRef = useRef(null);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  useEffect(() => {
    if (!showNotes) return;
    const close = (e) => !notesRef.current?.contains(e.target) && setShowNotes(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showNotes]);

  const readAloud = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const text = document.querySelector(".rk-main")?.innerText || "";
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 4000));
    utterance.lang = "en-IN";
    utterance.onend = () => setSpeaking(false);
    synth.speak(utterance);
    setSpeaking(true);
  };

  const notes = [];
  if (request?.rejectionReason) notes.push({ tone: "error", text: `Your earlier request was sent back: ${request.rejectionReason}` });
  if (request?.changeList?.length) notes.push({ tone: "info", text: `${request.changeList.length} change(s) ready. Complete all steps and eSign to submit.` });
  if (!notes.length) notes.push({ tone: "info", text: "Click the pencil icon next to any detail to update it." });

  return (
    <header className="rk-header">
      <Link href="/rekyc/personal" className="rk-header-logo" aria-label="Stockology home">
        <img src="/stklogo.png" alt="Stockology" />
      </Link>
      <div className="rk-tools">
        <button className="rk-tool" aria-pressed={font === "large"} onClick={() => setFont("large")} aria-label="Larger text">A+</button>
        <button className="rk-tool" aria-pressed={font === "normal"} onClick={() => setFont("normal")} aria-label="Normal text">A</button>
        <button className="rk-tool" aria-pressed={font === "small"} onClick={() => setFont("small")} aria-label="Smaller text">A-</button>
        {["dark", "light", "yellow", "blue", "orange"].map((t) => (
          <button key={t} className={`rk-tool rk-tool-${t}`} aria-pressed={theme === t} onClick={() => setTheme(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <button className="rk-icon-btn" onClick={readAloud} aria-pressed={speaking} aria-label={speaking ? "Stop reading" : "Read this page aloud"} title={speaking ? "Stop reading" : "Read aloud"}>
          <Icons.Speaker />
        </button>
        <div style={{ position: "relative" }} ref={notesRef}>
          <button className="rk-icon-btn" onClick={() => setShowNotes((v) => !v)} aria-label="Notifications" aria-expanded={showNotes} style={{ border: 0, color: "var(--rk-text)" }}>
            <Icons.Bell />
            {request?.rejectionReason && <span className="rk-dot" />}
          </button>
          {showNotes && (
            <div className="rk-notify" role="dialog" aria-label="Notifications">
              {notes.map((n, i) => (
                <p key={i} className={`rk-alert rk-alert-${n.tone}`} style={{ marginBottom: 8 }}>{n.text}</p>
              ))}
            </div>
          )}
        </div>
        <button className="rk-btn rk-btn-sm" onClick={onLogout} style={{ minHeight: 40, padding: "0 22px", fontSize: "0.8em", letterSpacing: "0.04em" }}>
          LOGOUT
        </button>
      </div>
    </header>
  );
}

function AccountCard({ profile }) {
  const [open, setOpen] = useState(true);
  const items = [
    ["Name", profile?.name],
    ["Client ID", profile?.clientCode],
    ["Account Status", profile?.accountStatus],
    ["PAN", profile?.pan],
    ["CKYC No.", profile?.ckycNo || "-"],
  ];
  return (
    <section className="rk-card">
      <div className="rk-card-head" style={{ borderBottom: open ? undefined : 0 }}>
        <h2>Account Details</h2>
        <button className="rk-collapse" aria-expanded={open} onClick={() => setOpen((v) => !v)} aria-label={open ? "Collapse" : "Expand"}>
          <Icons.Chevron />
        </button>
      </div>
      {open && (
        <div className="rk-card-body">
          <div className="rk-account-grid">
            {items.map(([label, value]) => (
              <div className="rk-kv" key={label}>
                <span className="rk-kv-label">{label}</span>
                <span className="rk-kv-value">{value || "-"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function PortalShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { notify } = useRekyc();
  const [request, setRequest] = useState(null);
  const [loadError, setLoadError] = useState("");

  const current = pathname.split("/")[2] || "personal";

  const refresh = useCallback(async () => {
    const data = await rekycApi("/me");
    setRequest(data.request);
    return data.request;
  }, []);

  useEffect(() => {
    if (!getClientToken()) {
      router.replace("/rekyc");
      return;
    }
    refresh().catch((e) => setLoadError(e.message));
  }, [refresh, router]);

  useEffect(() => {
    if (!request) return;
    const locked = request.status !== "in_progress";
    if (locked && current !== "status") router.replace("/rekyc/status");
    if (!locked && current === "status") router.replace("/rekyc/personal");
  }, [request, current, router]);

  const logout = () => {
    setClientToken(null);
    window.speechSynthesis?.cancel();
    router.replace("/rekyc");
  };

  // Every save returns the updated request; this keeps the whole portal in sync
  const run = useCallback(
    async (path, body, { success } = {}) => {
      const data = await rekycApi(path, { method: "POST", body });
      if (data.request) setRequest(data.request);
      if (success) notify(success);
      return data;
    },
    [notify]
  );

  if (loadError) {
    return (
      <div className="rk-login-wrap">
        <div className="rk-login-card">
          <div className="rk-alert rk-alert-error">{loadError}</div>
          <button className="rk-btn" onClick={logout}>Back to login</button>
        </div>
      </div>
    );
  }
  if (!request) {
    return (
      <div className="rk-login-wrap" style={{ color: "var(--rk-primary)" }}>
        <Spinner />
      </div>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.id === current);
  const changedSections = new Set((request.changeList || []).map((c) => c.section));

  return (
    <PortalContext.Provider value={{ request, setRequest, refresh, run, notify }}>
      <Header request={request} onLogout={logout} />
      <div className="rk-layout">
        {current !== "status" && (
          <nav className="rk-steps" aria-label="Steps">
            {STEPS.map((step, i) => (
              <div key={step.id} className={`rk-step${i < stepIndex ? " done" : ""}${i === stepIndex ? " active" : ""}`}>
                <span className="rk-step-dot" />
                <Link href={`/rekyc/${step.id}`} className="rk-step-link" aria-current={i === stepIndex ? "step" : undefined}>
                  <step.Icon />
                  {step.label}
                  {changedSections.has(SECTION_OF_STEP[step.id]) && <span className="rk-step-flag" title="Changed" />}
                </Link>
              </div>
            ))}
          </nav>
        )}
        <main className="rk-main" style={current === "status" ? { gridColumn: "1 / -1", maxWidth: 1100, margin: "0 auto", width: "100%" } : undefined}>
          <AccountCard profile={request.profile} />
          {children}
        </main>
      </div>
    </PortalContext.Provider>
  );
}

export function StepFooter({ step, onNext, nextLabel = "Next", busy = false, disabled = false }) {
  const router = useRouter();
  const prev = prevStep(step);
  const next = nextStep(step);
  const go = async () => {
    if (onNext) {
      const ok = await onNext();
      if (ok === false) return;
    }
    if (next) router.push(`/rekyc/${next}`);
  };
  return (
    <div className="rk-card-foot">
      {prev ? (
        <button className="rk-btn rk-btn-outline" onClick={() => router.push(`/rekyc/${prev}`)} style={{ minWidth: 132 }}>Previous</button>
      ) : (
        <span />
      )}
      <button className="rk-btn" onClick={go} disabled={busy || disabled} style={{ minWidth: 132 }}>
        {busy && <Spinner />} {nextLabel}
      </button>
    </div>
  );
}
