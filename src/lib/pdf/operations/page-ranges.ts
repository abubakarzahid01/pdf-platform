// Parses page selections like "1-3, 5, 8-10" (1-based, inclusive).

export type PageRange = { start: number; end: number };

export type ParseResult = { ok: true; ranges: PageRange[] } | { ok: false; message: string };

export function parsePageRanges(input: string, pageCount: number): ParseResult {
  const parts = input
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { ok: false, message: "Enter the pages you want, for example 1-3, 5." };

  const ranges: PageRange[] = [];
  for (const part of parts) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!match) return { ok: false, message: `“${part}” isn't a page or range. Use numbers like 4 or 2-6.` };
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (start < 1 || end < 1) return { ok: false, message: "Page numbers start at 1." };
    if (start > end) return { ok: false, message: `In “${part}”, the first page must come before the last.` };
    if (end > pageCount) {
      return { ok: false, message: `Page ${end} doesn't exist. This PDF has ${pageCount} page${pageCount > 1 ? "s" : ""}.` };
    }
    ranges.push({ start, end });
  }
  return { ok: true, ranges };
}

// Zero-based page indices covered by the ranges, in order, without duplicates.
export function rangesToIndices(ranges: PageRange[]) {
  const seen = new Set<number>();
  const indices: number[] = [];
  for (const { start, end } of ranges) {
    for (let p = start; p <= end; p++) {
      if (!seen.has(p)) {
        seen.add(p);
        indices.push(p - 1);
      }
    }
  }
  return indices;
}
