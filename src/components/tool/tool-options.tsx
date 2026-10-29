"use client";

import { Checkbox, Field, Segmented, SelectField, TextField } from "@/components/tool/form-controls";

export type OptionValues = Record<string, string | boolean>;

// Starting values for each tool's options.
export const optionDefaults: Record<string, OptionValues> = {
  "excel-to-pdf": { "sheet-Summary": true, "sheet-Monthly": true, "sheet-Forecast": false, orientation: "Landscape", paper: "A4", margins: "Normal", scaling: "Fit width", printAreas: true },
  "compress-pdf": { level: "Recommended" },
  "split-pdf": { mode: "ranges", pages: "" },
  "rotate-pdf": { angle: "90", which: "all" },
  "add-page-numbers": { position: "Bottom centre", format: "1, 2, 3", start: "1" },
  "add-watermark": { text: "", position: "Diagonal centre", opacity: "35%" },
  "protect-pdf": { password: "", repeat: "" },
  "pdf-to-images": { format: "PNG", quality: "Standard (150 DPI)" },
  "images-to-pdf": { pageSize: "Fit to image", orientation: "Auto", margin: "None" },
  "pdf-to-excel": { tables: "One sheet per table" },
  "pdf-to-csv": { tables: "One sheet per table" },
  "crop-pdf": { mode: "Remove white margins" },
  "pdf-to-text": { breaks: "marked" },
};

type Props = {
  slug: string;
  values: OptionValues;
  onChange: (key: string, value: string | boolean) => void;
  // Page count of the first valid file, when known, for hints.
  pageCount?: number;
};

// Options panel content per tool. Tools without options show a short note instead.
export function ToolOptions({ slug, values, onChange, pageCount }: Props) {
  const text = (key: string) => String(values[key] ?? "");
  const bool = (key: string) => Boolean(values[key]);
  const set = (key: string) => (v: string | boolean) => onChange(key, v);

  switch (slug) {
    case "excel-to-pdf":
      return (
        <>
          <Field label="Worksheets (sample)">
            {["Summary", "Monthly", "Forecast"].map((s) => (
              <Checkbox key={s} label={s} checked={bool(`sheet-${s}`)} onChange={set(`sheet-${s}`)} />
            ))}
          </Field>
          <Field label="Orientation">
            <Segmented options={["Portrait", "Landscape"]} value={text("orientation")} onChange={set("orientation")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Paper size" options={["A4", "Letter", "Legal"]} value={text("paper")} onChange={set("paper")} />
            <SelectField label="Margins" options={["Normal", "Narrow", "Wide"]} value={text("margins")} onChange={set("margins")} />
          </div>
          <Field label="Scaling">
            <Segmented options={["Actual size", "Fit width", "Fit page"]} value={text("scaling")} onChange={set("scaling")} />
          </Field>
          <Checkbox label="Respect print areas and page breaks" checked={bool("printAreas")} onChange={set("printAreas")} />
        </>
      );
    case "compress-pdf":
      return (
        <Field label="Compression level">
          <Segmented options={["Low", "Recommended", "High"]} value={text("level")} onChange={set("level")} />
          <p className="text-[13px] text-subtle">
            {values.level === "Low"
              ? "Best image quality, good for printing (about 200 DPI)."
              : values.level === "High"
                ? "Smallest file, for screens only (about 96 DPI)."
                : "Good balance for screens and everyday printing (about 150 DPI)."}{" "}
            Only images are changed; text stays sharp.
          </p>
        </Field>
      );
    case "split-pdf": {
      const mode = text("mode");
      return (
        <>
          <Field label="Split mode">
            <Segmented
              options={[
                { value: "ranges", label: "Page ranges" },
                { value: "every-page", label: "Every page" },
                { value: "extract", label: "Extract pages" },
              ]}
              value={mode}
              onChange={set("mode")}
            />
          </Field>
          {mode === "every-page" ? (
            <p className="text-[13px] text-subtle">Each page becomes its own PDF{pageCount ? `: ${pageCount} files` : ""}.</p>
          ) : (
            <TextField
              label={mode === "extract" ? "Pages to extract" : "Page ranges"}
              placeholder="e.g. 1-3, 5, 8-10"
              value={text("pages")}
              onChange={set("pages")}
              hint={
                (mode === "extract" ? "Selected pages are combined into one PDF." : "Each range becomes a separate PDF.") +
                (pageCount ? ` This PDF has ${pageCount} pages.` : "")
              }
            />
          )}
        </>
      );
    }
    case "rotate-pdf":
      return (
        <>
          <Field label="Rotation">
            <Segmented
              options={[
                { value: "90", label: "90° right" },
                { value: "180", label: "180°" },
                { value: "270", label: "90° left" },
              ]}
              value={text("angle")}
              onChange={set("angle")}
            />
          </Field>
          <Field label="Apply to">
            <Segmented
              options={[
                { value: "all", label: "All pages" },
                { value: "odd", label: "Odd" },
                { value: "even", label: "Even" },
              ]}
              value={text("which")}
              onChange={set("which")}
            />
          </Field>
        </>
      );
    case "add-page-numbers":
      return (
        <>
          <SelectField label="Position" options={["Bottom centre", "Bottom right", "Bottom left", "Top centre", "Top right"]} value={text("position")} onChange={set("position")} />
          <SelectField label="Format" options={["1, 2, 3", "Page 1 of N", "i, ii, iii"]} value={text("format")} onChange={set("format")} />
          <TextField label="Start at" type="number" value={text("start")} onChange={set("start")} />
        </>
      );
    case "add-watermark":
      return (
        <>
          <TextField label="Watermark text" placeholder="e.g. CONFIDENTIAL" value={text("text")} onChange={set("text")} />
          <SelectField label="Position" options={["Diagonal centre", "Centre", "Top", "Bottom"]} value={text("position")} onChange={set("position")} />
          <SelectField label="Opacity" options={["20%", "35%", "50%", "75%"]} value={text("opacity")} onChange={set("opacity")} />
        </>
      );
    case "protect-pdf":
      return (
        <>
          <TextField label="Password" type="password" placeholder="At least 8 characters" value={text("password")} onChange={set("password")} />
          <TextField label="Repeat password" type="password" value={text("repeat")} onChange={set("repeat")} />
          <p className="text-[13px] text-subtle">We never store your password. If you lose it, the file cannot be recovered.</p>
        </>
      );
    case "pdf-to-images":
      return (
        <>
          <Field label="Format">
            <Segmented options={["PNG", "JPG"]} value={text("format")} onChange={set("format")} />
          </Field>
          <SelectField label="Quality" options={["Standard (150 DPI)", "High (300 DPI)", "Screen (72 DPI)"]} value={text("quality")} onChange={set("quality")} />
        </>
      );
    case "images-to-pdf":
      return (
        <>
          <SelectField label="Page size" options={["Fit to image", "A4", "Letter"]} value={text("pageSize")} onChange={set("pageSize")} />
          <Field label="Orientation">
            <Segmented options={["Auto", "Portrait", "Landscape"]} value={text("orientation")} onChange={set("orientation")} />
          </Field>
          <SelectField label="Margin" options={["None", "Small", "Large"]} value={text("margin")} onChange={set("margin")} />
        </>
      );
    case "pdf-to-excel":
    case "pdf-to-csv":
      return (
        <Field label="Tables">
          <Segmented options={["One sheet per table", "All in one sheet"]} value={text("tables")} onChange={set("tables")} />
        </Field>
      );
    case "crop-pdf":
      return (
        <Field label="Crop mode">
          <Segmented options={["Remove white margins", "Select area"]} value={text("mode")} onChange={set("mode")} />
        </Field>
      );
    case "pdf-to-text":
      return (
        <Field label="Pages">
          <Segmented
            options={[
              { value: "marked", label: "Mark each page" },
              { value: "continuous", label: "One continuous text" },
            ]}
            value={text("breaks")}
            onChange={set("breaks")}
          />
          <p className="text-[13px] text-subtle">
            Text is put in reading order, line by line. Table columns are kept apart with extra spaces. Scanned pages have no
            text yet; text recognition (OCR) comes next.
          </p>
        </Field>
      );
    case "organise-pages":
      return <p className="text-sm text-muted">Arrange the pages on the left, then save. Your original file isn&apos;t changed.</p>;
    case "merge-pdf":
      return <p className="text-sm text-muted">Files are combined in the order shown. Use the arrows to change the order.</p>;
    default:
      return <p className="text-sm text-muted">No extra options needed. Upload your file and start.</p>;
  }
}
