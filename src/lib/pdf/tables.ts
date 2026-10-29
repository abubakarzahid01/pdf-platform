import type { TextItem } from "./text-items";
import { layoutLines, type LayoutLine } from "./text-layout";

export type Table = { page: number; rows: string[][] };

// Rows further apart than this (times the font size) belong to different tables.
const MAX_ROW_GAP = 3;

/**
 * Finds tables on a page from where words sit: a table is two or more consecutive lines
 * that each have at least two columns. Columns are found by horizontal overlap across
 * rows, so left-aligned text and right-aligned numbers in the same column line up.
 */
export function detectTables(items: TextItem[], page: number): Table[] {
  const lines = layoutLines(items);
  const tables: Table[] = [];
  let run: LayoutLine[] = [];

  const finish = () => {
    if (run.length >= 2) tables.push({ page, rows: toRows(run) });
    run = [];
  };

  for (const line of lines) {
    const previous = run[run.length - 1];
    const multiColumn = line.cells.length >= 2;
    const close = previous ? line.y - previous.y <= Math.max(line.size, previous.size) * MAX_ROW_GAP : true;
    if (multiColumn && close) run.push(line);
    else {
      finish();
      if (multiColumn) run.push(line);
    }
  }
  finish();
  return tables;
}

// Merges every cell's horizontal span; each merged span is one column.
function toRows(lines: LayoutLine[]): string[][] {
  const spans = lines.flatMap((l) => l.cells.map((c) => [c.x, c.end] as [number, number])).sort((a, b) => a[0] - b[0]);
  const columns: [number, number][] = [];
  for (const [x, end] of spans) {
    const last = columns[columns.length - 1];
    if (last && x <= last[1]) last[1] = Math.max(last[1], end);
    else columns.push([x, end]);
  }

  return lines.map((line) => {
    const row = columns.map(() => "");
    for (const cell of line.cells) {
      const centre = (cell.x + cell.end) / 2;
      let index = columns.findIndex(([x, end]) => centre >= x && centre <= end);
      if (index < 0) index = columns.findIndex(([x]) => x > centre) - 1;
      if (index < 0) index = columns.length - 1;
      row[index] = row[index] ? `${row[index]} ${cell.text}` : cell.text;
    }
    return row;
  });
}

/** All lines of a page as single-cell rows, used when no tables are found. */
export function linesAsRows(items: TextItem[]): string[][] {
  return layoutLines(items).map((l) => [l.cells.map((c) => c.text).join(" ")]);
}
