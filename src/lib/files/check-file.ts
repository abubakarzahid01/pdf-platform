import { limits } from "@/config/site";
import { detectKind, readHead, type FileKind } from "@/lib/files/detect-type";
import { closePdf, loadPdfJs, type PDFDocumentProxy } from "@/lib/pdf/pdfjs";

export type CheckErrorCode =
  | "empty"
  | "too-large"
  | "wrong-type"
  | "password"
  | "damaged"
  | "too-many-pages"
  | "unreadable";

export type CheckResult =
  | { ok: true; kind: FileKind; pageCount?: number; pdf?: PDFDocumentProxy }
  | { ok: false; code: CheckErrorCode; message: string };

const kindNames: Partial<Record<FileKind, string>> = {
  pdf: "a PDF",
  zip: "an Office document",
  ole: "an older Office document",
  rtf: "an RTF document",
  png: "a PNG image",
  jpeg: "a JPG image",
  gif: "a GIF image",
  webp: "a WEBP image",
  bmp: "a BMP image",
  tiff: "a TIFF image",
  text: "a text file",
};

function fail(code: CheckErrorCode, message: string): CheckResult {
  return { ok: false, code, message };
}

/**
 * Checks a file before any tool uses it: size, real file type (from its bytes),
 * and for PDFs whether it opens, is password-protected or exceeds the page limit.
 * On success with a PDF, the opened document is returned; the caller must pass it
 * to `closePdf()` when finished with it.
 */
export async function checkFile(file: File, allowed: FileKind[], expectedLabel: string): Promise<CheckResult> {
  const maxBytes = limits.free.maxFileSizeMb * 1024 * 1024;
  if (file.size === 0) return fail("empty", "This file is empty.");
  if (file.size > maxBytes) {
    return fail("too-large", `This file is larger than the ${limits.free.maxFileSizeMb} MB limit.`);
  }

  const kind = detectKind(await readHead(file));
  if (!allowed.includes(kind)) {
    const actual = kindNames[kind];
    return fail(
      "wrong-type",
      actual
        ? `This file is ${actual}, not ${expectedLabel}. Its name or extension may be misleading.`
        : `This file isn't ${expectedLabel}, or its type couldn't be recognised.`,
    );
  }

  if (kind !== "pdf") return { ok: true, kind };
  return openPdf(file);
}

async function openPdf(file: File): Promise<CheckResult> {
  const pdfjs = await loadPdfJs();
  // No onPassword handler: PDF.js then rejects locked files with a PasswordException.
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });

  try {
    const pdf = await task.promise;
    if (pdf.numPages > limits.free.maxPages) {
      const count = pdf.numPages;
      closePdf(pdf);
      return fail("too-many-pages", `This PDF has ${count} pages. The limit is ${limits.free.maxPages} pages.`);
    }
    return { ok: true, kind: "pdf", pageCount: pdf.numPages, pdf };
  } catch (error) {
    task.destroy().catch(() => {});
    if (error instanceof pdfjs.PasswordException || (error instanceof Error && error.name === "PasswordException")) {
      return fail("password", "This PDF is password-protected. Remove the password, then try again.");
    }
    if (error instanceof pdfjs.InvalidPDFException || (error instanceof Error && error.name === "InvalidPDFException")) {
      return fail("damaged", "This PDF appears to be damaged or incomplete and can't be opened.");
    }
    return fail("unreadable", "This PDF couldn't be read. It may be damaged or use an unsupported feature.");
  }
}
