import type { PageRenderer } from "@/lib/pdf/operations/pdf-to-images";
import { closePdf, loadPdfJs } from "@/lib/pdf/pdfjs";

// Renders PDF pages to PNG or JPEG in the browser with PDF.js.
export async function openBrowserRenderer(bytes: Uint8Array): Promise<PageRenderer> {
  const pdfjs = await loadPdfJs();
  // PDF.js takes ownership of the buffer it is given, so pass a copy.
  const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  return {
    pageCount: pdf.numPages,
    async pageSize(i) {
      const { width, height } = (await pdf.getPage(i + 1)).getViewport({ scale: 1 });
      return { width, height };
    },
    async render(i, scale, format) {
      const page = await pdf.getPage(i + 1);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      // PDF.js paints a white background first, so JPEGs don't get black transparent areas.
      // "print" draws the page as it prints, without waiting for screen frames, so it
      // keeps going when the tab is in the background.
      await page.render({ canvas, viewport, intent: "print" }).promise;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, format === "png" ? "image/png" : "image/jpeg", format === "jpeg" ? 0.9 : undefined),
      );
      // Free the canvas memory straight away; long PDFs make many of them.
      canvas.width = canvas.height = 0;
      page.cleanup();
      if (!blob) throw new Error("Page image could not be encoded");
      return new Uint8Array(await blob.arrayBuffer());
    },
    close: () => closePdf(pdf),
  };
}
