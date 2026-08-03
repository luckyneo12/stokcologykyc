"use client";
import { useState, useEffect, useRef } from "react";

export default function PdfMobileViewer({ url }) {
  const [pdf, setPdf] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    const loadPdf = async () => {
      setLoading(true);
      try {
        const pdfjs = await import('pdfjs-dist');
        const workerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version || '5.7.284'}/build/pdf.worker.min.mjs`;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        
        const loadingTask = pdfjs.getDocument({
          url: url,
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version || '5.7.284'}/cmaps/`,
          cMapPacked: true,
        });
        
        const loadedPdf = await loadingTask.promise;
        if (isCancelled) return;
        setPdf(loadedPdf);
        setNumPages(loadedPdf.numPages);
      } catch (err) {
        console.error("PDF Load Error:", err);
      }
      setLoading(false);
    };
    if (url) loadPdf();
    return () => { isCancelled = true; };
  }, [url]);

  useEffect(() => {
    let isCancelled = false;
    let renderTask = null;

    const renderPage = async () => {
      if (!pdf) return;
      try {
        const page = await pdf.getPage(pageNumber);
        if (isCancelled) return;
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const containerWidth = canvas.parentElement.clientWidth || window.innerWidth - 40;
        const viewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / viewport.width;
        
        // Increase resolution for better quality
        const scaledViewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 2) });
        const context = canvas.getContext('2d');
        
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        
        const renderContext = {
          canvasContext: context,
          viewport: scaledViewport
        };
        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error("Page Render Error:", err);
        }
      }
    };
    renderPage();
    return () => {
      isCancelled = true;
      if (renderTask) renderTask.cancel();
    };
  }, [pdf, pageNumber]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', minHeight: '500px' }}>
      {loading && (
        <div style={{ padding: '80px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="loader" style={{ marginBottom: 16, width: "36px", height: "36px", border: "4px solid var(--border-color)", borderTop: "4px solid var(--wise-green)" }}></div>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Loading Preview...</span>
        </div>
      )}
      
      <div style={{ width: '100%', flex: 1, display: loading ? 'none' : 'flex', justifyContent: 'center', background: '#fff', borderRadius: '24px 24px 0 0', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', width: '100%', objectFit: 'contain' }} />
      </div>
      
      {numPages > 1 && !loading && (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', padding: '16px 20px', background: '#fff', width: '100%', justifyContent: 'center', borderTop: '1px solid rgba(0,0,0,0.05)', borderRadius: '0 0 24px 24px' }}>
          <button 
            disabled={pageNumber <= 1} 
            onClick={() => setPageNumber(p => p - 1)}
            className="btn-secondary"
            style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '0.95rem', opacity: pageNumber <= 1 ? 0.4 : 1, pointerEvents: pageNumber <= 1 ? 'none' : 'auto' }}
          >
            Previous
          </button>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', minWidth: '80px', textAlign: 'center' }}>
            {pageNumber} / {numPages}
          </span>
          <button 
            disabled={pageNumber >= numPages} 
            onClick={() => setPageNumber(p => p + 1)}
            className="btn-secondary"
            style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '0.95rem', opacity: pageNumber >= numPages ? 0.4 : 1, pointerEvents: pageNumber >= numPages ? 'none' : 'auto' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
