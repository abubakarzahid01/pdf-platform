// Kept apart from preview.ts (which reads font files) so the editor can show notices
// without loading the font reader up front.

/**
 * How an edited line will look once saved, for the editor to show before the download:
 * - "original" with glyphs: saved in the PDF's own font, drawn here from that font's shapes.
 * - "original" without glyphs: saved in the PDF's own font, but its shapes can't be read
 *   here, so the editor shows a similar font on screen.
 * - "similar": the PDF's font lacks some typed characters (`missing`), so the line is saved
 *   in a similar standard font, exactly as applyTextEdits does.
 */
export type LinePreview =
  | { font: "original"; glyphs: { d: string; x: number }[] | null; unitsPerEm: number }
  | { font: "similar"; missing: string[] };

// A readable name for a missing character in a message.
function characterName(ch: string) {
  if (ch === " ") return "a space";
  if (/\s/.test(ch)) return "a blank character";
  return `“${ch}”`;
}

const LISTED = 5;

/** The explanation shown when a line will be saved in a similar font, or null if it keeps its font. */
export function similarFontNotice(preview: LinePreview | undefined) {
  if (preview?.font !== "similar") return null;
  if (preview.missing.length === 0) return "This line will be saved in a similar font: the original font in this PDF can't be reused.";
  const names = preview.missing.slice(0, LISTED).map(characterName);
  const more = preview.missing.length - names.length;
  const list = more > 0 ? `${names.join(", ")} and ${more} more` : names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  return `This line will be saved in a similar font: the original font in this PDF doesn't include ${list}.`;
}
