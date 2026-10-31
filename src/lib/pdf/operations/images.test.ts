import { readFileSync } from "node:fs";
import jpeg from "jpeg-js";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { imagesToPdf, type PdfReadyImage } from "./images-to-pdf";
import { MAX_PIXELS, pdfToImages, type PageRenderer } from "./pdf-to-images";
import { OperationError } from "./types";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

// invoice-scanned.png: a real 1700 × 2200 screenshot (portrait).
const png: PdfReadyImage = { name: "scan.png", bytes: new Uint8Array(readFileSync(new URL("../../../../test-files/invoice-scanned.png", import.meta.url))), format: "png", width: 1700, height: 2200 };
// A landscape JPEG photo-like image.
const jpg: PdfReadyImage = {
  name: "photo.jpg",
  bytes: new Uint8Array(jpeg.encode({ data: new Uint8Array(400 * 300 * 4).fill(180), width: 400, height: 300 }, 85).data),
  format: "jpeg",
  width: 400,
  height: 300,
};

// Where each page's image is drawn, read back from the PDF's drawing commands.
async function imagePlacements(bytes: Uint8Array) {
  const pdf = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  try {
    const out: { page: [number, number]; x: number; y: number; w: number; h: number }[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const [, , pw, ph] = page.view;
      const ops = await page.getOperatorList();
      // Transforms stack up (translate, then scale...) until the graphics state is restored.
      let matrix = [1, 0, 0, 1, 0, 0];
      const saved: number[][] = [];
      ops.fnArray.forEach((fn, i) => {
        if (fn === pdfjs.OPS.save) saved.push(matrix);
        if (fn === pdfjs.OPS.restore) matrix = saved.pop() ?? [1, 0, 0, 1, 0, 0];
        if (fn === pdfjs.OPS.transform) matrix = pdfjs.Util.transform(matrix, ops.argsArray[i]);
        if (fn === pdfjs.OPS.paintImageXObject) out.push({ page: [pw, ph], x: matrix[4], y: matrix[5], w: matrix[0], h: matrix[3] });
      });
    }
    return out;
  } finally {
    await pdf.loadingTask.destroy();
  }
}

describe("imagesToPdf", () => {
  it("makes one page per image, in order, each the size of its image", async () => {
    const out = await imagesToPdf([png, jpg], { pageSize: "Fit to image", orientation: "Auto", margin: "None" });
    expect(out.pageCount).toBe(2);
    expect(out.name).toBe("scan-and-1-more.pdf");
    const [a, b] = await imagePlacements(out.bytes);
    expect(a.page).toEqual([1275, 1650]); // 1700 × 2200 px at 96 per inch
    expect(a).toMatchObject({ x: 0, y: 0, w: 1275, h: 1650 });
    expect(b.page).toEqual([300, 225]);
  });

  it("fits images inside A4 margins, centred, turning the page for landscape images", async () => {
    const out = await imagesToPdf([png, jpg], { pageSize: "A4", orientation: "Auto", margin: "Large" });
    const [a, b] = await imagePlacements(out.bytes);
    // Portrait scan scaled down to fit within 50 pt margins: the width is the limit here.
    expect(a.page).toEqual([595.28, 841.89]);
    expect(a.w).toBeCloseTo(495.28, 1);
    expect(a.x).toBeCloseTo(50, 1);
    expect(a.h / a.w).toBeCloseTo(2200 / 1700, 3); // not stretched
    expect(a.y + a.h / 2).toBeCloseTo(841.89 / 2, 1); // centred vertically
    // Small landscape photo: landscape page, kept at its natural size (not enlarged), centred.
    expect(b.page).toEqual([841.89, 595.28]);
    expect(b).toMatchObject({ w: 300, h: 225 });
    expect(b.x).toBeCloseTo((841.89 - 300) / 2, 1);
  });

  it("follows a chosen orientation", async () => {
    const out = await imagesToPdf([jpg], { pageSize: "Letter", orientation: "Portrait", margin: "None" });
    const [b] = await imagePlacements(out.bytes);
    expect(b.page).toEqual([612, 792]);
    expect(out.name).toBe("photo.pdf");
  });

  it("explains a damaged image instead of failing silently", async () => {
    const broken = { ...jpg, name: "broken.jpg", bytes: jpg.bytes.slice(0, 40) };
    await expect(imagesToPdf([broken], { pageSize: "A4", orientation: "Auto", margin: "None" })).rejects.toThrow(/broken\.jpg couldn't be added/);
  });

  it("produces a file that opens as a normal PDF", async () => {
    const out = await imagesToPdf([png], { pageSize: "A4", orientation: "Auto", margin: "Small" });
    expect((await PDFDocument.load(out.bytes)).getPageCount()).toBe(1);
  });
});

describe("pdfToImages", () => {
  const fakeRenderer = (sizes: { width: number; height: number }[], log: number[] = []) => async (): Promise<PageRenderer> => ({
    pageCount: sizes.length,
    pageSize: async (i) => sizes[i],
    render: async (i, scale) => (log.push(scale), new Uint8Array([i])),
    close: () => {},
  });

  it("names one image per page and renders at the chosen resolution", async () => {
    const scales: number[] = [];
    const out = await pdfToImages({ name: "report.pdf", bytes: new Uint8Array() }, "png", 150, fakeRenderer(Array(12).fill({ width: 612, height: 792 }), scales));
    expect(out.map((o) => o.name).slice(0, 2)).toEqual(["report-page-01.png", "report-page-02.png"]);
    expect(out[11].name).toBe("report-page-12.png");
    expect(out[0].mime).toBe("image/png");
    expect(scales[0]).toBeCloseTo(150 / 72);
    expect(out[0].note).toBeUndefined();
  });

  it("uses .jpg names for JPG", async () => {
    const out = await pdfToImages({ name: "a.pdf", bytes: new Uint8Array() }, "jpeg", 72, fakeRenderer([{ width: 100, height: 100 }]));
    expect(out[0]).toMatchObject({ name: "a-page-1.jpg", mime: "image/jpeg" });
  });

  it("lowers the resolution of huge pages and says so", async () => {
    const scales: number[] = [];
    // A 5 × 5 m poster page at 300 DPI would be billions of pixels.
    const out = await pdfToImages({ name: "poster.pdf", bytes: new Uint8Array() }, "png", 300, fakeRenderer([{ width: 14400, height: 14400 }], scales));
    expect(14400 * 14400 * scales[0] ** 2).toBeLessThanOrEqual(MAX_PIXELS + 1);
    expect(out[0].note).toMatch(/lower resolution/);
  });

  it("asks for a lower quality when the whole file would be too big", async () => {
    const pages = Array(200).fill({ width: 612, height: 792 });
    await expect(pdfToImages({ name: "long.pdf", bytes: new Uint8Array() }, "png", 300, fakeRenderer(pages))).rejects.toThrow(OperationError);
    await expect(pdfToImages({ name: "long.pdf", bytes: new Uint8Array() }, "png", 150, fakeRenderer(pages))).resolves.toHaveLength(200);
  });
});
