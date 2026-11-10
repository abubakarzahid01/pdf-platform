import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { nodeFontLoader } from "../fonts-node";
import { describe, expect, it } from "vitest";
import { applyEdits } from "../operations/edits";
import type { TextExtractor } from "./apply";
import { codesOf } from "./fonts";
import { readPageText } from "./lines";
import { previewLine } from "./preview";
import { similarFontNotice } from "./preview-notice";

function bytesOf(name: string) {
  return new Uint8Array(readFileSync(new URL(`../../../../test-files/${name}`, import.meta.url)));
}

const loadFont = nodeFontLoader;

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const extract: TextExtractor = async (bytes, pageIndex) => {
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const content = await (await doc.getPage(pageIndex + 1)).getTextContent();
  await doc.loadingTask.destroy();
  return (content.items as { str: string }[]).map((i) => i.str);
};

async function firstLine(file: string, text?: string) {
  const bytes = bytesOf(file);
  const info = readPageText(await PDFDocument.load(bytes), 0);
  const line = info.lines.find((l) => l.editable && (text === undefined || l.text === text))!;
  return { bytes, line, font: info.fonts.get(line.fontKey) };
}

describe("previewLine", () => {
  it("draws an edited line from the PDF's own embedded font (a Word export using Calibri)", async () => {
    const { line, font } = await firstLine("word-letter.pdf", "Quarterly Update");
    expect(font?.baseFont).toMatch(/Calibri/);
    const preview = previewLine(font, line.text);
    if (preview.font !== "original" || !preview.glyphs) throw new Error("expected glyphs from the original font");
    // One shape per visible character; the space has none.
    expect(preview.glyphs).toHaveLength(line.text.replace(/ /g, "").length);
    expect(preview.glyphs.every((g) => g.d.length > 0)).toBe(true);
    // Glyphs are spaced by the font's widths, as the saved line is drawn (the original's
    // kerning isn't kept when a line is retyped).
    const codes = codesOf(font!.encode(line.text)!, font!.bytesPerCode);
    const lastX = (codes.slice(0, -1).reduce((sum, c) => sum + font!.widthOf(c), 0) * preview.unitsPerEm) / 1000;
    expect(preview.glyphs.at(-1)!.x).toBeCloseTo(lastX, 3);
  });

  it("reports the characters the PDF's font doesn't include", async () => {
    const { line, font } = await firstLine("word-letter.pdf", "Quarterly Update");
    expect(previewLine(font, `${line.text} zx@~z`)).toEqual({ font: "similar", missing: ["z", "x", "@", "~"] });
  });

  it("keeps the original font for standard fonts that aren't embedded, without drawing glyphs", async () => {
    const { line, font } = await firstLine("sample-3-pages.pdf");
    expect(previewLine(font, `${line.text} Qzx@~`)).toEqual({ font: "original", glyphs: null, unitsPerEm: 1000 });
  });

  it("treats a cleared line as removed, like the save does", async () => {
    const { font } = await firstLine("word-letter.pdf", "Quarterly Update");
    expect(previewLine(font, "   ")).toEqual({ font: "original", glyphs: [], unitsPerEm: 1000 });
  });

  it("agrees with the saved file about which lines keep their font", async () => {
    const { bytes, line, font } = await firstLine("word-letter.pdf", "Quarterly Update");
    for (const text of ["Quarterly Update", "Quarterly zebra"]) {
      const expectSimilar = previewLine(font, text).font === "similar";
      const saved = await applyEdits({ name: "letter.pdf", bytes }, { texts: [], annotations: [], lineEdits: [{ page: 0, lineId: line.id, text, original: line.text }] }, loadFont, extract);
      expect(saved.fontFallbacks).toBe(expectSimilar ? 1 : 0);
    }
  });
});

describe("similarFontNotice", () => {
  it("names the missing characters", () => {
    expect(similarFontNotice({ font: "similar", missing: ["q"] })).toBe("This line will be saved in a similar font: the original font in this PDF doesn't include “q”.");
    expect(similarFontNotice({ font: "similar", missing: ["q", " ", "Z"] })).toMatch(/include “q”, a space and “Z”\.$/);
    expect(similarFontNotice({ font: "similar", missing: ["a", "b", "c", "d", "e", "f", "g"] })).toMatch(/“e” and 2 more\.$/);
  });

  it("says nothing for lines that keep their font", () => {
    expect(similarFontNotice({ font: "original", glyphs: [], unitsPerEm: 1000 })).toBeNull();
    expect(similarFontNotice(undefined)).toBeNull();
  });
});
