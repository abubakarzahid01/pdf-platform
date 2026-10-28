import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { mergePdfs } from "./merge";
import { organizePdf } from "./organize";
import { parsePageRanges, rangesToIndices } from "./page-ranges";
import { rotatePdf } from "./rotate";
import { splitPdf } from "./split";
import type { InputPdf } from "./types";

// Real fixtures from test-files/, so outputs are checked as actual PDFs.
function fixture(name: string): InputPdf {
  return { name, bytes: new Uint8Array(readFileSync(new URL(`../../../../test-files/${name}`, import.meta.url))) };
}

async function open(bytes: Uint8Array) {
  return PDFDocument.load(bytes);
}

function sizes(doc: PDFDocument) {
  return doc.getPages().map((p) => {
    const { width, height } = p.getSize();
    return `${Math.round(width)}x${Math.round(height)}`;
  });
}

describe("parsePageRanges", () => {
  it("reads single pages and ranges", () => {
    expect(parsePageRanges("1-3, 5, 8 - 10", 10)).toEqual({
      ok: true,
      ranges: [
        { start: 1, end: 3 },
        { start: 5, end: 5 },
        { start: 8, end: 10 },
      ],
    });
  });

  it("rejects pages beyond the document with a clear message", () => {
    expect(parsePageRanges("2-12", 10)).toEqual({ ok: false, message: "Page 12 doesn't exist. This PDF has 10 pages." });
  });

  it("rejects empty, reversed, zero and non-numeric input", () => {
    expect(parsePageRanges("  ", 5).ok).toBe(false);
    expect(parsePageRanges("4-2", 5).ok).toBe(false);
    expect(parsePageRanges("0", 5).ok).toBe(false);
    expect(parsePageRanges("abc", 5).ok).toBe(false);
  });

  it("turns ranges into unique zero-based indices in order", () => {
    const parsed = parsePageRanges("3-4, 1, 4", 5);
    expect(parsed.ok && rangesToIndices(parsed.ranges)).toEqual([2, 3, 0]);
  });
});

describe("mergePdfs", () => {
  it("combines all pages in the given order", async () => {
    const result = await mergePdfs([fixture("sample-3-pages.pdf"), fixture("mixed-sizes.pdf")]);
    const doc = await open(result.bytes);
    expect(result.pageCount).toBe(6);
    expect(doc.getPageCount()).toBe(6);
    expect(sizes(doc)).toEqual(["595x842", "595x842", "595x842", "595x842", "842x595", "612x792"]);
  });

  it("keeps existing page rotation", async () => {
    const doc = await open((await mergePdfs([fixture("mixed-sizes.pdf"), fixture("sample-3-pages.pdf")])).bytes);
    expect(doc.getPage(2).getRotation().angle).toBe(90);
  });

  it("needs at least two files", async () => {
    await expect(mergePdfs([fixture("sample-3-pages.pdf")])).rejects.toThrow("at least two");
  });
});

describe("splitPdf", () => {
  it("makes one file per range", async () => {
    const outputs = await splitPdf(fixture("long-150-pages.pdf"), "ranges", "1-3, 10, 148-150");
    expect(outputs.map((o) => [o.name, o.pageCount])).toEqual([
      ["long-150-pages-pages-1-3.pdf", 3],
      ["long-150-pages-page-10.pdf", 1],
      ["long-150-pages-pages-148-150.pdf", 3],
    ]);
    for (const o of outputs) expect((await open(o.bytes)).getPageCount()).toBe(o.pageCount);
  });

  it("makes one file per page", async () => {
    const outputs = await splitPdf(fixture("mixed-sizes.pdf"), "every-page");
    expect(outputs).toHaveLength(3);
    expect(sizes(await open(outputs[1].bytes))).toEqual(["842x595"]);
  });

  it("extracts selected pages into one file", async () => {
    const [output] = await splitPdf(fixture("mixed-sizes.pdf"), "extract", "3, 1");
    const doc = await open(output.bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(sizes(doc)).toEqual(["612x792", "595x842"]);
  });

  it("reports invalid page selections", async () => {
    await expect(splitPdf(fixture("sample-3-pages.pdf"), "ranges", "1-9")).rejects.toThrow("Page 9 doesn't exist");
  });
});

describe("organizePdf", () => {
  it("reorders, deletes and rotates pages in one pass", async () => {
    // mixed-sizes: [A4 portrait, A4 landscape, Letter rotated 90]
    const result = await organizePdf(fixture("mixed-sizes.pdf"), [
      { source: 2, rotate: 270 },
      { source: 0, rotate: 90 },
    ]);
    const doc = await open(result.bytes);
    expect(result.name).toBe("mixed-sizes-organised.pdf");
    expect(doc.getPageCount()).toBe(2);
    expect(sizes(doc)).toEqual(["612x792", "595x842"]);
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90]);
  });

  it("keeps everything unchanged when nothing is edited", async () => {
    const doc = await open((await organizePdf(fixture("sample-3-pages.pdf"), [0, 1, 2].map((source) => ({ source, rotate: 0 })))).bytes);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([0, 0, 0]);
  });

  it("refuses an empty document and invalid page references", async () => {
    await expect(organizePdf(fixture("sample-3-pages.pdf"), [])).rejects.toThrow("at least one page");
    await expect(organizePdf(fixture("sample-3-pages.pdf"), [{ source: 3, rotate: 0 }])).rejects.toThrow("doesn't match");
  });
});

describe("rotatePdf", () => {
  it("rotates all pages clockwise, adding to existing rotation", async () => {
    const doc = await open((await rotatePdf(fixture("mixed-sizes.pdf"), 90, "all")).bytes);
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([90, 90, 180]);
  });

  it("rotates only odd or even pages", async () => {
    const odd = await open((await rotatePdf(fixture("sample-3-pages.pdf"), 180, "odd")).bytes);
    expect(odd.getPages().map((p) => p.getRotation().angle)).toEqual([180, 0, 180]);
    const even = await open((await rotatePdf(fixture("sample-3-pages.pdf"), 270, "even")).bytes);
    expect(even.getPages().map((p) => p.getRotation().angle)).toEqual([0, 270, 0]);
  });

  it("wraps around a full turn", async () => {
    const doc = await open((await rotatePdf(fixture("mixed-sizes.pdf"), 270, "all")).bytes);
    expect(doc.getPage(2).getRotation().angle).toBe(0);
  });
});
