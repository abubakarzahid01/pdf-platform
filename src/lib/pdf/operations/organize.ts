import { degrees, PDFDocument } from "pdf-lib";
import { baseName, OperationError, type InputPdf, type OutputFile } from "./types";

// One entry per page in the new document, in the new order. Pages left out are deleted.
export type PagePlan = { source: number; rotate: number }[]; // source: zero-based; rotate: extra clockwise degrees

export function normaliseAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

export async function organizePdf(input: InputPdf, plan: PagePlan): Promise<OutputFile> {
  if (plan.length === 0) throw new OperationError("Keep at least one page.");

  const source = await PDFDocument.load(input.bytes);
  const count = source.getPageCount();
  if (plan.some((p) => !Number.isInteger(p.source) || p.source < 0 || p.source >= count)) {
    throw new OperationError("The page selection doesn't match this document. Please reload the file.");
  }
  if (plan.some((p) => p.rotate % 90 !== 0)) throw new OperationError("Pages can only be rotated in steps of 90°.");

  const doc = await PDFDocument.create();
  const pages = await doc.copyPages(source, plan.map((p) => p.source));
  pages.forEach((page, i) => {
    if (plan[i].rotate) page.setRotation(degrees(normaliseAngle(page.getRotation().angle + plan[i].rotate)));
    doc.addPage(page);
  });

  return { name: `${baseName(input.name)}-organised.pdf`, bytes: await doc.save(), pageCount: doc.getPageCount() };
}
