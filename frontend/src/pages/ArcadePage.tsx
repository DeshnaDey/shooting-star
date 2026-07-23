import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiTopic, ArcadeBundle, ArcadeScoreResult } from "../lib/api";
import { HudButton, HudPanel, MonoLabel } from "../components/Hud";
import SpaceLoader from "../components/SpaceLoader";
import { PixelHud, PixelDecor, ArcadeAstronaut } from "../components/PixelArt";
import NebulaDrift from "../components/NebulaDrift";
import WordleGame from "../components/arcade/WordleGame";
import SpellingBeeGame from "../components/arcade/SpellingBeeGame";
import CrosswordGame from "../components/arcade/CrosswordGame";
import StrandsGame from "../components/arcade/StrandsGame";

type GameId = "wordle" | "spellingbee" | "crossword" | "strands";
const GAMES: { id: GameId; label: string }[] = [
  { id: "wordle", label: "WORDLE" },
  { id: "spellingbee", label: "SPELLING BEE" },
  { id: "crossword", label: "CROSSWORD" },
  { id: "strands", label: "SPRANGLE" },
];

// ─── Star picker (shown when the arcade is opened without a topic) ───────────
function TopicPicker() {
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();
  const [topics, setTopics] = useState<ApiTopic[] | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    api.topics().then(setTopics).catch(() => { setTopics([]); setOffline(true); });
  }, []);

  // Studied ("lit") stars first — their word banks are richest.
  const ordered = useMemo(
    () => [...(topics ?? [])].sort((a, b) => Number(b.lit) - Number(a.lit) || b.progress - a.progress),
    [topics]
  );

  return (
    <div className="page-scroll arc-page">
      <NebulaDrift />
      <PixelDecor />
      <ArcadeAstronaut />
      <div className="arc-topbar">
        <div>
          <div className="mono-label">KNOWLEDGE ARCADE</div>
          <h1 className="display-title" style={{ fontSize: 34, fontStyle: "italic" }}>Pick a star to play</h1>
          <p style={{ fontSize: 13, color: "var(--text-dim)", maxWidth: 460, marginTop: 4 }}>
            Every puzzle is built from the words of a topic you've charted. Choose one of your stars.
          </p>
        </div>
      </div>

      {topics === null ? (
        <HudPanel className="arc-stage"><SpaceLoader label="READING YOUR SKY…" /></HudPanel>
      ) : ordered.length === 0 ? (
        <HudPanel>
          <MonoLabel>{offline ? "API OFFLINE — START THE BACKEND" : "NO STARS YET"}</MonoLabel>
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "8px 0 14px" }}>
            Chart a topic in the constellation first, then come back to play it.
          </p>
          <HudButton onClick={() => navigate("/")}>◄ GO TO CONSTELLATION</HudButton>
        </HudPanel>
      ) : (
        <div className="arc-picker">
          {ordered.map((t) => (
            <button key={t.id} className={`arc-topic ${t.lit ? "lit" : ""}`} onClick={() => setParams({ topic: t.id })}>
              <MonoLabel style={{ color: t.lit ? "var(--pink-soft)" : "var(--text-faint)" }}>
                {t.tag}{t.lit ? ` · ${t.progress}%` : " · UNLIT"}
              </MonoLabel>
              <div className="arc-topic-name">{t.name}</div>
              <div className="arc-topic-play">▸ PLAY</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── The four games for a chosen topic ───────────────────────────────────────
function ArcadeForTopic({ topicId, hasStar }: { topicId: string; hasStar: boolean }) {
  const navigate = useNavigate();
  const [bundle, setBundle] = useState<ArcadeBundle | null>(null);
  const [wordlist, setWordlist] = useState<Set<string>>(new Set());
  const [state, setState] = useState<"loading" | "ok" | "offline">("loading");
  const [active, setActive] = useState<GameId>("wordle");
  const [done, setDone] = useState<Record<GameId, boolean>>({
    wordle: false, spellingbee: false, crossword: false, strands: false,
  });
  const [result, setResult] = useState<ArcadeScoreResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    setState("loading");
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
    setDone({ wordle: false, spellingbee: false, crossword: false, strands: false });
    try {
      const b = await api.arcade(topicId, true);
      setBundle(b);
      setState("ok");
    } catch { setState("offline"); }
  }

  const gameEl = useMemo(() => {
    if (!bundle) return null;
    const common = { done: false, onShowResult: () => setShowResult(true) };
    switch (active) {
      case "wordle":
        return <WordleGame data={bundle.wordle} wordlist={wordlist} {...common} done={done.wordle} onComplete={(s) => onComplete("wordle", s)} />;
      case "spellingbee":
        return <SpellingBeeGame data={bundle.spellingbee} {...common} done={done.spellingbee} onComplete={(s) => onComplete("spellingbee", s)} />;
      case "crossword":
        return <CrosswordGame data={bundle.crossword} {...common} done={done.crossword} onComplete={(s) => onComplete("crossword", s)} />;
      case "strands":
        return <StrandsGame data={bundle.strands} {...common} done={done.strands} onComplete={(s) => onComplete("strands", s)} />;
    }
  }, [active, bundle, wordlist, done]);

  if (state !== "ok" || !bundle) {
    return (
      <div className="page-scroll" style={{ display: "grid", placeItems: "center" }}>
        <HudPanel>
          {state === "loading" ? <SpaceLoader label="BUILDING THE ARCADE…" /> : <MonoLabel>API OFFLINE — START THE BACKEND</MonoLabel>}
          {state === "offline" && (
            <>
              <div style={{ height: 12 }} />
              <HudButton onClick={() => navigate(hasStar ? `/system/${topicId}` : "/arcade")}>◄ BACK</HudButton>
            </>
          )}
        </HudPanel>
      </div>
    );
  }

  return (
    <div className="page-scroll arc-page">
      <NebulaDrift />
      <PixelDecor />
      <ArcadeAstronaut />
      <div className="arc-topbar">
        <div>
          <button className="arc-back" onClick={() => navigate(hasStar ? `/system/${topicId}` : "/arcade")}>
            ◄ {hasStar ? "SYSTEM" : "PICK ANOTHER STAR"}
          </button>
          <div className="mono-label">KNOWLEDGE ARCADE</div>
          <h1 className="display-title" style={{ fontSize: 34, fontStyle: "italic" }}>Play the topic</h1>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <PixelHud lives={3} coins={Object.values(done).filter(Boolean).length * 5} />
          <div style={{ display: "flex", gap: 8 }}>
            {result && <HudButton variant="ghost" onClick={() => setShowResult(true)}>▸ RESULTS</HudButton>}
            <HudButton variant="ghost" onClick={reroll}>↻ NEW PUZZLES</HudButton>
          </div>
        </div>
      </div>

      <div className="arc-tabs">
        {GAMES.map((g) => (
          <button key={g.id} className={`arc-tab ${active === g.id ? "active" : ""} ${done[g.id] ? "done" : ""}`} onClick={() => setActive(g.id)}>
            {g.label}{done[g.id] ? " ✓" : ""}
          </button>
        ))}
      </div>

      <HudPanel className="arc-stage">{gameEl}</HudPanel>

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
    </div>
  );
}

export default function ArcadePage() {
  const { starId } = useParams();
  const [params] = useSearchParams();
  const topicId = starId ?? params.get("topic") ?? undefined;
  if (!topicId) return <TopicPicker />;
  return <ArcadeForTopic topicId={topicId} hasStar={Boolean(starId)} />;
}
