import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cropPdf, type ContentBox } from "./crop";
import { OperationError } from "./types";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const fixture = (name: string) => ({ name, bytes: new Uint8Array(readFileSync(new URL(`../../../../test-files/${name}`, import.meta.url))) });
const MM = 72 / 25.4;

// Each page's size as a viewer shows it, and where a known word now sits on it.
async function shown(bytes: Uint8Array, word?: RegExp) {
  const pdf = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  try {
    const out = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      let at: { x: number; y: number } | undefined;
      if (word) {
        const item = (await page.getTextContent()).items.find((i) => "str" in i && word.test(i.str));
        if (item && "transform" in item) {
          const [, , , , x, y] = pdfjs.Util.transform(viewport.transform, item.transform);
          at = { x, y };
        }
      }
      out.push({ width: viewport.width, height: viewport.height, at });
    }
    return out;
  } finally {
    await pdf.loadingTask.destroy();
  }
}

describe("cropPdf with set margins", () => {
  it("cuts the same margins from every page as shown, including a turned page", async () => {
    const before = await shown(fixture("mixed-sizes.pdf").bytes);
    const out = await cropPdf(fixture("mixed-sizes.pdf"), { mode: "margins", margins: { top: 10, right: 20, bottom: 30, left: 40 } });
    const after = await shown(out.bytes);
    after.forEach((page, i) => {
      expect(page.width).toBeCloseTo(before[i].width - 60 * MM, 1);
      expect(page.height).toBeCloseTo(before[i].height - 40 * MM, 1);
    });
    expect(out.name).toBe("mixed-sizes-cropped.pdf");
    expect(out.note).toMatch(/doesn't delete it/);
  });

  it("moves content by exactly the left and top margins", async () => {
    const word = /Sample report/;
    const [before] = await shown(fixture("sample-3-pages.pdf").bytes, word);
    const out = await cropPdf(fixture("sample-3-pages.pdf"), { mode: "margins", margins: { top: 15, right: 0, bottom: 0, left: 12 } });
    const [after] = await shown(out.bytes, word);
    expect(after.at!.x).toBeCloseTo(before.at!.x - 12 * MM, 1);
    expect(after.at!.y).toBeCloseTo(before.at!.y - 15 * MM, 1);
  });

  it("refuses margins that would leave almost nothing", async () => {
    await expect(cropPdf(fixture("sample-3-pages.pdf"), { mode: "margins", margins: { top: 140, right: 0, bottom: 140, left: 0 } })).rejects.toThrow(OperationError);
  });
});

describe("cropPdf removing white margins", () => {
  const finder = (boxes: (ContentBox | null)[]) => async () => boxes;

  it("trims each page to its content plus a small border, and leaves blank pages alone", async () => {
    // Page 1: content block from (100, 150) to (400, 500) on the displayed page; pages 2-3 blank.
    const out = await cropPdf(fixture("sample-3-pages.pdf"), { mode: "auto", findContent: finder([{ left: 100, top: 150, right: 400, bottom: 500 }, null, null]) });
    const pages = await shown(out.bytes);
    expect(pages[0].width).toBeCloseTo(300 + 16, 1);
    expect(pages[0].height).toBeCloseTo(350 + 16, 1);
    expect(pages[1].width).toBeCloseTo(595.28, 1);
    expect(out.note).toMatch(/1 of 3 pages cropped/);
  });

  it("works on a turned page", async () => {
    // mixed-sizes page 3 is Letter turned 90 degrees: shown as 792 × 612.
    const out = await cropPdf(fixture("mixed-sizes.pdf"), { mode: "auto", findContent: finder([null, null, { left: 50, top: 60, right: 700, bottom: 500 }]) });
    const [, , page] = await shown(out.bytes);
    expect(page.width).toBeCloseTo(650 + 16, 1);
    expect(page.height).toBeCloseTo(440 + 16, 1);
  });

  it("returns the original when there are no margins to remove", async () => {
    const out = await cropPdf(fixture("sample-3-pages.pdf"), { mode: "auto", findContent: finder([{ left: 2, top: 2, right: 593, bottom: 840 }, null, null]) });
    expect(out.unchanged).toBe(true);
    expect(out.note).toMatch(/unchanged/);
  });
});
