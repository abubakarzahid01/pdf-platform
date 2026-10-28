import Link from "next/link";

// Sample data for illustration only. Clearly labelled as a sample in the UI.
const sampleRows = [
  { supplier: "Northwind Supplies", invoice: "INV-1042", date: "2026-09-03", total: "£1,240.00", source: "inv-01 · p.1" },
  { supplier: "Bluefield Print Co.", invoice: "BP-77310", date: "2026-09-11", total: "£386.50", source: "inv-02 · p.1" },
  { supplier: "Orchard Logistics", invoice: null, date: "2026-09-18", total: "£2,015.20", source: "inv-03 · p.2" },
  { supplier: "Harbour Office Ltd", invoice: "HO-2291", date: "2026-09-24", total: "£98.00", source: "inv-04 · p.1" },
];

const cell = "whitespace-nowrap border-b border-line-soft px-2 py-2.5";

export function ExtractionShowcase() {
  return (
    <div className="rounded-[28px] bg-ink p-8 text-white sm:p-14">
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <span className="self-start rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-[#d9d4ff]">
            Smart extraction · Pro
          </span>
          <h2 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-[40px]">
            Turn a pile of PDFs into one clean spreadsheet
          </h2>
          <p className="text-[17px] text-[#c9c7da]">
            Upload invoices, receipts or statements and say what you need in plain English. Every value links back to
            its source page, and anything missing or uncertain is flagged for review, never guessed.
          </p>
          <blockquote className="rounded-[14px] border border-white/15 bg-white/5 px-[18px] py-4 text-[15px] text-[#edebfa]">
            “Extract the supplier name, invoice number, invoice date and total from every PDF. Combine them into one
            Excel file.”
          </blockquote>
          <div className="flex flex-wrap gap-3">
            <Link href="/tools/ai-extraction" className="rounded-xl bg-white px-[22px] py-3 font-semibold text-ink hover:bg-[#f2f1f8]">
              Try extraction
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[18px] bg-surface p-[18px] text-ink shadow-[0_24px_60px_rgb(0_0_0/0.35)]">
          <div className="flex items-center justify-between gap-3 px-1 pb-3.5">
            <strong className="text-sm">Sample · 4 invoices</strong>
            <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">1 value needs review</span>
          </div>
          <table className="w-full min-w-[440px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-subtle">
                <th className={`${cell} font-semibold`}>Supplier</th>
                <th className={`${cell} font-semibold`}>Invoice no.</th>
                <th className={`${cell} font-semibold`}>Date</th>
                <th className={`${cell} text-right font-semibold`}>Total</th>
                <th className={`${cell} font-semibold`}>Source</th>
              </tr>
            </thead>
            <tbody>
              {sampleRows.map((r) => (
                <tr key={r.source}>
                  <td className={cell}>{r.supplier}</td>
                  {r.invoice ? (
                    <td className={cell}>{r.invoice}</td>
                  ) : (
                    <td className={`${cell} bg-warn-soft font-semibold text-warn`}>Missing</td>
                  )}
                  <td className={cell}>{r.date}</td>
                  <td className={`${cell} text-right`}>{r.total}</td>
                  <td className={`${cell} text-brand-strong`}>{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
