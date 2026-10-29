import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readTextItems } from "../text-items";
import { pageText, pdfToText, type TextItemReader } from "./pdf-to-text";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const readItems: TextItemReader = async (bytes) => {
  const pdf = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  try {
    return await readTextItems(pdf, pdfjs.Util.transform);
  } finally {
    await pdf.loadingTask.destroy();
  }
};

async function textOf(file: string, breaks: "marked" | "continuous" = "marked") {
  const bytes = new Uint8Array(readFileSync(new URL(`../../../../test-files/${file}`, import.meta.url)));
  const result = await pdfToText({ name: file, bytes }, breaks, readItems);
  return { ...result, text: new TextDecoder().decode(result.bytes) };
}

describe("pageText", () => {
  const item = (str: string, x: number, y: number, width = str.length * 6) => ({ str, x, y, width, size: 12, hasEOL: false });

  it("orders pieces into lines by position, not by the order they were drawn", () => {
    // "Hello" ends at x=40; "world" starts after a normal word space.
    const text = pageText([item("world", 44, 100), item("second line", 10, 120), item("Hello", 10, 100)]);
    expect(text).toBe("Hello world\nsecond line");
  });

  it("keeps wide gaps between columns and separates paragraphs with a blank line", () => {
    const text = pageText([item("Name", 10, 100, 24), item("Price", 200, 100, 30), item("Next paragraph", 10, 160)]);
    expect(text).toBe("Name    Price\n\nNext paragraph");
  });
});

describe("pdfToText", () => {
  it("extracts a Word document in reading order, with accents", async () => {
    const { text, name, mime } = await textOf("word-letter.pdf");
    expect(name).toBe("word-letter.txt");
    expect(mime).toMatch(/^text\/plain/);
    expect(text.startsWith("--- Page 1 ---\nQuarterly Update")).toBe(true);
    // Bold and italic runs on the same line come out as one line.
    expect(text).toContain("Dear customer, thank you for choosing Northwind Supplies this year. Our new prices start on 1");
    // Word's Symbol-font bullets become real bullet characters.
    expect(text).toMatch(/• +Café-quality coffee beans now in stock/);
    // Table rows keep their cells together, in order, with columns clearly apart.
    expect(text).toMatch(/Paper A4 {3,}4\.50 EUR/);
  });

  it("keeps table rows from a browser-made invoice on one line each", async () => {
    const { text } = await textOf("edge-invoice.pdf");
    expect(text).toMatch(/Item\s+Qty\s+Price/);
    expect(text).toMatch(/Toner\s+2\s+£120\.50/);
  });

  it("reads rotated pages the way they are displayed", async () => {
    const { text } = await textOf("mixed-sizes.pdf");
    expect(text).toContain("Letter, rotated 90 degrees");
  });

  it("marks pages or runs them together, as chosen", async () => {
    const marked = await textOf("sample-3-pages.pdf", "marked");
    expect(marked.text.match(/--- Page \d ---/g)).toEqual(["--- Page 1 ---", "--- Page 2 ---", "--- Page 3 ---"]);
    const continuous = await textOf("sample-3-pages.pdf", "continuous");
    expect(continuous.text).not.toContain("--- Page");
    expect(continuous.text).toContain("Page 3 of 3");
  });

  it("says so honestly when there is no text, as in a scanned page", async () => {
    const { note, text } = await textOf("scanned-page.pdf");
    expect(note).toMatch(/No text was found.*OCR/);
    expect(text.replace(/--- Page 1 ---/, "").trim()).toBe("");
  });
});
