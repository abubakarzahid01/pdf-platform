"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Logo } from "@/components/logo";
import { PrototypeBadge } from "@/components/prototype-badge";
import { sampleRows } from "@/components/extract/sample-data";
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
  low: "Low confidence: please check against the source",
  mismatch: "Subtotal + VAT does not equal Total",
};

const steps = [
  { label: "Upload", state: "done" },
  { label: "Describe", state: "done" },
  { label: "Review", state: "current" },
  { label: "Export", state: "todo" },
] as const;

function fileStatus(row: ExtractedRow) {
  const issues = rowIssues(row);
  if (issues.includes("mismatch")) return { text: `${issues.length} issue${issues.length > 1 ? "s" : ""}`, className: "text-danger", bg: "bg-[#fff7f7]" };
  if (issues.includes("missing")) return { text: `${issues.length} missing`, className: "text-warn", bg: "bg-[#fffbf3]" };
  if (issues.includes("low")) return { text: "Review", className: "text-info-strong", bg: "bg-[#f4f8ff]" };
  return { text: "Done", className: "text-success", bg: "" };
}

export function ExtractionWorkspace() {
  const [rows, setRows] = useState(sampleRows);
  const [selectedId, setSelectedId] = useState("inv-04");
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];
  const summary = summarise(rows);

  function updateValue(id: string, field: InvoiceField, value: string) {
    setRows(rows.map((r) => (r.id === id ? { ...r, values: { ...r.values, [field]: value } } : r)));
  }

  function markVerified(id: string) {
    setRows(rows.map((r) => (r.id === id ? { ...r, verified: true } : r)));
  }

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
                  s.state === "done"
                    ? "bg-success-soft font-semibold text-success"
                    : s.state === "current"
                      ? "bg-ink font-semibold text-white"
                      : "bg-[#f2f2f7] font-medium text-muted"
                }`}
              >
                {s.state === "done" ? "✓" : i + 1} {s.label}
              </li>
            ))}
          </ol>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1360px] flex-wrap gap-6 px-4 py-7 sm:px-6">
        {/* Left: documents and instruction */}
        <aside className="flex w-full flex-col gap-5 lg:w-[360px] lg:shrink-0">
          <section className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <strong className="text-[15px]">Documents ({rows.length})</strong>
              <PrototypeBadge label="Sample files" />
            </div>
            <ul className="flex flex-col gap-1">
              {rows.map((r) => {
                const status = fileStatus(r);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left ${status.bg} ${
                        selectedId === r.id ? "ring-2 ring-brand-ring" : ""
                      }`}
                    >
                      <span className="flex h-[42px] w-[34px] shrink-0 items-center justify-center rounded-md border border-line bg-[#f2f1f8] text-[9px] font-bold text-[#b42318]">
                        PDF
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{r.fileName}</span>
                        <span className="text-xs text-subtle">
                          Page {r.page} · {r.scanned ? "scanned · OCR" : "text"}
                        </span>
                      </span>
                      <span className={`whitespace-nowrap text-xs font-semibold ${status.className}`}>{status.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-surface p-5">
            <label htmlFor="instruction" className="text-[15px] font-semibold">
              What should we extract?
            </label>
            <textarea
              id="instruction"
              rows={4}
              defaultValue="Extract the supplier name, invoice number, invoice date, subtotal, VAT and total from every PDF. Combine into one Excel spreadsheet."
              className="resize-y rounded-xl border border-line p-3 text-sm leading-normal"
            />
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-subtle">Detected fields</span>
              <div className="flex flex-wrap gap-1.5">
                {fieldOrder.map((f) => (
                  <span key={f.key} className="rounded-full bg-brand-soft px-2.5 py-1.5 text-[13px] font-semibold text-brand-strong">
                    {f.label}
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled
              className="rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Re-run extraction
            </button>
          </section>
        </aside>

        {/* Main: review table */}
        <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <h1 className="font-display text-[28px] font-bold tracking-tight">Review extracted data</h1>
              <p className="text-[15px] text-muted">
                Click any cell to correct it. Coloured cells were not confidently found and need a check.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PrototypeBadge />
              <button type="button" disabled className="rounded-[10px] border border-line bg-surface px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
                Export CSV
              </button>
              <button type="button" disabled className="rounded-[10px] bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                Export Excel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1 rounded-[18px] border border-line bg-surface p-4">
              <span className="text-[13px] text-subtle">Values extracted</span>
              <strong className="font-display text-[22px]">
                {summary.filled} of {summary.cells}
              </strong>
            </div>
            <div
              className={`flex flex-col gap-1 rounded-[18px] border p-4 ${
                summary.needReview > 0 ? "border-[#f5d9a8] bg-[#fffbf3]" : "border-line bg-surface"
              }`}
            >
              <span className={`text-[13px] ${summary.needReview > 0 ? "text-warn" : "text-subtle"}`}>Need review</span>
              <strong className={`font-display text-[22px] ${summary.needReview > 0 ? "text-warn" : "text-success"}`}>
                {summary.needReview === 0 ? "All clear" : `${summary.needReview} value${summary.needReview > 1 ? "s" : ""}`}
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
                  <th className="whitespace-nowrap border-b border-line-soft bg-surface-soft px-3.5 py-3 text-left text-xs font-semibold text-subtle">
                    Source
                  </th>
                  {fieldOrder.map((f) => (
                    <th
                      key={f.key}
                      className={`whitespace-nowrap border-b border-line-soft bg-surface-soft px-3.5 py-3 text-xs font-semibold text-subtle ${
                        f.numeric ? "text-right" : "text-left"
                      }`}
                    >
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={selectedId === r.id ? "bg-brand-soft/40" : ""}>
                    <td className="whitespace-nowrap border-b border-[#f3f2f8] px-3.5 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(r.id)}
                        className="font-medium text-brand-strong hover:text-brand"
                      >
                        {r.id} · p.{r.page}
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
                            aria-label={`${f.label} for ${r.id}`}
                            aria-invalid={status === "missing" || status === "mismatch" ? true : undefined}
                            className={`w-full rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-brand ${
                              f.key === "supplier" ? "min-w-[180px]" : "min-w-[96px]"
                            } ${
                              f.numeric ? "text-right" : ""
                            } ${cellStyles[status]}`}
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
              <span className="size-3 rounded-[3px] border border-[#f5d9a8] bg-warn-soft" /> Missing: not found in document
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-3 rounded-[3px] border border-[#bfd3fa] bg-info-soft" /> Low confidence: please check
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-3 rounded-[3px] border border-[#f5c2c2] bg-danger-soft" /> Subtotal + VAT ≠ Total
            </li>
          </ul>

          <SourcePreview row={selected} onVerify={() => markVerified(selected.id)} />
        </main>
      </div>
    </div>
  );
}

function SourcePreview({ row, onVerify }: { row: ExtractedRow; onVerify: () => void }) {
  const issues = rowIssues(row);
  const balance = totalsBalance(row);
  const canVerify = row.lowConfidence.length > 0 && !row.verified;

  let explanation = "All values were found in the document and the totals balance.";
  if (issues.includes("missing")) {
    const missing = fieldOrder.filter((f) => cellStatus(row, f.key) === "missing").map((f) => f.label);
    explanation = `${missing.join(", ")} could not be found on this page. Type the value if you can see it in the document, or leave it empty. We never guess.`;
  } else if (balance === false) {
    explanation = "The subtotal plus VAT does not equal the total printed on the invoice. Check which figure was read incorrectly.";
  } else if (canVerify) {
    explanation = `This page was ${row.scanned ? "scanned and read with OCR" : "hard to read"}, and the date format was unclear. Check it against the document, then mark the row as verified.`;
  } else if (row.verified) {
    explanation = "You verified this row against the source document.";
  }

  return (
    <section aria-label="Source preview" className="flex flex-wrap items-center gap-5 rounded-[18px] border border-line bg-surface p-5">
      <div aria-hidden="true" className="flex h-[150px] w-[120px] shrink-0 flex-col gap-1.5 rounded-lg border border-line bg-surface-soft p-3">
        <span className="h-1.5 w-1/2 rounded-sm bg-[#d6d4e2]" />
        <span className="h-1 w-4/5 rounded-sm bg-line" />
        <span className="h-1 w-[70%] rounded-sm bg-line" />
        <span className="mt-5 h-3.5 w-full rounded-sm bg-info/20 outline outline-[1.5px] outline-info" />
        <span className="h-1 w-[90%] rounded-sm bg-line" />
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
          <PrototypeBadge label="Page preview arrives in Phase 3" />
        </div>
      </div>
    </section>
  );
}
