import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readTextItems } from "../pdf/text-items";
import { extractInvoice, parseDate } from "./invoice";
import { cellStatus, totalsBalance } from "./validate";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

async function extract(file: string) {
  const bytes = new Uint8Array(readFileSync(new URL(`../../../test-files/${file}`, import.meta.url)));
  const pdf = await pdfjs.getDocument({ data: bytes, verbosity: 0 }).promise;
  try {
    return extractInvoice(await readTextItems(pdf, pdfjs.Util.transform), file, file);
  } finally {
    await pdf.loadingTask.destroy();
  }
}

describe("parseDate", () => {
  it("normalises clear dates and keeps ambiguous ones as written", () => {
    expect(parseDate("2026-09-29")).toEqual({ value: "2026-09-29", clear: true });
    expect(parseDate("18 September 2026")).toEqual({ value: "2026-09-18", clear: true });
    expect(parseDate("Sept 3, 2026")).toEqual({ value: "2026-09-03", clear: true });
    expect(parseDate("25/09/2026")).toEqual({ value: "25/09/2026", clear: true }); // 25 can't be a month
    expect(parseDate("11/09/2026")).toEqual({ value: "11/09/2026", clear: false }); // 11 Sept or 9 Nov?
    expect(parseDate("thirty days")).toBeNull();
  });
});

describe("extractInvoice", () => {
  it("reads a label-and-value invoice, flags the ambiguous date, and ignores the VAT registration number", async () => {
    const row = await extract("invoice-bluefield.pdf");
    expect(row.values).toEqual({
      supplier: "Bluefield Print Co.",
      invoiceNo: "BP-77310",
      date: "11/09/2026",
      subtotal: "£322.08",
      vat: "£64.42",
      total: "£386.50",
    });
    // No "Supplier:" label: the name comes from the heading, so it's marked for checking.
    expect(row.lowConfidence.sort()).toEqual(["date", "supplier"]);
    expect(totalsBalance(row)).toBe(true);
  });

  it("reads 'From:' suppliers, dates in words and euro amounts, and leaves a missing invoice number empty", async () => {
    const row = await extract("invoice-orchard.pdf");
    expect(row.values).toEqual({
      supplier: "Orchard Logistics Ltd",
      invoiceNo: "",
      date: "2026-09-18",
      subtotal: "1,679.33 EUR",
      vat: "335.87 EUR",
      total: "2,015.20 EUR",
    });
    expect(row.lowConfidence).toEqual([]);
    expect(cellStatus(row, "invoiceNo")).toBe("missing");
    expect(totalsBalance(row)).toBe(true);
  });

  it("finds values sharing a line and reports totals that don't add up", async () => {
    const row = await extract("invoice-kestrel.pdf");
    expect(row.values).toMatchObject({ invoiceNo: "KIT-0558", date: "2026-09-29", subtotal: "$450.00", vat: "$90.00", total: "$560.00" });
    expect(totalsBalance(row)).toBe(false);
    expect(cellStatus(row, "total")).toBe("mismatch");
  });

  it("takes an invoice number from a heading and marks absent totals as missing, without guessing", async () => {
    const row = await extract("edge-invoice.pdf");
    expect(row.values.invoiceNo).toBe("INV-2026-0042");
    expect(row.values.supplier.startsWith("Northwind Supplies Ltd")).toBe(true);
    // The invoice lists prices but no total, subtotal or date: these stay empty.
    expect([row.values.date, row.values.subtotal, row.values.vat, row.values.total]).toEqual(["", "", "", ""]);
    expect(cellStatus(row, "total")).toBe("missing");
  });

  it("marks a scanned page as such, with every field missing", async () => {
    const row = await extract("scanned-page.pdf");
    expect(row.scanned).toBe(true);
    expect(Object.values(row.values).every((v) => v === "")).toBe(true);
  });
});
