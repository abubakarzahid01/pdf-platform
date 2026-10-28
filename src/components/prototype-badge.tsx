// Marks UI that is designed but not functional yet, so nothing pretends to work.
export function PrototypeBadge({ label = "Prototype" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-warn/20 bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">
      {label}
    </span>
  );
}
