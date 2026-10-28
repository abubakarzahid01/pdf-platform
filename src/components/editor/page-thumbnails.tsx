"use client";

import { useState } from "react";
import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { LazyPage } from "@/components/pdf/lazy-page";
import type { PageSize } from "@/components/editor/pdf-viewer";

const THUMB_WIDTH = 104;

type Props = {
  pdf: PDFDocumentProxy;
  sizes: PageSize[];
  current: number;
  onSelect: (page: number) => void;
};

export function PageThumbnails({ pdf, sizes, current, onSelect }: Props) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  return (
    <aside
      ref={setContainer}
      aria-label="Pages"
      className="hidden w-[168px] shrink-0 flex-col items-center gap-4 overflow-y-auto border-r border-line bg-surface p-4 md:flex"
    >
      <span className="self-start text-xs font-semibold uppercase tracking-[0.06em] text-subtle">Pages</span>
      {sizes.map((size, i) => {
        const n = i + 1;
        const active = n === current;
        return (
          <button
            key={n}
            type="button"
            aria-label={`Go to page ${n}`}
            aria-current={active ? "page" : undefined}
            onClick={() => onSelect(n)}
            className="flex flex-col items-center gap-1.5"
          >
            <span className={`rounded-sm outline-offset-[3px] ${active ? "outline-2 outline-brand outline" : ""}`}>
              <LazyPage
                pdf={pdf}
                pageNumber={n}
                width={THUMB_WIDTH}
                height={Math.round((size.height / size.width) * THUMB_WIDTH)}
                root={container}
                className="shadow-[0_1px_3px_rgb(21_19_43/0.15)]"
              />
            </span>
            <span className={`text-xs font-semibold ${active ? "text-brand-strong" : "text-subtle"}`}>{n}</span>
          </button>
        );
      })}
    </aside>
  );
}
