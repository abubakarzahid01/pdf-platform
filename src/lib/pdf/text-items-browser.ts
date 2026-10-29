import type { TextItemReader } from "@/lib/pdf/operations/pdf-to-text";
import { closePdf, loadPdfJs } from "@/lib/pdf/pdfjs";
import { readTextItems } from "@/lib/pdf/text-items";

// Reads every page's text pieces in the browser with PDF.js.
export const browserTextItemReader: TextItemReader = async (bytes) => {
  const pdfjs = await loadPdfJs();
  // PDF.js takes ownership of the buffer it is given, so pass a copy.
  const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  try {
    return await readTextItems(pdf, pdfjs.Util.transform);
  } finally {
    closePdf(pdf);
  }
};
