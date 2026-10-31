import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import type { FontLoader } from "./edits";
import { addPageNumbers, addWatermark, roman } from "./stamp";
import { OperationError } from "./types";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const require = createRequire(import.meta.url);
const loadFont: FontLoader = async () => new Uint8Array(readFileSync(require.resolve("@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf")));
const fixture = (name: string) => ({ name, bytes: new Uint8Array(readFileSync(new URL(`../../../../test-files/${name}`, import.meta.url))) });

// Text as the reader sees it: position (top-left origin), size of the page, and the angle
// the text runs at on screen (0 = upright and horizontal, positive = rising to the right).
async function shownText(bytes: Uint8Array, match: RegExp) {
  const pdf = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  try {
    const out = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      for (const item of (await page.getTextContent()).items) {
        if (!("str" in item) || !match.test(item.str)) continue;
        const [a, b, , , e, f] = pdfjs.Util.transform(viewport.transform, item.transform);
        out.push({ page: n, str: item.str, x: e, y: f, width: item.width, angle: (-Math.atan2(b, a) * 180) / Math.PI, pageW: viewport.width, pageH: viewport.height });
      }
    }
    return out;
  } finally {
    await pdf.loadingTask.destroy();
  }
}

describe("roman", () => {
  it("writes lower-case Roman numerals", () => {
    expect([1, 4, 9, 14, 40, 90, 400, 1994].map(roman)).toEqual(["i", "iv", "ix", "xiv", "xl", "xc", "cd", "mcmxciv"]);
  });
});

describe("addPageNumbers", () => {
  it("numbers every page at the bottom centre, upright even on a turned page", async () => {
    // mixed-sizes: A4 portrait, A4 landscape, and a Letter page rotated 90 degrees.
    const out = await addPageNumbers(fixture("mixed-sizes.pdf"), { position: "Bottom centre", format: "1, 2, 3", start: 1, skipFirst: false });
    const numbers = await shownText(out.bytes, /^\d+$/);
    expect(numbers.map((n) => n.str)).toEqual(["1", "2", "3"]);
    for (const n of numbers) {
      expect(n.angle).toBeCloseTo(0, 3);
      expect(n.x + n.width / 2).toBeCloseTo(n.pageW / 2, 0);
      expect(n.y).toBeCloseTo(n.pageH - 28, 0); // baseline 28 pt above the bottom edge
    }
    expect(out.name).toBe("mixed-sizes-numbered.pdf");
  });

  it("supports 'Page 1 of N', a start number and skipping the cover", async () => {
    const out = await addPageNumbers(fixture("sample-3-pages.pdf"), { position: "Top right", format: "Page 1 of N", start: 5, skipFirst: true });
    // The sample already prints its own "Page 1 of 3" footer, so match only the added labels.
    const labels = await shownText(out.bytes, /^Page \d+ of 6$/);
    expect(labels.map((l) => [l.page, l.str])).toEqual([
      [2, "Page 5 of 6"],
      [3, "Page 6 of 6"],
    ]);
    expect(labels[0].x + labels[0].width).toBeCloseTo(labels[0].pageW - 28, 0);
    expect(labels[0].y).toBeLessThan(45);
  });

  it("writes Roman numerals", async () => {
    const out = await addPageNumbers(fixture("sample-3-pages.pdf"), { position: "Bottom left", format: "i, ii, iii", start: 1, skipFirst: false });
    expect((await shownText(out.bytes, /^[ivx]+$/)).map((l) => l.str)).toEqual(["i", "ii", "iii"]);
  });

  it("rejects an invalid start number", async () => {
    await expect(addPageNumbers(fixture("sample-3-pages.pdf"), { position: "Bottom centre", format: "1, 2, 3", start: -1, skipFirst: false })).rejects.toThrow(OperationError);
  });
});

describe("addWatermark", () => {
  it("runs the text corner to corner across the middle of each page as shown", async () => {
    const out = await addWatermark(fixture("mixed-sizes.pdf"), { text: "CONFIDENTIAL", position: "Diagonal centre", opacity: 0.35 }, loadFont);
    const marks = await shownText(out.bytes, /CONFIDENTIAL/);
    expect(marks).toHaveLength(3);
    for (const m of marks) {
      expect(m.angle).toBeCloseTo((Math.atan2(m.pageH, m.pageW) * 180) / Math.PI, 1);
      // The middle of the baseline sits near the page centre (cap height shifts it slightly).
      const rad = (m.angle * Math.PI) / 180;
      const midX = m.x + (Math.cos(rad) * m.width) / 2;
      const midY = m.y - (Math.sin(rad) * m.width) / 2;
      expect(Math.abs(midX - m.pageW / 2)).toBeLessThan(40);
      expect(Math.abs(midY - m.pageH / 2)).toBeLessThan(40);
      expect(m.width).toBeLessThanOrEqual(Math.hypot(m.pageW, m.pageH) * 0.7 + 1);
    }
  });

  it("places a horizontal watermark at the bottom", async () => {
    const out = await addWatermark(fixture("sample-3-pages.pdf"), { text: "DRAFT", position: "Bottom", opacity: 0.5 }, loadFont);
    const [m] = await shownText(out.bytes, /DRAFT/);
    expect(m.angle).toBeCloseTo(0, 3);
    expect(m.x + m.width / 2).toBeCloseTo(m.pageW / 2, 0);
    expect(m.y).toBeGreaterThan(m.pageH - 80);
  });

  it("uses Inter for text the standard font can't show", async () => {
    const out = await addWatermark(fixture("sample-3-pages.pdf"), { text: "Конфиденциально", position: "Centre", opacity: 0.35 }, loadFont);
    expect((await shownText(out.bytes, /Конфиденциально/)).length).toBe(3);
  });

  it("explains characters it can't show, and empty text", async () => {
    await expect(addWatermark(fixture("sample-3-pages.pdf"), { text: "机密", position: "Centre", opacity: 0.35 }, loadFont)).rejects.toThrow(/can't be used/);
    await expect(addWatermark(fixture("sample-3-pages.pdf"), { text: "  ", position: "Centre", opacity: 0.35 }, loadFont)).rejects.toThrow(/Type the watermark/);
  });
});
