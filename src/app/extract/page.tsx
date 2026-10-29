import type { Metadata } from "next";
import { site } from "@/config/site";
import { ExtractionWorkspace } from "@/components/extract/extraction-workspace";

export const metadata: Metadata = {
  title: `Invoice to Excel — ${site.name}`,
  // App screen; the Invoice to Excel tool page is the search landing page.
  robots: { index: false },
};

export default function ExtractPage() {
  return <ExtractionWorkspace />;
}
