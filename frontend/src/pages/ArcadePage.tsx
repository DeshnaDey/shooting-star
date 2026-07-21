import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  api, ApiTopic, ArcadeBundle, ArcadeGame, ArcadeScoreResult,
} from "../lib/api";
import { HudButton, HudPanel, MonoLabel } from "../components/Hud";
import { ArcadeResult } from "../components/arcade/shared";
import WordleGame from "../components/arcade/WordleGame";
import SpellingBeeGame from "../components/arcade/SpellingBeeGame";
import CrosswordGame from "../components/arcade/CrosswordGame";
import StrandsGame from "../components/arcade/StrandsGame";

const GAMES: { id: ArcadeGame; name: string; desc: string }[] = [
  { id: "wordle", name: "Wordle", desc: "Guess the 5-letter term from a clue about a concept you’ve studied." },
  { id: "spellingbee", name: "Spelling Bee", desc: "Spell as many words as you can from the hive — hunt for the pangram." },
  { id: "crossword", name: "Crossword", desc: "Fill the interlocking grid; every clue is a term from this star." },
  { id: "strands", name: "Sprangle", desc: "Word-search where every answer ties back to this star’s theme." },
];

function GameIcon({ id }: { id: ArcadeGame }) {
  const p = { width: 28, height: 28, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  if (id === "wordle") return (
    <svg {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.32" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.32" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
  if (id === "spellingbee") return (
    <svg {...p}>
      <path d="M12 3 L19 7 L19 15 L12 19 L5 15 L5 7 Z" />
      <path d="M12 8 L15 9.7 L15 13 L12 14.7 L9 13 L9 9.7 Z" fill="currentColor" opacity="0.4" stroke="none" />
    </svg>
  );
  if (id === "crossword") return (
    <svg {...p}>
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path d="M9 3 V21 M15 3 V21 M3 9 H21 M3 15 H21" strokeWidth="1.1" opacity="0.75" />
      <rect x="3" y="3" width="6" height="6" fill="currentColor" opacity="0.28" stroke="none" />
      <rect x="15" y="15" width="6" height="6" fill="currentColor" opacity="0.28" stroke="none" />
    </svg>
  );
  return ( // strands / word-search
    <svg {...p}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 L21 21" />
      <path d="M8 10 L13 10 M10.5 8 L10.5 13" strokeWidth="1.1" opacity="0.7" />
    </svg>
  );
}

function headline(score: number): string {
  if (score >= 80) return "STELLAR RUN";
  if (score >= 50) return "SOLID CLEAR";
  if (score > 0) return "LOGGED";
  return "TOUGH ONE";
}

export default function ArcadePage() {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<ApiTopic[] | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<ArcadeBundle | null>(null);
  const [loadingBundle, setLoadingBundle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [game, setGame] = useState<ArcadeGame | null>(null);
  const [replay, setReplay] = useState(0);
  const [finished, setFinished] = useState<{ score: number } | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<ArcadeScoreResult | null>(null);

  useEffect(() => {
    api.topics()
      .then((all) => {
        const playable = all.filter((t) => t.subtopics.length > 0);
        setTopics(playable);
        if (playable.length) setTopicId(playable[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!topicId) return;
    setLoadingBundle(true);
    setBundle(null);
    api.arcade(topicId)
      .then(setBundle)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingBundle(false));
  }, [topicId]);

  function openGame(g: ArcadeGame) {
    setGame(g);
    setFinished(null);
    setResult(null);
    setResultOpen(false);
    setReplay((r) => r + 1);
  }

  function exitGame() {
    setGame(null);
    setFinished(null);
    setResult(null);
    setResultOpen(false);
  }

  async function complete(g: ArcadeGame, score: number, timeS: number) {
    setFinished({ score });
    setResultOpen(true);
    if (!topicId) return;
    setScoring(true);
    try {
      setResult(await api.arcadeScore(topicId, { game: g, score, time_s: timeS }));
    } catch {
      /* leaderboard is a demo nicety — ignore failures */
    } finally {
      setScoring(false);
    }
  }

  // ── active game view ──
  if (game && bundle) {
    const common = {
      provider: bundle.provider,
      onExit: exitGame,
      onShowResult: () => setResultOpen(true),
      onComplete: (s: number, t: number) => complete(game, s, t),
    };
    return (
      <>
        <div key={replay}>
          {game === "wordle" && <WordleGame data={bundle.wordle} {...common} />}
          {game === "spellingbee" && <SpellingBeeGame data={bundle.spellingbee} {...common} />}
          {game === "crossword" && <CrosswordGame data={bundle.crossword} {...common} />}
          {game === "strands" && <StrandsGame data={bundle.strands} {...common} />}
        </div>
        {finished && resultOpen && (
          <ArcadeResult
            score={finished.score}
            headline={headline(finished.score)}
            result={result}
            loading={scoring}
            onReplay={() => openGame(game)}
            onExit={exitGame}
            onClose={() => setResultOpen(false)}
          />
        )}
      </>
    );
  }

  // ── hub view ──
  return (
    <div className="page-scroll">
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 90px" }}>
        <MonoLabel style={{ color: "var(--pink-soft)" }}>KNOWLEDGE ARCADE</MonoLabel>
        <h1 className="display-title" style={{ fontSize: 44, fontStyle: "italic", margin: "4px 0 8px" }}>
          Play your stars
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.65, maxWidth: 620, marginBottom: 24 }}>
          Word games built from what you’ve actually studied. Pick a star and the puzzles fill with
          its concepts — race the clock, then challenge your friends.
        </p>

        {error && <MonoLabel style={{ color: "#ff8fb4" }}>ARCADE OFFLINE — {error.toUpperCase()}</MonoLabel>}

        {topics && topics.length === 0 && (
          <HudPanel>
            <MonoLabel>NO STARS TO PLAY YET</MonoLabel>
            <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "10px 0 16px", lineHeight: 1.6 }}>
              Chart a topic in the constellation first — once a star has concepts, its arcade unlocks.
            </p>
            <HudButton onClick={() => navigate("/")}>◄ GO TO CONSTELLATION</HudButton>
          </HudPanel>
        )}

        {topics && topics.length > 0 && (
          <>
            <MonoLabel>CHOOSE A STAR</MonoLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 26px" }}>
              {topics.map((t) => (
                <button
                  key={t.id}
                  className={`star-chip ${t.id === topicId ? "active" : ""}`}
                  onClick={() => setTopicId(t.id)}
                >
                  {t.lit ? "★" : "☆"} {t.name.toUpperCase()}
                </button>
              ))}
            </div>

            {loadingBundle && <MonoLabel>SPINNING UP PUZZLES…</MonoLabel>}

            {bundle && (
              <>
                <div className="arcade-grid">
                  {GAMES.map((g) => (
                    <button key={g.id} className="arcade-card" onClick={() => openGame(g.id)}>
                      <div className="ac-icon"><GameIcon id={g.id} /></div>
                      <h3>{g.name}</h3>
                      <p>{g.desc}</p>
                    </button>
                  ))}
                </div>
                <p style={{ marginTop: 18, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-faint)", letterSpacing: "0.08em" }}>
                  PUZZLES DRAWN FROM “{bundle.topicName.toUpperCase()}”
                  {bundle.provider === "mock" ? " · DETERMINISTIC WORD BANK (LLM OFFLINE)" : " · AI-GENERATED"}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
