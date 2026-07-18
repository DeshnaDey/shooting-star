import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { api, ApiAnalysis, ApiTopic } from "../lib/api";
import ConceptPlayer from "../components/ConceptPlayer";
import { HudButton, HudPanel, MonoLabel } from "../components/Hud";

// ─── Score dial ──────────────────────────────────────────────────────────────
function ScoreDial({ score }: { score: number }) {
  const R = 52, C = 2 * Math.PI * R;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(167,139,250,0.15)" strokeWidth="8" />
      <circle
        cx="70" cy="70" r={R} fill="none"
        stroke="url(#scoreGrad)" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${(score / 100) * C} ${C}`}
        transform="rotate(-90 70 70)"
        style={{ filter: "drop-shadow(0 0 6px rgba(240,122,200,0.6))" }}
      />
      <defs>
        <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#f07ac8" />
        </linearGradient>
      </defs>
      <text x="70" y="66" textAnchor="middle" fill="var(--white-core)"
        style={{ font: "300 30px var(--font-mono)" }}>{score}</text>
      <text x="70" y="86" textAnchor="middle" fill="var(--text-dim)"
        style={{ font: "400 9px var(--font-mono)", letterSpacing: "0.2em" }}>SCORE</text>
    </svg>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function VisualiserPage() {
  const { starId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();

  const [topic, setTopic] = useState<ApiTopic | null>(null);
  const passed = (location.state as { analysis?: ApiAnalysis } | null)?.analysis ?? null;
  const [analysis, setAnalysis] = useState<ApiAnalysis | null>(passed);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!starId) return;
    const attemptParam = search.get("attempt");
    const analysisFetch = passed
      ? Promise.resolve(passed)
      : attemptParam
        ? api.getAnalysis(Number(attemptParam))
        : api.latestAnalysis(starId);

    Promise.all([api.topics(), analysisFetch.catch((e) => e as Error)])
      .then(([topics, a]) => {
        setTopic(topics.find((t) => t.id === starId) ?? null);
        if (a instanceof Error) {
          setNote((a as { status?: number }).status === 404
            ? "NO TESTS TAKEN YET IN THIS SYSTEM — TAKE ONE FROM THE TEST PORTAL"
            : "COULD NOT RETRIEVE ANALYSIS");
        } else {
          setAnalysis(a);
        }
      })
      .catch(() => setNote("API OFFLINE — START THE BACKEND"))
      .finally(() => setLoading(false));
  }, [passed, starId, search]);

  if (loading) {
    return (
      <div className="page-scroll" style={{ display: "grid", placeItems: "center" }}>
        <MonoLabel>RETRIEVING ANALYSIS…</MonoLabel>
      </div>
    );
  }
  if (!topic || !analysis) {
    return (
      <div className="page-scroll" style={{ display: "grid", placeItems: "center" }}>
        <HudPanel>
          <MonoLabel>{!topic ? "UNKNOWN SYSTEM" : note ?? "NO ANALYSIS AVAILABLE"}</MonoLabel>
          <div style={{ height: 12 }} />
          <div style={{ display: "flex", gap: 10 }}>
            {topic && (
              <HudButton onClick={() => navigate(`/system/${topic.id}`)}>▸ TAKE A TEST</HudButton>
            )}
            <HudButton variant="ghost" onClick={() => navigate("/")}>CONSTELLATION</HudButton>
          </div>
        </HudPanel>
      </div>
    );
  }

  const chartData = analysis.results.map((r) => ({
    name: r.name,
    accuracy: Math.round((r.correct / Math.max(1, r.total)) * 100),
    weak: analysis.weak.some((w) => w.subtopicId === r.subtopicId),
  }));
  const radarData = topic.subtopics.map((s) => {
    const r = analysis.results.find((x) => x.subtopicId === s.id);
    return { subject: s.name, mastery: r ? Math.round((r.correct / Math.max(1, r.total)) * 100) : s.mastery };
  });

  return (
    <div className="page-scroll">
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "36px 28px 80px" }}>
        <button
          onClick={() => navigate(`/system/${topic.id}`)}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em",
            color: "var(--text-dim)", marginBottom: 14,
          }}
        >
          ◄ {topic.name.toUpperCase()} SYSTEM
        </button>
        <div className="mono-label">
          POST-TEST ANALYSIS · {analysis.attemptLabel} · ENGINE: {analysis.provider.toUpperCase()}
        </div>
        <h1 className="display-title" style={{ fontSize: 42, fontStyle: "italic", marginBottom: 8 }}>
          Mission Debrief — {topic.name}
        </h1>
        {note && (
          <p style={{
            fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em",
            color: "var(--pink-soft)", marginBottom: 20,
          }}>
            ⚠ {note}
          </p>
        )}

        {/* summary row */}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 18, margin: "20px 0 22px" }}>
          <HudPanel corners={false} style={{ display: "grid", placeItems: "center" }}>
            <ScoreDial score={analysis.score} />
          </HudPanel>
          <HudPanel corners={false}>
            <MonoLabel>MODE</MonoLabel>
            <div className="stat-value" style={{ fontSize: 18, marginTop: 6 }}>{analysis.mode}</div>
            <div style={{ height: 14 }} />
            <MonoLabel>TIME TAKEN</MonoLabel>
            <div className="stat-value" style={{ fontSize: 18, marginTop: 6 }}>{analysis.timeTaken}</div>
          </HudPanel>
          <HudPanel corners={false}>
            <MonoLabel>WEAK SIGNAL DETECTED</MonoLabel>
            {analysis.weak.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>
                No weak subtopics — clean sweep. Raise the difficulty or try another system.
              </p>
            )}
            {analysis.weak.map((w) => (
              <div key={w.subtopicId} style={{ marginTop: 8 }}>
                <div className="stat-value" style={{ fontSize: 20 }}>{w.name}</div>
                <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{w.wrongAnswerPattern}</p>
              </div>
            ))}
          </HudPanel>
        </div>

        {/* charts */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 18, marginBottom: 22 }}>
          <HudPanel>
            <MonoLabel>ACCURACY BY SUBTOPIC</MonoLabel>
            <div style={{ height: 240, marginTop: 14 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: "rgba(196,181,253,0.55)", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "rgba(196,181,253,0.4)", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(139,92,246,0.08)" }}
                    contentStyle={{
                      background: "rgba(24,17,42,0.95)", border: "1px solid rgba(240,122,200,0.3)",
                      fontFamily: "JetBrains Mono", fontSize: 11, color: "#fff4fb",
                    }}
                  />
                  <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.weak ? "#f07ac8" : "rgba(167,139,250,0.55)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </HudPanel>
          <HudPanel purple>
            <MonoLabel>THIS ATTEMPT — RADAR</MonoLabel>
            <div style={{ height: 240, marginTop: 14 }}>
              <ResponsiveContainer>
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="rgba(167,139,250,0.18)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(196,181,253,0.55)", fontSize: 9, fontFamily: "JetBrains Mono" }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="mastery" stroke="#f07ac8" fill="#f07ac8" fillOpacity={0.28} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </HudPanel>
        </div>

        {/* AI concept visualiser */}
        {analysis.weak.map((w) => (
          <HudPanel key={w.subtopicId} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
              <div>
                <MonoLabel style={{ color: "var(--pink-soft)" }}>AI CONCEPT VISUALISER</MonoLabel>
                <h2 className="display-title" style={{ fontSize: 30, fontStyle: "italic", margin: "4px 0 2px" }}>
                  {w.name}
                </h2>
              </div>
              <MonoLabel style={{ fontSize: 8 }}>
                {analysis.provider === "ollama"
                  ? "GENERATED FROM YOUR WRONG ANSWERS"
                  : "DETERMINISTIC FALLBACK — CONNECT OLLAMA FOR AI GENERATION"}
              </MonoLabel>
            </div>

            <p style={{
              fontSize: 13, lineHeight: 1.65, color: "var(--text-main)",
              borderLeft: "2px solid var(--pink)", paddingLeft: 14, margin: "16px 0 22px",
              maxWidth: 760,
            }}>
              {w.aiDiagnosis}
            </p>

            <ConceptPlayer frames={w.frames} />
          </HudPanel>
        ))}

        {/* answer review */}
        {analysis.answers.length > 0 && (
          <HudPanel purple style={{ marginBottom: 22 }}>
            <MonoLabel>ANSWER LOG</MonoLabel>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {analysis.answers.map((a) => (
                <div key={a.questionId} style={{
                  padding: "10px 14px",
                  background: "rgba(11,8,23,0.55)",
                  borderLeft: `2px solid ${a.correct ? "rgba(140,220,170,0.6)" : "var(--pink)"}`,
                }}>
                  <p style={{ fontSize: 12, color: "var(--text-bright)", marginBottom: 3 }}>{a.prompt}</p>
                  <p style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em",
                      color: a.correct ? "rgba(140,220,170,0.8)" : "var(--pink-soft)",
                    }}>
                      {a.correct ? "✓ CORRECT" : `✕ ${Math.round(a.partialCredit * 100)}% CREDIT`} ·{" "}
                    </span>
                    {a.response ? `“${a.response}”` : "(no answer)"} — {a.feedback}
                  </p>
                </div>
              ))}
            </div>
          </HudPanel>
        )}

        {/* retake CTA */}
        <div style={{ display: "flex", gap: 12 }}>
          <HudButton onClick={() => navigate(`/system/${topic.id}`)}>▸ RETAKE TEST</HudButton>
          <HudButton variant="ghost" onClick={() => navigate("/")}>CONSTELLATION</HudButton>
        </div>
      </div>
    </div>
  );
}
