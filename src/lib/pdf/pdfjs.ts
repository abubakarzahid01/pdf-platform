// Loads PDF.js only in the browser, on first use, and points it at its worker.
// The worker parses PDFs on a background thread so the page stays responsive.

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

// Releases a document's memory and its worker resources. Safe to call more than once.
export function closePdf(pdf: PDFDocumentProxy | undefined) {
  pdf?.loadingTask.destroy().catch(() => {});
}

import type { PDFDocumentProxy } from "pdfjs-dist";
export type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
