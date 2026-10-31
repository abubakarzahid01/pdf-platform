import { degrees, type PDFPage } from "pdf-lib";

// A page as the reader sees it: rotation applied, origin at the bottom-left of the visible
// area (the crop box), y going up. `toPdf` turns such a point into the page's own
// coordinates, and `rotate` turns drawn text so it reads upright on screen.
export type PageFrame = {
  width: number;
  height: number;
  toPdf: (u: number, v: number) => { x: number; y: number };
  rotate: ReturnType<typeof degrees>;
};

export function pageFrame(page: PDFPage): PageFrame {
  const box = page.getCropBox();
  const r = (((page.getRotation().angle % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  const { x: x0, y: y0, width: w, height: h } = box;
  // Viewers turn the page clockwise by `r`; these undo that turn.
  const map: Record<typeof r, (u: number, v: number) => [number, number]> = {
    0: (u, v) => [u, v],
    90: (u, v) => [w - v, u],
    180: (u, v) => [w - u, h - v],
    270: (u, v) => [v, h - u],
  };
  const sideways = r === 90 || r === 270;
  return {
    width: sideways ? h : w,
    height: sideways ? w : h,
    toPdf: (u, v) => {
      const [x, y] = map[r](u, v);
      return { x: x0 + x, y: y0 + y };
    },
    rotate: degrees(r),
  };
}
