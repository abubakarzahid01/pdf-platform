import Link from "next/link";
import { Mail } from "lucide-react";
import { site } from "@/config/site";
import { Logo } from "@/components/logo";

const columns = [
  {
    title: "Tools",
    links: [
      { href: "/tools/edit-pdf", label: "Edit PDF" },
      { href: "/tools/merge-pdf", label: "Merge PDF" },
      { href: "/tools/compress-pdf", label: "Compress PDF" },
      { href: "/tools/pdf-to-word", label: "PDF to Word" },
    ],
  },
  {
    title: "Product",
    links: [
      { href: "/tools/invoice-to-excel", label: "Invoice to Excel" },
      { href: "/tools/pdf-to-excel", label: "PDF to Excel" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/licences", label: "Open-source licences" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line-soft py-14">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-4 sm:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-[2fr_repeat(3,minmax(0,1fr))]">
          <div className="col-span-2 flex max-w-[300px] flex-col gap-3 lg:col-span-1">
            <Logo />
            <span className="text-sm text-subtle">Online PDF tools for editing, converting and extracting data.</span>
            <a href={`mailto:${site.contactEmail}`} className="flex items-center gap-2 py-1 text-sm text-muted hover:text-ink">
              <Mail className="size-4 shrink-0" aria-hidden="true" />
              {site.contactEmail}
            </a>
          </div>
          {columns.map((col) => (
            <div key={col.title} className="flex flex-col items-start gap-0.5 text-sm">
              <strong className="mb-1.5 text-[13px] text-ink">{col.title}</strong>
              {col.links.map((l) => (
                <Link key={l.label} href={l.href} className="py-1 text-muted hover:text-ink">
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-line-soft pt-6 text-[13px] text-subtle">
          © 2026 {site.name}
        </div>
      </div>
    </footer>
  );
}
