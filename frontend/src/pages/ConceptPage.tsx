import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiConceptMap } from "../lib/api";
import ConceptPlayer from "../components/ConceptPlayer";
import ConceptVideo from "../components/ConceptVideo";
import { MindmapView, DefinitionView, FlowView, KIND_LABEL } from "../components/SlideViews";
import { HudButton, HudPanel, MonoLabel } from "../components/Hud";

type Mode = "video" | "deck";

// ─── Page ───────────────────────────────────────────────────────────────────
export default function ConceptPage() {
  const { starId, subtopicId } = useParams();
  const navigate = useNavigate();
  const [map, setMap] = useState<ApiConceptMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<Mode>("video");

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
        <h1 className="display-title" style={{ fontSize: 42, fontStyle: "italic", marginBottom: 16 }}>
          {map.name}
        </h1>

        {/* mode switch: narrated video overview vs. click-through deck */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["video", "deck"] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              style={{
                padding: "9px 20px", cursor: "pointer",
                fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em",
                color: mode === m ? "var(--white-core)" : "var(--text-dim)",
                background: mode === m ? "rgba(213,139,232,0.2)" : "rgba(122,75,168,0.06)",
                border: `1px solid ${mode === m ? "var(--pink)" : "rgba(183,156,251,0.25)"}`,
                clipPath: "polygon(7px 0%, 100% 0%, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0% 100%, 0% 7px)",
              }}>
              {m === "video" ? "▶ VIDEO OVERVIEW" : "▤ DECK"}
            </button>
          ))}
        </div>

        {mode === "video" ? (
          <ConceptVideo map={map} onOpenDeck={(i) => { setIdx(i); setMode("deck"); }} />
        ) : (
          <>
            {/* slide tab strip */}
            <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
              {slides.map((s, i) => (
                <button key={i} onClick={() => setIdx(i)}
                  style={{
                    padding: "8px 16px", cursor: "pointer",
                    fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.14em",
                    color: idx === i ? "var(--white-core)" : "var(--text-dim)",
                    background: idx === i ? "rgba(213,139,232,0.18)" : "rgba(122,75,168,0.06)",
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
          </>
        )}
      </div>
    </div>
  );
}
