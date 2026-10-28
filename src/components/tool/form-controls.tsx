"use client";

import { useId, type ReactNode } from "react";

// Small controlled form building blocks shared by tool option panels.

type Option = string | { value: string; label: string };

function normalise(option: Option) {
  return typeof option === "string" ? { value: option, label: option } : option;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[13px] font-semibold text-ink-soft">{label}</legend>
      {children}
    </fieldset>
  );
}

export function Segmented({ options, value, onChange }: { options: Option[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 rounded-[11px] bg-[#f2f2f7] p-1">
      {options.map(normalise).map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 flex-1 rounded-lg px-2 text-[13px] transition ${
            value === o.value ? "bg-surface font-semibold text-ink shadow-card" : "font-medium text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SelectField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-soft">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink"
      >
        {options.map(normalise).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-soft">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-subtle"
      />
      {hint && <span className="text-xs text-subtle">{hint}</span>}
    </div>
  );
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 rounded-[10px] border border-line px-3 py-2.5 text-sm font-medium text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-brand" />
      {label}
    </label>
  );
}
