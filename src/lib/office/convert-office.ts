import { PDFDocument } from "pdf-lib";
import { OperationError, type InputPdf, type OutputFile } from "@/lib/pdf/operations/types";

// Word, Excel and PowerPoint to PDF need LibreOffice, which runs in our conversion service
// (converter/server.mjs), not in the browser. These are the only tools that upload a file.

export type OfficeKind = "word" | "excel" | "powerpoint";

// Where the conversion service runs; set NEXT_PUBLIC_CONVERTER_URL for the live site.
export const CONVERTER_URL = process.env.NEXT_PUBLIC_CONVERTER_URL ?? "http://localhost:4000";

export async function convertOffice(input: InputPdf, kind: OfficeKind, options: { fitSheets?: boolean } = {}, fetcher: typeof fetch = fetch): Promise<OutputFile> {
  const query = new URLSearchParams({ kind, ...(options.fitSheets ? { fitSheets: "1" } : {}) });
  let response: Response;
  try {
    response = await fetcher(`${CONVERTER_URL}/convert?${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(input.name) },
      body: input.bytes as BodyInit,
    });
  } catch {
    throw new OperationError("The conversion service can't be reached right now. Please try again in a moment.");
  }
  // The live server limits how many files one visitor can convert per minute.
  if (response.status === 429) throw new OperationError("You've converted a lot of files in a short time. Please wait a minute and try again.");
  if (!response.ok) {
    const message = await response
      .json()
      .then((body: { error?: string }) => body.error)
      .catch(() => undefined);
    throw new OperationError(message ?? "This file couldn't be converted. Please try again.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  let pageCount: number;
  try {
    pageCount = (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount();
  } catch {
    throw new OperationError("The converted file came back damaged. Please try again.");
  }
  return {
    name: `${input.name.replace(/\.[^.]+$/, "") || "document"}.pdf`,
    bytes,
    pageCount,
    note: "Converted with LibreOffice. Fonts that aren't available are replaced with close matches, so check the layout.",
  };
}
