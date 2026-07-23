import { useEffect, useMemo, useState } from "react";
import { SceneElement, SceneFrame } from "../lib/api";
import { HudButton } from "./Hud";

// Player for keyframed "scene" animations (DNA, atoms, waves, graphs…).
// Elements are keyed by id: any element that keeps its id across frames keeps
// its DOM node, so a CSS transform-transition SLIDES it to its new spot — that's
// how the RNA polymerase glides along the DNA, the pendulum swings, etc.
//
// Modes mirror ConceptPlayer: uncontrolled (own play/step controls, DECK view)
// and controlled (`reveal` 0..1, driven by the Video Overview).

const ACTION_COLOR: Record<string, string> = {
  bind: "#f6d48f", transcribe: "#7fd6a2", translate: "#6ec9e8", release: "#7fd6a2",
  light: "#f6d48f", split: "#6ec9e8", cycle: "#7fd6a2",
  depolarize: "#f6849a", repolarize: "#6ec9e8", stimulus: "#f6d48f",
  approach: "#f6d48f", bond: "#7fd6a2", transfer: "#f6d48f", charge: "#d58be8",
  react: "#f6849a", visit: "#f6d48f", push: "#7fd6a2", pop: "#f6849a",
  fill: "#f6d48f", rotate: "#d58be8", tangent: "#f6d48f", done: "#7fd6a2",
};

function Label({ text, color, size, weight }: { text: string; color: string; size: number; weight: number }) {
  const lines = text.split("\n");
  return (
    <text textAnchor="middle" fill={color}
      style={{ font: `${weight} ${size}px var(--font-body)`, pointerEvents: "none" }}>
      {lines.map((ln, i) => (
        <tspan key={i} x={0} dy={i === 0 ? -(lines.length - 1) * (size * 0.55) : size * 1.1}>{ln}</tspan>
      ))}
    </text>
  );
}

function Element({ el }: { el: SceneElement }) {
  const op = el.opacity ?? 1;
  const move = { transform: `translate(${el.x}px, ${el.y}px)`, opacity: op, transition: "transform 0.55s ease, opacity 0.4s ease" };

  if (el.kind === "line" || el.kind === "arrow") {
    return (
      <line x1={el.x} y1={el.y} x2={el.x2} y2={el.y2}
        stroke={el.color ?? "#6ec9e8"} strokeWidth={el.width ?? 2}
        strokeDasharray={el.dash} opacity={op}
        markerEnd={el.kind === "arrow" ? "url(#scene-arrow)" : undefined}
        style={{ transition: "opacity 0.4s ease" }} />
    );
  }
  if (el.kind === "text") {
    return (
      <g style={move}>
        <text textAnchor={(el.anchor as "start" | "middle" | "end") ?? "middle"} fill={el.color ?? "#cfe4f5"}
          style={{ font: `${el.weight ?? 400} ${el.size ?? 12}px var(--font-body)` }}>
          {el.text}
        </text>
      </g>
    );
  }
  if (el.kind === "box") {
    const w = el.w ?? 54, h = el.h ?? 30;
    return (
      <g style={move}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={el.rx ?? 6}
          fill={el.color ?? "#7a4ba8"} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        {el.label && <Label text={el.label} color={el.textColor ?? "#fff"} size={12} weight={600} />}
      </g>
    );
  }
  // node
  const r = el.r ?? 16;
  return (
    <g style={move}>
      <circle r={r} fill={el.color ?? "#6ec9e8"} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {el.label && <Label text={el.label} color={el.textColor ?? "#08131f"} size={Math.min(13, Math.max(9, r * 0.55))} weight={700} />}
    </g>
  );
}

export default function ScenePlayer({
  frames, width, height, reveal,
}: {
  frames: SceneFrame[];
  width: number;
  height: number;
  reveal?: number;
}) {
  const controlled = reveal !== undefined;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  const cur = controlled
    ? Math.max(0, Math.min(frames.length - 1, Math.floor((reveal as number) * frames.length - 1e-6)))
    : idx;
  const frame = frames[cur];

  useEffect(() => {
    if (controlled || !playing) return;
    const t = setInterval(() => {
      setIdx((i) => { if (i >= frames.length - 1) { setPlaying(false); return i; } return i + 1; });
    }, 1700);
    return () => clearInterval(t);
  }, [controlled, playing, frames.length]);

  // render lines/arrows first (behind), then nodes/boxes/text
  const ordered = useMemo(() => {
    const back = frame.elements.filter((e) => e.kind === "line" || e.kind === "arrow");
    const front = frame.elements.filter((e) => e.kind !== "line" && e.kind !== "arrow");
    return [...back, ...front];
  }, [frame]);

  const badge = frame.action ? ACTION_COLOR[frame.action] : undefined;

  return (
    <div>
      <div style={{
        border: "1px solid rgba(183,156,251,0.3)",
        background: "radial-gradient(circle at 50% 40%, rgba(20,36,66,0.9), rgba(9,18,38,0.92))",
        padding: "10px",
        clipPath: "polygon(14px 0%, 100% 0%, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0% 100%, 0% 14px)",
      }}>
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
          <defs>
            <marker id="scene-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="#f6d48f" />
            </marker>
          </defs>
          {ordered.map((el) => <Element key={el.id} el={el} />)}
        </svg>
      </div>

      <p style={{ minHeight: 44, margin: "14px 2px 12px", fontSize: 13.5, lineHeight: 1.55, color: "var(--text-main)" }}>
        <span style={{ color: "var(--pink-soft)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em" }}>
          STEP {cur + 1}/{frames.length}
        </span>
        {badge && (
          <span style={{
            marginLeft: 8, fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.16em",
            color: "#08131f", background: badge, padding: "2px 8px", borderRadius: 3,
          }}>
            {frame.action?.toUpperCase()}
          </span>
        )}
        <br />
        {frame.caption}
      </p>

      {!controlled && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <HudButton variant="ghost" onClick={() => { setPlaying(false); setIdx(0); }}>⟲ RESET</HudButton>
          <HudButton variant="ghost" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>◄ STEP</HudButton>
          <HudButton onClick={() => setPlaying((p) => !p)}>{playing ? "❚❚ PAUSE" : "▸ PLAY"}</HudButton>
          <HudButton variant="ghost" disabled={idx === frames.length - 1} onClick={() => setIdx((i) => Math.min(frames.length - 1, i + 1))}>STEP ►</HudButton>
          <div style={{ flex: 1 }} />
          <div className="bar-track" style={{ width: 120 }}>
            <div className="bar-fill" style={{ width: `${((cur + 1) / frames.length) * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
