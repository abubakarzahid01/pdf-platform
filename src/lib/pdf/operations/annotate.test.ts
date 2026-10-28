import { readFileSync } from "node:fs";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFString } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { annotatePdf } from "./annotate";
import type { InputPdf } from "./types";

function fixture(name: string): InputPdf {
  return { name, bytes: new Uint8Array(readFileSync(new URL(`../../../../test-files/${name}`, import.meta.url))) };
}

async function annotationsOf(bytes: Uint8Array, pageIndex: number) {
  const doc = await PDFDocument.load(bytes);
  const annots = doc.getPage(pageIndex).node.Annots();
  if (!annots) return [];
  return annots.asArray().map((ref) => doc.context.lookup(ref, PDFDict));
}

const numbers = (arr: PDFArray) => arr.asArray().map((v) => Math.round((v as PDFNumber).asNumber()));

describe("annotatePdf", () => {
  it("writes highlight, ink and comment annotations with appearances", async () => {
    const result = await annotatePdf(fixture("sample-3-pages.pdf"), [
      { type: "highlight", page: 0, rect: [300, 700, 100, 680], color: [1, 0.85, 0.2] },
      { type: "ink", page: 1, points: [[100, 100], [150, 140], [200, 110]], color: [0.2, 0.3, 0.9], width: 2 },
      { type: "comment", page: 2, at: [400, 500], text: "Check this figure — café" },
    ]);
    expect(result.name).toBe("sample-3-pages-annotated.pdf");

    const [highlight] = await annotationsOf(result.bytes, 0);
    expect(highlight.lookup(PDFName.of("Subtype"))).toBe(PDFName.of("Highlight"));
    expect(numbers(highlight.lookup(PDFName.of("Rect"), PDFArray))).toEqual([100, 680, 300, 700]);
    expect(numbers(highlight.lookup(PDFName.of("QuadPoints"), PDFArray))).toEqual([100, 700, 300, 700, 100, 680, 300, 680]);

    const [ink] = await annotationsOf(result.bytes, 1);
    expect(ink.lookup(PDFName.of("Subtype"))).toBe(PDFName.of("Ink"));
    expect(numbers(ink.lookup(PDFName.of("Rect"), PDFArray))).toEqual([98, 98, 202, 142]);

    const [comment] = await annotationsOf(result.bytes, 2);
    expect(comment.lookup(PDFName.of("Subtype"))).toBe(PDFName.of("Text"));
    const contents = comment.lookup(PDFName.of("Contents")) as PDFHexString | PDFString;
    expect(contents.decodeText()).toBe("Check this figure — café");

    // Every annotation has a normal appearance stream so all viewers render it.
    for (const a of [highlight, ink, comment]) {
      const ap = a.lookup(PDFName.of("AP"), PDFDict);
      expect(ap.lookup(PDFName.of("N"))).toBeInstanceOf(PDFRawStream);
    }
  });

  it("adds to existing annotations instead of replacing them", async () => {
    const once = await annotatePdf(fixture("sample-3-pages.pdf"), [{ type: "comment", page: 0, at: [50, 50], text: "First" }]);
    const twice = await annotatePdf({ name: "x.pdf", bytes: once.bytes }, [{ type: "comment", page: 0, at: [80, 80], text: "Second" }]);
    expect(await annotationsOf(twice.bytes, 0)).toHaveLength(2);
  });

  it("skips empty comments and single-point strokes, and rejects missing pages", async () => {
    const result = await annotatePdf(fixture("sample-3-pages.pdf"), [
      { type: "comment", page: 0, at: [50, 50], text: "   " },
      { type: "ink", page: 0, points: [[10, 10]], color: [0, 0, 0], width: 2 },
    ]);
    expect(await annotationsOf(result.bytes, 0)).toHaveLength(0);
    await expect(
      annotatePdf(fixture("sample-3-pages.pdf"), [{ type: "comment", page: 9, at: [0, 0], text: "x" }]),
    ).rejects.toThrow("doesn't exist");
  });
});
