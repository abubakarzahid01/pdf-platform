import { readFileSync } from "node:fs";
import jpeg from "jpeg-js";
import { PDFDocument, PDFName, PDFNumber, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { compressPdf, type ImageRecoder } from "./compress";
import type { InputPdf } from "./types";

function fixture(name: string): InputPdf {
  return { name, bytes: new Uint8Array(readFileSync(new URL(`../../../../test-files/${name}`, import.meta.url))) };
}

// Pure-JS stand-in for the browser recoder: decode, nearest-neighbour downscale, JPEG encode.
const testRecoder: ImageRecoder = async (image, maxSide, quality) => {
  let rgba: Uint8Array;
  if (image.kind === "jpeg") {
    rgba = jpeg.decode(image.bytes, { useTArray: true, formatAsRGBA: true }).data;
  } else {
    rgba = new Uint8Array(image.width * image.height * 4);
    for (let p = 0, s = 0; p < rgba.length; p += 4, s += image.components) {
      rgba[p] = image.pixels[s];
      rgba[p + 1] = image.pixels[image.components === 3 ? s + 1 : s];
      rgba[p + 2] = image.pixels[image.components === 3 ? s + 2 : s];
      rgba[p + 3] = 255;
    }
  }
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = Math.min(image.width - 1, Math.floor(x / scale));
      const sy = Math.min(image.height - 1, Math.floor(y / scale));
      out.set(rgba.subarray((sy * image.width + sx) * 4, (sy * image.width + sx) * 4 + 4), (y * width + x) * 4);
    }
  }
  return { bytes: new Uint8Array(jpeg.encode({ data: out, width, height }, Math.round(quality * 100)).data), width, height, components: 3 };
};

async function imageSizes(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  const sizes: { width: number; height: number; filter: string }[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream && obj.dict.lookup(PDFName.of("Subtype")) === PDFName.of("Image")) {
      sizes.push({
        width: (obj.dict.lookup(PDFName.of("Width")) as PDFNumber).asNumber(),
        height: (obj.dict.lookup(PDFName.of("Height")) as PDFNumber).asNumber(),
        filter: String(obj.dict.lookup(PDFName.of("Filter"))),
      });
    }
  }
  return sizes.sort((a, b) => b.width - a.width);
}

// Image recompression is CPU-heavy; with other test files running in parallel it can pass 5 s.
describe("compressPdf", { timeout: 30_000 }, () => {
  it("shrinks large JPEG and lossless images, keeping pages", async () => {
    const input = fixture("images-heavy.pdf");
    const result = await compressPdf(input, "recommended", testRecoder);

    expect(result.stats.imagesFound).toBe(2);
    expect(result.stats.imagesRecompressed).toBe(2);
    expect(result.bytes.length).toBeLessThan(input.bytes.length * 0.5);
    expect(result.name).toBe("images-heavy-compressed.pdf");
    expect(result.note).toMatch(/% smaller/);

    const doc = await PDFDocument.load(result.bytes);
    expect(doc.getPageCount()).toBe(2);
    // A4's long side is 11.69 in, so at 150 DPI no image needs more than 1754 px.
    const sizes = await imageSizes(result.bytes);
    expect(sizes.map((s) => s.filter)).toEqual(["/DCTDecode", "/DCTDecode"]);
    expect(Math.max(...sizes.map((s) => Math.max(s.width, s.height)))).toBeLessThanOrEqual(1754);
    // The 1300 px lossless image is already below the limit: re-encoded but not resized.
    expect(sizes[1]).toMatchObject({ width: 1300, height: 860 });
  });

  it("uses smaller images for stronger levels", async () => {
    const low = await compressPdf(fixture("images-heavy.pdf"), "low", testRecoder);
    const high = await compressPdf(fixture("images-heavy.pdf"), "high", testRecoder);
    expect(high.bytes.length).toBeLessThan(low.bytes.length);
    expect((await imageSizes(high.bytes))[0].width).toBeLessThanOrEqual(1123); // 11.69 in × 96 DPI
  });

  it("returns the original unchanged when there is nothing worth compressing", async () => {
    const input = fixture("sample-3-pages.pdf");
    const result = await compressPdf(input, "high", testRecoder);
    expect(result.bytes).toBe(input.bytes);
    expect(result.name).toBe("sample-3-pages.pdf");
    expect(result.note).toMatch(/already well optimised/);
    expect(result.unchanged).toBe(true);
  });

  it("never replaces an image when the recoder declines", async () => {
    const input = fixture("images-heavy.pdf");
    const result = await compressPdf(input, "recommended", async () => null);
    expect(result.stats.imagesRecompressed).toBe(0);
    expect(result.bytes).toBe(input.bytes);
  });
});
