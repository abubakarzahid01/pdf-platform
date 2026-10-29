import type { PageViewport } from "pdfjs-dist";
import type { PdfAnnotation, Rgb } from "@/lib/pdf/operations/annotate";
import type { FontFamily, PdfText } from "@/lib/pdf/operations/edits";

// Items placed while editing, in "view" coordinates: the page as displayed at 100%
// (rotation applied, origin top-left, 1 unit = 1 PDF point).
// Text boxes become page content; the others become PDF annotations.
export type TextStyle = { family: FontFamily; size: number; color: string; bold: boolean; italic: boolean };

export type ViewAnnotation =
  | { id: string; page: number; type: "highlight"; x: number; y: number; w: number; h: number; color: string }
  | { id: string; page: number; type: "ink"; points: [number, number][]; color: string; width: number }
  | { id: string; page: number; type: "comment"; x: number; y: number; text: string }
  | ({ id: string; page: number; type: "text"; x: number; y: number; text: string } & TextStyle);

export type NewAnnotation = ViewAnnotation extends infer A ? (A extends ViewAnnotation ? Omit<A, "id"> : never) : never;

export const COMMENT_SIZE = 20;

export const highlightColors = ["#ffd43b", "#8ce99a", "#ffa8d3", "#a5d8ff"];
export const inkColors = ["#1f2937", "#e03131", "#1971c2", "#2f9e44"];
export const textColors = ["#111827", "#e03131", "#1971c2", "#2f9e44", "#5a47e0"];
export const inkWidths = [
  { value: 1.5, label: "Thin" },
  { value: 3, label: "Medium" },
  { value: 6, label: "Thick" },
];
export const textSizes = [8, 10, 12, 14, 16, 18, 24, 32, 48, 72];
export const fontFamilies: { value: FontFamily; label: string; css: string }[] = [
  { value: "helvetica", label: "Helvetica", css: "Helvetica, Arial, sans-serif" },
  { value: "times", label: "Times", css: "'Times New Roman', Times, serif" },
  { value: "courier", label: "Courier", css: "'Courier New', Courier, monospace" },
  { value: "inter", label: "Inter (all languages)", css: "var(--font-inter), Inter, sans-serif" },
];
export const defaultTextStyle: TextStyle = { family: "helvetica", size: 14, color: textColors[0], bold: false, italic: false };

// Shared text layout so the editor shows exactly where the PDF text will be drawn.
export const TEXT_ASCENT = 0.8; // baseline sits this far below the top of a line, times font size
export const TEXT_LINE_HEIGHT = 1.25;

export function textLines(text: string) {
  return text.split("\n");
}

export function cssFont(style: TextStyle) {
  const family = fontFamilies.find((f) => f.value === style.family)?.css ?? "sans-serif";
  return `${style.italic ? "italic " : ""}${style.bold ? 700 : 400} ${style.size}px ${family}`;
}

let measureContext: CanvasRenderingContext2D | null = null;

// Width of the widest line, measured with the browser's text metrics.
export function measureText(text: string, style: TextStyle) {
  measureContext ??= document.createElement("canvas").getContext("2d");
  if (!measureContext) return text.length * style.size * 0.55;
  measureContext.font = cssFont(style);
  return Math.max(...textLines(text).map((l) => measureContext!.measureText(l).width), style.size * 0.5);
}

let counter = 0;
export function newId() {
  counter += 1;
  return `a${Date.now().toString(36)}${counter}`;
}

function hexToRgb(hex: string): Rgb {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

// Converts an editor annotation to PDF coordinates, accounting for page rotation.
export function toPdfAnnotation(a: Exclude<ViewAnnotation, { type: "text" }>, viewport: PageViewport): PdfAnnotation {
  const pt = (x: number, y: number) => viewport.convertToPdfPoint(x, y) as [number, number];
  switch (a.type) {
    case "highlight": {
      const [x1, y1] = pt(a.x, a.y);
      const [x2, y2] = pt(a.x + a.w, a.y + a.h);
      return { type: "highlight", page: a.page, rect: [x1, y1, x2, y2], color: hexToRgb(a.color) };
    }
    case "ink":
      return { type: "ink", page: a.page, points: a.points.map(([x, y]) => pt(x, y)), color: hexToRgb(a.color), width: a.width };
    case "comment":
      return { type: "comment", page: a.page, at: pt(a.x, a.y), text: a.text };
  }
}

// Converts a text box: each line's baseline start is converted separately, and the
// text is turned to cancel the page's rotation so it reads upright.
export function toPdfText(a: Extract<ViewAnnotation, { type: "text" }>, viewport: PageViewport): PdfText {
  const lines = textLines(a.text).map((text, i) => {
    const [x, y] = viewport.convertToPdfPoint(a.x, a.y + a.size * (TEXT_ASCENT + i * TEXT_LINE_HEIGHT)) as [number, number];
    return { text, x, y };
  });
  return {
    page: a.page,
    lines,
    family: a.family,
    bold: a.bold,
    italic: a.italic,
    size: a.size,
    color: hexToRgb(a.color),
    rotate: ((viewport.rotation % 360) + 360) % 360,
  };
}

// Moves any item by (dx, dy) in view units.
export function translate(a: ViewAnnotation, dx: number, dy: number): ViewAnnotation {
  if (a.type === "ink") return { ...a, points: a.points.map(([x, y]) => [x + dx, y + dy] as [number, number]) };
  return { ...a, x: a.x + dx, y: a.y + dy };
}

export function describe(a: ViewAnnotation) {
  return { highlight: "Highlight", ink: "Drawing", comment: "Comment", text: "Text" }[a.type];
}
