import {
  Combine,
  Crop,
  FileImage,
  FileInput,
  FileOutput,
  FilePen,
  FileSpreadsheet,
  FileText,
  FileType,
  Hash,
  Images,
  LayoutGrid,
  Lock,
  Minimize2,
  Presentation,
  RotateCw,
  Scissors,
  ReceiptText,
  Stamp,
  Table,
  type LucideIcon,
} from "lucide-react";
import type { FileKind } from "@/lib/files/detect-type";

// The full tool catalogue. Homepage cards, navigation and tool pages read from here.

export type ToolCategory =
  | "edit"
  | "organise"
  | "convert-to"
  | "convert-from"
  | "extract"
  | "security";

export type ToolTone = "brand" | "info" | "neutral";

export type Tool = {
  slug: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: LucideIcon;
  tone: ToolTone;
  popular?: boolean;
};

export const categories: { id: ToolCategory; label: string }[] = [
  { id: "edit", label: "Edit" },
  { id: "organise", label: "Organise" },
  { id: "convert-to", label: "Convert to PDF" },
  { id: "convert-from", label: "Convert from PDF" },
  { id: "extract", label: "Extract data" },
  { id: "security", label: "Security" },
];

export const tools: Tool[] = [
  // Edit
  { slug: "edit-pdf", name: "Edit PDF", description: "Change text, add images, shapes and comments.", category: "edit", icon: FilePen, tone: "brand", popular: true },

  // Organise
  { slug: "merge-pdf", name: "Merge PDF", description: "Combine several PDFs into one file.", category: "organise", icon: Combine, tone: "info", popular: true },
  { slug: "split-pdf", name: "Split PDF", description: "Extract pages or split into several files.", category: "organise", icon: Scissors, tone: "info", popular: true },
  { slug: "compress-pdf", name: "Compress PDF", description: "Reduce file size while keeping quality.", category: "organise", icon: Minimize2, tone: "info", popular: true },
  { slug: "organise-pages", name: "Organise pages", description: "Reorder, rotate and delete pages.", category: "organise", icon: LayoutGrid, tone: "info", popular: true },
  { slug: "rotate-pdf", name: "Rotate PDF", description: "Rotate some or all pages.", category: "organise", icon: RotateCw, tone: "info" },
  { slug: "crop-pdf", name: "Crop PDF", description: "Trim margins or select a page area.", category: "organise", icon: Crop, tone: "info" },
  { slug: "add-page-numbers", name: "Add page numbers", description: "Number pages with your chosen position and style.", category: "organise", icon: Hash, tone: "info" },
  { slug: "add-watermark", name: "Add watermark", description: "Stamp text or an image across pages.", category: "organise", icon: Stamp, tone: "info" },

  // Convert to PDF
  { slug: "word-to-pdf", name: "Word to PDF", description: "DOC and DOCX to PDF with layout preserved.", category: "convert-to", icon: FileInput, tone: "neutral", popular: true },
  { slug: "excel-to-pdf", name: "Excel to PDF", description: "Choose sheets, orientation and scaling.", category: "convert-to", icon: FileSpreadsheet, tone: "neutral", popular: true },
  { slug: "powerpoint-to-pdf", name: "PowerPoint to PDF", description: "Slides, images and charts to PDF.", category: "convert-to", icon: Presentation, tone: "neutral", popular: true },
  { slug: "images-to-pdf", name: "Images to PDF", description: "JPG, PNG and more into one PDF.", category: "convert-to", icon: Images, tone: "neutral", popular: true },

  // Convert from PDF
  { slug: "pdf-to-word", name: "PDF to Word", description: "Turn PDFs into editable DOCX files.", category: "convert-from", icon: FileOutput, tone: "neutral", popular: true },
  { slug: "pdf-to-excel", name: "PDF to Excel", description: "Pull tables into XLSX spreadsheets.", category: "convert-from", icon: Table, tone: "neutral", popular: true },
  { slug: "pdf-to-powerpoint", name: "PDF to PowerPoint", description: "Turn pages into presentation slides.", category: "convert-from", icon: Presentation, tone: "neutral" },
  { slug: "pdf-to-csv", name: "PDF to CSV", description: "Export tables as CSV files.", category: "convert-from", icon: FileType, tone: "neutral" },
  { slug: "pdf-to-images", name: "PDF to images", description: "Save pages as PNG or JPG.", category: "convert-from", icon: FileImage, tone: "neutral" },
  { slug: "pdf-to-text", name: "PDF to text", description: "Extract the readable text.", category: "convert-from", icon: FileText, tone: "neutral" },

  // Extract data
  { slug: "invoice-to-excel", name: "Invoice to Excel", description: "Supplier, invoice no., date and totals from many invoices into one spreadsheet.", category: "extract", icon: ReceiptText, tone: "brand", popular: true },

  // Security
  { slug: "protect-pdf", name: "Protect PDF", description: "Add a password to your document.", category: "security", icon: Lock, tone: "neutral" },
];

export const popularTools = tools.filter((t) => t.popular);

export function getTool(slug: string) {
  return tools.find((t) => t.slug === slug);
}

// What each tool accepts. `accept` only filters the file picker; real validation
// of file contents happens on upload (Phase 3), never trusting the extension alone.
export type InputSpec = {
  accept: string;
  label: string;
  // File types allowed after checking the file's actual bytes.
  kinds: FileKind[];
  // Used in error messages: "This file isn't <expected>".
  expected: string;
  multiple: boolean;
};

const inputSpecs: Record<string, Omit<InputSpec, "multiple">> = {
  "word-to-pdf": { accept: ".doc,.docx,.odt,.rtf,.txt", label: "DOC, DOCX, ODT, RTF or TXT", kinds: ["zip", "ole", "rtf", "text"], expected: "a Word document" },
  "excel-to-pdf": { accept: ".xls,.xlsx,.ods", label: "XLS, XLSX or ODS", kinds: ["zip", "ole"], expected: "an Excel workbook" },
  "powerpoint-to-pdf": { accept: ".ppt,.pptx,.odp", label: "PPT, PPTX or ODP", kinds: ["zip", "ole"], expected: "a PowerPoint presentation" },
  "images-to-pdf": { accept: ".jpg,.jpeg,.png,.webp,.gif,.bmp", label: "JPG, PNG, WEBP, GIF or BMP", kinds: ["png", "jpeg", "gif", "webp", "bmp"], expected: "an image" },
};

const pdfInput: Omit<InputSpec, "multiple"> = { accept: ".pdf,application/pdf", label: "PDF", kinds: ["pdf"], expected: "a PDF" };

const multiFileTools = new Set(["merge-pdf", "images-to-pdf", "invoice-to-excel"]);

export function getInputSpec(slug: string): InputSpec {
  return { ...(inputSpecs[slug] ?? pdfInput), multiple: multiFileTools.has(slug) };
}

export function getRelatedTools(tool: Tool, count = 3) {
  return tools.filter((t) => t.category === tool.category && t.slug !== tool.slug).slice(0, count);
}
