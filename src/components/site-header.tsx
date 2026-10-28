import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/logo";

const navLinks = [
  { href: "/#tools", label: "All tools" },
  { href: "/tools/edit-pdf", label: "Edit PDF" },
  { href: "/tools/ai-extraction", label: "AI Extract" },
  { href: "/#pricing", label: "Pricing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line-soft bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center justify-between gap-6 px-4 sm:px-8">
        <div className="flex items-center gap-10">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} className="text-[15px] font-medium text-ink-soft hover:text-ink">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link href="#" className="hidden px-3.5 py-2.5 text-[15px] font-medium text-ink sm:block">
            Log in
          </Link>
          <Link href="#" className="rounded-[10px] bg-ink px-[18px] py-2.5 text-[15px] font-semibold text-white hover:bg-ink-soft">
            Get started
          </Link>

          {/* Mobile menu: native <details>, works without JavaScript */}
          <details className="relative lg:hidden">
            <summary
              aria-label="Open menu"
              className="flex size-11 cursor-pointer list-none items-center justify-center rounded-[10px] border border-line text-ink [&::-webkit-details-marker]:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </summary>
            <nav
              aria-label="Mobile"
              className="absolute right-0 mt-2 flex w-56 flex-col rounded-card border border-line bg-surface p-2 shadow-raised"
            >
              {navLinks.map((l) => (
                <Link key={l.href} href={l.href} className="rounded-lg px-3 py-3 text-[15px] font-medium text-ink hover:bg-surface-soft">
                  {l.label}
                </Link>
              ))}
              <Link href="#" className="rounded-lg px-3 py-3 text-[15px] font-medium text-ink hover:bg-surface-soft sm:hidden">
                Log in
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
