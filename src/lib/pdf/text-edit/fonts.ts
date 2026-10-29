import { Encodings, Font, FontNames } from "@pdf-lib/standard-fonts";
import { PDFArray, PDFDict, PDFName, PDFNumber, PDFRawStream, PDFRef, type PDFDocument, type PDFObject } from "pdf-lib";
import { unzlibSync } from "fflate";

// What the text editor needs to know about a font used on a page.
export type FontInfo = {
  baseFont: string;
  bytesPerCode: 1 | 2;
  // Glyph code -> the text it represents.
  toText: Map<number, string>;
  // Advance width of a code, in thousandths of the font size.
  widthOf: (code: number) => number;
  // Codes for the given text using this font, or null if any character is missing.
  encode: (text: string) => Uint8Array | null;
};

function lookup(doc: PDFDocument, obj: PDFObject | undefined) {
  return obj instanceof PDFRef ? doc.context.lookup(obj) : obj;
}

function streamText(stream: PDFRawStream) {
  const filter = stream.dict.lookup(PDFName.of("Filter"));
  const bytes = filter === PDFName.of("FlateDecode") ? unzlibSync(stream.contents) : stream.contents;
  return new TextDecoder("latin1").decode(bytes);
}

function utf16beHex(hex: string) {
  let s = "";
  for (let i = 0; i + 4 <= hex.length; i += 4) s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  return s;
}

// Reads the bfchar and bfrange sections of a ToUnicode CMap.
export function parseToUnicode(cmap: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) map.set(parseInt(m[1], 16), utf16beHex(m[2]));
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)) {
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      if (hi - lo > 0xffff) continue;
      if (m[3].startsWith("[")) {
        const items = [...m[3].matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => utf16beHex(x[1]));
        items.forEach((t, k) => lo + k <= hi && map.set(lo + k, t));
      } else {
        const start = m[3].slice(1, -1);
        // The last character increments across the range.
        const base = utf16beHex(start);
        for (let c = lo; c <= hi; c++) {
          map.set(c, base.slice(0, -1) + String.fromCharCode(base.charCodeAt(base.length - 1) + (c - lo)));
        }
      }
    }
  }
  return map;
}

const winAnsiToText = (() => {
  const map = new Map<number, string>();
  for (const cp of Encodings.WinAnsi.supportedCodePoints) map.set(Encodings.WinAnsi.encodeUnicodeCodePoint(cp).code, String.fromCodePoint(cp));
  return map;
})();

const standardNames = new Set<string>(Object.values(FontNames));

function cidWidths(doc: PDFDocument, descendant: PDFDict) {
  const widths = new Map<number, number>();
  const dw = (descendant.lookup(PDFName.of("DW")) as PDFNumber | undefined)?.asNumber() ?? 1000;
  const w = lookup(doc, descendant.get(PDFName.of("W")));
  if (w instanceof PDFArray) {
    const items = w.asArray().map((o) => lookup(doc, o));
    for (let i = 0; i < items.length; ) {
      const first = (items[i] as PDFNumber).asNumber();
      const next = items[i + 1];
      if (next instanceof PDFArray) {
        next.asArray().forEach((v, k) => widths.set(first + k, (lookup(doc, v) as PDFNumber).asNumber()));
        i += 2;
      } else {
        const last = (next as PDFNumber).asNumber();
        const width = (items[i + 2] as PDFNumber).asNumber();
        for (let c = first; c <= last; c++) widths.set(c, width);
        i += 3;
      }
    }
  }
  return (code: number) => widths.get(code) ?? dw;
}

/** Reads a font dictionary into what the text editor needs. Returns null for fonts it can't handle (e.g. Type3). */
export function readFont(doc: PDFDocument, fontDict: PDFDict): FontInfo | null {
  const subtype = String(fontDict.lookup(PDFName.of("Subtype")));
  const baseFont = String(fontDict.lookup(PDFName.of("BaseFont")) ?? "").replace(/^\//, "");
  if (subtype === "/Type3") return null;

  const toUnicodeStream = lookup(doc, fontDict.get(PDFName.of("ToUnicode")));
  const toText = toUnicodeStream instanceof PDFRawStream ? parseToUnicode(streamText(toUnicodeStream)) : new Map<number, string>();

  let bytesPerCode: 1 | 2;
  let widthOf: (code: number) => number;
  // Whether codes not listed in ToUnicode can still be used (standard, non-embedded fonts).
  let anyWinAnsi = false;

  if (subtype === "/Type0") {
    bytesPerCode = 2;
    // Only the standard 2-byte identity mapping can be re-encoded reliably.
    const encoding = String(fontDict.lookup(PDFName.of("Encoding")));
    if (encoding !== "/Identity-H") return null;
    const descendants = lookup(doc, fontDict.get(PDFName.of("DescendantFonts")));
    const descendant = descendants instanceof PDFArray ? lookup(doc, descendants.get(0)) : undefined;
    if (!(descendant instanceof PDFDict)) return null;
    widthOf = cidWidths(doc, descendant);
  } else {
    bytesPerCode = 1;
    const firstChar = (fontDict.lookup(PDFName.of("FirstChar")) as PDFNumber | undefined)?.asNumber() ?? 0;
    const widthsArray = lookup(doc, fontDict.get(PDFName.of("Widths")));
    const plainName = baseFont.replace(/^[A-Z]{6}\+/, "");
    if (widthsArray instanceof PDFArray) {
      const widths = widthsArray.asArray().map((o) => (lookup(doc, o) as PDFNumber).asNumber());
      widthOf = (code) => widths[code - firstChar] ?? 0;
    } else if (standardNames.has(plainName)) {
      // The 14 standard fonts may omit widths; use the built-in metrics.
      const metrics = Font.load(plainName as FontNames);
      widthOf = (code) => {
        const text = winAnsiToText.get(code);
        if (!text) return 0;
        const { name } = Encodings.WinAnsi.encodeUnicodeCodePoint(text.codePointAt(0)!);
        return metrics.getWidthOfGlyph(name) ?? 0;
      };
    } else {
      widthOf = () => 500;
    }
    const encoding = fontDict.lookup(PDFName.of("Encoding"));
    const embedded = (() => {
      const descriptor = lookup(doc, fontDict.get(PDFName.of("FontDescriptor")));
      return descriptor instanceof PDFDict && ["FontFile", "FontFile2", "FontFile3"].some((k) => descriptor.has(PDFName.of(k)));
    })();
    if (toText.size === 0 && (encoding === PDFName.of("WinAnsiEncoding") || encoding === undefined || standardNames.has(plainName))) {
      for (const [code, text] of winAnsiToText) toText.set(code, text);
      anyWinAnsi = !embedded && standardNames.has(plainName);
    }
  }

  // Reverse map for re-encoding: only single characters with a known code.
  const fromText = new Map<string, number>();
  for (const [code, text] of toText) if ([...text].length === 1 && !fromText.has(text)) fromText.set(text, code);

  const encode = (text: string): Uint8Array | null => {
    const out: number[] = [];
    for (const ch of text) {
      const code = fromText.get(ch);
      if (code === undefined) return null;
      // In embedded subset fonts, a listed code with zero width usually means the glyph is missing.
      if (!anyWinAnsi && ch !== " " && widthOf(code) === 0) return null;
      if (bytesPerCode === 2) out.push(code >> 8, code & 255);
      else out.push(code);
    }
    return new Uint8Array(out);
  };

  return { baseFont, bytesPerCode, toText, widthOf, encode };
}

export function codesOf(bytes: Uint8Array, bytesPerCode: 1 | 2) {
  const codes: number[] = [];
  for (let i = 0; i + bytesPerCode <= bytes.length; i += bytesPerCode) codes.push(bytesPerCode === 2 ? (bytes[i] << 8) | bytes[i + 1] : bytes[i]);
  return codes;
}
