import { readFileSync } from "node:fs";
import { PDFDocument, PDFName, StandardFonts } from "pdf-lib";
import { nodeFontLoader } from "../fonts-node";
import { describe, expect, it } from "vitest";
import { applyEdits } from "../operations/edits";
import type { TextExtractor } from "./apply";
import { BLOCKED, noEditableTextReason, readingOrder, readPageText } from "./lines";
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

const loadFont = nodeFontLoader;
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

describe("text inside forms and unusual fonts", () => {
  // Each page of sample-3-pages.pdf drawn through a form XObject, as pdf-lib's embedPage and
  // many PDF tools write pages. `pages` lists which source page each new page draws.
  async function wrapped(pages: number[], drawTwice = false) {
    const doc = await PDFDocument.create();
    const embedded = await doc.embedPdf(bytesOf("sample-3-pages.pdf"), [0, 1]);
    for (const p of pages) {
      const page = doc.addPage([embedded[p].width, embedded[p].height]);
      page.drawPage(embedded[p]);
      if (drawTwice) page.drawPage(embedded[p], { x: 0, y: -400 });
    }
    return doc.save();
  }

  it("finds and edits text drawn by a form, in the same place and font", async () => {
    const bytes = await wrapped([0]);
    const { lines } = readPageText(await PDFDocument.load(bytes), 0);
    expect(lines.map((l) => l.text)).toContain("Sample report");
    expect(lines.every((l) => l.editable)).toBe(true);

    const before = await pdfjsItems(bytes, 1);
    const result = await editLines(bytes, [{ match: "Sample report", text: "Annual report" }]);
    expect(result.fontFallbacks).toBe(0);
    const after = await pdfjsItems(result.bytes, 1);
    const old = before.find((i) => i.str === "Sample report")!;
    const edited = after.find((i) => i.str === "Annual report")!;
    expect([edited.x, edited.y].map(Math.round)).toEqual([old.x, old.y].map(Math.round));
    expect(after.map((i) => i.str)).not.toContain("Sample report");
    // The edited file opens in the editor again with the change editable.
    const reopened = readPageText(await PDFDocument.load(result.bytes), 0).lines.find((l) => l.text === "Annual report");
    expect(reopened?.editable).toBe(true);
  });

  it("changes only the edited page when pages share a form", async () => {
    const bytes = await wrapped([0, 0]);
    const result = await editLines(bytes, [{ match: "Sample report", text: "Annual report" }]);
    expect((await pdfjsItems(result.bytes, 1)).map((i) => i.str)).toContain("Annual report");
    expect((await pdfjsItems(result.bytes, 2)).map((i) => i.str)).toContain("Sample report");
  });

  it("doesn't offer text from a form drawn twice on a page, and says why", async () => {
    const info = readPageText(await PDFDocument.load(await wrapped([0], true)), 0);
    expect(info.lines.length).toBeGreaterThan(0);
    expect(info.lines.some((l) => l.editable)).toBe(false);
    expect(noEditableTextReason(info)).toBe(BLOCKED.repeated);
  });

  it("reads fonts whose codes are renamed with /Differences", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 200]);
    const font = doc.context.obj({
      Type: "Font",
      Subtype: "Type1",
      BaseFont: "Helvetica",
      Encoding: { Type: "Encoding", BaseEncoding: "WinAnsiEncoding", Differences: [1, "H", "e", "l", "o", "space", "W", "r", "d", "quoteright", "s", "uni00E9"] },
    });
    page.node.set(PDFName.of("Resources"), doc.context.obj({ Font: { F1: doc.context.register(font) } }));
    page.node.set(PDFName.of("Contents"), doc.context.register(doc.context.stream("BT /F1 20 Tf 40 100 Td <0102030304050604070308090A> Tj ET")));
    const bytes = await doc.save();
    const line = readPageText(await PDFDocument.load(bytes), 0).lines[0];
    expect(line).toMatchObject({ text: "Hello World’s", editable: true });

    const result = await editLines(bytes, [{ match: "Hello World’s", text: "Hello Wordle" }]);
    expect(result.fontFallbacks).toBe(0);
    expect((await pdfjsItems(result.bytes, 1)).map((i) => i.str)).toContain("Hello Wordle");
  });

  it("explains why a page's text can't be edited", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 200]);
    // A font with no ToUnicode and no standard encoding: its codes mean nothing on their own.
    const font = doc.context.obj({ Type: "Font", Subtype: "Type0", BaseFont: "Mystery", Encoding: "Identity-H", DescendantFonts: [doc.context.obj({ Type: "Font", Subtype: "CIDFontType2", BaseFont: "Mystery" })] });
    page.node.set(PDFName.of("Resources"), doc.context.obj({ Font: { F1: doc.context.register(font) } }));
    page.node.set(PDFName.of("Contents"), doc.context.register(doc.context.stream("BT /F1 20 Tf 40 100 Td <00410042> Tj ET")));
    const info = readPageText(await PDFDocument.load(await doc.save()), 0);
    expect(noEditableTextReason(info)).toBe(BLOCKED.unreadableFont);
  });
});

describe("right-to-left lines", () => {
  it("puts display-order text back in reading order, keeping numbers and Latin words", () => {
    // As stored in a PDF: the letters of "سلام 123 دنیا" from left to right on the page.
    expect(readingOrder([..."سلام 123 دنیا"].reverse().join("").replace("321", "123"))).toBe("سلام 123 دنیا");
    expect(readingOrder("PDF 2026 ملاعلا")).toBe("العالم 2026 PDF");
  });

  it("reads an Arabic line in reading order and edits it, keeping its right edge", async () => {
    const blank = await PDFDocument.create();
    blank.addPage([400, 200]);
    const made = await applyEdits(
      { name: "ar.pdf", bytes: await blank.save() },
      { texts: [{ page: 0, lines: [{ text: "مرحبا بالعالم", x: 40, y: 100 }], family: "inter", bold: false, italic: false, size: 20, color: [0, 0, 0], rotate: 0 }], annotations: [] },
      loadFont,
    );
    const line = readPageText(await PDFDocument.load(made.bytes), 0).lines[0];
    expect(line).toMatchObject({ text: "مرحبا بالعالم", rightToLeft: true, editable: true });

    const result = await editLines(made.bytes, [{ match: "مرحبا بالعالم", text: "شكرا لك" }]);
    expect(result.fontFallbacks).toBe(1);
    const items = await pdfjsItems(result.bytes, 1);
    expect(items.map((i) => i.str).join(" ")).toContain("شكرا لك");
    expect(items.map((i) => i.str).join(" ")).not.toContain("مرحبا");
    const edited = readPageText(await PDFDocument.load(result.bytes), 0).lines.find((l) => l.text === "شكرا لك")!;
    expect(edited.textX + edited.width).toBeCloseTo(line.textX + line.width, 0);
  });
});
