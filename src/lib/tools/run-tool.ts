import { mergePdfs } from "@/lib/pdf/operations/merge";
import { organizePdf, type PagePlan } from "@/lib/pdf/operations/organize";
import { rotatePdf, type RotateAngle, type RotateWhich } from "@/lib/pdf/operations/rotate";
import { splitPdf, type SplitMode } from "@/lib/pdf/operations/split";
import type { InputPdf, OutputFile } from "@/lib/pdf/operations/types";

// Tools whose processing is implemented. Everything runs in the browser.
export const runnableTools = new Set(["merge-pdf", "split-pdf", "rotate-pdf", "organise-pages"]);

// Minimum number of valid files each tool needs.
export function minimumFiles(slug: string) {
  return slug === "merge-pdf" ? 2 : 1;
}

export async function runTool(slug: string, inputs: InputPdf[], options: Record<string, unknown>): Promise<OutputFile[]> {
  switch (slug) {
    case "merge-pdf":
      return [await mergePdfs(inputs)];
    case "split-pdf":
      return splitPdf(inputs[0], options.mode as SplitMode, String(options.pages ?? ""));
    case "rotate-pdf":
      return [await rotatePdf(inputs[0], Number(options.angle) as RotateAngle, options.which as RotateWhich)];
    case "organise-pages":
      return [await organizePdf(inputs[0], options.plan as PagePlan)];
    default:
      throw new Error(`No processing for ${slug}`);
  }
}
