import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { FontLoader } from "./edits";
import { pageFrame } from "./page-frame";
import { OperationError, baseName, type InputPdf, type OutputFile } from "./types";

// Page numbers and text watermarks, drawn upright as each page is displayed (rotation
// and crop box respected). Text is added on top of the page; nothing else changes.

export type NumberPosition = "Bottom centre" | "Bottom right" | "Bottom left" | "Top centre" | "Top right" | "Top left";
export type NumberFormat = "1, 2, 3" | "Page 1 of N" | "i, ii, iii";
export type PageNumberOptions = { position: NumberPosition; format: NumberFormat; start: number; skipFirst: boolean };

const NUMBER_SIZE = 10;
const EDGE = 28; // distance from the page edge, in points (about 1 cm)

export function roman(n: number): string {
  if (n <= 0) return String(n);
  const table: [number, string][] = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let out = "";
  for (const [value, letters] of table) {
    while (n >= value) {
      out += letters;
      n -= value;
    }
  }
  return out;
}

async function open(input: InputPdf) {
  try {
    return await PDFDocument.load(input.bytes);
  } catch {
    throw new OperationError("This PDF couldn't be opened for editing. It may be damaged or protected.");
  }
}

export async function addPageNumbers(input: InputPdf, options: PageNumberOptions): Promise<OutputFile> {
  if (!Number.isInteger(options.start) || options.start < 0 || options.start > 99999) {
    throw new OperationError("Start at must be a whole number from 0 to 99999.");
  }
  const doc = await open(input);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const numbered = options.skipFirst ? pages.slice(1) : pages;
  if (numbered.length === 0) throw new OperationError("This PDF has only one page, and the first page is set to be skipped.");
  const last = options.start + numbered.length - 1;

  numbered.forEach((page, i) => {
    const n = options.start + i;
    const label = options.format === "Page 1 of N" ? `Page ${n} of ${last}` : options.format === "i, ii, iii" ? roman(n) : String(n);
    const frame = pageFrame(page);
    const width = font.widthOfTextAtSize(label, NUMBER_SIZE);
    const [vertical, horizontal] = options.position.split(" ") as ["Top" | "Bottom", "centre" | "left" | "right"];
    const u = horizontal === "left" ? EDGE : horizontal === "right" ? frame.width - EDGE - width : (frame.width - width) / 2;
    const v = vertical === "Top" ? frame.height - EDGE - NUMBER_SIZE * 0.72 : EDGE;
    page.drawText(label, { ...frame.toPdf(u, v), size: NUMBER_SIZE, font, color: rgb(0.2, 0.2, 0.25), rotate: frame.rotate });
  });

  return { name: `${baseName(input.name)}-numbered.pdf`, bytes: await doc.save(), pageCount: pages.length };
}

export type WatermarkPosition = "Diagonal centre" | "Centre" | "Top" | "Bottom";
export type WatermarkOptions = { text: string; position: WatermarkPosition; opacity: number };

// The standard Helvetica covers Western European text; anything else uses Inter.
async function watermarkFont(doc: PDFDocument, text: string, loadFont: FontLoader): Promise<PDFFont> {
  const helvetica = await doc.embedFont(StandardFonts.HelveticaBold);
  try {
    helvetica.encodeText(text);
    return helvetica;
  } catch {
    doc.registerFontkit(fontkit);
    const inter = await doc.embedFont(await loadFont("bold"), { subset: false });
    const missing = [...text].filter((c) => c.trim() && !inter.getCharacterSet().includes(c.codePointAt(0)!));
    if (missing.length) throw new OperationError(`These characters can't be used in a watermark yet: ${[...new Set(missing)].join(" ")}`);
    return inter;
  }
}

export async function addWatermark(input: InputPdf, options: WatermarkOptions, loadFont: FontLoader): Promise<OutputFile> {
  const text = options.text.trim().replace(/\s+/g, " ");
  if (!text) throw new OperationError("Type the watermark text first.");
  if (text.length > 60) throw new OperationError("Keep the watermark to 60 characters or fewer.");
  const doc = await open(input);
  const font = await watermarkFont(doc, text, loadFont);
  const opacity = Math.min(1, Math.max(0.05, options.opacity));

  for (const page of doc.getPages()) {
    const frame = pageFrame(page);
    const diagonal = options.position === "Diagonal centre";
    // Size the text to the page: across the diagonal, or most of the width.
    const span = diagonal ? Math.hypot(frame.width, frame.height) * 0.7 : frame.width * (options.position === "Centre" ? 0.7 : 0.5);
    const size = Math.min(diagonal ? 120 : 72, span / font.widthOfTextAtSize(text, 1));
    const width = font.widthOfTextAtSize(text, size);
    const capHeight = size * 0.72;
    const angle = diagonal ? Math.atan2(frame.height, frame.width) : 0;

    // Centre of the text in the displayed page, then its baseline start along the angle.
    const cx = frame.width / 2;
    const cy = options.position === "Top" ? frame.height - EDGE - capHeight / 2 : options.position === "Bottom" ? EDGE + capHeight / 2 : frame.height / 2;
    const u = cx - (Math.cos(angle) * width) / 2 + (Math.sin(angle) * capHeight) / 2;
    const v = cy - (Math.sin(angle) * width) / 2 - (Math.cos(angle) * capHeight) / 2;
    page.drawText(text, {
      ...frame.toPdf(u, v),
      size,
      font,
      color: rgb(0.45, 0.45, 0.5),
      opacity,
      rotate: { type: frame.rotate.type, angle: frame.rotate.angle + (angle * 180) / Math.PI },
    });
  }

  return { name: `${baseName(input.name)}-watermarked.pdf`, bytes: await doc.save(), pageCount: doc.getPageCount() };
}
