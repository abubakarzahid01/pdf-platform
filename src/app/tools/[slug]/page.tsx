import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { site, limits } from "@/config/site";
import { categories, getInputSpec, getRelatedTools, getTool, tools, type Tool } from "@/config/tools";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ToolWorkspace } from "@/components/tool/tool-workspace";

// Every tool page is generated at build time. Unknown slugs show the 404 page.
export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/tools/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  return {
    title: `${tool.name} online — ${site.name}`,
    description: tool.description,
  };
}

// Tools with a full workspace screen link to its preview.
const workspacePreviews: Record<string, { href: string; title: string; text: string; cta: string }> = {
  "ai-extraction": { href: "/extract", title: "Smart Extraction workspace", text: "add invoices there directly, review and export.", cta: "Open workspace" },
};

function actionLabel(tool: Tool) {
  if (tool.category === "convert-to") return "Convert to PDF";
  if (tool.category === "convert-from") return "Convert";
  if (tool.slug === "edit-pdf") return "Open in editor";
  if (tool.slug === "ai-extraction") return "Extract data";
  if (tool.slug === "ai-assistant") return "Start chat";
  if (tool.slug === "organise-pages") return "Save new PDF";
  return tool.name;
}

// The header and footer render instantly; the tool-specific part streams in
// behind a placeholder so client-side navigation between tools never blocks.
export default function ToolPage({ params }: PageProps<"/tools/[slug]">) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Suspense fallback={<ToolSkeleton />}>
          <ToolContent params={params} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

function ToolSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto flex max-w-[1200px] animate-pulse flex-col gap-7 px-4 pb-16 pt-8 sm:px-8">
      <div className="h-4 w-48 rounded bg-canvas" />
      <div className="h-10 w-72 rounded bg-canvas" />
      <div className="h-[280px] rounded-[18px] bg-canvas" />
    </div>
  );
}

async function ToolContent({ params }: { params: PageProps<"/tools/[slug]">["params"] }) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  const input = getInputSpec(tool.slug);
  const category = categories.find((c) => c.id === tool.category);
  const related = getRelatedTools(tool);
  const workspacePreview = workspacePreviews[tool.slug];

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-7 px-4 pb-16 pt-8 sm:px-8">
      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-[13px] text-subtle">
        <Link href="/" className="hover:text-ink">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/#tools" className="hover:text-ink">{category?.label}</Link>
        <span aria-hidden="true">/</span>
        <span className="text-ink">{tool.name}</span>
      </nav>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[32px] font-extrabold tracking-[-0.03em] sm:text-[40px]">{tool.name}</h1>
          {tool.pro && (
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-strong">PRO</span>
          )}
        </div>
        <p className="max-w-[720px] text-[17px] text-muted">{tool.description}</p>
      </div>

      {workspacePreview && (
        <Link
          href={workspacePreview.href}
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-ring bg-brand-soft px-5 py-4 text-ink hover:border-brand"
        >
          <span className="text-[15px]">
            <strong className="font-semibold">{workspacePreview.title}</strong>
            <span className="text-muted"> — {workspacePreview.text}</span>
          </span>
          <span className="text-sm font-semibold text-brand-strong">{workspacePreview.cta} →</span>
        </Link>
      )}

      <ToolWorkspace slug={tool.slug} actionLabel={actionLabel(tool)} input={input} />

      <section className="mt-4 grid grid-cols-1 gap-5 border-t border-line-soft pt-6 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <strong className="text-[15px]">Supported files</strong>
          <span className="text-sm text-muted">
            {input.label}
            {input.multiple ? ", several files at once" : ""}. Password-protected files must be unlocked first.
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <strong className="text-[15px]">Limits</strong>
          <span className="text-sm text-muted">
            Free: up to {limits.free.maxFileSizeMb} MB per file. Pro: larger files and batch processing.
          </span>
        </div>
        {related.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <strong className="text-[15px]">Related tools</strong>
            <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {related.map((r) => (
                <Link key={r.slug} href={`/tools/${r.slug}`} className="font-medium text-brand-strong hover:text-brand">
                  {r.name}
                </Link>
              ))}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
