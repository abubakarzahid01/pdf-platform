import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { encodeImageData, readDocPages } from "../doc-pages";
import { buildBlocks, parseFont, pdfToWord, type DocPageReader } from "./pdf-to-word";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const fixture = (name: string) => ({ name, bytes: new Uint8Array(readFileSync(new URL(`../../../../test-files/${name}`, import.meta.url))) });

// The browser reader, minus OCR and image resizing (PNG at full size here).
const readPages: DocPageReader = async (bytes) => {
  const pdf = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0, fontExtraProperties: true }).promise;
  try {
    return await readDocPages(pdf, pdfjs, async (image) => {
      const png = encodeImageData(image);
      return png ? { data: png, format: "png" } : null;
    });
  } finally {
    await pdf.loadingTask.destroy();
  }
};

async function wordXml(name: string) {
  const out = await pdfToWord(fixture(name), readPages);
  const files = unzipSync(out.bytes);
  return { out, xml: strFromU8(files["word/document.xml"]), files };
}

describe("parseFont", () => {
  it("reads the family and style from PDF font names", () => {
    expect(parseFont("Calibri,Bold")).toEqual({ family: "Calibri", bold: true, italic: false });
    expect(parseFont("TimesNewRomanPS-BoldItalicMT")).toEqual({ family: "Times New Roman", bold: true, italic: true });
    expect(parseFont("ArialMT")).toEqual({ family: "Arial", bold: false, italic: false });
    expect(parseFont("Helvetica-Oblique")).toEqual({ family: "Arial", bold: false, italic: true });
    expect(parseFont("Calibri Light")).toEqual({ family: "Calibri Light", bold: false, italic: false });
    expect(parseFont("Symbol").family).toBeUndefined();
  });
});

// The image test encodes two full-size photos (no resizing here), which is slow when every test
// file runs at once.
describe("pdfToWord", { timeout: 30_000 }, () => {
  it("rebuilds a Word-made letter: heading, styled paragraphs, bullets and a table", async () => {
    const pages = await readPages(fixture("word-letter.pdf").bytes);
    const blocks = buildBlocks(pages);
    const paragraphs = blocks.filter((b) => b.kind === "paragraph");
    expect(paragraphs.map((p) => p.style)).toEqual(["h2", "body", "body", "bullet", "bullet"]);
    // The first paragraph keeps its bold and italic words, joined across the line break.
    const first = paragraphs[1].runs;
    expect(first.find((r) => r.bold)?.text.trim()).toBe("Northwind Supplies");
    expect(first.find((r) => r.italic)?.text.trim()).toBe("new prices");
    expect(first.map((r) => r.text).join("")).toContain("start on 1 March 2027.");
    expect(paragraphs[3].runs.map((r) => r.text).join("")).toBe("Free delivery over 50 euros");

    const { xml, out } = await wordXml("word-letter.pdf");
    expect(xml).toContain('w:pStyle w:val="Heading2"');
    expect(xml).toMatch(/<w:numPr>/); // real Word bullets
    expect(xml).toMatch(/<w:tbl>[\s\S]*Paper A4[\s\S]*4\.50 EUR[\s\S]*<\/w:tbl>/);
    expect(xml).toContain('w:ascii="Calibri"');
    expect(out).toMatchObject({ name: "word-letter.docx", pageCount: 1 });
    expect(out.note).toMatch(/1 table/);
  });

  it("keeps short label lines apart instead of running them together", async () => {
    const blocks = buildBlocks(await readPages(fixture("invoice-bluefield.pdf").bytes));
    const texts = blocks.flatMap((b) => (b.kind === "paragraph" ? [b.runs.map((r) => r.text).join("")] : []));
    expect(texts).toContain("Invoice number: BP-77310");
    expect(texts).toContain("Invoice date: 11/09/2026");
  });

  it("keeps fonts as they are in the PDF and puts tables in reading order", async () => {
    const { xml } = await wordXml("edge-invoice.pdf");
    expect(xml).toMatch(/Times New Roman[\s\S]*Invoice INV-2026-0042/);
    const order = ["Invoice INV-2026-0042", "Supplier:", "Paper A4", "Payment is due"].map((t) => xml.indexOf(t));
    expect(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1]))).toBe(true);
  });

  it("starts each PDF page on a new Word page", async () => {
    const { xml, out } = await wordXml("sample-3-pages.pdf");
    expect(xml.match(/<w:pageBreakBefore\/>/g)).toHaveLength(2);
    expect(out.pageCount).toBe(3);
  });

  it("includes images in the flow, sized as on the page", async () => {
    const { xml, files, out } = await wordXml("images-heavy.pdf");
    expect(Object.keys(files).filter((f) => f.startsWith("word/media/"))).toHaveLength(2);
    // 495 × 330 points on the page = 660 × 440 pixels in Word (EMUs: 9525 per pixel).
    expect(xml).toContain(`cx="${660 * 9525}" cy="${440 * 9525}"`);
    expect(out.note).toMatch(/2 images/);
  });

  it("leaves out the page-sized scan on a page read with OCR, so nothing appears twice", () => {
    const scan = { x: 0, y: 0, width: 612, height: 792, data: new Uint8Array([1]), format: "jpg" as const };
    const logo = { x: 40, y: 40, width: 80, height: 40, data: new Uint8Array([2]), format: "png" as const };
    const words = [{ str: "Invoice", x: 50, y: 120, width: 60, size: 14, hasEOL: true, confidence: 95 }];
    const scanned = buildBlocks([{ width: 612, height: 792, items: words, images: [scan, logo], ocr: true }]);
    expect(scanned.filter((b) => b.kind === "image").map((b) => b.kind === "image" && b.width)).toEqual([80]);
    // On a normal page, a full-page image is real content and stays.
    const normal = buildBlocks([{ width: 612, height: 792, items: words, images: [scan] }]);
    expect(normal.filter((b) => b.kind === "image")).toHaveLength(1);
  });

  it("explains when there's nothing to convert", async () => {
    await expect(pdfToWord(fixture("scanned-page.pdf"), async () => [{ width: 595, height: 842, items: [], images: [] }])).rejects.toThrow(/No text or images/);
  });
});
