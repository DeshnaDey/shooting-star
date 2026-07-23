import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArcadeWordle } from "../../lib/api";

const ROWS = 6;
const KEYS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

type Props = {
  data: ArcadeWordle;
  wordlist: Set<string>;
  done: boolean;
  onComplete: (score: number) => void;
  onShowResult: () => void;
};

type Mark = "correct" | "present" | "absent";

function scoreRow(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(guess.length).fill("absent");
  const pool: Record<string, number> = {};
  for (const ch of answer) pool[ch] = (pool[ch] ?? 0) + 1;
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) { marks[i] = "correct"; pool[guess[i]]--; }
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === "correct") continue;
    if (pool[guess[i]] > 0) { marks[i] = "present"; pool[guess[i]]--; }
  }
  return marks;
}

export default function WordleGame({ data, wordlist, onComplete, onShowResult }: Props) {
  const answer = data.answer.toUpperCase();
  const len = answer.length;
  const [guesses, setGuesses] = useState<string[]>([]);
  const [cur, setCur] = useState("");
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [notice, setNotice] = useState("");
  const start = useRef(Date.now());
  const firedRef = useRef(false);

  const keyState = useMemo(() => {
    const m: Record<string, Mark> = {};
    const rank: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };
    for (const g of guesses) {
      const marks = scoreRow(g, answer);
      g.split("").forEach((ch, i) => {
        if (!(ch in m) || rank[marks[i]] > rank[m[ch]]) m[ch] = marks[i];
      });
    }
    return m;
  }, [guesses, answer]);

  const finish = useCallback((won: boolean, rows: number) => {
    if (firedRef.current) return;
    firedRef.current = true;
    setStatus(won ? "won" : "lost");
    const elapsed = (Date.now() - start.current) / 1000;
    const score = won ? Math.max(200, 1200 - (rows - 1) * 170 - Math.round(elapsed) * 2) : 0;
    onComplete(score);
  }, [onComplete]);

  const submit = useCallback(() => {
    if (status !== "playing") return;
    if (cur.length !== len) { setNotice(`Needs ${len} letters`); return; }
    // Validate against the real word list — but always allow the puzzle's own answer.
    if (wordlist.size && cur !== answer && !wordlist.has(cur)) {
      setNotice(`"${cur}" isn't in the word list`);
      return;
    }
    setNotice("");
    const next = [...guesses, cur];
    setGuesses(next);
    setCur("");
    if (cur === answer) finish(true, next.length);
    else if (next.length >= ROWS) finish(false, next.length);
  }, [cur, len, wordlist, answer, guesses, status, finish]);

  const press = useCallback((k: string) => {
    if (status !== "playing") return;
    if (k === "ENTER") submit();
    else if (k === "DEL") { setCur((c) => c.slice(0, -1)); setNotice(""); }
    else if (/^[A-Z]$/.test(k) && cur.length < len) setCur((c) => c + k);
  }, [status, submit, cur, len]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (k === "ENTER") press("ENTER");
      else if (k === "BACKSPACE") press("DEL");
      else if (/^[A-Z]$/.test(k) && k.length === 1) press(k);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    const g = guesses[r];
    const marks = g ? scoreRow(g, answer) : null;
    const text = g ?? (r === guesses.length ? cur : "");
    const cells = [];
    for (let c = 0; c < len; c++) {
      const ch = text[c] ?? "";
      const mark = marks ? marks[c] : "";
      cells.push(
        <div key={c} className={`wd-cell ${mark} ${ch && !marks ? "filled" : ""}`}>{ch}</div>
      );
    }
    rows.push(<div key={r} className="wd-row" style={{ gridTemplateColumns: `repeat(${len}, 1fr)` }}>{cells}</div>);
  }

  return (
    <div className="arc-game">
      <div className="arc-game-head">
        <div className="mono-label" style={{ color: "var(--pink-soft)" }}>WORDLE · {data.subtopic.toUpperCase()}</div>
        <p className="arc-clue">{data.clue}</p>
      </div>

      <div className="wd-board">{rows}</div>
      {notice && <div className="arc-notice">{notice}</div>}

      {status !== "playing" && (
        <div className="arc-reveal">
          {status === "won" ? "Solved!" : "The word was"} <b>{answer}</b>
          <button className="hud-btn ghost arc-mini" onClick={onShowResult}>▸ RESULTS</button>
        </div>
      )}

      <div className="wd-keys">
        {KEYS.map((row, i) => (
          <div key={i} className="wd-keyrow">
            {i === 2 && <button className="wd-key wide" onClick={() => press("ENTER")}>ENTER</button>}
            {row.split("").map((k) => (
              <button key={k} className={`wd-key ${keyState[k] ?? ""}`} onClick={() => press(k)}>{k}</button>
            ))}
            {i === 2 && <button className="wd-key wide" onClick={() => press("DEL")}>⌫</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
