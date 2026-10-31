import { PDFDocument } from "pdf-lib";
import { pageFrame } from "./page-frame";
import { OperationError, baseName, type InputPdf, type OutputFile } from "./types";

// Where the visible content is on each page, as displayed: points from the top-left of the
// visible area, y going down. null for a blank page.
export type ContentBox = { left: number; top: number; right: number; bottom: number };
export type ContentFinder = (bytes: Uint8Array) => Promise<(ContentBox | null)[]>;

export type CropMargins = { top: number; right: number; bottom: number; left: number }; // millimetres

const MM = 72 / 25.4;
// Space kept around the content when removing white margins (about 3 mm).
const PADDING = 8;
// Smallest page a crop may leave, so a typo can't shrink pages to nothing (about 2.5 cm).
const MIN_SIDE = 72;

export type CropMode = { mode: "auto"; findContent: ContentFinder } | { mode: "margins"; margins: CropMargins };

/**
 * Crops pages by setting their visible area (crop box). Content outside it is hidden in
 * viewers and when printing, but it is still in the file: cropping is not redaction.
 */
export async function cropPdf(input: InputPdf, crop: CropMode): Promise<OutputFile> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(input.bytes);
  } catch {
    throw new OperationError("This PDF couldn't be opened for editing. It may be damaged or protected.");
  }
  const pages = doc.getPages();
  const boxes = crop.mode === "auto" ? await crop.findContent(input.bytes) : null;
  let changed = 0;

  pages.forEach((page, i) => {
    const frame = pageFrame(page);
    // The area to keep, in the displayed page with y going up (left, bottom, right, top).
    let keep: [number, number, number, number];
    if (crop.mode === "margins") {
      const m = crop.margins;
      keep = [m.left * MM, m.bottom * MM, frame.width - m.right * MM, frame.height - m.top * MM];
      if (keep[2] - keep[0] < MIN_SIDE || keep[3] - keep[1] < MIN_SIDE) {
        throw new OperationError(`These margins would leave almost nothing of page ${i + 1}. Use smaller margins.`);
      }
    } else {
      const box = boxes?.[i];
      if (!box) return; // blank page: leave it as it is
      keep = [
        Math.max(0, box.left - PADDING),
        Math.max(0, frame.height - box.bottom - PADDING),
        Math.min(frame.width, box.right + PADDING),
        Math.min(frame.height, frame.height - box.top + PADDING),
      ];
      // Skip pages that would barely change, or end up tiny (e.g. a single dot).
      const trimmed = frame.width * frame.height - (keep[2] - keep[0]) * (keep[3] - keep[1]);
      if (trimmed < frame.width * frame.height * 0.02 || keep[2] - keep[0] < MIN_SIDE / 2 || keep[3] - keep[1] < MIN_SIDE / 2) return;
    }
    const a = frame.toPdf(keep[0], keep[1]);
    const b = frame.toPdf(keep[2], keep[3]);
    page.setCropBox(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    changed++;
  });

  if (changed === 0) {
    return {
      name: input.name,
      bytes: input.bytes,
      pageCount: pages.length,
      unchanged: true,
      note: "No white margins were found to remove, so your file is unchanged.",
    };
  }
  const skipped = pages.length - changed;
  return {
    name: `${baseName(input.name)}-cropped.pdf`,
    bytes: await doc.save(),
    pageCount: pages.length,
    note: [
      skipped ? `${changed} of ${pages.length} pages cropped; the others had no margins to remove.` : "",
      "Cropping hides what's outside the new edges; it doesn't delete it from the file.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
