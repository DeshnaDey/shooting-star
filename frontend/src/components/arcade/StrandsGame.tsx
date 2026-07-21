import { useMemo, useState } from "react";
import { ArcadeStrands } from "../../lib/api";
import { HudButton, MonoLabel } from "../Hud";
import { GameShell, useElapsed } from "./shared";

const key = (r: number, c: number) => `${r},${c}`;

// straight line between two cells (8 directions), else null
function lineBetween(a: [number, number], b: [number, number]): [number, number][] | null {
  const [r1, c1] = a, [r2, c2] = b;
  const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
  const lenR = Math.abs(r2 - r1), lenC = Math.abs(c2 - c1);
  if (!((lenR === 0 || lenC === 0 || lenR === lenC))) return null; // not straight/diagonal
  const steps = Math.max(lenR, lenC);
  return Array.from({ length: steps + 1 }, (_, i): [number, number] => [r1 + dr * i, c1 + dc * i]);
}

export default function StrandsGame({
  data, provider, onExit, onComplete, onShowResult,
}: {
  data: ArcadeStrands;
  provider?: string;
  onExit: () => void;
  onComplete: (score: number, timeS: number) => void;
  onShowResult?: () => void;
}) {
  const grid = data.grid; // array of row strings
  const targets = useMemo(() => new Set(data.words.map((w) => w.word.toUpperCase())), [data.words]);
  const placementByWord = useMemo(() => {
    const m: Record<string, string[]> = {};
    data.placements.forEach((p) => { m[p.word.toUpperCase()] = p.cells.map(([r, c]) => key(r, c)); });
    return m;
  }, [data.placements]);

  const [anchor, setAnchor] = useState<[number, number] | null>(null);
  const [found, setFound] = useState<string[]>([]);
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const elapsed = useElapsed(!done);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 1300); };

  function click(r: number, c: number) {
    if (done) return;
    if (!anchor) { setAnchor([r, c]); return; }
    const line = lineBetween(anchor, [r, c]);
    setAnchor(null);
    if (!line) return flash("Words run in straight lines");
    const word = line.map(([rr, cc]) => grid[rr][cc]).join("").toUpperCase();
    const rev = word.split("").reverse().join("");
    const hit = targets.has(word) ? word : targets.has(rev) ? rev : null;
    if (!hit) return flash("Not a target word");
    if (found.includes(hit)) return flash("Already found");
    const next = [...found, hit];
    setFound(next);
    setFoundCells((s) => new Set([...s, ...(placementByWord[hit] ?? line.map(([rr, cc]) => key(rr, cc)))]));
    flash(`Found ${hit}!`);
    if (next.length === targets.size) {
      setDone(true);
      onComplete(100, elapsed);
    }
  }

  function reveal() {
    const all = new Set<string>();
    data.placements.forEach((p) => p.cells.forEach(([r, c]) => all.add(key(r, c))));
    setFoundCells(all);
  }

  function finish() {
    setDone(true);
    onComplete(targets.size ? Math.round((100 * found.length) / targets.size) : 0, elapsed);
    reveal();
  }

  return (
    <GameShell
      title="Sprangle"
      provider={provider}
      elapsed={elapsed}
      onExit={onExit}
      done={done}
      onShowResult={onShowResult}
      subtitle={<>Every hidden word ties back to <strong style={{ color: "var(--text-bright)" }}>{data.theme}</strong>. Click the first and last letter of a word — any direction, including diagonals and backwards.</>}
      footer={done
        ? <MonoLabel style={{ color: "var(--blue)" }}>FOUND {found.length}/{targets.size} · ALL WORDS REVEALED →</MonoLabel>
        : <HudButton onClick={finish}>▸ FINISH ({found.length}/{targets.size})</HudButton>}
    >
      <div style={{ minHeight: 16, textAlign: "center", marginBottom: 10 }}>
        <MonoLabel style={{ color: "var(--gold)" }}>{msg}</MonoLabel>
      </div>

      <div style={{ display: "flex", gap: 26, flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start" }}>
        <div className="ws-grid" style={{ gridTemplateColumns: `repeat(${data.cols}, 34px)` }}>
          {grid.map((row, r) =>
            row.split("").map((ch, c) => {
              const k = key(r, c);
              const isAnchor = anchor && anchor[0] === r && anchor[1] === c;
              const isFound = foundCells.has(k);
              return (
                <div key={k} className={`ws-cell ${isAnchor ? "anchor" : ""} ${isFound ? "found" : ""}`} onClick={() => click(r, c)}>
                  {ch}
                </div>
              );
            })
          )}
        </div>

        <div style={{ minWidth: 200 }}>
          <MonoLabel style={{ color: "var(--pink-soft)" }}>FIND THESE · {found.length}/{data.words.length}</MonoLabel>
          <div style={{ marginTop: 8, display: "grid", gap: 7 }}>
            {data.words.map((w) => {
              const got = found.includes(w.word.toUpperCase());
              const show = got || done;
              return (
                <div key={w.word} style={{ fontSize: 13, lineHeight: 1.35 }}>
                  <span style={{
                    color: got ? "var(--blue)" : done ? "var(--gold)" : "var(--text-main)",
                    textDecoration: got ? "line-through" : "none", fontWeight: 600,
                  }}>{show ? w.word : "•".repeat(w.word.length)}</span>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{w.clue}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </GameShell>
  );
}
