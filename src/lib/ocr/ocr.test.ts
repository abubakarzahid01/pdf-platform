import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createWorker, OEM, type Worker } from "tesseract.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { extractInvoice } from "../extraction/invoice";
import { totalsBalance } from "../extraction/validate";
import { pdfToSpreadsheet } from "../pdf/operations/pdf-to-spreadsheet";
import { pdfToText, type TextItemReader } from "../pdf/operations/pdf-to-text";
import { readTextItems, type PageItems } from "../pdf/text-items";
import { OCR_MAX_PAGES, ocrItems, withOcr, type OcrBlock, type Recognise } from "./ocr";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const testFile = (name: string) => new Uint8Array(readFileSync(new URL(`../../../test-files/${name}`, import.meta.url)));

const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });
const block = (lines: OcrBlock["paragraphs"][number]["lines"]): OcrBlock => ({ paragraphs: [{ lines }] });

describe("ocrItems", () => {
  it("converts word boxes in image pixels into text pieces on the page", () => {
    const items = ocrItems(
      [
        block([
          {
            bbox: box(100, 80, 400, 120),
            baseline: box(100, 110, 400, 116), // slightly tilted, as in a scan
            rowAttributes: { rowHeight: 30 },
            words: [
              { text: "Total", confidence: 96.4, bbox: box(100, 82, 180, 112) },
              { text: " ", confidence: 0, bbox: box(180, 82, 200, 112) },
              { text: "£386.50", confidence: 61.2, bbox: box(300, 82, 400, 118) },
            ],
          },
        ]),
      ],
      2,
    );
    expect(items).toEqual([
      { str: "Total", x: 50, y: 55, width: 40, size: 15, hasEOL: false, confidence: 96 },
      { str: "£386.50", x: 150, y: 57, width: 50, size: 15, hasEOL: true, confidence: 61 },
    ]);
  });
});

describe("withOcr", () => {
  const empty = (): PageItems => ({ width: 612, height: 792, items: [] });
  const withText = (): PageItems => ({ width: 612, height: 792, items: [{ str: "Real text", x: 10, y: 10, width: 40, size: 10, hasEOL: true }] });
  const fakeRecognise: Recognise = async () => [
    block([{ bbox: box(0, 0, 50, 10), baseline: box(0, 10, 50, 10), words: [{ text: "Scanned", confidence: 90, bbox: box(0, 0, 50, 10) }] }]),
  ];

  it("reads only pages without text and leaves real text untouched", async () => {
    const seen: number[] = [];
    const pages = [withText(), empty(), withText()];
    const out = await withOcr(pages, async (i) => (seen.push(i), { image: new Uint8Array(), scale: 1 }), fakeRecognise);
    expect(seen).toEqual([1]);
    expect(out[0]).toBe(pages[0]);
    expect(out[1].ocr).toBe(true);
    expect(out[1].items.map((i) => i.str)).toEqual(["Scanned"]);
  });

  it(`stops after ${OCR_MAX_PAGES} scanned pages and marks the rest as skipped`, async () => {
    const pages = Array.from({ length: OCR_MAX_PAGES + 2 }, empty);
    const progress: number[] = [];
    const out = await withOcr(pages, async () => ({ image: new Uint8Array(), scale: 1 }), fakeRecognise, (done) => progress.push(done));
    expect(out.filter((p) => p.ocr === true)).toHaveLength(OCR_MAX_PAGES);
    expect(out.slice(OCR_MAX_PAGES).map((p) => p.ocr)).toEqual([false, false]);
    expect(progress.at(-1)).toBe(OCR_MAX_PAGES);
  });
});

describe("OCR confidence in invoice extraction", () => {
  it("marks a value unsure when OCR wasn't confident about one of its words", () => {
    const word = (str: string, x: number, y: number, confidence: number) => ({ str, x, y, width: str.length * 5, size: 10, hasEOL: false, confidence });
    const page: PageItems = {
      width: 612,
      height: 792,
      ocr: true,
      items: [word("Invoice", 50, 100, 95), word("number:", 90, 100, 95), word("BP-77310", 140, 100, 93), word("Total", 50, 130, 92), word("£386.50", 300, 130, 61)],
    };
    const row = extractInvoice([page], "scan.pdf", "1");
    expect(row.ocr).toBe(true);
    expect(row.values.invoiceNo).toBe("BP-77310");
    expect(row.values.total).toBe("£386.50");
    expect(row.lowConfidence).toContain("total");
    expect(row.lowConfidence).not.toContain("invoiceNo");
  });
});

// Real text recognition with Tesseract, using the English data installed in node_modules.
describe("OCR on a scanned invoice", () => {
  let worker: Worker;
  const recognise: Recognise = async (image) => (await worker.recognize(Buffer.from(image as Uint8Array), {}, { blocks: true })).data.blocks as OcrBlock[] | null;
  // invoice-scanned.pdf holds invoice-scanned.png (1700 × 2200 pixels) over a 612 × 792 page.
  const scanImage = testFile("invoice-scanned.png");
  const readWithOcr: TextItemReader = async (bytes) => {
    const pdf = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
    try {
      const pages = await readTextItems(pdf, pdfjs.Util.transform);
      return await withOcr(pages, async (i) => ({ image: scanImage, scale: 1700 / pages[i].width }), recognise);
    } finally {
      await pdf.loadingTask.destroy();
    }
  };

  beforeAll(async () => {
    const langPath = fileURLToPath(new URL("../../../node_modules/@tesseract.js-data/eng/4.0.0_best_int", import.meta.url));
    worker = await createWorker("eng", OEM.LSTM_ONLY, { langPath, cacheMethod: "none", gzip: true });
  }, 60_000);
  afterAll(() => worker?.terminate());

  it("reads every invoice field from the image, and the totals add up", async () => {
    const pages = await readWithOcr(testFile("invoice-scanned.pdf"));
    expect(pages[0].ocr).toBe(true);
    const row = extractInvoice(pages, "invoice-scanned.pdf", "1");
    expect(row.scanned).toBe(false);
    expect(row.values).toEqual({
      supplier: "Bluefield Print Co.",
      invoiceNo: "BP-77310",
      date: "11/09/2026",
      subtotal: "£322.08",
      vat: "£64.42",
      total: "£386.50",
    });
    expect(totalsBalance(row)).toBe(true);
    // Still marked for checking: the date is ambiguous, and the supplier had no label.
    expect(row.lowConfidence).toEqual(expect.arrayContaining(["date", "supplier"]));
  }, 60_000);

  it("turns a scanned PDF into text and says it was read with OCR", async () => {
    const out = await pdfToText({ name: "invoice-scanned.pdf", bytes: testFile("invoice-scanned.pdf") }, "continuous", readWithOcr);
    const text = new TextDecoder().decode(out.bytes);
    expect(text).toContain("Invoice number: BP-77310");
    expect(text).toMatch(/Business cards\s{2,}500\s{2,}£180\.00/);
    expect(out.note).toMatch(/1 page was scanned and read with text recognition \(OCR\)/);
  }, 60_000);

  it("finds the item table in a scanned PDF", async () => {
    const [out] = await pdfToSpreadsheet({ name: "invoice-scanned.pdf", bytes: testFile("invoice-scanned.pdf") }, "csv", "per-table", readWithOcr);
    expect(out.table?.[0]).toEqual(["Description", "Qty", "Amount"]);
    expect(out.table).toContainEqual(["Business cards", "500", "£180.00"]);
  }, 60_000);
});
