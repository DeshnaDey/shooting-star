import { useCallback, useEffect, useMemo, useState } from "react";
import { ArcadeSpellingBee } from "../../lib/api";
import { HudButton, MonoLabel } from "../Hud";
import { GameShell, useElapsed } from "./shared";

// hive positions: 6 outer petals around a fixed centre
const POS = [
  { top: 0, left: 40 }, { top: 0, left: 138 },
  { top: 82, left: 0 }, { top: 82, left: 178 },
  { top: 164, left: 40 }, { top: 164, left: 138 },
];

function points(word: string, letters: Set<string>): number {
  if (word.length === 4) return 1;
  let p = word.length;
  if (new Set(word).size === letters.size && [...letters].every((l) => word.includes(l))) p += 7; // pangram
  return p;
}

export default function SpellingBeeGame({
  data, provider, onExit, onComplete, onShowResult,
}: {
  data: ArcadeSpellingBee;
  provider?: string;
  onExit: () => void;
  onComplete: (score: number, timeS: number) => void;
  onShowResult?: () => void;
}) {
  const center = data.center.toUpperCase();
  const answers = useMemo(() => new Set(data.answers.map((a) => a.toUpperCase())), [data.answers]);
  const letterSet = useMemo(() => new Set(data.letters.map((l) => l.toUpperCase())), [data.letters]);
  const totalPoints = useMemo(
    () => [...answers].reduce((s, w) => s + points(w, letterSet), 0),
    [answers, letterSet]
  );

  const [outer, setOuter] = useState(() => data.letters.map((l) => l.toUpperCase()).filter((l) => l !== center));
  const [input, setInput] = useState("");
  const [found, setFound] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const elapsed = useElapsed(!done);

  const earned = found.reduce((s, w) => s + points(w, letterSet), 0);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 1400); };

  const submit = useCallback(() => {
    const w = input.toUpperCase();
    setInput("");
    if (w.length < 4) return flash("Too short — 4 letters minimum");
    if (!w.includes(center)) return flash("Missing the centre letter");
    if (![...w].every((c) => letterSet.has(c))) return flash("Uses a letter not in the hive");
    if (found.includes(w)) return flash("Already found");
    if (!answers.has(w)) return flash("Not in the word list");
    setFound((f) => [w, ...f]);
    const p = points(w, letterSet);
    flash(new Set(w).size === letterSet.size ? `PANGRAM! +${p}` : `Nice! +${p}`);
  }, [input, center, letterSet, found, answers]);

  const type = useCallback((c: string) => setInput((v) => v + c), []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter") submit();
      else if (e.key === "Backspace") setInput((v) => v.slice(0, -1));
      else if (/^[a-zA-Z]$/.test(e.key)) {
        const c = e.key.toUpperCase();
        if (letterSet.has(c)) setInput((v) => v + c);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [submit, letterSet]);

  function finish() {
    setDone(true);
    onComplete(totalPoints ? Math.round((100 * earned) / totalPoints) : 0, elapsed);
  }

  return (
    <GameShell
      title="Spelling Bee"
      provider={provider}
      elapsed={elapsed}
      onExit={onExit}
      done={done}
      onShowResult={onShowResult}
      subtitle={<>Make words of 4+ letters that always include the golden centre letter. Reuse letters freely. Find the pangram that uses all seven.</>}
      footer={done
        ? <MonoLabel style={{ color: "var(--blue)" }}>SCORED {earned}/{totalPoints} PTS · SOLUTIONS REVEALED →</MonoLabel>
        : <HudButton onClick={finish}>▸ FINISH ({earned}/{totalPoints} pts)</HudButton>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26, alignItems: "start" }}>
        <div>
          <div style={{
            minHeight: 30, textAlign: "center", fontFamily: "var(--font-display)", fontSize: 24,
            letterSpacing: 4, color: "var(--text-bright)", textTransform: "uppercase", marginBottom: 8,
          }}>
            {input || <span style={{ color: "var(--text-faint)" }}>type…</span>}
          </div>
          <div style={{ minHeight: 16, textAlign: "center", marginBottom: 10 }}>
            <MonoLabel style={{ color: "var(--gold)" }}>{msg}</MonoLabel>
          </div>

          <div className="bee-hive">
            <div
              className="bee-cell center"
              style={{ top: 82, left: 89 }}
              onClick={() => type(center)}
            >{center}</div>
            {outer.map((l, i) => (
              <div key={l} className="bee-cell" style={POS[i]} onClick={() => type(l)}>{l}</div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
            <HudButton variant="ghost" onClick={() => setInput((v) => v.slice(0, -1))}>⌫ DELETE</HudButton>
            <HudButton variant="ghost" onClick={() => setOuter((o) => [...o].sort(() => Math.random() - 0.5))}>⟳ SHUFFLE</HudButton>
            <HudButton onClick={submit}>ENTER</HudButton>
          </div>
        </div>

        <div>
          <MonoLabel>FOUND · {found.length}/{answers.size}</MonoLabel>
          <div style={{
            marginTop: 8, display: "grid", gap: 4, maxHeight: 220, overflowY: "auto",
            gridTemplateColumns: "1fr 1fr",
          }}>
            {found.length === 0 && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>No words yet…</span>}
            {found.map((w) => (
              <span key={w} style={{
                fontSize: 13, color: new Set(w).size === letterSet.size ? "var(--gold)" : "var(--text-main)",
                textTransform: "lowercase", fontFamily: "var(--font-body)",
              }}>{w.toLowerCase()}</span>
            ))}
          </div>

          {done && (() => {
            const missed = [...answers].filter((a) => !found.includes(a)).sort();
            return missed.length > 0 ? (
              <div style={{ marginTop: 14 }}>
                <MonoLabel style={{ color: "var(--pink-soft)" }}>MISSED · {missed.length}</MonoLabel>
                <div style={{ marginTop: 8, display: "grid", gap: 4, gridTemplateColumns: "1fr 1fr" }}>
                  {missed.map((w) => (
                    <span key={w} style={{
                      fontSize: 13, color: "var(--text-faint)", textTransform: "lowercase",
                      fontFamily: "var(--font-body)",
                    }}>{w.toLowerCase()}</span>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ marginTop: 12, fontSize: 12, color: "var(--blue)" }}>Perfect — you found them all!</p>
            );
          })()}
        </div>
      </div>
    </GameShell>
  );
}
