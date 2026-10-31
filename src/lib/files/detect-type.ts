// Identifies a file by its first bytes ("magic numbers"), never by its name or
// the browser-reported MIME type, which can both be wrong or spoofed.

export type FileKind =
  | "pdf"
  | "zip" // DOCX, XLSX, PPTX, ODT, ODS, ODP are all ZIP containers
  | "ole" // legacy DOC, XLS, PPT
  | "rtf"
  | "png"
  | "jpeg"
  | "gif"
  | "webp"
  | "bmp"
  | "tiff"
  | "text"
  | "unknown";

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

export function detectKind(head: Uint8Array): FileKind {
  // PDF spec allows the %PDF- header anywhere in the first 1024 bytes.
  const text = ascii(head, 0, Math.min(head.length, 1024));
  if (text.includes("%PDF-")) return "pdf";
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) return "zip";
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";
  if (text.startsWith("{\\rtf")) return "rtf";
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "jpeg";
  if (text.startsWith("GIF87a") || text.startsWith("GIF89a")) return "gif";
  if (text.startsWith("RIFF") && ascii(head, 8, 4) === "WEBP") return "webp";
  if (text.startsWith("BM")) return "bmp";
  if (startsWith(head, [0x49, 0x49, 0x2a, 0x00]) || startsWith(head, [0x4d, 0x4d, 0x00, 0x2a])) return "tiff";
  // Plain text: no NUL bytes in the sample.
  if (head.length > 0 && !head.includes(0)) return "text";
  return "unknown";
}

export async function readHead(file: Blob, length = 1024) {
  return new Uint8Array(await file.slice(0, length).arrayBuffer());
}
