import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

// Shared layout for text pages such as Privacy and Licences.
export function LegalPage({ title, intro, updated, children }: { title: string; intro: ReactNode; updated?: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto flex max-w-[800px] flex-col gap-8 px-4 pb-20 pt-12 sm:px-8">
          <header className="flex flex-col gap-3">
            <h1 className="font-display text-[34px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[44px]">{title}</h1>
            <p className="text-[17px] text-muted">{intro}</p>
            {updated && <p className="text-sm text-subtle">Last updated {updated}</p>}
          </header>
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink-soft [&_a]:font-medium [&_a]:text-brand-strong [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-5 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5">
      <h2 className="font-display text-[21px] font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}
