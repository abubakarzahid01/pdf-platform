import { Info } from "lucide-react";
import type { EditorTool } from "@/components/editor/editor-workspace";

const toolHelp: Record<EditorTool, { text: string; phase: string }> = {
  select: { text: "Click an item on the page to select, move or resize it.", phase: "Phase 4" },
  "edit-text": {
    text: "Click existing text to change it. The original text is removed and rewritten, never covered with a white box.",
    phase: "Phase 5",
  },
  "add-text": { text: "Click anywhere on the page to add a new text box.", phase: "Phase 5" },
  image: { text: "Upload an image, then place and resize it on the page.", phase: "Phase 5" },
  shape: { text: "Draw rectangles, circles, lines and arrows.", phase: "Phase 4" },
  link: { text: "Drag over an area to turn it into a clickable link.", phase: "Phase 5" },
  highlight: { text: "Drag over text to highlight it.", phase: "Phase 4" },
  draw: { text: "Draw freehand with your mouse, pen or finger.", phase: "Phase 4" },
  comment: { text: "Click on the page to leave a comment.", phase: "Phase 4" },
};

export function PropertiesPanel({ tool }: { tool: EditorTool }) {
  const help = toolHelp[tool];
  return (
    <>
      <p className="text-sm text-muted">{help.text}</p>
      <div className="flex gap-2.5 rounded-xl bg-info-soft p-3.5 text-[13px] leading-normal text-info-strong">
        <Info className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
        <span>
          Viewing, page navigation, zoom and download work now. This tool arrives in {help.phase}.
        </span>
      </div>
    </>
  );
}
