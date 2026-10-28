"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";

type Props = {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  hint: string;
  buttonLabel?: string;
};

export function FileDropzone({ onFiles, accept, multiple = true, hint, buttonLabel = "Choose files" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const dropped = Array.from(e.dataTransfer.files);
        onFiles(multiple ? dropped : dropped.slice(0, 1));
      }}
      className={`flex flex-col items-center gap-4 rounded-[18px] border-2 border-dashed px-6 py-12 text-center transition ${
        dragging ? "border-brand bg-brand-soft" : "border-brand-ring bg-[#fcfbff]"
      }`}
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Upload className="size-[26px]" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <strong className="text-lg font-semibold">Drop your {multiple ? "files" : "file"} here</strong>
        <span className="text-sm text-subtle">{hint}</span>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-xl bg-brand px-[26px] py-3.5 text-base font-semibold text-white hover:bg-brand-strong"
      >
        {buttonLabel}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}
