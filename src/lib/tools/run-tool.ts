import { compressPdf, type CompressLevel } from "@/lib/pdf/operations/compress";
import { mergePdfs } from "@/lib/pdf/operations/merge";
import { organizePdf, type PagePlan } from "@/lib/pdf/operations/organize";
import { pdfToText, type PageBreaks } from "@/lib/pdf/operations/pdf-to-text";
import { rotatePdf, type RotateAngle, type RotateWhich } from "@/lib/pdf/operations/rotate";
import { splitPdf, type SplitMode } from "@/lib/pdf/operations/split";
import type { InputPdf, OutputFile } from "@/lib/pdf/operations/types";

// Tools whose processing is implemented. Everything runs in the browser.
export const runnableTools = new Set(["merge-pdf", "split-pdf", "rotate-pdf", "organise-pages", "compress-pdf", "pdf-to-text"]);

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
    case "pdf-to-text": {
      const { browserTextItemReader } = await import("@/lib/pdf/text-items-browser");
      return [await pdfToText(inputs[0], options.breaks as PageBreaks, browserTextItemReader)];
    }
    case "compress-pdf": {
      // Loaded on demand: only the Compress tool needs the image recoder.
      const { browserRecoder } = await import("@/lib/pdf/recode-image-browser");
      const level = String(options.level).toLowerCase() as CompressLevel;
      return [await compressPdf(inputs[0], level, browserRecoder)];
    }
    default:
      throw new Error(`No processing for ${slug}`);
  }
}
