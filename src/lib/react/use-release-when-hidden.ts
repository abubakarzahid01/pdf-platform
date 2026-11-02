import { useEffect, useEffectEvent, useRef } from "react";

// How long a page that was navigated away from keeps its files and edits.
export const KEEP_HIDDEN_MS = 5 * 60 * 1000;

/**
 * Runs `release` once the component has been hidden or unmounted for `delay` ms.
 *
 * Next.js keeps visited pages in a hidden React <Activity> and runs their effect cleanups, then
 * re-runs the effects when the user comes back. Freeing open PDFs or image URLs straight away
 * would break the page they return to, so this waits, and cancels if the page is shown again
 * (which also covers React's development double-run of effects).
 */
export function useReleaseWhenHidden(release: () => void, delay = KEEP_HIDDEN_MS) {
  const timer = useRef<number | undefined>(undefined);
  const onRelease = useEffectEvent(release);

  useEffect(() => {
    window.clearTimeout(timer.current);
    return () => {
      timer.current = window.setTimeout(() => onRelease(), delay);
    };
  }, [delay]);
}
