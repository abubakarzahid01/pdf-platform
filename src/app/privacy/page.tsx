import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { tools } from "@/config/tools";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: `Privacy — ${site.name}`,
  description: "How your files and data are handled: most tools run in your browser and nothing is uploaded.",
};

// The Office conversions are the only tools that send a file to our server.
const uploadTools = tools.filter((t) => ["word-to-pdf", "excel-to-pdf", "powerpoint-to-pdf"].includes(t.slug) && !t.hidden);

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      intro="Your documents are yours. Most tools work entirely in your browser, so your files never leave your device."
      updated="4 November 2026"
    >
      <LegalSection title="Tools that run in your browser">
        <p>
          Editing, merging, splitting, compressing, protecting, converting PDFs to Word, Excel, images or text, reading
          scanned pages (OCR) and extracting invoice data all happen on your own device. Your files are not uploaded, and
          we can&apos;t see them.
        </p>
        <p>
          Open files are kept in your browser&apos;s memory while you work. They are cleared when you close the tab, and
          five minutes after you leave a tool.
        </p>
        <p>
          When you move a file from one page to another (for example from a tool into the editor), a copy is kept for a
          moment in your browser&apos;s own storage on your device, so the file still opens if the page reloads. It is
          deleted as soon as the next page opens it, and never leaves your device.
        </p>
      </LegalSection>

      <LegalSection title="Tools that upload your file">
        <p>
          {uploadTools.map((t, i) => (
            <span key={t.slug}>
              {i > 0 && (i === uploadTools.length - 1 ? " and " : ", ")}
              <Link href={`/tools/${t.slug}`}>{t.name}</Link>
            </span>
          ))}{" "}
          need office software that can&apos;t run in a browser. For these, your file is sent over an encrypted connection to
          our conversion server, converted to PDF and sent straight back.
        </p>
        <ul>
          <li>The file is deleted from the server as soon as the conversion finishes, whether it succeeds or fails.</li>
          <li>We don&apos;t keep copies, and we don&apos;t look at the contents.</li>
          <li>The server&apos;s log records only the file type, its size and how long the conversion took, never the file name or contents.</li>
        </ul>
      </LegalSection>

      <LegalSection title="No accounts, cookies or tracking">
        <p>
          There are no accounts to create. The site doesn&apos;t set cookies of its own, doesn&apos;t use analytics or
          advertising trackers, and doesn&apos;t load fonts or scripts from other companies. Cloudflare (see Hosting) may
          set a strictly necessary security cookie to tell real visitors apart from bots.
        </p>
      </LegalSection>

      <LegalSection title="Hosting">
        <p>
          The website is hosted by {site.hostingProvider}, and its traffic passes through Cloudflare, which speeds up
          pages and blocks attacks. Like any website, these servers process technical information such as your IP address
          and browser type to deliver pages and protect the site from abuse.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about privacy? Email <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
