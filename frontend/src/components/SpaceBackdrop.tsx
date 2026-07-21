import { CSSProperties, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { pageThemeFor } from "../lib/theme";

// Routes that render their own full-screen 3D scene (opaque canvas) — the 2D
// nebula band / bloom would be hidden behind them, so we keep them minimal there.
export function isSceneRoute(pathname: string): boolean {
  return pathname === "/" || /^\/system\/[^/]+$/.test(pathname);
}

// deterministic starfield as a single box-shadow string
function starShadow(n: number, seed: number, spread: number, maxSize: number) {
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = Math.round(rnd() * spread);
    const y = Math.round(rnd() * spread);
    const sz = (0.5 + rnd() * maxSize).toFixed(1);
    const a = (0.35 + rnd() * 0.6).toFixed(2);
    parts.push(`${x}px ${y}px 0 ${sz}px rgba(244,251,255,${a})`);
  }
  return parts.join(", ");
}

export default function SpaceBackdrop() {
  const { pathname } = useLocation();
  const theme = pageThemeFor(pathname);
  const scene = isSceneRoute(pathname);

  const starsA = useMemo(() => starShadow(90, 7, 2000, 1.1), []);
  const starsB = useMemo(() => starShadow(50, 99, 2000, 1.8), []);

  return (
    <div className="space-backdrop" aria-hidden>
      {/* base galactic gradient */}
      <div className="sb-base" />

      {/* evenly-spread multi-colour nebula band (2D pages) */}
      {!scene && <div className="sb-nebula" />}

      {/* twinkling starfield */}
      <div className="sb-stars" style={{ boxShadow: starsA }} />
      <div className="sb-stars sb-stars-2" style={{ boxShadow: starsB }} />

      {/* accent colour bloom — replays + shifts hue on every route change */}
      <div
        key={theme.key}
        className={`sb-bloom ${scene ? "sb-bloom-scene" : ""}`}
        style={{ ["--acc" as string]: theme.accent, ["--acc2" as string]: theme.accent2 } as CSSProperties}
      />
    </div>
  );
}
