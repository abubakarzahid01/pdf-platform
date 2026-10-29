import { buildCsv, buildXlsx, parseCell, type Sheet } from "../../files/spreadsheet";
import { detectTables, linesAsRows, type Table } from "../tables";
import { pageText, scannedNote, type TextItemReader } from "./pdf-to-text";
import { baseName, type InputPdf, type OutputFile } from "./types";

export type SpreadsheetFormat = "xlsx" | "csv";
export type TableLayout = "per-table" | "single";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CSV_MIME = "text/csv;charset=utf-8";
const PREVIEW_ROWS = 12;

/**
 * Finds tables in a PDF and saves them as Excel or CSV. With "per-table" each table gets
 * its own sheet (or CSV file); with "single" they are stacked in one, a blank row apart.
 * When no tables are found, every line of text goes into one column so nothing is lost.
 */
export async function pdfToSpreadsheet(
  input: InputPdf,
  format: SpreadsheetFormat,
  layout: TableLayout,
  readItems: TextItemReader,
): Promise<OutputFile[]> {
  const pages = await readItems(input.bytes);
  const base = baseName(input.name);
  const tables: Table[] = pages.flatMap((p, i) => detectTables(p.items, i));
  const scanned = scannedNote(pages.map((p) => pageText(p.items)), "text recognition (OCR) is coming later in this phase");

  let groups: { label: string; rows: string[][]; header: boolean }[];
  let summary: string;
  if (tables.length > 0) {
    const perPage = new Map<number, number>();
    groups = tables.map((t) => {
      const n = (perPage.get(t.page) ?? 0) + 1;
      perPage.set(t.page, n);
      return { label: `Page ${t.page + 1} table ${n}`, rows: t.rows, header: true };
    });
    summary = `Found ${tables.length} table${tables.length > 1 ? "s" : ""}: ${tables
      .map((t, i) => `${groups[i].label.toLowerCase()} (${t.rows.length} rows × ${t.rows[0].length} columns)`)
      .join(", ")}. Check the result: table detection reads positions on the page and can merge or split columns.`;
  } else {
    const rows = pages.flatMap((p) => linesAsRows(p.items));
    groups = [{ label: "Text", rows, header: false }];
    summary = rows.length
      ? "No tables were detected, so every line of text was placed in one column, so nothing is lost."
      : "No text was found to put in a spreadsheet.";
  }

  if (layout === "single" && groups.length > 1) {
    const rows = groups.flatMap((g, i) => (i === 0 ? g.rows : [[], ...g.rows]));
    groups = [{ label: "Tables", rows, header: false }];
  }

  const note = [summary, scanned].filter(Boolean).join(" ");
  const preview = groups[0].rows.slice(0, PREVIEW_ROWS);

  if (format === "xlsx") {
    const sheets: Sheet[] = groups.map((g) => ({ name: g.label, headerRow: g.header, rows: g.rows.map((r, i) => r.map((c) => (g.header && i === 0 ? c : parseCell(c)))) }));
    return [{ name: `${base}.xlsx`, bytes: buildXlsx(sheets), pageCount: pages.length, mime: XLSX_MIME, note, table: preview }];
  }

  if (groups.length === 1) {
    return [{ name: `${base}.csv`, bytes: buildCsv(groups[0].rows), pageCount: pages.length, mime: CSV_MIME, note, table: preview }];
  }
  return groups.map((g, i) => ({
    name: `${base}-${g.label.toLowerCase().replace(/\s+/g, "-")}.csv`,
    bytes: buildCsv(g.rows),
    pageCount: pages.length,
    mime: CSV_MIME,
    note: i === 0 ? note : undefined,
    table: i === 0 ? preview : undefined,
  }));
}
