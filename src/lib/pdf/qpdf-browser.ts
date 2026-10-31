import type { ProtectedPdfCheck, QpdfRunner } from "@/lib/pdf/operations/protect";
import { closePdf, loadPdfJs } from "@/lib/pdf/pdfjs";

// qpdf (Apache-2.0) compiled to WebAssembly, served from /qpdf by this site
// (copied by scripts/copy-engine-assets.mjs). Files never leave the browser.

type CreateQpdf = (options: object) => Promise<QpdfModule>;
let loader: Promise<CreateQpdf> | null = null;

// The loader is a plain script that defines a global `Module` factory. A global declared
// with `var` can't be deleted, so it's only read here (nothing else on the site uses it).
function loadQpdf(): Promise<CreateQpdf> {
  if (!loader) {
    loader = new Promise<CreateQpdf>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/qpdf/qpdf.js";
      script.onload = () => {
        const create = (window as unknown as { Module?: CreateQpdf }).Module;
        script.remove();
        if (typeof create === "function") resolve(create);
        else reject(new Error("qpdf didn't load"));
      };
      script.onerror = () => reject(new Error("qpdf couldn't be downloaded"));
      document.head.appendChild(script);
    }).catch((error) => {
      loader = null; // allow a retry, e.g. after a network hiccup
      throw error;
    });
  }
  return loader;
}

export const browserQpdf: QpdfRunner = async (args, input) => {
  const createModule = await loadQpdf();
  const errors: string[] = [];
  // A fresh instance per run keeps files from different runs apart; the browser caches
  // the compiled engine, so this is quick after the first time.
  const qpdf = await createModule({
    locateFile: () => "/qpdf/qpdf.wasm",
    print: () => {},
    printErr: (text: string) => errors.push(text),
  });
  qpdf.FS.writeFile("/in.pdf", input);
  const code = qpdf.callMain(args.map((a) => (a === "IN" ? "/in.pdf" : a === "OUT" ? "/out.pdf" : a)));
  // 0 = success, 3 = success with warnings (e.g. a slightly damaged input was repaired).
  if (code !== 0 && code !== 3) throw new Error(errors.join("\n") || `qpdf exited with code ${code}`);
  return qpdf.FS.readFile("/out.pdf");
};

type QpdfModule = {
  callMain: (args: string[]) => number;
  FS: { writeFile: (path: string, data: Uint8Array) => void; readFile: (path: string) => Uint8Array };
};

export const browserProtectedCheck: ProtectedPdfCheck = async (bytes, password) => {
  const pdfjs = await loadPdfJs();
  // PDF.js takes ownership of the buffer it is given, so pass a copy.
  const pdf = await pdfjs.getDocument({ data: bytes.slice(), password }).promise;
  try {
    // Read a page too, so a file that only looks right on the surface doesn't pass.
    await (await pdf.getPage(1)).getTextContent();
    return pdf.numPages;
  } finally {
    closePdf(pdf);
  }
};
