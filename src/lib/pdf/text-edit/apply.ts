import { PDFName, type PDFDocument } from "pdf-lib";
import { readPageText, type Rgb, type TextLine } from "./lines";
import { hexString } from "./tokenizer";

export type TextLineEdit = { page: number; lineId: number; text: string };

// A line that couldn't be redrawn in its original font; the caller draws it with a fallback font.
export type FallbackLine = { page: number; text: string; x: number; y: number; size: number; color: Rgb; baseFont: string; bold: boolean; italic: boolean };

export type TextEditResult = { fallbacks: FallbackLine[]; sameFont: number };

const n = (v: number) => Number(v.toFixed(4)).toString();

function latin1Bytes(s: string) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 255;
  return out;
}

/**
 * Replaces existing lines of text: the operators that drew each line are removed from the
 * page (not covered up). Each is swapped for an invisible spacer of the same width, so any
 * text that followed in the same block stays exactly where it was. The new text is then
 * drawn in the original font when it contains every character typed; otherwise the line is
 * returned in `fallbacks` for the caller to draw with a similar font.
 */
export function applyTextEdits(doc: PDFDocument, edits: TextLineEdit[]): TextEditResult {
  const fallbacks: FallbackLine[] = [];
  let sameFont = 0;
  const byPage = new Map<number, TextLineEdit[]>();
  for (const e of edits) byPage.set(e.page, [...(byPage.get(e.page) ?? []), e]);

  for (const [pageIndex, pageEdits] of byPage) {
    const info = readPageText(doc, pageIndex);
    if (info.problem) throw new Error(info.problem);

    const replacements = new Map<number, string>(); // op index -> replacement text
    const additions: string[] = [];

    for (const edit of pageEdits) {
      const line: TextLine | undefined = info.lines.find((l) => l.id === edit.lineId);
      if (!line || !line.editable) throw new Error("A line you edited can't be changed. Please reload the file and try again.");

      for (const showIndex of line.showIndices) {
        const show = info.shows[showIndex];
        const op = info.ops[show.opIndex];
        // Same horizontal advance, no visible glyphs.
        const spacer = `[${n(-show.advance1000)}] TJ`;
        if (op.op === "'") replacements.set(show.opIndex, `T* ${spacer}`);
        else if (op.op === '"') {
          const [aw, ac] = op.operands.map((o) => (o.kind === "number" ? o.value : 0));
          replacements.set(show.opIndex, `${n(aw)} Tw ${n(ac)} Tc T* ${spacer}`);
        } else replacements.set(show.opIndex, spacer);
      }

      const typed = edit.text.replace(/\s+$/, "");
      if (!typed) continue; // the line was cleared: removal only
      // The user edits the visible text; any spaces the original drew first are kept,
      // so the new text starts exactly where the old visible text did.
      const text = line.leading + typed;
      const font = info.fonts.get(line.fontKey);
      const codes = font?.encode(text);
      if (codes) {
        // Redraw in the original font with the original rendering matrix (size folded in).
        const [a, b, c, d, e, f] = line.renderMatrix;
        additions.push(
          `BT /${line.fontKey} 1 Tf 0 Tc 0 Tw 100 Tz 0 Ts ${n(a)} ${n(b)} ${n(c)} ${n(d)} ${n(e)} ${n(f)} Tm ${line.color.map(n).join(" ")} rg ${hexString(codes)} Tj ET`,
        );
        sameFont++;
      } else {
        fallbacks.push({ page: pageIndex, text, x: line.x, y: line.y, size: line.size, color: line.color, baseFont: line.baseFont, bold: line.bold, italic: line.italic });
      }
    }

    // Rebuild the content: original operators with replacements, wrapped in q/Q so the
    // additions start from the page's default coordinate system.
    let rebuilt = "";
    let cursor = 0;
    info.ops.forEach((op, i) => {
      const replacement = replacements.get(i);
      if (replacement === undefined) return;
      rebuilt += info.content.slice(cursor, op.start) + replacement;
      cursor = op.end;
    });
    rebuilt += info.content.slice(cursor);
    const content = `q\n${rebuilt}\nQ\n${additions.join("\n")}\n`;

    const stream = doc.context.flateStream(latin1Bytes(content));
    doc.getPage(pageIndex).node.set(PDFName.of("Contents"), doc.context.register(stream));
  }
  return { fallbacks, sameFont };
}

// Reads page text for the post-save check: the strings a viewer finds on a page.
export type TextExtractor = (bytes: Uint8Array, pageIndex: number) => Promise<string[]>;

const squash = (s: string) => s.replace(/\s+/g, "");

function count(haystack: string, needle: string) {
  if (!needle) return 0;
  let total = 0;
  for (let i = haystack.indexOf(needle); i >= 0; i = haystack.indexOf(needle, i + needle.length)) total++;
  return total;
}

/**
 * Confirms each edit in the saved file: the old line appears one time fewer than before
 * and the new text is present. Returns a description of the first problem, or null.
 */
export async function verifyTextEdits(
  before: Uint8Array,
  after: Uint8Array,
  edits: (TextLineEdit & { original: string })[],
  extract: TextExtractor,
): Promise<string | null> {
  for (const page of new Set(edits.map((e) => e.page))) {
    const was = squash((await extract(before, page)).join(""));
    const now = squash((await extract(after, page)).join(""));
    for (const e of edits.filter((x) => x.page === page)) {
      const oldText = squash(e.original);
      const newText = squash(e.text);
      // Safety net: the line we think we're editing must really be on the page as a viewer
      // reads it. If not, the editor misread the page, so refuse rather than guess.
      if (oldText && count(was, oldText) === 0) {
        return `The line “${e.original}” couldn't be matched to the text on page ${page + 1}, so it wasn't changed.`;
      }
      if (newText && !now.includes(newText)) return `The new text “${e.text}” wasn't found on page ${page + 1} after saving.`;
      // When the new text contains the old (e.g. a word appended), the old count can't drop.
      if (!newText.includes(oldText) && count(now, oldText) >= count(was, oldText)) {
        return `The original text “${e.original}” is still on page ${page + 1} after saving.`;
      }
    }
  }
  return null;
}
