"use client";
import { useEffect, useRef } from "react";

const icon = (paths, size = 22) =>
  function Icon(props) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        {paths}
      </svg>
    );
  };

export const Icons = {
  Personal: icon(<><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M12 11v6" /><circle cx="12" cy="7.6" r="0.6" fill="currentColor" /></>),
  Bank: icon(<><path d="M3 10h18L12 4 3 10z" /><path d="M5 10v7M9.5 10v7M14.5 10v7M19 10v7" /><path d="M3 20h18" /></>),
  Segment: icon(<><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M8 16v-4M12 16V8M16 16v-6" /></>),
  Nominee: icon(<><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3.5 19c.8-3 3-4.6 5.5-4.6s4.7 1.6 5.5 4.6" /><path d="M15 14.6c2.3-.4 4.6.8 5.5 3.6" /></>),
  Others: icon(<><rect x="8" y="3" width="13" height="13" rx="2.5" /><path d="M16 16v2.5A2.5 2.5 0 0 1 13.5 21H5.5A2.5 2.5 0 0 1 3 18.5v-8A2.5 2.5 0 0 1 5.5 8H8" /><path d="M11.5 8h6M11.5 11.5h6" /></>),
  Document: icon(<><path d="M7 4.5A8 8 0 0 1 20 11" /><path d="M17 19.5A8 8 0 0 1 4 13" /><path d="M7 2v3h3M17 22v-3h-3" /></>),
  Review: icon(<><path d="M9 11l3 3 8-8" /><path d="M20 12v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h9" /></>),
  Edit: icon(<><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></>, 16),
  Chevron: icon(<path d="M6 9l6 6 6-6" />, 20),
  Trash: icon(<><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>, 18),
  Bell: icon(<><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z" fill="currentColor" stroke="none" /><path d="M10 20a2 2 0 0 0 4 0" /></>, 20),
  Speaker: icon(<><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></>, 18),
  Plus: icon(<path d="M12 5v14M5 12h14" />, 18),
  Check: icon(<path d="M5 12.5l4.5 4.5L19 7.5" />, 18),
  Clock: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, 38),
  Done: icon(<><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>, 38),
};

export function Modal({ title, onClose, children, footer, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector("input, select, textarea, button:not(.rk-close)")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="rk-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`rk-modal${wide ? " rk-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="rk-modal-head">
          <h3>{title}</h3>
          <button className="rk-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="rk-modal-body">{children}</div>
        {footer && <div className="rk-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, id }) {
  return (
    <div className="rk-field">
      {label && <label htmlFor={id}>{label}</label>}
      {children}
      {hint && <span className="rk-hint">{hint}</span>}
    </div>
  );
}

export function ErrorText({ children }) {
  return children ? <div className="rk-alert rk-alert-error" role="alert">{children}</div> : null;
}

export function Spinner() {
  return <span className="rk-spinner" aria-hidden="true" />;
}
