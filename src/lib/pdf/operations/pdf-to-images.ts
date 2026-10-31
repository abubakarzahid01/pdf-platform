import { OperationError, baseName, type InputPdf, type OutputFile } from "./types";

export type ImageFormat = "png" | "jpeg";

// Draws one page (0-based) at the given resolution and returns the encoded image.
export type PageRenderer = {
  pageCount: number;
  // Page size in points (1/72 inch), as displayed (rotation applied).
  pageSize: (pageIndex: number) => Promise<{ width: number; height: number }>;
  render: (pageIndex: number, scale: number, format: ImageFormat) => Promise<Uint8Array>;
  close: () => void;
};

// Keeps memory in check: one page image at most this many pixels (about 7,000 × 7,000).
export const MAX_PIXELS = 50_000_000;
// Rough total output limit before asking for a lower quality.
export const MAX_TOTAL_PIXELS = 1_500_000_000;

/** Saves every page as a PNG or JPG image. */
export async function pdfToImages(
  input: InputPdf,
  format: ImageFormat,
  dpi: number,
  open: (bytes: Uint8Array) => Promise<PageRenderer>,
): Promise<OutputFile[]> {
  const renderer = await open(input.bytes);
  try {
    const sizes = await Promise.all(Array.from({ length: renderer.pageCount }, (_, i) => renderer.pageSize(i)));
    const scales = sizes.map((s) => Math.min(dpi / 72, Math.sqrt(MAX_PIXELS / (s.width * s.height))));
    const total = sizes.reduce((n, s, i) => n + s.width * s.height * scales[i] ** 2, 0);
    if (total > MAX_TOTAL_PIXELS) {
      throw new OperationError("This file has too many pages for this quality. Choose a lower quality, or split the PDF first.");
    }

    const base = baseName(input.name);
    const ext = format === "png" ? "png" : "jpg";
    const digits = String(renderer.pageCount).length;
    const outputs: OutputFile[] = [];
    for (let i = 0; i < renderer.pageCount; i++) {
      outputs.push({
        name: `${base}-page-${String(i + 1).padStart(digits, "0")}.${ext}`,
        bytes: await renderer.render(i, scales[i], format),
        pageCount: 1,
        mime: format === "png" ? "image/png" : "image/jpeg",
      });
    }
    const reduced = scales.some((s) => s < dpi / 72 - 1e-9);
    if (reduced) outputs[0].note = "Some very large pages were saved at a lower resolution to keep the images a manageable size.";
    return outputs;
  } finally {
    renderer.close();
  }
}
