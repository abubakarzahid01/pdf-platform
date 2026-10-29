"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Download } from "lucide-react";
import { downloadBytes, zipFiles } from "@/lib/files/download";
import { closePdf, loadPdfJs, type PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import type { OutputFile } from "@/lib/pdf/operations/types";
import { formatSize } from "@/components/selected-files";
import { PdfPageCanvas } from "@/components/pdf/pdf-page-canvas";

const PREVIEW_PAGES = 6;

type Props = {
  outputs: OutputFile[];
  zipName: string;
  onBack: () => void;
  onReset: () => void;
};

type Verified = { state: "checking" } | { state: "ok"; pdf: PDFDocumentProxy } | { state: "failed" };

export function ToolResult({ outputs, zipName, onBack, onReset }: Props) {
  const single = outputs.length === 1 ? outputs[0] : null;
  const totalSize = outputs.reduce((n, o) => n + o.bytes.length, 0);
  // Outputs that aren't PDFs (text, spreadsheets) get their own preview and wording.
  const isText = single?.mime?.startsWith("text/plain");
  const format = single?.mime ? fileFormat(single.mime) : null;
  const kind = format ? format.kind : "PDF";
  const allPdf = outputs.every((o) => !o.mime);
  const firstNote = outputs.find((o) => o.note)?.note;
  const tablePreview = outputs.find((o) => o.table)?.table;

  return (
    <div className="flex flex-col gap-5 rounded-panel border border-success/25 bg-success-soft/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-6 shrink-0 text-success" aria-hidden="true" />
          <div className="flex flex-col">
            <strong className="text-[17px]">
              {single?.unchanged
                ? "No changes needed"
                : single
                  ? `Your ${kind} is ready`
                  : `${outputs.length} ${allPdf ? "PDFs" : "files"} are ready`}
            </strong>
            <span className="text-sm text-muted">
              {single
                ? `${single.name} · ${single.pageCount} page${single.pageCount > 1 ? "s" : ""} · ${formatSize(single.bytes.length)}`
                : `${formatSize(totalSize)} in total`}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            single ? downloadBytes(single.bytes, single.name, single.mime) : downloadBytes(zipFiles(outputs), zipName, "application/zip")
          }
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-strong"
        >
          <Download className="size-4" aria-hidden="true" />
          {single?.unchanged ? "Download original" : single ? `Download ${format ? format.label : "PDF"}` : "Download all (ZIP)"}
        </button>
      </div>

      {firstNote && <p className="text-sm text-ink-soft">{firstNote}</p>}

      {tablePreview && <TablePreview rows={tablePreview} />}

      {single && isText ? (
        <TextPreview output={single} />
      ) : single && !single.mime ? (
        <ResultPreview output={single} />
      ) : single ? null : (
        <ul className="flex flex-col gap-2">
          {outputs.map((o) => (
            <li key={o.name} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{o.name}</span>
              <span className="shrink-0 text-xs text-subtle">
                {o.mime ? "" : `${o.pageCount} page${o.pageCount > 1 ? "s" : ""} · `}
                {formatSize(o.bytes.length)}
              </span>
              <button
                type="button"
                onClick={() => downloadBytes(o.bytes, o.name, o.mime)}
                aria-label={`Download ${o.name}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-brand-strong hover:bg-brand-soft"
              >
                <Download className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-4 text-sm font-semibold">
        <button type="button" onClick={onBack} className="text-brand-strong hover:text-brand">
          ← Change options
        </button>
        <button type="button" onClick={onReset} className="text-subtle hover:text-ink">
          Start over with new files
        </button>
      </div>
    </div>
  );
}

function fileFormat(mime: string) {
  if (mime.startsWith("text/plain")) return { kind: "text file", label: "TXT" };
  if (mime.startsWith("text/csv")) return { kind: "CSV file", label: "CSV" };
  if (mime.includes("spreadsheetml")) return { kind: "Excel file", label: "Excel" };
  return { kind: "file", label: "file" };
}

// The first rows of the first table found, as they'll appear in the spreadsheet.
function TablePreview({ rows }: { rows: string[][] }) {
  const width = Math.max(...rows.map((r) => r.length));
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className={r === 0 ? "bg-surface-soft font-semibold" : ""}>
              {Array.from({ length: width }, (_, c) => (
                <td key={c} className="whitespace-nowrap border-b border-r border-line-soft px-3 py-1.5 text-ink">
                  {row[c] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TEXT_PREVIEW_CHARS = 4000;

// The start of a text result, as it will appear in the downloaded file.
function TextPreview({ output }: { output: OutputFile }) {
  const text = new TextDecoder().decode(output.bytes);
  const shown = text.slice(0, TEXT_PREVIEW_CHARS);
  return (
    <div className="flex flex-col gap-2">
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-surface p-4 font-mono text-[13px] leading-relaxed text-ink">
        {shown || "(no text)"}
      </pre>
      {text.length > shown.length && (
        <p className="text-[13px] text-subtle">Showing the first {TEXT_PREVIEW_CHARS.toLocaleString("en-GB")} characters. The download has everything.</p>
      )}
    </div>
  );
}

// Re-opens the output with PDF.js: proves it is a valid PDF and shows its real pages.
function ResultPreview({ output }: { output: OutputFile }) {
  const [verified, setVerified] = useState<Verified>({ state: "checking" });

  useEffect(() => {
    let pdf: PDFDocumentProxy | undefined;
    let cancelled = false;
    loadPdfJs()
      // PDF.js takes ownership of the buffer it is given, so pass a copy.
      .then((pdfjs) => pdfjs.getDocument({ data: output.bytes.slice() }).promise)
      .then((doc) => {
        pdf = doc;
        if (cancelled) closePdf(doc);
        else setVerified(doc.numPages === output.pageCount ? { state: "ok", pdf: doc } : { state: "failed" });
      })
      .catch(() => {
        if (!cancelled) setVerified({ state: "failed" });
      });
    return () => {
      cancelled = true;
      closePdf(pdf);
    };
  }, [output]);

  if (verified.state === "checking") return <p className="text-sm text-subtle">Checking the result…</p>;
  if (verified.state === "failed") {
    return (
      <p role="alert" className="flex items-center gap-2 text-sm text-danger">
        <AlertCircle className="size-4" aria-hidden="true" /> The result couldn&apos;t be verified. Please try again.
      </p>
    );
  }

  const shown = Math.min(verified.pdf.numPages, PREVIEW_PAGES);
  return (
    <>
      <div className="flex items-start gap-4 overflow-x-auto pb-2">
        {Array.from({ length: shown }, (_, i) => i + 1).map((n) => (
          <div key={n} className="flex shrink-0 flex-col items-center gap-2">
            <PdfPageCanvas pdf={verified.pdf} pageNumber={n} width={112} className="rounded shadow-[0_1px_3px_rgb(21_19_43/0.15)]" />
            <span className="text-xs text-muted">Page {n}</span>
          </div>
        ))}
      </div>
      {verified.pdf.numPages > shown && (
        <p className="text-[13px] text-subtle">
          Showing the first {shown} of {verified.pdf.numPages} pages.
        </p>
      )}
    </>
  );
}
