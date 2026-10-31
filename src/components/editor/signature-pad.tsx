"use client";

import { useEffect, useRef, useState } from "react";
import { Segmented } from "@/components/tool/form-controls";

// A signature as a transparent PNG, trimmed to the ink, ready to place like an image.
export type SignatureImage = { bytes: Uint8Array; width: number; height: number };

const COLORS = [
  { value: "#1d1d29", label: "Black" },
  { value: "#1f3fae", label: "Blue" },
];

// Drawing happens at three times the on-screen size so the placed signature stays sharp.
const PAD_W = 260;
const PAD_H = 110;
const RES = 3;

// Dancing Script (OFL-1.1), bundled with the site and loaded only when "Type" is used.
const SCRIPT_FONT = "Signature Script";
let scriptFont: Promise<void> | null = null;
function loadScriptFont() {
  if (!scriptFont) {
    const url = new URL("@expo-google-fonts/dancing-script/600SemiBold/DancingScript_600SemiBold.ttf", import.meta.url);
    scriptFont = new FontFace(SCRIPT_FONT, `url(${url})`).load().then((face) => {
      document.fonts.add(face);
    });
  }
  return scriptFont;
}

// Crops a canvas to its non-transparent pixels (plus a small border) and encodes it as PNG.
async function trimToPng(canvas: HTMLCanvasElement): Promise<SignatureImage | null> {
  const ctx = canvas.getContext("2d")!;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  const pad = 2 * RES;
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  const w = Math.min(width, right + pad + 1) - left;
  const h = Math.min(height, bottom + pad + 1) - top;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(canvas, left, top, w, h, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
  if (!blob) return null;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: w, height: h };
}

export function SignaturePad({ onPlace, onUpload }: { onPlace: (signature: SignatureImage) => void; onUpload: () => void }) {
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [color, setColor] = useState(COLORS[0].value);
  const [hasInk, setHasInk] = useState(false);
  const [name, setName] = useState("");
  const [fontReady, setFontReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (mode !== "type") return;
    let cancelled = false;
    loadScriptFont()
      .then(() => !cancelled && setFontReady(true))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * PAD_W * RES, y: ((e.clientY - rect.top) / rect.height) * PAD_H * RES };
  }

  function stroke(to: { x: number; y: number }) {
    const ctx = canvasRef.current!.getContext("2d")!;
    const from = last.current ?? to;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4 * RES;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    // A dot when the pen doesn't move.
    ctx.lineTo(to.x + (from.x === to.x && from.y === to.y ? 0.1 : 0), to.y);
    ctx.stroke();
    last.current = to;
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  async function place() {
    let canvas = canvasRef.current;
    if (mode === "type") {
      await loadScriptFont();
      // Draw the typed name large on a scratch canvas, then trim it like a drawn signature.
      const size = 64 * RES;
      canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      ctx.font = `${size}px "${SCRIPT_FONT}"`;
      canvas.width = Math.ceil(ctx.measureText(name.trim()).width + size);
      canvas.height = Math.ceil(size * 1.6);
      ctx.font = `${size}px "${SCRIPT_FONT}"`;
      ctx.fillStyle = color;
      ctx.textBaseline = "middle";
      ctx.fillText(name.trim(), size / 2, canvas.height / 2);
    }
    if (!canvas) return;
    const signature = await trimToPng(canvas);
    if (signature) onPlace(signature);
  }

  const ready = mode === "draw" ? hasInk : name.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <Segmented
        options={[
          { value: "draw", label: "Draw" },
          { value: "type", label: "Type" },
        ]}
        value={mode}
        onChange={(v) => setMode(v as "draw" | "type")}
      />
      {mode === "draw" ? (
        <div className="flex flex-col gap-1.5">
          <canvas
            ref={canvasRef}
            width={PAD_W * RES}
            height={PAD_H * RES}
            aria-label="Signature drawing area. Draw your signature with a mouse, finger or pen."
            className="w-full touch-none rounded-[10px] border border-dashed border-line bg-white"
            style={{ aspectRatio: `${PAD_W} / ${PAD_H}`, cursor: "crosshair" }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              last.current = null;
              stroke(point(e));
              setHasInk(true);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 0 || !last.current) return;
              stroke(point(e));
            }}
            onPointerUp={() => {
              last.current = null;
            }}
          />
          <div className="flex justify-between text-xs text-subtle">
            <span>Sign above</span>
            <button type="button" onClick={clear} disabled={!hasInk} className="font-semibold text-brand-strong hover:text-brand disabled:opacity-40">
              Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={name}
            maxLength={40}
            placeholder="Your name"
            aria-label="Your name"
            onChange={(e) => setName(e.target.value)}
            className="rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-brand-ring focus:outline-none"
          />
          <div
            className="flex min-h-[72px] items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-line bg-white px-3 text-[34px]"
            style={{ fontFamily: fontReady ? `"${SCRIPT_FONT}"` : undefined, color }}
          >
            {name.trim() || <span className="text-sm text-subtle">Preview</span>}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2" role="radiogroup" aria-label="Ink colour">
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={color === c.value}
            aria-label={c.label}
            onClick={() => setColor(c.value)}
            className={`size-7 rounded-full border-2 ${color === c.value ? "border-brand" : "border-transparent"}`}
            style={{ backgroundColor: c.value }}
          />
        ))}
        <span className="text-xs text-subtle">{mode === "draw" ? "Colour for new strokes" : "Ink colour"}</span>
      </div>
      <button
        type="button"
        onClick={place}
        disabled={!ready}
        className="rounded-[10px] bg-brand px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        Place signature on this page
      </button>
      <button type="button" onClick={onUpload} className="text-left text-sm font-semibold text-brand-strong hover:text-brand">
        Or upload a picture of your signature…
      </button>
      <p className="text-xs text-subtle">
        After placing, drag it into position and resize it from the corner. This adds a picture of your signature; it isn&apos;t a
        certified digital signature.
      </p>
    </div>
  );
}
