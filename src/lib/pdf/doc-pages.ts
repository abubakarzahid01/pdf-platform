import type { PDFDocumentProxy } from "pdfjs-dist";
import { encodePng } from "../files/png";
import type { PageItems, TextItem } from "./text-items";

// Everything PDF to Word needs from a page, in displayed-page coordinates (rotation applied,
// origin top-left, in points): text pieces with their font names, and images.

export type EncodedImage = { data: Uint8Array; format: "png" | "jpg" };
export type PageImage = { x: number; y: number; width: number; height: number } & EncodedImage;
export type DocPage = PageItems & { images: PageImage[] };

// A decoded image as PDF.js hands it over: raw pixels (Node) or a bitmap (browsers).
export type PdfImageObject = { width: number; height: number; kind?: number; data?: Uint8Array | Uint8ClampedArray; bitmap?: ImageBitmap };
// Saves an image for the document. `shown` is its size on the page in points, so it can be
// scaled down to what's needed there.
export type ImageEncoder = (image: PdfImageObject, shown: { width: number; height: number }) => Promise<EncodedImage | null>;

type PdfJs = {
  Util: { transform: (m1: number[], m2: number[]) => number[] };
  OPS: Record<string, number>;
};

// Images smaller than this on the page (points) are decorations: rules, bullets, dots.
const MIN_IMAGE_SIDE = 16;
const MAX_IMAGE_PIXELS = 25_000_000;
const MAX_IMAGES_PER_PAGE = 30;

/** Raw pixels from PDF.js (grey 1-bit, RGB or RGBA) to PNG. Returns null for other formats. */
export function encodeImageData(image: PdfImageObject): Uint8Array | null {
  const { width, height, kind, data } = image;
  if (!data || !width || !height || width * height > MAX_IMAGE_PIXELS) return null;
  if (kind === 2) return encodePng(new Uint8Array(data.buffer, data.byteOffset, width * height * 3), width, height, 3);
  if (kind === 3) return encodePng(new Uint8Array(data.buffer, data.byteOffset, width * height * 4), width, height, 4);
  if (kind === 1) {
    // One bit per pixel, rows padded to whole bytes; 1 = white.
    const grey = new Uint8Array(width * height);
    const rowBytes = (width + 7) >> 3;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) grey[y * width + x] = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0;
    }
    return encodePng(grey, width, height, 1);
  }
  return null;
}

// "ABCDEE+Calibri,Bold" -> "Calibri,Bold". Subset prefixes are six capitals and a plus.
function cleanFontName(name: unknown) {
  return typeof name === "string" ? name.replace(/^[A-Z]{6}\+/, "") : undefined;
}

function objectFrom(store: { has: (id: string) => boolean; get: (id: string, cb?: (data: unknown) => void) => unknown }, id: string): Promise<unknown> {
  if (store.has(id)) return Promise.resolve(store.get(id));
  return new Promise((resolve) => store.get(id, resolve));
}

/**
 * Reads text with font names and images from every page. The document must be opened
 * with `fontExtraProperties: true`, or font names are unavailable.
 */
export async function readDocPages(pdf: PDFDocumentProxy, pdfjs: PdfJs, encodeImage: ImageEncoder): Promise<DocPage[]> {
  const { OPS, Util } = pdfjs;
  const pages: DocPage[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    // The drawing commands also load the fonts and images used on the page.
    const ops = await page.getOperatorList();

    const fonts = new Map<string, string | undefined>();
    const items: TextItem[] = [];
    for (const raw of content.items) {
      if (!("str" in raw)) continue;
      if (!fonts.has(raw.fontName)) {
        const font = page.commonObjs.has(raw.fontName) ? (page.commonObjs.get(raw.fontName) as { name?: string }) : undefined;
        fonts.set(raw.fontName, cleanFontName(font?.name));
      }
      const [a, b, c, d, e, f] = Util.transform(viewport.transform, raw.transform);
      items.push({ str: raw.str, x: e, y: f, width: raw.width, size: Math.hypot(c, d) || Math.hypot(a, b), hasEOL: raw.hasEOL, font: fonts.get(raw.fontName) });
    }

    // Follow the drawing position to find where each image is placed.
    const images: PageImage[] = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    const saved: number[][] = [];
    for (let i = 0; i < ops.fnArray.length && images.length < MAX_IMAGES_PER_PAGE; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i];
      if (fn === OPS.save) saved.push(ctm);
      else if (fn === OPS.restore) ctm = saved.pop() ?? [1, 0, 0, 1, 0, 0];
      else if (fn === OPS.transform) ctm = Util.transform(ctm, args);
      else if (fn === OPS.paintFormXObjectBegin) {
        saved.push(ctm);
        if (Array.isArray(args?.[0])) ctm = Util.transform(ctm, args[0]);
      } else if (fn === OPS.paintFormXObjectEnd) ctm = saved.pop() ?? [1, 0, 0, 1, 0, 0];
      else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
        // Images are drawn into a 1 × 1 square scaled by the current position.
        const m = Util.transform(viewport.transform, ctm);
        const xs = [m[4], m[0] + m[4], m[2] + m[4], m[0] + m[2] + m[4]];
        const ys = [m[5], m[1] + m[5], m[3] + m[5], m[1] + m[3] + m[5]];
        const box = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
        if (box.width < MIN_IMAGE_SIDE || box.height < MIN_IMAGE_SIDE) continue;
        try {
          const id = args[0];
          const object = (fn === OPS.paintInlineImageXObject ? id : await objectFrom(String(id).startsWith("g_") ? page.commonObjs : page.objs, id)) as PdfImageObject;
          const encoded = object && (await encodeImage(object, box));
          if (encoded) images.push({ ...box, ...encoded });
        } catch {
          // An image that can't be decoded is left out; the text still comes through.
        }
      }
    }
    pages.push({ width: viewport.width, height: viewport.height, items, images });
    page.cleanup();
  }
  return pages;
}
