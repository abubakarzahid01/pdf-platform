// Runs the existing-text editor over PDFs and reports how well it copes:
//   npx vite-node scripts/probe-text-edit.mts [file.pdf ...]   (defaults to every PDF in test-files/)
// For each file: lines found vs. what PDF.js sees, fonts, and whether sample edits pass the check.
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { PDFDocument } from "pdf-lib";
import { applyEdits, type FontLoader } from "../src/lib/pdf/operations/edits";
import type { TextExtractor } from "../src/lib/pdf/text-edit/apply";
import { readPageText } from "../src/lib/pdf/text-edit/lines";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const require = createRequire(import.meta.url);
const interFile = { regular: "400Regular/Inter_400Regular.ttf", bold: "700Bold/Inter_700Bold.ttf", italic: "400Regular_Italic/Inter_400Regular_Italic.ttf", boldItalic: "700Bold_Italic/Inter_700Bold_Italic.ttf" };
const loadFont: FontLoader = async (s) => new Uint8Array(readFileSync(require.resolve(`@expo-google-fonts/inter/${interFile[s]}`)));

async function items(bytes: Uint8Array, page: number) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const content = await (await doc.getPage(page + 1)).getTextContent();
  const result = (content.items as { str: string; transform: number[] }[]).filter((i) => i.str.trim()).map((i) => ({ str: i.str, y: i.transform[5] }));
  await doc.loadingTask.destroy();
  return result;
}
const extract: TextExtractor = async (bytes, page) => (await items(bytes, page)).map((i) => i.str);

const dir = new URL("../test-files/", import.meta.url);
const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith(".pdf"));

for (const file of files) {
  const path = file.includes("/") || file.includes("\\") ? file : new URL(file, dir);
  let bytes: Uint8Array;
  let doc: PDFDocument;
  try {
    bytes = new Uint8Array(readFileSync(path));
    doc = await PDFDocument.load(bytes);
  } catch {
    console.log(`\n${file}: not loadable (expected for broken/fake/locked files)`);
    continue;
  }
  const page = 0;
  const info = readPageText(doc, page);
  const seen = await items(bytes, page);
  const missing = seen.filter((it) => !info.lines.some((l) => l.text.includes(it.str.trim()) && Math.abs(l.y - it.y) < 1));
  const editable = info.lines.filter((l) => l.editable);
  const fonts = [...info.fonts.entries()].map(([k, f]) => `${k}=${f ? `${f.baseFont}(${f.bytesPerCode}B)` : "unsupported"}`);
  console.log(`\n${file}: ${info.lines.length} lines, ${editable.length} editable, ${missing.length} of ${seen.length} PDF.js runs not matched${info.problem ? ` — ${info.problem}` : ""}`);
  console.log(`  fonts: ${fonts.join(", ") || "none"}`);
  if (missing.length) console.log(`  unmatched: ${missing.slice(0, 5).map((m) => JSON.stringify(m.str)).join(", ")}`);
  for (const l of info.lines.slice(0, 40)) {
    console.log(`  ${l.editable ? "✓" : "✗"} [${l.baseFont.replace(/^[A-Z]{6}\+/, "")} ${l.size.toFixed(1)}] ${JSON.stringify(l.text.slice(0, 70))}`);
  }

  // Sample edits: change up to four editable lines, keeping most characters so the
  // original font can often be reused, and one with characters likely missing.
  const targets = editable.filter((l) => l.text.trim().length > 1).slice(0, 4);
  if (!targets.length) continue;
  const lineEdits = targets.map((l, i) => ({
    page,
    lineId: l.id,
    original: l.text,
    text: i === 3 ? `${l.text.trim()} — Zoë` : [...l.text.trim()].reverse().join(""),
  }));
  try {
    const result = await applyEdits({ name: file, bytes }, { texts: [], annotations: [], lineEdits }, loadFont, extract);
    console.log(`  EDIT CHECK: passed — ${lineEdits.length} lines, ${result.fontFallbacks} needed a similar font, ${result.substitutions} needed Inter`);
  } catch (error) {
    console.log(`  EDIT CHECK: FAILED — ${error instanceof Error ? error.message : error}`);
  }
}
