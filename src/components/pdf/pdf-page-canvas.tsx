"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";

type Props = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  // Display width in CSS pixels; height follows the page's own proportions.
  width: number;
  className?: string;
};

// Renders one PDF page into a canvas, sharp on high-density screens.
export function PdfPageCanvas({ pdf, pageNumber, width, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;

    pdf
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled || !canvasRef.current) return;
        const base = page.getViewport({ scale: 1 });
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: (width / base.width) * dpr });
        const canvas = canvasRef.current;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
        renderTask = page.render({ canvas, viewport });
        return renderTask.promise;
      })
      .catch((error: unknown) => {
        // A cancelled render (component unmounted or re-rendered) is expected, not a failure.
        if (!cancelled && !(error instanceof Error && error.name === "RenderingCancelledException")) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, width]);

  if (failed) {
    return (
      <div
        style={{ width, height: width * 1.3 }}
        className={`flex items-center justify-center bg-surface p-2 text-center text-xs text-danger ${className ?? ""}`}
      >
        Page {pageNumber} couldn&apos;t be displayed
      </div>
    );
  }

  return <canvas ref={canvasRef} aria-label={`Page ${pageNumber}`} role="img" className={`bg-white ${className ?? ""}`} />;
}
