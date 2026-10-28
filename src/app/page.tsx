import { site } from "@/config/site";

// Temporary Phase 1 page: confirms fonts and design tokens work.
// Replaced by the real homepage in Phase 2.

const swatches = [
  { name: "brand", className: "bg-brand" },
  { name: "brand-soft", className: "bg-brand-soft" },
  { name: "info", className: "bg-info" },
  { name: "ink", className: "bg-ink" },
  { name: "canvas", className: "bg-canvas" },
  { name: "warn-soft", className: "bg-warn-soft" },
  { name: "danger-soft", className: "bg-danger-soft" },
  { name: "success-soft", className: "bg-success-soft" },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-surface-soft px-4 py-20">
      <div className="flex w-full max-w-2xl flex-col items-center gap-6 text-center">
        <span className="rounded-full bg-brand-soft px-3 py-1.5 text-sm font-semibold text-brand-strong">
          Phase 1 · Project foundation
        </span>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          {site.tagline}
        </h1>
        <p className="text-lg text-muted">
          {site.name} is set up. The real homepage arrives in Phase 2.
        </p>

        <section
          aria-label="Design tokens"
          className="mt-4 w-full rounded-panel border border-line bg-surface p-6 text-left shadow-raised"
        >
          <h2 className="font-display text-lg font-bold">Design tokens</h2>
          <p className="mt-1 text-sm text-subtle">
            Headings use Plus Jakarta Sans, body text uses Inter.
          </p>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {swatches.map((s) => (
              <li key={s.name} className="flex flex-col gap-2">
                <span className={`h-12 rounded-card border border-line ${s.className}`} />
                <span className="text-xs font-medium text-ink-soft">{s.name}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-xl bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-strong"
            >
              Primary button
            </button>
            <button
              type="button"
              className="rounded-xl border border-line bg-surface px-5 py-3 font-medium text-ink hover:bg-surface-soft"
            >
              Secondary button
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
