import type { PageItems, TextItem } from "../text-items";
import { layoutLines } from "../text-layout";
import { baseName, type InputPdf, type OutputFile } from "./types";

// Reads every page's text pieces (PDF.js in the browser or in tests).
export type TextItemReader = (bytes: Uint8Array) => Promise<PageItems[]>;

export type PageBreaks = "marked" | "continuous";

/**
 * Turns one page's text pieces into readable text in reading order: lines top to bottom,
 * columns (e.g. table cells) kept apart with extra spaces, blank lines between paragraphs.
 */
export function pageText(items: TextItem[]): string {
  const out: string[] = [];
  let previous: { y: number; size: number } | null = null;
  for (const line of layoutLines(items)) {
    // A larger vertical gap than normal line spacing starts a new paragraph.
    if (previous && line.y - previous.y > Math.max(line.size, previous.size) * 1.8) out.push("");
    out.push(line.cells.map((c) => c.text).join("    "));
    previous = line;
  }
  return out.join("\n");
}

// Counts pages without text, for honest notes about scanned pages.
export function scannedNote(pages: string[], whatNext = "text recognition (OCR) is coming next in this phase") {
  const empty = pages.filter((t) => !t.trim()).length;
  if (empty === 0) return "";
  if (empty === pages.length) return `No text was found. This PDF may be scanned images of pages; ${whatNext}.`;
  return `${empty} page${empty === 1 ? " has" : "s have"} no text and may be scanned; ${whatNext}.`;
}

export async function pdfToText(input: InputPdf, breaks: PageBreaks, readItems: TextItemReader): Promise<OutputFile> {
  const pages = await readItems(input.bytes);
  const texts = pages.map((p) => pageText(p.items));
  const parts = texts.map((t, i) => (breaks === "marked" ? `--- Page ${i + 1} ---\n${t}` : t));
  const content = parts.join("\n\n") + "\n";

  const characters = texts.reduce((n, t) => n + t.replace(/\s/g, "").length, 0);
  const notes = [`${pages.length} page${pages.length === 1 ? "" : "s"}, ${characters.toLocaleString("en-GB")} characters of text.`, scannedNote(texts)];

  return {
    name: `${baseName(input.name)}.txt`,
    bytes: new TextEncoder().encode(content),
    pageCount: pages.length,
    mime: "text/plain;charset=utf-8",
    note: notes.filter(Boolean).join(" "),
  };
}
