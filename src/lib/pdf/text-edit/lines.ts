import { PDFArray, PDFDict, PDFName, PDFNumber, PDFRawStream, PDFRef, type PDFDocument, type PDFObject } from "pdf-lib";
import { codesOf, readFont, streamBytes, type FontInfo } from "./fonts";
import { tokenizeContent, type ContentOp, type Operand } from "./tokenizer";

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

// m1 × m2 in PDF's row-vector convention (apply m1 first, then m2).
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  const [a, b, c, d, e, f] = m1;
  const [A, B, C, D, E, F] = m2;
  return [a * A + b * C, a * B + b * D, c * A + d * C, c * B + d * D, e * A + f * C + E, e * B + f * D + F];
}

const apply = (m: Matrix, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

export type Rgb = [number, number, number];

// A content stream drawn on the page: the page's own content (source 0), or a form
// XObject (a reusable piece of content, often the whole page) that it draws with Do.
export type ContentSource = {
  content: string;
  ops: ContentOp[];
  // The source that draws this one, and the name it uses for it; null for the page.
  parent: number | null;
  name: string;
  stream: PDFRawStream | null;
  resources: PDFDict | undefined;
  // How many times the page draws it. Text in a form drawn more than once isn't
  // editable: changing it would change every copy.
  uses: number;
};

// One text-showing operator (Tj, TJ, ' or ") and where its text lands on the page.
export type TextShow = {
  source: number;
  opIndex: number;
  // Font key as named in the source's resources, and the page-wide id used in `fonts`.
  fontName: string;
  fontKey: string;
  text: string;
  x: number; // start of the baseline, page coordinates
  y: number;
  endX: number;
  size: number; // font size as it appears on the page
  color: Rgb;
  // Text rendering matrix at the start (font size included), in the source's own
  // coordinates; reused to redraw in the original font inside that source.
  renderMatrix: Matrix;
  // Horizontal advance in thousandths of the font size, used to keep later text in place after removal.
  advance1000: number;
  // Page-space width of any spaces before the first visible character.
  leadWidth: number;
  upright: boolean;
};

export type TextLine = {
  id: number;
  page: number;
  source: number;
  // Visible text (without leading spaces); `leading` holds the spaces drawn before it.
  text: string;
  leading: string;
  x: number; // where drawing starts, including leading spaces
  textX: number; // where the visible text starts
  y: number; // baseline, page coordinates
  width: number;
  size: number;
  color: Rgb;
  fontName: string;
  fontKey: string;
  baseFont: string;
  bold: boolean;
  italic: boolean;
  showIndices: number[];
  renderMatrix: Matrix;
  // Arabic, Hebrew or Urdu: `text` is in reading order, and the line is saved in a font that
  // can join its letters (the original font's glyphs can't be re-joined here).
  rightToLeft: boolean;
  editable: boolean;
  // Why the line can't be edited, when it can't.
  blocked?: string;
};

export type PageText = {
  sources: ContentSource[];
  shows: TextShow[];
  lines: TextLine[];
  // Fonts by page-wide id (TextShow.fontKey).
  fonts: Map<string, FontInfo | null>;
  // Why nothing on this page can be edited, when that's the case.
  problem?: string;
};

// Why a line can't be edited. Shown to the user when a page has no editable lines.
export const BLOCKED = {
  unreadableFont: "The fonts on this page don't record which letters they draw, so its text can't be changed safely.",
  unsupportedFont: "This page uses a kind of font the editor can't change yet (such as Type 3 or vertical fonts).",
  slanted: "The text on this page is rotated or slanted, which the editor can't change yet.",
  repeated: "This text is part of a graphic that appears more than once, so changing it would change every copy.",
  symbols: "This text is made of symbols or bullets that can't be edited.",
};

const FORMAT_PROBLEM = "This page's content uses a format the editor can't change yet.";
const MAX_FORM_DEPTH = 8;

function lookup(doc: PDFDocument, obj: PDFObject | undefined) {
  return obj instanceof PDFRef ? doc.context.lookup(obj) : obj;
}

const latin1 = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

// The page's content streams joined into one, or null when one can't be decoded.
function pageContent(doc: PDFDocument, pageIndex: number): string | null {
  const contents = doc.getPage(pageIndex).node.Contents();
  if (!contents) return "";
  const streams = contents instanceof PDFArray ? contents.asArray().map((r) => lookup(doc, r)) : [contents];
  const parts: string[] = [];
  for (const s of streams) {
    if (!(s instanceof PDFRawStream)) return null;
    const bytes = streamBytes(s);
    if (!bytes) return null;
    parts.push(latin1(bytes));
  }
  return parts.join("\n");
}

const num = (o: Operand | undefined) => (o?.kind === "number" ? o.value : 0);

function cmykToRgb(c: number, m: number, y: number, k: number): Rgb {
  return [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)];
}

/** Reads the text on a page, including text inside forms it draws, grouped into editable lines. */
export function readPageText(doc: PDFDocument, pageIndex: number): PageText {
  const content = pageContent(doc, pageIndex);
  const pageResources = doc.getPage(pageIndex).node.Resources();
  const page: ContentSource = { content: content ?? "", ops: [], parent: null, name: "", stream: null, resources: pageResources, uses: 1 };
  if (content === null) return { sources: [page], shows: [], lines: [], fonts: new Map(), problem: FORMAT_PROBLEM };

  const sources: ContentSource[] = [page];
  const sourceOf = new Map<PDFRawStream, number>();
  const fonts = new Map<string, FontInfo | null>();
  const shows: TextShow[] = [];
  let problem: string | undefined;

  const fontFor = (source: number, name: string) => {
    const key = source === 0 ? name : `${source}/${name}`;
    if (!fonts.has(key)) {
      const fontDicts = lookup(doc, sources[source].resources?.get(PDFName.of("Font")));
      const dict = fontDicts instanceof PDFDict ? lookup(doc, fontDicts.get(PDFName.of(name))) : undefined;
      fonts.set(key, dict instanceof PDFDict ? readFont(doc, dict) : null);
    }
    return { key, font: fonts.get(key)! };
  };

  type State = { ctm: Matrix; local: Matrix; fill: Rgb; font: string; size: number; Tc: number; Tw: number; Th: number; TL: number; Ts: number };

  // Interprets one content stream. `ctm` maps it to the page; `local` (starting at identity)
  // tracks the same transformations relative to the stream itself.
  const run = (source: number, initial: State, depth: number) => {
    const { ops } = sources[source];
    let gs: State = initial;
    const stack: State[] = [];
    let Tm: Matrix = IDENTITY;
    let Tlm: Matrix = IDENTITY;

    const moveLine = (tx: number, ty: number) => {
      Tlm = multiply([1, 0, 0, 1, tx, ty], Tlm);
      Tm = Tlm;
    };

    const show = (opIndex: number, parts: (Uint8Array | number)[]) => {
      const { key, font } = fontFor(source, gs.font);
      const textMatrix = multiply([gs.size * gs.Th, 0, 0, gs.size, 0, gs.Ts], Tm);
      const pageMatrix = multiply(textMatrix, gs.ctm);
      const [x, y] = apply(pageMatrix, 0, 0);
      let tx = 0;
      let text = "";
      let leadTx: number | null = null; // advance before the first visible character
      for (const part of parts) {
        if (typeof part === "number") {
          tx -= (part / 1000) * gs.size * gs.Th;
          // Large negative adjustments in TJ arrays usually stand for word spaces.
          if (part < -250 && !text.endsWith(" ")) text += " ";
          continue;
        }
        const codes = font ? codesOf(part, font.bytesPerCode) : Array.from(part);
        for (const code of codes) {
          const char = font?.toText.get(code) ?? "�";
          if (leadTx === null && char.trim()) leadTx = tx;
          const w0 = font ? font.widthOf(code) / 1000 : 0.5;
          const wordSpace = font?.bytesPerCode === 1 && code === 32 ? gs.Tw : 0;
          tx += (w0 * gs.size + gs.Tc + wordSpace) * gs.Th;
          text += char;
        }
      }
      const m = multiply(Tm, gs.ctm);
      const [endX] = apply(multiply([1, 0, 0, 1, tx, 0], m), 0, gs.Ts);
      const upright =
        pageMatrix[0] > 0 && pageMatrix[3] > 0 && Math.abs(pageMatrix[1]) < 1e-3 * Math.abs(pageMatrix[0]) && Math.abs(pageMatrix[2]) < 1e-3 * Math.abs(pageMatrix[3]);
      shows.push({
        source,
        opIndex,
        fontName: gs.font,
        fontKey: key,
        text,
        x,
        y,
        endX,
        size: Math.abs(pageMatrix[3]),
        color: gs.fill,
        renderMatrix: multiply(textMatrix, gs.local),
        advance1000: gs.size && gs.Th ? (tx / (gs.size * gs.Th)) * 1000 : 0,
        leadWidth: (leadTx ?? tx) * Math.abs(m[0]),
        upright,
      });
      Tm = multiply([1, 0, 0, 1, tx, 0], Tm);
    };

    // Draws a form XObject: its content runs with its own resources, inside the current state.
    const drawForm = (name: string) => {
      const xobjects = lookup(doc, sources[source].resources?.get(PDFName.of("XObject")));
      const stream = xobjects instanceof PDFDict ? lookup(doc, xobjects.get(PDFName.of(name))) : undefined;
      if (!(stream instanceof PDFRawStream) || stream.dict.lookup(PDFName.of("Subtype")) !== PDFName.of("Form")) return;
      if (depth >= MAX_FORM_DEPTH) return;
      let index = sourceOf.get(stream);
      if (index === undefined) {
        const bytes = streamBytes(stream);
        if (!bytes) {
          problem ??= FORMAT_PROBLEM;
          return;
        }
        const own = lookup(doc, stream.dict.get(PDFName.of("Resources")));
        const text = latin1(bytes);
        index = sources.length;
        sources.push({ content: text, ops: tokenizeContent(text), parent: source, name, stream, resources: own instanceof PDFDict ? own : sources[source].resources, uses: 0 });
        sourceOf.set(stream, index);
      }
      sources[index].uses++;
      // A form currently being drawn can't draw itself again (a malformed loop).
      if (active.has(index)) return;
      const matrix = lookup(doc, stream.dict.get(PDFName.of("Matrix")));
      const values = matrix instanceof PDFArray ? matrix.asArray().map((v) => lookup(doc, v)) : [];
      const formMatrix = values.length === 6 && values.every((v) => v instanceof PDFNumber) ? (values.map((v) => (v as PDFNumber).asNumber()) as Matrix) : IDENTITY;
      active.add(index);
      run(index, { ...gs, ctm: multiply(formMatrix, gs.ctm), local: IDENTITY }, depth + 1);
      active.delete(index);
    };

    ops.forEach((o, index) => {
      const a = o.operands;
      switch (o.op) {
        case "q":
          stack.push({ ...gs });
          break;
        case "Q":
          gs = stack.pop() ?? gs;
          break;
        case "cm": {
          const m = a.map(num) as Matrix;
          gs = { ...gs, ctm: multiply(m, gs.ctm), local: multiply(m, gs.local) };
          break;
        }
        case "Do":
          if (a[0]?.kind === "name") drawForm(a[0].value);
          break;
        case "BT":
          Tm = IDENTITY;
          Tlm = IDENTITY;
          break;
        case "Tf":
          gs = { ...gs, font: a[0]?.kind === "name" ? a[0].value : "", size: num(a[1]) };
          break;
        case "Tc":
          gs = { ...gs, Tc: num(a[0]) };
          break;
        case "Tw":
          gs = { ...gs, Tw: num(a[0]) };
          break;
        case "Tz":
          gs = { ...gs, Th: num(a[0]) / 100 };
          break;
        case "TL":
          gs = { ...gs, TL: num(a[0]) };
          break;
        case "Ts":
          gs = { ...gs, Ts: num(a[0]) };
          break;
        case "Td":
          moveLine(num(a[0]), num(a[1]));
          break;
        case "TD":
          gs = { ...gs, TL: -num(a[1]) };
          moveLine(num(a[0]), num(a[1]));
          break;
        case "Tm":
          Tm = Tlm = a.map(num) as Matrix;
          break;
        case "T*":
          moveLine(0, -gs.TL);
          break;
        case "Tj":
          if (a[0]?.kind === "string") show(index, [a[0].bytes]);
          break;
        case "TJ":
          if (a[0]?.kind === "array") {
            show(index, a[0].items.flatMap((it): (Uint8Array | number)[] => (it.kind === "string" ? [it.bytes] : it.kind === "number" ? [it.value] : [])));
          }
          break;
        case "'":
          moveLine(0, -gs.TL);
          if (a[0]?.kind === "string") show(index, [a[0].bytes]);
          break;
        case '"':
          gs = { ...gs, Tw: num(a[0]), Tc: num(a[1]) };
          moveLine(0, -gs.TL);
          if (a[2]?.kind === "string") show(index, [a[2].bytes]);
          break;
        case "rg":
          gs = { ...gs, fill: [num(a[0]), num(a[1]), num(a[2])] };
          break;
        case "g":
          gs = { ...gs, fill: [num(a[0]), num(a[0]), num(a[0])] };
          break;
        case "k":
          gs = { ...gs, fill: cmykToRgb(num(a[0]), num(a[1]), num(a[2]), num(a[3])) };
          break;
        case "sc":
        case "scn": {
          const n = a.filter((x) => x.kind === "number").map(num);
          if (n.length === 3) gs = { ...gs, fill: [n[0], n[1], n[2]] };
          else if (n.length === 1) gs = { ...gs, fill: [n[0], n[0], n[0]] };
          else if (n.length === 4) gs = { ...gs, fill: cmykToRgb(n[0], n[1], n[2], n[3]) };
          break;
        }
      }
    });
  };

  const active = new Set<number>([0]);
  page.ops = tokenizeContent(content);
  run(0, { ctm: IDENTITY, local: IDENTITY, fill: [0, 0, 0], font: "", size: 0, Tc: 0, Tw: 0, Th: 1, TL: 0, Ts: 0 }, 0);

  return { sources, shows, lines: groupLines(shows, sources, fonts, pageIndex), fonts, problem };
}

/** Why a page has no editable lines: the most common reason among its lines, or null when it has no text at all. */
export function noEditableTextReason(info: PageText): string | null {
  if (info.problem) return info.problem;
  const counts = new Map<string, number>();
  for (const l of info.lines) if (l.blocked) counts.set(l.blocked, (counts.get(l.blocked) ?? 0) + l.text.length);
  let best: string | null = null;
  for (const [reason, n] of counts) if (!best || n > counts.get(best)!) best = reason;
  return best;
}

// Joins consecutive pieces that sit on the same baseline, in the same font and colour.
function groupLines(shows: TextShow[], sources: ContentSource[], fonts: Map<string, FontInfo | null>, page: number): TextLine[] {
  const lines: TextLine[] = [];
  let current: { shows: number[]; text: string; last: TextShow } | null = null;

  const finish = () => {
    if (!current) return;
    const first = shows[current.shows[0]];
    const font = fonts.get(first.fontKey) ?? null;
    const baseFont = font?.baseFont ?? "";
    const full = current.text.replace(/\s+$/, "");
    const leading = full.match(/^\s*/)![0];
    const rightToLeft = RTL.test(full);
    const text = rightToLeft ? readingOrder(full.slice(leading.length)) : full.slice(leading.length);
    // Private-use characters (e.g. Word's bullet symbols) can't be edited meaningfully.
    const symbolsOnly = /[-]/.test(text) || !/[\p{L}\p{N}\p{P}\p{S}]/u.test(text);
    const blocked = !font
      ? BLOCKED.unsupportedFont
      : text.includes("�")
        ? BLOCKED.unreadableFont
        : !current.shows.every((i) => shows[i].upright)
          ? BLOCKED.slanted
          : sources[first.source].uses > 1 || ancestors(sources, first.source).some((s) => s.uses > 1)
            ? BLOCKED.repeated
            : symbolsOnly
              ? BLOCKED.symbols
              : undefined;
    if (text) {
      lines.push({
        id: lines.length,
        page,
        source: first.source,
        text,
        leading,
        x: first.x,
        textX: first.x + (leading ? first.leadWidth : 0),
        y: first.y,
        width: current.last.endX - (first.x + (leading ? first.leadWidth : 0)),
        size: first.size,
        color: first.color,
        fontName: first.fontName,
        fontKey: first.fontKey,
        baseFont,
        bold: /bold|black|heavy|semibold/i.test(baseFont),
        italic: /italic|oblique/i.test(baseFont),
        showIndices: current.shows,
        renderMatrix: first.renderMatrix,
        rightToLeft,
        editable: !blocked,
        blocked,
      });
    }
    current = null;
  };

  shows.forEach((s, i) => {
    if (!s.text) return;
    const last = current?.last;
    const sameLine =
      last &&
      s.source === last.source &&
      s.fontKey === last.fontKey &&
      Math.abs(s.size - last.size) < 0.1 &&
      Math.abs(s.y - last.y) < s.size * 0.1 &&
      s.color.every((c, k) => Math.abs(c - last.color[k]) < 0.01) &&
      s.x >= last.endX - s.size * 0.3 &&
      s.x - last.endX <= s.size * 0.8;
    if (!sameLine) {
      finish();
      current = { shows: [i], text: s.text, last: s };
      return;
    }
    // A visible gap between pieces stands for a space.
    const gap = s.x - last.endX > s.size * 0.15 && !current!.text.endsWith(" ") && !s.text.startsWith(" ");
    current!.shows.push(i);
    current!.text += (gap ? " " : "") + s.text;
    current!.last = s;
  });
  finish();
  return lines;
}

const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/**
 * PDFs store right-to-left text in display order (left to right on the page). This puts
 * it back in reading order, keeping numbers and Latin words inside it as they read.
 */
export function readingOrder(visual: string) {
  return [...visual]
    .reverse()
    .join("")
    .replace(/[\p{Script=Latin}\p{N}](?:[\p{Script=Latin}\p{N}.,:/-]*[\p{Script=Latin}\p{N}])?/gu, (run) => [...run].reverse().join(""));
}

function ancestors(sources: ContentSource[], index: number) {
  const out: ContentSource[] = [];
  for (let p = sources[index].parent; p !== null; p = sources[p].parent) out.push(sources[p]);
  return out;
}
