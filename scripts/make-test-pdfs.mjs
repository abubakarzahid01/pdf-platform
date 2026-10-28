// Generates the PDFs in test-files/ used to check uploads and rendering.
// Run with: node scripts/make-test-pdfs.mjs
// The password-protected file is made separately (see test-files/README.md).

import { mkdir, writeFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

const out = new URL("../test-files/", import.meta.url);
await mkdir(out, { recursive: true });

const A4 = [595.28, 841.89];

async function textDocument(pageCount, title) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage(A4);
    page.drawText(title, { x: 60, y: 770, size: 22, font: bold, color: rgb(0.08, 0.07, 0.17) });
    page.drawText(`Page ${i} of ${pageCount}`, { x: 60, y: 740, size: 12, font, color: rgb(0.35, 0.35, 0.42) });
    const lines = [
      "This is a generated test document for the PDF platform.",
      "It contains real, selectable text drawn with a standard font,",
      "so rendering, text extraction and editing can be tested.",
    ];
    lines.forEach((line, j) => page.drawText(line, { x: 60, y: 690 - j * 18, size: 12, font }));
    page.drawRectangle({ x: 60, y: 420, width: 475, height: 200, color: rgb(0.94, 0.93, 0.99), borderColor: rgb(0.35, 0.28, 0.88), borderWidth: 1.5 });
    page.drawText(`Box on page ${i}`, { x: 80, y: 590, size: 14, font: bold, color: rgb(0.35, 0.28, 0.88) });
    page.drawText(String(i), { x: 290, y: 40, size: 10, font });
  }
  return doc;
}

// 1. Normal three-page document
const normal = await textDocument(3, "Sample report");
const normalBytes = await normal.save();
await writeFile(new URL("sample-3-pages.pdf", out), normalBytes);

// 2. Mixed page sizes and a rotated page
const mixed = await PDFDocument.create();
const font = await mixed.embedFont(StandardFonts.Helvetica);
for (const [label, size, rotation] of [
  ["A4 portrait", A4, 0],
  ["A4 landscape", [A4[1], A4[0]], 0],
  ["Letter, rotated 90 degrees", [612, 792], 90],
]) {
  const page = mixed.addPage(size);
  page.setRotation(degrees(rotation));
  page.drawText(label, { x: 50, y: size[1] - 80, size: 24, font });
}
await writeFile(new URL("mixed-sizes.pdf", out), await mixed.save());

// 3. Too many pages for the free limit (200)
const many = await textDocument(250, "Long document");
await writeFile(new URL("too-many-pages-250.pdf", out), await many.save());

// 4. Broken: a valid PDF cut off halfway
await writeFile(new URL("broken-truncated.pdf", out), normalBytes.slice(0, Math.floor(normalBytes.length / 2)));

// 5. Fake: plain text renamed to .pdf
await writeFile(new URL("fake-text-file.pdf", out), "This is not a PDF. It is a text file with a .pdf name.\n");

console.log("Test PDFs written to test-files/");
