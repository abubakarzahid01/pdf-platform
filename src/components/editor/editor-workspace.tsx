"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { AnnotationLayer } from "@/components/editor/annotation-layer";
import {
  defaultTextStyle,
  highlightColors,
  inkColors,
  newId,
  toPdfAnnotation,
  toPdfImage,
  toPdfText,
  translate,
  type NewAnnotation,
  type TextStyle,
  type ViewAnnotation,
} from "@/components/editor/annotations";
import { applyEdits } from "@/lib/pdf/operations/edits";
import { downloadBytes } from "@/lib/files/download";
import { prepareImage } from "@/lib/files/prepare-image";

// Tools that work now; the others arrive later in Phase 5.
const workingTools = new Set<EditorTool>(["select", "add-text", "image", "highlight", "draw", "comment"]);

// New images start at most this share of the page's width and height.
const IMAGE_MAX_SHARE = 0.4;

type History = { past: ViewAnnotation[][]; present: ViewAnnotation[]; future: ViewAnnotation[][] };

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

  const [history, setHistory] = useState<History>({ past: [], present: [], future: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightColor, setHighlightColor] = useState(highlightColors[0]);
  const [inkColor, setInkColor] = useState(inkColors[2]);
  const [inkWidth, setInkWidth] = useState(3);
  const [textStyle, setTextStyle] = useState<TextStyle>(defaultTextStyle);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  // Where the next chosen image goes; no x/y means the middle of the page.
  const pendingImage = useRef<{ page: number; x?: number; y?: number } | null>(null);
  // Local preview URLs for images; released when the editor closes (undo may still need them before).
  const imageUrls = useRef<string[]>([]);

  useEffect(() => {
    const urls = imageUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const annotations = history.present;
  const selected = annotations.find((a) => a.id === selectedId) ?? null;
  const byPage = useMemo(() => {
    const map = new Map<number, ViewAnnotation[]>();
    for (const a of annotations) map.set(a.page, [...(map.get(a.page) ?? []), a]);
    return map;
  }, [annotations]);

  const commit = useCallback((next: ViewAnnotation[]) => {
    setHistory((h) => ({ past: [...h.past, h.present], present: next, future: [] }));
    setSaveError(null);
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h));
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));
  }, []);

  function addAnnotation(a: NewAnnotation) {
    const item = { ...a, id: newId() } as ViewAnnotation;
    commit([...annotations, item]);
    // Comments and text need typing, and images usually need positioning: select them and
    // switch to Select so the next click works on them instead of adding another item.
    if (item.type === "comment" || item.type === "text" || item.type === "image") {
      setSelectedId(item.id);
      setTool("select");
    }
    if (item.type === "text") setEditingId(item.id);
  }

  function moveAnnotation(id: string, dx: number, dy: number) {
    commit(annotations.map((a) => (a.id === id ? translate(a, dx, dy) : a)));
  }

  function resizeAnnotation(id: string, w: number, h: number) {
    commit(annotations.map((a) => (a.id === id && a.type === "image" ? { ...a, w, h } : a)));
  }

  function requestImage(page: number, x?: number, y?: number) {
    pendingImage.current = { page, x, y };
    setImageError(null);
    imageInputRef.current?.click();
  }

  async function placeImage(file: File) {
    const target = pendingImage.current;
    pendingImage.current = null;
    if (!target || !sizes) return;
    const result = await prepareImage(file);
    if (!result.ok) {
      setImageError(result.message);
      setTool("image");
      return;
    }
    const { image } = result;
    const pageSize = sizes[target.page];
    // Start at the image's natural size (1 pixel = 1 point), shrunk to fit if large.
    const fit = Math.min(1, (pageSize.width * IMAGE_MAX_SHARE) / image.width, (pageSize.height * IMAGE_MAX_SHARE) / image.height);
    const w = image.width * fit;
    const h = image.height * fit;
    const cx = target.x ?? pageSize.width / 2;
    const cy = target.y ?? pageSize.height / 2;
    const src = URL.createObjectURL(new Blob([image.bytes as BlobPart], { type: `image/${image.format}` }));
    imageUrls.current.push(src);
    addAnnotation({
      type: "image",
      page: target.page,
      // Centre on the click, kept inside the page.
      x: Math.min(Math.max(0, cx - w / 2), pageSize.width - w),
      y: Math.min(Math.max(0, cy - h / 2), pageSize.height - h),
      w,
      h,
      src,
      bytes: image.bytes,
      format: image.format,
      name: file.name,
    });
  }

  // Leaving a text box: an empty one is removed (no undo step, as it never held anything).
  function finishEditing(id: string | null) {
    if (id === null && editingId) {
      const item = annotations.find((a) => a.id === editingId);
      if (item?.type === "text" && !item.text.trim()) {
        setHistory((h) => ({ ...h, present: h.present.filter((a) => a.id !== item.id) }));
        setSelectedId(null);
      }
    }
    setEditingId(id);
  }

  function changeTextStyle(patch: Partial<TextStyle>) {
    if (selected?.type === "text") {
      commit(annotations.map((a) => (a.id === selected.id ? { ...a, ...patch } : a)));
    }
    setTextStyle((s) => ({ ...s, ...patch }));
  }

  const deleteAnnotation = useCallback(
    (id: string) => {
      commit(annotations.filter((a) => a.id !== id));
      setSelectedId(null);
    },
    [annotations, commit],
  );

  // Typing edits text in place; it isn't recorded as a separate undo step per key.
  function setItemText(id: string, text: string) {
    setHistory((h) => ({
      ...h,
      present: h.present.map((a) => (a.id === id && (a.type === "comment" || a.type === "text") ? { ...a, text } : a)),
    }));
  }

  // Keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable=true]")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteAnnotation(selectedId);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, deleteAnnotation, selectedId]);

  // Warn before leaving with annotations that haven't been downloaded.
  const unsaved = annotations.length > 0;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  // Read every page's size (rotation included) so the layout is stable before rendering.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      Array.from({ length: doc.pageCount }, (_, i) =>
        doc.pdf.getPage(i + 1).then((p) => {
          const v = p.getViewport({ scale: 1 });
          return { width: v.width, height: v.height, viewport: v };
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

  async function download() {
    if (annotations.length === 0 || !sizes) {
      downloadBytes(doc.file, doc.file.name);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const viewport = (page: number) => sizes[page].viewport!;
      const texts = annotations.flatMap((a) => (a.type === "text" ? [toPdfText(a, viewport(a.page))] : []));
      const images = annotations.flatMap((a) => (a.type === "image" ? [toPdfImage(a, viewport(a.page))] : []));
      const pdfAnnotations = annotations.flatMap((a) =>
        a.type !== "text" && a.type !== "image" ? [toPdfAnnotation(a, viewport(a.page))] : [],
      );
      // The font files are only fetched when text is being saved.
      const { browserFontLoader } = await import("@/lib/pdf/fonts-browser");
      const result = await applyEdits(
        { name: doc.file.name, bytes: new Uint8Array(await doc.file.arrayBuffer()) },
        { texts, images, annotations: pdfAnnotations },
        browserFontLoader,
      );
      downloadBytes(result.bytes, result.name);
      if (result.substitutions > 0) {
        setSaveNotice(
          `${result.substitutions} text box${result.substitutions > 1 ? "es use" : " uses"} characters the chosen font can't show, so Inter was used instead.`,
        );
      }
    } catch {
      setSaveError("The edited PDF couldn't be created. Your changes are still here; please try again.");
    } finally {
      setSaving(false);
    }
  }

  function closeDocument() {
    if (unsaved && !window.confirm("Your annotations haven't been downloaded. Close this PDF anyway?")) return;
    onClose();
  }

  const emptyComments = annotations.filter((a) => a.type === "comment" && !a.text.trim()).length;

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
              {doc.pageCount} page{doc.pageCount > 1 ? "s" : ""} · {formatSize(doc.file.size)} ·{" "}
              {annotations.length === 0
                ? "No changes yet"
                : `${annotations.length} change${annotations.length > 1 ? "s" : ""}, saved when you download`}
            </span>
            {saveError && <span role="alert" className="text-xs text-danger">{saveError}</span>}
            {saveNotice && <span role="status" className="text-xs text-info-strong">{saveNotice}</span>}
            {!saveError && emptyComments > 0 && (
              <span className="text-xs text-warn">
                {emptyComments} empty comment{emptyComments > 1 ? "s" : ""} won&apos;t be saved
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={history.past.length === 0} onClick={undo} className={iconButton}>
            <Undo2 className="size-4" />
          </button>
          <button type="button" aria-label="Redo" title="Redo (Ctrl+Y)" disabled={history.future.length === 0} onClick={redo} className={iconButton}>
            <Redo2 className="size-4" />
          </button>
          <span className="mx-1 h-6 w-px bg-line" />
          <button
            type="button"
            onClick={closeDocument}
            className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-sm font-medium hover:bg-surface-soft"
          >
            <FolderOpen className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Open another</span>
          </button>
          <button
            type="button"
            onClick={download}
            disabled={saving}
            title={annotations.length === 0 ? "No changes yet, so this downloads your original file." : "Downloads a copy with your annotations."}
            className="inline-flex items-center gap-2 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
          >
            <Download className="size-4" aria-hidden="true" />
            {saving ? "Saving…" : "Download PDF"}
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
                  onClick={() => {
                    // Picking a tool starts something new: finish typing and clear the selection,
                    // so style changes apply to the next item, not the previously selected one.
                    if (editingId) finishEditing(null);
                    if (t.id !== "select") setSelectedId(null);
                    setTool(t.id);
                  }}
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
              renderOverlay={(i) => (
                <AnnotationLayer
                  page={i}
                  width={sizes[i].width}
                  height={sizes[i].height}
                  scale={scale}
                  tool={tool}
                  items={byPage.get(i) ?? []}
                  selectedId={selectedId}
                  editingId={editingId}
                  highlightColor={highlightColor}
                  inkColor={inkColor}
                  inkWidth={inkWidth}
                  textStyle={textStyle}
                  onCreate={addAnnotation}
                  onSelect={setSelectedId}
                  onMove={moveAnnotation}
                  onEdit={finishEditing}
                  onText={setItemText}
                  onRequestImage={requestImage}
                  onResize={resizeAnnotation}
                />
              )}
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
            {!workingTools.has(tool) && <PrototypeBadge label="Not functional yet" />}
          </div>
          <PropertiesPanel
            tool={tool}
            selected={selected}
            highlightColor={highlightColor}
            inkColor={inkColor}
            inkWidth={inkWidth}
            onHighlightColor={setHighlightColor}
            onInkColor={setInkColor}
            onInkWidth={setInkWidth}
            onCommentText={setItemText}
            onDelete={deleteAnnotation}
            textStyle={textStyle}
            onTextStyle={changeTextStyle}
            onChooseImage={() => requestImage(pageRef.current - 1)}
            imageError={imageError}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
            aria-label="Choose image"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) placeImage(file);
            }}
          />
        </aside>
      </div>
    </div>
  );
}
