import { PDFDocument } from "pdf-lib";
import { OperationError, type InputPdf, type OutputFile } from "./types";

// Combines the PDFs in the given order into one document.
export async function mergePdfs(inputs: InputPdf[]): Promise<OutputFile> {
  if (inputs.length < 2) throw new OperationError("Add at least two PDFs to merge.");

  const merged = await PDFDocument.create();
  for (const input of inputs) {
    const source = await PDFDocument.load(input.bytes);
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  return { name: "merged.pdf", bytes: await merged.save(), pageCount: merged.getPageCount() };
}
