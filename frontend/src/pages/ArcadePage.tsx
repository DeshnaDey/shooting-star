import { ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ArcadeBundle, ArcadeScoreResult } from "../lib/api";
import { HudButton, HudPanel, MonoLabel } from "../components/Hud";
import SpaceLoader from "../components/SpaceLoader";
import { PixelHud, PixelDecor, PixelSprite, ArcadeStars, ArcadeAstronaut } from "../components/PixelArt";
import NebulaDrift from "../components/NebulaDrift";
import WordleGame from "../components/arcade/WordleGame";
import SpellingBeeGame from "../components/arcade/SpellingBeeGame";
import CrosswordGame from "../components/arcade/CrosswordGame";
import StrandsGame from "../components/arcade/StrandsGame";

type GameId = "wordle" | "spellingbee" | "crossword" | "strands";

// Each game gets its own pixel card: label, a one-line tease, a retro sprite
// and a colour class used for its opaque background + collage placement.
const GAME_CARDS: {
  id: GameId; label: string; tag: string; col: "l" | "r";
  sprite: "letterW" | "bee" | "crossgrid" | "strandpath"; px: number; iconColor?: string; cls: string;
}[] = [
  { id: "wordle",      label: "WORDLE",       tag: "CRACK THE HIDDEN WORD",    col: "l", sprite: "letterW",    px: 15, iconColor: "#3a2f52", cls: "g-wordle" },
  { id: "crossword",   label: "CROSSWORD",    tag: "FILL THE WHOLE GRID",      col: "l", sprite: "crossgrid",  px: 10, cls: "g-crossword" },
  { id: "spellingbee", label: "SPELLING BEE", tag: "SPELL AS MANY AS YOU CAN", col: "r", sprite: "bee",        px: 10, cls: "g-bee" },
  { id: "strands",     label: "SPRANGLE",     tag: "UNTANGLE THE THEME",       col: "r", sprite: "strandpath", px: 10, cls: "g-sprangle" },
];

// Shared page shell so the loading / empty / offline states keep the same
// background (spiral + pixel stars + decor) as the playable arcade.
function ArcadeShell({ children }: { children: ReactNode }) {
  return (
    <div className="page-scroll arc-page">
      <NebulaDrift variant="spiral" />
      <ArcadeStars />
      <PixelDecor />
      <ArcadeAstronaut />
      {children}
    </div>
  );
}

// ─── The daily arcade — one topic, four games, shown as a card collage ───────
function ArcadeForTopic({ topicId, topicName, hasStar }: {
  topicId: string; topicName: string; hasStar: boolean;
}) {
  const navigate = useNavigate();
  const [bundle, setBundle] = useState<ArcadeBundle | null>(null);
  const [wordlist, setWordlist] = useState<Set<string>>(new Set());
  const [state, setState] = useState<"loading" | "ok" | "offline">("loading");
  const [selected, setSelected] = useState<GameId | null>(null);
  const [done, setDone] = useState<Record<GameId, boolean>>({
    wordle: false, spellingbee: false, crossword: false, strands: false,
  });
  const [result, setResult] = useState<ArcadeScoreResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    setState("loading");
    setSelected(null);
    setDone({ wordle: false, spellingbee: false, crossword: false, strands: false });
    api.arcade(topicId).then((b) => { setBundle(b); setState("ok"); }).catch(() => setState("offline"));
    api.arcadeWordlist().then((r) => setWordlist(new Set(r.words.map((w) => w.toUpperCase())))).catch(() => setWordlist(new Set()));
  }, [topicId]);

  const onComplete = async (game: GameId, score: number) => {
    setDone((d) => ({ ...d, [game]: true }));
    try {
      const r = await api.arcadeScore(topicId, { game, score, time_s: 0 });
      setResult(r);
      setShowResult(true);
    } catch { /* leaderboard offline — the game still reveals its own solution */ }
  };

  async function reroll() {
    setState("loading");
    setSelected(null);
    setDone({ wordle: false, spellingbee: false, crossword: false, strands: false });
    try {
      const b = await api.arcade(topicId, true);
      setBundle(b);
      setState("ok");
    } catch { setState("offline"); }
  }

  const gameEl = useMemo(() => {
    if (!bundle || !selected) return null;
    const common = { done: false, onShowResult: () => setShowResult(true) };
    switch (selected) {
      case "wordle":
        return <WordleGame data={bundle.wordle} wordlist={wordlist} {...common} done={done.wordle} onComplete={(s) => onComplete("wordle", s)} />;
      case "spellingbee":
        return <SpellingBeeGame data={bundle.spellingbee} {...common} done={done.spellingbee} onComplete={(s) => onComplete("spellingbee", s)} />;
      case "crossword":
        return <CrosswordGame data={bundle.crossword} {...common} done={done.crossword} onComplete={(s) => onComplete("crossword", s)} />;
      case "strands":
        return <StrandsGame data={bundle.strands} {...common} done={done.strands} onComplete={(s) => onComplete("strands", s)} />;
    }
  }, [selected, bundle, wordlist, done]);

  if (state !== "ok" || !bundle) {
    return (
      <ArcadeShell>
        <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
          <HudPanel>
            {state === "loading" ? <SpaceLoader label="BUILDING TODAY'S ARCADE…" /> : <MonoLabel>API OFFLINE — START THE BACKEND</MonoLabel>}
            {state === "offline" && (
              <>
                <div style={{ height: 12 }} />
                <HudButton onClick={() => navigate(hasStar ? `/system/${topicId}` : "/arcade")}>◄ BACK</HudButton>
              </>
            )}
          </HudPanel>
        </div>
      </ArcadeShell>
    );
  }

  const doneCount = Object.values(done).filter(Boolean).length;
  const activeCard = GAME_CARDS.find((g) => g.id === selected);

  return (
    <ArcadeShell>
      <div className="arc-topbar">
        <div>
          {selected
            ? <button className="arc-back" onClick={() => setSelected(null)}>◄ ALL GAMES</button>
            : hasStar && <button className="arc-back" onClick={() => navigate(`/system/${topicId}`)}>◄ SYSTEM</button>}
          <div className="mono-label">KNOWLEDGE ARCADE · DAILY</div>
          <h1 className="display-title" style={{ fontSize: 34, fontStyle: "italic" }}>
            {selected ? activeCard?.label : "Today's Star"}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-dim)", maxWidth: 480, marginTop: 4 }}>
            {selected
              ? <>Built from <b style={{ color: "var(--pink-soft)" }}>{topicName}</b> — today's charted star.</>
              : <>Every puzzle today is drawn from <b style={{ color: "var(--pink-soft)" }}>{topicName}</b>. One star, four games.</>}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <PixelHud lives={3} coins={doneCount * 5} />
          <div style={{ display: "flex", gap: 8 }}>
            {result && <HudButton variant="ghost" onClick={() => setShowResult(true)}>▸ RESULTS</HudButton>}
            <HudButton variant="ghost" onClick={reroll}>↻ NEW PUZZLES</HudButton>
          </div>
        </div>
      </div>

      {selected ? (
        <HudPanel className="arc-stage">{gameEl}</HudPanel>
      ) : (
        <div className="arc-collage">
          {(["l", "r"] as const).map((col) => (
            <div key={col} className={`arc-col ${col === "r" ? "arc-col-offset" : ""}`}>
              {GAME_CARDS.filter((g) => g.col === col).map((g) => (
                <button
                  key={g.id}
                  className={`arc-gamecard ${g.cls} ${done[g.id] ? "done" : ""}`}
                  onClick={() => setSelected(g.id)}
                >
                  <div className="arc-gamecard-sprite"><PixelSprite name={g.sprite} px={g.px} color={g.iconColor} /></div>
                  <div className="arc-gamecard-body">
                    <div className="arc-gamecard-label">{g.label}{done[g.id] ? " ✓" : ""}</div>
                    <div className="arc-gamecard-tag">{g.tag}</div>
                  </div>
                  <div className="arc-gamecard-play">{done[g.id] ? "▸ REPLAY" : "▸ PLAY"}</div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {showResult && result && (
        <div className="arc-modal" onClick={() => setShowResult(false)}>
          <div className="arc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="arc-modal-head">
              <MonoLabel style={{ color: "var(--pink-soft)" }}>LEADERBOARD · {result.game.toUpperCase()}</MonoLabel>
              <button className="arc-x" onClick={() => setShowResult(false)}>✕</button>
            </div>
            <p className="arc-rank">You ranked <b>#{result.rank}</b> — friends notified ✦</p>
            <div className="arc-board">
              {result.leaderboard.map((l, i) => (
                <div key={i} className={`arc-row ${l.you ? "you" : ""}`}>
                  <span>{i + 1}</span>
                  <span>{l.name}{l.you ? " (you)" : ""}</span>
                  <span>{l.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <button className="hud-btn arc-mini" style={{ marginTop: 14 }} onClick={() => setShowResult(false)}>VIEW SOLUTIONS</button>
          </div>
        </div>
      )}
    </ArcadeShell>
  );
}

// ─── Picks the single daily topic from the cadet's explored stars ────────────
export default function ArcadePage() {
  const navigate = useNavigate();
  const { starId } = useParams();
  const [params] = useSearchParams();
  const explicit = starId ?? params.get("topic") ?? undefined;

  const [pick, setPick] = useState<{ id: string; name: string } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none" | "offline">("loading");

  useEffect(() => {
    api.topics().then((ts) => {
      if (explicit) {
        const t = ts.find((x) => x.id === explicit);
        setPick({ id: explicit, name: t?.name ?? "Today's Star" });
        setState("ready");
        return;
      }
      // Prefer explored ("lit") stars — their word banks are richest. Fall
      // back to any charted topic. The pick is stable for the whole day.
      const explored = ts.filter((t) => t.lit);
      const pool = explored.length ? explored : ts;
      if (!pool.length) { setState("none"); return; }
      const day = Math.floor(Date.now() / 86_400_000);
      const t = pool[day % pool.length];
      setPick({ id: t.id, name: t.name });
      setState("ready");
    }).catch(() => setState(explicit ? "ready" : "offline"));
  }, [explicit]);

  // Offline but with an explicit topic: still try to load that arcade directly.
  useEffect(() => {
    if (state === "ready" && !pick && explicit) setPick({ id: explicit, name: "Today's Star" });
  }, [state, pick, explicit]);

  if (state === "loading") {
    return <ArcadeShell><div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}><HudPanel><SpaceLoader label="READING YOUR SKY…" /></HudPanel></div></ArcadeShell>;
  }
  if (state === "none" || state === "offline") {
    return (
      <ArcadeShell>
        <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
          <HudPanel>
            <MonoLabel>{state === "offline" ? "API OFFLINE — START THE BACKEND" : "NO STARS YET"}</MonoLabel>
            <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "8px 0 14px" }}>
              {state === "offline" ? "The arcade needs the backend running to build today's puzzles." : "Chart a topic in the constellation first — today's games are built from a star you've explored."}
            </p>
            <HudButton onClick={() => navigate("/")}>◄ GO TO CONSTELLATION</HudButton>
          </HudPanel>
        </div>
      </ArcadeShell>
    );
  }

  if (!pick) return null;
  return <ArcadeForTopic topicId={pick.id} topicName={pick.name} hasStar={Boolean(starId)} />;
}
