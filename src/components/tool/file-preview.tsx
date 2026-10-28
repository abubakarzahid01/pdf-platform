"use client";

import { useEffect, useRef } from "react";
import { PdfPageCanvas } from "@/components/pdf/pdf-page-canvas";
import type { CheckedItem } from "@/components/tool/tool-workspace";

const MAX_PREVIEW_PAGES = 8;

export function FilePreview({ item, showsFirstOf }: { item: CheckedItem; showsFirstOf: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-panel border border-line-soft bg-surface-soft p-6">
      <div className="flex items-center justify-between gap-3">
        <strong className="text-[15px]">Preview</strong>
        <span className="truncate text-[13px] text-muted">
          {showsFirstOf ? "First valid file: " : ""}
          {item.file.name}
        </span>
      </div>
      {item.pdf && item.pageCount ? (
        <PdfPages item={item} />
      ) : item.file.type.startsWith("image/") ? (
        <ImagePreview file={item.file} />
      ) : (
        <p className="text-sm text-muted">A preview of Office files will be available once conversion is built.</p>
      )}
    </div>
  );
}

function PdfPages({ item }: { item: CheckedItem }) {
  const count = item.pageCount ?? 0;
  const shown = Math.min(count, MAX_PREVIEW_PAGES);
  return (
    <>
      <div className="flex items-start gap-5 overflow-x-auto pb-2">
        {Array.from({ length: shown }, (_, i) => i + 1).map((n) => (
          <div key={n} className="flex shrink-0 flex-col items-center gap-2">
            <PdfPageCanvas pdf={item.pdf!} pageNumber={n} width={124} className="rounded shadow-[0_1px_3px_rgb(21_19_43/0.15)]" />
            <span className="text-xs text-muted">Page {n}</span>
          </div>
        ))}
      </div>
      {count > shown && (
        <p className="text-[13px] text-subtle">
          Showing the first {shown} of {count} pages.
        </p>
      )}
    </>
  );
}

function ImagePreview({ file }: { file: File }) {
  const imgRef = useRef<HTMLImageElement>(null);

  // A temporary local URL for the image; released when the file changes or the preview closes.
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    if (imgRef.current) imgRef.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  // eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not an optimisable asset
  return <img ref={imgRef} alt={`Preview of ${file.name}`} className="max-h-64 w-auto self-start rounded border border-line bg-white object-contain" />;
}
