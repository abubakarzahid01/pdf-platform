import type { Metadata } from "next";
import { site } from "@/config/site";
import { homeSeo } from "@/config/seo";
import { tools } from "@/config/tools";
import { JsonLd } from "@/components/json-ld";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HeroUpload } from "@/components/home/hero-upload";
import { ToolGrid } from "@/components/home/tool-grid";
import { ExtractionShowcase } from "@/components/home/extraction-showcase";
import { HowItWorks } from "@/components/home/how-it-works";

const container = "mx-auto max-w-[1200px] px-4 sm:px-8";

export const metadata: Metadata = {
  title: { absolute: homeSeo.title },
  description: homeSeo.description,
  alternates: { canonical: "/" },
  openGraph: { title: homeSeo.title, description: homeSeo.description, url: "/" },
};

// Tells search engines the site's name (shown above results) and what it offers.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${site.url}/#website`, url: site.url, name: site.name, description: homeSeo.description },
    {
      "@type": "Organization",
      "@id": `${site.url}/#organization`,
      name: site.name,
      url: site.url,
      logo: `${site.url}/icon.svg`,
      email: site.contactEmail,
    },
    {
      "@type": "WebApplication",
      name: site.name,
      url: site.url,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any (works in a web browser)",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: tools.map((t) => t.name),
    },
  ],
};

export default function Home() {
  return (
    <>
      <JsonLd data={structuredData} />
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-line-soft bg-surface-soft pb-[72px] pt-16 sm:pt-20">
          <div className={`${container} flex flex-col items-center gap-5 text-center`}>
            <span className="rounded-full bg-brand-soft px-3 py-1.5 text-[13px] font-semibold text-brand-strong">
              Free · Most tools work right in your browser
            </span>
            <h1 className="max-w-[860px] font-display text-[38px] font-extrabold leading-[1.06] tracking-[-0.035em] sm:text-[60px]">
              {site.tagline}
            </h1>
            <p className="max-w-[640px] text-lg text-muted sm:text-[19px]">
              A free online PDF editor and converter: edit PDF text, convert PDF to Word and Excel, merge, split and compress
              PDFs. No sign-up, no watermark, no software to install.
            </p>
            <div className="mt-5 flex w-full justify-center">
              <HeroUpload />
            </div>
          </div>
        </section>

        <section id="tools" className="scroll-mt-20 pb-10 pt-[88px]">
          <div className={container}>
            <ToolGrid />
          </div>
        </section>

        <section className="py-[72px]">
          <div className={container}>
            <ExtractionShowcase />
          </div>
        </section>

        <section className="pb-[72px] pt-14">
          <div className={container}>
            <HowItWorks />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
