import { useCallback, useEffect, useState } from "react";
import { api, ArcadeWordle } from "../../lib/api";
import { HudButton, MonoLabel } from "../Hud";
import { GameShell, useElapsed } from "./shared";

type State = "correct" | "present" | "absent";

const KEYS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

function evaluate(guess: string, answer: string): State[] {
  const res: State[] = Array(guess.length).fill("absent");
  const pool: Record<string, number> = {};
  for (const ch of answer) pool[ch] = (pool[ch] ?? 0) + 1;
  guess.split("").forEach((ch, i) => {
    if (answer[i] === ch) { res[i] = "correct"; pool[ch]--; }
  });
  guess.split("").forEach((ch, i) => {
    if (res[i] !== "correct" && pool[ch] > 0) { res[i] = "present"; pool[ch]--; }
  });
  return res;
}

export default function WordleGame({
  data, provider, onExit, onComplete, onShowResult,
}: {
  data: ArcadeWordle;
  provider?: string;
  onExit: () => void;
  onComplete: (score: number, timeS: number) => void;
  onShowResult?: () => void;
}) {
  const answer = data.answer.toUpperCase();
  const len = data.length;
  const maxGuesses = data.maxGuesses;

  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState("");
  const [valid, setValid] = useState<Set<string> | null>(null);
  const elapsed = useElapsed(!done);

  useEffect(() => { api.wordList().then(setValid).catch(() => setValid(null)); }, []);

  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(""), 1400); };

  const keyStates: Record<string, State> = {};
  guesses.forEach((g) => {
    const ev = evaluate(g, answer);
    g.split("").forEach((ch, i) => {
      const prev = keyStates[ch];
      const rank = { absent: 0, present: 1, correct: 2 };
      if (!prev || rank[ev[i]] > rank[prev]) keyStates[ch] = ev[i];
    });
  });

  const submitGuess = useCallback(() => {
    if (current.length !== len || done) return;
    const g = current.toUpperCase();
    if (valid && !valid.has(g) && g !== answer) {
      flash(`“${g}” isn’t in the word list`);
      return;
    }
    const next = [...guesses, g];
    setGuesses(next);
    setCurrent("");
    if (g === answer) {
      setDone(true);
      onComplete(Math.round((100 * (maxGuesses - next.length + 1)) / maxGuesses), elapsed);
    } else if (next.length >= maxGuesses) {
      setDone(true);
      onComplete(0, elapsed);
    }
  }, [current, len, done, guesses, answer, maxGuesses, elapsed, onComplete, valid]);

  const press = useCallback((k: string) => {
    if (done) return;
    if (k === "ENTER") submitGuess();
    else if (k === "DEL") setCurrent((c) => c.slice(0, -1));
    else if (/^[A-Z]$/.test(k) && current.length < len) setCurrent((c) => c + k);
  }, [done, submitGuess, current.length, len]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter") press("ENTER");
      else if (e.key === "Backspace") press("DEL");
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toUpperCase());
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [press]);

  const rows = Array.from({ length: maxGuesses }, (_, r) => {
    if (r < guesses.length) return { word: guesses[r], states: evaluate(guesses[r], answer) };
    if (r === guesses.length) return { word: current.padEnd(len), states: null as State[] | null };
    return { word: " ".repeat(len), states: null };
  });

  return (
    <GameShell
      title="Wordle"
      provider={provider}
      elapsed={elapsed}
      onExit={onExit}
      done={done}
      onShowResult={onShowResult}
      subtitle={
        <>
          Guess the {len}-letter word. <strong style={{ color: "var(--text-bright)" }}>Clue:</strong> {data.clue}
          <div style={{ marginTop: 4 }}>
            <MonoLabel>FROM YOUR “{data.subtopic.toUpperCase()}” STAR</MonoLabel>
          </div>
        </>
      }
      footer={
        done ? (
          <MonoLabel style={{ color: guesses[guesses.length - 1] === answer ? "var(--blue)" : "#ff8fb4" }}>
            {guesses[guesses.length - 1] === answer ? "SOLVED" : `ANSWER — ${answer}`}
          </MonoLabel>
        ) : (
          <HudButton disabled={current.length !== len} onClick={submitGuess}>▸ ENTER</HudButton>
        )
      }
    >
      <div style={{ minHeight: 16, textAlign: "center", marginBottom: 8 }}>
        <MonoLabel style={{ color: "var(--gold)" }}>{notice}</MonoLabel>
      </div>
      <div style={{ display: "grid", gap: 7, width: 300, margin: "0 auto 24px" }}>
        {rows.map((row, r) => (
          <div key={r} className="wordle-row">
            {Array.from({ length: len }).map((_, c) => {
              const ch = row.word[c]?.trim() ?? "";
              const st = row.states?.[c];
              const cls = st ? st : ch ? "filled" : "";
              return <div key={c} className={`wordle-tile ${cls}`}>{ch}</div>;
            })}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 6, maxWidth: 380, margin: "0 auto" }}>
        {KEYS.map((rowk, i) => (
          <div key={i} style={{ display: "flex", gap: 5, justifyContent: "center" }}>
            {i === 2 && <button className="key" onClick={() => press("ENTER")} style={{ minWidth: 46 }}>⏎</button>}
            {rowk.split("").map((k) => (
              <button key={k} className={`key ${keyStates[k] ?? ""}`} onClick={() => press(k)}>{k}</button>
            ))}
            {i === 2 && <button className="key" onClick={() => press("DEL")} style={{ minWidth: 46 }}>⌫</button>}
          </div>
        ))}
      </div>
    </GameShell>
  );
}
