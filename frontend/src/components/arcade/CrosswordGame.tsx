import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArcadeCrossword, ArcadeCrosswordEntry } from "../../lib/api";
import { HudButton, MonoLabel } from "../Hud";
import { GameShell, useElapsed } from "./shared";

const key = (r: number, c: number) => `${r},${c}`;

function cellsOf(e: ArcadeCrosswordEntry): [number, number][] {
  return Array.from({ length: e.answer.length }, (_, i): [number, number] =>
    e.dir === "across" ? [e.row, e.col + i] : [e.row + i, e.col]
  );
}

export default function CrosswordGame({
  data, provider, onExit, onComplete, onShowResult,
}: {
  data: ArcadeCrossword;
  provider?: string;
  onExit: () => void;
  onComplete: (score: number, timeS: number) => void;
  onShowResult?: () => void;
}) {
  const { solution, numbers, fillable } = useMemo(() => {
    const solution: Record<string, string> = {};
    const numbers: Record<string, number> = {};
    data.entries.forEach((e) => {
      cellsOf(e).forEach(([r, c], i) => { solution[key(r, c)] = e.answer[i]; });
      numbers[key(e.row, e.col)] = e.num;
    });
    return { solution, numbers, fillable: new Set(Object.keys(solution)) };
  }, [data]);

  const [values, setValues] = useState<Record<string, string>>({});
  const [activeEntry, setActiveEntry] = useState(0);
  const [activeCell, setActiveCell] = useState<string>(() => key(data.entries[0].row, data.entries[0].col));
  const [marks, setMarks] = useState<Record<string, "correct" | "wrong">>({});
  const [done, setDone] = useState(false);
  const elapsed = useElapsed(!done);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  const entryCells = useMemo(() => cellsOf(data.entries[activeEntry]).map(([r, c]) => key(r, c)), [data.entries, activeEntry]);

  const focus = useCallback((k: string) => {
    setActiveCell(k);
    refs.current[k]?.focus();
  }, []);

  const finish = useCallback((vals: Record<string, string>) => {
    const total = fillable.size;
    let correct = 0;
    fillable.forEach((k) => { if ((vals[k] ?? "") === solution[k]) correct++; });
    setDone(true);
    onComplete(Math.round((100 * correct) / total), elapsed);
  }, [fillable, solution, elapsed, onComplete]);

  const setCell = useCallback((k: string, ch: string) => {
    setValues((v) => {
      const next = { ...v, [k]: ch };
      if (ch && [...fillable].every((fk) => next[fk] === solution[fk])) finish(next);
      return next;
    });
    setMarks((m) => { const n = { ...m }; delete n[k]; return n; });
  }, [fillable, solution, finish]);

  const advance = useCallback((from: string) => {
    const idx = entryCells.indexOf(from);
    if (idx >= 0 && idx < entryCells.length - 1) focus(entryCells[idx + 1]);
  }, [entryCells, focus]);

  const retreat = useCallback((from: string) => {
    const idx = entryCells.indexOf(from);
    if (idx > 0) focus(entryCells[idx - 1]);
  }, [entryCells, focus]);

  function selectCell(r: number, c: number) {
    const k = key(r, c);
    if (!fillable.has(k)) return;
    // if already active, toggle to the perpendicular entry through this cell
    const covering = data.entries
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => cellsOf(e).some(([rr, cc]) => key(rr, cc) === k));
    if (covering.length) {
      const cur = covering.findIndex(({ i }) => i === activeEntry);
      const pick = k === activeCell && covering.length > 1
        ? covering[(cur + 1) % covering.length]
        : covering.find(({ i }) => i === activeEntry) ?? covering[0];
      setActiveEntry(pick.i);
    }
    focus(k);
  }

  function selectEntry(i: number) {
    setActiveEntry(i);
    const cells = cellsOf(data.entries[i]).map(([r, c]) => key(r, c));
    focus(cells.find((k) => !values[k]) ?? cells[0]);
  }

  function onKey(e: React.KeyboardEvent, k: string) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (values[k]) setCell(k, "");
      else retreat(k);
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      setCell(k, e.key.toUpperCase());
      advance(k);
    }
  }

  function check() {
    const m: Record<string, "correct" | "wrong"> = {};
    fillable.forEach((k) => { if (values[k]) m[k] = values[k] === solution[k] ? "correct" : "wrong"; });
    setMarks(m);
    setTimeout(() => setMarks({}), 1600);
  }

  useEffect(() => { refs.current[activeCell]?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const across = data.entries.filter((e) => e.dir === "across");
  const down = data.entries.filter((e) => e.dir === "down");
  const filledCount = [...fillable].filter((k) => values[k]).length;

  const ClueList = ({ title, items }: { title: string; items: ArcadeCrosswordEntry[] }) => (
    <div style={{ marginBottom: 14 }}>
      <MonoLabel style={{ color: "var(--pink-soft)" }}>{title}</MonoLabel>
      <div style={{ marginTop: 6, display: "grid", gap: 5 }}>
        {items.map((e) => {
          const i = data.entries.indexOf(e);
          return (
            <button key={`${e.num}${e.dir}`} onClick={() => selectEntry(i)} style={{
              textAlign: "left", background: i === activeEntry ? "rgba(213,139,232,0.14)" : "transparent",
              border: "none", cursor: "pointer", padding: "4px 6px", fontSize: 12.5,
              color: i === activeEntry ? "var(--text-bright)" : "var(--text-dim)", lineHeight: 1.4,
            }}>
              <strong style={{ color: "var(--gold)" }}>{e.num}.</strong> {e.clue}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <GameShell
      title="Crossword"
      provider={provider}
      elapsed={elapsed}
      onExit={onExit}
      done={done}
      onShowResult={onShowResult}
      subtitle={<>Fill the grid from the clues — every answer is a term from this star. Click a cell or clue, then type.</>}
      footer={done
        ? <MonoLabel style={{ color: "var(--blue)" }}>SOLUTION REVEALED · YOUR CORRECT CELLS IN BLUE, ANSWERS IN GOLD</MonoLabel>
        : <>
            <MonoLabel>{filledCount}/{fillable.size} FILLED</MonoLabel>
            <HudButton variant="purple" onClick={check}>✓ CHECK</HudButton>
            <HudButton onClick={() => finish(values)}>▸ FINISH</HudButton>
          </>}
    >
      <div style={{ display: "flex", gap: 26, flexWrap: "wrap", justifyContent: "center" }}>
        <div
          className="xword-grid"
          style={{ gridTemplateColumns: `repeat(${data.cols}, 40px)`, gridTemplateRows: `repeat(${data.rows}, 40px)` }}
        >
          {Array.from({ length: data.rows }).map((_, r) =>
            Array.from({ length: data.cols }).map((_, c) => {
              const k = key(r, c);
              if (!fillable.has(k)) return <div key={k} className="xword-cell block" />;
              const inWord = entryCells.includes(k);
              const doneClass = done ? (values[k] === solution[k] ? "correct" : "revealed") : "";
              const mark = done ? doneClass : (marks[k] ?? "");
              return (
                <div key={k} className={`xword-cell ${!done && k === activeCell ? "active" : ""} ${!done && inWord ? "inword" : ""} ${mark}`}>
                  {numbers[k] && <span className="xword-num">{numbers[k]}</span>}
                  <input
                    ref={(el) => { refs.current[k] = el; }}
                    value={done ? solution[k] : (values[k] ?? "")}
                    onChange={() => {}}
                    onKeyDown={(e) => onKey(e, k)}
                    onFocus={() => setActiveCell(k)}
                    onClick={() => selectCell(r, c)}
                    readOnly={done}
                    maxLength={1}
                  />
                </div>
              );
            })
          )}
        </div>

        <div style={{ minWidth: 220, flex: 1 }}>
          <ClueList title="ACROSS" items={across} />
          <ClueList title="DOWN" items={down} />
        </div>
      </div>
    </GameShell>
  );
}
