"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { limits } from "@/config/site";
import { FileDropzone } from "@/components/file-dropzone";
import { PrototypeBadge } from "@/components/prototype-badge";
import { SelectedFiles } from "@/components/selected-files";

export function HeroUpload() {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <div className="w-full max-w-[820px]">
      <div className="rounded-3xl bg-surface p-2.5 shadow-raised">
        <FileDropzone
          onFiles={setFiles}
          hint={`PDF, Word, Excel, PowerPoint or images · up to ${limits.free.maxFileSizeMb} MB`}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 rounded-card border border-line bg-surface-soft p-4 text-left">
          <div className="flex items-center justify-between gap-3">
            <strong className="text-sm">
              {files.length} file{files.length > 1 ? "s" : ""} selected
            </strong>
            <PrototypeBadge />
          </div>
          <SelectedFiles files={files} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} />
          <p className="text-[13px] text-warn">Files are not uploaded or processed yet. This arrives in Phase 3.</p>
        </div>
      )}

      <p className="mt-4 flex items-center justify-center gap-2 text-[13px] text-subtle">
        <Lock className="size-3.5" aria-hidden="true" />
        Files are deleted automatically after [RETENTION PERIOD].
      </p>
    </div>
  );
}
