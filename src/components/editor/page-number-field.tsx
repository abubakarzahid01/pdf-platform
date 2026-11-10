"use client";

import { useId, useState } from "react";
import { parsePageNumber } from "./page-number";

// The "Page [n] of N" box. Invalid entries are rejected with a message and the
// current page stays as it is.
export function PageNumberField({ page, pageCount, onGo }: { page: number; pageCount: number; onGo: (page: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  function submit(value: string, leaving: boolean) {
    const result = parsePageNumber(value, pageCount);
    if (result.ok) {
      setError(null);
      setDraft(null);
      if (result.page !== page) onGo(result.page);
      return;
    }
    setError(result.message);
    // Leaving the box puts the current page back; pressing Enter keeps the entry to correct.
    if (leaving) setDraft(null);
  }

  return (
    <label className="relative flex items-center gap-2 text-muted">
      Page
      <input
        value={draft ?? String(page)}
        inputMode="numeric"
        aria-label="Current page"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit(e.currentTarget.value, false);
          if (e.key === "Escape") {
            setDraft(null);
            setError(null);
          }
        }}
        onBlur={(e) => {
          if (draft !== null) submit(e.currentTarget.value, true);
        }}
        className={`w-12 rounded-lg border px-1.5 py-1.5 text-center font-semibold text-ink ${error ? "border-danger" : "border-line"}`}
      />
      of {pageCount}
      {error && (
        <span
          id={errorId}
          role="alert"
          className="absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[260px] -translate-x-1/2 rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-center text-xs font-medium text-danger shadow-raised"
        >
          {error}
        </span>
      )}
    </label>
  );
}
