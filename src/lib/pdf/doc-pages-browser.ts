import { addOcrInBrowser } from "@/lib/ocr/ocr-browser";
import { readDocPages, type EncodedImage, type ImageEncoder, type PdfImageObject } from "@/lib/pdf/doc-pages";
import type { DocPageReader } from "@/lib/pdf/operations/pdf-to-word";
import { closePdf, loadPdfJs } from "@/lib/pdf/pdfjs";

// Images in the Word file only need enough detail for their size on the page.
const IMAGE_DPI = 200;
const JPEG_QUALITY = 0.85;

// Draws a PDF image at the size it's needed, then saves photos as JPEG and anything with
// transparency as PNG, which keeps Word files a sensible size.
const browserImageEncoder: ImageEncoder = async (image: PdfImageObject, shown) => {
  const scale = Math.min(1, (shown.width * IMAGE_DPI) / 72 / image.width, (shown.height * IMAGE_DPI) / 72 / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  let source: CanvasImageSource;
  if (image.bitmap) source = image.bitmap;
  else if (image.data && (image.kind === 2 || image.kind === 3)) {
    // Raw pixels: put them on a full-size canvas first (as RGBA).
    const full = document.createElement("canvas");
    full.width = image.width;
    full.height = image.height;
    const rgba = new ImageData(image.width, image.height);
    const channels = image.kind === 3 ? 4 : 3;
    for (let i = 0, j = 0; i < image.width * image.height; i++, j += channels) {
      rgba.data[i * 4] = image.data[j];
      rgba.data[i * 4 + 1] = image.data[j + 1];
      rgba.data[i * 4 + 2] = image.data[j + 2];
      rgba.data[i * 4 + 3] = channels === 4 ? image.data[j + 3] : 255;
    }
    full.getContext("2d")!.putImageData(rgba, 0, 0);
    source = full;
  } else return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(source, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  let transparent = false;
  for (let i = 3; i < pixels.length; i += 4 * 7) {
    if (pixels[i] < 250) {
      transparent = true;
      break;
    }
  }
  const type = transparent ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, transparent ? undefined : JPEG_QUALITY));
  canvas.width = canvas.height = 0;
  if (!blob) return null;
  const encoded: EncodedImage = { data: new Uint8Array(await blob.arrayBuffer()), format: transparent ? "png" : "jpg" };
  return encoded;
};

// Reads text (with font names) and images in the browser; scanned pages are read with OCR.
export const browserDocPageReader: DocPageReader = async (bytes) => {
  const pdfjs = await loadPdfJs();
  // PDF.js takes ownership of the buffer it is given, so pass a copy.
  const pdf = await pdfjs.getDocument({ data: bytes.slice(), fontExtraProperties: true }).promise;
  try {
    const pages = await readDocPages(pdf, pdfjs, browserImageEncoder);
    const withText = await addOcrInBrowser(pdf, pages);
    // OCR only fills in text; keep each page's images.
    return pages.map((page, i) => ({ ...page, items: withText[i].items, ocr: withText[i].ocr }));
  } finally {
    closePdf(pdf);
  }
};
