"use client";

import { Info, Trash2 } from "lucide-react";
import { describe, highlightColors, inkColors, inkWidths, type ViewAnnotation } from "@/components/editor/annotations";
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
};

const comingLater: Partial<Record<EditorTool, string>> = {
  "edit-text": "Click existing text to change it. The original text is removed and rewritten, never covered with a white box.",
  "add-text": "Click anywhere on the page to add a new text box.",
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
          <p className="text-sm text-muted">Click a highlight, drawing or comment to select it. You can then edit or delete it.</p>
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
    default:
      return (
        <>
          <p className="text-sm text-muted">{comingLater[tool]}</p>
          <div className="flex gap-2.5 rounded-xl bg-info-soft p-3.5 text-[13px] leading-normal text-info-strong">
            <Info className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
            <span>This tool arrives in Phase 5. Highlight, draw and comment work now.</span>
          </div>
        </>
      );
  }
}
