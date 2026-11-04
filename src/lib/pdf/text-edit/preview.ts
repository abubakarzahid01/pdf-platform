import { codesOf, type FontInfo } from "./fonts";
import type { LinePreview } from "./preview-notice";

export type { LinePreview } from "./preview-notice";

// Characters the font can't show, each listed once, in typing order.
export function missingCharacters(font: FontInfo, text: string) {
  const missing: string[] = [];
  for (const ch of new Set(text)) if (!font.encode(ch)) missing.push(ch);
  return missing;
}

export function previewLine(font: FontInfo | null | undefined, text: string): LinePreview {
  // Matches applyTextEdits: trailing spaces are dropped and an empty line is just removed.
  const typed = text.replace(/\s+$/, "");
  if (!typed) return { font: "original", glyphs: [], unitsPerEm: 1000 };
  const codes = font?.encode(typed);
  if (!font || !codes) return { font: "similar", missing: font ? missingCharacters(font, typed) : [] };

  const outlines = font.outlines();
  if (!outlines) return { font: "original", glyphs: null, unitsPerEm: 1000 };
  const glyphs: { d: string; x: number }[] = [];
  let x = 0;
  for (const code of codesOf(codes, font.bytesPerCode)) {
    const d = outlines.path(code);
    if (d === null) return { font: "original", glyphs: null, unitsPerEm: 1000 };
    if (d) glyphs.push({ d, x });
    // Advances come from the PDF's widths, as when the line is drawn in the saved file.
    x += (font.widthOf(code) * outlines.unitsPerEm) / 1000;
  }
  return { font: "original", glyphs, unitsPerEm: outlines.unitsPerEm };
}
