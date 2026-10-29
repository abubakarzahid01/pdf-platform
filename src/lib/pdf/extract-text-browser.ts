import type { TextExtractor } from "@/lib/pdf/text-edit/apply";
import { closePdf, loadPdfJs } from "@/lib/pdf/pdfjs";

// Reads the text a viewer finds on a page, used to check edits after saving.
export const browserTextExtractor: TextExtractor = async (bytes, pageIndex) => {
  const pdfjs = await loadPdfJs();
  // PDF.js takes ownership of the buffer it is given, so pass a copy.
  const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  try {
    const content = await (await pdf.getPage(pageIndex + 1)).getTextContent();
    return content.items.flatMap((item) => ("str" in item ? [item.str] : []));
  } finally {
    closePdf(pdf);
  }
};
