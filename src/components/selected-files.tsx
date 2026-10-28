import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";

export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toUpperCase().slice(0, 4) : "FILE";
}

export type FileItemStatus =
  | { state: "checking" }
  | { state: "ok"; detail?: string }
  | { state: "error"; message: string };

type Props = {
  files: File[];
  // Optional check status per file, same order as `files`.
  statuses?: FileItemStatus[];
  onRemove?: (index: number) => void;
};

export function SelectedFiles({ files, statuses, onRemove }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {files.map((f, i) => {
        const status = statuses?.[i];
        const isError = status?.state === "error";
        return (
          <li
            key={f.name + f.size + i}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
              isError ? "border-danger/25 bg-danger-soft" : "border-line bg-surface"
            }`}
          >
            <span className="flex h-11 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-canvas text-[9px] font-bold text-ink-soft">
              {extension(f.name)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-ink">{f.name}</span>
              <span className={`text-xs ${isError ? "text-danger" : "text-subtle"}`}>
                {status?.state === "error"
                  ? status.message
                  : [formatSize(f.size), status?.state === "ok" ? status.detail : null].filter(Boolean).join(" · ")}
              </span>
            </div>
            {status?.state === "checking" && <Loader2 className="size-4 shrink-0 animate-spin text-subtle" aria-label="Checking file" />}
            {status?.state === "ok" && <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="File is valid" />}
            {isError && <AlertCircle className="size-4 shrink-0 text-danger" aria-hidden="true" />}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`Remove ${f.name}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-subtle hover:bg-surface hover:text-ink"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
