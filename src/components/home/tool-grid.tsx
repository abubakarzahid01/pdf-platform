"use client";

import { useState } from "react";
import { categories, popularTools, tools, type ToolCategory } from "@/config/tools";
import { ToolCard } from "@/components/tool-card";

type Filter = "all" | ToolCategory;

export function ToolGrid() {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? popularTools : tools.filter((t) => t.category === filter);
  const options: { id: Filter; label: string }[] = [{ id: "all", label: "Popular" }, ...categories];
  const heading = filter === "all" ? "Popular tools" : options.find((o) => o.id === filter)?.label;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{heading}</h2>
          <p className="text-muted">Pick a tool, drop a file, download the result.</p>
        </div>
        <div aria-label="Tool categories" className="flex flex-wrap gap-2">
          {options.map((o) => {
            const active = filter === o.id;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(o.id)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  active
                    ? "border-ink bg-ink font-semibold text-white"
                    : "border-line bg-surface font-medium text-ink-soft hover:border-brand-ring"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((t) => (
          <ToolCard key={t.slug} tool={t} />
        ))}
      </div>
      <p className="text-center text-sm text-subtle">{tools.length} tools in total</p>
    </div>
  );
}
