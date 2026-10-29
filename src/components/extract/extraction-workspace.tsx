"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, X } from "lucide-react";
import { limits } from "@/config/site";
import { Logo } from "@/components/logo";
import { FileDropzone } from "@/components/file-dropzone";
import { PdfPageCanvas } from "@/components/pdf/pdf-page-canvas";
import { checkFile } from "@/lib/files/check-file";
import { downloadBytes } from "@/lib/files/download";
import { clearPendingFiles, peekPendingFiles } from "@/lib/files/pending-document";
import { closePdf, loadPdfJs, type PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { readTextItems } from "@/lib/pdf/text-items";
import { extractInvoice } from "@/lib/extraction/invoice";
import { invoicesToCsv, invoicesToXlsx } from "@/lib/extraction/export";
import {
  cellStatus,
  fieldOrder,
  rowIssues,
  summarise,
  totalsBalance,
  type CellStatus,
  type ExtractedRow,
  type InvoiceField,
} from "@/lib/extraction/validate";

const cellStyles: Record<CellStatus, string> = {
  ok: "bg-transparent text-ink",
  missing: "bg-warn-soft text-warn placeholder:text-warn placeholder:font-semibold",
  low: "bg-info-soft text-info-strong font-medium",
  mismatch: "bg-danger-soft text-danger font-semibold",
};

const statusTitles: Record<CellStatus, string> = {
  ok: "",
  missing: "Not found in the document",
  low: "Unsure: please check against the source",
  mismatch: "Subtotal + VAT does not equal Total",
};

type Doc = {
  id: string;
  file: File;
  state: "reading" | "done" | "error";
  message?: string;
  pdf?: PDFDocumentProxy;
};

let nextId = 1;

function fileStatus(doc: Doc, row: ExtractedRow | undefined) {
  if (doc.state === "reading") return { text: "Reading…", className: "text-subtle", bg: "" };
  if (doc.state === "error" || !row) return { text: "Can't read", className: "text-danger", bg: "bg-[#fff7f7]" };
  if (row.scanned) return { text: "No text", className: "text-warn", bg: "bg-[#fffbf3]" };
  const issues = rowIssues(row);
  if (issues.includes("mismatch")) return { text: `${issues.length} issue${issues.length > 1 ? "s" : ""}`, className: "text-danger", bg: "bg-[#fff7f7]" };
  if (issues.includes("missing")) return { text: `${issues.filter((i) => i === "missing").length} missing`, className: "text-warn", bg: "bg-[#fffbf3]" };
  if (issues.includes("low")) return { text: "Check", className: "text-info-strong", bg: "bg-[#f4f8ff]" };
  return { text: row.verified ? "Verified" : "Done", className: "text-success", bg: "" };
}

export function ExtractionWorkspace() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [rows, setRows] = useState<ExtractedRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const docsRef = useRef(docs);

  useEffect(() => {
    docsRef.current = docs;
  }, [docs]);

  // Free the opened PDFs when leaving the page.
  useEffect(() => () => docsRef.current.forEach((d) => closePdf(d.pdf)), []);

  async function addFiles(files: File[]) {
    setNotice(null);
    const room = limits.free.maxFilesPerTask - docsRef.current.length;
    if (files.length > room) setNotice(`Up to ${limits.free.maxFilesPerTask} files at a time. ${files.length - Math.max(room, 0)} file(s) weren't added.`);
    const added: Doc[] = files.slice(0, Math.max(room, 0)).map((file) => ({ id: `doc-${nextId++}`, file, state: "reading" }));
    if (!added.length) return;
    setDocs((prev) => [...prev, ...added]);
    setSelectedId((s) => s ?? added[0].id);

    const pdfjs = await loadPdfJs();
    for (const doc of added) {
      const result = await checkFile(doc.file, ["pdf"], "a PDF");
      if (!result.ok || !result.pdf) {
        setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, state: "error", message: result.ok ? "This file couldn't be opened." : result.message } : d)));
        continue;
      }
      try {
        const row = extractInvoice(await readTextItems(result.pdf, pdfjs.Util.transform), doc.file.name, doc.id);
        setRows((prev) => [...prev, row]);
        setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, state: "done", pdf: result.pdf } : d)));
      } catch {
        closePdf(result.pdf);
        setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, state: "error", message: "The text in this PDF couldn't be read." } : d)));
      }
    }
  }

  // Files chosen on the AI Data Extraction tool page arrive here. Processing starts on the
  // next tick and the hand-over is cleared only then, so React's development double-run
  // of effects can't drop the files.
  useEffect(() => {
    const files = peekPendingFiles();
    if (!files.length) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      clearPendingFiles(files);
      addFiles(files);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function removeDoc(id: string) {
    const doc = docs.find((d) => d.id === id);
    closePdf(doc?.pdf);
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (selectedId === id) setSelectedId(docs.find((d) => d.id !== id)?.id ?? null);
  }

  function updateValue(id: string, field: InvoiceField, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, values: { ...r.values, [field]: value } } : r)));
  }

  function markVerified(id: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, verified: true } : r)));
  }

  const ordered = docs.flatMap((d) => rows.filter((r) => r.id === d.id));
  const selectedDoc = docs.find((d) => d.id === selectedId);
  const selectedRow = rows.find((r) => r.id === selectedId);
  const summary = summarise(ordered);
  const reading = docs.some((d) => d.state === "reading");
  const stage = docs.length === 0 ? 0 : ordered.length === 0 ? 1 : 2;
  const steps = [
    { label: "Upload", state: stage > 0 ? "done" : "current" },
    { label: "Extract", state: stage > 1 ? "done" : stage === 1 ? "current" : "todo" },
    { label: "Review", state: stage === 2 ? "current" : "todo" },
    { label: "Export", state: "todo" },
  ];

  return (
    <div className="min-h-dvh bg-[#f7f7fb] text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3.5">
            <Logo />
            <span className="text-[#c5c3d3]" aria-hidden="true">/</span>
            <strong className="text-[15px] font-semibold">Smart Extraction</strong>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-strong">PRO</span>
          </div>
          <ol aria-label="Progress" className="flex flex-wrap gap-2 text-[13px]">
            {steps.map((s, i) => (
              <li
                key={s.label}
                aria-current={s.state === "current" ? "step" : undefined}
                className={`rounded-full px-3 py-1.5 ${
                  s.state === "done" ? "bg-success-soft font-semibold text-success" : s.state === "current" ? "bg-ink font-semibold text-white" : "bg-[#f2f2f7] font-medium text-muted"
                }`}
              >
                {s.state === "done" ? "✓" : i + 1} {s.label}
              </li>
            ))}
          </ol>
        </div>
      </header>

      {docs.length === 0 ? (
        <main className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-14 text-center sm:px-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight">Extract invoice data into one spreadsheet</h1>
            <p className="text-muted">
              Add up to {limits.free.maxFilesPerTask} invoices. Supplier, invoice number, date, subtotal, VAT and total are read from each one,
              with the page they came from. Missing or unclear values are flagged for you to check, never guessed.
            </p>
          </div>
          <div className="rounded-3xl bg-surface p-2.5 shadow-raised">
            <FileDropzone onFiles={addFiles} accept=".pdf,application/pdf" multiple hint={`PDF invoices · up to ${limits.free.maxFileSizeMb} MB each`} />
          </div>
          <p className="text-[13px] text-subtle">Your invoices are read in your browser and aren&apos;t uploaded anywhere.</p>
          {notice && <p className="text-sm text-warn">{notice}</p>}
        </main>
      ) : (
        <div className="mx-auto flex max-w-[1360px] flex-wrap gap-6 px-4 py-7 sm:px-6">
          <aside className="flex w-full flex-col gap-5 lg:w-[360px] lg:shrink-0">
            <section className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-surface p-5">
              <div className="flex items-center justify-between">
                <strong className="text-[15px]">Documents ({docs.length})</strong>
                <label className="cursor-pointer text-[13px] font-semibold text-brand-strong hover:text-brand">
                  + Add more
                  <input
                    type="file"
                    multiple
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      addFiles(Array.from(e.target.files ?? []));
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {notice && <p className="text-[13px] text-warn">{notice}</p>}
              <ul className="flex flex-col gap-1">
                {docs.map((d) => {
                  const row = rows.find((r) => r.id === d.id);
                  const status = fileStatus(d, row);
                  return (
                    <li key={d.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedId(d.id)}
                        className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2.5 text-left ${status.bg} ${selectedId === d.id ? "ring-2 ring-brand-ring" : ""}`}
                      >
                        <span className="flex h-[42px] w-[34px] shrink-0 items-center justify-center rounded-md border border-line bg-[#f2f1f8] text-[9px] font-bold text-[#b42318]">PDF</span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">{d.file.name}</span>
                          <span className={`truncate text-xs ${d.state === "error" ? "text-danger" : "text-subtle"}`}>
                            {d.state === "error" ? d.message : row ? `Values from page ${row.page}` : "Reading the text…"}
                          </span>
                        </span>
                        {d.state === "reading" ? (
                          <Loader2 className="size-4 shrink-0 animate-spin text-subtle" aria-label="Reading" />
                        ) : (
                          <span className={`whitespace-nowrap text-xs font-semibold ${status.className}`}>{status.text}</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeDoc(d.id)}
                        aria-label={`Remove ${d.file.name}`}
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-subtle hover:bg-surface-soft hover:text-ink"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-5">
              <strong className="text-[15px]">Fields extracted</strong>
              <div className="flex flex-wrap gap-1.5">
                {fieldOrder.map((f) => (
                  <span key={f.key} className="rounded-full bg-brand-soft px-2.5 py-1.5 text-[13px] font-semibold text-brand-strong">
                    {f.label}
                  </span>
                ))}
              </div>
              <p className="text-[13px] text-subtle">
                Values are found from labels such as “Invoice number”, “Date”, “VAT” and “Total”. Describing other fields in your own words comes with
                the AI assistant in Phase 7.
              </p>
            </section>
          </aside>

          <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <h1 className="font-display text-[28px] font-bold tracking-tight">Review extracted data</h1>
                <p className="text-[15px] text-muted">Click any cell to correct it. Coloured cells need a check before you rely on them.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!ordered.length || reading}
                  onClick={() => downloadBytes(invoicesToCsv(ordered), "extracted-invoices.csv", "text/csv;charset=utf-8")}
                  className="rounded-[10px] border border-line bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-surface-soft disabled:opacity-50"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  disabled={!ordered.length || reading}
                  onClick={() => downloadBytes(invoicesToXlsx(ordered), "extracted-invoices.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
                  className="rounded-[10px] bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-soft disabled:opacity-50"
                >
                  Export Excel
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1 rounded-[18px] border border-line bg-surface p-4">
                <span className="text-[13px] text-subtle">Values found</span>
                <strong className="font-display text-[22px]">
                  {summary.filled} of {summary.cells}
                </strong>
              </div>
              <div className={`flex flex-col gap-1 rounded-[18px] border p-4 ${summary.needReview > 0 ? "border-[#f5d9a8] bg-[#fffbf3]" : "border-line bg-surface"}`}>
                <span className={`text-[13px] ${summary.needReview > 0 ? "text-warn" : "text-subtle"}`}>Need review</span>
                <strong className={`font-display text-[22px] ${summary.needReview > 0 ? "text-warn" : "text-success"}`}>
                  {ordered.length === 0 ? "—" : summary.needReview === 0 ? "All clear" : `${summary.needReview} value${summary.needReview > 1 ? "s" : ""}`}
                </strong>
              </div>
              <div className="flex flex-col gap-1 rounded-[18px] border border-line bg-surface p-4">
                <span className="text-[13px] text-subtle">Totals check</span>
                <strong className="font-display text-[22px]">
                  {summary.balanced} of {summary.rows} balance
                </strong>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[18px] border border-line bg-surface">
              <table className="w-full min-w-[920px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap border-b border-line-soft bg-surface-soft px-3.5 py-3 text-left text-xs font-semibold text-subtle">Source</th>
                    {fieldOrder.map((f) => (
                      <th key={f.key} className={`whitespace-nowrap border-b border-line-soft bg-surface-soft px-3.5 py-3 text-xs font-semibold text-subtle ${f.numeric ? "text-right" : "text-left"}`}>
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordered.length === 0 && (
                    <tr>
                      <td colSpan={fieldOrder.length + 1} className="px-4 py-8 text-center text-sm text-subtle">
                        {reading ? "Reading your invoices…" : "No readable invoices yet."}
                      </td>
                    </tr>
                  )}
                  {ordered.map((r) => (
                    <tr key={r.id} className={selectedId === r.id ? "bg-brand-soft/40" : ""}>
                      <td className="max-w-[180px] border-b border-[#f3f2f8] px-3.5 py-2">
                        <button type="button" onClick={() => setSelectedId(r.id)} className="block max-w-full truncate font-medium text-brand-strong hover:text-brand" title={r.fileName}>
                          {r.fileName.replace(/\.pdf$/i, "")} · p.{r.page}
                        </button>
                      </td>
                      {fieldOrder.map((f) => {
                        const status = cellStatus(r, f.key);
                        return (
                          <td key={f.key} className="border-b border-[#f3f2f8] p-1">
                            <input
                              value={r.values[f.key]}
                              onChange={(e) => updateValue(r.id, f.key, e.target.value)}
                              onFocus={() => setSelectedId(r.id)}
                              placeholder={status === "missing" ? "Missing" : undefined}
                              title={statusTitles[status] || undefined}
                              aria-label={`${f.label} for ${r.fileName}`}
                              aria-invalid={status === "missing" || status === "mismatch" ? true : undefined}
                              className={`w-full rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-brand ${f.key === "supplier" ? "min-w-[180px]" : "min-w-[96px]"} ${f.numeric ? "text-right" : ""} ${cellStyles[status]}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="flex flex-wrap gap-4 text-[13px] text-muted">
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded-[3px] border border-[#f5d9a8] bg-warn-soft" /> Missing: not found in the document
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded-[3px] border border-[#bfd3fa] bg-info-soft" /> Unsure: please check
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded-[3px] border border-[#f5c2c2] bg-danger-soft" /> Subtotal + VAT ≠ Total
              </li>
            </ul>

            {selectedDoc?.state === "error" && (
              <p role="alert" className="flex items-center gap-2 rounded-[14px] border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" /> {selectedDoc.file.name}: {selectedDoc.message}
              </p>
            )}
            {selectedRow && selectedDoc?.pdf && <SourcePreview row={selectedRow} pdf={selectedDoc.pdf} onVerify={() => markVerified(selectedRow.id)} />}
          </main>
        </div>
      )}
    </div>
  );
}

function SourcePreview({ row, pdf, onVerify }: { row: ExtractedRow; pdf: PDFDocumentProxy; onVerify: () => void }) {
  const issues = rowIssues(row);
  const balance = totalsBalance(row);
  const canVerify = row.lowConfidence.length > 0 && !row.verified;

  let explanation = "All values were found in the document and the totals add up.";
  if (row.scanned) {
    explanation = "No text was found in this PDF. It may be a scanned image; text recognition (OCR) comes later in this phase. You can type the values in yourself.";
  } else if (issues.includes("missing")) {
    const missing = fieldOrder.filter((f) => cellStatus(row, f.key) === "missing").map((f) => f.label);
    explanation = `${missing.join(", ")} ${missing.length > 1 ? "weren't" : "wasn't"} found. Type ${missing.length > 1 ? "them" : "it"} in if you can see ${missing.length > 1 ? "them" : "it"} in the document, or leave blank. Nothing is guessed.`;
  } else if (balance === false) {
    explanation = "Subtotal plus VAT doesn't equal the total on this invoice. Check which figure is wrong, on the invoice itself or in what was read.";
  } else if (canVerify) {
    const unsure = row.lowConfidence.map((k) => fieldOrder.find((f) => f.key === k)?.label).join(" and ");
    const reasons = [
      row.lowConfidence.includes("date") && "The date could be read two ways (day/month or month/day).",
      row.lowConfidence.includes("supplier") && "The supplier wasn't labelled, so it was taken from the heading.",
    ].filter(Boolean);
    explanation = `${unsure} ${row.lowConfidence.length > 1 ? "need" : "needs"} a check. ${reasons.join(" ")} Compare with the page, then mark as verified.`;
  } else if (row.verified) {
    explanation = "You checked this row against the document.";
  }

  return (
    <section aria-label="Source preview" className="flex flex-wrap items-start gap-5 rounded-[18px] border border-line bg-surface p-5">
      <div className="shrink-0 overflow-hidden rounded-lg border border-line">
        <PdfPageCanvas pdf={pdf} pageNumber={row.page} width={150} />
      </div>
      <div className="flex min-w-60 flex-1 flex-col gap-1.5">
        <strong className="text-sm">
          Source · {row.fileName}, page {row.page}
        </strong>
        <span className="text-sm text-muted">{explanation}</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {row.verified ? (
            <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-success-soft px-3 py-2 text-[13px] font-semibold text-success">
              <Check className="size-4" aria-hidden="true" /> Verified
            </span>
          ) : (
            <button
              type="button"
              onClick={onVerify}
              disabled={!canVerify}
              className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] font-semibold hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              Mark as verified
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
