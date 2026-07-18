import { useEffect, useMemo, useState } from "react";
import { HudButton } from "./Hud";

export type Frame = { note: string; values: number[]; highlights: number[]; merged?: number[] };

// Step-through bar-animation player, shared by the mission debrief and the
// per-subtopic concept visualiser.
export default function ConceptPlayer({ frames }: { frames: Frame[] }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frame = frames[idx];
  const maxVal = useMemo(() => Math.max(...frames.flatMap((f) => f.values)), [frames]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setIdx((i) => {
        if (i >= frames.length - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, 1600);
    return () => clearInterval(t);
  }, [playing, frames.length]);

  const W = 560, H = 220, PAD = 24;
  const bw = (W - PAD * 2) / frame.values.length;

  return (
    <div>
      <div style={{
        border: "1px solid rgba(183,156,251,0.3)",
        background: "rgba(25,18,40,0.7)",
        padding: "18px 10px 10px",
        clipPath: "polygon(14px 0%, 100% 0%, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0% 100%, 0% 14px)",
      }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
          {frame.values.map((v, i) => {
            const h = (v / maxVal) * (H - 70);
            const isHot = frame.highlights.includes(i);
            const isSet = frame.merged?.includes(i);
            const fill = isHot ? "#f78fd2" : isSet ? "#b79cfb" : "rgba(212,198,253,0.32)";
            return (
              <g key={i}>
                <rect
                  x={PAD + i * bw + 6}
                  y={H - 40 - h}
                  width={bw - 12}
                  height={Math.max(2, h)}
                  rx={3}
                  fill={fill}
                  style={{
                    transition: "all 0.5s ease",
                    filter: isHot ? "drop-shadow(0 0 8px rgba(247,143,210,0.7))" : "none",
                  }}
                />
                <text
                  x={PAD + i * bw + bw / 2} y={H - 20}
                  textAnchor="middle"
                  fill={isHot ? "#fff8fd" : "var(--text-dim)"}
                  style={{ font: "400 11px var(--font-mono)" }}
                >
                  {v}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p style={{ minHeight: 44, margin: "14px 2px 12px", fontSize: 13, lineHeight: 1.55, color: "var(--text-main)" }}>
        <span style={{ color: "var(--pink-soft)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em" }}>
          STEP {idx + 1}/{frames.length} —{" "}
        </span>
        {frame.note}
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <HudButton variant="ghost" onClick={() => { setPlaying(false); setIdx(0); }}>⟲ RESET</HudButton>
        <HudButton variant="ghost" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>◄ STEP</HudButton>
        <HudButton onClick={() => setPlaying((p) => !p)}>{playing ? "❚❚ PAUSE" : "▸ PLAY"}</HudButton>
        <HudButton variant="ghost" disabled={idx === frames.length - 1} onClick={() => setIdx((i) => Math.min(frames.length - 1, i + 1))}>STEP ►</HudButton>
        <div style={{ flex: 1 }} />
        <div className="bar-track" style={{ width: 120 }}>
          <div className="bar-fill" style={{ width: `${((idx + 1) / frames.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
