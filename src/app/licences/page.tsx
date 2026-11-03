import type { Metadata } from "next";
import { site } from "@/config/site";
import thirdParty from "@/config/third-party.json";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: `Open-source licences — ${site.name}`,
  description: "The open-source software this website is built with, and its licences.",
};

const cell = "border-b border-line-soft px-3 py-2.5 align-top";

export default function LicencesPage() {
  return (
    <LegalPage
      title="Open-source licences"
      intro={`${site.name} is built with free, open-source software. Thank you to everyone who makes it. Each project below is used under its own licence.`}
    >
      <LegalSection title="Main components">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead className="text-subtle">
              <tr>
                <th className={`${cell} font-semibold`}>Project</th>
                <th className={`${cell} font-semibold`}>Used for</th>
                <th className={`${cell} font-semibold`}>Licence</th>
              </tr>
            </thead>
            <tbody>
              {thirdParty.components.map((c) => (
                <tr key={c.name}>
                  <td className={cell}>
                    <a href={c.url} rel="noopener noreferrer">{c.name}</a>
                  </td>
                  <td className={cell}>{c.usedFor}</td>
                  <td className={`${cell} whitespace-nowrap`}>{c.licence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="Libraries inside the browser engines">
        <p>The OCR engine and qpdf are compiled to WebAssembly together with these libraries:</p>
        <ul>
          {thirdParty.embedded.map((e) => (
            <li key={e.name}>
              <a href={e.url} rel="noopener noreferrer">{e.name}</a> ({e.licence}), inside {e.inside}
            </li>
          ))}
        </ul>
        {thirdParty.acknowledgements.map((a) => (
          <p key={a}>{a}</p>
        ))}
      </LegalSection>

      <LegalSection title="Full licence texts">
        <p>
          The complete licence and copyright notices for every package the site uses, including smaller supporting packages,
          are in <a href="/third-party-notices.txt">third-party-notices.txt</a>. That file is generated from the installed
          packages each time the site is built.
        </p>
        <p>
          The conversion service for Word, Excel and PowerPoint files runs{" "}
          <a href="https://www.libreoffice.org" rel="noopener noreferrer">LibreOffice</a> (MPL-2.0) on our server.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
