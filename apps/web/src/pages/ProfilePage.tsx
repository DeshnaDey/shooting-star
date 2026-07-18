import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { api, ApiProfile, ApiProgress, auth } from "../lib/api";
import { HudButton, HudPanel, MonoLabel } from "../components/Hud";

type Period = "weekly" | "monthly" | "annual";
const PERIODS: { id: Period; label: string }[] = [
  { id: "weekly", label: "WEEKLY" },
  { id: "monthly", label: "MONTHLY" },
  { id: "annual", label: "ANNUAL" },
];

const BADGE_GLYPHS: Record<string, string> = {
  "first-light": "✦",
  cartographer: "🜁",
  sharpshooter: "◎",
  ascension: "▲",
  voyager: "☄",
  supernova: "✺",
};

function Stat({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div>
      <MonoLabel>{label}</MonoLabel>
      <div className="stat-value" style={{
        fontSize: 26, marginTop: 4,
        color: accent ? "var(--pink-soft)" : "var(--purple-pale)",
        textShadow: accent ? undefined : "none",
      }}>
        {value}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = auth.user();
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [progress, setProgress] = useState<ApiProgress | null>(null);
  const [period, setPeriod] = useState<Period>("weekly");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    api.profile().then(setProfile).catch(() => setOffline(true));
  }, []);

  useEffect(() => {
    api.progress(period).then(setProgress).catch(() => setOffline(true));
  }, [period]);

  const chartData = (progress?.points ?? []).map((p) => ({
    label: p.label,
    score: p.avgScore,
    attempts: p.attempts,
  }));

  return (
    <div className="page-scroll">
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 28px 80px 170px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="mono-label">CADET DOSSIER</div>
            <h1 className="display-title" style={{ fontSize: 42, fontStyle: "italic", marginBottom: 6 }}>
              {user?.name ?? "Cadet"}
            </h1>
            <p style={{ fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", color: "var(--text-dim)", marginBottom: 24 }}>
              CALL SIGN: SHOOTING STAR{user?.email ? ` · ${user.email}` : ""}
            </p>
          </div>
          <HudButton variant="ghost" onClick={() => { auth.clear(); navigate("/login", { replace: true }); }}>
            ◄ SIGN OUT
          </HudButton>
        </div>

        {offline && (
          <p style={{
            fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em",
            color: "var(--pink-soft)", marginBottom: 18,
          }}>
            ⚠ API OFFLINE — STATS UNAVAILABLE
          </p>
        )}

        {/* stats row */}
        <HudPanel style={{ marginBottom: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
            <Stat label="KNOWLEDGE POINTS" value={profile?.kp ?? "—"} accent />
            <Stat label="TESTS TAKEN" value={profile?.totalAttempts ?? "—"} />
            <Stat label="AVG SCORE" value={profile ? `${profile.avgScore}` : "—"} />
            <Stat label="BEST SCORE" value={profile ? `${profile.bestScore}` : "—"} />
            <Stat label="SYSTEMS EXPLORED" value={profile?.topicsExplored ?? "—"} />
          </div>
        </HudPanel>

        {/* progress report */}
        <HudPanel style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <MonoLabel style={{ color: "var(--pink-soft)" }}>PROGRESS REPORT</MonoLabel>
              <h2 className="display-title" style={{ fontSize: 24, fontStyle: "italic", marginTop: 2 }}>
                Average test score over time
              </h2>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {PERIODS.map((p) => (
                <button key={p.id} onClick={() => setPeriod(p.id)}
                  style={{
                    padding: "7px 14px", cursor: "pointer",
                    fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.14em",
                    color: period === p.id ? "var(--white-core)" : "var(--text-dim)",
                    background: period === p.id ? "rgba(240,122,200,0.18)" : "rgba(139,92,246,0.06)",
                    border: `1px solid ${period === p.id ? "var(--pink)" : "rgba(167,139,250,0.2)"}`,
                    clipPath: "polygon(6px 0%, 100% 0%, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0% 100%, 0% 6px)",
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {progress && (
            <p style={{
              fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
              color: progress.trend >= 0 ? "rgba(140,220,170,0.85)" : "var(--pink-soft)",
              margin: "10px 0 4px",
            }}>
              {progress.trend > 0 ? `▲ IMPROVING — +${progress.trend} PTS ACROSS THIS PERIOD`
                : progress.trend < 0 ? `▼ SLIPPING — ${progress.trend} PTS ACROSS THIS PERIOD`
                : "— STEADY ACROSS THIS PERIOD"}
            </p>
          )}

          <div style={{ height: 250, marginTop: 10 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="rgba(167,139,250,0.1)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "rgba(196,181,253,0.55)", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "rgba(196,181,253,0.4)", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ stroke: "rgba(240,122,200,0.3)" }}
                  contentStyle={{
                    background: "rgba(24,17,42,0.95)", border: "1px solid rgba(240,122,200,0.3)",
                    fontFamily: "JetBrains Mono", fontSize: 11, color: "#fff4fb",
                  }}
                  formatter={(v) => [v == null ? "no tests" : String(v), "avg score"]}
                />
                <Line
                  type="monotone" dataKey="score" connectNulls
                  stroke="#f07ac8" strokeWidth={2}
                  dot={{ r: 3.5, fill: "#f07ac8", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#fff4fb" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {progress && progress.points.every((p) => p.attempts === 0) && (
            <p style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", color: "var(--text-faint)" }}>
              NO TESTS IN THIS PERIOD — TAKE ONE TO START THE CURVE
            </p>
          )}
        </HudPanel>

        {/* achievements */}
        <HudPanel purple>
          <MonoLabel style={{ color: "var(--pink-soft)" }}>ACHIEVEMENTS</MonoLabel>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: 12, marginTop: 14,
          }}>
            {(profile?.achievements ?? []).map((a) => (
              <div key={a.key} style={{
                display: "flex", gap: 12, alignItems: "center", padding: "12px 14px",
                background: a.unlocked ? "rgba(240,122,200,0.08)" : "rgba(11,8,23,0.5)",
                border: `1px solid ${a.unlocked ? "rgba(240,122,200,0.4)" : "rgba(167,139,250,0.12)"}`,
                clipPath: "polygon(10px 0%, 100% 0%, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0% 100%, 0% 10px)",
                opacity: a.unlocked ? 1 : 0.55,
              }}>
                <div style={{
                  width: 38, height: 38, display: "grid", placeItems: "center", fontSize: 18,
                  color: a.unlocked ? "var(--pink-soft)" : "var(--text-faint)",
                  border: `1px solid ${a.unlocked ? "var(--pink)" : "rgba(167,139,250,0.2)"}`,
                  borderRadius: "50%",
                  boxShadow: a.unlocked ? "0 0 14px rgba(240,122,200,0.35)" : "none",
                  flexShrink: 0,
                }}>
                  {BADGE_GLYPHS[a.key] ?? "✦"}
                </div>
                <div>
                  <p style={{
                    fontFamily: "var(--font-display)", fontSize: 16,
                    color: a.unlocked ? "var(--text-bright)" : "var(--text-dim)",
                  }}>
                    {a.name}
                  </p>
                  <p style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{a.desc}</p>
                </div>
              </div>
            ))}
            {!profile && (
              <MonoLabel style={{ color: "var(--text-faint)" }}>
                {offline ? "UNAVAILABLE OFFLINE" : "LOADING…"}
              </MonoLabel>
            )}
          </div>
        </HudPanel>
      </div>
    </div>
  );
}
