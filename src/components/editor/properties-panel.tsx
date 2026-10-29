"use client";

import { Bold, Info, Italic, Trash2 } from "lucide-react";
import {
  describe,
  fontFamilies,
  highlightColors,
  inkColors,
  inkWidths,
  textColors,
  textSizes,
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
};

const comingLater: Partial<Record<EditorTool, string>> = {
  "edit-text": "Click existing text to change it. The original text is removed and rewritten, never covered with a white box.",
  image: "Upload an image, then place and resize it on the page.",
  shape: "Draw rectangles, circles, lines and arrows.",
  link: "Drag over an area to turn it into a clickable link.",
};

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
          <Trash2 className="size-4" aria-hidden="true" /> Delete {describe(selected).toLowerCase()}
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
            <span>This tool arrives later in Phase 5. Add text, highlight, draw and comment work now.</span>
          </div>
        </>
      );
  }
}
