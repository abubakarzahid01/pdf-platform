import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { PDFDocument, PDFName, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { applyEdits, type FontLoader } from "../operations/edits";
import type { TextExtractor } from "./apply";
import { readPageText } from "./lines";
import { parseToUnicode } from "./fonts";
import { tokenizeContent } from "./tokenizer";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

function bytesOf(name: string) {
  return new Uint8Array(readFileSync(new URL(`../../../../test-files/${name}`, import.meta.url)));
}

async function pdfjsItems(bytes: Uint8Array, pageNumber: number) {
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const content = await (await doc.getPage(pageNumber)).getTextContent();
  const items = (content.items as { str: string; transform: number[] }[])
    .filter((i) => i.str.trim())
    .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] }));
  await doc.loadingTask.destroy();
  return items;
}

const require = createRequire(import.meta.url);
const loadFont: FontLoader = async (style) =>
  new Uint8Array(readFileSync(require.resolve(`@expo-google-fonts/inter/${{ regular: "400Regular/Inter_400Regular.ttf", bold: "700Bold/Inter_700Bold.ttf", italic: "400Regular_Italic/Inter_400Regular_Italic.ttf", boldItalic: "700Bold_Italic/Inter_700Bold_Italic.ttf" }[style]}`)));
const extract: TextExtractor = async (bytes, pageIndex) => (await pdfjsItems(bytes, pageIndex + 1)).map((i) => i.str);

async function editLines(file: string | Uint8Array, changes: { match: string; text: string; page?: number }[]) {
  const bytes = typeof file === "string" ? bytesOf(file) : file;
  const doc = await PDFDocument.load(bytes);
  const lineEdits = changes.map((c) => {
    const page = c.page ?? 0;
    const line = readPageText(doc, page).lines.find((l) => l.text === c.match);
    if (!line) throw new Error(`line "${c.match}" not found`);
    return { page, lineId: line.id, text: c.text, original: line.text };
  });
  return applyEdits({ name: "in.pdf", bytes }, { texts: [], annotations: [], lineEdits }, loadFont, extract);
}

describe("editing existing text", () => {
  it("replaces a line in its original subset font, in the same place, leaving everything else alone", async () => {
    const before = await pdfjsItems(bytesOf("edge-invoice.pdf"), 1);
    const result = await editLines("edge-invoice.pdf", [{ match: "Invoice INV-2026-0042", text: "Invoice INV-2026-0024" }]);
    expect(result.fontFallbacks).toBe(0);
    const after = await pdfjsItems(result.bytes, 1);
    const original = before.find((i) => i.str === "Invoice INV-2026-0042")!;
    const edited = after.find((i) => i.str === "Invoice INV-2026-0024")!;
    expect(edited).toBeTruthy();
    expect([edited.x, edited.y].map(Math.round)).toEqual([original.x, original.y].map(Math.round));
    expect(after.some((i) => i.str.includes("0042"))).toBe(false);
    // Every other line is unchanged, in content and position.
    const rest = (items: typeof before) => items.filter((i) => !i.str.startsWith("Invoice")).map((i) => `${i.str}@${Math.round(i.x)},${Math.round(i.y)}`);
    expect(rest(after)).toEqual(rest(before));
  });

  it("uses a similar standard font when the original font lacks some letters", async () => {
    const result = await editLines("edge-invoice.pdf", [{ match: "Invoice INV-2026-0042", text: "Receipt RC-77" }]);
    expect(result.fontFallbacks).toBe(1);
    const strings = (await pdfjsItems(result.bytes, 1)).map((i) => i.str);
    expect(strings).toContain("Receipt RC-77");
    expect(strings.join(" ")).not.toContain("INV-2026");
  });

  it("removes a line that is cleared", async () => {
    const result = await editLines("edge-invoice.pdf", [{ match: "£120.50", text: "" }]);
    const strings = (await pdfjsItems(result.bytes, 1)).map((i) => i.str);
    expect(strings).not.toContain("£120.50");
    expect(strings).toContain("£45.00");
  });

  it("edits standard-font text, falling back to Inter for characters outside the standard set", async () => {
    const result = await editLines("sample-3-pages.pdf", [
      { match: "Page 1 of 3", text: "Page 1 of three" },
      { match: "Sample report", text: "Final report Ω" },
    ]);
    const strings = (await pdfjsItems(result.bytes, 1)).map((i) => i.str);
    expect(strings).toEqual(expect.arrayContaining(["Page 1 of three", "Final report Ω"]));
    expect(result.fontFallbacks).toBe(1);
    expect(result.substitutions).toBe(1); // Helvetica can't show Ω, so Inter was used
  });

  it("keeps later text in the same block exactly where it was", async () => {
    // One text block: "Bold label" then " plain text" in another font, with no repositioning between.
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 200]);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const plain = await doc.embedFont(StandardFonts.Helvetica);
    page.node.setFontDictionary(PDFName.of("FB"), bold.ref);
    page.node.setFontDictionary(PDFName.of("FP"), plain.ref);
    page.node.set(PDFName.of("Contents"), doc.context.register(doc.context.stream("BT /FB 14 Tf 40 100 Td (Bold label) Tj /FP 14 Tf ( plain text) Tj ET")));
    const bytes = await doc.save();
    const before = (await pdfjsItems(bytes, 1)).find((i) => i.str.includes("plain"))!;
    const result = await editLines(bytes, [{ match: "Bold label", text: "Hi" }]);
    const after = await pdfjsItems(result.bytes, 1);
    const moved = after.find((i) => i.str.includes("plain"))!;
    expect(moved.x).toBeCloseTo(before.x, 1);
    expect(after.map((i) => i.str)).toContain("Hi");
  });

  it("refuses to produce a file when the check finds the old text still there", async () => {
    const bytes = bytesOf("edge-invoice.pdf");
    const doc = await PDFDocument.load(bytes);
    const line = readPageText(doc, 0).lines.find((l) => l.text === "Toner")!;
    const lyingExtractor: TextExtractor = async () => ["Toner", "Ink"];
    await expect(
      applyEdits({ name: "x.pdf", bytes }, { texts: [], annotations: [], lineEdits: [{ page: 0, lineId: line.id, text: "Ink", original: "Toner" }] }, loadFont, lyingExtractor),
    ).rejects.toThrow("still on page 1");
  });
});

describe("tokenizeContent", () => {
  it("reads operators, operands and string escapes, and skips inline images", () => {
    const content = "BT /F1 12 Tf 1 0 0 1 72 700 Tm (Hello \\(world\\) \\101) Tj [<0041> -250 (B)] TJ ET BI /W 2 ID \x00\xff\x10 EI Q";
    const ops = tokenizeContent(content);
    expect(ops.map((o) => o.op)).toEqual(["BT", "Tf", "Tm", "Tj", "TJ", "ET", "BI", "Q"]);
    const tj = ops[3].operands[0];
    expect(tj.kind === "string" && new TextDecoder().decode(tj.bytes)).toBe("Hello (world) A");
    expect(content.slice(ops[3].start, ops[3].end)).toBe("(Hello \\(world\\) \\101) Tj");
  });

  it("reads numbers inside TJ arrays, as Microsoft Word writes them", () => {
    const [tj] = tokenizeContent("[(Q)-2(uart)-3.5(er)] TJ");
    expect(tj.op).toBe("TJ");
    const arr = tj.operands[0];
    expect(arr.kind === "array" && arr.items.map((i) => (i.kind === "number" ? i.value : i.kind === "string" ? new TextDecoder().decode(i.bytes) : "?"))).toEqual([
      "Q",
      -2,
      "uart",
      -3.5,
      "er",
    ]);
  });
});

describe("parseToUnicode", () => {
  it("reads single mappings and ranges", () => {
    const map = parseToUnicode("beginbfchar <0003> <0020> endbfchar beginbfrange <0024> <0026> <0041> <0030> <0031> [<00E9> <00A3>] endbfrange");
    expect([map.get(3), map.get(0x24), map.get(0x26), map.get(0x30), map.get(0x31)]).toEqual([" ", "A", "C", "é", "£"]);
  });
});

describe("readPageText", () => {
  for (const file of ["sample-3-pages.pdf", "edge-invoice.pdf", "word-letter.pdf"]) {
    it(`finds every line PDF.js sees, on the same baseline (${file})`, async () => {
      const bytes = bytesOf(file);
      const doc = await PDFDocument.load(bytes);
      const { lines } = readPageText(doc, 0);
      for (const item of await pdfjsItems(bytes, 1)) {
        const match = lines.find((l) => l.text.includes(item.str.trim()) && Math.abs(l.y - item.y) < 1);
        expect(match, `"${item.str}" at y=${item.y.toFixed(1)}`).toBeTruthy();
      }
    });
  }

  it("reads the Edge invoice's lines with their fonts and positions", async () => {
    const doc = await PDFDocument.load(bytesOf("edge-invoice.pdf"));
    const { lines } = readPageText(doc, 0);
    const title = lines.find((l) => l.text === "Invoice INV-2026-0042")!;
    expect(title).toMatchObject({ editable: true, bold: true });
    expect(title.baseFont).toMatch(/TimesNewRoman/);
    expect(title.size).toBeCloseTo(21, 0); // 28 CSS px = 21 pt
    expect(lines.find((l) => l.text.includes("Café Street 12"))?.editable).toBe(true);
    expect(lines.find((l) => l.text === "£120.50")).toBeTruthy();
  });

  it("handles Word's PDFs: kerned lines, leading spaces and bullet symbols", async () => {
    const doc = await PDFDocument.load(bytesOf("word-letter.pdf"));
    const { lines } = readPageText(doc, 0);
    expect(lines.find((l) => l.text === "Quarterly Update")?.editable).toBe(true);
    // " this year. Our" follows the bold segment: the space is kept apart from the visible text.
    const after = lines.find((l) => l.text === "this year. Our")!;
    expect(after.leading).toBe(" ");
    expect(after.textX).toBeGreaterThan(after.x);
    // Bullets drawn with the Symbol font aren't offered for editing.
    expect(lines.filter((l) => /[-]/.test(l.text)).every((l) => !l.editable)).toBe(true);
  });

  it("keeps the leading space when a line after a font change is edited", async () => {
    const before = await pdfjsItems(bytesOf("word-letter.pdf"), 1);
    const result = await editLines("word-letter.pdf", [{ match: "this year. Our", text: "this season. Our" }]);
    const after = await pdfjsItems(result.bytes, 1);
    const oldItem = before.find((i) => i.str.includes("this year. Our"))!;
    const newItem = after.find((i) => i.str.includes("this season. Our"))!;
    expect(newItem.x).toBeCloseTo(oldItem.x, 0);
    expect(newItem.y).toBeCloseTo(oldItem.y, 0);
  });
});
