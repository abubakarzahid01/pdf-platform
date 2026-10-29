import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { invoicesToCsv, invoicesToXlsx, rowStatus } from "./export";
import type { ExtractedRow } from "./validate";

const row = (over: Omit<Partial<ExtractedRow>, "values"> & { values?: Partial<ExtractedRow["values"]> }): ExtractedRow => ({
  id: "x",
  fileName: "a.pdf",
  page: 1,
  scanned: false,
  lowConfidence: [],
  verified: false,
  ...over,
  values: { supplier: "Acme", invoiceNo: "A-1", date: "2026-09-01", subtotal: "£100.00", vat: "£20.00", total: "£120.00", ...over.values },
});

describe("invoice export", () => {
  it("states each row's status in plain words", () => {
    expect(rowStatus(row({}))).toBe("OK");
    expect(rowStatus(row({ values: { invoiceNo: "" } }))).toBe("Check: Invoice no. missing");
    expect(rowStatus(row({ values: { total: "£150.00" } }))).toBe("Check: totals don't add up");
    expect(rowStatus(row({ lowConfidence: ["date"] }))).toBe("Check: Date unsure");
    expect(rowStatus(row({ lowConfidence: ["date"], verified: true }))).toBe("Verified");
  });

  it("exports amounts as numbers in Excel and keeps the status column", () => {
    const xml = strFromU8(unzipSync(invoicesToXlsx([row({}), row({ fileName: "b.pdf", values: { total: "2,015.20 EUR", subtotal: "", vat: "" } })]))["xl/worksheets/sheet1.xml"]);
    expect(xml).toContain("<t xml:space=\"preserve\">Status</t>");
    expect(xml).toMatch(/<c r="H2" s="2"><v>120<\/v><\/c>/); // £120.00 as a £ number
    expect(xml).toMatch(/<c r="H3" s="4"><v>2015\.2<\/v><\/c>/); // 2,015.20 EUR as a € number
    expect(xml).toContain("Check: Subtotal missing, VAT missing");
  });

  it("exports CSV with the same columns", () => {
    const csv = new TextDecoder().decode(invoicesToCsv([row({})]));
    expect(csv.split("\r\n")[0]).toBe("File,Page,Supplier,Invoice no.,Date,Subtotal,VAT,Total,Status");
    expect(csv.split("\r\n")[1]).toBe("a.pdf,1,Acme,A-1,2026-09-01,£100.00,£20.00,£120.00,OK");
  });
});
