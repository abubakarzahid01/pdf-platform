import Link from "next/link";
import { site } from "@/config/site";

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
      { href: "/#pricing", label: "Pricing" },
      { href: "/tools/ai-extraction", label: "AI Extract" },
      { href: "#", label: "Help centre" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "#", label: "Privacy" },
      { href: "#", label: "Terms" },
      { href: "#", label: "Security" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line-soft py-14">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-4 sm:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-[2fr_repeat(3,minmax(0,1fr))]">
          <div className="col-span-2 flex max-w-[300px] flex-col gap-3 lg:col-span-1">
            <span className="font-display text-[19px] font-extrabold">{site.name}</span>
            <span className="text-sm text-subtle">Online PDF tools for editing, converting and extracting data.</span>
          </div>
          {columns.map((col) => (
            <div key={col.title} className="flex flex-col gap-2.5 text-sm">
              <strong className="text-[13px] text-ink">{col.title}</strong>
              {col.links.map((l) => (
                <Link key={l.label} href={l.href} className="text-muted hover:text-ink">
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
