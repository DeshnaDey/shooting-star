import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

// Per-route accent hue. The click-orb expands into this colour and the page-hue
// layer holds it as the steady background tint (over the nebula/haze) — so each
// space stays coloured while the stars keep showing through.
// Per-page background colour — drawn from the palette (navy · purple · lilac ·
// sky · gold). Each of the three main pages gets its own palette hue.
function routeHue(path: string): string {
  if (path.startsWith("/trade")) return "#6ec9e8";      // sky blue
  if (path.startsWith("/profile")) return "#f6d48f";     // gold
  if (path.includes("/arcade")) return "#d58be8";        // lilac
  if (path.includes("/concept")) return "#3fd6c0";       // teal
  if (path.includes("/test")) return "#e05fb0";          // magenta
  if (path.includes("/analysis")) return "#6ec9e8";      // blue
  if (path === "/login") return "#b96fd0";               // lilac
  return "#9d6fc8";                                        // constellation default
}

type Burst = { id: number; x: number; y: number };

const fx = (o: Record<string, string | number>) => o as React.CSSProperties;

export default function SpaceFX() {
  const { pathname } = useLocation();
  const hue = routeHue(pathname);
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const id = Date.now() + Math.random();
      setBursts((prev) => [...prev, { id, x: e.clientX, y: e.clientY }]);
      window.setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 1100);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  return (
    <>
      <div className="space-backdrop" aria-hidden />
      {/* the persistent route-colour background the orb grows into */}
      <div className="page-hue" aria-hidden style={fx({ "--hue": hue })} />
      <div className="fx-layer" aria-hidden>
        {bursts.map((b) => (
          <div key={b.id}>
            {/* orb takes the *live* hue, so a nav-click grows into the
                destination page's colour and merges with its background */}
            <div className="click-orb" style={fx({ left: b.x, top: b.y, "--hue": hue })} />
            {Array.from({ length: 6 }).map((_, i) => {
              const ang = (i / 6) * Math.PI * 2;
              return (
                <div
                  key={i}
                  className="shooting-star"
                  style={fx({
                    left: b.x,
                    top: b.y,
                    "--hue": hue,
                    "--dx": `${Math.cos(ang) * 300}px`,
                    "--dy": `${Math.sin(ang) * 300}px`,
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
