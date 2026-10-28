// Shared shapes for PDF operations. Operations are pure: bytes in, bytes out,
// so they run the same in the browser and in tests.

export type InputPdf = { name: string; bytes: Uint8Array };

export type OutputFile = { name: string; bytes: Uint8Array; pageCount: number };

export class OperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationError";
  }
}

export function baseName(fileName: string) {
  return fileName.replace(/\.pdf$/i, "") || "document";
}
