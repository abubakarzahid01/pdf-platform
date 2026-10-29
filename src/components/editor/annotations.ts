import type { PageViewport } from "pdfjs-dist";
import { isSafeUrl, type PdfAnnotation, type Rgb } from "@/lib/pdf/operations/annotate";
import type { FontFamily, PdfImage, PdfShape, PdfText } from "@/lib/pdf/operations/edits";
import { normalisedRotation, viewPointToPdf, viewRectToPdfPlacement, viewRectToPdfRect } from "@/lib/pdf/view-to-pdf";

// Items placed while editing, in "view" coordinates: the page as displayed at 100%
// (rotation applied, origin top-left, 1 unit = 1 PDF point).
// Text boxes become page content; the others become PDF annotations.
export type TextStyle = { family: FontFamily; size: number; color: string; bold: boolean; italic: boolean };

export type ViewAnnotation =
  | { id: string; page: number; type: "highlight"; x: number; y: number; w: number; h: number; color: string }
  | { id: string; page: number; type: "ink"; points: [number, number][]; color: string; width: number }
  | { id: string; page: number; type: "comment"; x: number; y: number; text: string }
  | ({ id: string; page: number; type: "text"; x: number; y: number; text: string } & TextStyle)
  // `src` is a temporary local URL for display; `bytes` is what gets embedded in the PDF.
  | { id: string; page: number; type: "image"; x: number; y: number; w: number; h: number; src: string; bytes: Uint8Array; format: "png" | "jpeg"; name: string }
  // Shapes keep the two points they were dragged between; rectangles and ellipses fill that box.
  | ({ id: string; page: number; type: "shape"; x1: number; y1: number; x2: number; y2: number } & ShapeStyle)
  // A link either opens a web address or jumps to a page (zero-based).
  | { id: string; page: number; type: "link"; x: number; y: number; w: number; h: number; mode: "url" | "page"; url: string; targetPage: number }
  // A change to an existing line. The box covers the original line; the PDF line is removed on save.
  | {
      id: string;
      page: number;
      type: "lineEdit";
      lineId: number;
      original: string;
      text: string;
      x: number;
      y: number;
      w: number;
      h: number;
      baseline: number;
      size: number;
      fontCss: string;
      bold: boolean;
      italic: boolean;
      color: string;
    };

// An existing line that can be edited, in view coordinates.
export type EditableLine = { id: number; text: string; x: number; y: number; w: number; h: number; baseline: number; size: number; baseFont: string; bold: boolean; italic: boolean; color: string };

// A similar on-screen font for a font name found in a PDF.
export function cssFamilyFor(baseFont: string) {
  if (/courier|mono/i.test(baseFont)) return "'Courier New', Courier, monospace";
  if (/times|serif|georgia|garamond|cambria/i.test(baseFont) && !/sans/i.test(baseFont)) return "'Times New Roman', Times, serif";
  return "Arial, Helvetica, sans-serif";
}

export function rgbToHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export type ShapeKind = "rect" | "ellipse" | "line" | "arrow";
export type ShapeStyle = { kind: ShapeKind; color: string; lineWidth: number; fill: boolean };

export const shapeKinds: { value: ShapeKind; label: string }[] = [
  { value: "rect", label: "Rectangle" },
  { value: "ellipse", label: "Ellipse" },
  { value: "line", label: "Line" },
  { value: "arrow", label: "Arrow" },
];
export const defaultShapeStyle: ShapeStyle = { kind: "rect", color: "#e03131", lineWidth: 3, fill: false };
export const SHAPE_FILL_OPACITY = 0.25;
export const ARROW_HEAD_ANGLE = (28 * Math.PI) / 180;

// Arrowhead stroke end points for an arrow from (x1,y1) to (x2,y2); same geometry as the saved PDF.
export function arrowHead(x1: number, y1: number, x2: number, y2: number, lineWidth: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = Math.max(8, lineWidth * 4);
  return [-1, 1].map((side) => {
    const a = angle + Math.PI - side * ARROW_HEAD_ANGLE;
    return [x2 + head * Math.cos(a), y2 + head * Math.sin(a)] as [number, number];
  });
}

// Accepts what people type ("example.com", "name@example.com") and returns a safe link,
// or null when it isn't a web or email address.
export function normaliseUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  let url = value;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) url = value.includes("@") && !value.includes("/") ? `mailto:${value}` : `https://${value}`;
  return isSafeUrl(url) ? url : null;
}

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

// Converts a placed image, keeping it upright and in place on rotated pages.
export function toPdfImage(a: Extract<ViewAnnotation, { type: "image" }>, viewport: PageViewport): PdfImage {
  return { page: a.page, bytes: a.bytes, format: a.format, ...viewRectToPdfPlacement(a, viewport) };
}

export function shapeBox(a: Extract<ViewAnnotation, { type: "shape" }>) {
  return { x: Math.min(a.x1, a.x2), y: Math.min(a.y1, a.y2), w: Math.abs(a.x2 - a.x1), h: Math.abs(a.y2 - a.y1) };
}

export function toPdfShape(a: Extract<ViewAnnotation, { type: "shape" }>, viewport: PageViewport): PdfShape {
  const style = { page: a.page, stroke: hexToRgb(a.color), lineWidth: a.lineWidth };
  if (a.kind === "line" || a.kind === "arrow") {
    const [x1, y1] = viewPointToPdf(a.x1, a.y1, viewport);
    const [x2, y2] = viewPointToPdf(a.x2, a.y2, viewport);
    return { ...style, kind: a.kind, x1, y1, x2, y2 };
  }
  return { ...style, kind: a.kind, ...viewRectToPdfRect(shapeBox(a), viewport), fill: a.fill ? hexToRgb(a.color) : null };
}

// A link with no valid destination is left out (null); the editor warns about it.
export function toPdfLink(a: Extract<ViewAnnotation, { type: "link" }>, viewport: PageViewport, pageCount: number): PdfAnnotation | null {
  const box = viewRectToPdfRect(a, viewport);
  const rect: [number, number, number, number] = [box.x, box.y, box.x + box.width, box.y + box.height];
  if (a.mode === "page") return a.targetPage >= 0 && a.targetPage < pageCount ? { type: "link", page: a.page, rect, targetPage: a.targetPage } : null;
  const url = normaliseUrl(a.url);
  return url ? { type: "link", page: a.page, rect, url } : null;
}

// Converts an editor annotation to PDF coordinates, accounting for page rotation.
export function toPdfAnnotation(a: Extract<ViewAnnotation, { type: "highlight" | "ink" | "comment" }>, viewport: PageViewport): PdfAnnotation {
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
    rotate: normalisedRotation(viewport),
  };
}

// Moves any item by (dx, dy) in view units.
export function translate(a: ViewAnnotation, dx: number, dy: number): ViewAnnotation {
  if (a.type === "lineEdit") return a; // edited lines stay where the original line was
  if (a.type === "ink") return { ...a, points: a.points.map(([x, y]) => [x + dx, y + dy] as [number, number]) };
  if (a.type === "shape") return { ...a, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy };
  return { ...a, x: a.x + dx, y: a.y + dy };
}

export function describe(a: ViewAnnotation) {
  if (a.type === "shape") return shapeKinds.find((k) => k.value === a.kind)?.label ?? "Shape";
  return { highlight: "Highlight", ink: "Drawing", comment: "Comment", text: "Text", image: "Image", link: "Link", lineEdit: "Edited text" }[a.type];
}
