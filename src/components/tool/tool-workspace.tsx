"use client";

import { useState } from "react";
import { limits } from "@/config/site";
import type { InputSpec } from "@/config/tools";
import { FileDropzone } from "@/components/file-dropzone";
import { PrototypeBadge } from "@/components/prototype-badge";
import { SelectedFiles } from "@/components/selected-files";
import { ToolOptions } from "@/components/tool/tool-options";

type Props = {
  slug: string;
  actionLabel: string;
  input: InputSpec;
};

export function ToolWorkspace({ slug, actionLabel, input }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const hasFiles = files.length > 0;

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        {hasFiles ? (
          <>
            <SelectedFiles files={files} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} />
            {input.multiple && (
              <button
                type="button"
                onClick={() => setFiles([])}
                className="self-start text-sm font-semibold text-brand-strong hover:text-brand"
              >
                Start over
              </button>
            )}
            <div className="flex flex-col gap-3 rounded-panel border border-line-soft bg-surface-soft p-6">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-[15px]">Preview</strong>
                <PrototypeBadge />
              </div>
              <div className="flex gap-5 overflow-x-auto pb-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex shrink-0 flex-col items-center gap-2">
                    <div className="flex h-[168px] w-[124px] flex-col gap-1.5 rounded bg-surface p-3.5 shadow-[0_1px_3px_rgb(21_19_43/0.12)]">
                      <span className="h-1.5 w-1/2 rounded-sm bg-brand-ring" />
                      <span className="h-1 w-full rounded-sm bg-line" />
                      <span className="h-1 w-5/6 rounded-sm bg-line" />
                      <span className="mt-1 h-10 w-full rounded-sm bg-canvas" />
                      <span className="h-1 w-4/5 rounded-sm bg-line" />
                    </div>
                    <span className="text-xs text-muted">Page {n}</span>
                  </div>
                ))}
              </div>
              <p className="text-[13px] text-subtle">Real page previews of your file arrive in Phase 3.</p>
            </div>
          </>
        ) : (
          <FileDropzone
            onFiles={setFiles}
            accept={input.accept}
            multiple={input.multiple}
            hint={`${input.label} · up to ${limits.free.maxFileSizeMb} MB`}
          />
        )}
      </section>

      <aside className="flex w-full max-w-[400px] flex-[1_1_340px] flex-col gap-5 rounded-panel border border-line bg-surface p-6 shadow-[0_12px_32px_rgb(21_19_43/0.06)]">
        <div className="flex items-center justify-between">
          <strong className="font-display text-[17px]">Options</strong>
          <PrototypeBadge />
        </div>
        <ToolOptions slug={slug} />
        <button
          type="button"
          disabled
          className="rounded-xl bg-brand py-[15px] text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {actionLabel}
        </button>
        <span className="text-center text-xs text-subtle">
          {hasFiles
            ? "Processing is not built yet. This tool becomes functional in a later phase."
            : "Add a file to get started."}
        </span>
      </aside>
    </div>
  );
}
