import { zipSync } from "fflate";

// Saves bytes as a file through the browser's normal download.
export function downloadBytes(bytes: Uint8Array | Blob, fileName: string, type = "application/pdf") {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Bundles several files into one ZIP. PDFs are already compressed, so they are stored as-is.
export function zipFiles(files: { name: string; bytes: Uint8Array }[]) {
  return zipSync(Object.fromEntries(files.map((f) => [f.name, f.bytes])), { level: 0 });
}
