"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { LazyPage } from "@/components/pdf/lazy-page";

export type PageSize = { width: number; height: number };

type Props = {
  pdf: PDFDocumentProxy;
  sizes: PageSize[];
  scale: number;
  onPageChange: (page: number) => void;
  // Lets the parent scroll to a page (thumbnails, previous/next buttons).
  scrollToRef: RefObject<((page: number) => void) | null>;
  onContainerWidth: (width: number) => void;
};

const PAGE_GAP = 24;

// Continuous, scrollable view of every page at the given scale.
export function PdfViewer({ pdf, sizes, scale, onPageChange, scrollToRef, onContainerWidth }: Props) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const slots = useRef<(HTMLDivElement | null)[]>([]);
  const frame = useRef(0);

  const scrollTo = useCallback(
    (page: number) => {
      const slot = slots.current[page - 1];
      if (container && slot) container.scrollTo({ top: slot.offsetTop - PAGE_GAP });
    },
    [container],
  );

  useEffect(() => {
    scrollToRef.current = scrollTo;
  }, [scrollTo, scrollToRef]);

  // Report the available width so "fit width" can be calculated. Measured before
  // the first paint so the document never flashes at the wrong size.
  useLayoutEffect(() => {
    if (!container) return;
    onContainerWidth(container.clientWidth);
    const observer = new ResizeObserver(() => onContainerWidth(container.clientWidth));
    observer.observe(container);
    return () => observer.disconnect();
  }, [container, onContainerWidth]);

  // The current page is the one crossing a line one third down the view.
  function handleScroll() {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (!container) return;
      const line = container.scrollTop + container.clientHeight / 3;
      let current = 1;
      slots.current.forEach((slot, i) => {
        if (slot && slot.offsetTop <= line) current = i + 1;
      });
      onPageChange(current);
    });
  }

  return (
    <div ref={setContainer} onScroll={handleScroll} className="relative flex-1 overflow-auto">
      <div className="flex min-w-max flex-col items-center px-6" style={{ gap: PAGE_GAP, paddingBlock: PAGE_GAP }}>
        {sizes.map((size, i) => (
          <div
            key={i}
            ref={(el) => {
              slots.current[i] = el;
            }}
          >
            <LazyPage
              pdf={pdf}
              pageNumber={i + 1}
              width={Math.floor(size.width * scale)}
              height={Math.floor(size.height * scale)}
              root={container}
              className="shadow-[0_2px_6px_rgb(21_19_43/0.06),0_16px_40px_rgb(21_19_43/0.08)]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
