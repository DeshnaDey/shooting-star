import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiConceptMap, ApiSlide } from "../lib/api";
import ConceptPlayer from "../components/ConceptPlayer";
import { HudButton, HudPanel, MonoLabel } from "../components/Hud";

const BRANCH_COLORS = ["#f78fd2", "#b79cfb", "#f9bce2", "#9d74f7", "#fde3f2", "#d4c6fd"];

// ─── Mindmap slide — radial map ─────────────────────────────────────────────
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) {
      lines.push(cur.trim());
      cur = w;
    } else cur += " " + w;
    if (lines.length === 2) break;
  }
  if (cur.trim() && lines.length < 3) lines.push(cur.trim());
  return lines.slice(0, 3);
}

function MindmapView({ slide }: { slide: Extract<ApiSlide, { kind: "mindmap" }> }) {
  const W = 880, CX = W / 2;
  const branches = slide.branches;
  const perBranchHeights = branches.map((b) => Math.max(90, b.children.length * 46 + 30));
  const R1 = 165;

  // place branches around a circle; children fan outward at the branch angle
  const n = branches.length;
  const H = Math.max(560, 200 + Math.max(...perBranchHeights) * 2);
  const CY = H / 2;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      {branches.map((b, i) => {
        const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
        const bx = CX + Math.cos(angle) * R1;
        const by = CY + Math.sin(angle) * R1 * 0.72;
        const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
        const side = Math.cos(angle) >= 0 ? 1 : -1;

        return (
          <g key={i}>
            {/* center → branch */}
            <path
              d={`M ${CX},${CY} Q ${(CX + bx) / 2},${(CY + by) / 2 - 18} ${bx},${by}`}
              fill="none" stroke={color} strokeWidth="1.6" opacity="0.65"
            />
            {/* branch node */}
            <rect x={bx - 76} y={by - 17} width="152" height="34" rx="17"
              fill="rgba(42,32,68,0.95)" stroke={color} strokeWidth="1.2"
              style={{ filter: `drop-shadow(0 0 8px ${color}55)` }} />
            <text x={bx} y={by + 4} textAnchor="middle" fill="var(--white-core)"
              style={{ font: "600 11.5px var(--font-body)" }}>
              {b.label}
            </text>

            {/* children */}
            {b.children.map((c, j) => {
              const spread = (j - (b.children.length - 1) / 2) * 44;
              const cx = bx + side * 205;
              const cy = by + spread;
              const lines = wrap(c, 30);
              return (
                <g key={j}>
                  <path
                    d={`M ${bx + side * 76},${by} Q ${bx + side * 140},${(by + cy) / 2} ${cx - side * 92},${cy}`}
                    fill="none" stroke={color} strokeWidth="1" opacity="0.4"
                  />
                  <circle cx={cx - side * 92} cy={cy} r="2.4" fill={color} opacity="0.9" />
                  <text
                    x={side === 1 ? cx - 84 : cx + 84}
                    y={cy - (lines.length - 1) * 6 + 4}
                    textAnchor={side === 1 ? "start" : "end"}
                    fill="var(--text-main)"
                    style={{ font: "400 11px var(--font-body)" }}
                  >
                    {lines.map((ln, k) => (
                      <tspan key={k} x={side === 1 ? cx - 84 : cx + 84} dy={k === 0 ? 0 : 13}>{ln}</tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}

      {/* center node on top */}
      <circle cx={CX} cy={CY} r="52" fill="rgba(42,32,68,0.97)"
        stroke="var(--pink)" strokeWidth="1.6"
        style={{ filter: "drop-shadow(0 0 18px rgba(247,143,210,0.5))" }} />
      <text x={CX} y={CY + 4} textAnchor="middle" fill="var(--white-core)"
        style={{ font: "600 12px var(--font-body)" }}>
        {wrap(slide.center, 14).map((ln, k, arr) => (
          <tspan key={k} x={CX} dy={k === 0 ? -(arr.length - 1) * 7 : 14}>{ln}</tspan>
        ))}
      </text>
    </svg>
  );
}

// ─── Definition slide — hard words, simply ──────────────────────────────────
function DefinitionView({ slide }: { slide: Extract<ApiSlide, { kind: "definition" }> }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {slide.terms.map((t, i) => (
        <div key={i} style={{
          padding: "18px 20px",
          background: "rgba(25,18,40,0.6)",
          border: "1px solid rgba(183,156,251,0.3)",
          clipPath: "polygon(12px 0%, 100% 0%, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0% 100%, 0% 12px)",
        }}>
          <h3 className="display-title" style={{ fontSize: 24, fontStyle: "italic", marginBottom: 12, color: "var(--pink-soft)" }}>
            {t.term}
          </h3>
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <MonoLabel style={{ color: "var(--purple-soft)" }}>THE TEXTBOOK SAYS</MonoLabel>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-dim)", marginTop: 3, fontStyle: "italic" }}>
                “{t.formal}”
              </p>
            </div>
            <div style={{ borderLeft: "2px solid var(--pink)", paddingLeft: 12 }}>
              <MonoLabel style={{ color: "var(--pink-soft)" }}>IN PLAIN WORDS</MonoLabel>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--text-bright)", marginTop: 3 }}>
                {t.simple}
              </p>
            </div>
            {t.analogy && (
              <div>
                <MonoLabel style={{ color: "var(--purple-pale)" }}>THINK OF IT LIKE</MonoLabel>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-main)", marginTop: 3 }}>
                  {t.analogy}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Flow slide (flowchart) ─────────────────────────────────────────────────
function FlowView({ slide }: { slide: Extract<ApiSlide, { kind: "flow" }> }) {
  const { pos, W, H, NODE_W, NODE_H } = useMemo(() => {
    const { nodes, edges } = slide;
    const incoming = new Map<string, number>(nodes.map((n) => [n.id, 0]));
    edges.forEach((e) => incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1));
    const level = new Map<string, number>();
    let frontier = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0).map((n) => n.id);
    if (frontier.length === 0) frontier = [nodes[0].id];
    frontier.forEach((id) => level.set(id, 0));
    let depth = 0;
    while (frontier.length && depth < 12) {
      const next: string[] = [];
      for (const e of edges) {
        if (frontier.includes(e.from) && !level.has(e.to)) {
          level.set(e.to, depth + 1);
          next.push(e.to);
        }
      }
      frontier = next;
      depth++;
    }
    nodes.forEach((n) => { if (!level.has(n.id)) level.set(n.id, depth + 1); });
    const rows = new Map<number, string[]>();
    nodes.forEach((n) => {
      const l = level.get(n.id)!;
      rows.set(l, [...(rows.get(l) ?? []), n.id]);
    });
    const NODE_W = 210, NODE_H = 74, GAP_Y = 66, W = 780;
    const pos = new Map<string, { x: number; y: number }>();
    const sorted = [...rows.keys()].sort((a, b) => a - b);
    sorted.forEach((l, rowIdx) => {
      const ids = rows.get(l)!;
      ids.forEach((id, i) => {
        pos.set(id, { x: (W / (ids.length + 1)) * (i + 1) - NODE_W / 2, y: rowIdx * (NODE_H + GAP_Y) + 16 });
      });
    });
    return { pos, W, H: sorted.length * (NODE_H + GAP_Y) + 30, NODE_W, NODE_H };
  }, [slide]);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <defs>
        <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#f78fd2" opacity="0.8" />
        </marker>
      </defs>
      {slide.edges.map((e, i) => {
        const a = pos.get(e.from), b = pos.get(e.to);
        if (!a || !b) return null;
        const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H;
        const x2 = b.x + NODE_W / 2, y2 = b.y - 4;
        const my = (y1 + y2) / 2;
        return (
          <g key={i}>
            <path d={`M ${x1},${y1} C ${x1},${my} ${x2},${my} ${x2},${y2}`}
              fill="none" stroke="rgba(247,143,210,0.55)" strokeWidth="1.4" markerEnd="url(#arrow)" />
            {e.label && (
              <text x={(x1 + x2) / 2} y={my - 6} textAnchor="middle" fill="var(--text-dim)"
                style={{ font: "400 9px var(--font-mono)", letterSpacing: "0.12em" }}>
                {e.label.toUpperCase()}
              </text>
            )}
          </g>
        );
      })}
      {slide.nodes.map((n) => {
        const p = pos.get(n.id)!;
        return (
          <g key={n.id} transform={`translate(${p.x},${p.y})`}>
            <path d={`M 12,0 H ${NODE_W} V ${NODE_H - 12} L ${NODE_W - 12},${NODE_H} H 0 V 12 Z`}
              fill="rgba(42,32,68,0.92)" stroke="rgba(247,143,210,0.5)" strokeWidth="1"
              style={{ filter: "drop-shadow(0 0 10px rgba(157,116,247,0.25))" }} />
            <text x={NODE_W / 2} y={30} textAnchor="middle" fill="var(--white-core)"
              style={{ font: "600 12.5px var(--font-body)" }}>{n.label}</text>
            <text x={NODE_W / 2} y={50} textAnchor="middle" fill="var(--text-dim)"
              style={{ font: "400 10px var(--font-body)" }}>
              {n.detail.length > 46 ? n.detail.slice(0, 44) + "…" : n.detail}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const KIND_LABEL: Record<ApiSlide["kind"], string> = {
  mindmap: "MINDMAP",
  definition: "DEFINITIONS",
  flow: "FLOWCHART",
  animation: "ANIMATION",
};

// ─── Page ───────────────────────────────────────────────────────────────────
export default function ConceptPage() {
  const { starId, subtopicId } = useParams();
  const navigate = useNavigate();
  const [map, setMap] = useState<ApiConceptMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!subtopicId) return;
    api.concept(subtopicId)
      .then(setMap)
      .catch((e) => setError(e?.status === 404 ? "UNKNOWN SUBTOPIC" : "API OFFLINE — START THE BACKEND"));
  }, [subtopicId]);

  if (error) {
    return (
      <div className="page-scroll" style={{ display: "grid", placeItems: "center" }}>
        <HudPanel>
          <MonoLabel>{error}</MonoLabel>
          <div style={{ height: 12 }} />
          <HudButton onClick={() => navigate(`/system/${starId}`)}>BACK TO SYSTEM</HudButton>
        </HudPanel>
      </div>
    );
  }
  if (!map) {
    return (
      <div className="page-scroll" style={{ display: "grid", placeItems: "center" }}>
        <MonoLabel>GENERATING VISUAL DECK… (FIRST VISIT TAKES A MOMENT)</MonoLabel>
      </div>
    );
  }

  const slides = map.slides;
  const slide = slides[Math.min(idx, slides.length - 1)];

  return (
    <div className="page-scroll">
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 28px 80px 170px" }}>
        <button
          onClick={() => navigate(`/system/${starId}`)}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em",
            color: "var(--text-dim)", marginBottom: 14,
          }}
        >
          ◄ {map.topicName.toUpperCase()} SYSTEM
        </button>
        <div className="mono-label">
          CONCEPT VISUALISER · ENGINE: {map.provider.toUpperCase()}{map.cached ? " · CACHED" : ""}
        </div>
        <h1 className="display-title" style={{ fontSize: 42, fontStyle: "italic", marginBottom: 20 }}>
          {map.name}
        </h1>

        {/* slide tab strip */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
          {slides.map((s, i) => (
            <button key={i} onClick={() => setIdx(i)}
              style={{
                padding: "8px 16px", cursor: "pointer",
                fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.14em",
                color: idx === i ? "var(--white-core)" : "var(--text-dim)",
                background: idx === i ? "rgba(247,143,210,0.18)" : "rgba(157,116,247,0.06)",
                border: `1px solid ${idx === i ? "var(--pink)" : "rgba(183,156,251,0.25)"}`,
                clipPath: "polygon(6px 0%, 100% 0%, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0% 100%, 0% 6px)",
              }}>
              {i + 1} · {KIND_LABEL[s.kind]}
            </button>
          ))}
        </div>

        {/* slide */}
        <HudPanel style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <div>
              <MonoLabel style={{ color: "var(--pink-soft)" }}>
                SLIDE {idx + 1}/{slides.length} · {KIND_LABEL[slide.kind]}
              </MonoLabel>
              <h2 className="display-title" style={{ fontSize: 27, fontStyle: "italic", margin: "4px 0 14px" }}>
                {slide.title}
              </h2>
            </div>
          </div>

          {slide.kind === "mindmap" && <MindmapView slide={slide} />}
          {slide.kind === "definition" && <DefinitionView slide={slide} />}
          {slide.kind === "flow" && <FlowView slide={slide} />}
          {slide.kind === "animation" && <ConceptPlayer frames={slide.frames} />}
        </HudPanel>

        {/* deck navigation */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <HudButton variant="ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>◄ PREV</HudButton>
          <HudButton variant="ghost" disabled={idx === slides.length - 1} onClick={() => setIdx(idx + 1)}>NEXT ►</HudButton>
          <div style={{ flex: 1 }} />
          <HudButton onClick={() => navigate(`/system/${starId}`)}>▸ TEST THIS SYSTEM</HudButton>
        </div>
      </div>
    </div>
  );
}
