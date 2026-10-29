import type { PageItems, TextItem } from "../text-items";
import { OCR_MAX_PAGES } from "../../ocr/ocr";
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

// Honest notes about scanned pages: which were read with OCR, and which still have no text.
export function scannedNote(pages: PageItems[], texts: string[]) {
  const pagesWord = (n: number, one: string, many: string) => `${n} page${n === 1 ? one : many}`;
  const notes: string[] = [];
  const read = pages.filter((p, i) => p.ocr && texts[i].trim()).length;
  if (read) notes.push(`${pagesWord(read, " was", "s were")} scanned and read with text recognition (OCR). Check names and numbers against the original.`);
  const skipped = pages.filter((p) => p.ocr === false).length;
  if (skipped) notes.push(`${pagesWord(skipped, " wasn't", "s weren't")} read: text recognition reads up to ${OCR_MAX_PAGES} scanned pages per file.`);
  const empty = pages.filter((p, i) => p.ocr !== false && !texts[i].trim()).length;
  if (empty === pages.length) notes.push("No text was found, even with text recognition (OCR). The pages may be blank, or the scan too unclear to read.");
  else if (empty) notes.push(`${pagesWord(empty, " has", "s have")} no readable text, even with text recognition (OCR).`);
  return notes.join(" ");
}

export async function pdfToText(input: InputPdf, breaks: PageBreaks, readItems: TextItemReader): Promise<OutputFile> {
  const pages = await readItems(input.bytes);
  const texts = pages.map((p) => pageText(p.items));
  const parts = texts.map((t, i) => (breaks === "marked" ? `--- Page ${i + 1} ---\n${t}` : t));
  const content = parts.join("\n\n") + "\n";

  const characters = texts.reduce((n, t) => n + t.replace(/\s/g, "").length, 0);
  const notes = [`${pages.length} page${pages.length === 1 ? "" : "s"}, ${characters.toLocaleString("en-GB")} characters of text.`, scannedNote(pages, texts)];

  return {
    name: `${baseName(input.name)}.txt`,
    bytes: new TextEncoder().encode(content),
    pageCount: pages.length,
    mime: "text/plain;charset=utf-8",
    note: notes.filter(Boolean).join(" "),
  };
}
