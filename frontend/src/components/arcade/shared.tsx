import { ReactNode, useEffect, useRef, useState } from "react";
import { HudButton, HudPanel, MonoLabel } from "../Hud";
import { ArcadeScoreResult } from "../../lib/api";

// ─── elapsed-time hook (counts up while `running`) ──────────────────────────
export function useElapsed(running: boolean): number {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return s;
}

export function fmtTime(s: number): string {
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

// ─── shell shared by every game (header, clue, timer, exit) ─────────────────
export function GameShell({
  title, subtitle, elapsed, provider, onExit, children, footer, done, onShowResult,
}: {
  title: string;
  subtitle?: ReactNode;
  elapsed: number;
  provider?: string;
  onExit: () => void;
  children: ReactNode;
  footer?: ReactNode;
  done?: boolean;
  onShowResult?: () => void;
}) {
  return (
    <div className="page-scroll">
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "30px 24px 90px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 6 }}>
          <div>
            <MonoLabel style={{ color: "var(--pink-soft)" }}>KNOWLEDGE ARCADE</MonoLabel>
            <h1 className="display-title" style={{ fontSize: 34, fontStyle: "italic" }}>{title}</h1>
          </div>
          <div className="stat-value" style={{ fontFamily: "var(--font-mono)", fontSize: 22, color: "var(--gold)" }}>
            {fmtTime(elapsed)}
          </div>
        </div>
        {subtitle && (
          <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 20 }}>{subtitle}</div>
        )}

        <div style={{ marginTop: subtitle ? 0 : 18 }}>{children}</div>

        <div style={{ display: "flex", gap: 10, marginTop: 26, alignItems: "center", flexWrap: "wrap" }}>
          <HudButton variant="ghost" onClick={onExit}>◄ ARCADE</HudButton>
          <div style={{ flex: 1 }} />
          {footer}
          {done && onShowResult && <HudButton onClick={onShowResult}>▸ RESULTS</HudButton>}
        </div>

        {provider === "mock" && (
          <p style={{ marginTop: 16, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-faint)", letterSpacing: "0.1em" }}>
            LLM OFFLINE — PUZZLE WORDS FROM DETERMINISTIC BANK. START OLLAMA FOR TOPIC-TAILORED VOCABULARY.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── result + hardcoded leaderboard / friend notification ───────────────────
export function ArcadeResult({
  score, headline, result, loading, onReplay, onExit, onClose,
}: {
  score: number;
  headline: string;
  result: ArcadeScoreResult | null;
  loading: boolean;
  onReplay: () => void;
  onExit: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="arcade-overlay">
      <div style={{ width: 440, maxWidth: "92vw" }}>
        <HudPanel>
          {onClose && (
            <button
              onClick={onClose}
              title="View solutions"
              style={{
                position: "absolute", top: 12, right: 14, zIndex: 2, background: "none",
                border: "none", cursor: "pointer", fontFamily: "var(--font-mono)",
                fontSize: 16, color: "var(--text-dim)", lineHeight: 1,
              }}
            >✕</button>
          )}
          <MonoLabel style={{ color: "var(--pink-soft)" }}>{headline}</MonoLabel>
          <h1 className="display-title" style={{ fontSize: 40, fontStyle: "italic", margin: "6px 0 2px" }}>
            {score}<span style={{ fontSize: 20, color: "var(--text-dim)" }}> / 100</span>
          </h1>

          {loading && <MonoLabel>POSTING TO LEADERBOARD…</MonoLabel>}

          {result && (
            <>
              <p style={{ fontSize: 13, color: "var(--text-main)", margin: "8px 0 4px" }}>
                You placed <strong style={{ color: "var(--gold)" }}>#{result.rank}</strong> of {result.total}.
              </p>
              <div style={{ margin: "12px 0" }}>
                {result.leaderboard.map((r, i) => (
                  <div key={i} className={`lb-row ${r.you ? "you" : ""}`}>
                    <span className="lb-rank">#{i + 1}</span>
                    <span className="lb-name">{r.name}{r.you ? " (you)" : ""}</span>
                    <span className="lb-score">{r.score}</span>
                  </div>
                ))}
              </div>
              <div style={{
                display: "flex", gap: 9, alignItems: "flex-start",
                fontSize: 12, color: "var(--blue-soft)", padding: "10px 12px", marginBottom: 4,
                background: "rgba(110,201,232,0.08)", border: "1px solid rgba(110,201,232,0.25)",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                     style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
                  <path d="M10 20a2 2 0 0 0 4 0" />
                </svg>
                <span>Notification sent to {result.notified.join(", ")} — they’ve been challenged to beat your score.</span>
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <HudButton onClick={onReplay}>↻ PLAY AGAIN</HudButton>
            {onClose && <HudButton variant="purple" onClick={onClose}>VIEW SOLUTIONS</HudButton>}
            <HudButton variant="ghost" onClick={onExit}>BACK TO ARCADE</HudButton>
          </div>
        </HudPanel>
      </div>
    </div>
  );
}
