"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, RotateCw, Trash2, Undo2 } from "lucide-react";
import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { normaliseAngle, type PagePlan } from "@/lib/pdf/operations/organize";
import { PdfPageCanvas } from "@/components/pdf/pdf-page-canvas";
import { LazyMount } from "@/components/pdf/lazy-page";

type Props = {
  pdf: PDFDocumentProxy;
  pageCount: number;
  plan: PagePlan;
  onChange: (plan: PagePlan) => void;
};

const iconButton =
  "flex size-8 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-soft hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent";

export function defaultPlan(pageCount: number): PagePlan {
  return Array.from({ length: pageCount }, (_, source) => ({ source, rotate: 0 }));
}

// Grid of page thumbnails to reorder (drag or arrows), rotate and delete.
export function PageOrganiser({ pdf, pageCount, plan, onChange }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const deleted = pageCount - plan.length;
  const changed = deleted > 0 || plan.some((p, i) => p.source !== i || p.rotate !== 0);

  function moveTo(from: number, to: number) {
    if (from === to || to < 0 || to >= plan.length) return;
    const next = [...plan];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  function rotate(index: number, by: number) {
    onChange(plan.map((p, i) => (i === index ? { ...p, rotate: normaliseAngle(p.rotate + by) } : p)));
  }

  function remove(index: number) {
    onChange(plan.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-4 rounded-panel border border-line-soft bg-surface-soft p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <strong className="text-[15px]">Pages</strong>
          <span className="text-[13px] text-muted">
            Drag pages to reorder, or use the buttons. {plan.length} of {pageCount} pages kept
            {deleted > 0 ? `, ${deleted} deleted` : ""}.
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChange(defaultPlan(pageCount))}
          disabled={!changed}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] font-semibold hover:bg-surface-soft disabled:opacity-40"
        >
          <Undo2 className="size-4" aria-hidden="true" /> Reset changes
        </button>
      </div>

      <ol className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {plan.map((page, i) => (
          <li
            key={`${page.source}-${i}`}
            draggable
            onDragStart={(e) => {
              setDragIndex(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverIndex(i);
            }}
            onDragLeave={() => setOverIndex((o) => (o === i ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null) moveTo(dragIndex, i);
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
            className={`flex cursor-grab flex-col gap-2 rounded-card border bg-surface p-2.5 active:cursor-grabbing ${
              overIndex === i && dragIndex !== i ? "border-brand ring-2 ring-brand-ring" : "border-line"
            } ${dragIndex === i ? "opacity-40" : ""}`}
          >
            <LazyMount className="flex h-[156px] items-center justify-center overflow-hidden">
              <div className="transition-transform duration-200" style={{ transform: `rotate(${page.rotate}deg)` }}>
                <PdfPageCanvas pdf={pdf} pageNumber={page.source + 1} width={104} className="shadow-[0_1px_3px_rgb(21_19_43/0.15)]" />
              </div>
            </LazyMount>
            <div className="flex items-center justify-between gap-1">
              <span className="whitespace-nowrap pl-1 text-xs font-semibold text-ink-soft">
                {i + 1}
                {page.source !== i && <span className="font-normal text-subtle"> (was {page.source + 1})</span>}
              </span>
              <span className="flex">
                <button type="button" onClick={() => moveTo(i, i - 1)} disabled={i === 0} aria-label={`Move page ${i + 1} earlier`} className={iconButton}>
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => moveTo(i, i + 1)} disabled={i === plan.length - 1} aria-label={`Move page ${i + 1} later`} className={iconButton}>
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </span>
            </div>
            <div className="flex justify-between border-t border-line-soft pt-1.5">
              <button type="button" onClick={() => rotate(i, -90)} aria-label={`Rotate page ${i + 1} left`} className={iconButton}>
                <RotateCcw className="size-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => rotate(i, 90)} aria-label={`Rotate page ${i + 1} right`} className={iconButton}>
                <RotateCw className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={plan.length === 1}
                aria-label={`Delete page ${i + 1}`}
                title={plan.length === 1 ? "A PDF needs at least one page" : undefined}
                className={`${iconButton} hover:!bg-danger-soft hover:!text-danger`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
