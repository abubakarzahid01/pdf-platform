// Validation rules for extracted invoice data. Pure functions so they can be
// reused unchanged when real extraction arrives (Phase 6).

export type InvoiceField = "supplier" | "invoiceNo" | "date" | "subtotal" | "vat" | "total";

export type ExtractedRow = {
  id: string;
  fileName: string;
  page: number;
  scanned: boolean;
  // Read from a scanned image with text recognition (OCR), not from real PDF text.
  ocr?: boolean;
  values: Record<InvoiceField, string>;
  // Fields the extractor was unsure about. Never shown as verified until a person confirms.
  lowConfidence: InvoiceField[];
  verified: boolean;
};

export type CellStatus = "ok" | "missing" | "low" | "mismatch";

export const fieldOrder: { key: InvoiceField; label: string; numeric: boolean }[] = [
  { key: "supplier", label: "Supplier", numeric: false },
  { key: "invoiceNo", label: "Invoice no.", numeric: false },
  { key: "date", label: "Date", numeric: false },
  { key: "subtotal", label: "Subtotal", numeric: true },
  { key: "vat", label: "VAT", numeric: true },
  { key: "total", label: "Total", numeric: true },
];

// "£1,033.33" -> 1033.33. Returns null when no number can be read.
export function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// True when subtotal + VAT equals total (to the penny); null when it cannot be checked.
export function totalsBalance(row: ExtractedRow): boolean | null {
  const subtotal = parseAmount(row.values.subtotal);
  const vat = parseAmount(row.values.vat);
  const total = parseAmount(row.values.total);
  if (subtotal === null || vat === null || total === null) return null;
  return Math.abs(subtotal + vat - total) < 0.005;
}

export function cellStatus(row: ExtractedRow, field: InvoiceField): CellStatus {
  if (!row.values[field].trim()) return "missing";
  if (field === "total" && totalsBalance(row) === false) return "mismatch";
  if (!row.verified && row.lowConfidence.includes(field)) return "low";
  return "ok";
}

export function rowIssues(row: ExtractedRow) {
  return fieldOrder.map((f) => cellStatus(row, f.key)).filter((s) => s !== "ok");
}

export function summarise(rows: ExtractedRow[]) {
  const cells = rows.length * fieldOrder.length;
  const filled = rows.reduce((n, r) => n + fieldOrder.filter((f) => r.values[f.key].trim()).length, 0);
  const needReview = rows.reduce((n, r) => n + rowIssues(r).length, 0);
  const balanced = rows.filter((r) => totalsBalance(r) === true).length;
  return { cells, filled, needReview, balanced, rows: rows.length };
}
