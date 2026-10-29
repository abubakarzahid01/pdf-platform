import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { applyEdits, type FontLoader, type PdfText } from "./edits";
import type { InputPdf } from "./types";

// PDF.js's Node build reads text back out of outputs, to prove the text is real and upright.
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const require = createRequire(import.meta.url);
const interFiles = {
  regular: "400Regular/Inter_400Regular.ttf",
  bold: "700Bold/Inter_700Bold.ttf",
  italic: "400Regular_Italic/Inter_400Regular_Italic.ttf",
  boldItalic: "700Bold_Italic/Inter_700Bold_Italic.ttf",
};
const loadFont: FontLoader = async (style) => new Uint8Array(readFileSync(require.resolve(`@expo-google-fonts/inter/${interFiles[style]}`)));

function fixture(name: string): InputPdf {
  return { name, bytes: new Uint8Array(readFileSync(new URL(`../../../../test-files/${name}`, import.meta.url))) };
}

async function pageText(bytes: Uint8Array, pageNumber: number) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false }).promise;
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = content.items.filter((i) => "str" in i && i.str.trim()) as { str: string; transform: number[]; fontName: string }[];
  const result = items.map((i) => {
    // Combine with the viewport to see the text as displayed: [a, b] = direction of writing.
    const [a, b] = pdfjs.Util.transform(viewport.transform, i.transform);
    return { str: i.str, upright: a > 0 && Math.abs(b) < 0.01, font: content.styles[i.fontName]?.fontFamily };
  });
  await doc.loadingTask.destroy();
  return result;
}

const base: Omit<PdfText, "lines" | "page"> = { family: "helvetica", bold: false, italic: false, size: 14, color: [0.1, 0.1, 0.1], rotate: 0 };

describe("applyEdits", () => {
  it("writes real, extractable text with a standard font", async () => {
    const result = await applyEdits(
      fixture("sample-3-pages.pdf"),
      { texts: [{ ...base, page: 0, lines: [{ text: "Approved by finance", x: 60, y: 300 }, { text: "Second line", x: 60, y: 282 }] }], annotations: [] },
      loadFont,
    );
    expect(result.substitutions).toBe(0);
    expect(result.name).toBe("sample-3-pages-edited.pdf");
    const strings = (await pageText(result.bytes, 1)).map((t) => t.str);
    expect(strings).toContain("Approved by finance");
    expect(strings).toContain("Second line");
  });

  it("switches to Inter for characters standard fonts can't show, and reports it", async () => {
    const text = "Zażółć gęślą jaźń — Ωμέγα";
    const result = await applyEdits(
      fixture("sample-3-pages.pdf"),
      { texts: [{ ...base, page: 0, lines: [{ text, x: 60, y: 300 }] }], annotations: [] },
      loadFont,
    );
    expect(result.substitutions).toBe(1);
    expect((await pageText(result.bytes, 1)).map((t) => t.str).join("")).toContain(text);
  });

  it("embeds Inter in all four styles, each font only once", async () => {
    const texts = (["regular", "bold", "italic", "boldItalic"] as const).map((s, i) => ({
      ...base,
      family: "inter" as const,
      bold: s.startsWith("bold"),
      italic: s.toLowerCase().includes("italic"),
      page: 0,
      lines: [{ text: `Inter ${s}`, x: 60, y: 400 - i * 20 }],
    }));
    const input = fixture("sample-3-pages.pdf");
    const result = await applyEdits(input, { texts, annotations: [] }, loadFont);
    expect((await pageText(result.bytes, 1)).map((t) => t.str)).toEqual(expect.arrayContaining(texts.map((t) => t.lines[0].text)));
    // Full fonts are embedded (subsetting damaged glyphs). Four styles are about 1.3 MB of
    // font data, stored compressed; each must be embedded once, not once per text box.
    expect(result.bytes.length - input.bytes.length).toBeLessThan(1.4 * 1024 * 1024);
  });

  it("keeps text upright on a rotated page when rotated to match", async () => {
    // mixed-sizes page 3 is a Letter page with /Rotate 90.
    const result = await applyEdits(
      fixture("mixed-sizes.pdf"),
      { texts: [{ ...base, page: 2, rotate: 90, lines: [{ text: "Upright note", x: 300, y: 300 }] }], annotations: [] },
      loadFont,
    );
    const note = (await pageText(result.bytes, 3)).find((t) => t.str === "Upright note");
    expect(note?.upright).toBe(true);

    // Control: without the counter-rotation the same text would appear sideways.
    const sideways = await applyEdits(
      fixture("mixed-sizes.pdf"),
      { texts: [{ ...base, page: 2, rotate: 0, lines: [{ text: "Sideways note", x: 300, y: 300 }] }], annotations: [] },
      loadFont,
    );
    expect((await pageText(sideways.bytes, 3)).find((t) => t.str === "Sideways note")?.upright).toBe(false);
  });

  it("adds annotations in the same pass and skips empty text", async () => {
    const result = await applyEdits(
      fixture("sample-3-pages.pdf"),
      {
        texts: [{ ...base, page: 1, lines: [{ text: "", x: 10, y: 10 }] }],
        annotations: [{ type: "comment", page: 1, at: [100, 100], text: "Looks good" }],
      },
      loadFont,
    );
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(result.bytes);
    expect(doc.getPage(1).node.Annots()?.size()).toBe(1);
  });
});
