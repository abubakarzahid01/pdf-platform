import type { PDFDocumentProxy } from "pdfjs-dist";

// A piece of text as it appears on the displayed page (rotation applied, origin top-left).
export type TextItem = {
  str: string;
  x: number; // left of the baseline
  y: number; // baseline, measured down from the top
  width: number;
  size: number; // font size on the page
  hasEOL: boolean;
  confidence?: number; // 0–100, only for text read by OCR
};

// `ocr`: true when the page had no text and its words were read from the image with OCR;
// false when it had no text but was skipped (over the OCR page limit).
export type PageItems = { width: number; height: number; items: TextItem[]; ocr?: boolean };

// PDF.js's matrix helper; passed in so the browser and Node builds can share this code.
type Transform = (m1: number[], m2: number[]) => number[];

/** Reads every page's text pieces with PDF.js, in displayed-page coordinates. */
export async function readTextItems(pdf: PDFDocumentProxy, transform: Transform): Promise<PageItems[]> {
  const pages: PageItems[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const raw of content.items) {
      if (!("str" in raw)) continue;
      const [a, b, c, d, e, f] = transform(viewport.transform, raw.transform);
      // Widths from PDF.js are in page units; a length doesn't change with rotation.
      items.push({ str: raw.str, x: e, y: f, width: raw.width, size: Math.hypot(c, d) || Math.hypot(a, b), hasEOL: raw.hasEOL });
    }
    pages.push({ width: viewport.width, height: viewport.height, items });
  }
  return pages;
}
