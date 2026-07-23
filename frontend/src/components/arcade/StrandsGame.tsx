import { useMemo, useRef, useState } from "react";
import { ArcadeStrands } from "../../lib/api";

type Props = {
  data: ArcadeStrands;
  done: boolean;
  onComplete: (score: number) => void;
  onShowResult: () => void;
};

const key = (r: number, c: number) => `${r},${c}`;

export default function StrandsGame({ data, onComplete, onShowResult }: Props) {
  const [selected, setSelected] = useState<[number, number][]>([]);
  const [found, setFound] = useState<Record<string, [number, number][]>>({});
  const [revealed, setRevealed] = useState(false);
  const firedRef = useRef(false);

  const pathOf = useMemo(() => {
    const m: Record<string, [number, number][]> = {};
    for (const p of data.placements) m[p.word] = p.cells;
    return m;
  }, [data]);

  const foundCells = useMemo(() => {
    const s = new Set<string>();
    Object.values(found).forEach((cells) => cells.forEach(([r, c]) => s.add(key(r, c))));
    if (revealed) data.placements.forEach((p) => p.cells.forEach(([r, c]) => s.add(key(r, c))));
    return s;
  }, [found, revealed, data]);

  const selSet = useMemo(() => new Set(selected.map(([r, c]) => key(r, c))), [selected]);

  const sameCells = (a: [number, number][], b: [number, number][]) => {
    if (a.length !== b.length) return false;
    const eq = (x: [number, number][], y: [number, number][]) =>
      x.every(([r, c], i) => r === y[i][0] && c === y[i][1]);
    return eq(a, b) || eq(a, [...b].reverse());
  };

  const checkMatch = (path: [number, number][]) => {
    for (const [word, cells] of Object.entries(pathOf)) {
      if (!(word in found) && sameCells(path, cells)) {
        setFound((f) => ({ ...f, [word]: cells }));
        setSelected([]);
        return true;
      }
    }
    return false;
  };

  const clickCell = (r: number, c: number) => {
    if (revealed) return;
    if (selSet.has(key(r, c))) { setSelected([]); return; }
    if (selected.length === 0) { setSelected([[r, c]]); return; }
    const [lr, lc] = selected[selected.length - 1];
    if (Math.abs(lr - r) <= 1 && Math.abs(lc - c) <= 1) {
      const next: [number, number][] = [...selected, [r, c]];
      if (!checkMatch(next)) setSelected(next);
    } else {
      setSelected([[r, c]]);
    }
  };

  const finish = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    setRevealed(true);
    const score = Object.keys(found).reduce((s, w) => s + w.length * 10, 0);
    onComplete(score);
  };

  return (
    <div className="arc-game">
      <div className="arc-game-head">
        <div className="mono-label" style={{ color: "var(--pink-soft)" }}>SPRANGLE · {data.theme.toUpperCase()}</div>
        <p className="arc-clue">Link adjacent letters to trace the hidden topic words ({data.placements.length} to find).</p>
      </div>

      <div className="st-grid" style={{ gridTemplateColumns: `repeat(${data.cols}, 32px)` }}>
        {data.grid.map((row, r) =>
          row.split("").map((ch, c) => {
            const inSel = selSet.has(key(r, c));
            const inFound = foundCells.has(key(r, c));
            return (
              <button
                key={key(r, c)}
                className={`st-cell ${inSel ? "sel" : ""} ${inFound ? "found" : ""}`}
                onClick={() => clickCell(r, c)}
              >
                {ch}
              </button>
            );
          })
        )}
      </div>

      <div className="st-words">
        {data.words.map((w) => {
          const got = w.word in found || revealed;
          return (
            <span key={w.word} className={`bee-chip ${got ? "" : "hidden-word"}`} title={w.clue}>
              {got ? w.word : "•".repeat(w.word.length)}
            </span>
          );
        })}
      </div>

      {!revealed ? (
        <button className="hud-btn purple arc-finish" onClick={finish}>FINISH & REVEAL</button>
      ) : (
        <div className="arc-reveal">
          All words revealed.
          <button className="hud-btn ghost arc-mini" onClick={onShowResult}>▸ RESULTS</button>
        </div>
      )}
    </div>
  );
}
