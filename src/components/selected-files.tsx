import { X } from "lucide-react";

export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toUpperCase().slice(0, 4) : "FILE";
}

type Props = {
  files: File[];
  onRemove?: (index: number) => void;
};

export function SelectedFiles({ files, onRemove }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {files.map((f, i) => (
        <li key={f.name + f.size + i} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <span className="flex h-11 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-canvas text-[9px] font-bold text-ink-soft">
            {extension(f.name)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-ink">{f.name}</span>
            <span className="text-xs text-subtle">{formatSize(f.size)}</span>
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={`Remove ${f.name}`}
              className="flex size-9 items-center justify-center rounded-lg text-subtle hover:bg-surface-soft hover:text-ink"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
