// Shared shapes for PDF operations. Operations are pure: bytes in, bytes out,
// so they run the same in the browser and in tests.

export type InputPdf = { name: string; bytes: Uint8Array };

// `note` is an optional plain-language summary shown with the result.
// `unchanged` marks an output that is the original file returned as-is.
export type OutputFile = { name: string; bytes: Uint8Array; pageCount: number; note?: string; unchanged?: boolean };

export class OperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationError";
  }
}

export function baseName(fileName: string) {
  return fileName.replace(/\.pdf$/i, "") || "document";
}
