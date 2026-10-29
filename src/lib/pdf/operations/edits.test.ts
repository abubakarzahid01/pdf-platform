import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import jpegJs from "jpeg-js";
import { applyEdits, type FontLoader, type PdfText } from "./edits";
import { viewPointToPdf, viewRectToPdfPlacement, viewRectToPdfRect } from "../view-to-pdf";
import type { InputPdf } from "./types";

// PDF.js's Node build reads text back out of outputs, to prove the text is real and upright.
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const require = createRequire(import.meta.url);
const interFiles = {
  regular: "400Regular/Inter_400Regular.ttf",
  bold: "700Bold/Inter_700Bold.ttf",
  italic: "400Regular_Italic/Inter_400Regular_Italic.ttf",
  boldItalic: "700Bold_Italic/Inter_700Bold_Italic.ttf",
};
const loadFont: FontLoader = async (style) => new Uint8Array(readFileSync(require.resolve(`@expo-google-fonts/inter/${interFiles[style]}`)));

function fixture(name: string): InputPdf {
  return { name, bytes: new Uint8Array(readFileSync(new URL(`../../../../test-files/${name}`, import.meta.url))) };
}

async function pageText(bytes: Uint8Array, pageNumber: number) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false }).promise;
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = content.items.filter((i) => "str" in i && i.str.trim()) as { str: string; transform: number[]; fontName: string }[];
  const result = items.map((i) => {
    // Combine with the viewport to see the text as displayed: [a, b] = direction of writing.
    const [a, b] = pdfjs.Util.transform(viewport.transform, i.transform);
    return { str: i.str, upright: a > 0 && Math.abs(b) < 0.01, font: content.styles[i.fontName]?.fontFamily };
  });
  await doc.loadingTask.destroy();
  return result;
}

const base: Omit<PdfText, "lines" | "page"> = { family: "helvetica", bold: false, italic: false, size: 14, color: [0.1, 0.1, 0.1], rotate: 0 };

describe("applyEdits", () => {
  it("writes real, extractable text with a standard font", async () => {
    const result = await applyEdits(
      fixture("sample-3-pages.pdf"),
      { texts: [{ ...base, page: 0, lines: [{ text: "Approved by finance", x: 60, y: 300 }, { text: "Second line", x: 60, y: 282 }] }], annotations: [] },
      loadFont,
    );
    expect(result.substitutions).toBe(0);
    expect(result.name).toBe("sample-3-pages-edited.pdf");
    const strings = (await pageText(result.bytes, 1)).map((t) => t.str);
    expect(strings).toContain("Approved by finance");
    expect(strings).toContain("Second line");
  });

  it("switches to Inter for characters standard fonts can't show, and reports it", async () => {
    const text = "Zażółć gęślą jaźń — Ωμέγα";
    const result = await applyEdits(
      fixture("sample-3-pages.pdf"),
      { texts: [{ ...base, page: 0, lines: [{ text, x: 60, y: 300 }] }], annotations: [] },
      loadFont,
    );
    expect(result.substitutions).toBe(1);
    expect((await pageText(result.bytes, 1)).map((t) => t.str).join("")).toContain(text);
  });

  it("embeds Inter in all four styles, each font only once", async () => {
    const texts = (["regular", "bold", "italic", "boldItalic"] as const).map((s, i) => ({
      ...base,
      family: "inter" as const,
      bold: s.startsWith("bold"),
      italic: s.toLowerCase().includes("italic"),
      page: 0,
      lines: [{ text: `Inter ${s}`, x: 60, y: 400 - i * 20 }],
    }));
    const input = fixture("sample-3-pages.pdf");
    const result = await applyEdits(input, { texts, annotations: [] }, loadFont);
    expect((await pageText(result.bytes, 1)).map((t) => t.str)).toEqual(expect.arrayContaining(texts.map((t) => t.lines[0].text)));
    // Full fonts are embedded (subsetting damaged glyphs). Four styles are about 1.3 MB of
    // font data, stored compressed; each must be embedded once, not once per text box.
    expect(result.bytes.length - input.bytes.length).toBeLessThan(1.4 * 1024 * 1024);
  });

  it("keeps text upright on a rotated page when rotated to match", async () => {
    // mixed-sizes page 3 is a Letter page with /Rotate 90.
    const result = await applyEdits(
      fixture("mixed-sizes.pdf"),
      { texts: [{ ...base, page: 2, rotate: 90, lines: [{ text: "Upright note", x: 300, y: 300 }] }], annotations: [] },
      loadFont,
    );
    const note = (await pageText(result.bytes, 3)).find((t) => t.str === "Upright note");
    expect(note?.upright).toBe(true);

    // Control: without the counter-rotation the same text would appear sideways.
    const sideways = await applyEdits(
      fixture("mixed-sizes.pdf"),
      { texts: [{ ...base, page: 2, rotate: 0, lines: [{ text: "Sideways note", x: 300, y: 300 }] }], annotations: [] },
      loadFont,
    );
    expect((await pageText(sideways.bytes, 3)).find((t) => t.str === "Sideways note")?.upright).toBe(false);
  });

  describe("images", () => {
    const jpeg = jpegJs.encode({ data: new Uint8Array(40 * 20 * 4).fill(180), width: 40, height: 20 }, 90).data;

    // Where the image appears on the displayed page: maps the image's top-left and
    // bottom-right corners through the drawing commands and the page's display transform.
    async function displayedImage(bytes: Uint8Array, pageNumber: number) {
      const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const ops = await page.getOperatorList();
      let ctm = [1, 0, 0, 1, 0, 0];
      const stack: number[][] = [];
      let found: number[] | null = null;
      ops.fnArray.forEach((fn, i) => {
        if (fn === pdfjs.OPS.save) stack.push(ctm);
        else if (fn === pdfjs.OPS.restore) ctm = stack.pop() ?? ctm;
        else if (fn === pdfjs.OPS.transform) ctm = pdfjs.Util.transform(ctm, ops.argsArray[i]);
        else if (fn === pdfjs.OPS.paintImageXObject && !found) found = pdfjs.Util.transform(viewport.transform, ctm);
      });
      await doc.loadingTask.destroy();
      if (!found) return null;
      const m = found as number[];
      const apply = (x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]].map((v) => Math.round(v));
      // Image space: (0,1) is the image's top-left, (1,0) its bottom-right.
      return { topLeft: apply(0, 1), bottomRight: apply(1, 0) };
    }

    async function placeAt(file: string, pageIndex: number, rect: { x: number; y: number; w: number; h: number }) {
      const input = fixture(file);
      const src = await pdfjs.getDocument({ data: input.bytes.slice() }).promise;
      const viewport = (await src.getPage(pageIndex + 1)).getViewport({ scale: 1 });
      const placement = viewRectToPdfPlacement(rect, viewport);
      await src.loadingTask.destroy();
      return applyEdits(input, { texts: [], annotations: [], images: [{ page: pageIndex, bytes: jpeg, format: "jpeg", ...placement }] }, loadFont);
    }

    it("places an image exactly where it was shown on a normal page", async () => {
      const result = await placeAt("sample-3-pages.pdf", 0, { x: 100, y: 150, w: 200, h: 100 });
      expect(await displayedImage(result.bytes, 1)).toEqual({ topLeft: [100, 150], bottomRight: [300, 250] });
    });

    it("places it upright and in the same spot on a rotated page", async () => {
      // mixed-sizes page 3: Letter with /Rotate 90, displayed 792 wide × 612 high.
      const result = await placeAt("mixed-sizes.pdf", 2, { x: 120, y: 80, w: 300, h: 150 });
      expect(await displayedImage(result.bytes, 3)).toEqual({ topLeft: [120, 80], bottomRight: [420, 230] });
    });

    it("embeds an image used twice only once", async () => {
      const once = await applyEdits(fixture("sample-3-pages.pdf"), { texts: [], annotations: [], images: [{ page: 0, bytes: jpeg, format: "jpeg", x: 10, y: 10, width: 40, height: 20, rotate: 0 }] }, loadFont);
      const twice = await applyEdits(
        fixture("sample-3-pages.pdf"),
        { texts: [], annotations: [], images: [0, 1].map((page) => ({ page, bytes: jpeg, format: "jpeg" as const, x: 10, y: 10, width: 40, height: 20, rotate: 0 })) },
        loadFont,
      );
      expect(twice.bytes.length - once.bytes.length).toBeLessThan(jpeg.length);
    });

    it("rejects image data that isn't really an image", async () => {
      await expect(
        applyEdits(fixture("sample-3-pages.pdf"), { texts: [], annotations: [], images: [{ page: 0, bytes: new Uint8Array([1, 2, 3]), format: "png", x: 0, y: 0, width: 10, height: 10, rotate: 0 }] }, loadFont),
      ).rejects.toThrow("couldn't be read");
    });
  });

  describe("shapes and links", () => {
    type ViewRect = { x: number; y: number; w: number; h: number };

    async function viewportOf(file: string, pageIndex: number) {
      const src = await pdfjs.getDocument({ data: fixture(file).bytes.slice() }).promise;
      const viewport = (await src.getPage(pageIndex + 1)).getViewport({ scale: 1 });
      await src.loadingTask.destroy();
      return viewport;
    }

    // Bounding boxes of drawn paths as they appear on the displayed page.
    async function displayedPaths(bytes: Uint8Array, pageNumber: number) {
      const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const ops = await page.getOperatorList();
      let ctm = [1, 0, 0, 1, 0, 0];
      const stack: number[][] = [];
      const boxes: number[][] = [];
      ops.fnArray.forEach((fn, i) => {
        if (fn === pdfjs.OPS.save) stack.push(ctm);
        else if (fn === pdfjs.OPS.restore) ctm = stack.pop() ?? ctm;
        else if (fn === pdfjs.OPS.transform) ctm = pdfjs.Util.transform(ctm, ops.argsArray[i]);
        else if (fn === pdfjs.OPS.constructPath) {
          const [x1, y1, x2, y2] = Array.from(ops.argsArray[i][2] as ArrayLike<number>);
          const m = pdfjs.Util.transform(viewport.transform, ctm);
          const pts = [[x1, y1], [x2, y1], [x1, y2], [x2, y2]].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
          const xs = pts.map((p) => p[0]);
          const ys = pts.map((p) => p[1]);
          boxes.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(Math.round));
        }
      });
      await doc.loadingTask.destroy();
      return boxes;
    }

    const red: [number, number, number] = [0.9, 0.2, 0.2];

    async function drawRect(file: string, pageIndex: number, kind: "rect" | "ellipse", r: ViewRect) {
      const viewport = await viewportOf(file, pageIndex);
      const box = viewRectToPdfRect(r, viewport);
      return applyEdits(fixture(file), { texts: [], annotations: [], shapes: [{ page: pageIndex, kind, ...box, stroke: red, lineWidth: 2, fill: red }] }, loadFont);
    }

    it("draws a rectangle exactly where it was shown, on normal and rotated pages", async () => {
      const normal = await drawRect("sample-3-pages.pdf", 0, "rect", { x: 100, y: 150, w: 200, h: 80 });
      expect(await displayedPaths(normal.bytes, 1)).toContainEqual([100, 150, 300, 230]);
      const rotated = await drawRect("mixed-sizes.pdf", 2, "rect", { x: 120, y: 80, w: 300, h: 150 });
      expect(await displayedPaths(rotated.bytes, 3)).toContainEqual([120, 80, 420, 230]);
    });

    it("draws an ellipse within its box on a rotated page", async () => {
      const result = await drawRect("mixed-sizes.pdf", 2, "ellipse", { x: 200, y: 100, w: 240, h: 120 });
      expect(await displayedPaths(result.bytes, 3)).toContainEqual([200, 100, 440, 220]);
    });

    it("draws lines and arrows between the right end points", async () => {
      const viewport = await viewportOf("mixed-sizes.pdf", 2);
      const [x1, y1] = viewPointToPdf(100, 100, viewport);
      const [x2, y2] = viewPointToPdf(400, 300, viewport);
      const result = await applyEdits(
        fixture("mixed-sizes.pdf"),
        { texts: [], annotations: [], shapes: [{ page: 2, kind: "arrow", x1, y1, x2, y2, stroke: red, lineWidth: 3 }] },
        loadFont,
      );
      const boxes = await displayedPaths(result.bytes, 3);
      expect(boxes).toContainEqual([100, 100, 400, 300]); // the shaft
      expect(boxes).toHaveLength(3); // shaft plus two arrowhead strokes
      // The arrowhead strokes start at the arrow's end point.
      for (const head of boxes.slice(1)) expect(head[2] === 400 || head[3] === 300).toBe(true);
    });

    it("creates web and page links that viewers can follow", async () => {
      const viewport = await viewportOf("sample-3-pages.pdf", 0);
      const toRect = (r: ViewRect) => {
        const b = viewRectToPdfRect(r, viewport);
        return [b.x, b.y, b.x + b.width, b.y + b.height] as [number, number, number, number];
      };
      const result = await applyEdits(
        fixture("sample-3-pages.pdf"),
        {
          texts: [],
          annotations: [
            { type: "link", page: 0, rect: toRect({ x: 60, y: 100, w: 150, h: 20 }), url: "https://example.com/report" },
            { type: "link", page: 0, rect: toRect({ x: 60, y: 140, w: 150, h: 20 }), targetPage: 2 },
          ],
        },
        loadFont,
      );
      const doc = await pdfjs.getDocument({ data: result.bytes.slice() }).promise;
      const page = await doc.getPage(1);
      const links = (await page.getAnnotations()).filter((a) => a.subtype === "Link");
      // Displayed box of a link: convert both corners and order them.
      const shown = (rect: number[]) => {
        const vp = page.getViewport({ scale: 1 });
        const [ax, ay] = vp.convertToViewportPoint(rect[0], rect[1]);
        const [bx, by] = vp.convertToViewportPoint(rect[2], rect[3]);
        return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)].map(Math.round);
      };
      expect(links[0].url).toBe("https://example.com/report");
      expect(shown(links[0].rect)).toEqual([60, 100, 210, 120]);
      expect(await doc.getPageIndex(links[1].dest[0])).toBe(2);
      await doc.loadingTask.destroy();
    });

    it("refuses links that could run code", async () => {
      await expect(
        applyEdits(
          fixture("sample-3-pages.pdf"),
          { texts: [], annotations: [{ type: "link", page: 0, rect: [10, 10, 50, 30], url: "javascript:alert(1)" }] },
          loadFont,
        ),
      ).rejects.toThrow("Links can only point to web");
    });
  });

  it("adds annotations in the same pass and skips empty text", async () => {
    const result = await applyEdits(
      fixture("sample-3-pages.pdf"),
      {
        texts: [{ ...base, page: 1, lines: [{ text: "", x: 10, y: 10 }] }],
        annotations: [{ type: "comment", page: 1, at: [100, 100], text: "Looks good" }],
      },
      loadFont,
    );
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(result.bytes);
    expect(doc.getPage(1).node.Annots()?.size()).toBe(1);
  });
});
