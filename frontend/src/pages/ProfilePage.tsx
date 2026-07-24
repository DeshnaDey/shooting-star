import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { api, ApiProfile, ApiProgress, auth } from "../lib/api";
import { HudButton, HudPanel, MonoLabel } from "../components/Hud";
import { PixelSprite } from "../components/PixelArt";
import NebulaDrift from "../components/NebulaDrift";

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

// The API tracks scores/attempts/topics but not raw cognitive traits, so we
// derive six interpretable axes from the real performance numbers. Deterministic
// (no randomness) so a cadet's hexagon is stable between visits and only shifts
// as their actual stats do.
type BrainAxis = { axis: string; value: number };
function brainMetrics(p: ApiProfile | null): BrainAxis[] {
  const avg = p?.avgScore ?? 0;
  const best = p?.bestScore ?? 0;
  const attempts = p?.totalAttempts ?? 0;
  const topics = p?.topicsExplored ?? 0;
  const clamp = (n: number) => Math.max(6, Math.min(100, Math.round(n)));
  const volume = Math.min(100, attempts * 6);   // experience from practice count
  const breadth = Math.min(100, topics * 14);   // spread across systems
  return [
    { axis: "ACCURACY", value: clamp(avg) },
    { axis: "ARTICULATION", value: clamp(avg * 0.7 + best * 0.3) },
    { axis: "MASTERY", value: clamp(best) },
    { axis: "SPEED", value: clamp(avg * 0.55 + volume * 0.45) },
    { axis: "MEMORY", value: clamp(avg * 0.5 + breadth * 0.5) },
    { axis: "CONSISTENCY", value: clamp(100 - (best - avg) * 1.4 + volume * 0.25) },
  ];
}

function StatBox({ label, value, accent = false, wide = false }: {
  label: string; value: string | number; accent?: boolean; wide?: boolean;
}) {
  return (
    <div className={`stat-box ${accent ? "accent" : ""} ${wide ? "wide" : ""}`}>
      <MonoLabel>{label}</MonoLabel>
      <div className="stat-value" style={{
        fontSize: accent ? 34 : 26, marginTop: 4,
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

  // Avatar: defaults to the pixel astronaut; user can upload their own image,
  // which we persist locally (keyed per-account) so it survives reloads.
  const avatarKey = `ss-avatar-${user?.email ?? "guest"}`;
  const [avatar, setAvatar] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { setAvatar(localStorage.getItem(avatarKey)); } catch { /* ignore */ }
  }, [avatarKey]);

  function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setAvatar(url);
      try { localStorage.setItem(avatarKey, url); } catch { /* ignore */ }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  function resetAvatar() {
    setAvatar(null);
    try { localStorage.removeItem(avatarKey); } catch { /* ignore */ }
  }

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

  const metrics = brainMetrics(profile);
  const cogIndex = Math.round(metrics.reduce((s, m) => s + m.value, 0) / metrics.length);
  const sortedMetrics = [...metrics].sort((a, b) => b.value - a.value);
  const strongest = sortedMetrics[0];
  const weakest = sortedMetrics[sortedMetrics.length - 1];

  return (
    <div className="page-scroll">
      <NebulaDrift />
      <div className="profile-wrap">
        <div className="profile-topline">
          <div className="mono-label">CADET DOSSIER</div>
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

        {/* HERO — identity card beside a bento of headline stats */}
        <div className="profile-hero">
          <HudPanel className="profile-card">
            <div
              className="avatar-area"
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
              title="Click to upload your own photo"
            >
              {avatar
                ? <img className="avatar-photo" src={avatar} alt="Profile" />
                : <PixelSprite name="astronautFace" px={9} />}
              <span className="avatar-edit">✎ CHANGE PHOTO</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} hidden />

            <div style={{ textAlign: "center" }}>
              <h1 className="display-title" style={{ fontSize: 28, fontStyle: "italic", lineHeight: 1.1 }}>
                {user?.name ?? "Cadet"}
              </h1>
              <p className="callsign">CALL SIGN: SHOOTING STAR</p>
              {user?.email && <p className="callsign dim">{user.email}</p>}
            </div>

            {avatar && (
              <button className="avatar-reset" onClick={resetAvatar}>↺ RESET TO ASTRONAUT</button>
            )}
          </HudPanel>

          <div className="stat-bento">
            <StatBox label="KNOWLEDGE POINTS" value={profile?.kp ?? "—"} accent wide />
            <StatBox label="TESTS TAKEN" value={profile?.totalAttempts ?? "—"} />
            <StatBox label="AVG SCORE" value={profile ? `${profile.avgScore}` : "—"} />
            <StatBox label="BEST SCORE" value={profile ? `${profile.bestScore}` : "—"} />
            <StatBox label="SYSTEMS EXPLORED" value={profile?.topicsExplored ?? "—"} />
          </div>
        </div>

        {/* Asymmetric row: compact cognitive radar column + wider progress column */}
        <div className="profile-columns">
        {/* cognitive profile — hexagonal radar of derived brain metrics */}
        <HudPanel className="cognitive-panel">
          <div className="cognitive-head">
            <div>
              <MonoLabel style={{ color: "var(--pink-soft)" }}>COGNITIVE PROFILE</MonoLabel>
              <h2 className="display-title" style={{ fontSize: 24, fontStyle: "italic", marginTop: 2 }}>
                Brain performance
              </h2>
            </div>
            <div className="cog-index">
              <span className="cog-index-num">{cogIndex}</span>
              <span className="cog-index-cap">INDEX</span>
            </div>
          </div>
          <div className="cognitive-grid">
            <div style={{ height: 300 }}>
              <ResponsiveContainer>
                <RadarChart data={metrics} outerRadius="72%">
                  <PolarGrid stroke="rgba(122,75,168,0.3)" />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{ fill: "rgba(163,220,240,0.72)", fontSize: 9, fontFamily: "JetBrains Mono" }}
                  />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    dataKey="value" stroke="#d58be8" strokeWidth={2}
                    fill="#d58be8" fillOpacity={0.28}
                    dot={{ r: 2.5, fill: "#f4fbff", strokeWidth: 0 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(14,30,60,0.95)", border: "1px solid rgba(213,139,232,0.3)",
                      fontFamily: "JetBrains Mono", fontSize: 11, color: "#f4fbff",
                    }}
                    formatter={(v) => [`${v} / 100`, "score"]}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="cognitive-bars">
              {metrics.map((m) => (
                <div key={m.axis} className="cognitive-bar-row">
                  <div className="cognitive-bar-head">
                    <span>{m.axis}</span>
                    <span className="cognitive-bar-val">{m.value}</span>
                  </div>
                  <div className="cognitive-bar-track">
                    <span className="cognitive-bar-fill" style={{ width: `${m.value}%` }} />
                  </div>
                </div>
              ))}
              <p className="cognitive-note">DERIVED FROM YOUR TEST ACCURACY, PEAK SCORES, PRACTICE VOLUME &amp; TOPIC SPREAD</p>
            </div>
          </div>
        </HudPanel>

        {/* Right column: progress chart + a telemetry card filling the gap below */}
        <div className="progress-col">
        {/* progress report */}
        <HudPanel className="progress-panel">
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
                    background: period === p.id ? "rgba(213,139,232,0.18)" : "rgba(122,75,168,0.06)",
                    border: `1px solid ${period === p.id ? "var(--pink)" : "rgba(122,75,168,0.2)"}`,
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
                <CartesianGrid stroke="rgba(122,75,168,0.1)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "rgba(163,220,240,0.55)", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "rgba(163,220,240,0.4)", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ stroke: "rgba(213,139,232,0.3)" }}
                  contentStyle={{
                    background: "rgba(14,30,60,0.95)", border: "1px solid rgba(213,139,232,0.3)",
                    fontFamily: "JetBrains Mono", fontSize: 11, color: "#f4fbff",
                  }}
                  formatter={(v) => [v == null ? "no tests" : String(v), "avg score"]}
                />
                <Line
                  type="monotone" dataKey="score" connectNulls
                  stroke="#6ec9e8" strokeWidth={2}
                  dot={{ r: 3.5, fill: "#6ec9e8", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#f4fbff" }}
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

        {/* telemetry card — fills the space beside the taller radar column */}
        <HudPanel className="telemetry-card" purple>
          <MonoLabel style={{ color: "var(--pink-soft)" }}>FLIGHT TELEMETRY</MonoLabel>
          <div className="tele-index">
            <span className="tele-index-num">{cogIndex}</span>
            <span className="tele-index-cap">COGNITIVE INDEX / 100</span>
          </div>
          <div className="tele-rows">
            <div className="tele-row">
              <span className="tele-row-label">▲ STRONGEST</span>
              <span className="tele-row-val">{strongest.axis} · {strongest.value}</span>
            </div>
            <div className="tele-row">
              <span className="tele-row-label">◆ SHARPEN NEXT</span>
              <span className="tele-row-val">{weakest.axis} · {weakest.value}</span>
            </div>
          </div>
        </HudPanel>
        </div>
        </div>

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
                background: a.unlocked ? "rgba(213,139,232,0.08)" : "rgba(8,20,40,0.5)",
                border: `1px solid ${a.unlocked ? "rgba(213,139,232,0.4)" : "rgba(122,75,168,0.12)"}`,
                clipPath: "polygon(10px 0%, 100% 0%, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0% 100%, 0% 10px)",
                opacity: a.unlocked ? 1 : 0.55,
              }}>
                <div style={{
                  width: 38, height: 38, display: "grid", placeItems: "center", fontSize: 18,
                  color: a.unlocked ? "var(--pink-soft)" : "var(--text-faint)",
                  border: `1px solid ${a.unlocked ? "var(--pink)" : "rgba(122,75,168,0.2)"}`,
                  borderRadius: "50%",
                  boxShadow: a.unlocked ? "0 0 14px rgba(213,139,232,0.35)" : "none",
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
