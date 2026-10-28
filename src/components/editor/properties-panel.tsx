import { Bold, Info, Italic, TextAlignCenter, TextAlignStart, Underline } from "lucide-react";
import type { EditorTool } from "@/components/editor/editor-workspace";

const iconButton =
  "flex size-9 items-center justify-center rounded-[9px] border border-line bg-surface text-ink-soft hover:bg-surface-soft";

const toolHelp: Record<EditorTool, string> = {
  select: "Click an item on the page to select, move or resize it.",
  "edit-text": "",
  "add-text": "Click anywhere on the page to add a new text box.",
  image: "Upload an image, then place and resize it on the page.",
  shape: "Draw rectangles, circles, lines and arrows.",
  link: "Drag over an area to turn it into a clickable link.",
  highlight: "Drag over text to highlight it.",
  draw: "Draw freehand with your mouse, pen or finger.",
  comment: "Click on the page to leave a comment.",
};

export function PropertiesPanel({ tool }: { tool: EditorTool }) {
  if (tool !== "edit-text") {
    return <p className="text-sm text-muted">{toolHelp[tool]}</p>;
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <strong className="text-[15px]">Text</strong>
        <span className="text-xs text-subtle">Paragraph · page 1</span>
      </div>

      <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
        Font
        <select className="rounded-[9px] border border-line bg-surface px-2.5 py-2 text-sm font-normal text-ink">
          <option>Helvetica (embedded)</option>
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
          Size
          <input defaultValue="12 pt" className="rounded-[9px] border border-line px-2.5 py-2 text-sm font-normal text-ink" />
        </label>
        <div className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
          Colour
          <span className="flex items-center gap-2 rounded-[9px] border border-line px-2.5 py-2 text-sm font-normal text-ink">
            <span className="size-4 rounded bg-[#222]" />
            #222222
          </span>
        </div>
      </div>

      <div className="flex gap-1.5">
        <button type="button" aria-label="Bold" className={iconButton}><Bold className="size-4" /></button>
        <button type="button" aria-label="Italic" className={iconButton}><Italic className="size-4" /></button>
        <button type="button" aria-label="Underline" className={iconButton}><Underline className="size-4" /></button>
        <span className="w-2" />
        <button type="button" aria-label="Align left" className={`${iconButton} !bg-brand-soft !text-brand-strong`}>
          <TextAlignStart className="size-4" />
        </button>
        <button type="button" aria-label="Align centre" className={iconButton}><TextAlignCenter className="size-4" /></button>
      </div>

      <div className="flex gap-2.5 rounded-xl bg-info-soft p-3.5 text-[13px] leading-normal text-info-strong">
        <Info className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
        <span>
          You&apos;re editing the real text in this PDF. This font is a subset, so characters not used in the original
          may fall back to a similar font.
        </span>
      </div>
    </>
  );
}
