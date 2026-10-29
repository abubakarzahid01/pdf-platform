import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildCsv, buildXlsx, parseCell, safeSheetNames } from "../../files/spreadsheet";
import { readTextItems } from "../text-items";
import { pdfToSpreadsheet } from "./pdf-to-spreadsheet";
import type { TextItemReader } from "./pdf-to-text";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const readItems: TextItemReader = async (bytes) => {
  const pdf = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  try {
    return await readTextItems(pdf, pdfjs.Util.transform);
  } finally {
    await pdf.loadingTask.destroy();
  }
};

const fixture = (file: string) => ({ name: file, bytes: new Uint8Array(readFileSync(new URL(`../../../../test-files/${file}`, import.meta.url))) });

// A bank-statement-style page: two tables with right-aligned amounts, separated by a paragraph.
async function statementPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const row = (y: number, cells: string[], f = font) => {
    page.drawText(cells[0], { x: 60, y, size: 10, font: f });
    page.drawText(cells[1], { x: 180, y, size: 10, font: f });
    // Amounts are right-aligned at x=500, so their left edges differ.
    page.drawText(cells[2], { x: 500 - f.widthOfTextAtSize(cells[2], 10), y, size: 10, font: f });
  };
  page.drawText("Account statement - October", { x: 60, y: 780, size: 16, font: bold });
  row(740, ["Date", "Description", "Amount"], bold);
  row(722, ["2026-10-01", "Opening balance", "1,250.00"]);
  row(704, ["2026-10-04", "Office supplies", "-86.40"]);
  row(686, ["2026-10-09", "Client payment, invoice 77", "4,000.00"]);
  page.drawText("Card transactions are listed separately below for clarity.", { x: 60, y: 640, size: 10, font });
  row(600, ["Date", "Merchant", "Amount"], bold);
  row(582, ["2026-10-12", "Coffee House", "3.20"]);
  row(564, ["2026-10-15", "Train ticket", "27.50"]);
  return { name: "statement.pdf", bytes: await doc.save() };
}

// Reads a worksheet's cells back from the .xlsx zip: { A1: "Date", C2: "1250", ... }.
function cellsOf(xlsx: Uint8Array, sheet = 1) {
  const xml = strFromU8(unzipSync(xlsx)[`xl/worksheets/sheet${sheet}.xml`]);
  const cells: Record<string, string> = {};
  for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*)>(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)<\/c>/g)) {
    cells[m[1]] = (m[3] ?? m[4]).replace(/&amp;/g, "&");
    if (/s="[2-4]"/.test(m[2])) cells[`${m[1]}:style`] = "currency";
  }
  return cells;
}

describe("spreadsheet helpers", () => {
  it("turns clear numbers and currency amounts into numbers, leaving ambiguous text alone", () => {
    expect(parseCell("1,240.00")).toBe(1240);
    expect(parseCell("-86.40")).toBe(-86.4);
    expect(parseCell("£45.00")).toEqual({ value: 45, currency: "£" });
    expect(parseCell("1,679.33 EUR")).toEqual({ value: 1679.33, currency: "€" });
    expect(parseCell("4,50")).toBe("4,50"); // could be a European decimal: keep as text
    expect(parseCell("2026-10-01")).toBe("2026-10-01");
    expect(parseCell("007")).toBe("007"); // leading zeros matter (codes, IDs)
  });

  it("makes valid, unique sheet names", () => {
    expect(safeSheetNames(["Page 1/table: 1", "Page 1/table: 1", "x".repeat(40)])).toEqual(["Page 1 table  1", "Page 1 table  1 2", "x".repeat(31)]);
  });

  it("writes CSV with a byte-order mark and proper quoting", () => {
    const bytes = buildCsv([["Name", "Note"], ["Café", 'Say "hi", please']]);
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]); // TextDecoder would hide it
    expect(new TextDecoder().decode(bytes)).toBe('Name,Note\r\nCafé,"Say ""hi"", please"\r\n');
  });

  it("writes an .xlsx package with sheets, text, numbers and currency formats", () => {
    const xlsx = buildXlsx([{ name: "Data", headerRow: true, rows: [["Item", "Price"], ["Tea & milk", { value: 3.5, currency: "£" }], ["Count", 12]] }]);
    const files = unzipSync(xlsx);
    expect(Object.keys(files)).toEqual(expect.arrayContaining(["[Content_Types].xml", "xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml"]));
    expect(strFromU8(files["xl/workbook.xml"])).toContain('name="Data"');
    expect(cellsOf(xlsx)).toMatchObject({ A1: "Item", A2: "Tea & milk", B2: "3.5", "B2:style": "currency", B3: "12" });
  });
});

describe("pdfToSpreadsheet", () => {
  it("finds the table in a browser-made invoice, with currency as numbers", async () => {
    const [out] = await pdfToSpreadsheet(fixture("edge-invoice.pdf"), "xlsx", "per-table", readItems);
    expect(out.name).toBe("edge-invoice.xlsx");
    expect(out.table).toEqual([
      ["Item", "Qty", "Price"],
      ["Paper A4", "10", "£45.00"],
      ["Toner", "2", "£120.50"],
    ]);
    expect(cellsOf(out.bytes)).toMatchObject({ A1: "Item", B2: "10", C2: "45", "C2:style": "currency", C3: "120.5" });
    expect(out.note).toMatch(/Found 1 table/);
  });

  it("finds the table in a Word document and doesn't mistake bullet lists for tables", async () => {
    const [out] = await pdfToSpreadsheet(fixture("word-letter.pdf"), "xlsx", "per-table", readItems);
    expect(out.table).toEqual([
      ["Product", "Price"],
      ["Paper A4", "4.50 EUR"],
      ["Toner", "120.00 EUR"],
    ]);
    expect(out.note).toMatch(/Found 1 table/);
  });

  it("separates two tables and lines up right-aligned amounts in one column", async () => {
    const [out] = await pdfToSpreadsheet(await statementPdf(), "xlsx", "per-table", readItems);
    expect(out.note).toMatch(/Found 2 tables/);
    expect(cellsOf(out.bytes, 1)).toMatchObject({ A1: "Date", C1: "Amount", B4: "Client payment, invoice 77", C2: "1250", C3: "-86.4", C4: "4000" });
    expect(cellsOf(out.bytes, 2)).toMatchObject({ B1: "Merchant", B2: "Coffee House", C3: "27.5" });
    const workbook = strFromU8(unzipSync(out.bytes)["xl/workbook.xml"]);
    expect(workbook).toContain('name="Page 1 table 1"');
    expect(workbook).toContain('name="Page 1 table 2"');
  });

  it("stacks tables in one sheet, or makes one CSV per table, as chosen", async () => {
    const [single] = await pdfToSpreadsheet(await statementPdf(), "xlsx", "single", readItems);
    const cells = cellsOf(single.bytes);
    expect(cells.A1).toBe("Date");
    expect(cells.A5).toBeUndefined(); // the blank row between the tables
    expect(cells.B6).toBe("Merchant");

    const csvs = await pdfToSpreadsheet(await statementPdf(), "csv", "per-table", readItems);
    expect(csvs.map((c) => c.name)).toEqual(["statement-page-1-table-1.csv", "statement-page-1-table-2.csv"]);
    expect(new TextDecoder().decode(csvs[0].bytes)).toContain('2026-10-09,"Client payment, invoice 77","4,000.00"');
  });

  it("keeps all text in one column when there are no tables, and says so", async () => {
    const [out] = await pdfToSpreadsheet(fixture("sample-3-pages.pdf"), "csv", "per-table", readItems);
    expect(out.note).toMatch(/No tables were detected/);
    expect(new TextDecoder().decode(out.bytes)).toContain("Sample report");
  });

  it("explains a scanned page", async () => {
    const [out] = await pdfToSpreadsheet(fixture("scanned-page.pdf"), "xlsx", "per-table", readItems);
    expect(out.note).toMatch(/No text was found/);
  });
});
