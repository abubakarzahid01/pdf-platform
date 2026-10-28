import { PDFDocument } from "pdf-lib";
import { parsePageRanges, rangesToIndices } from "./page-ranges";
import { baseName, OperationError, type InputPdf, type OutputFile } from "./types";

export type SplitMode = "ranges" | "every-page" | "extract";

async function copyToNew(source: PDFDocument, indices: number[]) {
  const doc = await PDFDocument.create();
  const pages = await doc.copyPages(source, indices);
  pages.forEach((page) => doc.addPage(page));
  return doc;
}

/**
 * - "ranges": one PDF per range, e.g. "1-3, 4-6" gives two files
 * - "every-page": one PDF per page
 * - "extract": the selected pages together in one PDF
 */
export async function splitPdf(input: InputPdf, mode: SplitMode, pages = ""): Promise<OutputFile[]> {
  const source = await PDFDocument.load(input.bytes);
  const pageCount = source.getPageCount();
  const base = baseName(input.name);

  if (mode === "every-page") {
    if (pageCount < 2) throw new OperationError("This PDF has only one page, so there is nothing to split.");
    const outputs: OutputFile[] = [];
    for (let i = 0; i < pageCount; i++) {
      const doc = await copyToNew(source, [i]);
      outputs.push({ name: `${base}-page-${i + 1}.pdf`, bytes: await doc.save(), pageCount: 1 });
    }
    return outputs;
  }

  const parsed = parsePageRanges(pages, pageCount);
  if (!parsed.ok) throw new OperationError(parsed.message);

  if (mode === "extract") {
    const indices = rangesToIndices(parsed.ranges);
    const doc = await copyToNew(source, indices);
    return [{ name: `${base}-extracted.pdf`, bytes: await doc.save(), pageCount: indices.length }];
  }

  const outputs: OutputFile[] = [];
  for (const { start, end } of parsed.ranges) {
    const indices = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
    const doc = await copyToNew(source, indices);
    const label = start === end ? `page-${start}` : `pages-${start}-${end}`;
    outputs.push({ name: `${base}-${label}.pdf`, bytes: await doc.save(), pageCount: indices.length });
  }
  return outputs;
}
