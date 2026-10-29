// Converts positions from the editor's "view" space (page as displayed at 100%,
// origin top-left, rotation applied) to PDF coordinates. Shared by the editor and tests.

// The parts of PDF.js's PageViewport this needs.
export type ViewportLike = {
  rotation: number;
  convertToPdfPoint: (x: number, y: number) => number[];
};

export function normalisedRotation(viewport: ViewportLike) {
  return ((viewport.rotation % 360) + 360) % 360;
}

export function viewPointToPdf(x: number, y: number, viewport: ViewportLike): [number, number] {
  const [px, py] = viewport.convertToPdfPoint(x, y);
  return [px, py];
}

// The PDF-space box covering a rectangle shown on screen (pages rotate in 90° steps,
// so the box stays axis-aligned). Returns its bottom-left corner and size.
export function viewRectToPdfRect(rect: { x: number; y: number; w: number; h: number }, viewport: ViewportLike) {
  const [x1, y1] = viewPointToPdf(rect.x, rect.y, viewport);
  const [x2, y2] = viewPointToPdf(rect.x + rect.w, rect.y + rect.h, viewport);
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

// For a rectangle shown on screen, returns the PDF point of its on-screen bottom-left
// corner plus the rotation, which is what pdf-lib's drawImage needs to draw it upright.
export function viewRectToPdfPlacement(rect: { x: number; y: number; w: number; h: number }, viewport: ViewportLike) {
  const [x, y] = viewport.convertToPdfPoint(rect.x, rect.y + rect.h);
  return { x, y, width: rect.w, height: rect.h, rotate: normalisedRotation(viewport) };
}
