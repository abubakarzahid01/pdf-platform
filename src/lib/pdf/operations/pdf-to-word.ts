import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, PageBreak, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, type ParagraphChild } from "docx";
import type { DocPage } from "../doc-pages";
import { detectTables } from "../tables";
import { COLUMN_GAP, layoutLines, type LayoutLine } from "../text-layout";
import { OperationError, baseName, type InputPdf, type OutputFile } from "./types";

// PDF to an editable Word document. A PDF only records where each piece of text sits, so
// the document structure is rebuilt from positions: lines are joined into paragraphs,
// larger or bold short lines become headings, aligned columns become tables, and images
// keep their place in the flow. Exact positions and multi-column layouts aren't kept.

export type DocPageReader = (bytes: Uint8Array) => Promise<DocPage[]>;

export type Run = { text: string; bold: boolean; italic: boolean; size: number; font?: string };
export type ParagraphStyle = "body" | "h1" | "h2" | "h3" | "bullet";
export type WordBlock =
  | { kind: "paragraph"; page: number; y: number; style: ParagraphStyle; align: "left" | "center"; runs: Run[] }
  | { kind: "table"; page: number; y: number; rows: string[][]; size: number }
  | { kind: "image"; page: number; y: number; width: number; height: number; data: Uint8Array; format: "png" | "jpg" };

const BULLET = /^\s*[•▪◦●■‣–-]\s*/;
const SYMBOL_BULLETS = /[]/g;

/** "Calibri,Bold" -> Calibri, bold. "TimesNewRomanPS-ItalicMT" -> Times New Roman, italic. */
export function parseFont(name: string | undefined): { family?: string; bold: boolean; italic: boolean } {
  if (!name) return { bold: false, italic: false };
  const bold = /bold|black|heavy|semibold|demibold/i.test(name);
  const italic = /italic|oblique/i.test(name);
  let family = name.split(/[,-]/)[0].replace(/(PS)?MT$/, "").replace(/PS$/, "");
  // Split "TimesNewRoman" into words; keep names that already have spaces as they are.
  if (!family.includes(" ")) family = family.replace(/([a-z])([A-Z])/g, "$1 $2");
  if (/^helvetica$/i.test(family)) family = "Arial";
  if (/^times$/i.test(family) || /^times roman$/i.test(family)) family = "Times New Roman";
  if (/^symbol$|^wingdings/i.test(family)) return { bold, italic };
  return { family: family || undefined, bold, italic };
}

function lineText(line: LayoutLine) {
  return line.cells.map((c) => c.text).join("    ");
}

// Turns a line's pieces into styled runs, with spaces where the gaps between pieces are.
function lineRuns(line: LayoutLine): Run[] {
  const runs: Run[] = [];
  let end: number | null = null;
  for (const item of [...line.items].sort((p, q) => p.x - q.x)) {
    if (!item.str.trim()) continue;
    const font = parseFont(item.font);
    const gap = end === null ? 0 : item.x - end;
    const spacing = end === null ? "" : gap > item.size * COLUMN_GAP ? "    " : gap > item.size * 0.2 ? " " : "";
    const text = spacing + item.str.replace(SYMBOL_BULLETS, "•");
    const style = { bold: font.bold, italic: font.italic, size: Math.round(item.size * 2) / 2, font: font.family };
    const last = runs[runs.length - 1];
    if (last && last.bold === style.bold && last.italic === style.italic && last.size === style.size && last.font === style.font) last.text += text;
    else runs.push({ text, ...style });
    end = item.x + item.width;
  }
  return runs;
}

// The most common text size, weighted by amount of text: the body size.
function bodySize(lines: LayoutLine[]) {
  const weights = new Map<number, number>();
  for (const l of lines) for (const i of l.items) weights.set(Math.round(i.size), (weights.get(Math.round(i.size)) ?? 0) + i.str.length);
  return [...weights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 11;
}

/** Rebuilds paragraphs, headings, lists, tables and images from positioned page content. */
export function buildBlocks(pages: DocPage[]): WordBlock[] {
  const pageLines = pages.map((p) => layoutLines(p.items));
  const body = bodySize(pageLines.flat());
  const blocks: WordBlock[] = [];

  pages.forEach((page, pageIndex) => {
    const lines = pageLines[pageIndex];
    const tables = detectTables(page.items, pageIndex);
    const pageBlocks: WordBlock[] = [];
    for (const t of tables) {
      const rowSizes = lines.filter((l) => l.y >= t.top && l.y <= t.bottom).map((l) => l.size);
      pageBlocks.push({ kind: "table", page: pageIndex, y: t.top, rows: t.rows, size: Math.min(...rowSizes) || body });
    }
    // On a scanned page read with OCR, the page-sized scan is the text itself: leave it out,
    // or the document would show everything twice. Smaller images (logos) are kept.
    const images = page.ocr ? page.images.filter((i) => i.width * i.height < page.width * page.height * 0.6) : page.images;
    for (const image of images) pageBlocks.push({ kind: "image", page: pageIndex, y: image.y, width: image.width, height: image.height, data: image.data, format: image.format });

    let current: (WordBlock & { kind: "paragraph" }) | null = null;
    let previous: { line: LayoutLine; x: number; end: number } | null = null;
    // Where the page's text normally stops on the right. Wrapped lines run close to it, so a
    // line that stops well short of it ends its paragraph (like "Invoice number: 123").
    const textLines = lines.filter((l) => !tables.some((t) => l.y >= t.top - 0.5 && l.y <= t.bottom + 0.5) && l.cells.length > 0);
    const rightEdge = Math.max(0, ...textLines.map((l) => Math.max(...l.cells.map((c) => c.end))));
    for (const line of lines) {
      if (tables.some((t) => line.y >= t.top - 0.5 && line.y <= t.bottom + 0.5)) {
        current = null;
        previous = null;
        continue;
      }
      const text = lineText(line);
      if (!text.trim()) continue;
      const x = Math.min(...line.cells.map((c) => c.x));
      const end = Math.max(...line.cells.map((c) => c.end));
      const runs = lineRuns(line);
      const bullet = BULLET.test(text) && line.items.length > 0;
      const style: ParagraphStyle = bullet ? "bullet" : line.size >= body * 1.5 ? "h1" : line.size >= body * 1.2 ? "h2" : "body";
      const centred = Math.abs((x + end) / 2 - page.width / 2) < page.width * 0.04 && x > page.width * 0.15;

      // A line continues the paragraph above when it follows closely in the same style.
      const continues =
        current !== null &&
        previous !== null &&
        !bullet &&
        (current.style === style || (current.style === "bullet" && style === "body")) &&
        Math.abs(line.size - previous.line.size) <= line.size * 0.15 &&
        line.y - previous.line.y > 0 &&
        line.y - previous.line.y <= line.size * 1.75 &&
        Math.abs(x - previous.x) <= line.size * 3 &&
        previous.end >= rightEdge - Math.max(line.size * 4, (rightEdge - previous.x) * 0.2);

      if (continues && current) {
        const last = current.runs[current.runs.length - 1];
        // Join with a space, or straight on after a hyphen at the end of the line.
        const joiner = last.text.endsWith("-") ? "" : " ";
        if (runs[0]) runs[0] = { ...runs[0], text: joiner + runs[0].text.trimStart() };
        current.runs.push(...runs);
      } else {
        if (bullet && runs[0]) runs[0] = { ...runs[0], text: runs[0].text.replace(BULLET, "") };
        if (bullet && runs[0] && !runs[0].text.trim()) runs.shift();
        current = { kind: "paragraph", page: pageIndex, y: line.y - line.size, style, align: centred ? "center" : "left", runs };
        pageBlocks.push(current);
      }
      previous = { line, x, end };
    }

    // A short, bold paragraph on its own line that doesn't end a sentence reads as a heading.
    for (const b of pageBlocks) {
      if (b.kind !== "paragraph" || b.style !== "body") continue;
      const all = b.runs.map((r) => r.text).join("").trim();
      if (all.length > 0 && all.length <= 70 && b.runs.every((r) => r.bold || !r.text.trim()) && !/[.,:;]$/.test(all)) b.style = "h3";
    }

    pageBlocks.sort((a, b) => a.y - b.y);
    blocks.push(...pageBlocks);
  });

  // Tidy runs: no double spaces at joins, no empty runs.
  for (const b of blocks) {
    if (b.kind !== "paragraph") continue;
    b.runs = b.runs.filter((r) => r.text.length > 0);
    if (b.runs[0]) b.runs[0].text = b.runs[0].text.trimStart();
  }
  return blocks.filter((b) => b.kind !== "paragraph" || b.runs.some((r) => r.text.trim()));
}

const PT_TO_PX = 96 / 72;
const headingLevels = { h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3 } as const;

function textRun(run: Run, heading: boolean) {
  return new TextRun({
    text: run.text,
    bold: run.bold || undefined,
    italics: run.italic || undefined,
    size: Math.round(run.size * 2), // half-points
    font: run.font,
    // Word's heading styles are blue; PDFs don't say the colour, so headings stay black.
    color: heading ? "000000" : undefined,
  });
}

/** Builds the .docx file from blocks, one Word page per PDF page. */
export async function blocksToDocx(blocks: WordBlock[], pages: DocPage[]): Promise<Uint8Array> {
  const first = pages[0] ?? { width: 595.28, height: 841.89, items: [] };
  // Margins from where the text starts on the first pages, within sensible limits.
  const lefts = pages.slice(0, 3).flatMap((p) => p.items.filter((i) => i.str.trim()).map((i) => i.x));
  const margin = Math.min(108, Math.max(36, lefts.length ? Math.min(...lefts) : 72));
  const contentWidth = first.width - 2 * margin;

  // The document's main font and size (by amount of text) become Word's defaults, so tables
  // and anything without its own font match the rest of the text.
  const fontWeights = new Map<string, number>();
  const sizeWeights = new Map<number, number>();
  for (const b of blocks) {
    if (b.kind !== "paragraph" || b.style !== "body") continue;
    for (const r of b.runs) {
      if (r.font) fontWeights.set(r.font, (fontWeights.get(r.font) ?? 0) + r.text.length);
      sizeWeights.set(r.size, (sizeWeights.get(r.size) ?? 0) + r.text.length);
    }
  }
  const mainFont = [...fontWeights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Calibri";
  const mainSize = [...sizeWeights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 11;
  const cellMargins = { top: 40, bottom: 40, left: 100, right: 100 };

  const children: (Paragraph | Table)[] = [];
  let page = 0;
  for (const block of blocks) {
    const newPage = block.page !== page;
    page = block.page;
    if (newPage && block.kind !== "paragraph") children.push(new Paragraph({ children: [new PageBreak()] }));

    if (block.kind === "paragraph") {
      const heading = block.style.startsWith("h");
      children.push(
        new Paragraph({
          pageBreakBefore: newPage || undefined,
          heading: heading ? headingLevels[block.style as "h1" | "h2" | "h3"] : undefined,
          bullet: block.style === "bullet" ? { level: 0 } : undefined,
          alignment: block.align === "center" ? AlignmentType.CENTER : undefined,
          children: block.runs.map((r) => textRun(r, heading)) as ParagraphChild[],
        }),
      );
    } else if (block.kind === "table") {
      const size = Math.round(block.size * 2);
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: block.rows.map(
            (row, r) =>
              new TableRow({
                children: row.map(
                  (cell) =>
                    new TableCell({
                      margins: cellMargins,
                      children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: cell, size, bold: r === 0 || undefined })] })],
                    }),
                ),
              }),
          ),
        }),
      );
      // Word needs a paragraph between consecutive tables, or it merges them.
      children.push(new Paragraph({}));
    } else {
      const scale = Math.min(1, contentWidth / block.width);
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              type: block.format,
              data: block.data,
              transformation: { width: Math.round(block.width * scale * PT_TO_PX), height: Math.round(block.height * scale * PT_TO_PX) },
            }),
          ],
        }),
      );
    }
  }

  const doc = new Document({
    creator: "PDF to Word",
    styles: {
      default: {
        // Space after each paragraph, about two-thirds of a line, as in a normal Word document.
        document: { run: { font: mainFont, size: Math.round(mainSize * 2) }, paragraph: { spacing: { after: Math.round(mainSize * 0.6 * 20) } } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: Math.round(first.width * 20), height: Math.round(first.height * 20) }, // twentieths of a point
            margin: { top: 1440, bottom: 1440, left: Math.round(margin * 20), right: Math.round(margin * 20) },
          },
        },
        children,
      },
    ],
  });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function pdfToWord(input: InputPdf, readPages: DocPageReader): Promise<OutputFile> {
  const pages = await readPages(input.bytes);
  const blocks = buildBlocks(pages);
  if (!blocks.length) throw new OperationError("No text or images were found to put in a Word document.");

  const count = (kind: WordBlock["kind"]) => blocks.filter((b) => b.kind === kind).length;
  const ocrPages = pages.filter((p) => p.ocr).length;
  const parts = [
    `${pages.length} page${pages.length === 1 ? "" : "s"}: ${count("paragraph")} paragraphs`,
    count("table") ? `${count("table")} table${count("table") === 1 ? "" : "s"}` : "",
    count("image") ? `${count("image")} image${count("image") === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  const note = [
    `${parts.join(", ")}.`,
    ocrPages ? `${ocrPages} scanned page${ocrPages === 1 ? " was" : "s were"} read with text recognition (OCR); check the text.` : "",
    "Best for text documents. Paragraphs, headings, lists, simple tables and images are kept; exact positions, columns and complex layouts aren't.",
  ]
    .filter(Boolean)
    .join(" ");

  return { name: `${baseName(input.name)}.docx`, bytes: await blocksToDocx(blocks, pages), pageCount: pages.length, mime: DOCX_MIME, note };
}
