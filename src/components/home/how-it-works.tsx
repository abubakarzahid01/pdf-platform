const steps = [
  { title: "Upload", text: "Drop a file or pick one from your computer." },
  { title: "Choose what to do", text: "Edit, convert, organise or extract, with a preview before you commit." },
  { title: "Download", text: "Get your file instantly. We delete the originals automatically." },
];

export function HowItWorks() {
  return (
    <div className="flex flex-col gap-9">
      <h2 className="text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Three steps, no learning curve
      </h2>
      <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex flex-col gap-3 rounded-[18px] border border-line-soft bg-surface-soft p-7">
            <span className="font-display text-[15px] font-bold text-brand">{String(i + 1).padStart(2, "0")}</span>
            <strong className="text-lg font-semibold">{s.title}</strong>
            <span className="text-[15px] text-muted">{s.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
