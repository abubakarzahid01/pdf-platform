import { useId } from "react";
import Link from "next/link";
import { site } from "@/config/site";

/** The EditBee bee, white on the brand purple. The same drawing is in app/icon.svg (the favicon). */
export function LogoMark() {
  // The header and footer both show the logo, so each copy needs its own clip id.
  const clip = useId();
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-brand">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <clipPath id={clip}>
            <ellipse cx="12" cy="14.6" rx="4.4" ry="5.6" />
          </clipPath>
        </defs>
        <ellipse cx="6.9" cy="11" rx="2.7" ry="4" transform="rotate(-55 6.9 11)" fill="#fff" fillOpacity="0.55" />
        <ellipse cx="17.1" cy="11" rx="2.7" ry="4" transform="rotate(55 17.1 11)" fill="#fff" fillOpacity="0.55" />
        <path d="M10.9 4.9Q10.1 3 8.7 2.7M13.1 4.9Q13.9 3 15.3 2.7" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" fill="none" />
        <circle cx="12" cy="6.5" r="2.2" fill="#fff" />
        <ellipse cx="12" cy="14.6" rx="4.4" ry="5.6" fill="#fff" />
        <path d="M10.9 19.6L12 22.2L13.1 19.6Z" fill="#fff" />
        <g clipPath={`url(#${clip})`} fill="var(--color-brand)">
          <rect x="6" y="12.6" width="12" height="1.7" />
          <rect x="6" y="15.9" width="12" height="1.7" />
        </g>
      </svg>
    </span>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-ink">
      <LogoMark />
      <span className="font-display text-[19px] font-extrabold tracking-tight">{site.name}</span>
    </Link>
  );
}
