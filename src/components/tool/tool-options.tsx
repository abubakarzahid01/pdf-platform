"use client";

import { Checkbox, Field, Segmented, SelectField, TextField } from "@/components/tool/form-controls";

// Options panel content per tool. Tools without options show a short note instead.
export function ToolOptions({ slug }: { slug: string }) {
  switch (slug) {
    case "excel-to-pdf":
      return (
        <>
          <Field label="Worksheets (sample)">
            <Checkbox label="Summary" defaultChecked />
            <Checkbox label="Monthly" defaultChecked />
            <Checkbox label="Forecast" />
          </Field>
          <Field label="Orientation">
            <Segmented options={["Portrait", "Landscape"]} initial="Landscape" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Paper size" options={["A4", "Letter", "Legal"]} />
            <SelectField label="Margins" options={["Normal", "Narrow", "Wide"]} />
          </div>
          <Field label="Scaling">
            <Segmented options={["Actual size", "Fit width", "Fit page"]} initial="Fit width" />
          </Field>
          <Checkbox label="Respect print areas and page breaks" defaultChecked />
        </>
      );
    case "compress-pdf":
      return (
        <Field label="Compression level">
          <Segmented options={["Low", "Recommended", "High"]} initial="Recommended" />
          <p className="text-[13px] text-subtle">Higher compression gives smaller files but lower image quality.</p>
        </Field>
      );
    case "split-pdf":
      return (
        <>
          <Field label="Split mode">
            <Segmented options={["Page ranges", "Every page", "Extract pages"]} />
          </Field>
          <TextField label="Pages" placeholder="e.g. 1-3, 5, 8-10" />
        </>
      );
    case "rotate-pdf":
      return (
        <>
          <Field label="Rotation">
            <Segmented options={["90° right", "180°", "90° left"]} />
          </Field>
          <Field label="Apply to">
            <Segmented options={["All pages", "Odd", "Even"]} />
          </Field>
        </>
      );
    case "add-page-numbers":
      return (
        <>
          <SelectField label="Position" options={["Bottom centre", "Bottom right", "Bottom left", "Top centre", "Top right"]} />
          <SelectField label="Format" options={["1, 2, 3", "Page 1 of N", "i, ii, iii"]} />
          <TextField label="Start at" type="number" defaultValue="1" />
        </>
      );
    case "add-watermark":
      return (
        <>
          <TextField label="Watermark text" placeholder="e.g. CONFIDENTIAL" />
          <SelectField label="Position" options={["Diagonal centre", "Centre", "Top", "Bottom"]} />
          <SelectField label="Opacity" options={["20%", "35%", "50%", "75%"]} />
        </>
      );
    case "protect-pdf":
      return (
        <>
          <TextField label="Password" type="password" placeholder="At least 8 characters" />
          <TextField label="Repeat password" type="password" />
          <p className="text-[13px] text-subtle">We never store your password. If you lose it, the file cannot be recovered.</p>
        </>
      );
    case "pdf-to-images":
      return (
        <>
          <Field label="Format">
            <Segmented options={["PNG", "JPG"]} />
          </Field>
          <SelectField label="Quality" options={["Standard (150 DPI)", "High (300 DPI)", "Screen (72 DPI)"]} />
        </>
      );
    case "images-to-pdf":
      return (
        <>
          <SelectField label="Page size" options={["Fit to image", "A4", "Letter"]} />
          <Field label="Orientation">
            <Segmented options={["Auto", "Portrait", "Landscape"]} />
          </Field>
          <SelectField label="Margin" options={["None", "Small", "Large"]} />
        </>
      );
    case "pdf-to-excel":
    case "pdf-to-csv":
      return (
        <Field label="Tables">
          <Segmented options={["One sheet per table", "All in one sheet"]} />
        </Field>
      );
    case "crop-pdf":
      return (
        <Field label="Crop mode">
          <Segmented options={["Remove white margins", "Select area"]} />
        </Field>
      );
    default:
      return <p className="text-sm text-muted">No extra options needed. Upload your file and start.</p>;
  }
}
