import Link from "next/link";
import { site } from "@/config/site";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-ink">
      <span className="flex size-8 items-center justify-center rounded-[9px] bg-brand">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
        </svg>
      </span>
      <span className="font-display text-[19px] font-extrabold tracking-tight">{site.name}</span>
    </Link>
  );
}
