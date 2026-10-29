import { site } from "@/config/site";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HeroUpload } from "@/components/home/hero-upload";
import { ToolGrid } from "@/components/home/tool-grid";
import { ExtractionShowcase } from "@/components/home/extraction-showcase";
import { HowItWorks } from "@/components/home/how-it-works";

const container = "mx-auto max-w-[1200px] px-4 sm:px-8";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-line-soft bg-surface-soft pb-[72px] pt-16 sm:pt-20">
          <div className={`${container} flex flex-col items-center gap-5 text-center`}>
            <span className="rounded-full bg-brand-soft px-3 py-1.5 text-[13px] font-semibold text-brand-strong">
              Free · Your files stay in your browser
            </span>
            <h1 className="max-w-[860px] font-display text-[38px] font-extrabold leading-[1.06] tracking-[-0.035em] sm:text-[60px]">
              {site.tagline}
            </h1>
            <p className="max-w-[640px] text-lg text-muted sm:text-[19px]">
              Edit, convert, organise and extract data from your documents. No software to install.
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
