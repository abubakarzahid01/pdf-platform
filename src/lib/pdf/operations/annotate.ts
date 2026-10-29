import { PDFDocument, PDFHexString, PDFString, type PDFContext } from "pdf-lib";
import { baseName, OperationError, type InputPdf, type OutputFile } from "./types";

// Annotations in PDF coordinates (points, origin bottom-left). Colours are 0-1 RGB.
export type Rgb = [number, number, number];

export type PdfAnnotation =
  | { type: "highlight"; page: number; rect: [number, number, number, number]; color: Rgb }
  | { type: "ink"; page: number; points: [number, number][]; color: Rgb; width: number }
  | { type: "comment"; page: number; at: [number, number]; text: string }
  // A clickable area: opens a web address or jumps to another page (zero-based).
  | { type: "link"; page: number; rect: [number, number, number, number]; url?: string; targetPage?: number };

// Only these link types are allowed; others (e.g. javascript:) could run code in viewers.
export function isSafeUrl(url: string) {
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

const PRINT_FLAG = 4;
const NO_ZOOM_NO_ROTATE = 8 | 16;
const COMMENT_ICON = 20;

const n = (v: number) => Number(v.toFixed(2)).toString();
const rgb = (c: Rgb) => c.map(n).join(" ");

function normaliseRect([x1, y1, x2, y2]: [number, number, number, number]) {
  return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)] as const;
}

// A form XObject used as the annotation's normal appearance, so every viewer draws it the same way.
function appearance(context: PDFContext, bbox: readonly number[], content: string, resources: Record<string, unknown> = {}) {
  return context.register(
    context.stream(content, { Type: "XObject", Subtype: "Form", BBox: [...bbox], Resources: resources as never }),
  );
}

/**
 * Adds highlights, ink drawings and comments as standard PDF annotations, which other
 * viewers show and can edit. Existing annotations in the file are kept.
 */
export async function annotatePdf(input: InputPdf, annotations: PdfAnnotation[]): Promise<OutputFile> {
  const doc = await PDFDocument.load(input.bytes);
  addAnnotations(doc, annotations);
  const bytes = await doc.save();
  return { name: `${baseName(input.name)}-annotated.pdf`, bytes, pageCount: doc.getPageCount() };
}

// Adds the annotations to an open document (used by annotatePdf and applyEdits).
export function addAnnotations(doc: PDFDocument, annotations: PdfAnnotation[]) {
  const pages = doc.getPages();
  const context = doc.context;

  for (const a of annotations) {
    const page = pages[a.page];
    if (!page) throw new OperationError("An annotation refers to a page that doesn't exist.");

    let annot: Record<string, unknown>;
    if (a.type === "link") {
      const [x1, y1, x2, y2] = normaliseRect(a.rect);
      let action: Record<string, unknown>;
      if (a.url !== undefined) {
        if (!isSafeUrl(a.url)) throw new OperationError("Links can only point to web (http/https) or email (mailto) addresses.");
        action = { A: { Type: "Action", S: "URI", URI: PDFString.of(a.url) } };
      } else if (a.targetPage !== undefined && pages[a.targetPage]) {
        action = { Dest: [pages[a.targetPage].ref, "Fit"] };
      } else {
        throw new OperationError("A link points to a page that doesn't exist.");
      }
      // No visible border: the link area is invisible, as in most PDFs.
      annot = { Subtype: "Link", Rect: [x1, y1, x2, y2], Border: [0, 0, 0], ...action };
    } else if (a.type === "highlight") {
      const [x1, y1, x2, y2] = normaliseRect(a.rect);
      const rect = [x1, y1, x2, y2];
      annot = {
        Subtype: "Highlight",
        Rect: rect,
        QuadPoints: [x1, y2, x2, y2, x1, y1, x2, y1],
        C: a.color,
        CA: 0.45,
        AP: {
          N: appearance(context, rect, `/GS0 gs ${rgb(a.color)} rg ${n(x1)} ${n(y1)} ${n(x2 - x1)} ${n(y2 - y1)} re f`, {
            ExtGState: { GS0: { Type: "ExtGState", CA: 0.45, ca: 0.45, BM: "Multiply" } },
          }),
        },
      };
    } else if (a.type === "ink") {
      if (a.points.length < 2) continue;
      const xs = a.points.map((p) => p[0]);
      const ys = a.points.map((p) => p[1]);
      const pad = a.width;
      const rect = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
      const path = a.points.map(([x, y], i) => `${n(x)} ${n(y)} ${i === 0 ? "m" : "l"}`).join(" ");
      annot = {
        Subtype: "Ink",
        Rect: rect,
        InkList: [a.points.flat()],
        C: a.color,
        BS: { W: a.width },
        AP: { N: appearance(context, rect, `${n(a.width)} w 1 J 1 j ${rgb(a.color)} RG ${path} S`) },
      };
    } else {
      const text = a.text.trim();
      if (!text) continue;
      const [x, y] = a.at;
      const rect = [x, y - COMMENT_ICON, x + COMMENT_ICON, y];
      const s = COMMENT_ICON;
      // A small yellow note icon with three text lines.
      const icon =
        `1 0.85 0.2 rg 0.55 0.42 0 RG 1 w ${n(x + 0.5)} ${n(y - s + 0.5)} ${s - 1} ${s - 1} re B ` +
        `0.4 0.3 0 RG 1 w ${[14, 10, 6].map((ly) => `${n(x + 4)} ${n(y - s + ly)} m ${n(x + s - 4)} ${n(y - s + ly)} l S`).join(" ")}`;
      annot = {
        Subtype: "Text",
        Rect: rect,
        Contents: PDFHexString.fromText(text),
        Name: "Comment",
        C: [1, 0.85, 0.2],
        Open: false,
        AP: { N: appearance(context, rect, icon) },
      };
      annot.F = PRINT_FLAG | NO_ZOOM_NO_ROTATE;
    }

    const dict = context.obj({ Type: "Annot", F: PRINT_FLAG, ...annot, P: page.ref } as never);
    page.node.addAnnot(context.register(dict));
  }
}
