// A sample document drawn with HTML, used only to design the editor layout.
// Real PDF rendering (PDF.js) replaces this in Phase 3.

export const PAGE_WIDTH = 595;
export const PAGE_HEIGHT = 842;
export const SAMPLE_PAGE_COUNT = 4;

const body = "text-[12px] leading-[1.6] text-[#222]";

function Bars() {
  return (
    <div className="my-6 flex h-[150px] items-end gap-[18px] rounded bg-[#f5f5fa] px-6 py-[18px]">
      {[40, 55, 70, 88].map((h, i) => (
        <span
          key={h}
          className="flex-1 rounded-t-[3px]"
          style={{ height: `${h}%`, background: ["#c9c3f5", "#b0a7f0", "#8e81ea", "#5a47e0"][i] }}
        />
      ))}
    </div>
  );
}

export function SamplePage({ page, editing }: { page: number; editing: boolean }) {
  return (
    <div
      className="relative bg-white px-[60px] py-14 font-[Helvetica,Arial,sans-serif] shadow-[0_2px_6px_rgb(21_19_43/0.06),0_16px_40px_rgb(21_19_43/0.08)]"
      style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
    >
      <div className="text-[10px] uppercase tracking-[0.1em] text-[#888]">Northwind Group · Q3 2026</div>

      {page === 1 && (
        <>
          <div className="mb-[18px] mt-2.5 text-[26px] font-bold text-[#111]">Quarterly Performance Report</div>
          <div className={editing ? "relative rounded-sm bg-brand/5 outline outline-[1.5px] outline-offset-4 outline-brand" : ""}>
            {editing && (
              <span className="absolute -top-[30px] -left-1 rounded-md bg-brand px-2 py-[3px] font-sans text-[11px] font-semibold text-white">
                Editing original text
              </span>
            )}
            <p className={body}>
              Revenue grew steadily across all regions this quarter, led by strong demand in our enterprise segment.
              Operating costs remained in line with forecast.
            </p>
          </div>
          <p className={`${body} mt-4`}>
            The board approved the revised hiring plan for the coming year, with investment focused on product and
            customer success teams.
          </p>
          <Bars />
          <p className={body}>
            <span className="bg-[#fff1a8]">Customer retention reached its highest level to date</span>, reflecting
            improvements in onboarding and support.
          </p>
          <span className="absolute right-[-14px] top-[300px] flex size-7 items-center justify-center rounded-full bg-info font-sans text-xs font-bold text-white shadow-[0_2px_6px_rgb(0_0_0/0.2)]">
            1
          </span>
        </>
      )}

      {page === 2 && (
        <>
          <div className="mb-[18px] mt-2.5 text-[20px] font-bold text-[#111]">Regional results</div>
          <table className="w-full border-collapse text-[11px] text-[#222]">
            <thead>
              <tr className="border-b border-[#ccc] text-left">
                <th className="py-2">Region</th>
                <th className="py-2 text-right">Q2</th>
                <th className="py-2 text-right">Q3</th>
                <th className="py-2 text-right">Change</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["North", "1.20", "1.34", "+11.7%"],
                ["South", "0.96", "1.02", "+6.3%"],
                ["East", "1.41", "1.52", "+7.8%"],
                ["West", "0.88", "0.97", "+10.2%"],
              ].map((r) => (
                <tr key={r[0]} className="border-b border-[#eee]">
                  <td className="py-2">{r[0]}</td>
                  <td className="py-2 text-right">{r[1]}</td>
                  <td className="py-2 text-right">{r[2]}</td>
                  <td className="py-2 text-right">{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={`${body} mt-5`}>Figures in millions. All regions improved on the previous quarter.</p>
        </>
      )}

      {page === 3 && (
        <>
          <div className="mb-[18px] mt-2.5 text-[20px] font-bold text-[#111]">Outlook</div>
          <p className={body}>
            We expect continued growth next quarter, supported by new product releases and an expanded partner network.
          </p>
          <Bars />
          <p className={body}>Risks include supply costs and slower hiring in specialist roles.</p>
        </>
      )}

      {page === 4 && (
        <>
          <div className="mb-[18px] mt-2.5 text-[20px] font-bold text-[#111]">Appendix</div>
          <p className={body}>Definitions, methodology and supporting data are available on request.</p>
        </>
      )}

      <div className="absolute bottom-8 left-0 right-0 text-center text-[10px] text-[#999]">{page}</div>
    </div>
  );
}

// A miniature, content-free thumbnail for the page list.
export function PageThumb() {
  return (
    <span className="flex h-[136px] w-[104px] flex-col gap-1.5 rounded-md bg-white p-3 shadow-[0_1px_3px_rgb(21_19_43/0.12)]">
      <span className="h-2 w-3/5 rounded-sm bg-[#d6d4e2]" />
      <span className="h-1 w-full rounded-sm bg-[#ecebf3]" />
      <span className="h-1 w-[90%] rounded-sm bg-[#ecebf3]" />
      <span className="h-[30px] w-full rounded-sm bg-[#f2f1f8]" />
      <span className="h-1 w-4/5 rounded-sm bg-[#ecebf3]" />
    </span>
  );
}
