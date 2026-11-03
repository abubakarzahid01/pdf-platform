import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: `Page not found — ${site.name}`,
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center">
        <div className="mx-auto flex max-w-[560px] flex-col items-center gap-4 px-4 py-24 text-center sm:px-8">
          <span className="text-sm font-semibold text-brand-strong">404</span>
          <h1 className="font-display text-[34px] font-extrabold leading-tight tracking-[-0.03em]">This page doesn&apos;t exist</h1>
          <p className="text-muted">The link may be old, or the address may have a typo.</p>
          <Link href="/#tools" className="mt-2 rounded-[10px] bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-strong">
            See all tools
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
