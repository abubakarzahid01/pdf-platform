import type { PageViewport } from "pdfjs-dist";
import type { PdfAnnotation, Rgb } from "@/lib/pdf/operations/annotate";

// Annotations while editing, in "view" coordinates: the page as displayed at 100%
// (rotation applied, origin top-left, 1 unit = 1 PDF point).
export type ViewAnnotation =
  | { id: string; page: number; type: "highlight"; x: number; y: number; w: number; h: number; color: string }
  | { id: string; page: number; type: "ink"; points: [number, number][]; color: string; width: number }
  | { id: string; page: number; type: "comment"; x: number; y: number; text: string };

export type NewAnnotation = ViewAnnotation extends infer A ? (A extends ViewAnnotation ? Omit<A, "id"> : never) : never;

export const COMMENT_SIZE = 20;

export const highlightColors = ["#ffd43b", "#8ce99a", "#ffa8d3", "#a5d8ff"];
export const inkColors = ["#1f2937", "#e03131", "#1971c2", "#2f9e44"];
export const inkWidths = [
  { value: 1.5, label: "Thin" },
  { value: 3, label: "Medium" },
  { value: 6, label: "Thick" },
];

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
export function toPdfAnnotation(a: ViewAnnotation, viewport: PageViewport): PdfAnnotation {
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

export function describe(a: ViewAnnotation) {
  return a.type === "highlight" ? "Highlight" : a.type === "ink" ? "Drawing" : "Comment";
}
