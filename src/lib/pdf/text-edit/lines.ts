import { PDFArray, PDFDict, PDFName, PDFRawStream, PDFRef, type PDFDocument } from "pdf-lib";
import { unzlibSync } from "fflate";
import { codesOf, readFont, type FontInfo } from "./fonts";
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

// One text-showing operator (Tj, TJ, ' or ") and where its text lands on the page.
export type TextShow = {
  opIndex: number;
  fontKey: string;
  text: string;
  x: number; // start of the baseline, page coordinates
  y: number;
  endX: number;
  size: number; // font size as it appears on the page
  color: Rgb;
  // Text rendering matrix at the start (font size included); reused to redraw in the original font.
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
  // Visible text (without leading spaces); `leading` holds the spaces drawn before it.
  text: string;
  leading: string;
  x: number; // where drawing starts, including leading spaces
  textX: number; // where the visible text starts
  y: number; // baseline, page coordinates
  width: number;
  size: number;
  color: Rgb;
  fontKey: string;
  baseFont: string;
  bold: boolean;
  italic: boolean;
  showIndices: number[];
  renderMatrix: Matrix;
  editable: boolean;
};

export type PageText = {
  content: string;
  ops: ContentOp[];
  shows: TextShow[];
  lines: TextLine[];
  fonts: Map<string, FontInfo | null>;
  // Why nothing on this page can be edited, when that's the case.
  problem?: string;
};

function pageContent(doc: PDFDocument, pageIndex: number): string | null {
  const page = doc.getPage(pageIndex);
  const contents = page.node.Contents();
  if (!contents) return "";
  const streams = contents instanceof PDFArray ? contents.asArray().map((r) => doc.context.lookup(r)) : [contents];
  const parts: string[] = [];
  for (const s of streams) {
    if (!(s instanceof PDFRawStream)) return null;
    const filter = s.dict.lookup(PDFName.of("Filter"));
    if (filter !== undefined && filter !== PDFName.of("FlateDecode")) return null;
    parts.push(new TextDecoder("latin1").decode(filter ? unzlibSync(s.contents) : s.contents));
  }
  return parts.join("\n");
}

const num = (o: Operand | undefined) => (o?.kind === "number" ? o.value : 0);

function cmykToRgb(c: number, m: number, y: number, k: number): Rgb {
  return [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)];
}

/** Reads the text on a page: every text-showing operator, grouped into editable lines. */
export function readPageText(doc: PDFDocument, pageIndex: number): PageText {
  const content = pageContent(doc, pageIndex);
  const empty = { content: content ?? "", ops: [], shows: [], lines: [], fonts: new Map() };
  if (content === null) return { ...empty, problem: "This page's content uses a format the editor can't change yet." };

  const ops = tokenizeContent(content);
  const resources = doc.getPage(pageIndex).node.Resources();
  const fontDicts = resources?.lookup(PDFName.of("Font"));
  const fonts = new Map<string, FontInfo | null>();
  const fontFor = (key: string) => {
    if (!fonts.has(key)) {
      const ref = fontDicts instanceof PDFDict ? fontDicts.get(PDFName.of(key)) : undefined;
      const dict = ref instanceof PDFRef ? doc.context.lookup(ref) : ref;
      fonts.set(key, dict instanceof PDFDict ? readFont(doc, dict) : null);
    }
    return fonts.get(key)!;
  };

  type State = { ctm: Matrix; fill: Rgb; font: string; size: number; Tc: number; Tw: number; Th: number; TL: number; Ts: number };
  let gs: State = { ctm: IDENTITY, fill: [0, 0, 0], font: "", size: 0, Tc: 0, Tw: 0, Th: 1, TL: 0, Ts: 0 };
  const stack: State[] = [];
  let Tm: Matrix = IDENTITY;
  let Tlm: Matrix = IDENTITY;
  const shows: TextShow[] = [];

  const moveLine = (tx: number, ty: number) => {
    Tlm = multiply([1, 0, 0, 1, tx, ty], Tlm);
    Tm = Tlm;
  };

  const show = (opIndex: number, parts: (Uint8Array | number)[]) => {
    const font = fontFor(gs.font);
    const renderMatrix = multiply(multiply([gs.size * gs.Th, 0, 0, gs.size, 0, gs.Ts], Tm), gs.ctm);
    const [x, y] = apply(renderMatrix, 0, 0);
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
    const upright = renderMatrix[0] > 0 && renderMatrix[3] > 0 && Math.abs(renderMatrix[1]) < 1e-3 * Math.abs(renderMatrix[0]) && Math.abs(renderMatrix[2]) < 1e-3 * Math.abs(renderMatrix[3]);
    shows.push({
      opIndex,
      fontKey: gs.font,
      text,
      x,
      y,
      endX,
      size: Math.abs(renderMatrix[3]),
      color: gs.fill,
      renderMatrix,
      advance1000: gs.size && gs.Th ? (tx / (gs.size * gs.Th)) * 1000 : 0,
      leadWidth: (leadTx ?? tx) * Math.abs(m[0]),
      upright,
    });
    Tm = multiply([1, 0, 0, 1, tx, 0], Tm);
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
      case "cm":
        gs = { ...gs, ctm: multiply(a.map(num) as Matrix, gs.ctm) };
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

  return { content, ops, shows, lines: groupLines(shows, fonts, pageIndex), fonts };
}

// Joins consecutive pieces that sit on the same baseline, in the same font and colour.
function groupLines(shows: TextShow[], fonts: Map<string, FontInfo | null>, page: number): TextLine[] {
  const lines: TextLine[] = [];
  let current: { shows: number[]; text: string; last: TextShow } | null = null;

  const finish = () => {
    if (!current) return;
    const first = shows[current.shows[0]];
    const font = fonts.get(first.fontKey) ?? null;
    const baseFont = font?.baseFont ?? "";
    const full = current.text.replace(/\s+$/, "");
    const leading = full.match(/^\s*/)![0];
    const text = full.slice(leading.length);
    // Private-use characters (e.g. Word's bullet symbols) can't be edited meaningfully.
    const symbolsOnly = /[-]/.test(text) || !/[\p{L}\p{N}\p{P}\p{S}]/u.test(text);
    if (text) {
      lines.push({
        id: lines.length,
        page,
        text,
        leading,
        x: first.x,
        textX: first.x + (leading ? first.leadWidth : 0),
        y: first.y,
        width: current.last.endX - (first.x + (leading ? first.leadWidth : 0)),
        size: first.size,
        color: first.color,
        fontKey: first.fontKey,
        baseFont,
        bold: /bold|black|heavy|semibold/i.test(baseFont),
        italic: /italic|oblique/i.test(baseFont),
        showIndices: current.shows,
        renderMatrix: first.renderMatrix,
        editable: font !== null && current.shows.every((i) => shows[i].upright) && !text.includes("�") && !symbolsOnly,
      });
    }
    current = null;
  };

  shows.forEach((s, i) => {
    if (!s.text) return;
    const last = current?.last;
    const sameLine =
      last &&
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
