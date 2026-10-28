"use client";

import { useId, useState, type ReactNode } from "react";

// Small form building blocks shared by tool option panels.

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[13px] font-semibold text-ink-soft">{label}</legend>
      {children}
    </fieldset>
  );
}

export function Segmented({ options, initial }: { options: string[]; initial?: string }) {
  const [value, setValue] = useState(initial ?? options[0]);
  return (
    <div className="flex gap-1 rounded-[11px] bg-[#f2f2f7] p-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => setValue(o)}
          className={`min-h-9 flex-1 rounded-lg px-2 text-[13px] transition ${
            value === o ? "bg-surface font-semibold text-ink shadow-card" : "font-medium text-muted hover:text-ink"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function SelectField({ label, options }: { label: string; options: string[] }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-soft">
        {label}
      </label>
      <select id={id} className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink">
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

export function TextField({
  label,
  placeholder,
  type = "text",
  defaultValue,
}: {
  label: string;
  placeholder?: string;
  type?: string;
  defaultValue?: string;
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
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-subtle"
      />
    </div>
  );
}

export function Checkbox({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2.5 rounded-[10px] border border-line px-3 py-2.5 text-sm font-medium text-ink">
      <input type="checkbox" defaultChecked={defaultChecked} className="size-4 accent-brand" />
      {label}
    </label>
  );
}
