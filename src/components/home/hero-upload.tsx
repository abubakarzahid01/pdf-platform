"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { limits } from "@/config/site";
import { getInputSpec, getTool, type Tool } from "@/config/tools";
import { FileDropzone } from "@/components/file-dropzone";
import { SelectedFiles } from "@/components/selected-files";
import { detectKind, readHead, type FileKind } from "@/lib/files/detect-type";
import { setFilesForTool } from "@/lib/files/pending-document";
import { saveHandoff } from "@/lib/files/handoff-store";

const IMAGE_KINDS = new Set<FileKind>(["png", "jpeg", "gif", "webp", "bmp"]);
const SINGLE_PDF_TOOLS = ["edit-pdf", "compress-pdf", "pdf-to-word", "split-pdf", "organise-pages", "pdf-to-excel", "protect-pdf", "add-page-numbers"];
const MULTI_PDF_TOOLS = ["merge-pdf", "invoice-to-excel"];

// Office files share container types (ZIP or the old OLE format), so the extension picks the tool;
// the tool page then checks the contents.
function officeTool(name: string) {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return ["word-to-pdf", "excel-to-pdf", "powerpoint-to-pdf"].find((slug) => getInputSpec(slug).extensions?.includes(ext)) ?? null;
}

type Suggestion = { tools: Tool[]; problem?: string };

async function suggestTools(files: File[]): Promise<Suggestion> {
  const kinds = await Promise.all(files.map(async (file) => detectKind(await readHead(file))));
  const pick = (slugs: string[]) => slugs.map(getTool).filter((t): t is Tool => !!t);

  if (kinds.every((k) => k === "pdf")) return { tools: pick(files.length > 1 ? MULTI_PDF_TOOLS : SINGLE_PDF_TOOLS) };
  if (kinds.every((k) => IMAGE_KINDS.has(k))) return { tools: pick(["images-to-pdf"]) };

  const office = files.map((f, i) => (["zip", "ole", "rtf", "text"].includes(kinds[i]) ? officeTool(f.name) : null));
  if (office.every((slug) => slug)) {
    if (files.length > 1) return { tools: [], problem: "Office files are converted one at a time. Choose a single file." };
    return { tools: pick([office[0]!]) };
  }
  if (files.length > 1) return { tools: [], problem: "These files can't be used together. Choose PDFs, images or one Office file." };
  return { tools: [], problem: "This file type isn't supported. Choose a PDF, an image, or a Word, Excel or PowerPoint file." };
}

export function HeroUpload() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  async function choose(chosen: File[]) {
    setFiles(chosen);
    setSuggestion(null);
    if (chosen.length) setSuggestion(await suggestTools(chosen));
  }

  async function open(tool: Tool) {
    setFilesForTool(tool.slug, files);
    // A stored copy too, in case the tool page loads in full and the memory hand-off is lost.
    await saveHandoff(`tool:${tool.slug}`, files);
    router.push(`/tools/${tool.slug}`);
  }

  return (
    <div className="w-full max-w-[820px]">
      <div className="rounded-3xl bg-surface p-2.5 shadow-raised">
        <FileDropzone
          onFiles={choose}
          hint={`PDF, Word, Excel, PowerPoint or images · up to ${limits.free.maxFileSizeMb} MB`}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 rounded-card border border-line bg-surface-soft p-4 text-left">
          <strong className="text-sm">
            {files.length} file{files.length > 1 ? "s" : ""} selected
          </strong>
          <SelectedFiles files={files} onRemove={(i) => choose(files.filter((_, j) => j !== i))} />
          {suggestion?.problem && <p className="text-[13px] text-warn">{suggestion.problem}</p>}
          {suggestion && suggestion.tools.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-subtle">What do you want to do?</span>
              <div className="flex flex-wrap gap-2">
                {suggestion.tools.map((tool) => (
                  <button
                    key={tool.slug}
                    type="button"
                    onClick={() => open(tool)}
                    className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium hover:border-brand hover:text-brand"
                  >
                    <tool.icon className="size-4" aria-hidden="true" />
                    {tool.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 flex items-center justify-center gap-2 text-[13px] text-subtle">
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        Most tools run in your browser, so your files stay on your device.
      </p>
    </div>
  );
}
