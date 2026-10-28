"use client";

import { useRef, useState } from "react";
import { Lock, Upload } from "lucide-react";
import { limits } from "@/config/site";
import { PrototypeBadge } from "@/components/prototype-badge";

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function HeroUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="w-full max-w-[820px]">
      <div className="rounded-3xl bg-surface p-2.5 shadow-raised">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            setFiles(Array.from(e.dataTransfer.files));
          }}
          className={`flex flex-col items-center gap-4 rounded-[18px] border-2 border-dashed px-6 py-12 transition ${
            dragging ? "border-brand bg-brand-soft" : "border-brand-ring bg-[#fcfbff]"
          }`}
        >
          <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <Upload className="size-[26px]" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <strong className="text-lg font-semibold">Drop your files here</strong>
            <span className="text-sm text-subtle">
              PDF, Word, Excel, PowerPoint or images · up to {limits.free.maxFileSizeMb} MB
            </span>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-xl bg-brand px-[26px] py-3.5 text-base font-semibold text-white hover:bg-brand-strong"
          >
            Choose files
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-4 rounded-card border border-line bg-surface p-4 text-left">
          <div className="flex items-center justify-between gap-3">
            <strong className="text-sm">
              {files.length} file{files.length > 1 ? "s" : ""} selected
            </strong>
            <PrototypeBadge />
          </div>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {files.map((f) => (
              <li key={f.name + f.size} className="flex justify-between gap-4">
                <span className="truncate text-ink-soft">{f.name}</span>
                <span className="shrink-0 text-subtle">{formatSize(f.size)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-warn">
            Files are not uploaded or processed yet. This arrives in Phase 3.
          </p>
        </div>
      )}

      <p className="mt-4 flex items-center justify-center gap-2 text-[13px] text-subtle">
        <Lock className="size-3.5" aria-hidden="true" />
        Files are deleted automatically after [RETENTION PERIOD].
      </p>
    </div>
  );
}
