import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

// Per-route accent hue. The click-orb expands into this colour and the page-hue
// layer holds it as the steady background tint (over the nebula/haze) — so each
// space stays coloured while the stars keep showing through.
function routeHue(path: string): string {
  if (path.startsWith("/trade")) return "#6ec9e8";      // blue
  if (path.startsWith("/profile")) return "#f6d48f";     // gold
  if (path.includes("/arcade")) return "#9d6fc8";        // purple
  if (path.includes("/concept")) return "#3fd6c0";       // teal
  if (path.includes("/test")) return "#e05fb0";          // magenta
  if (path.includes("/analysis")) return "#6ec9e8";      // blue
  if (path === "/login") return "#b96fd0";               // lilac
  return "#9d6fc8";                                        // constellation default
}

type Burst = { id: number; x: number; y: number; hue: string };

const fx = (o: Record<string, string | number>) => o as React.CSSProperties;

export default function SpaceFX() {
  const { pathname } = useLocation();
  const hue = routeHue(pathname);
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const id = Date.now() + Math.random();
      setBursts((prev) => [...prev, { id, x: e.clientX, y: e.clientY, hue }]);
      window.setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 1100);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [hue]);

  return (
    <>
      <div className="space-backdrop" aria-hidden />
      <div className="page-hue" aria-hidden style={fx({ backgroundColor: hue })} />
      <div className="fx-layer" aria-hidden>
        {bursts.map((b) => (
          <div key={b.id}>
            <div className="click-orb" style={fx({ left: b.x, top: b.y, "--hue": b.hue })} />
            {Array.from({ length: 5 }).map((_, i) => {
              const spread = (b.x / Math.max(1, window.innerWidth)) * 1.4;
              const ang = (i / 5) * Math.PI * 2 + spread;
              return (
                <div
                  key={i}
                  className="shooting-star"
                  style={fx({
                    left: b.x,
                    top: b.y,
                    "--hue": b.hue,
                    "--dx": `${Math.cos(ang) * 280}px`,
                    "--dy": `${Math.sin(ang) * 280}px`,
                  })}
                />
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
