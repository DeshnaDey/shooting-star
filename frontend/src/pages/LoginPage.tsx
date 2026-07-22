import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { HudButton, HudPanel, MonoLabel } from "../components/Hud";
import RainbowHaze from "../components/RainbowHaze";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", boxSizing: "border-box",
  fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-bright)",
  background: "rgba(122,75,168,0.08)", border: "1px solid rgba(183,156,251,0.35)",
  outline: "none",
  clipPath: "polygon(8px 0%, 100% 0%, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0% 100%, 0% 8px)",
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") await api.register(name, email, password);
      else await api.login(email, password);
      navigate("/", { replace: true });
    } catch (e) {
      setError((e as Error).message.toUpperCase());
      setBusy(false);
    }
  }

  const canSubmit =
    email.includes("@") && password.length >= (mode === "register" ? 8 : 1) &&
    (mode === "login" || name.trim().length > 0);

  return (
    <div className="page-scroll" style={{ display: "grid", placeItems: "center" }}>
      <div style={{ width: 400, maxWidth: "92vw", position: "relative" }}>
        <RainbowHaze />
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <h1 className="display-title" style={{
            fontSize: 40, fontStyle: "italic",
            textShadow: "0 0 22px var(--glow-pink)",
          }}>
            Shooting Star
          </h1>
          <MonoLabel>LEARNING CONSTELLATION · SIGN {mode === "login" ? "IN" : "UP"}</MonoLabel>
        </div>

        <HudPanel>
          {/* mode tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            {(["login", "register"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(null); }}
                style={{
                  flex: 1, padding: "9px 4px", cursor: "pointer",
                  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em",
                  color: mode === m ? "var(--white-core)" : "var(--text-dim)",
                  background: mode === m ? "rgba(213,139,232,0.18)" : "rgba(122,75,168,0.06)",
                  border: `1px solid ${mode === m ? "var(--pink)" : "rgba(183,156,251,0.25)"}`,
                  clipPath: "polygon(6px 0%, 100% 0%, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0% 100%, 0% 6px)",
                }}>
                {m === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {mode === "register" && (
              <input style={inputStyle} placeholder="Name" value={name}
                onChange={(e) => setName(e.target.value)} disabled={busy} />
            )}
            <input style={inputStyle} placeholder="Email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} disabled={busy} />
            <input style={inputStyle} type="password"
              placeholder={mode === "register" ? "Password (min 8 characters)" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canSubmit && submit()}
              disabled={busy} />
          </div>

          {error && (
            <p style={{
              fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em",
              color: "var(--pink-soft)", margin: "12px 0 0",
            }}>
              ⚠ {error}
            </p>
          )}

          <div style={{ marginTop: 18 }}>
            <HudButton onClick={submit} disabled={busy || !canSubmit} style={{ width: "100%" }}>
              {busy ? "OPENING THE SKY…" : mode === "login" ? "▸ ENTER THE CONSTELLATION" : "▸ IGNITE YOUR SKY"}
            </HudButton>
          </div>
        </HudPanel>

        <p style={{
          textAlign: "center", marginTop: 14,
          fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.14em",
          color: "var(--text-faint)",
        }}>
          YOUR PROGRESS, STARS AND ACHIEVEMENTS ARE SAVED TO YOUR ACCOUNT
        </p>
      </div>
    </div>
  );
}
