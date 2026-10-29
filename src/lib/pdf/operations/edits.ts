import fontkit from "@pdf-lib/fontkit";
import { degrees, LineCapStyle, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { addAnnotations, type PdfAnnotation, type Rgb } from "./annotate";
import { baseName, OperationError, type InputPdf, type OutputFile } from "./types";
import { applyTextEdits, verifyTextEdits, type FallbackLine, type TextExtractor, type TextLineEdit } from "../text-edit/apply";

export type FontFamily = "helvetica" | "times" | "courier" | "inter";
export type InterStyle = "regular" | "bold" | "italic" | "boldItalic";

// New text in PDF coordinates. Each line has its own baseline start point, already
// converted from the screen (so rotated pages are handled by the caller's conversion).
export type PdfText = {
  page: number;
  lines: { text: string; x: number; y: number }[];
  family: FontFamily;
  bold: boolean;
  italic: boolean;
  size: number;
  color: Rgb;
  // Counter-clockwise rotation in degrees so the text reads upright on rotated pages.
  rotate: number;
};

// A placed image. (x, y) is the corner that appears bottom-left on screen, converted to
// PDF coordinates; `rotate` turns the image to read upright on rotated pages.
export type PdfImage = {
  page: number;
  bytes: Uint8Array;
  format: "png" | "jpeg";
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
};

// Shapes in PDF coordinates. Rectangles and ellipses use their bounding box
// (bottom-left corner and size); lines and arrows use their two end points.
export type PdfBoxShape = { page: number; kind: "rect" | "ellipse"; x: number; y: number; width: number; height: number; stroke: Rgb; lineWidth: number; fill: Rgb | null };
export type PdfLineShape = { page: number; kind: "line" | "arrow"; x1: number; y1: number; x2: number; y2: number; stroke: Rgb; lineWidth: number };
export type PdfShape = PdfBoxShape | PdfLineShape;

function isLineShape(s: PdfShape): s is PdfLineShape {
  return s.kind === "line" || s.kind === "arrow";
}

export type Edits = {
  texts: PdfText[];
  annotations: PdfAnnotation[];
  images?: PdfImage[];
  shapes?: PdfShape[];
  // Changes to existing lines of text; `original` is the line's text before editing.
  lineEdits?: (TextLineEdit & { original: string })[];
};

// Picks a standard font close to the original one for a line that can't keep its font.
function fallbackText(line: FallbackLine): PdfText {
  const family: FontFamily = /times|serif|georgia|garamond|cambria/i.test(line.baseFont) && !/sans/i.test(line.baseFont) ? "times" : /courier|mono/i.test(line.baseFont) ? "courier" : "helvetica";
  return { page: line.page, lines: [{ text: line.text, x: line.x, y: line.y }], family, bold: line.bold, italic: line.italic, size: line.size, color: line.color, rotate: 0 };
}

const FILL_OPACITY = 0.25;
const ARROW_ANGLE = (28 * Math.PI) / 180;

function drawShape(page: PDFPage, s: PdfShape) {
  const stroke = rgb(...s.stroke);
  if (isLineShape(s)) {
    const line = { thickness: s.lineWidth, color: stroke, lineCap: LineCapStyle.Round };
    page.drawLine({ start: { x: s.x1, y: s.y1 }, end: { x: s.x2, y: s.y2 }, ...line });
    if (s.kind === "arrow") {
      // Two short strokes at the end point form the arrowhead.
      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const head = Math.max(8, s.lineWidth * 4);
      for (const side of [-1, 1]) {
        const a = angle + Math.PI - side * ARROW_ANGLE;
        page.drawLine({ start: { x: s.x2, y: s.y2 }, end: { x: s.x2 + head * Math.cos(a), y: s.y2 + head * Math.sin(a) }, ...line });
      }
    }
    return;
  }
  const outline = {
    borderColor: stroke,
    borderWidth: s.lineWidth,
    color: s.fill ? rgb(...s.fill) : undefined,
    opacity: s.fill ? FILL_OPACITY : undefined,
  };
  if (s.kind === "rect") {
    page.drawRectangle({ x: s.x, y: s.y, width: s.width, height: s.height, ...outline });
  } else {
    page.drawEllipse({ x: s.x + s.width / 2, y: s.y + s.height / 2, xScale: s.width / 2, yScale: s.height / 2, ...outline });
  }
}

// Supplies Inter font files: the browser fetches them, tests read them from disk.
export type FontLoader = (style: InterStyle) => Promise<Uint8Array>;

const standard: Record<Exclude<FontFamily, "inter">, [StandardFonts, StandardFonts, StandardFonts, StandardFonts]> = {
  helvetica: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique],
  times: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic],
  courier: [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique],
};

function styleIndex(bold: boolean, italic: boolean) {
  return (bold ? 1 : 0) + (italic ? 2 : 0);
}

const interStyles: InterStyle[] = ["regular", "bold", "italic", "boldItalic"];

// Standard PDF fonts only cover Western European characters (WinAnsi).
function canEncode(font: PDFFont, text: string) {
  try {
    font.encodeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Writes new text into the page content (real, selectable text) and adds annotations.
 * When a standard font can't show some characters, Inter is used instead and counted
 * in `substitutions` so the user can be told.
 */
export async function applyEdits(
  input: InputPdf,
  edits: Edits,
  loadFont: FontLoader,
  // Reads text back from the saved file to confirm edits to existing text.
  extractText?: TextExtractor,
): Promise<OutputFile & { substitutions: number; fontFallbacks: number }> {
  const doc = await PDFDocument.load(input.bytes);
  doc.registerFontkit(fontkit);
  const pages = doc.getPages();

  // Existing text first: it rewrites page content, which later drawing is added after.
  const lineEdits = edits.lineEdits ?? [];
  let fontFallbacks = 0;
  const texts = [...edits.texts];
  if (lineEdits.length > 0) {
    try {
      const result = applyTextEdits(doc, lineEdits);
      fontFallbacks = result.fallbacks.length;
      texts.unshift(...result.fallbacks.map(fallbackText));
    } catch (error) {
      throw new OperationError(error instanceof Error ? error.message : "The text changes couldn't be applied.");
    }
  }

  const standardCache = new Map<StandardFonts, PDFFont>();
  const interCache = new Map<InterStyle, PDFFont>();
  const standardFont = async (name: StandardFonts) => {
    if (!standardCache.has(name)) standardCache.set(name, await doc.embedFont(name));
    return standardCache.get(name)!;
  };
  const interFont = async (style: InterStyle) => {
    // The full font is embedded (about 330 KB per style). pdf-lib's subsetting produced
    // fonts with missing letters when tested with Inter, so it is deliberately not used.
    if (!interCache.has(style)) interCache.set(style, await doc.embedFont(await loadFont(style), { subset: false }));
    return interCache.get(style)!;
  };

  // Images first, so text added in the same edit sits on top of them.
  // The same image placed several times is embedded once.
  const imageCache = new Map<Uint8Array, PDFImage>();
  for (const img of edits.images ?? []) {
    const page = pages[img.page];
    if (!page) throw new OperationError("An image refers to a page that doesn't exist.");
    if (img.width <= 0 || img.height <= 0) continue;
    let embedded = imageCache.get(img.bytes);
    if (!embedded) {
      // pdf-lib's image readers assume the data starts at the beginning of its buffer,
      // so copy views into larger buffers (e.g. Node Buffers) into their own. A true copy
      // is needed: Buffer.slice() would return another view of the same memory.
      const data = img.bytes.byteOffset === 0 && img.bytes.byteLength === img.bytes.buffer.byteLength ? img.bytes : new Uint8Array(img.bytes);
      try {
        embedded = img.format === "png" ? await doc.embedPng(data) : await doc.embedJpg(data);
      } catch {
        throw new OperationError("One of the images couldn't be read. Try saving it again as PNG or JPG.");
      }
      imageCache.set(img.bytes, embedded);
    }
    page.drawImage(embedded, { x: img.x, y: img.y, width: img.width, height: img.height, rotate: degrees(img.rotate) });
  }

  // Shapes go above images and below text.
  for (const s of edits.shapes ?? []) {
    const page = pages[s.page];
    if (!page) throw new OperationError("A shape refers to a page that doesn't exist.");
    drawShape(page, s);
  }

  let substitutions = 0;
  for (const t of texts) {
    const page = pages[t.page];
    if (!page) throw new OperationError("Some text refers to a page that doesn't exist.");
    const lines = t.lines.filter((l) => l.text.length > 0);
    if (lines.length === 0) continue;

    const index = styleIndex(t.bold, t.italic);
    let font: PDFFont;
    if (t.family === "inter") {
      font = await interFont(interStyles[index]);
    } else {
      font = await standardFont(standard[t.family][index]);
      if (!lines.every((l) => canEncode(font, l.text))) {
        font = await interFont(interStyles[index]);
        substitutions++;
      }
    }

    for (const line of lines) {
      page.drawText(line.text, {
        x: line.x,
        y: line.y,
        size: t.size,
        font,
        color: rgb(...t.color),
        rotate: degrees(t.rotate),
      });
    }
  }

  addAnnotations(doc, edits.annotations);
  const bytes = await doc.save();

  // Never hand back a file where a text edit didn't take effect.
  if (lineEdits.length > 0) {
    if (!extractText) throw new OperationError("Text changes can't be checked, so the file wasn't created.");
    const problem = await verifyTextEdits(input.bytes, bytes, lineEdits, extractText);
    if (problem) throw new OperationError(`${problem} The file wasn't created, so nothing incorrect was downloaded.`);
  }

  return { name: `${baseName(input.name)}-edited.pdf`, bytes, pageCount: doc.getPageCount(), substitutions, fontFallbacks };
}
