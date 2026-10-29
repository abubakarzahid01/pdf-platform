"use client";

import { Bold, Info, Italic, Trash2 } from "lucide-react";
import {
  describe,
  fontFamilies,
  highlightColors,
  inkColors,
  inkWidths,
  normaliseUrl,
  shapeKinds,
  textColors,
  textSizes,
  type ShapeStyle,
  type TextStyle,
  type ViewAnnotation,
} from "@/components/editor/annotations";
import type { FontFamily } from "@/lib/pdf/operations/edits";
import type { EditorTool } from "@/components/editor/editor-workspace";

type Props = {
  tool: EditorTool;
  selected: ViewAnnotation | null;
  highlightColor: string;
  inkColor: string;
  inkWidth: number;
  onHighlightColor: (c: string) => void;
  onInkColor: (c: string) => void;
  onInkWidth: (w: number) => void;
  onCommentText: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  // Style for new text boxes, or the selected one.
  textStyle: TextStyle;
  onTextStyle: (patch: Partial<TextStyle>) => void;
  onChooseImage: () => void;
  imageError: string | null;
  shapeStyle: ShapeStyle;
  onShapeStyle: (patch: Partial<ShapeStyle>) => void;
  onLinkChange: (id: string, patch: { mode?: "url" | "page"; url?: string; targetPage?: number }) => void;
  pageCount: number;
  // Edit text tool: whether lines are being found, and what was found on the current page.
  textLinesStatus: { loading: boolean; editableOnPage: number; problem?: string; page: number };
};

const comingLater: Partial<Record<EditorTool, string>> = {};

function EditTextHelp({ status }: { status: Props["textLinesStatus"] }) {
  return (
    <>
      <p className="text-sm text-muted">Click a line of text on the page to change it. Press Enter or Esc when done.</p>
      {status.loading ? (
        <p role="status" className="text-sm text-subtle">Finding text on the pages…</p>
      ) : status.problem ? (
        <p className="rounded-[10px] border border-warn/25 bg-warn-soft px-3 py-2 text-sm text-warn">{status.problem}</p>
      ) : status.editableOnPage === 0 ? (
        <p className="rounded-[10px] border border-warn/25 bg-warn-soft px-3 py-2 text-sm text-warn">
          No editable text on page {status.page + 1}. If it&apos;s a scanned page, its text is an image and can&apos;t be edited here. PDF to Text and Invoice to Excel can read it with text recognition (OCR).
        </p>
      ) : (
        <p className="text-xs text-subtle">
          {status.editableOnPage} editable line{status.editableOnPage > 1 ? "s" : ""} on page {status.page + 1}. Hover to see them.
        </p>
      )}
      <div className="flex gap-2.5 rounded-xl bg-info-soft p-3.5 text-[13px] leading-normal text-info-strong">
        <Info className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
        <span>
          When you download, the original line is removed from the PDF (not covered up) and your text is written in its
          place, in the original font when it has all your letters. Every change is checked before the file is created.
        </span>
      </div>
      <p className="text-xs text-subtle">
        Not yet supported: rotated or slanted text, text inside embedded graphics, and right-to-left scripts. Text
        doesn&apos;t reflow, so a much longer line may run past its space.
      </p>
    </>
  );
}

function ShapeControls({ style, onChange }: { style: ShapeStyle; onChange: (patch: Partial<ShapeStyle>) => void }) {
  const closed = style.kind === "rect" || style.kind === "ellipse";
  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs font-semibold text-muted">Shape</legend>
        <div className="grid grid-cols-2 gap-1 rounded-[11px] bg-[#f2f2f7] p-1">
          {shapeKinds.map((k) => (
            <button
              key={k.value}
              type="button"
              aria-pressed={style.kind === k.value}
              onClick={() => onChange({ kind: k.value })}
              className={`min-h-9 rounded-lg text-[13px] ${style.kind === k.value ? "bg-surface font-semibold shadow-card" : "font-medium text-muted"}`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </fieldset>
      <Swatches label="Colour" colors={inkColors} value={style.color} onChange={(color) => onChange({ color })} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs font-semibold text-muted">Line width</legend>
        <div className="flex gap-1 rounded-[11px] bg-[#f2f2f7] p-1">
          {inkWidths.map((w) => (
            <button
              key={w.value}
              type="button"
              aria-pressed={style.lineWidth === w.value}
              onClick={() => onChange({ lineWidth: w.value })}
              className={`min-h-9 flex-1 rounded-lg text-[13px] ${style.lineWidth === w.value ? "bg-surface font-semibold shadow-card" : "font-medium text-muted"}`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </fieldset>
      {closed && (
        <label className="flex items-center gap-2.5 rounded-[10px] border border-line px-3 py-2.5 text-sm font-medium text-ink">
          <input type="checkbox" checked={style.fill} onChange={(e) => onChange({ fill: e.target.checked })} className="size-4 accent-brand" />
          Light fill in the same colour
        </label>
      )}
    </>
  );
}

function LinkControls({
  link,
  pageCount,
  onChange,
}: {
  link: Extract<ViewAnnotation, { type: "link" }>;
  pageCount: number;
  onChange: (patch: { mode?: "url" | "page"; url?: string; targetPage?: number }) => void;
}) {
  const valid = link.mode === "page" ? link.targetPage < pageCount : normaliseUrl(link.url) !== null;
  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs font-semibold text-muted">Link goes to</legend>
        <div className="flex gap-1 rounded-[11px] bg-[#f2f2f7] p-1">
          {(
            [
              { value: "url", label: "Web or email" },
              { value: "page", label: "A page here" },
            ] as const
          ).map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={link.mode === m.value}
              onClick={() => onChange({ mode: m.value })}
              className={`min-h-9 flex-1 rounded-lg text-[13px] ${link.mode === m.value ? "bg-surface font-semibold shadow-card" : "font-medium text-muted"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>
      {link.mode === "url" ? (
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
          Address
          <input
            autoFocus={!link.url}
            value={link.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="example.com or name@example.com"
            className="rounded-[9px] border border-line px-2.5 py-2 text-sm font-normal text-ink"
          />
        </label>
      ) : (
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
          Page
          <select
            value={link.targetPage}
            onChange={(e) => onChange({ targetPage: Number(e.target.value) })}
            className="rounded-[9px] border border-line bg-surface px-2.5 py-2 text-sm font-normal text-ink"
          >
            {Array.from({ length: pageCount }, (_, i) => (
              <option key={i} value={i}>
                Page {i + 1}
              </option>
            ))}
          </select>
        </label>
      )}
      {valid ? (
        <span className="text-xs text-success">
          {link.mode === "page" ? `Opens page ${link.targetPage + 1}.` : `Opens ${normaliseUrl(link.url)}`}
        </span>
      ) : (
        <span className="text-xs text-warn">
          {link.url.trim() ? "Use a web address (https://…) or an email address. Other link types aren't allowed." : "Add an address. Links without one aren't saved."}
        </span>
      )}
    </>
  );
}

function Swatches({ colors, value, onChange, label }: { colors: string[]; value: string; onChange: (c: string) => void; label: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs font-semibold text-muted">{label}</legend>
      <div className="flex gap-2">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Colour ${c}`}
            aria-pressed={value === c}
            onClick={() => onChange(c)}
            className={`size-9 rounded-full border-2 ${value === c ? "border-brand ring-2 ring-brand-ring" : "border-white shadow-[0_0_0_1px_var(--color-line)]"}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </fieldset>
  );
}

function TextControls({ style, onChange }: { style: TextStyle; onChange: (patch: Partial<TextStyle>) => void }) {
  const toggle = "flex size-9 items-center justify-center rounded-[9px] border";
  return (
    <>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
        Font
        <select
          value={style.family}
          onChange={(e) => onChange({ family: e.target.value as FontFamily })}
          className="rounded-[9px] border border-line bg-surface px-2.5 py-2 text-sm font-normal text-ink"
        >
          {fontFamilies.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1.5 text-xs font-semibold text-muted">
          Size
          <select
            value={style.size}
            onChange={(e) => onChange({ size: Number(e.target.value) })}
            className="rounded-[9px] border border-line bg-surface px-2.5 py-2 text-sm font-normal text-ink"
          >
            {textSizes.map((s) => (
              <option key={s} value={s}>
                {s} pt
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label="Bold"
          aria-pressed={style.bold}
          onClick={() => onChange({ bold: !style.bold })}
          className={`${toggle} ${style.bold ? "border-brand-ring bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink-soft"}`}
        >
          <Bold className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Italic"
          aria-pressed={style.italic}
          onClick={() => onChange({ italic: !style.italic })}
          className={`${toggle} ${style.italic ? "border-brand-ring bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink-soft"}`}
        >
          <Italic className="size-4" aria-hidden="true" />
        </button>
      </div>
      <Swatches label="Colour" colors={textColors} value={style.color} onChange={(color) => onChange({ color })} />
      {style.family !== "inter" && (
        <p className="text-xs text-subtle">
          Standard fonts cover Western European letters. Text with other characters is saved in Inter instead.
        </p>
      )}
    </>
  );
}

function Shortcuts() {
  return (
    <p className="border-t border-line-soft pt-4 text-xs leading-relaxed text-subtle">
      Shortcuts: Ctrl+Z undo · Ctrl+Y redo · Delete removes the selected item · Esc deselects
    </p>
  );
}

export function PropertiesPanel(props: Props) {
  const { tool, selected } = props;

  if (selected) {
    return (
      <>
        <div className="flex flex-col gap-1">
          <strong className="text-sm">Selected: {describe(selected).toLowerCase()}</strong>
          <span className="text-xs text-subtle">Page {selected.page + 1}</span>
        </div>
        {selected.type === "lineEdit" && (
          <div className="flex flex-col gap-2 text-xs text-subtle">
            <span>
              Original: <span className="text-ink-soft">“{selected.original}”</span>
            </span>
            <span>
              New: <span className="text-ink-soft">{selected.text ? `“${selected.text}”` : "(line removed)"}</span>
            </span>
            {selected.text.length > selected.original.length * 1.3 + 3 && (
              <span className="text-warn">This line is much longer than the original and may run into nearby text.</span>
            )}
            <span>Double-click the text to change it again.</span>
          </div>
        )}
        {selected.type === "shape" && <ShapeControls style={selected} onChange={props.onShapeStyle} />}
        {selected.type === "link" && (
          <LinkControls link={selected} pageCount={props.pageCount} onChange={(patch) => props.onLinkChange(selected.id, patch)} />
        )}
        {selected.type === "image" && (
          <div className="flex flex-col gap-1 text-xs text-subtle">
            <span className="truncate text-sm text-ink-soft">{selected.name}</span>
            <span>
              {Math.round(selected.w)} × {Math.round(selected.h)} pt · drag the image to move it, drag the corner handle to resize. Proportions are kept.
            </span>
          </div>
        )}
        {selected.type === "text" && (
          <>
            <p className="text-xs text-subtle">Double-click the text on the page to change it. Drag it to move it.</p>
            <TextControls style={selected} onChange={props.onTextStyle} />
          </>
        )}
        {selected.type === "comment" && (
          <label className="flex flex-col gap-2 text-xs font-semibold text-muted">
            Comment
            <textarea
              // Focus new comments straight away so the user can type.
              autoFocus={!selected.text}
              rows={5}
              value={selected.text}
              onChange={(e) => props.onCommentText(selected.id, e.target.value)}
              placeholder="Type your comment…"
              className="resize-y rounded-[10px] border border-line p-2.5 text-sm font-normal text-ink"
            />
            {!selected.text.trim() && <span className="font-normal text-warn">Empty comments aren&apos;t saved in the PDF.</span>}
          </label>
        )}
        <button
          type="button"
          onClick={() => props.onDelete(selected.id)}
          className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-danger/25 bg-danger-soft px-3 py-2.5 text-sm font-semibold text-danger hover:border-danger/50"
        >
          <Trash2 className="size-4" aria-hidden="true" />{" "}
          {selected.type === "lineEdit" ? "Undo this change (keep the original)" : `Delete ${describe(selected).toLowerCase()}`}
        </button>
        <Shortcuts />
      </>
    );
  }

  switch (tool) {
    case "select":
      return (
        <>
          <p className="text-sm text-muted">Click an item you added to select it. Drag to move it; double-click text to change it.</p>
          <Shortcuts />
        </>
      );
    case "highlight":
      return (
        <>
          <p className="text-sm text-muted">Drag over the area you want to highlight.</p>
          <Swatches label="Colour" colors={highlightColors} value={props.highlightColor} onChange={props.onHighlightColor} />
          <Shortcuts />
        </>
      );
    case "draw":
      return (
        <>
          <p className="text-sm text-muted">Draw freehand with your mouse, pen or finger.</p>
          <Swatches label="Colour" colors={inkColors} value={props.inkColor} onChange={props.onInkColor} />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-semibold text-muted">Line width</legend>
            <div className="flex gap-1 rounded-[11px] bg-[#f2f2f7] p-1">
              {inkWidths.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  aria-pressed={props.inkWidth === w.value}
                  onClick={() => props.onInkWidth(w.value)}
                  className={`min-h-9 flex-1 rounded-lg text-[13px] ${props.inkWidth === w.value ? "bg-surface font-semibold shadow-card" : "font-medium text-muted"}`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </fieldset>
          <Shortcuts />
        </>
      );
    case "comment":
      return (
        <>
          <p className="text-sm text-muted">Click on the page where you want a comment, then type it here.</p>
          <Shortcuts />
        </>
      );
    case "edit-text":
      return (
        <>
          <EditTextHelp status={props.textLinesStatus} />
          <Shortcuts />
        </>
      );
    case "shape":
      return (
        <>
          <p className="text-sm text-muted">Drag on the page to draw. Shapes become part of the page and stay sharp at any zoom.</p>
          <ShapeControls style={props.shapeStyle} onChange={props.onShapeStyle} />
          <Shortcuts />
        </>
      );
    case "link":
      return (
        <>
          <p className="text-sm text-muted">
            Drag over the area that should be clickable, for example a word or a button. Then choose where it goes.
          </p>
          <p className="text-xs text-subtle">The blue box only shows in the editor; in the saved PDF the area is invisible but clickable.</p>
          <Shortcuts />
        </>
      );
    case "image":
      return (
        <>
          <p className="text-sm text-muted">Click on the page where the image should go, or add it to the middle of the current page.</p>
          <button
            type="button"
            onClick={props.onChooseImage}
            className="rounded-[10px] bg-brand px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
          >
            Choose image…
          </button>
          <p className="text-xs text-subtle">PNG, JPG, WEBP, GIF or BMP, up to 20 MB. Photos keep their original quality.</p>
          {props.imageError && (
            <p role="alert" className="rounded-[10px] border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
              {props.imageError}
            </p>
          )}
          <Shortcuts />
        </>
      );
    case "add-text":
      return (
        <>
          <p className="text-sm text-muted">Click on the page and start typing. Press Enter for a new line, Esc when done.</p>
          <TextControls style={props.textStyle} onChange={props.onTextStyle} />
          <Shortcuts />
        </>
      );
    default:
      return (
        <>
          <p className="text-sm text-muted">{comingLater[tool]}</p>
          <div className="flex gap-2.5 rounded-xl bg-info-soft p-3.5 text-[13px] leading-normal text-info-strong">
            <Info className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
            <span>This tool isn&apos;t available yet.</span>
          </div>
        </>
      );
  }
}
