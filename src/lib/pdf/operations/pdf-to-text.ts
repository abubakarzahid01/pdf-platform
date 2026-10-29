import type { PageItems, TextItem } from "../text-items";
import { baseName, type InputPdf, type OutputFile } from "./types";

// Reads every page's text pieces (PDF.js in the browser or in tests).
export type TextItemReader = (bytes: Uint8Array) => Promise<PageItems[]>;

export type PageBreaks = "marked" | "continuous";

// Bullet characters that Word and others draw with the Symbol/Wingdings fonts (private-use codes).
const SYMBOL_BULLETS = /[]/g;

/**
 * Turns one page's text pieces into readable text in reading order: pieces are grouped
 * into lines by their baseline, ordered left to right, with spaces where there are gaps
 * and blank lines between paragraphs.
 */
export function pageText(items: TextItem[]): string {
  // Space-only pieces are just spacing (PDF.js even stretches one " " across a whole
  // table gap); the gap logic below turns real distances into spaces instead.
  const pieces = items.filter((i) => i.str.trim().length > 0);
  if (pieces.length === 0) return "";

  // Group into lines: pieces whose baselines are within a third of the font size.
  const sorted = [...pieces].sort((p, q) => p.y - q.y || p.x - q.x);
  const lines: TextItem[][] = [];
  for (const item of sorted) {
    const line = lines[lines.length - 1];
    const ref = line?.[0];
    if (ref && Math.abs(item.y - ref.y) <= Math.max(ref.size, item.size) * 0.35) line.push(item);
    else lines.push([item]);
  }

  const out: string[] = [];
  let previous: { y: number; size: number } | null = null;
  for (const line of lines) {
    line.sort((p, q) => p.x - q.x);
    let text = "";
    let end: number | null = null;
    for (const item of line) {
      if (end !== null) {
        const gap = item.x - end;
        const hasSpace = text.endsWith(" ") || item.str.startsWith(" ");
        // A wide gap usually separates columns (e.g. table cells); keep it visible.
        // Normal word spacing, even in justified text, stays well below this.
        if (gap > item.size * 1.2) text += hasSpace ? "   " : "    ";
        else if (gap > item.size * 0.2 && !hasSpace) text += " ";
      }
      text += item.str.replace(SYMBOL_BULLETS, "•");
      end = item.x + item.width;
    }
    const y = line[0].y;
    const size = Math.max(...line.map((i) => i.size));
    // A larger vertical gap than normal line spacing starts a new paragraph.
    if (previous && y - previous.y > Math.max(size, previous.size) * 1.8) out.push("");
    out.push(text.replace(/\s+$/, ""));
    previous = { y, size };
  }
  return out.join("\n");
}

export async function pdfToText(input: InputPdf, breaks: PageBreaks, readItems: TextItemReader): Promise<OutputFile> {
  const pages = await readItems(input.bytes);
  const texts = pages.map((p) => pageText(p.items));
  const parts = texts.map((t, i) => (breaks === "marked" ? `--- Page ${i + 1} ---\n${t}` : t));
  const content = parts.join("\n\n") + "\n";

  const empty = texts.filter((t) => !t.trim()).length;
  const characters = texts.reduce((n, t) => n + t.replace(/\s/g, "").length, 0);
  const notes = [`${pages.length} page${pages.length === 1 ? "" : "s"}, ${characters.toLocaleString("en-GB")} characters of text.`];
  if (empty === pages.length) {
    notes.push("No text was found. This PDF may be scanned images of pages; text recognition (OCR) is coming next in this phase.");
  } else if (empty > 0) {
    notes.push(`${empty} page${empty === 1 ? " has" : "s have"} no text and may be scanned; text recognition (OCR) is coming next in this phase.`);
  }

  return {
    name: `${baseName(input.name)}.txt`,
    bytes: new TextEncoder().encode(content),
    pageCount: pages.length,
    mime: "text/plain;charset=utf-8",
    note: notes.join(" "),
  };
}
