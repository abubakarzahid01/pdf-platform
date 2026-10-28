import Link from "next/link";
import { Check } from "lucide-react";
import { limits } from "@/config/site";

// Prices are placeholders until the business model is finalised (Phase 8).
const plans = [
  {
    name: "Free",
    audience: "For occasional tasks",
    price: "£0",
    period: "",
    features: ["Core PDF tools", `Files up to ${limits.free.maxFileSizeMb} MB`, "[N] tasks per day", "Ads shown"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    audience: "For professionals",
    price: "[PRICE]",
    period: "/month",
    features: ["Full PDF editor", "Batch processing & OCR", "PDF to Excel extraction", "AI assistant · no ads"],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    name: "Business",
    audience: "For teams",
    price: "[PRICE]",
    period: "/user/mo",
    features: ["Everything in Pro", "Shared workspaces", "Higher limits", "Priority support"],
    cta: "Contact sales",
    highlight: false,
  },
];

export function Pricing() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Simple pricing</h2>
        <p className="text-muted">Start free. Upgrade when you need more. Annual plans save [X]%.</p>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`flex flex-col gap-5 rounded-panel bg-surface p-8 ${
              p.highlight ? "border-2 border-brand shadow-[0_20px_50px_rgb(90_71_224/0.14)]" : "border border-line"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1.5">
                <strong className="text-lg">{p.name}</strong>
                <span className="text-sm text-subtle">{p.audience}</span>
              </div>
              {p.highlight && (
                <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-strong">Most popular</span>
              )}
            </div>
            <div className="font-display text-[40px] font-extrabold tracking-tight">
              {p.price}
              <span className="text-base font-medium text-subtle">{p.period}</span>
            </div>
            <ul className="flex flex-col gap-2.5 text-[15px] text-ink-soft">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-brand" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="#"
              className={`mt-auto rounded-xl py-3 text-center font-semibold ${
                p.highlight ? "bg-brand text-white hover:bg-brand-strong" : "border border-line text-ink hover:bg-surface-soft"
              }`}
            >
              {p.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
