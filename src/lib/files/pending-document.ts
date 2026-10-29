import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";

// Passes an already-checked PDF from a tool page to the editor during client-side
// navigation, so the file stays in the browser and isn't parsed twice.
// A page refresh clears it; the editor then asks for a file again.

export type OpenDocument = {
  file: File;
  pdf: PDFDocumentProxy;
  pageCount: number;
};

let pending: OpenDocument | null = null;

export function setPendingDocument(doc: OpenDocument) {
  pending = doc;
}

export function peekPendingDocument() {
  return pending;
}

export function clearPendingDocument(doc: OpenDocument) {
  if (pending === doc) pending = null;
}

// Files chosen on a tool page, handed to a workspace page (e.g. Invoice to Excel).
let pendingFiles: File[] = [];

export function setPendingFiles(files: File[]) {
  pendingFiles = files;
}

export function peekPendingFiles() {
  return pendingFiles;
}

export function clearPendingFiles(files: File[]) {
  if (pendingFiles === files) pendingFiles = [];
}
