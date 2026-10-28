import Link from "next/link";
import type { Tool, ToolTone } from "@/config/tools";

const toneClasses: Record<ToolTone, string> = {
  brand: "bg-brand-soft text-brand",
  info: "bg-info-soft text-[#2559c7]",
  neutral: "bg-[#f2f2f7] text-[#45435c]",
};

export function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group flex flex-col gap-3 rounded-card border border-line bg-surface p-5 shadow-card transition hover:border-brand-ring hover:shadow-[0_6px_20px_rgb(90_71_224/0.10)]"
    >
      <div className="flex items-start justify-between">
        <span className={`flex size-10 items-center justify-center rounded-[10px] ${toneClasses[tool.tone]}`}>
          <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </span>
        {tool.pro && (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-strong">PRO</span>
        )}
      </div>
      <strong className="text-base font-semibold text-ink">{tool.name}</strong>
      <span className="text-sm text-subtle">{tool.description}</span>
    </Link>
  );
}
