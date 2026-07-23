import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiConceptMap, ApiSlide } from "../lib/api";
import { MindmapView, DefinitionView, FlowView, KIND_LABEL } from "./SlideViews";
import ConceptPlayer from "./ConceptPlayer";
import ScenePlayer from "./ScenePlayer";
import { HudButton, MonoLabel } from "./Hud";

// ─── NotebookLM-style narrated "Video Overview" ─────────────────────────────
// Plays the whole concept deck like a video: each slide builds in on screen
// while a spoken narration (Web Speech API — free, offline, no key) reads the
// script. Flowcharts and mindmaps assemble node-by-node in sync with the voice.
// Controls: play/pause, restart, prev/next, mute, and a segmented scrubber.

const speechSupported =
  typeof window !== "undefined" && "speechSynthesis" in window;

/** Narration for a slide — server-provided, with a content-derived fallback so
 *  even older cached decks (pre-narration) still have something to say. */
function narrationFor(slide: ApiSlide): string {
  if (slide.narration && slide.narration.trim().split(" ").length >= 4) {
    return slide.narration.trim();
  }
  switch (slide.kind) {
    case "mindmap":
      return `Here's the big picture of ${slide.center}. It breaks down into ${slide.branches.length} parts: ${slide.branches
        .map((b) => b.label)
        .join(", ")}.`;
    case "definition":
      return `Let's unpack the key terms. ${slide.terms[0].term}: ${slide.terms[0].simple}`;
    case "flow":
      return `Here's how it works, step by step, from ${slide.nodes[0].label} through to ${slide.nodes[slide.nodes.length - 1].label}.`;
    case "animation":
      return `Now let's watch it run. ${slide.frames[0].note}`;
    case "scene":
      return `Let's watch this happen. ${slide.frames[0].caption}`;
  }
}

/** Estimated spoken duration in ms from the word count (~2.6 words/sec). */
function durationMs(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(5000, Math.min(22000, (words / 2.6) * 1000 + 900));
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function ConceptVideo({
  map,
  onOpenDeck,
}: {
  map: ApiConceptMap;
  onOpenDeck?: (slideIdx: number) => void;
}) {
  const slides = map.slides;
  const scripts = useMemo(() => slides.map(narrationFor), [slides]);
  const durations = useMemo(() => scripts.map(durationMs), [scripts]);
  const total = useMemo(() => durations.reduce((a, b) => a + b, 0), [durations]);

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [reveal, setReveal] = useState(0);
  const [done, setDone] = useState(false);

  // refs mirror state so the single rAF loop reads live values
  const idxRef = useRef(0);
  const playingRef = useRef(false);
  const mutedRef = useRef(false);
  const elapsedRef = useRef(0);
  const lastRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  idxRef.current = idx;
  playingRef.current = playing;
  mutedRef.current = muted;

  const speak = useCallback(
    (i: number) => {
      if (!speechSupported || mutedRef.current) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(scripts[i]);
      u.rate = 1;
      u.pitch = 1.02;
      window.speechSynthesis.speak(u);
    },
    [scripts],
  );

  const stopSpeech = useCallback(() => {
    if (speechSupported) window.speechSynthesis.cancel();
  }, []);

  // land on a slide; optionally begin narrating it
  const goTo = useCallback(
    (i: number, autoplay: boolean) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, i));
      elapsedRef.current = 0;
      idxRef.current = clamped;
      setIdx(clamped);
      setReveal(0);
      setDone(false);
      stopSpeech();
      if (autoplay) speak(clamped);
    },
    [slides.length, speak, stopSpeech],
  );

  // one continuous clock; advances slides and drives the reveal build
  useEffect(() => {
    const tick = (now: number) => {
      if (lastRef.current == null) lastRef.current = now;
      const dt = now - lastRef.current;
      lastRef.current = now;

      if (playingRef.current) {
        elapsedRef.current += dt;
        const dur = durations[idxRef.current];
        const rv = Math.min(1, elapsedRef.current / (dur * 0.85));
        setReveal(rv);
        if (elapsedRef.current >= dur) {
          if (idxRef.current >= slides.length - 1) {
            playingRef.current = false;
            setPlaying(false);
            setReveal(1);
            setDone(true);
            stopSpeech();
          } else {
            goTo(idxRef.current + 1, true);
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      stopSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durations, slides.length]);

  const play = useCallback(() => {
    if (done) {
      goTo(0, true);
      setPlaying(true);
      playingRef.current = true;
      return;
    }
    setPlaying(true);
    playingRef.current = true;
    if (elapsedRef.current === 0) speak(idxRef.current);
    else if (speechSupported) window.speechSynthesis.resume();
  }, [done, goTo, speak]);

  const pause = useCallback(() => {
    setPlaying(false);
    playingRef.current = false;
    if (speechSupported) window.speechSynthesis.pause();
  }, []);

  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play]);

  const restart = useCallback(() => {
    goTo(0, playingRef.current);
  }, [goTo]);

  const step = useCallback(
    (delta: number) => {
      goTo(idxRef.current + delta, playingRef.current);
    },
    [goTo],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      if (next) stopSpeech();
      else if (playingRef.current) speak(idxRef.current);
      return next;
    });
  }, [speak, stopSpeech]);

  const slide = slides[idx];
  const playedBefore = durations.slice(0, idx).reduce((a, b) => a + b, 0);
  const playedMs = playedBefore + Math.min(elapsedRef.current, durations[idx]);

  return (
    <div>
      {/* ── video surface ───────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          background: "linear-gradient(160deg, rgba(9,18,38,0.95), rgba(20,10,38,0.92))",
          border: "1px solid rgba(183,156,251,0.32)",
          borderRadius: 4,
          padding: "44px 26px 26px",
          minHeight: 360,
          overflow: "hidden",
          clipPath: "polygon(14px 0%, 100% 0%, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0% 100%, 0% 14px)",
        }}
      >
        {/* top badges */}
        <div style={{ position: "absolute", top: 14, left: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: playing ? "#f6849a" : "var(--text-dim)",
            boxShadow: playing ? "0 0 8px #f6849a" : "none",
            animation: playing ? "pulse 1.4s infinite" : "none",
          }} />
          <MonoLabel style={{ color: "var(--pink-soft)" }}>AI VIDEO OVERVIEW</MonoLabel>
        </div>
        <div style={{ position: "absolute", top: 14, right: 20 }}>
          <MonoLabel style={{ color: "var(--text-dim)" }}>
            {idx + 1}/{slides.length} · {KIND_LABEL[slide.kind]}
          </MonoLabel>
        </div>

        <h2 className="display-title" style={{ fontSize: 24, fontStyle: "italic", margin: "0 0 16px", textAlign: "center" }}>
          {slide.title}
        </h2>

        <div key={idx} style={{ animation: "fadeIn 0.5s ease" }}>
          {slide.kind === "mindmap" && <MindmapView slide={slide} reveal={reveal} />}
          {slide.kind === "definition" && <DefinitionView slide={slide} reveal={reveal} />}
          {slide.kind === "flow" && <FlowView slide={slide} reveal={reveal} />}
          {slide.kind === "animation" && <ConceptPlayer frames={slide.frames} reveal={reveal} />}
          {slide.kind === "scene" && <ScenePlayer frames={slide.frames} width={slide.width} height={slide.height} reveal={reveal} />}
        </div>
      </div>

      {/* ── captions (words brighten as the narration progresses) ──────────── */}
      <div
        style={{
          margin: "14px 0",
          minHeight: 58,
          padding: "12px 16px",
          background: "rgba(11,24,45,0.55)",
          border: "1px solid rgba(183,156,251,0.2)",
          borderLeft: "2px solid var(--pink)",
          fontSize: 14.5,
          lineHeight: 1.6,
        }}
      >
        {(() => {
          const words = scripts[idx].split(" ");
          const spoken = Math.round(reveal * words.length);
          return words.map((w, i) => (
            <span key={i} style={{ color: i < spoken ? "var(--text-bright)" : "var(--text-dim)", transition: "color 0.2s" }}>
              {w}{" "}
            </span>
          ));
        })()}
      </div>

      {/* ── scrubber (segment per slide, sized by duration) ────────────────── */}
      <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
        {slides.map((s, i) => {
          const segFill = i < idx ? 1 : i > idx ? 0 : Math.min(1, elapsedRef.current / durations[i]);
          return (
            <button
              key={i}
              title={`${i + 1} · ${KIND_LABEL[s.kind]}`}
              onClick={() => goTo(i, playingRef.current)}
              style={{
                flex: durations[i],
                height: 8,
                padding: 0,
                cursor: "pointer",
                border: "none",
                borderRadius: 4,
                background: "rgba(122,75,168,0.22)",
                overflow: "hidden",
              }}
            >
              <div style={{
                width: `${segFill * 100}%`,
                height: "100%",
                background: "linear-gradient(90deg, var(--pink), var(--purple-soft))",
                transition: "width 0.2s linear",
              }} />
            </button>
          );
        })}
      </div>

      {/* ── transport controls ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <HudButton variant="ghost" onClick={restart}>⟲ RESTART</HudButton>
        <HudButton variant="ghost" disabled={idx === 0} onClick={() => step(-1)}>◄◄</HudButton>
        <HudButton onClick={toggle}>{playing ? "❚❚ PAUSE" : done ? "▸ REPLAY" : "▸ PLAY"}</HudButton>
        <HudButton variant="ghost" disabled={idx === slides.length - 1} onClick={() => step(1)}>►►</HudButton>
        <HudButton variant="ghost" onClick={toggleMute}>{muted ? "🔇 MUTED" : "🔊 VOICE"}</HudButton>
        <div style={{ flex: 1 }} />
        <MonoLabel style={{ color: "var(--text-dim)" }}>
          {fmt(playedMs)} / {fmt(total)}
        </MonoLabel>
      </div>

      {!speechSupported && (
        <p style={{ marginTop: 10, fontSize: 11, color: "var(--text-dim)", fontStyle: "italic" }}>
          Voice narration isn't supported in this browser — captions still play in sync.
        </p>
      )}

      {onOpenDeck && (
        <div style={{ marginTop: 14 }}>
          <HudButton variant="ghost" onClick={() => onOpenDeck(idx)}>▤ OPEN AS DECK (SLIDE {idx + 1})</HudButton>
        </div>
      )}
    </div>
  );
}
