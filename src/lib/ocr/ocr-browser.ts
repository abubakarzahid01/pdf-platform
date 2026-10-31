import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import type { PageItems } from "@/lib/pdf/text-items";
import { withOcr, type OcrBlock } from "./ocr";

// Text recognition in the browser with Tesseract.js. The engine and English language data
// are served by this site from /ocr (copied by scripts/copy-engine-assets.mjs), so nothing is
// fetched from other servers and the page images never leave the device.

// Long side of the page image in pixels: about 300 dpi for A4/Letter, which suits Tesseract.
const TARGET_PIXELS = 2500;

async function renderPage(pdf: PDFDocumentProxy, pageIndex: number) {
  const page = await pdf.getPage(pageIndex + 1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(4, TARGET_PIXELS / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  // "print" doesn't wait for screen frames, so OCR keeps going in a background tab.
  await page.render({ canvas, viewport, intent: "print" }).promise;
  return { image: canvas, scale };
}

/** Reads pages without text from their images. Pages with real text are unchanged. */
export async function addOcrInBrowser(
  pdf: PDFDocumentProxy,
  pages: PageItems[],
  onPage?: (done: number, total: number) => void,
): Promise<PageItems[]> {
  if (!pages.some((p) => !p.items.some((i) => i.str.trim()))) return pages;
  const { createWorker, OEM } = await import("tesseract.js");
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/",
    langPath: "/ocr/lang",
  });
  try {
    return await withOcr(
      pages,
      (i) => renderPage(pdf, i),
      async (image) => (await worker.recognize(image as HTMLCanvasElement, {}, { blocks: true })).data.blocks as OcrBlock[] | null,
      onPage,
    );
  } finally {
    await worker.terminate();
  }
}
