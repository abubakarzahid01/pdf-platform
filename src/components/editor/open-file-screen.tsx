"use client";

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { limits } from "@/config/site";
import { checkFile } from "@/lib/files/check-file";
import type { OpenDocument } from "@/lib/files/pending-document";
import { Logo } from "@/components/logo";
import { FileDropzone } from "@/components/file-dropzone";

type State = { status: "idle" } | { status: "checking"; name: string } | { status: "error"; name: string; message: string };

// Shown when the editor is opened without a document (direct visit or refresh).
export function OpenFileScreen({ onOpen }: { onOpen: (doc: OpenDocument) => void }) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function open(files: File[]) {
    const file = files[0];
    if (!file) return;
    setState({ status: "checking", name: file.name });
    const result = await checkFile(file, ["pdf"], "a PDF");
    if (result.ok && result.pdf && result.pageCount) {
      onOpen({ file, pdf: result.pdf, pageCount: result.pageCount });
    } else if (!result.ok) {
      setState({ status: "error", name: file.name, message: result.message });
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface-soft">
      <header className="border-b border-line-soft bg-surface">
        <div className="mx-auto flex h-[68px] max-w-[1200px] items-center px-4 sm:px-8">
          <Logo />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">Open a PDF to edit</h1>
          <p className="text-muted">Your file is opened in your browser and isn&apos;t uploaded anywhere.</p>
        </div>
        <div className="w-full rounded-3xl bg-surface p-2.5 shadow-raised">
          <FileDropzone
            onFiles={open}
            accept=".pdf,application/pdf"
            multiple={false}
            buttonLabel="Choose a PDF"
            hint={`PDF · up to ${limits.free.maxFileSizeMb} MB and ${limits.free.maxPages} pages`}
          />
        </div>
        {state.status === "checking" && (
          <p role="status" className="flex items-center gap-2 text-sm text-subtle">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Opening {state.name}…
          </p>
        )}
        {state.status === "error" && (
          <p role="alert" className="flex w-full items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-left text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-semibold">{state.name}:</strong> {state.message}
            </span>
          </p>
        )}
      </main>
    </div>
  );
}
