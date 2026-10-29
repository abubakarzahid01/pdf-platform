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

// For a rectangle shown on screen, returns the PDF point of its on-screen bottom-left
// corner plus the rotation, which is what pdf-lib's drawImage needs to draw it upright.
export function viewRectToPdfPlacement(rect: { x: number; y: number; w: number; h: number }, viewport: ViewportLike) {
  const [x, y] = viewport.convertToPdfPoint(rect.x, rect.y + rect.h);
  return { x, y, width: rect.w, height: rect.h, rotate: normalisedRotation(viewport) };
}
