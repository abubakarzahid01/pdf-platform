import type { PageItems, TextItem } from "../pdf/text-items";

// The parts of Tesseract's result that are used (its "blocks" output), in image pixels.
type Box = { x0: number; y0: number; x1: number; y1: number };
export type OcrWord = { text: string; confidence: number; bbox: Box };
export type OcrLine = { words: OcrWord[]; bbox: Box; baseline: Box; rowAttributes?: { rowHeight: number } };
export type OcrBlock = { paragraphs: { lines: OcrLine[] }[] };

// Recognises one page image; Tesseract in the browser, or in Node for tests.
export type Recognise = (image: HTMLCanvasElement | Uint8Array) => Promise<OcrBlock[] | null>;

/**
 * Turns recognised words into text pieces on the page, the same shape PDF.js gives for
 * real text, so reading order, tables and extraction work unchanged.
 * `scale` is image pixels per page unit (the scale the page was rendered at).
 */
export function ocrItems(blocks: OcrBlock[], scale: number): TextItem[] {
  const items: TextItem[] = [];
  for (const line of blocks.flatMap((b) => b.paragraphs.flatMap((p) => p.lines))) {
    const words = line.words.filter((w) => w.text.trim());
    // Font size: Tesseract's row height (cap height plus descenders), else the line's height.
    const size = (line.rowAttributes?.rowHeight || line.bbox.y1 - line.bbox.y0) / scale;
    const { x0, y0, x1, y1 } = line.baseline;
    const slope = x1 !== x0 ? (y1 - y0) / (x1 - x0) : 0;
    words.forEach((word, i) => {
      // The baseline under the word (lines can be slightly tilted in a scan).
      const baseline = x1 > x0 ? y0 + slope * (word.bbox.x0 - x0) : word.bbox.y1;
      items.push({
        str: word.text,
        x: word.bbox.x0 / scale,
        y: baseline / scale,
        width: (word.bbox.x1 - word.bbox.x0) / scale,
        size,
        hasEOL: i === words.length - 1,
        confidence: Math.round(word.confidence),
      });
    });
  }
  return items;
}

/** True when a page has no real text, so it's worth reading with OCR. */
export function needsOcr(items: TextItem[]) {
  return !items.some((i) => i.str.trim());
}

// Reading a page takes a few seconds in the browser, so long scanned files are capped.
export const OCR_MAX_PAGES = 30;

// A page as an image, and how many image pixels make one page unit.
export type PageImage = (pageIndex: number) => Promise<{ image: HTMLCanvasElement | Uint8Array; scale: number }>;

/**
 * Fills in pages that have no text by reading their image with OCR. Pages that already
 * have text are left exactly as they are. `onPage` reports progress (done, total).
 */
export async function withOcr(
  pages: PageItems[],
  pageImage: PageImage,
  recognise: Recognise,
  onPage?: (done: number, total: number) => void,
): Promise<PageItems[]> {
  const scanned = pages.flatMap((p, i) => (needsOcr(p.items) ? [i] : []));
  const todo = scanned.slice(0, OCR_MAX_PAGES);
  const out = [...pages];
  for (const i of scanned.slice(OCR_MAX_PAGES)) out[i] = { ...pages[i], ocr: false };
  for (const [done, i] of todo.entries()) {
    onPage?.(done, todo.length);
    const { image, scale } = await pageImage(i);
    const blocks = await recognise(image);
    out[i] = { ...pages[i], items: ocrItems(blocks ?? [], scale), ocr: true };
  }
  if (todo.length) onPage?.(todo.length, todo.length);
  return out;
}
