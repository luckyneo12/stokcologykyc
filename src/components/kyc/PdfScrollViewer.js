"use client";
import { Component, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, PanelLeft, FileText, Maximize2 } from "lucide-react";
import PdfMobileViewer from "./PdfMobileViewer";
import "./pdf-preview.css";

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
  const [thumbsOpen, setThumbsOpen] = useState(true); // the reader can hide the page rail

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

  const canShowThumbs = boxWidth >= SIDEBAR_MIN_WIDTH && numPages > 1;
  const showThumbs = canShowThumbs && thumbsOpen;
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

  // Visual only: reading-progress line and the "Page x of y" chip that shows while scrolling.
  // Written straight to the element (CSS variable / class), so scrolling causes no re-render.
  useEffect(() => {
    const el = scrollRef.current;
    const box = boxRef.current;
    if (!el || !box || !doc) return;
    let hideTimer = 0;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      box.style.setProperty("--pv-progress", max > 0 ? (el.scrollTop / max).toFixed(4) : "0");
      box.classList.add("is-scrolling");
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => box.classList.remove("is-scrolling"), 900);
    };
    onScroll();
    box.classList.remove("is-scrolling");
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      clearTimeout(hideTimer);
    };
  }, [doc, showThumbs]);

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
  const zoomIndex = ZOOM_STEPS.indexOf(zoom) === -1 ? 2 : ZOOM_STEPS.indexOf(zoom);

  return (
    <div ref={boxRef} className="pv-viewer" style={{ height: boxHeight }}>
      {/* Header */}
      <div className="pv-toolbar">
        <div className="pv-title">
          {canShowThumbs && (
            <button
              type="button"
              className={`pv-btn pv-rail-toggle${thumbsOpen ? " is-on" : ""}`}
              onClick={() => setThumbsOpen((v) => !v)}
              aria-pressed={thumbsOpen}
              aria-label={thumbsOpen ? "Hide page thumbnails" : "Show page thumbnails"}
              title={thumbsOpen ? "Hide pages" : "Show pages"}
            >
              <PanelLeft size={17} />
            </button>
          )}
          <span className="pv-title-icon" aria-hidden="true"><FileText size={16} /></span>
          <span className="pv-title-text">
            <span className="pv-title-name">Application Form</span>
            <span className="pv-title-sub">{numPages ? `${numPages} pages` : "Loading…"}</span>
          </span>
        </div>

        <div className="pv-group pv-nav" role="group" aria-label="Pages">
          <button type="button" className="pv-btn" onClick={() => goTo(current - 1)} disabled={!doc || current <= 1} aria-label="Previous page" title="Previous page">
            <ChevronLeft size={18} />
          </button>
          <input
            type="number"
            inputMode="numeric"
            className="pv-page-input"
            min={1}
            max={numPages || 1}
            value={pageInput}
            aria-label="Go to page"
            onFocus={(e) => { inputFocused.current = true; e.currentTarget.select(); }}
            onBlur={() => { inputFocused.current = false; if (pageInput) goTo(pageInput); }}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
          />
          <span className="pv-page-total">/ {numPages || "…"}</span>
          <button type="button" className="pv-btn" onClick={() => goTo(current + 1)} disabled={!doc || current >= numPages} aria-label="Next page" title="Next page">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="pv-group pv-zoom" role="group" aria-label="Zoom">
          <button type="button" className="pv-btn" onClick={() => changeZoom(-1)} disabled={zoom <= ZOOM_STEPS[0]} aria-label="Zoom out" title="Zoom out">
            <ZoomOut size={17} />
          </button>
          <span className="pv-zoom-meter" aria-hidden="true">
            <span style={{ width: `${(zoomIndex / (ZOOM_STEPS.length - 1)) * 100}%` }} />
          </span>
          <span className="pv-zoom-value">{Math.round(zoom * 100)}%</span>
          <button type="button" className="pv-btn" onClick={() => changeZoom(1)} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} aria-label="Zoom in" title="Zoom in">
            <ZoomIn size={17} />
          </button>
          <span className="pv-group-sep" aria-hidden="true" />
          <button type="button" className={`pv-btn${zoom === 1 ? " is-on" : ""}`} onClick={() => changeZoom(0)} aria-label="Fit to width" title="Fit to width">
            <Maximize2 size={15} />
          </button>
        </div>
        <span className="pv-progress" aria-hidden="true" />
      </div>

      <div className="pv-body">
        {/* Page rail (wide screens) */}
        {showThumbs && (
          <div ref={thumbsRef} className="pv-thumbs" style={{ width: THUMB_WIDTH + 36 }}>
            {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                data-thumb={n}
                onClick={() => goTo(n)}
                className={`pv-thumb${n === current ? " is-current" : ""}`}
                style={{ width: THUMB_WIDTH + 12 }}
                aria-label={`Page ${n}`}
                aria-current={n === current ? "page" : undefined}
              >
                <span className="pv-thumb-frame">
                  <canvas
                    ref={(c) => { thumbCanvases.current[n] = c; }}
                    style={{ width: THUMB_WIDTH, height: Math.round(THUMB_WIDTH * (ratios[n] || baseRatio)) }}
                  />
                </span>
                <span className="pv-thumb-num">{n}</span>
              </button>
            ))}
          </div>
        )}

        {/* Pages */}
        <div className="pv-stage">
          <div ref={scrollRef} className="pv-pages">
            {!doc && (
              <div className="pv-skeleton" aria-live="polite">
                <span className="pv-skeleton-label">Loading preview…</span>
                <div className="pv-skeleton-page" />
                <div className="pv-skeleton-page" />
              </div>
            )}
            {doc && pageWidth > 0 && (
              <div style={{ padding: `20px 12px ${PAGE_GAP + 40}px`, width: pageWidth + 24, margin: "0 auto" }}>
                {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
                  <div
                    key={n}
                    data-page={n}
                    ref={(el) => { pageEls.current[n] = el; }}
                    className={`pv-page${n === current ? " is-current" : ""}`}
                    style={{ width: pageWidth, height: pageHeight(n), marginBottom: PAGE_GAP + 6 }}
                  >
                    <canvas ref={(c) => { canvases.current[n] = c; }} />
                    <span className="pv-page-tag">{n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {doc && numPages > 0 && (
            <span className="pv-float-chip" aria-hidden="true">Page {current} of {numPages}</span>
          )}
        </div>
      </div>
    </div>
  );
}
