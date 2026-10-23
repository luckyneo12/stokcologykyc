"use client";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./calendar-popover.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const POPOVER_WIDTH = 300;
const GAP = 6;

const pad = (n) => String(n).padStart(2, "0");
// Local YYYY-MM-DD — toISOString() would shift the day for timezones ahead of UTC
export const toIsoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isoToDisplay = (iso) => {
  if (!iso || typeof iso !== "string") return "";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
};
const parseIso = (iso) => {
  if (!iso || typeof iso !== "string") return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

/**
 * Month-grid date picker shown under `anchorRef`. Rendered in a portal so it isn't clipped by
 * overflow:hidden parents; outside-click handlers elsewhere should ignore `.calendar-popover`.
 * Values are "YYYY-MM-DD" strings, same as <input type="date">.
 */
export default function CalendarPopover({ anchorRef, value, min, max, onSelect, onClear, onClose }) {
  const popRef = useRef(null);
  const todayIso = toIsoDate(new Date());
  const initial = parseIso(value) || parseIso(max && max < todayIso ? max : todayIso);
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [pos, setPos] = useState(null);

  const thisYear = new Date().getFullYear();
  const minYear = Math.min(min ? Number(min.slice(0, 4)) : 1900, viewYear);
  const maxYear = Math.max(max ? Number(max.slice(0, 4)) : thisYear + 10, viewYear);
  const years = [];
  for (let y = maxYear; y >= minYear; y--) years.push(y);

  const isDisabled = (iso) => (min && iso < min) || (max && iso > max);

  useLayoutEffect(() => {
    const place = () => {
      const anchor = anchorRef.current;
      const pop = popRef.current;
      if (!anchor || !pop) return;
      const rect = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(POPOVER_WIDTH, vw - 16);
      const height = pop.offsetHeight;
      const spaceBelow = vh - rect.bottom;
      const top = spaceBelow < height + GAP && rect.top > spaceBelow
        ? Math.max(8, rect.top - height - GAP)
        : rect.bottom + GAP;
      const left = Math.min(Math.max(8, rect.left), vw - width - 8);
      setPos({ top, left, width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchorRef, onClose]);

  const shiftMonth = (delta) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  // Always 6 rows, padded with the neighbouring months' days
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const gridStart = new Date(viewYear, viewMonth, 1 - firstOfMonth.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    return { date: d, iso: toIsoDate(d), outside: d.getMonth() !== viewMonth };
  });

  const prevDisabled = min && toIsoDate(new Date(viewYear, viewMonth, 0)) < min;
  const nextDisabled = max && toIsoDate(new Date(viewYear, viewMonth + 1, 1)) > max;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={popRef}
      className="calendar-popover"
      role="dialog"
      aria-label="Choose date"
      style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { top: -9999, left: -9999, width: POPOVER_WIDTH }}
    >
      <div className="cal-header">
        <button type="button" className="cal-nav" onClick={() => shiftMonth(-1)} disabled={prevDisabled} aria-label="Previous month">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div className="cal-selects">
          <select className="cal-select" value={viewMonth} onChange={(e) => setViewMonth(Number(e.target.value))} aria-label="Month">
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select className="cal-select" value={viewYear} onChange={(e) => setViewYear(Number(e.target.value))} aria-label="Year">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="button" className="cal-nav" onClick={() => shiftMonth(1)} disabled={nextDisabled} aria-label="Next month">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      <div className="cal-grid">
        {WEEKDAYS.map((w, i) => <div key={i} className="cal-weekday">{w}</div>)}
        {cells.map(({ date, iso, outside }) => {
          const disabled = isDisabled(iso);
          const cls = ["cal-day"];
          if (outside) cls.push("is-outside");
          if (iso === todayIso) cls.push("is-today");
          if (iso === value) cls.push("is-selected");
          return (
            <button
              key={iso}
              type="button"
              className={cls.join(" ")}
              disabled={disabled}
              onClick={() => { onSelect(iso); onClose(); }}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="cal-footer">
        <button type="button" className="cal-btn cal-btn-today" disabled={isDisabled(todayIso)} onClick={() => { onSelect(todayIso); onClose(); }}>
          Today
        </button>
        <button type="button" className="cal-btn cal-btn-clear" onClick={() => { onClear(); onClose(); }}>
          Clear
        </button>
      </div>
    </div>,
    document.body
  );
}
