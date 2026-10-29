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

// 3a. Long but within the limit: for scrolling and lazy rendering
const long = await textDocument(150, "Long report");
await writeFile(new URL("long-150-pages.pdf", out), await long.save());

// 3b. Too many pages for the free limit (200)
const many = await textDocument(250, "Long document");
await writeFile(new URL("too-many-pages-250.pdf", out), await many.save());

// 4. Broken: a valid PDF cut off halfway
await writeFile(new URL("broken-truncated.pdf", out), normalBytes.slice(0, Math.floor(normalBytes.length / 2)));

// 5. Fake: plain text renamed to .pdf
await writeFile(new URL("fake-text-file.pdf", out), "This is not a PDF. It is a text file with a .pdf name.\n");

// 6. Image-heavy: a large high-quality JPEG and a large lossless (Flate) image, plus text.
//    Used to test compression. Pixels are a smooth pattern with grain, like a photo.
const jpeg = (await import("jpeg-js")).default;
const UPNG = (await import("@pdf-lib/upng")).default.default; // bundled with pdf-lib (CommonJS export)

function photoLike(width, height, seed) {
  const data = new Uint8Array(width * height * 4);
  let s = seed;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const grain = (rand() - 0.5) * 40;
      data[i] = 120 + 90 * Math.sin(x / 140) + grain;
      data[i + 1] = 110 + 80 * Math.cos(y / 110) + grain;
      data[i + 2] = 140 + 70 * Math.sin((x + y) / 200) + grain;
      data[i + 3] = 255;
    }
  }
  return data;
}

const heavy = await PDFDocument.create();
const heavyFont = await heavy.embedFont(StandardFonts.Helvetica);
const jpgBytes = jpeg.encode({ data: photoLike(2400, 1600, 1), width: 2400, height: 1600 }, 95).data;
const pngBytes = UPNG.encode([photoLike(1300, 860, 2).buffer], 1300, 860, 0);
const images = [await heavy.embedJpg(jpgBytes), await heavy.embedPng(new Uint8Array(pngBytes))];
images.forEach((image, i) => {
  const page = heavy.addPage(A4);
  page.drawText(`Photo page ${i + 1}: text must stay sharp after compression`, { x: 50, y: 790, size: 14, font: heavyFont });
  page.drawImage(image, { x: 50, y: 300, width: 495, height: 330 });
});
await writeFile(new URL("images-heavy.pdf", out), await heavy.save());

// 7. Scanned page: only a picture of a page, no real text (as from a scanner).
//    Grey "text lines" on white, so it looks like a document but has nothing to select.
function scanLike(width, height) {
  const data = new Uint8Array(width * height * 4).fill(250);
  for (let line = 0; line < 18; line++) {
    const top = 80 + line * 40;
    const length = line % 5 === 4 ? 0.45 : 0.85;
    for (let y = top; y < top + 12; y++) {
      for (let x = 70; x < 70 + (width - 140) * length; x++) {
        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 90;
      }
    }
  }
  return data;
}
const scanned = await PDFDocument.create();
const scanImage = await scanned.embedJpg(jpeg.encode({ data: scanLike(620, 877), width: 620, height: 877 }, 70).data);
scanned.addPage(A4).drawImage(scanImage, { x: 0, y: 0, width: A4[0], height: A4[1] });
await writeFile(new URL("scanned-page.pdf", out), await scanned.save());

console.log("Test PDFs written to test-files/");
