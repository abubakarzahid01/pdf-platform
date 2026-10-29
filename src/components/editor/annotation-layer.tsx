"use client";

import { useRef, useState, type PointerEvent } from "react";
import {
  COMMENT_SIZE,
  TEXT_ASCENT,
  TEXT_LINE_HEIGHT,
  cssFont,
  describe,
  fontFamilies,
  measureText,
  textLines,
  translate,
  type NewAnnotation,
  type TextStyle,
  type ViewAnnotation,
} from "@/components/editor/annotations";
import type { EditorTool } from "@/components/editor/editor-workspace";

type Props = {
  page: number;
  width: number; // page size at 100%
  height: number;
  scale: number;
  tool: EditorTool;
  items: ViewAnnotation[];
  selectedId: string | null;
  editingId: string | null;
  highlightColor: string;
  inkColor: string;
  inkWidth: number;
  textStyle: TextStyle;
  onCreate: (a: NewAnnotation) => void;
  onSelect: (id: string | null) => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onEdit: (id: string | null) => void;
  onText: (id: string, text: string) => void;
  onRequestImage: (page: number, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
};

type Draft = { type: "highlight"; start: [number, number]; end: [number, number] } | { type: "ink"; points: [number, number][] };
type Move = { id: string; start: [number, number]; dx: number; dy: number };
type Resize = { id: string; start: [number, number]; w: number; h: number; aspect: number; nextW: number };

const MIN_HIGHLIGHT = 4;
const MIN_MOVE = 1;
const MIN_IMAGE = 16;
const HANDLE = 10; // resize handle size in screen pixels

function bounds(a: ViewAnnotation) {
  if (a.type === "highlight" || a.type === "image") return { x: a.x, y: a.y, w: a.w, h: a.h };
  if (a.type === "comment") return { x: a.x, y: a.y, w: COMMENT_SIZE, h: COMMENT_SIZE };
  if (a.type === "text") {
    const lines = textLines(a.text).length;
    return { x: a.x, y: a.y, w: measureText(a.text || " ", a), h: a.size * TEXT_LINE_HEIGHT * lines };
  }
  const xs = a.points.map((p) => p[0]);
  const ys = a.points.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

// Transparent drawing surface over one page. Works in 100% page units; the SVG scales with zoom.
export function AnnotationLayer(props: Props) {
  const { page, width, height, scale, tool, items, selectedId, editingId } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraftState] = useState<Draft | null>(null);
  const [move, setMoveState] = useState<Move | null>(null);
  // Refs hold in-progress strokes and moves so fast pointer events never read a stale
  // value; the state copies are only for drawing them on screen.
  const draftRef = useRef<Draft | null>(null);
  const moveRef = useRef<Move | null>(null);
  const setDraft = (d: Draft | null) => {
    draftRef.current = d;
    setDraftState(d);
  };
  const setMove = (m: Move | null) => {
    moveRef.current = m;
    setMoveState(m);
  };
  const [resize, setResizeState] = useState<Resize | null>(null);
  const resizeRef = useRef<Resize | null>(null);
  const setResize = (r: Resize | null) => {
    resizeRef.current = r;
    setResizeState(r);
  };

  const drawing = tool === "highlight" || tool === "draw" || tool === "comment" || tool === "add-text" || tool === "image";
  const selecting = tool === "select";

  function point(e: PointerEvent): [number, number] {
    const r = svgRef.current!.getBoundingClientRect();
    const x = Math.min(width, Math.max(0, (e.clientX - r.left) / scale));
    const y = Math.min(height, Math.max(0, (e.clientY - r.top) / scale));
    return [x, y];
  }

  function capture(e: PointerEvent) {
    try {
      // Keep receiving moves if the pointer leaves the page mid-stroke.
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Capture isn't available for this pointer; drawing still works within the page.
    }
  }

  function onPointerDown(e: PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    if (editingId) {
      props.onEdit(null);
      return;
    }
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
    if (tool === "image") {
      props.onRequestImage(page, p[0], p[1]);
      return;
    }
    if (tool === "add-text") {
      // Stop the browser's default press handling, which would move focus away from
      // the new text box straight after it opens (and so close it).
      e.preventDefault();
      // Place the click at the middle of the first line, which feels natural.
      props.onCreate({ type: "text", page, x: p[0], y: Math.max(0, p[1] - props.textStyle.size * 0.6), text: "", ...props.textStyle });
      return;
    }
    capture(e);
    setDraft(tool === "highlight" ? { type: "highlight", start: p, end: p } : { type: "ink", points: [p] });
  }

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    const r = resizeRef.current;
    if (r) {
      // Width follows the pointer; height keeps the image's proportions.
      const p = point(e);
      setResize({ ...r, nextW: Math.max(MIN_IMAGE, r.w + (p[0] - r.start[0])) });
      return;
    }
    const m = moveRef.current;
    if (m) {
      const p = point(e);
      setMove({ ...m, dx: p[0] - m.start[0], dy: p[1] - m.start[1] });
      return;
    }
    const draft = draftRef.current;
    if (!draft) return;
    const p = point(e);
    setDraft(draft.type === "highlight" ? { ...draft, end: p } : { ...draft, points: [...draft.points, p] });
  }

  function onPointerUp() {
    const r = resizeRef.current;
    if (r) {
      if (Math.abs(r.nextW - r.w) >= MIN_MOVE) props.onResize(r.id, r.nextW, r.nextW / r.aspect);
      setResize(null);
      return;
    }
    const m = moveRef.current;
    if (m) {
      if (Math.hypot(m.dx, m.dy) >= MIN_MOVE) props.onMove(m.id, m.dx, m.dy);
      setMove(null);
      return;
    }
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

  // With the Select tool, pressing on an item selects it and starts moving it.
  const itemPointer = (id: string) => (e: PointerEvent) => {
    if (!selecting || e.button !== 0) return;
    e.stopPropagation();
    props.onSelect(id);
    capture(e);
    setMove({ id, start: point(e), dx: 0, dy: 0 });
  };

  function startResize(e: PointerEvent, a: Extract<ViewAnnotation, { type: "image" }>) {
    if (e.button !== 0) return;
    e.stopPropagation();
    capture(e);
    setResize({ id: a.id, start: point(e), w: a.w, h: a.h, aspect: a.w / a.h, nextW: a.w });
  }

  const shown = items.map((a) => {
    if (move && move.id === a.id) return translate(a, move.dx, move.dy);
    if (resize && resize.id === a.id && a.type === "image") return { ...a, w: resize.nextW, h: resize.nextW / resize.aspect };
    return a;
  });
  const selected = shown.find((a) => a.id === selectedId);
  const sel = selected && selected.id !== editingId ? bounds(selected) : null;
  const editing = shown.find((a) => a.id === editingId && a.type === "text") as Extract<ViewAnnotation, { type: "text" }> | undefined;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      width={width * scale}
      height={height * scale}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        setDraft(null);
        setMove(null);
        setResize(null);
      }}
      className="absolute inset-0"
      style={{
        cursor: tool === "comment" || tool === "image" ? "copy" : tool === "add-text" ? "text" : drawing ? "crosshair" : "default",
        // Drawing tools take over touch input; otherwise touch scrolls the page.
        touchAction: tool === "highlight" || tool === "draw" || move || resize ? "none" : "auto",
        pointerEvents: drawing || selecting || editingId ? "auto" : "none",
      }}
      aria-label={`Annotations on page ${page + 1}`}
      role="group"
    >
      {shown.map((a) => {
        const common = {
          onPointerDown: itemPointer(a.id),
          style: { cursor: selecting ? (move?.id === a.id ? "grabbing" : "move") : undefined },
        };
        if (a.type === "highlight") {
          return <rect key={a.id} {...common} x={a.x} y={a.y} width={a.w} height={a.h} fill={a.color} fillOpacity={0.45} style={{ ...common.style, mixBlendMode: "multiply" }} />;
        }
        if (a.type === "image") {
          return (
            <image
              key={a.id}
              {...common}
              href={a.src}
              x={a.x}
              y={a.y}
              width={a.w}
              height={a.h}
              preserveAspectRatio="none"
              aria-label={`Image ${a.name}`}
            />
          );
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
        if (a.type === "text") {
          if (a.id === editingId) return null;
          const b = bounds(a);
          return (
            <g key={a.id} {...common} onDoubleClick={() => selecting && props.onEdit(a.id)}>
              {/* Transparent box so the whole text area is easy to grab. */}
              <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="transparent" />
              <text
                fill={a.color}
                fontFamily={fontFamilies.find((f) => f.value === a.family)?.css}
                fontSize={a.size}
                fontWeight={a.bold ? 700 : 400}
                fontStyle={a.italic ? "italic" : "normal"}
                style={{ whiteSpace: "pre" }}
              >
                {textLines(a.text).map((line, i) => (
                  <tspan key={i} x={a.x} y={a.y + a.size * (TEXT_ASCENT + i * TEXT_LINE_HEIGHT)}>
                    {line || " "}
                  </tspan>
                ))}
              </text>
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

      {editing && (
        // A real text field placed on the page; it scales with the zoom like the page does.
        <foreignObject x={editing.x - 2} y={editing.y - 2} width={Math.max(40, width - editing.x)} height={Math.max(editing.size * 2, height - editing.y)}>
          <textarea
            autoFocus
            aria-label="Text box"
            value={editing.text}
            placeholder="Type here"
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => props.onText(editing.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") props.onEdit(null);
            }}
            onBlur={() => props.onEdit(null)}
            rows={Math.max(1, textLines(editing.text).length)}
            style={{
              font: cssFont(editing),
              lineHeight: TEXT_LINE_HEIGHT,
              color: editing.color,
              width: Math.max(editing.size * 4, measureText(editing.text || "Type here", editing) + editing.size),
              padding: 2,
              margin: 0,
              border: `${1.5 / scale}px dashed #5a47e0`,
              borderRadius: 2,
              background: "rgba(255,255,255,0.6)",
              outline: "none",
              resize: "none",
              overflow: "hidden",
              whiteSpace: "pre",
            }}
          />
        </foreignObject>
      )}

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
      {selected?.type === "image" && selecting && (
        <rect
          x={selected.x + selected.w - HANDLE / scale / 2}
          y={selected.y + selected.h - HANDLE / scale / 2}
          width={HANDLE / scale}
          height={HANDLE / scale}
          fill="#ffffff"
          stroke="#5a47e0"
          strokeWidth={1.5 / scale}
          onPointerDown={(e) => startResize(e, selected)}
          style={{ cursor: "nwse-resize" }}
          aria-label="Resize image"
        />
      )}
    </svg>
  );
}
