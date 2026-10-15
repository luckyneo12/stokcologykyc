"use client";
import { Component, useCallback, useEffect, useRef, useState } from "react";
import PdfMobileViewer from "./PdfMobileViewer";

/**
 * Continuous-scroll PDF viewer (eSign preview, correction eSign).
 *
 * - All pages one below the other in a scroll box; a toolbar shows / jumps to a page and zooms.
 * - Wide screens get a thumbnail column to click to a page.
 * - Only the pages near the view are drawn (and far ones freed), so 100+ page PDFs stay smooth on
 *   low-end phones. Pages are drawn one at a time, nearest first.
 * - Any failure (old browser, PDF engine error) falls back to the previous viewer (PdfMobileViewer),
 *   which is kept unchanged. The step's own Back / Proceed / Download buttons are outside this box.
 *
 * Props: url (blob / http URL of the PDF), hideActions (kept for compatibility), height (box height;
 * default ~70% of the screen on phones, up to 78vh on larger screens).
 */

const PDFJS_FALLBACK_VERSION = "5.7.284";
const MAX_CANVAS_PIXELS = 5000000; // per page canvas — keeps phones within their memory
const KEEP_AROUND = 3; // pages kept drawn before / after the visible ones
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const THUMB_WIDTH = 92;
const SIDEBAR_MIN_WIDTH = 860; // viewer width from which the thumbnail column is shown
const PAGE_GAP = 14;

class ViewerBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("[PdfScrollViewer] Falling back to the simple viewer:", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function PdfScrollViewer({ url, hideActions = false, height }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (!url) return null;
  const fallback = <PdfMobileViewer url={url} hideActions={hideActions} />;
  if (failed) return fallback;
  return (
    <ViewerBoundary key={url} fallback={fallback}>
      <ScrollViewer url={url} height={height} onFail={() => setFailed(true)} />
    </ViewerBoundary>
  );
}

function ScrollViewer({ url, height, onFail }) {
  const [doc, setDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [baseRatio, setBaseRatio] = useState(1.414); // height / width of page 1 (A4 until known)
  const [ratios, setRatios] = useState({}); // page → height / width, once that page was opened
  const [zoom, setZoom] = useState(1);
  const [boxWidth, setBoxWidth] = useState(0); // width of the whole viewer
  const [areaWidth, setAreaWidth] = useState(0); // width available for the pages
  const [current, setCurrent] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [narrow, setNarrow] = useState(false);

  const boxRef = useRef(null);
  const scrollRef = useRef(null);
  const thumbsRef = useRef(null);
  const pageEls = useRef({});
  const canvases = useRef({});
  const thumbCanvases = useRef({});
  const rendered = useRef(new Map()); // page → css width it was drawn at
  const thumbsDone = useRef(new Set());
  const visible = useRef(new Set());
  const thumbVisible = useRef(new Set());
  const busy = useRef(false);
  const tasks = useRef(new Set());
  const inputFocused = useRef(false);
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;
  const aliveRef = useRef(true); // false once this viewer is gone (its late errors must not switch a newer one)
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const showThumbs = boxWidth >= SIDEBAR_MIN_WIDTH && numPages > 1;
  const pageWidth = Math.max(0, Math.floor((areaWidth - 24) * zoom));
  const pageHeight = (n) => Math.round(pageWidth * (ratios[n] || baseRatio));

  // ─── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let loadingTask = null;
    let loadedDoc = null;
    const liveTasks = tasks.current;
    setNarrow(typeof window !== "undefined" && window.innerWidth < 640);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const version = pdfjs.version || PDFJS_FALLBACK_VERSION;
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
        loadingTask = pdfjs.getDocument({
          url,
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/cmaps/`,
          cMapPacked: true,
        });
        loadedDoc = await loadingTask.promise;
        if (cancelled) return;
        const first = await loadedDoc.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        if (cancelled) return;
        setBaseRatio(vp.height / vp.width);
        setNumPages(loadedDoc.numPages);
        setDoc(loadedDoc);
      } catch (err) {
        if (!cancelled && aliveRef.current) {
          console.error("[PdfScrollViewer] Load failed:", err);
          onFailRef.current?.();
        }
      }
    })();
    return () => {
      cancelled = true;
      liveTasks.forEach((t) => { try { t.cancel(); } catch (e) {} });
      liveTasks.clear();
      try { (loadedDoc || loadingTask)?.destroy?.(); } catch (e) {}
    };
  }, [url]);

  // ─── Sizes ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const measure = () => {
      if (boxRef.current) setBoxWidth(boxRef.current.clientWidth);
      if (scrollRef.current) setAreaWidth(scrollRef.current.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    if (boxRef.current) ro.observe(boxRef.current);
    if (scrollRef.current) ro.observe(scrollRef.current);
    return () => ro.disconnect();
  }, [doc, showThumbs]);

  // ─── Drawing (one page at a time, nearest first) ───────────────────────────
  const drawCanvas = useCallback(async (n, canvas, cssWidth, dprCap) => {
    const page = await doc.getPage(n);
    const vp1 = page.getViewport({ scale: 1 });
    const ratio = vp1.height / vp1.width;
    setRatios((r) => (Math.abs((r[n] || 0) - ratio) < 0.001 ? r : { ...r, [n]: ratio }));
    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, dprCap);
    let scale = (cssWidth / vp1.width) * dpr;
    if (vp1.width * scale * vp1.height * scale > MAX_CANVAS_PIXELS) {
      scale = Math.sqrt(MAX_CANVAS_PIXELS / (vp1.width * vp1.height));
    }
    const vp = page.getViewport({ scale });
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    const task = page.render({ canvasContext: canvas.getContext("2d"), viewport: vp });
    tasks.current.add(task);
    try {
      await task.promise;
    } finally {
      tasks.current.delete(task);
    }
  }, [doc]);

  const wantedRange = useCallback(() => {
    const vis = [...visible.current];
    if (!vis.length) return null;
    return [Math.max(1, Math.min(...vis) - KEEP_AROUND), Math.min(numPages, Math.max(...vis) + KEEP_AROUND)];
  }, [numPages]);

  const pump = useCallback(async () => {
    if (busy.current || !doc || !pageWidth) return;
    busy.current = true;
    try {
      for (;;) {
        // 1) pages in / near the view that are missing or drawn at another size — nearest first
        const range = wantedRange();
        let next = null;
        if (range) {
          const center = Math.min(...visible.current);
          const todo = [];
          for (let n = range[0]; n <= range[1]; n++) {
            if (canvases.current[n] && rendered.current.get(n) !== pageWidth) todo.push(n);
          }
          todo.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
          next = todo[0] ? { kind: "page", n: todo[0] } : null;
        }
        // 2) then visible thumbnails
        if (!next && showThumbs) {
          const t = [...thumbVisible.current].sort((a, b) => a - b).find((n) => !thumbsDone.current.has(n) && thumbCanvases.current[n]);
          if (t) next = { kind: "thumb", n: t };
        }
        if (!next) break;
        try {
          if (next.kind === "page") {
            rendered.current.set(next.n, pageWidth);
            await drawCanvas(next.n, canvases.current[next.n], pageWidth, 2);
          } else {
            thumbsDone.current.add(next.n);
            await drawCanvas(next.n, thumbCanvases.current[next.n], THUMB_WIDTH, 1);
          }
        } catch (err) {
          if (err?.name === "RenderingCancelledException" || !aliveRef.current) break;
          console.error("[PdfScrollViewer] Page draw failed:", err);
          // the first page can't be drawn at all → this viewer isn't usable here, use the simple one
          if (next.kind === "page" && next.n === 1) {
            onFailRef.current?.();
            break;
          }
        }
      }
    } finally {
      busy.current = false;
    }
  }, [doc, pageWidth, wantedRange, drawCanvas, showThumbs]);

  /** Frees the canvases of pages far from the view (memory on phones). */
  const release = useCallback(() => {
    const range = wantedRange();
    if (!range) return;
    for (const [n] of rendered.current) {
      if (n < range[0] || n > range[1]) {
        const c = canvases.current[n];
        if (c) { c.width = 0; c.height = 0; }
        rendered.current.delete(n);
      }
    }
  }, [wantedRange]);

  // ─── Which pages are in view ───────────────────────────────────────────────
  useEffect(() => {
    if (!doc || !scrollRef.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const n = Number(e.target.dataset.page);
        if (e.isIntersecting) visible.current.add(n);
        else visible.current.delete(n);
      }
      release();
      pump();
    }, { root: scrollRef.current, rootMargin: "400px 0px" });
    Object.values(pageEls.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [doc, numPages, release, pump]);

  useEffect(() => {
    if (!showThumbs || !thumbsRef.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const n = Number(e.target.dataset.thumb);
        if (e.isIntersecting) thumbVisible.current.add(n);
        else thumbVisible.current.delete(n);
      }
      pump();
    }, { root: thumbsRef.current, rootMargin: "200px 0px" });
    thumbsRef.current.querySelectorAll("[data-thumb]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [showThumbs, numPages, pump]);

  // Size / zoom changed → redraw what is in view (old drawings stay until replaced)
  useEffect(() => {
    pump();
  }, [pageWidth, pump]);

  // No IntersectionObserver (very old browser) → the simple viewer
  useEffect(() => {
    if (doc && typeof IntersectionObserver === "undefined") onFailRef.current?.();
  }, [doc]);

  // ─── Current page while scrolling ──────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !doc) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const line = el.getBoundingClientRect().top + el.clientHeight * 0.3;
        let best = 1;
        for (let n = 1; n <= numPages; n++) {
          const p = pageEls.current[n];
          if (!p) continue;
          if (p.getBoundingClientRect().top <= line) best = n;
          else break;
        }
        setCurrent(best);
        if (!inputFocused.current) setPageInput(String(best));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [doc, numPages]);

  // Keep the active thumbnail in view
  useEffect(() => {
    const t = thumbsRef.current?.querySelector(`[data-thumb="${current}"]`);
    if (t && thumbsRef.current) {
      const box = thumbsRef.current;
      if (t.offsetTop < box.scrollTop || t.offsetTop + t.offsetHeight > box.scrollTop + box.clientHeight) {
        box.scrollTo({ top: t.offsetTop - 12 });
      }
    }
  }, [current]);

  const goTo = useCallback((n) => {
    const page = Math.min(Math.max(1, Math.round(Number(n) || 1)), numPages || 1);
    const el = pageEls.current[page];
    if (el && scrollRef.current) scrollRef.current.scrollTo({ top: el.offsetTop - 8 });
    setCurrent(page);
    setPageInput(String(page));
  }, [numPages]);

  const changeZoom = (dir) => {
    const keep = current;
    setZoom((z) => {
      const i = ZOOM_STEPS.indexOf(z);
      const next = dir === 0 ? 1 : ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, (i === -1 ? 2 : i) + dir))];
      return next;
    });
    // after the new sizes are laid out, return to the same page
    requestAnimationFrame(() => requestAnimationFrame(() => goTo(keep)));
  };

  const boxHeight = height || (narrow ? "70vh" : "min(78vh, 1000px)");
  const btn = {
    height: 34, minWidth: 34, padding: "0 10px", borderRadius: 10, border: "1px solid var(--border-color)",
    background: "var(--bg-card, #fff)", color: "var(--text-primary)", fontWeight: 800, cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.95rem",
  };

  return (
    <div
      ref={boxRef}
      style={{ width: "100%", height: boxHeight, minHeight: 420, display: "flex", flexDirection: "column", background: "var(--bg-secondary, #f4f6f3)" }}
    >
      {/* Toolbar */}
      <div
        style={{
          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
          padding: "10px 14px", background: "var(--bg-elevated, #fff)", borderBottom: "1px solid var(--border-color)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)", fontWeight: 700 }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Page</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={numPages || 1}
            value={pageInput}
            aria-label="Go to page"
            onFocus={() => { inputFocused.current = true; }}
            onBlur={() => { inputFocused.current = false; if (pageInput) goTo(pageInput); }}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
            style={{
              width: 64, height: 34, borderRadius: 10, border: "1px solid var(--border-color)", textAlign: "center",
              fontWeight: 800, fontSize: "0.95rem", background: "var(--bg-card, #fff)", color: "var(--text-primary)",
            }}
          />
          <span style={{ fontSize: "0.9rem" }}>/ {numPages || "…"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button type="button" style={{ ...btn, opacity: zoom <= ZOOM_STEPS[0] ? 0.4 : 1 }} onClick={() => changeZoom(-1)} disabled={zoom <= ZOOM_STEPS[0]} aria-label="Zoom out">−</button>
          <button type="button" style={{ ...btn, minWidth: 64, fontSize: "0.8rem" }} onClick={() => changeZoom(0)} title="Fit to width">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" style={{ ...btn, opacity: zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1] ? 0.4 : 1 }} onClick={() => changeZoom(1)} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} aria-label="Zoom in">+</button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {/* Thumbnails (wide screens) */}
        {showThumbs && (
          <div
            ref={thumbsRef}
            style={{
              width: THUMB_WIDTH + 28, flexShrink: 0, overflowY: "auto", padding: "12px 10px", position: "relative",
              borderRight: "1px solid var(--border-color)", background: "var(--bg-elevated, #fff)",
            }}
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                data-thumb={n}
                onClick={() => goTo(n)}
                style={{
                  display: "block", width: THUMB_WIDTH + 8, margin: "0 0 10px", padding: 3, borderRadius: 8, cursor: "pointer",
                  border: n === current ? "2px solid var(--wise-green, #9fe870)" : "2px solid transparent", background: "transparent",
                }}
              >
                <canvas
                  ref={(c) => { thumbCanvases.current[n] = c; }}
                  style={{ display: "block", width: THUMB_WIDTH, height: Math.round(THUMB_WIDTH * (ratios[n] || baseRatio)), background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}
                />
                <span style={{ display: "block", marginTop: 4, fontSize: "0.72rem", fontWeight: 700, color: "var(--text-secondary)" }}>{n}</span>
              </button>
            ))}
          </div>
        )}

        {/* Pages */}
        <div ref={scrollRef} style={{ flex: 1, minWidth: 0, overflow: "auto", position: "relative", WebkitOverflowScrolling: "touch" }}>
          {!doc && (
            <div style={{ padding: "80px 20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div className="loader" style={{ marginBottom: 16, width: "36px", height: "36px", border: "4px solid var(--border-color)", borderTop: "4px solid var(--wise-green)" }}></div>
              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Loading Preview...</span>
            </div>
          )}
          {doc && pageWidth > 0 && (
            <div style={{ padding: `12px 12px ${PAGE_GAP + 12}px`, width: pageWidth + 24, margin: "0 auto" }}>
              {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
                <div
                  key={n}
                  data-page={n}
                  ref={(el) => { pageEls.current[n] = el; }}
                  style={{ width: pageWidth, height: pageHeight(n), marginBottom: PAGE_GAP, background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.12)", borderRadius: 4, overflow: "hidden", position: "relative" }}
                >
                  <canvas
                    ref={(c) => { canvases.current[n] = c; }}
                    style={{ display: "block", width: "100%", height: "100%" }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
