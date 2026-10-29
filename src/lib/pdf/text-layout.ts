import type { TextItem } from "./text-items";

// A run of text on a line, separated from its neighbours by a wide gap (a column break).
export type Cell = { text: string; x: number; end: number };

export type LayoutLine = { y: number; size: number; cells: Cell[] };

// Bullet characters that Word and others draw with the Symbol/Wingdings fonts (private-use codes).
const SYMBOL_BULLETS = /[]/g;

const BULLET_ONLY = /^\s*[•▪◦●■□–-]\s*$/;

// A gap wider than this (times the font size) separates columns, e.g. table cells.
// Normal word spacing, even in justified text, stays well below it.
export const COLUMN_GAP = 1.2;

/**
 * Groups text pieces into lines in reading order (top to bottom, left to right), and
 * splits each line into cells wherever there is a column-sized gap. Space-only pieces
 * are ignored: they are spacing (PDF.js even stretches one " " across a whole table
 * gap), and real distances decide where spaces go.
 */
export function layoutLines(items: TextItem[]): LayoutLine[] {
  const pieces = items.filter((i) => i.str.trim().length > 0);
  const sorted = [...pieces].sort((p, q) => p.y - q.y || p.x - q.x);

  // Pieces whose baselines are within about a third of the font size share a line.
  const groups: TextItem[][] = [];
  for (const item of sorted) {
    const group = groups[groups.length - 1];
    const ref = group?.[0];
    if (ref && Math.abs(item.y - ref.y) <= Math.max(ref.size, item.size) * 0.35) group.push(item);
    else groups.push([item]);
  }

  return groups.map((group) => {
    group.sort((p, q) => p.x - q.x);
    const cells: Cell[] = [];
    for (const item of group) {
      const str = item.str.replace(SYMBOL_BULLETS, "•");
      const cell = cells[cells.length - 1];
      const gap = cell ? item.x - cell.end : Infinity;
      // A bullet on its own is a list marker, not a column, however wide its indent.
      const afterBullet = cell !== undefined && BULLET_ONLY.test(cell.text);
      if (cell && (gap <= item.size * COLUMN_GAP || afterBullet)) {
        const needsSpace = gap > item.size * 0.2 && !cell.text.endsWith(" ") && !str.startsWith(" ");
        cell.text += (needsSpace ? " " : "") + str;
        cell.end = Math.max(cell.end, item.x + item.width);
      } else {
        cells.push({ text: str, x: item.x, end: item.x + item.width });
      }
    }
    for (const c of cells) c.text = c.text.trim();
    return { y: group[0].y, size: Math.max(...group.map((i) => i.size)), cells };
  });
}
