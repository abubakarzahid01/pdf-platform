import type { PageItems } from "../pdf/text-items";
import { layoutLines, type LayoutLine } from "../pdf/text-layout";
import type { ExtractedRow, InvoiceField } from "./validate";

// Reads invoice fields from text PDFs using labels ("Invoice number:", "Total", ...).
// Rules: a value is only taken when it is actually on the page; anything inferred
// without a clear label, or ambiguous (e.g. 11/09/2026), is marked low confidence;
// missing fields stay empty. Nothing is guessed.

type Found = { value: string; page: number; confident: boolean };
type Line = LayoutLine & { page: number; text: string };

const MONEY = /(?:([£$€])\s?)?(-?\d{1,3}(?:,\d{3})+(?:\.\d{2})?|-?\d+\.\d{2})(?:\s?(EUR|GBP|USD))?/;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function lineText(line: LayoutLine) {
  return line.cells.map((c) => c.text).join("  ");
}

// The text after a label: the rest of the same line, or the cell below it.
function afterLabel(lines: Line[], index: number, label: RegExp): string | null {
  const line = lines[index];
  const m = label.exec(line.text);
  if (!m) return null;
  const rest = line.text.slice(m.index + m[0].length).replace(/^[\s:#.-]+/, "").trim();
  if (rest) return rest;
  // Label on its own: look at the next line in the same column.
  const next = lines[index + 1];
  const labelCell = line.cells.find((c) => label.test(c.text));
  if (next && labelCell) {
    const below = next.cells.find((c) => c.end > labelCell.x && c.x < labelCell.end);
    if (below && next.y - line.y < line.size * 2.5) return below.text;
  }
  return null;
}

function money(text: string): string | null {
  // Prefer the last amount on the line (labels come first, totals last).
  const all = [...text.matchAll(new RegExp(MONEY.source, "g"))].filter((m) => m[1] || m[3] || m[2].includes("."));
  const m = all[all.length - 1];
  if (!m) return null;
  return `${m[1] ?? ""}${m[2]}${m[3] ? ` ${m[3]}` : ""}`;
}

// Normalises clear dates to YYYY-MM-DD; returns ambiguous ones as written.
export function parseDate(text: string): { value: string; clear: boolean } | null {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) return { value: iso[0], clear: true };
  const words = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/.exec(text);
  if (words) {
    const month = MONTHS.findIndex((m) => m.startsWith(words[2].toLowerCase().slice(0, 3)));
    if (month >= 0) return { value: `${words[3]}-${String(month + 1).padStart(2, "0")}-${words[1].padStart(2, "0")}`, clear: true };
  }
  const us = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/.exec(text);
  if (us) {
    const month = MONTHS.findIndex((m) => m.startsWith(us[1].toLowerCase().slice(0, 3)));
    if (month >= 0) return { value: `${us[3]}-${String(month + 1).padStart(2, "0")}-${us[2].padStart(2, "0")}`, clear: true };
  }
  const numeric = /\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/.exec(text);
  if (numeric) {
    const [a, b] = [Number(numeric[1]), Number(numeric[2])];
    // Only clear when one part can't be a month (e.g. 25/09/2026).
    return { value: numeric[0], clear: a > 12 || b > 12 || a === b };
  }
  return null;
}

const LABELS = {
  invoiceNo: /\b(?:invoice|inv)\.?\s*(?:no\.?|number|num\.?|#|id)\s*[:#]?/i,
  date: /\b(?:invoice\s+date|date\s+of\s+issue|issue\s+date|date)\b\s*:?/i,
  subtotal: /\b(?:sub[\s-]?total|net\s+(?:amount|total)|total\s+net|amount\s+before\s+tax)\b/i,
  vat: /\b(?:vat|tax|gst|sales\s+tax)\b(?!\s*(?:reg|no|number|id|#))/i,
  total: /\b(?:grand\s+total|total\s+due|amount\s+due|balance\s+due|total\s+amount|total)\b/i,
  supplier: /\b(?:supplier|from|seller|vendor|billed?\s+by)\s*:/i,
};

// OCR word confidence (0–100) below which a value is marked for checking.
export const OCR_SURE = 85;

// For text read by OCR: true when every word of the value, on or just below its label's
// line, was recognised confidently. Real PDF text has no confidence and always passes.
function ocrSure(page: PageItems, value: string, line: Line) {
  const words = page.items.filter(
    (i) => i.confidence !== undefined && i.str.trim() && value.includes(i.str.trim()) && i.y > line.y - line.size && i.y < line.y + line.size * 2.5,
  );
  return words.every((w) => (w.confidence ?? 100) >= OCR_SURE);
}

/** Extracts one invoice's fields from its pages. */
export function extractInvoice(pages: PageItems[], fileName: string, id: string): ExtractedRow {
  const lines: Line[] = pages.slice(0, 5).flatMap((p, page) => layoutLines(p.items).map((l) => ({ ...l, page, text: lineText(l) })));
  const found: Partial<Record<InvoiceField, Found>> = {};
  const take = (field: InvoiceField, value: string | null, page: number, confident: boolean, line?: Line) => {
    if (value && !found[field]) {
      const sure = confident && (!line || ocrSure(pages[page], value.trim(), line));
      found[field] = { value: value.trim(), page, confident: sure };
    }
  };

  lines.forEach((line, i) => {
    const t = line.text;
    // Invoice number: a labelled code, or a code right after a heading word "Invoice".
    const no = afterLabel(lines, i, LABELS.invoiceNo);
    const code = no && /^[A-Z0-9][A-Z0-9/-]*\d[A-Z0-9/-]*/i.exec(no);
    if (code) take("invoiceNo", code[0], line.page, true, line);
    const heading = /^\s*invoice\s+([A-Z]{1,5}[-/]?\d[\w/-]*)\b/i.exec(t);
    if (heading) take("invoiceNo", heading[1], line.page, true, line);

    const dateText = afterLabel(lines, i, LABELS.date);
    const date = dateText && parseDate(dateText);
    if (date) take("date", date.value, line.page, date.clear, line);

    // Amount lines: subtotal and VAT before total, so "Subtotal" isn't read as the total.
    if (LABELS.subtotal.test(t)) take("subtotal", money(afterLabel(lines, i, LABELS.subtotal) ?? ""), line.page, true, line);
    else if (LABELS.vat.test(t) && !/\b(?:reg|registration)\b/i.test(t)) take("vat", money(afterLabel(lines, i, LABELS.vat) ?? ""), line.page, true, line);
    else if (LABELS.total.test(t)) take("total", money(afterLabel(lines, i, LABELS.total) ?? ""), line.page, true, line);

    const supplier = afterLabel(lines, i, LABELS.supplier);
    if (supplier) take("supplier", supplier.split(/\s{2,}|·/)[0], line.page, true, line);
  });

  // No supplier label: the first prominent line that isn't the word "Invoice" is likely
  // the supplier's name, but it's an inference, so it's marked for checking.
  if (!found.supplier) {
    const candidate = lines
      .filter((l) => l.page === 0 && !/^\s*(tax\s+)?invoice\b/i.test(l.text) && /[A-Za-z]{3}/.test(l.text) && !MONEY.test(l.text))
      .sort((p, q) => q.size - p.size || p.y - q.y)[0];
    if (candidate) take("supplier", candidate.cells[0].text, candidate.page, false);
  }

  const values = { supplier: "", invoiceNo: "", date: "", subtotal: "", vat: "", total: "" } as Record<InvoiceField, string>;
  const lowConfidence: InvoiceField[] = [];
  for (const [field, f] of Object.entries(found) as [InvoiceField, Found][]) {
    values[field] = f.value;
    if (!f.confident) lowConfidence.push(field);
  }
  const page = found.total?.page ?? found.invoiceNo?.page ?? 0;
  const hasText = lines.length > 0;
  const ocr = pages.slice(0, 5).some((p) => p.ocr);
  return { id, fileName, page: page + 1, scanned: !hasText, ocr, values, lowConfidence, verified: false };
}
