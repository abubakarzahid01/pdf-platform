"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  Highlighter,
  ImagePlus,
  Link as LinkIcon,
  MessageSquare,
  Minus,
  MousePointer2,
  Pencil,
  PenLine,
  Plus,
  Redo2,
  Shapes,
  Type,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { PrototypeBadge } from "@/components/prototype-badge";
import { PropertiesPanel } from "@/components/editor/properties-panel";
import { PAGE_HEIGHT, PAGE_WIDTH, PageThumb, SAMPLE_PAGE_COUNT, SamplePage } from "@/components/editor/sample-pages";

export type EditorTool =
  | "select"
  | "edit-text"
  | "add-text"
  | "image"
  | "shape"
  | "link"
  | "highlight"
  | "draw"
  | "comment";

const toolGroups: { id: EditorTool; label: string; icon: LucideIcon }[][] = [
  [
    { id: "select", label: "Select", icon: MousePointer2 },
    { id: "edit-text", label: "Edit text", icon: PenLine },
    { id: "add-text", label: "Add text", icon: Type },
    { id: "image", label: "Image", icon: ImagePlus },
    { id: "shape", label: "Shape", icon: Shapes },
    { id: "link", label: "Link", icon: LinkIcon },
  ],
  [
    { id: "highlight", label: "Highlight", icon: Highlighter },
    { id: "draw", label: "Draw", icon: Pencil },
    { id: "comment", label: "Comment", icon: MessageSquare },
  ],
];

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200];

const iconButton =
  "flex size-9 items-center justify-center rounded-[9px] border border-line bg-surface text-ink-soft hover:bg-surface-soft disabled:opacity-40";

export function EditorWorkspace() {
  const [tool, setTool] = useState<EditorTool>("edit-text");
  const [page, setPage] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(2);
  const zoom = ZOOM_LEVELS[zoomIndex];
  const scale = zoom / 100;

  return (
    <div className="flex h-dvh flex-col bg-canvas text-ink">
      {/* Top bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/tools/edit-pdf" aria-label="Back to Edit PDF" className={iconButton}>
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2">
              <strong className="truncate text-[15px] font-semibold">Sample-Quarterly-Report.pdf</strong>
              <PrototypeBadge label="Sample document" />
            </div>
            <span className="text-xs text-subtle">{SAMPLE_PAGE_COUNT} pages · Editing is not functional yet</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Undo" disabled className={iconButton}><Undo2 className="size-4" /></button>
          <button type="button" aria-label="Redo" disabled className={iconButton}><Redo2 className="size-4" /></button>
          <span className="mx-1 h-6 w-px bg-line" />
          <button
            type="button"
            disabled
            title="Download arrives with real PDF editing"
            className="inline-flex items-center gap-2 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="size-4" aria-hidden="true" />
            Download PDF
          </button>
        </div>
      </header>

      {/* Tool bar */}
      <div role="toolbar" aria-label="Editing tools" className="flex items-center gap-0.5 overflow-x-auto border-b border-line bg-surface px-3 py-1.5 lg:justify-center">
        {toolGroups.map((group, gi) => (
          <div key={gi} className="flex items-center gap-0.5">
            {gi > 0 && <span className="mx-1.5 h-8 w-px bg-line" />}
            {group.map((t) => {
              const Icon = t.icon;
              const active = tool === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTool(t.id)}
                  className={`flex min-w-14 flex-col items-center gap-[3px] rounded-[10px] px-2 py-1.5 text-[11px] font-medium ${
                    active ? "bg-brand-soft text-brand-strong" : "text-ink-soft hover:bg-surface-soft"
                  }`}
                >
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  {t.label}
                </button>
              );
            })}
          </div>
        ))}
        <span className="mx-1.5 h-8 w-px bg-line" />
        <button type="button" disabled className="flex min-w-14 flex-col items-center gap-[3px] rounded-[10px] px-2 py-1.5 text-[11px] font-medium text-ink-soft opacity-40">
          <Eraser className="size-5" strokeWidth={1.75} aria-hidden="true" />
          Erase
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Page thumbnails */}
        <aside aria-label="Pages" className="hidden w-[168px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-line bg-surface p-4 md:flex">
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-subtle">Pages</span>
          {Array.from({ length: SAMPLE_PAGE_COUNT }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`Go to page ${n}`}
              aria-current={page === n ? "page" : undefined}
              onClick={() => setPage(n)}
              className="flex flex-col items-center gap-1.5"
            >
              <span className={`rounded-md outline-offset-[3px] ${page === n ? "outline-2 outline-brand outline" : ""}`}>
                <PageThumb />
              </span>
              <span className={`text-xs font-semibold ${page === n ? "text-brand-strong" : "text-subtle"}`}>{n}</span>
            </button>
          ))}
        </aside>

        {/* Document canvas */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-auto p-6 sm:p-8">
            <div className="mx-auto" style={{ width: PAGE_WIDTH * scale, height: PAGE_HEIGHT * scale }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
                <SamplePage page={page} editing={tool === "edit-text" && page === 1} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-line bg-surface p-2.5 text-[13px]">
            <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage(page - 1)} className={iconButton}>
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-muted">
              Page <strong className="text-ink">{page}</strong> of {SAMPLE_PAGE_COUNT}
            </span>
            <button type="button" aria-label="Next page" disabled={page === SAMPLE_PAGE_COUNT} onClick={() => setPage(page + 1)} className={iconButton}>
              <ChevronRight className="size-4" />
            </button>
            <span className="h-6 w-px bg-line" />
            <button type="button" aria-label="Zoom out" disabled={zoomIndex === 0} onClick={() => setZoomIndex(zoomIndex - 1)} className={iconButton}>
              <Minus className="size-4" />
            </button>
            <span className="min-w-12 text-center font-semibold">{zoom}%</span>
            <button type="button" aria-label="Zoom in" disabled={zoomIndex === ZOOM_LEVELS.length - 1} onClick={() => setZoomIndex(zoomIndex + 1)} className={iconButton}>
              <Plus className="size-4" />
            </button>
          </div>
        </main>

        {/* Properties */}
        <aside aria-label="Properties" className="hidden w-[300px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-line bg-surface p-5 lg:flex">
          <PropertiesPanel tool={tool} />
        </aside>
      </div>
    </div>
  );
}
