"use client";

import { useEffect, useRef, useState } from "react";

interface PdfThumbnailProps {
  url: string;
  width?: number;
}

// Lazy-import pdf.js so it isn't bundled into the SSR/initial chunk.
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  }
  return pdfjs;
}

export function PdfThumbnail({ url, width = 240 }: PdfThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        const page = await doc.getPage(1);

        const viewport = page.getViewport({ scale: 1 });
        const scale = width / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        await page.render({
          canvasContext: ctx,
          viewport: scaledViewport,
          canvas,
        }).promise;

        if (!cancelled) setLoading(false);
      } catch (err) {
        console.error("PDF thumbnail error:", err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, width]);

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-red-50 text-red-400 text-xs">
        PDF preview failed
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse" />
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain bg-white"
      />
    </div>
  );
}
