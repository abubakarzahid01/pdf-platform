import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkUpload, convertToPdf, findSoffice, pdfFilter, sofficeArgs } from "./convert.mjs";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const file = (name) => new Uint8Array(readFileSync(new URL(`../test-files/${name}`, import.meta.url)));

describe("checkUpload", () => {
  it("accepts real Office documents by their contents", () => {
    expect(checkUpload(file("word-report.docx"), "report.docx", "word")).toBeNull();
    expect(checkUpload(file("excel-budget.xlsx"), "budget.xlsx", "excel")).toBeNull();
    expect(checkUpload(file("slides-deck.pptx"), "deck.pptx", "powerpoint")).toBeNull();
    expect(checkUpload(new TextEncoder().encode("Plain notes\nSecond line"), "notes.txt", "word")).toBeNull();
  });

  it("refuses wrong types, renamed files and empty files", () => {
    expect(checkUpload(file("word-report.docx"), "report.docx", "excel")).toMatch(/Use an XLS, XLSX or ODS file/);
    expect(checkUpload(file("sample-3-pages.pdf"), "fake.docx", "word")).toMatch(/don't match/);
    // A ZIP that isn't an Office document, renamed to .docx.
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new TextEncoder().encode("photos/holiday.jpg")]);
    expect(checkUpload(zip, "fake.docx", "word")).toMatch(/isn't a valid Office document/);
    // Plain text renamed to .docx: LibreOffice would otherwise make a PDF of the text.
    expect(checkUpload(new TextEncoder().encode("not really a docx"), "fake.docx", "word")).toMatch(/don't match/);
    expect(checkUpload(file("word-report.docx"), "renamed.txt", "word")).toMatch(/don't match/);
    expect(checkUpload(new Uint8Array(), "empty.docx", "word")).toMatch(/empty/);
    expect(checkUpload(file("word-report.docx"), "no-extension", "word")).toMatch(/Use a DOC, DOCX/);
  });
});

describe("LibreOffice command", () => {
  it("uses a private settings folder and our own file path, with no shell", () => {
    const args = sofficeArgs(join(tmpdir(), "profile-0"), "/work", "/work/document.docx", "pdf");
    expect(args[0]).toMatch(/^-env:UserInstallation=file:\/\//);
    expect(args).toContain("--headless");
    expect(args.slice(-5)).toEqual(["--convert-to", "pdf", "--outdir", "/work", "/work/document.docx"]);
  });

  it("puts each spreadsheet sheet on one page only when asked", () => {
    expect(pdfFilter("excel", { fitSheets: true })).toContain("SinglePageSheets");
    expect(pdfFilter("excel", {})).toBe("pdf");
    expect(pdfFilter("word", { fitSheets: true })).toBe("pdf");
  });
});

// Real conversions: run when LibreOffice is installed on this computer.
const soffice = findSoffice();
describe.skipIf(!soffice)("real conversion with LibreOffice", { timeout: 180_000 }, () => {
  const profileDir = join(tmpdir(), "pdfconv-profile-test");
  async function textOf(pdfBytes) {
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), verbosity: 0 }).promise;
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) pages.push((await (await pdf.getPage(n)).getTextContent()).items.map((i) => i.str).join(" "));
    await pdf.loadingTask.destroy();
    return pages;
  }

  it("converts a Word report, keeping its two pages, table and list", async () => {
    const pdf = await convertToPdf({ bytes: file("word-report.docx"), fileName: "report.docx", kind: "word", soffice, profileDir });
    const pages = await textOf(pdf);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toContain("Quarterly Report");
    expect(pages[0]).toMatch(/North.*120.*135/);
    expect(pages[0]).toContain("Revenue grew 12 percent");
    expect(pages[1]).toContain("Next steps");
  });

  it("converts every sheet of a workbook, or one page per sheet when asked", async () => {
    const normal = await textOf(await convertToPdf({ bytes: file("excel-budget.xlsx"), fileName: "budget.xlsx", kind: "excel", soffice, profileDir }));
    expect(normal.join(" ")).toContain("Salaries");
    expect(normal.join(" ")).toContain("Marketing");
    const fitted = await textOf(await convertToPdf({ bytes: file("excel-budget.xlsx"), fileName: "budget.xlsx", kind: "excel", options: { fitSheets: true }, soffice, profileDir }));
    expect(fitted).toHaveLength(2);
  });

  it("converts each slide to a page", async () => {
    const pages = await textOf(await convertToPdf({ bytes: file("slides-deck.pptx"), fileName: "deck.pptx", kind: "powerpoint", soffice, profileDir }));
    expect(pages).toHaveLength(3);
    expect(pages[1]).toContain("Timeline");
  });
});
