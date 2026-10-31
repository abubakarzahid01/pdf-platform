import { compressPdf, type CompressLevel } from "@/lib/pdf/operations/compress";
import { cropPdf } from "@/lib/pdf/operations/crop";
import { imagesToPdf, type ImagesToPdfOptions, type PdfReadyImage } from "@/lib/pdf/operations/images-to-pdf";
import { mergePdfs } from "@/lib/pdf/operations/merge";
import { organizePdf, type PagePlan } from "@/lib/pdf/operations/organize";
import { pdfToImages } from "@/lib/pdf/operations/pdf-to-images";
import { pdfToText, type PageBreaks } from "@/lib/pdf/operations/pdf-to-text";
import { pdfToSpreadsheet, type TableLayout } from "@/lib/pdf/operations/pdf-to-spreadsheet";
import { addPageNumbers, addWatermark, type NumberFormat, type NumberPosition, type WatermarkPosition } from "@/lib/pdf/operations/stamp";
import { rotatePdf, type RotateAngle, type RotateWhich } from "@/lib/pdf/operations/rotate";
import { splitPdf, type SplitMode } from "@/lib/pdf/operations/split";
import { OperationError, type InputPdf, type OutputFile } from "@/lib/pdf/operations/types";

// Tools whose processing is implemented. Everything runs in the browser.
export const runnableTools = new Set([
  "merge-pdf",
  "split-pdf",
  "rotate-pdf",
  "organise-pages",
  "compress-pdf",
  "pdf-to-text",
  "pdf-to-excel",
  "pdf-to-csv",
  "images-to-pdf",
  "pdf-to-images",
  "add-page-numbers",
  "add-watermark",
  "crop-pdf",
]);

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
    case "pdf-to-excel":
    case "pdf-to-csv": {
      const { browserTextItemReader } = await import("@/lib/pdf/text-items-browser");
      const layout: TableLayout = options.tables === "All in one sheet" ? "single" : "per-table";
      return pdfToSpreadsheet(inputs[0], slug === "pdf-to-excel" ? "xlsx" : "csv", layout, browserTextItemReader);
    }
    case "images-to-pdf": {
      const { prepareImage } = await import("@/lib/files/prepare-image");
      const images: PdfReadyImage[] = [];
      for (const input of inputs) {
        const prepared = await prepareImage(new Blob([input.bytes as BlobPart]));
        if (!prepared.ok) throw new OperationError(`${input.name}: ${prepared.message}`);
        images.push({ name: input.name, ...prepared.image });
      }
      return [await imagesToPdf(images, options as unknown as ImagesToPdfOptions)];
    }
    case "pdf-to-images": {
      const { openBrowserRenderer } = await import("@/lib/pdf/render-pages-browser");
      const dpi = Number(/(d+) DPI/.exec(String(options.quality))?.[1] ?? 150);
      return pdfToImages(inputs[0], options.format === "JPG" ? "jpeg" : "png", dpi, openBrowserRenderer);
    }
    case "add-page-numbers":
      return [
        await addPageNumbers(inputs[0], {
          position: options.position as NumberPosition,
          format: options.format as NumberFormat,
          start: Number(options.start),
          skipFirst: Boolean(options.skipFirst),
        }),
      ];
    case "add-watermark": {
      const { browserFontLoader } = await import("@/lib/pdf/fonts-browser");
      const opacity = parseInt(String(options.opacity), 10) / 100;
      return [await addWatermark(inputs[0], { text: String(options.text ?? ""), position: options.position as WatermarkPosition, opacity }, browserFontLoader)];
    }
    case "crop-pdf": {
      if (options.mode === "Remove white margins") {
        const { browserContentFinder } = await import("@/lib/pdf/content-bounds-browser");
        return [await cropPdf(inputs[0], { mode: "auto", findContent: browserContentFinder })];
      }
      const mm = (key: string) => {
        const value = Number(String(options[key] ?? "0").replace(",", "."));
        if (!Number.isFinite(value) || value < 0) throw new OperationError("Margins must be numbers of 0 or more, in millimetres.");
        return value;
      };
      return [await cropPdf(inputs[0], { mode: "margins", margins: { top: mm("top"), right: mm("right"), bottom: mm("bottom"), left: mm("left") } })];
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
