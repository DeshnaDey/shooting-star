import { useEffect, useMemo, useState } from "react";
import { HudButton } from "./Hud";

export type Pointer = { label: string; index: number };
export type Frame = {
  note: string;
  values: number[];
  highlights: number[];
  merged?: number[];
  dim?: number[];
  pointers?: Pointer[];
  action?: string;
};

// Colours for the different bar states.
const C_LOCKED = "#7fd6a2";              // merged / sorted / found  (green)
const C_HOT = "#f6d48f";                 // being compared / acted on (gold)
const C_DIM = "rgba(163,220,240,0.10)";  // eliminated / out of window
const C_BASE = "rgba(163,220,240,0.32)"; // untouched

// Action badge label + accent per action verb.
const ACTIONS: Record<string, { label: string; color: string }> = {
  compare: { label: "COMPARE", color: C_HOT },
  swap: { label: "⇄ SWAP", color: "#f6849a" },
  keep: { label: "IN ORDER", color: C_LOCKED },
  select: { label: "SELECT", color: C_HOT },
  insert: { label: "INSERT", color: C_LOCKED },
  shift: { label: "SHIFT", color: C_HOT },
  found: { label: "✓ FOUND", color: C_LOCKED },
  eliminate: { label: "ELIMINATE HALF", color: "#f6849a" },
  scan: { label: "SCAN", color: "#a3dcf0" },
  push: { label: "PUSH", color: C_LOCKED },
  pop: { label: "POP", color: "#f6849a" },
  lock: { label: "LOCKED", color: C_LOCKED },
  done: { label: "✓ DONE", color: C_LOCKED },
};

// Step-through bar/pillar player, shared by the mission debrief and the concept
// visualiser. Renders comparisons, swaps, pointers (lo/mid/hi, i, j, top…),
// locked/sorted bars and eliminated ranges for the deterministic algorithm
// animations, and degrades gracefully for plain {values,highlights} frames.
//
// Two modes:
//   • uncontrolled (default) — own PLAY/STEP controls, used in the DECK view.
//   • controlled — pass `reveal` (0..1); frame driven externally, no controls,
//     used by the Video Overview player.
export default function ConceptPlayer({ frames, reveal }: { frames: Frame[]; reveal?: number }) {
  const controlled = reveal !== undefined;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  const revealIdx = controlled
    ? Math.max(0, Math.min(frames.length - 1, Math.floor((reveal as number) * frames.length - 1e-6)))
    : idx;
  const frame = frames[revealIdx];
  const maxVal = useMemo(() => Math.max(1, ...frames.flatMap((f) => f.values)), [frames]);

  useEffect(() => {
    if (controlled || !playing) return;
    const t = setInterval(() => {
      setIdx((i) => {
        if (i >= frames.length - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, 1400);
    return () => clearInterval(t);
  }, [controlled, playing, frames.length]);

  const W = 560, H = 260, PAD = 26;
  const BASELINE = H - 64;          // y of the bar bottoms
  const AREA = BASELINE - 28;       // vertical room for the tallest bar
  const bw = (W - PAD * 2) / frame.values.length;

  const highlights = frame.highlights ?? [];
  const merged = frame.merged ?? [];
  const dim = frame.dim ?? [];
  const action = frame.action ? ACTIONS[frame.action] : undefined;

  const barCenter = (i: number) => PAD + i * bw + bw / 2;
  const barTop = (v: number) => BASELINE - (v / maxVal) * AREA;

  // group pointer labels that land on the same index
  const pointerByIndex = new Map<number, string[]>();
  (frame.pointers ?? []).forEach((p) => {
    pointerByIndex.set(p.index, [...(pointerByIndex.get(p.index) ?? []), p.label]);
  });

  const isSwap = frame.action === "swap" && highlights.length === 2;

  return (
    <div>
      <div style={{
        border: "1px solid rgba(183,156,251,0.3)",
        background: "rgba(11,24,45,0.7)",
        padding: "14px 10px 10px",
        clipPath: "polygon(14px 0%, 100% 0%, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0% 100%, 0% 14px)",
      }}>
        {action && (
          <div style={{ padding: "0 8px 6px" }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.18em",
              color: "#0b182d", background: action.color, padding: "3px 10px", borderRadius: 3,
            }}>
              {action.label}
            </span>
          </div>
        )}
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
          <defs>
            <marker id="swaparrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill={C_HOT} />
            </marker>
          </defs>

          {/* swap arc connecting the two compared bars */}
          {isSwap && (() => {
            const [a, b] = highlights;
            const x1 = barCenter(a), x2 = barCenter(b);
            const y = Math.min(barTop(frame.values[a]), barTop(frame.values[b])) - 16;
            const mx = (x1 + x2) / 2;
            return (
              <path d={`M ${x1},${y + 10} Q ${mx},${y - 12} ${x2},${y + 10}`}
                fill="none" stroke={C_HOT} strokeWidth="1.6"
                markerStart="url(#swaparrow)" markerEnd="url(#swaparrow)" />
            );
          })()}

          {frame.values.map((v, i) => {
            const h = (v / maxVal) * AREA;
            const fill = merged.includes(i) ? C_LOCKED
              : highlights.includes(i) ? C_HOT
              : dim.includes(i) ? C_DIM
              : C_BASE;
            const hot = highlights.includes(i);
            return (
              <g key={i}>
                <rect
                  x={PAD + i * bw + 6}
                  y={BASELINE - h}
                  width={Math.max(2, bw - 12)}
                  height={Math.max(2, h)}
                  rx={3}
                  fill={fill}
                  style={{
                    transition: "all 0.45s ease",
                    filter: hot ? "drop-shadow(0 0 8px rgba(246,212,143,0.8))"
                      : merged.includes(i) ? "drop-shadow(0 0 6px rgba(127,214,162,0.5))" : "none",
                  }}
                />
                <text x={barCenter(i)} y={BASELINE + 16} textAnchor="middle"
                  fill={hot ? "#fff8fd" : dim.includes(i) ? "rgba(200,220,240,0.3)" : "var(--text-dim)"}
                  style={{ font: "500 11px var(--font-mono)" }}>
                  {v}
                </text>
              </g>
            );
          })}

          {/* pointer markers (lo / mid / hi, i, j, top, front…) */}
          {[...pointerByIndex.entries()].map(([i, labels]) => {
            if (i < 0 || i >= frame.values.length) return null;
            const cx = barCenter(i);
            return (
              <g key={`p${i}`}>
                <path d={`M ${cx},${BASELINE + 22} l -4,7 l 8,0 z`} fill="var(--pink)" />
                <text x={cx} y={BASELINE + 42} textAnchor="middle" fill="var(--pink-soft)"
                  style={{ font: "600 9.5px var(--font-mono)", letterSpacing: "0.08em" }}>
                  {labels.join("=")}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p style={{ minHeight: 44, margin: "14px 2px 12px", fontSize: 13, lineHeight: 1.55, color: "var(--text-main)" }}>
        <span style={{ color: "var(--pink-soft)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em" }}>
          STEP {revealIdx + 1}/{frames.length} —{" "}
        </span>
        {frame.note}
      </p>

      {!controlled && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <HudButton variant="ghost" onClick={() => { setPlaying(false); setIdx(0); }}>⟲ RESET</HudButton>
          <HudButton variant="ghost" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>◄ STEP</HudButton>
          <HudButton onClick={() => setPlaying((p) => !p)}>{playing ? "❚❚ PAUSE" : "▸ PLAY"}</HudButton>
          <HudButton variant="ghost" disabled={idx === frames.length - 1} onClick={() => setIdx((i) => Math.min(frames.length - 1, i + 1))}>STEP ►</HudButton>
          <div style={{ flex: 1 }} />
          <div className="bar-track" style={{ width: 120 }}>
            <div className="bar-fill" style={{ width: `${((revealIdx + 1) / frames.length) * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
