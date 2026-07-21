import { CSSProperties, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { pageThemeFor } from "../lib/theme";
import { getLastPointer } from "../lib/pointer";

// Streaks all originate at the click point and radiate outward, fanned around
// the direction of the expansion (click → screen centre), so they reinforce the
// orb's zoom instead of flying off randomly.
const FAN = [
  { off: -40, d: "0.04s", dist: "48vmax" },
  { off: -18, d: "0.00s", dist: "58vmax" },
  { off: 0, d: "0.02s", dist: "62vmax" },
  { off: 20, d: "0.06s", dist: "54vmax" },
  { off: 42, d: "0.09s", dist: "46vmax" },
];

// A small orb of light sparks at the click point and zooms outward, expanding
// into the page's background colour (the steady glow lives in SpaceBackdrop).
function NavBloom({ accent, accent2 }: { accent: string; accent2: string }) {
  const p = getLastPointer();
  const cx = typeof window !== "undefined" ? window.innerWidth / 2 : p.x;
  const cy = typeof window !== "undefined" ? window.innerHeight / 2 : p.y;
  // outward direction: from the click toward the centre of the screen
  const base = (Math.atan2(cy - p.y, cx - p.x) * 180) / Math.PI;

  const orbStyle = {
    left: `${p.x}px`,
    top: `${p.y}px`,
    ["--acc" as string]: accent,
    ["--acc2" as string]: accent2,
  } as CSSProperties;

  return (
    <>
      <div className="nav-bloom" style={orbStyle} aria-hidden />
      <div className="nav-stars" aria-hidden>
        {FAN.map((s, i) => (
          <span
            key={i}
            className="shoot"
            style={{
              left: `${p.x}px`,
              top: `${p.y}px`,
              ["--ang" as string]: `${base + s.off}deg`,
              ["--d" as string]: s.d,
              ["--dist" as string]: s.dist,
            } as CSSProperties}
          />
        ))}
      </div>
    </>
  );
}

export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { pathname } = location;
  const theme = pageThemeFor(pathname);
  // arrivals via the constellation star-zoom carry their own whiteout + emerge
  const viaStar = Boolean((location.state as { zoomColor?: string } | null)?.zoomColor);

  return (
    <>
      {!viaStar && <NavBloom key={pathname} accent={theme.accent} accent2={theme.accent2} />}
      <div key={pathname} className="route-enter" style={{ height: "100%" }}>
        {children}
      </div>
    </>
  );
}
