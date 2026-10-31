"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { limits } from "@/config/site";
import type { InputSpec } from "@/config/tools";
import { checkFile } from "@/lib/files/check-file";
import { setPendingDocument, setPendingFiles } from "@/lib/files/pending-document";
import { closePdf, type PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { OperationError, baseName, type OutputFile } from "@/lib/pdf/operations/types";
import { minimumFiles, runTool, runnableTools } from "@/lib/tools/run-tool";
import { FileDropzone } from "@/components/file-dropzone";
import { PrototypeBadge } from "@/components/prototype-badge";
import { SelectedFiles, type FileItemStatus } from "@/components/selected-files";
import { ToolOptions, optionDefaults, type OptionValues } from "@/components/tool/tool-options";
import { FilePreview } from "@/components/tool/file-preview";
import { ToolResult } from "@/components/tool/tool-result";
import { PageOrganiser, defaultPlan } from "@/components/tool/page-organiser";
import type { PagePlan } from "@/lib/pdf/operations/organize";

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
  const router = useRouter();
  const [items, setItems] = useState<CheckedItem[]>([]);
  const [options, setOptions] = useState<OptionValues>(() => optionDefaults[slug] ?? {});
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<OutputFile[] | null>(null);
  // Organise pages: the edited page list, tied to the file it was made for.
  const [pagePlan, setPagePlan] = useState<{ itemId: number; pages: PagePlan } | null>(null);
  const itemsRef = useRef(items);
  const removedIds = useRef(new Set<number>());

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Free the opened PDFs when leaving the page.
  useEffect(() => {
    return () => itemsRef.current.forEach((item) => closePdf(item.pdf));
  }, []);

  // Any change to files or options makes an earlier result out of date.
  function invalidate() {
    setOutputs(null);
    setRunError(null);
  }

  function discard(item: CheckedItem) {
    removedIds.current.add(item.id);
    closePdf(item.pdf);
  }

  function addFiles(files: File[]) {
    invalidate();
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
    invalidate();
    const item = items[index];
    if (item) discard(item);
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    invalidate();
    setItems((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function reset() {
    invalidate();
    items.forEach(discard);
    setItems([]);
  }

  const hasFiles = items.length > 0;
  const checking = items.some((i) => i.status.state === "checking");
  const errors = items.filter((i) => i.status.state === "error").length;
  const valid = items.filter((i) => i.status.state === "ok");
  const firstValid = valid[0];

  // Tools whose action opens a full workspace page instead of producing a file here.
  const opensEditor = slug === "edit-pdf";
  const opensExtraction = slug === "invoice-to-excel";
  const opensWorkspace = opensEditor || opensExtraction;
  const runnable = runnableTools.has(slug);
  const enoughFiles = valid.length >= minimumFiles(slug);
  const canAct = (opensWorkspace || runnable) && enoughFiles && !checking && errors === 0 && !running;

  const organising = slug === "organise-pages" && !!firstValid?.pdf && !!firstValid.pageCount;
  const plan =
    firstValid && pagePlan?.itemId === firstValid.id ? pagePlan.pages : defaultPlan(firstValid?.pageCount ?? 0);

  function openInEditor() {
    if (!firstValid?.pdf || !firstValid.pageCount) return;
    // Hand the open document to the editor; this page must no longer close it.
    itemsRef.current = itemsRef.current.filter((i) => i.id !== firstValid.id);
    setPendingDocument({ file: firstValid.file, pdf: firstValid.pdf, pageCount: firstValid.pageCount });
    router.push("/editor");
  }

  function openInExtraction() {
    setPendingFiles(valid.map((i) => i.file));
    router.push("/extract");
  }

  async function run() {
    setRunning(true);
    setRunError(null);
    try {
      const inputs = await Promise.all(
        valid.map(async (i) => ({ name: i.file.name, bytes: new Uint8Array(await i.file.arrayBuffer()) })),
      );
      setOutputs(await runTool(slug, inputs, { ...options, plan, pageCount: firstValid?.pageCount ?? 0 }));
    } catch (error) {
      setRunError(error instanceof OperationError ? error.message : "Something went wrong while processing. Your file may use features we can't handle yet.");
    } finally {
      setRunning(false);
    }
  }

  let note = "Add a file to get started.";
  if (checking) note = "Checking your files…";
  else if (errors > 0) note = `Remove the ${errors === 1 ? "file" : `${errors} files`} with problems to continue.`;
  else if (hasFiles && (opensWorkspace || runnable) && !enoughFiles) note = `Add at least ${minimumFiles(slug)} ${slug === "images-to-pdf" ? "images" : "PDFs"}.`;
  else if (canAct) note = "Your files stay in your browser. Nothing is uploaded.";
  else if (hasFiles && !runnable && !opensWorkspace) note = "Files checked. Processing for this tool arrives in a later phase.";

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        {outputs ? (
          <ToolResult
            outputs={outputs}
            zipName={`${baseName(firstValid?.file.name ?? "document")}-${slug === "pdf-to-csv" ? "tables" : slug === "pdf-to-images" ? "pages" : "split"}.zip`}
            onBack={invalidate}
            onReset={reset}
          />
        ) : hasFiles ? (
          <>
            <SelectedFiles
              files={items.map((i) => i.file)}
              statuses={items.map((i) => i.status)}
              onRemove={removeAt}
              onMove={slug === "merge-pdf" || slug === "images-to-pdf" ? move : undefined}
            />
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
              <button type="button" onClick={reset} className="text-sm font-semibold text-subtle hover:text-ink">
                Start over
              </button>
            </div>
            {organising ? (
              <PageOrganiser
                pdf={firstValid.pdf!}
                pageCount={firstValid.pageCount!}
                plan={plan}
                onChange={(pages) => {
                  invalidate();
                  setPagePlan({ itemId: firstValid.id, pages });
                }}
              />
            ) : (
              firstValid && <FilePreview item={firstValid} showsFirstOf={items.length > 1} />
            )}
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
          {!opensWorkspace && !runnable && <PrototypeBadge />}
        </div>
        <ToolOptions
          slug={slug}
          values={options}
          pageCount={firstValid?.pageCount}
          onChange={(key, value) => {
            invalidate();
            setOptions((prev) => ({ ...prev, [key]: value }));
          }}
        />
        <button
          type="button"
          disabled={!canAct}
          onClick={opensEditor ? openInEditor : opensExtraction ? openInExtraction : run}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand py-[15px] text-base font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {running ? "Working…" : actionLabel}
        </button>
        {runError ? (
          <p role="alert" className="rounded-xl border border-danger/25 bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {runError}
          </p>
        ) : (
          <span role="status" className={`text-center text-xs ${errors > 0 ? "text-danger" : "text-subtle"}`}>
            {note}
          </span>
        )}
      </aside>
    </div>
  );
}
