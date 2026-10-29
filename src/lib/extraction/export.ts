import { buildCsv, buildXlsx, parseCell, type SheetCell } from "../files/spreadsheet";
import { cellStatus, fieldOrder, type ExtractedRow } from "./validate";

// A plain-language status for each row, so problems stay visible in the exported file.
export function rowStatus(row: ExtractedRow) {
  const problems = fieldOrder.flatMap((f) => {
    const s = cellStatus(row, f.key);
    if (s === "missing") return [`${f.label} missing`];
    if (s === "low") return [`${f.label} unsure`];
    if (s === "mismatch") return ["totals don't add up"];
    return [];
  });
  if (row.scanned) return "No text found (scanned?)";
  if (problems.length) return `Check: ${problems.join(", ")}`;
  return row.verified ? "Verified" : "OK";
}

const header = ["File", "Page", ...fieldOrder.map((f) => f.label), "Status"];

function table(rows: ExtractedRow[]) {
  return rows.map((r) => [r.fileName, String(r.page), ...fieldOrder.map((f) => r.values[f.key]), rowStatus(r)]);
}

export function invoicesToXlsx(rows: ExtractedRow[]) {
  const numeric = new Set(fieldOrder.flatMap((f, i) => (f.numeric ? [i + 2] : [])));
  const body: SheetCell[][] = table(rows).map((r) => r.map((v, i) => (numeric.has(i) || i === 1 ? parseCell(v) : v)));
  return buildXlsx([{ name: "Invoices", headerRow: true, rows: [header, ...body] }]);
}

export function invoicesToCsv(rows: ExtractedRow[]) {
  return buildCsv([header, ...table(rows)]);
}
