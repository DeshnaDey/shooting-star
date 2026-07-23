import { useCallback, useMemo, useRef, useState } from "react";
import { ArcadeCrossword, ArcadeCrosswordEntry } from "../../lib/api";

type Props = {
  data: ArcadeCrossword;
  done: boolean;
  onComplete: (score: number) => void;
  onShowResult: () => void;
};

const key = (r: number, c: number) => `${r},${c}`;

export default function CrosswordGame({ data, onComplete, onShowResult }: Props) {
  // Build the solution map and per-cell metadata from the entries.
  const { solution, numAt } = useMemo(() => {
    const solution: Record<string, string> = {};
    const numAt: Record<string, number> = {};
    for (const e of data.entries) {
      numAt[key(e.row, e.col)] = e.num;
      for (let i = 0; i < e.answer.length; i++) {
        const r = e.row + (e.dir === "down" ? i : 0);
        const c = e.col + (e.dir === "across" ? i : 0);
        solution[key(r, c)] = e.answer[i];
      }
    }
    return { solution, numAt };
  }, [data]);

  const [grid, setGrid] = useState<Record<string, string>>({});
  const [active, setActive] = useState<{ r: number; c: number } | null>(null);
  const [dir, setDir] = useState<"across" | "down">("across");
  const [revealed, setRevealed] = useState(false);
  const firedRef = useRef(false);

  const isCell = (r: number, c: number) => key(r, c) in solution;

  const step = (r: number, c: number, d: "across" | "down", back = false) => {
    const dd = back ? -1 : 1;
    const nr = r + (d === "down" ? dd : 0);
    const nc = c + (d === "across" ? dd : 0);
    return isCell(nr, nc) ? { r: nr, c: nc } : { r, c };
  };

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!active || revealed) return;
    const k = e.key.toUpperCase();
    if (/^[A-Z]$/.test(k) && k.length === 1) {
      setGrid((g) => ({ ...g, [key(active.r, active.c)]: k }));
      setActive(step(active.r, active.c, dir));
      e.preventDefault();
    } else if (k === "BACKSPACE") {
      setGrid((g) => { const n = { ...g }; delete n[key(active.r, active.c)]; return n; });
      setActive(step(active.r, active.c, dir, true));
      e.preventDefault();
    } else if (k === "ARROWRIGHT" || k === "ARROWLEFT") { setDir("across"); e.preventDefault(); }
    else if (k === "ARROWUP" || k === "ARROWDOWN") { setDir("down"); e.preventDefault(); }
  }, [active, dir, revealed, solution]);

  const selectClue = (en: ArcadeCrosswordEntry) => {
    setActive({ r: en.row, c: en.col });
    setDir(en.dir);
  };

  const finish = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    let correct = 0;
    const totalCells = Object.keys(solution).length;
    for (const cell in solution) if (grid[cell] === solution[cell]) correct++;
    setRevealed(true);
    onComplete(Math.round((correct / totalCells) * 1000));
  };

  const across = data.entries.filter((e) => e.dir === "across");
  const down = data.entries.filter((e) => e.dir === "down");

  return (
    <div className="arc-game">
      <div className="arc-game-head">
        <div className="mono-label" style={{ color: "var(--pink-soft)" }}>CROSSWORD</div>
        <p className="arc-clue">Click a clue or cell, then type. Interlocking answers from this topic.</p>
      </div>

      <div className="cw-layout">
        <div
          className="cw-grid"
          tabIndex={0}
          onKeyDown={onKeyDown}
          style={{ gridTemplateColumns: `repeat(${data.cols}, 30px)` }}
        >
          {Array.from({ length: data.rows * data.cols }).map((_, idx) => {
            const r = Math.floor(idx / data.cols);
            const c = idx % data.cols;
            if (!isCell(r, c)) return <div key={idx} className="cw-block" />;
            const sel = active && active.r === r && active.c === c;
            const val = revealed ? solution[key(r, c)] : (grid[key(r, c)] ?? "");
            const good = revealed && grid[key(r, c)] === solution[key(r, c)];
            return (
              <div
                key={idx}
                className={`cw-cell ${sel ? "sel" : ""} ${revealed ? (good ? "good" : "shown") : ""}`}
                onClick={() => {
                  if (active && active.r === r && active.c === c) setDir((d) => (d === "across" ? "down" : "across"));
                  else setActive({ r, c });
                }}
              >
                {numAt[key(r, c)] && <span className="cw-num">{numAt[key(r, c)]}</span>}
                {val}
              </div>
            );
          })}
        </div>

        <div className="cw-clues">
          {[["ACROSS", across], ["DOWN", down]].map(([label, list]) => (
            <div key={label as string}>
              <div className="mono-label cw-clue-head">{label as string}</div>
              {(list as ArcadeCrosswordEntry[]).map((e) => (
                <button key={`${e.num}-${e.dir}`} className="cw-clue" onClick={() => selectClue(e)}>
                  <b>{e.num}.</b> {e.clue}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {!revealed ? (
        <button className="hud-btn purple arc-finish" onClick={finish}>CHECK & REVEAL</button>
      ) : (
        <div className="arc-reveal">
          Solution filled — your correct cells are blue.
          <button className="hud-btn ghost arc-mini" onClick={onShowResult}>▸ RESULTS</button>
        </div>
      )}
    </div>
  );
}
