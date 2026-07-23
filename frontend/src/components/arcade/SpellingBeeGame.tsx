import { useCallback, useEffect, useRef, useState } from "react";
import { ArcadeBee } from "../../lib/api";

type Props = {
  data: ArcadeBee;
  done: boolean;
  onComplete: (score: number) => void;
  onShowResult: () => void;
};

function wordPoints(w: string, letterCount: number): number {
  if (w.length === 4) return 1;
  return w.length + (new Set(w).size === letterCount ? 7 : 0); // pangram bonus
}

export default function SpellingBeeGame({ data, onComplete, onShowResult }: Props) {
  const center = data.center.toUpperCase();
  const outer = data.letters.filter((l) => l !== center);
  const answers = data.answers.map((a) => a.toUpperCase());
  const answerSet = new Set(answers);
  const total = answers.reduce((s, w) => s + wordPoints(w, data.letters.length), 0);

  const [order, setOrder] = useState(outer);
  const [cur, setCur] = useState("");
  const [found, setFound] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [notice, setNotice] = useState("");
  const [ended, setEnded] = useState(false);
  const firedRef = useRef(false);

  const type = useCallback((ch: string) => { if (!ended) { setCur((c) => c + ch); setNotice(""); } }, [ended]);

  const submit = useCallback(() => {
    if (ended) return;
    const w = cur.toUpperCase();
    setCur("");
    if (w.length < 4) return setNotice("Too short");
    if (!w.includes(center)) return setNotice("Missing centre letter");
    if (![...w].every((ch) => data.letters.includes(ch))) return setNotice("Bad letters");
    if (found.includes(w)) return setNotice("Already found");
    if (!answerSet.has(w)) return setNotice("Not in word list");
    const pts = wordPoints(w, data.letters.length);
    setFound((f) => [w, ...f]);
    setScore((s) => s + pts);
    setNotice(new Set(w).size === data.letters.length ? "PANGRAM! +" + pts : "+" + pts);
  }, [cur, center, data.letters, found, answerSet, ended]);

  const finish = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    setEnded(true);
    onComplete(score);
  }, [score, onComplete]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (k === "ENTER") submit();
      else if (k === "BACKSPACE") setCur((c) => c.slice(0, -1));
      else if (/^[A-Z]$/.test(k) && k.length === 1 && data.letters.includes(k)) type(k);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit, type, data.letters]);

  const missed = answers.filter((a) => !found.includes(a)).sort();

  return (
    <div className="arc-game">
      <div className="arc-game-head">
        <div className="mono-label" style={{ color: "var(--pink-soft)" }}>SPELLING BEE</div>
        <p className="arc-clue">Make words of 4+ letters that all use the centre letter.</p>
      </div>

      <div className="bee-score">
        <span>{found.length}/{answers.length} words</span>
        <span className="bee-pts">{score} / {total} pts</span>
      </div>

      <div className="bee-current">{cur || " "}</div>
      {notice && <div className="arc-notice">{notice}</div>}

      <div className="bee-hive">
        <button className="bee-cell center" onClick={() => type(center)}>{center}</button>
        {order.map((l, i) => (
          <button key={l} className={`bee-cell p${i}`} onClick={() => type(l)}>{l}</button>
        ))}
      </div>

      <div className="bee-controls">
        <button className="hud-btn ghost arc-mini" onClick={() => setCur((c) => c.slice(0, -1))}>DELETE</button>
        <button className="hud-btn ghost arc-mini" onClick={() => setOrder((o) => [...o].sort(() => Math.random() - 0.5))}>↻ SHUFFLE</button>
        <button className="hud-btn arc-mini" onClick={submit}>ENTER</button>
      </div>

      {found.length > 0 && (
        <div className="bee-found">
          {found.map((w) => <span key={w} className="bee-chip">{w}</span>)}
        </div>
      )}

      {!ended ? (
        <button className="hud-btn purple arc-finish" onClick={finish}>FINISH & REVEAL</button>
      ) : (
        <div className="arc-reveal">
          <div className="mono-label" style={{ marginBottom: 6 }}>MISSED WORDS</div>
          <div className="bee-found">
            {missed.length ? missed.map((w) => <span key={w} className="bee-chip missed">{w}</span>) : <span>None — perfect!</span>}
          </div>
          <button className="hud-btn ghost arc-mini" style={{ marginTop: 10 }} onClick={onShowResult}>▸ RESULTS</button>
        </div>
      )}
    </div>
  );
}
