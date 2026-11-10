import { PDFDict, PDFName, type PDFDocument, type PDFRef } from "pdf-lib";
import { readPageText, type ContentSource, type Rgb, type TextLine } from "./lines";
import { hexString } from "./tokenizer";

export type TextLineEdit = { page: number; lineId: number; text: string };

// A line that couldn't be redrawn in its original font; the caller draws it with a fallback font.
// `rightEdge` is set for right-to-left lines, which keep their right edge in place.
export type FallbackLine = { page: number; text: string; x: number; y: number; size: number; color: Rgb; baseFont: string; bold: boolean; italic: boolean; rightEdge?: number };

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

    // Per content source (the page, or a form it draws): op index -> replacement, and new text.
    const replacements = new Map<number, Map<number, string>>();
    const additions = new Map<number, string[]>();

    for (const edit of pageEdits) {
      const line: TextLine | undefined = info.lines.find((l) => l.id === edit.lineId);
      if (!line || !line.editable) throw new Error("A line you edited can't be changed. Please reload the file and try again.");
      const source = info.sources[line.source];
      if (!replacements.has(line.source)) replacements.set(line.source, new Map());
      const sourceReplacements = replacements.get(line.source)!;

      for (const showIndex of line.showIndices) {
        const show = info.shows[showIndex];
        const op = source.ops[show.opIndex];
        // Same horizontal advance, no visible glyphs.
        const spacer = `[${n(-show.advance1000)}] TJ`;
        if (op.op === "'") sourceReplacements.set(show.opIndex, `T* ${spacer}`);
        else if (op.op === '"') {
          const [aw, ac] = op.operands.map((o) => (o.kind === "number" ? o.value : 0));
          sourceReplacements.set(show.opIndex, `${n(aw)} Tw ${n(ac)} Tc T* ${spacer}`);
        } else sourceReplacements.set(show.opIndex, spacer);
      }

      const typed = edit.text.replace(/\s+$/, "");
      if (!typed) continue; // the line was cleared: removal only
      // The user edits the visible text; any spaces the original drew first are kept,
      // so the new text starts exactly where the old visible text did.
      const text = line.rightToLeft ? typed : line.leading + typed;
      const font = info.fonts.get(line.fontKey);
      const codes = line.rightToLeft ? null : font?.encode(text);
      if (codes) {
        // Redraw in the original font with the original rendering matrix (size folded in),
        // in the same content source so the font name and coordinates still apply.
        const [a, b, c, d, e, f] = line.renderMatrix;
        if (!additions.has(line.source)) additions.set(line.source, []);
        additions
          .get(line.source)!
          .push(`BT /${line.fontName} 1 Tf 0 Tc 0 Tw 100 Tz 0 Ts ${n(a)} ${n(b)} ${n(c)} ${n(d)} ${n(e)} ${n(f)} Tm ${line.color.map(n).join(" ")} rg ${hexString(codes)} Tj ET`);
        sameFont++;
      } else {
        fallbacks.push({
          page: pageIndex,
          text,
          x: line.rightToLeft ? line.textX : line.x,
          y: line.y,
          size: line.size,
          color: line.color,
          baseFont: line.baseFont,
          bold: line.bold,
          italic: line.italic,
          rightEdge: line.rightToLeft ? line.textX + line.width : undefined,
        });
      }
    }

    // Changed forms are saved as new copies, so every form that draws one (up to the page)
    // is rewritten to use the copy. Other pages that share a form keep the original.
    const changed = new Set(replacements.keys());
    for (const s of [...changed]) for (let p = info.sources[s].parent; p !== null; p = info.sources[p].parent) changed.add(p);
    const copies = new Map<number, PDFRef>();
    // A form is always found after the source that draws it, so higher indices go first.
    for (const s of [...changed].sort((a, b) => b - a)) {
      const source = info.sources[s];
      const content = rebuild(source, replacements.get(s), additions.get(s));

      let resources = source.resources;
      const children = [...copies].filter(([c]) => info.sources[c].parent === s);
      if (children.length > 0 && resources) {
        resources = resources.clone();
        const existing = doc.context.lookup(resources.get(PDFName.of("XObject")));
        const xobjects = existing instanceof PDFDict ? existing.clone() : doc.context.obj({});
        for (const [c, ref] of children) xobjects.set(PDFName.of(info.sources[c].name), ref);
        resources.set(PDFName.of("XObject"), xobjects);
      }

      if (s === 0) {
        const page = doc.getPage(pageIndex).node;
        page.set(PDFName.of("Contents"), doc.context.register(doc.context.flateStream(latin1Bytes(content))));
        if (resources && resources !== source.resources) page.set(PDFName.of("Resources"), resources);
      } else {
        const copy = doc.context.flateStream(latin1Bytes(content));
        for (const [key, value] of source.stream!.dict.entries()) {
          if (!["Length", "Filter", "DecodeParms"].includes(key.decodeText())) copy.dict.set(key, value);
        }
        if (resources && resources !== source.resources) copy.dict.set(PDFName.of("Resources"), resources);
        copies.set(s, doc.context.register(copy));
      }
    }
  }
  return { fallbacks, sameFont };
}

// The source's content with its replacements, wrapped in q/Q so the additions start from
// the source's own default coordinate system.
function rebuild(source: ContentSource, replacements: Map<number, string> | undefined, additions: string[] | undefined) {
  let rebuilt = "";
  let cursor = 0;
  source.ops.forEach((op, i) => {
    const replacement = replacements?.get(i);
    if (replacement === undefined) return;
    rebuilt += source.content.slice(cursor, op.start) + replacement;
    cursor = op.end;
  });
  rebuilt += source.content.slice(cursor);
  if (!replacements?.size && !additions?.length) return source.content;
  return `q\n${rebuilt}\nQ\n${(additions ?? []).join("\n")}\n`;
}

// Reads page text for the post-save check: the strings a viewer finds on a page.
export type TextExtractor = (bytes: Uint8Array, pageIndex: number) => Promise<string[]>;

const squash = (s: string) => s.replace(/\s+/g, "");

// Hindi's short-i sign (ि) is drawn, and so read back, before the consonant it follows
// when typed. Text matches when it's the same apart from where those signs sit.
function containsText(haystack: string, needle: string) {
  if (haystack.includes(needle)) return true;
  const signs = (s: string) => s.split("ि").length - 1;
  const without = (s: string) => s.replaceAll("ि", "");
  return signs(needle) > 0 && without(haystack).includes(without(needle)) && signs(haystack) >= signs(needle);
}

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
      if (newText && !containsText(now, newText)) return `The new text “${e.text}” wasn't found on page ${page + 1} after saving.`;
      // When the new text contains the old (e.g. a word appended), the old count can't drop.
      if (!newText.includes(oldText) && count(now, oldText) >= count(was, oldText)) {
        return `The original text “${e.original}” is still on page ${page + 1} after saving.`;
      }
    }
  }
  return null;
}
