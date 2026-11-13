import { site } from "@/config/site";
import { ogImage, ogSize } from "@/lib/og-image";

export const alt = `${site.name}: free online PDF editor and converter`;
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogImage("Free online PDF editor and converter", "Edit, convert, merge and compress PDFs right in your browser.");
}
