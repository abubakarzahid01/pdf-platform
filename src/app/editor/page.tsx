import type { Metadata } from "next";
import { site } from "@/config/site";
import { EditorWorkspace } from "@/components/editor/editor-workspace";

export const metadata: Metadata = {
  title: `PDF Editor — ${site.name}`,
  // The editor is an app screen, not a landing page; keep it out of search results.
  robots: { index: false },
};

export default function EditorPage() {
  return <EditorWorkspace />;
}
