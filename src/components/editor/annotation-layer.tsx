"use client";

import { useRef, useState, type PointerEvent } from "react";
import { COMMENT_SIZE, describe, type NewAnnotation, type ViewAnnotation } from "@/components/editor/annotations";
import type { EditorTool } from "@/components/editor/editor-workspace";

type Props = {
  page: number;
  width: number; // page size at 100%
  height: number;
  scale: number;
  tool: EditorTool;
  items: ViewAnnotation[];
  selectedId: string | null;
  highlightColor: string;
  inkColor: string;
  inkWidth: number;
  onCreate: (a: NewAnnotation) => void;
  onSelect: (id: string | null) => void;
};

type Draft = { type: "highlight"; start: [number, number]; end: [number, number] } | { type: "ink"; points: [number, number][] };

const MIN_HIGHLIGHT = 4;

function bounds(a: ViewAnnotation) {
  if (a.type === "highlight") return { x: a.x, y: a.y, w: a.w, h: a.h };
  if (a.type === "comment") return { x: a.x, y: a.y, w: COMMENT_SIZE, h: COMMENT_SIZE };
  const xs = a.points.map((p) => p[0]);
  const ys = a.points.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

// Transparent drawing surface over one page. Works in 100% page units; the SVG scales with zoom.
export function AnnotationLayer(props: Props) {
  const { page, width, height, scale, tool, items, selectedId } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraftState] = useState<Draft | null>(null);
  // The ref holds the in-progress stroke so fast pointer events never read a stale value;
  // the state copy is only for drawing it on screen.
  const draftRef = useRef<Draft | null>(null);
  const setDraft = (d: Draft | null) => {
    draftRef.current = d;
    setDraftState(d);
  };
  const drawing = tool === "highlight" || tool === "draw" || tool === "comment";
  const selecting = tool === "select";

  function point(e: PointerEvent): [number, number] {
    const r = svgRef.current!.getBoundingClientRect();
    const x = Math.min(width, Math.max(0, (e.clientX - r.left) / scale));
    const y = Math.min(height, Math.max(0, (e.clientY - r.top) / scale));
    return [x, y];
  }

  function onPointerDown(e: PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    if (selecting) {
      props.onSelect(null);
      return;
    }
    if (!drawing) return;
    const p = point(e);
    if (tool === "comment") {
      props.onCreate({ type: "comment", page, x: p[0], y: p[1], text: "" });
      return;
    }
    try {
      // Keep receiving moves if the pointer leaves the page mid-stroke.
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture isn't available for this pointer; drawing still works within the page.
    }
    setDraft(tool === "highlight" ? { type: "highlight", start: p, end: p } : { type: "ink", points: [p] });
  }

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    const draft = draftRef.current;
    if (!draft) return;
    const p = point(e);
    setDraft(draft.type === "highlight" ? { ...draft, end: p } : { ...draft, points: [...draft.points, p] });
  }

  function onPointerUp() {
    const draft = draftRef.current;
    if (!draft) return;
    if (draft.type === "highlight") {
      const [x1, y1] = draft.start;
      const [x2, y2] = draft.end;
      const w = Math.abs(x2 - x1);
      const h = Math.abs(y2 - y1);
      if (w >= MIN_HIGHLIGHT && h >= MIN_HIGHLIGHT) {
        props.onCreate({ type: "highlight", page, x: Math.min(x1, x2), y: Math.min(y1, y2), w, h, color: props.highlightColor });
      }
    } else if (draft.points.length > 1) {
      props.onCreate({ type: "ink", page, points: draft.points, color: props.inkColor, width: props.inkWidth });
    }
    setDraft(null);
  }

  const itemPointer = (id: string) => (e: PointerEvent) => {
    if (!selecting) return;
    e.stopPropagation();
    props.onSelect(id);
  };

  const selected = items.find((a) => a.id === selectedId);
  const sel = selected ? bounds(selected) : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      width={width * scale}
      height={height * scale}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDraft(null)}
      className="absolute inset-0"
      style={{
        cursor: tool === "comment" ? "copy" : drawing ? "crosshair" : "default",
        // Drawing tools take over touch input; otherwise touch scrolls the page.
        touchAction: drawing && tool !== "comment" ? "none" : "auto",
        pointerEvents: drawing || selecting ? "auto" : "none",
      }}
      aria-label={`Annotations on page ${page + 1}`}
      role="group"
    >
      {items.map((a) => {
        const common = { onPointerDown: itemPointer(a.id), style: { cursor: selecting ? "pointer" : undefined } };
        if (a.type === "highlight") {
          return <rect key={a.id} {...common} x={a.x} y={a.y} width={a.w} height={a.h} fill={a.color} fillOpacity={0.45} style={{ ...common.style, mixBlendMode: "multiply" }} />;
        }
        if (a.type === "ink") {
          const pts = a.points.map((p) => p.join(",")).join(" ");
          return (
            <g key={a.id} {...common}>
              {/* Wider invisible line makes thin strokes easy to click. */}
              <polyline points={pts} fill="none" stroke="transparent" strokeWidth={Math.max(10, a.width + 6)} />
              <polyline points={pts} fill="none" stroke={a.color} strokeWidth={a.width} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        }
        const s = COMMENT_SIZE;
        return (
          <g key={a.id} {...common}>
            <title>{a.text || "Empty comment"}</title>
            <rect x={a.x + 0.5} y={a.y + 0.5} width={s - 1} height={s - 1} fill="#ffd93b" stroke="#8c6b00" strokeWidth={1} strokeDasharray={a.text.trim() ? undefined : "3 2"} />
            {[6, 10, 14].map((ly) => (
              <line key={ly} x1={a.x + 4} x2={a.x + s - 4} y1={a.y + ly} y2={a.y + ly} stroke="#664d00" strokeWidth={1} />
            ))}
          </g>
        );
      })}

      {draft?.type === "highlight" && (
        <rect
          x={Math.min(draft.start[0], draft.end[0])}
          y={Math.min(draft.start[1], draft.end[1])}
          width={Math.abs(draft.end[0] - draft.start[0])}
          height={Math.abs(draft.end[1] - draft.start[1])}
          fill={props.highlightColor}
          fillOpacity={0.45}
          style={{ mixBlendMode: "multiply" }}
        />
      )}
      {draft?.type === "ink" && (
        <polyline
          points={draft.points.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke={props.inkColor}
          strokeWidth={props.inkWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {sel && selected && (
        <rect
          x={sel.x - 3}
          y={sel.y - 3}
          width={sel.w + 6}
          height={sel.h + 6}
          fill="none"
          stroke="#5a47e0"
          strokeWidth={1.5 / scale}
          strokeDasharray={`${4 / scale} ${3 / scale}`}
          pointerEvents="none"
          aria-label={`Selected ${describe(selected).toLowerCase()}`}
        />
      )}
    </svg>
  );
}
