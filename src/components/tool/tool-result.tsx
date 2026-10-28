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

  return (
    <div className="flex flex-col gap-5 rounded-panel border border-success/25 bg-success-soft/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-6 shrink-0 text-success" aria-hidden="true" />
          <div className="flex flex-col">
            <strong className="text-[17px]">{single ? "Your PDF is ready" : `${outputs.length} PDFs are ready`}</strong>
            <span className="text-sm text-muted">
              {single
                ? `${single.name} · ${single.pageCount} page${single.pageCount > 1 ? "s" : ""} · ${formatSize(single.bytes.length)}`
                : `${formatSize(totalSize)} in total`}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => (single ? downloadBytes(single.bytes, single.name) : downloadBytes(zipFiles(outputs), zipName, "application/zip"))}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-strong"
        >
          <Download className="size-4" aria-hidden="true" />
          {single ? "Download PDF" : "Download all (ZIP)"}
        </button>
      </div>

      {single ? (
        <ResultPreview output={single} />
      ) : (
        <ul className="flex flex-col gap-2">
          {outputs.map((o) => (
            <li key={o.name} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{o.name}</span>
              <span className="shrink-0 text-xs text-subtle">
                {o.pageCount} page{o.pageCount > 1 ? "s" : ""} · {formatSize(o.bytes.length)}
              </span>
              <button
                type="button"
                onClick={() => downloadBytes(o.bytes, o.name)}
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
