import { degrees, PDFDocument } from "pdf-lib";
import { baseName, type InputPdf, type OutputFile } from "./types";

export type RotateAngle = 90 | 180 | 270; // clockwise
export type RotateWhich = "all" | "odd" | "even";

// Adds the angle to each selected page's existing rotation. Page content is not
// re-drawn, so quality is unchanged.
export async function rotatePdf(input: InputPdf, angle: RotateAngle, which: RotateWhich): Promise<OutputFile> {
  const doc = await PDFDocument.load(input.bytes);
  doc.getPages().forEach((page, i) => {
    const pageNumber = i + 1;
    const selected = which === "all" || (which === "odd" ? pageNumber % 2 === 1 : pageNumber % 2 === 0);
    // Existing rotations can be negative (e.g. -90), so normalise to 0-359.
    if (selected) page.setRotation(degrees((((page.getRotation().angle + angle) % 360) + 360) % 360));
  });
  return { name: `${baseName(input.name)}-rotated.pdf`, bytes: await doc.save(), pageCount: doc.getPageCount() };
}
