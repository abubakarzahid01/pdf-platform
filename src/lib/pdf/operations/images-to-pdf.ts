import { PDFDocument } from "pdf-lib";
import { OperationError, type OutputFile } from "./types";

// An image ready to embed: PNG or JPEG bytes (other formats are converted first).
export type PdfReadyImage = { name: string; bytes: Uint8Array; format: "png" | "jpeg"; width: number; height: number };

export type PageSize = "Fit to image" | "A4" | "Letter";
export type PageOrientation = "Auto" | "Portrait" | "Landscape";
export type PageMargin = "None" | "Small" | "Large";

const SIZES = { A4: [595.28, 841.89], Letter: [612, 792] } as const;
const MARGINS: Record<PageMargin, number> = { None: 0, Small: 20, Large: 50 };
// Image pixels to PDF points for "Fit to image": 96 pixels per inch, as browsers show them.
const PX_TO_PT = 72 / 96;
// PDF viewers can't open pages larger than 200 inches.
const MAX_PAGE_PT = 14400;

export type ImagesToPdfOptions = { pageSize: PageSize; orientation: PageOrientation; margin: PageMargin };

/**
 * Puts each image on its own page, in order. With A4 or Letter the image is scaled to fit
 * inside the margins (never enlarged past its natural size) and centred.
 */
export async function imagesToPdf(images: PdfReadyImage[], options: ImagesToPdfOptions): Promise<OutputFile> {
  if (images.length === 0) throw new OperationError("Add at least one image.");
  const doc = await PDFDocument.create();
  const margin = MARGINS[options.margin] ?? 0;

  for (const image of images) {
    let embedded;
    try {
      embedded = image.format === "png" ? await doc.embedPng(image.bytes) : await doc.embedJpg(image.bytes);
    } catch {
      throw new OperationError(`${image.name} couldn't be added. The image may be damaged.`);
    }
    const natural = { w: image.width * PX_TO_PT, h: image.height * PX_TO_PT };

    let pageW: number;
    let pageH: number;
    if (options.pageSize === "Fit to image") {
      // Very large photos are scaled down to the biggest page size viewers accept.
      const shrink = Math.min(1, (MAX_PAGE_PT - 2 * margin) / Math.max(natural.w, natural.h));
      natural.w *= shrink;
      natural.h *= shrink;
      pageW = natural.w + 2 * margin;
      pageH = natural.h + 2 * margin;
    } else {
      const [short, long] = SIZES[options.pageSize];
      const landscape = options.orientation === "Landscape" || (options.orientation === "Auto" && image.width > image.height);
      [pageW, pageH] = landscape ? [long, short] : [short, long];
    }

    const boxW = pageW - 2 * margin;
    const boxH = pageH - 2 * margin;
    const scale = Math.min(1, boxW / natural.w, boxH / natural.h);
    const w = natural.w * scale;
    const h = natural.h * scale;
    const page = doc.addPage([pageW, pageH]);
    page.drawImage(embedded, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
  }

  const first = images[0].name.replace(/\.[^.]+$/, "") || "images";
  return {
    name: images.length === 1 ? `${first}.pdf` : `${first}-and-${images.length - 1}-more.pdf`,
    bytes: await doc.save(),
    pageCount: images.length,
  };
}
