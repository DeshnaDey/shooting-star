import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api, ApiAttempt, ApiQuestion, AnswerPayload } from "../lib/api";
import { HudButton, HudPanel, MonoLabel, useToast } from "../components/Hud";

type Draft = { response?: string; self_correct?: boolean; time_taken_s: number };

function fmt(s: number) {
  const m = Math.floor(s / 60), r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export default function TestPage() {
  const { starId, attemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [attempt, setAttempt] = useState<ApiAttempt | null>(
    (location.state as { attempt?: ApiAttempt } | null)?.attempt ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [flipped, setFlipped] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const qStart = useRef(Date.now());
  const submitted = useRef(false);

  // load attempt if not passed via navigation state
  useEffect(() => {
    if (attempt || !attemptId) return;
    api.getAttempt(Number(attemptId))
      .then(setAttempt)
      .catch((e) => setError(e.message));
  }, [attempt, attemptId]);

  // countdown
  useEffect(() => {
    if (!attempt?.timed) return;
    setRemaining(attempt.time_limit_s);
    const t = setInterval(() => setRemaining((r) => (r === null ? null : r - 1)), 1000);
    return () => clearInterval(t);
  }, [attempt?.id, attempt?.timed, attempt?.time_limit_s]);

  const questions = attempt?.questions ?? [];
  const q: ApiQuestion | undefined = questions[idx];

  const recordDraft = useCallback((qid: number, patch: Partial<Draft>) => {
    setDrafts((d) => {
      const prev = d[qid] ?? { time_taken_s: 0 };
      return { ...d, [qid]: { ...prev, ...patch, time_taken_s: prev.time_taken_s + (patch.time_taken_s ?? 0) } };
    });
  }, []);

  const elapsedNow = () => {
    const s = (Date.now() - qStart.current) / 1000;
    qStart.current = Date.now();
    return s;
  };

  const doSubmit = useCallback(async (finalDrafts: Record<number, Draft>) => {
    if (!attempt || submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    const answers: AnswerPayload[] = Object.entries(finalDrafts).map(([qid, d]) => ({
      question_id: Number(qid),
      response: d.response ?? "",
      self_correct: d.self_correct,
      time_taken_s: Math.round(d.time_taken_s * 10) / 10,
    }));
    try {
      const analysis = await api.submitAttempt(attempt.id, answers);
      navigate(`/system/${starId}/analysis?attempt=${attempt.id}`, { state: { analysis } });
    } catch (e) {
      submitted.current = false;
      setSubmitting(false);
      toast(`SUBMISSION FAILED — ${(e as Error).message.toUpperCase()}`);
    }
  }, [attempt, navigate, starId, toast]);

  // auto-submit on timer expiry
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !submitted.current) {
      toast("TIME EXPIRED — AUTO-SUBMITTING");
      doSubmit(drafts);
    }
  }, [remaining, drafts, doSubmit, toast]);

  const answeredCount = useMemo(
    () => questions.filter((qq) => {
      const d = drafts[qq.id];
      return d && (d.self_correct !== undefined || (d.response ?? "").trim() !== "");
    }).length,
    [drafts, questions]
  );

  function advance(patch: Partial<Draft>) {
    if (!q) return;
    recordDraft(q.id, { ...patch, time_taken_s: elapsedNow() });
    setFlipped(false);
    if (idx < questions.length - 1) setIdx(idx + 1);
  }

  if (error) {
    return (
      <div className="page-scroll" style={{ display: "grid", placeItems: "center" }}>
        <HudPanel>
          <MonoLabel>TEST UNAVAILABLE — {error.toUpperCase()}</MonoLabel>
          <div style={{ height: 12 }} />
          <HudButton onClick={() => navigate(`/system/${starId}`)}>BACK TO SYSTEM</HudButton>
        </HudPanel>
      </div>
    );
  }
  if (!attempt || !q) {
    return (
      <div className="page-scroll" style={{ display: "grid", placeItems: "center" }}>
        <MonoLabel>LOADING MISSION…</MonoLabel>
      </div>
    );
  }

  const draft = drafts[q.id];
  const lowTime = remaining !== null && remaining <= 30;

  return (
    <div className="page-scroll">
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "36px 24px 80px" }}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 }}>
          <div>
            <MonoLabel>MISSION IN PROGRESS · {attempt.mode.replace("_", " ").toUpperCase()}{attempt.timed ? " · TIMED" : ""}</MonoLabel>
            <h1 className="display-title" style={{ fontSize: 32, fontStyle: "italic" }}>
              Question {idx + 1} <span style={{ color: "var(--text-dim)", fontSize: 20 }}>/ {questions.length}</span>
            </h1>
          </div>
          {remaining !== null && (
            <div className="stat-value" style={{
              fontSize: 26,
              color: lowTime ? "#ff6b9d" : undefined,
              textShadow: lowTime ? "0 0 14px rgba(255,80,140,0.8)" : undefined,
            }}>
              {fmt(Math.max(0, remaining))}
            </div>
          )}
        </div>

        <div className="bar-track" style={{ marginBottom: 26 }}>
          <div className="bar-fill" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
        </div>

        {/* question card */}
        <HudPanel style={{ marginBottom: 20 }}>
          <MonoLabel style={{ color: "var(--pink-soft)" }}>{q.subtopic_name.toUpperCase()}</MonoLabel>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: "var(--text-bright)", margin: "10px 0 4px" }}>
            {q.prompt}
          </p>
        </HudPanel>

        {/* ── MCQ ── */}
        {q.qtype === "mcq" && q.choices && (
          <div style={{ display: "grid", gap: 10 }}>
            {q.choices.map((c, i) => {
              const picked = draft?.response === String(i);
              return (
                <button
                  key={i}
                  onClick={() => recordDraft(q.id, { response: String(i) })}
                  style={{
                    textAlign: "left", padding: "13px 18px", cursor: "pointer",
                    fontFamily: "var(--font-body)", fontSize: 14, color: picked ? "var(--white-core)" : "var(--text-main)",
                    background: picked ? "rgba(213,139,232,0.18)" : "rgba(122,75,168,0.06)",
                    border: `1px solid ${picked ? "var(--pink)" : "rgba(122,75,168,0.22)"}`,
                    clipPath: "polygon(10px 0%, 100% 0%, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0% 100%, 0% 10px)",
                    boxShadow: picked ? "0 0 18px rgba(213,139,232,0.25)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--pink-soft)", marginRight: 10 }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {c}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Long answer ── */}
        {q.qtype === "long_answer" && (
          <textarea
            value={draft?.response ?? ""}
            onChange={(e) => recordDraft(q.id, { response: e.target.value })}
            placeholder="Type your answer — explain step by step…"
            rows={8}
            style={{
              width: "100%", resize: "vertical", padding: 16,
              fontFamily: "var(--font-body)", fontSize: 14, lineHeight: 1.6,
              color: "var(--text-bright)", background: "rgba(122,75,168,0.06)",
              border: "1px solid rgba(122,75,168,0.25)", outline: "none",
              clipPath: "polygon(12px 0%, 100% 0%, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0% 100%, 0% 12px)",
            }}
          />
        )}

        {/* ── Flashcard ── */}
        {q.qtype === "flashcard" && (
          <div>
            <div
              onClick={() => setFlipped((f) => !f)}
              style={{
                minHeight: 140, display: "grid", placeItems: "center", cursor: "pointer",
                padding: 24, textAlign: "center",
                background: flipped ? "rgba(122,75,168,0.10)" : "rgba(213,139,232,0.07)",
                border: `1px solid ${flipped ? "var(--purple-soft)" : "var(--pink)"}`,
                clipPath: "polygon(16px 0%, 100% 0%, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0% 100%, 0% 16px)",
              }}
            >
              <div>
                <MonoLabel>{flipped ? "BACK — DID YOU KNOW IT?" : "THINK, THEN CLICK TO FLIP"}</MonoLabel>
                <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--text-bright)", marginTop: 10 }}>
                  {flipped ? q.flashcard_back : "···"}
                </p>
              </div>
            </div>
            {flipped && (
              <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "center" }}>
                <HudButton onClick={() => advance({ self_correct: true })}>✓ GOT IT</HudButton>
                <HudButton variant="purple" onClick={() => advance({ self_correct: false })}>✕ MISSED IT</HudButton>
              </div>
            )}
          </div>
        )}

        {/* nav */}
        <div style={{ display: "flex", gap: 10, marginTop: 26, alignItems: "center" }}>
          <HudButton variant="ghost" disabled={idx === 0}
            onClick={() => { recordDraft(q.id, { time_taken_s: elapsedNow() }); setFlipped(false); setIdx(idx - 1); }}>
            ◄ PREV
          </HudButton>
          {q.qtype !== "flashcard" && idx < questions.length - 1 && (
            <HudButton variant="ghost" onClick={() => advance({})}>NEXT ►</HudButton>
          )}
          <div style={{ flex: 1 }} />
          <MonoLabel>{answeredCount}/{questions.length} ANSWERED</MonoLabel>
          <HudButton
            disabled={submitting}
            onClick={() => {
              recordDraft(q.id, { time_taken_s: elapsedNow() });
              doSubmit({ ...drafts, [q.id]: { ...(drafts[q.id] ?? { time_taken_s: 0 }) } });
            }}
          >
            {submitting ? "ANALYSING…" : "▸ SUBMIT MISSION"}
          </HudButton>
        </div>

        {attempt.llm_provider === "mock" && (
          <p style={{ marginTop: 18, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-faint)", letterSpacing: "0.1em" }}>
            LLM OFFLINE — QUESTIONS FROM DETERMINISTIC BANK. START OLLAMA FOR AI-GENERATED QUESTIONS.
          </p>
        )}
      </div>
    </div>
  );
}
