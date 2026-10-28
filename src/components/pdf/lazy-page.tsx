"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { PdfPageCanvas } from "@/components/pdf/pdf-page-canvas";

type Props = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  height: number;
  // The scrolling container; pages render when within about one screen of it.
  root: Element | null;
  className?: string;
};

// A page-sized slot that only renders (and keeps in memory) its canvas while
// near the visible area, so long documents stay fast.
export function LazyPage({ pdf, pageNumber, width, height, root, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !root) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root,
      rootMargin: "100% 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);

  return (
    <div ref={ref} style={{ width, height }} className={`overflow-hidden bg-white ${className ?? ""}`}>
      {near && <PdfPageCanvas pdf={pdf} pageNumber={pageNumber} width={width} />}
    </div>
  );
}
