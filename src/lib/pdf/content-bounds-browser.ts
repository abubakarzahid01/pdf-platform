import type { ContentBox, ContentFinder } from "@/lib/pdf/operations/crop";
import { closePdf, loadPdfJs } from "@/lib/pdf/pdfjs";

// Two pixels per point is enough to find edges to within half a point.
const SCALE = 2;
// Pixels lighter than this on every channel count as white paper.
const WHITE = 245;

// Finds the non-white area of each page by drawing it in the browser.
export const browserContentFinder: ContentFinder = async (bytes) => {
  const pdfjs = await loadPdfJs();
  // PDF.js takes ownership of the buffer it is given, so pass a copy.
  const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  try {
    const boxes: (ContentBox | null)[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      // "print" doesn't wait for screen frames, so it works in a background tab.
      await page.render({ canvas, viewport, intent: "print" }).promise;
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
      let left = width, top = height, right = -1, bottom = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          if (data[i] < WHITE || data[i + 1] < WHITE || data[i + 2] < WHITE) {
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
          }
        }
      }
      canvas.width = canvas.height = 0;
      page.cleanup();
      boxes.push(right < 0 ? null : { left: left / SCALE, top: top / SCALE, right: (right + 1) / SCALE, bottom: (bottom + 1) / SCALE });
    }
    return boxes;
  } finally {
    closePdf(pdf);
  }
};
