"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  FolderOpen,
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
import { clearPendingDocument, peekPendingDocument, type OpenDocument } from "@/lib/files/pending-document";
import { closePdf, type PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { formatSize } from "@/components/selected-files";
import { PrototypeBadge } from "@/components/prototype-badge";
import { PropertiesPanel } from "@/components/editor/properties-panel";
import { PdfViewer, type PageSize } from "@/components/editor/pdf-viewer";
import { PageThumbnails } from "@/components/editor/page-thumbnails";
import { OpenFileScreen } from "@/components/editor/open-file-screen";

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

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const FIT_PADDING = 48;

const iconButton =
  "flex size-9 items-center justify-center rounded-[9px] border border-line bg-surface text-ink-soft hover:bg-surface-soft disabled:opacity-40";

// Documents scheduled to close. Closing is delayed so React's development
// double-mount check doesn't close a document that is still in use.
const closeTimers = new Map<PDFDocumentProxy, number>();

export function EditorWorkspace() {
  const [doc, setDoc] = useState<OpenDocument | null>(() => peekPendingDocument());

  useEffect(() => {
    if (!doc) return;
    clearPendingDocument(doc);
    window.clearTimeout(closeTimers.get(doc.pdf));
    closeTimers.delete(doc.pdf);
    return () => {
      closeTimers.set(doc.pdf, window.setTimeout(() => closePdf(doc.pdf), 1000));
    };
  }, [doc]);

  if (!doc) return <OpenFileScreen onOpen={setDoc} />;
  return <Editor key={doc.pdf.fingerprints[0] ?? doc.file.name} doc={doc} onClose={() => setDoc(null)} />;
}

function Editor({ doc, onClose }: { doc: OpenDocument; onClose: () => void }) {
  const [tool, setTool] = useState<EditorTool>("select");
  const [sizes, setSizes] = useState<PageSize[] | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollToRef = useRef<((page: number) => void) | null>(null);
  const pageRef = useRef(1);

  // Read every page's size (rotation included) so the layout is stable before rendering.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      Array.from({ length: doc.pageCount }, (_, i) =>
        doc.pdf.getPage(i + 1).then((p) => {
          const v = p.getViewport({ scale: 1 });
          return { width: v.width, height: v.height };
        }),
      ),
    ).then((result) => {
      if (!cancelled) setSizes(result);
    });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  const widest = sizes ? Math.max(...sizes.map((s) => s.width)) : 1;
  const fitScale = containerWidth > 0 ? Math.min(3, Math.max(0.25, (containerWidth - FIT_PADDING) / widest)) : 1;
  const scale = zoom === "fit" ? fitScale : zoom;

  // Keep the current page in view when the zoom changes.
  useEffect(() => {
    scrollToRef.current?.(pageRef.current);
  }, [scale]);

  const handlePageChange = useCallback((p: number) => {
    pageRef.current = p;
    setPage(p);
  }, []);

  function goTo(p: number) {
    const target = Math.min(doc.pageCount, Math.max(1, p));
    handlePageChange(target);
    scrollToRef.current?.(target);
  }

  function zoomIn() {
    setZoom(ZOOM_LEVELS.find((z) => z > scale + 0.01) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1]);
  }

  function zoomOut() {
    setZoom([...ZOOM_LEVELS].reverse().find((z) => z < scale - 0.01) ?? ZOOM_LEVELS[0]);
  }

  function download() {
    const url = URL.createObjectURL(doc.file);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.file.name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <div className="flex h-dvh flex-col bg-canvas text-ink">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/tools/edit-pdf" aria-label="Back to Edit PDF" className={iconButton}>
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex min-w-0 flex-col">
            <strong className="truncate text-[15px] font-semibold">{doc.file.name}</strong>
            <span className="text-xs text-subtle">
              {doc.pageCount} page{doc.pageCount > 1 ? "s" : ""} · {formatSize(doc.file.size)} · No changes yet
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Undo" disabled className={iconButton}><Undo2 className="size-4" /></button>
          <button type="button" aria-label="Redo" disabled className={iconButton}><Redo2 className="size-4" /></button>
          <span className="mx-1 h-6 w-px bg-line" />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-sm font-medium hover:bg-surface-soft"
          >
            <FolderOpen className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Open another</span>
          </button>
          <button
            type="button"
            onClick={download}
            title="No edits have been made, so this downloads your original file."
            className="inline-flex items-center gap-2 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
          >
            <Download className="size-4" aria-hidden="true" />
            Download PDF
          </button>
        </div>
      </header>

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
        {sizes && <PageThumbnails pdf={doc.pdf} sizes={sizes} current={page} onSelect={goTo} />}

        <main className="flex min-w-0 flex-1 flex-col">
          {sizes ? (
            <PdfViewer
              pdf={doc.pdf}
              sizes={sizes}
              scale={scale}
              onPageChange={handlePageChange}
              scrollToRef={scrollToRef}
              onContainerWidth={setContainerWidth}
            />
          ) : (
            <div role="status" className="flex flex-1 items-center justify-center text-sm text-subtle">
              Opening document…
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-line bg-surface p-2.5 text-[13px]">
            <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => goTo(page - 1)} className={iconButton}>
              <ChevronLeft className="size-4" />
            </button>
            <label className="flex items-center gap-2 text-muted">
              Page
              <input
                key={page}
                defaultValue={page}
                inputMode="numeric"
                aria-label="Current page"
                onKeyDown={(e) => {
                  if (e.key === "Enter") goTo(Number(e.currentTarget.value) || page);
                }}
                onBlur={(e) => goTo(Number(e.currentTarget.value) || page)}
                className="w-12 rounded-lg border border-line px-1.5 py-1.5 text-center font-semibold text-ink"
              />
              of {doc.pageCount}
            </label>
            <button type="button" aria-label="Next page" disabled={page >= doc.pageCount} onClick={() => goTo(page + 1)} className={iconButton}>
              <ChevronRight className="size-4" />
            </button>
            <span className="h-6 w-px bg-line" />
            <button type="button" aria-label="Zoom out" disabled={scale <= ZOOM_LEVELS[0] + 0.01} onClick={zoomOut} className={iconButton}>
              <Minus className="size-4" />
            </button>
            <span className="min-w-12 text-center font-semibold" aria-live="polite">
              {Math.round(scale * 100)}%
            </span>
            <button type="button" aria-label="Zoom in" disabled={scale >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1] - 0.01} onClick={zoomIn} className={iconButton}>
              <Plus className="size-4" />
            </button>
            <button
              type="button"
              aria-pressed={zoom === "fit"}
              onClick={() => setZoom("fit")}
              className={`rounded-[9px] border px-3 py-2 font-medium ${
                zoom === "fit" ? "border-brand-ring bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink hover:bg-surface-soft"
              }`}
            >
              Fit width
            </button>
          </div>
        </main>

        <aside aria-label="Properties" className="hidden w-[300px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-line bg-surface p-5 lg:flex">
          <div className="flex items-center justify-between">
            <strong className="text-[15px]">{toolGroups.flat().find((t) => t.id === tool)?.label}</strong>
            <PrototypeBadge label="Not functional yet" />
          </div>
          <PropertiesPanel tool={tool} />
        </aside>
      </div>
    </div>
  );
}
