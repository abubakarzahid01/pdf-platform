"use client";

import { useEffect, useRef, useState } from "react";
import { limits } from "@/config/site";
import type { InputSpec } from "@/config/tools";
import { checkFile } from "@/lib/files/check-file";
import { closePdf, type PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { FileDropzone } from "@/components/file-dropzone";
import { PrototypeBadge } from "@/components/prototype-badge";
import { SelectedFiles, type FileItemStatus } from "@/components/selected-files";
import { ToolOptions } from "@/components/tool/tool-options";
import { FilePreview } from "@/components/tool/file-preview";

type Props = {
  slug: string;
  actionLabel: string;
  input: InputSpec;
};

export type CheckedItem = {
  id: number;
  file: File;
  status: FileItemStatus;
  pdf?: PDFDocumentProxy;
  pageCount?: number;
};

let nextId = 1;

export function ToolWorkspace({ slug, actionLabel, input }: Props) {
  const [items, setItems] = useState<CheckedItem[]>([]);
  const itemsRef = useRef(items);
  const removedIds = useRef(new Set<number>());

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Free the opened PDFs when leaving the page.
  useEffect(() => {
    return () => itemsRef.current.forEach((item) => closePdf(item.pdf));
  }, []);

  function discard(item: CheckedItem) {
    removedIds.current.add(item.id);
    closePdf(item.pdf);
  }

  function addFiles(files: File[]) {
    const added: CheckedItem[] = files.map((file) => ({ id: nextId++, file, status: { state: "checking" } }));
    if (!input.multiple) itemsRef.current.forEach(discard);
    setItems((prev) => (input.multiple ? [...prev, ...added] : added));

    for (const item of added) {
      checkFile(item.file, input.kinds, input.expected).then((result) => {
        if (removedIds.current.has(item.id)) {
          if (result.ok) closePdf(result.pdf);
          return;
        }
        const update: Partial<CheckedItem> = result.ok
          ? {
              status: { state: "ok", detail: result.pageCount ? `${result.pageCount} page${result.pageCount > 1 ? "s" : ""}` : undefined },
              pdf: result.pdf,
              pageCount: result.pageCount,
            }
          : { status: { state: "error", message: result.message } };
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...update } : i)));
      });
    }
  }

  function removeAt(index: number) {
    const item = items[index];
    if (item) discard(item);
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const hasFiles = items.length > 0;
  const checking = items.some((i) => i.status.state === "checking");
  const errors = items.filter((i) => i.status.state === "error").length;
  const firstValid = items.find((i) => i.status.state === "ok");

  let note = "Add a file to get started.";
  if (checking) note = "Checking your files…";
  else if (errors > 0) note = `Remove the ${errors === 1 ? "file" : `${errors} files`} with problems to continue.`;
  else if (hasFiles) note = "Files checked. Processing for this tool arrives in a later phase.";

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        {hasFiles ? (
          <>
            <SelectedFiles files={items.map((i) => i.file)} statuses={items.map((i) => i.status)} onRemove={removeAt} />
            <div className="flex flex-wrap gap-4">
              {input.multiple && (
                <label className="cursor-pointer text-sm font-semibold text-brand-strong hover:text-brand">
                  + Add more files
                  <input
                    type="file"
                    multiple
                    accept={input.accept}
                    className="hidden"
                    onChange={(e) => {
                      addFiles(Array.from(e.target.files ?? []));
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              <button
                type="button"
                onClick={() => {
                  items.forEach(discard);
                  setItems([]);
                }}
                className="text-sm font-semibold text-subtle hover:text-ink"
              >
                Start over
              </button>
            </div>
            {firstValid && <FilePreview item={firstValid} showsFirstOf={items.length > 1} />}
          </>
        ) : (
          <FileDropzone
            onFiles={addFiles}
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
        <span role="status" className={`text-center text-xs ${errors > 0 ? "text-danger" : "text-subtle"}`}>
          {note}
        </span>
      </aside>
    </div>
  );
}
