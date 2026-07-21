import { CSSProperties } from "react";

// ─── Constellation → System: the clicked star flies to centre and blooms ─────
// Rendered on the constellation page after a star click. The orb starts at the
// star's on-screen position in that star's colour, rushes to centre while
// scaling up into a whiteout, then calls onDone to navigate.
export function StarZoom({
  x, y, color, onDone,
}: { x: number; y: number; color: string; onDone: () => void }) {
  const dx = Math.round(x - window.innerWidth / 2);
  const dy = Math.round(y - window.innerHeight / 2);
  const style = {
    "--dx": `${dx}px`,
    "--dy": `${dy}px`,
    "--star": color,
  } as CSSProperties;

  return (
    <div className="star-zoom-root" aria-hidden>
      <div className="star-zoom-orb" style={style} onAnimationEnd={onDone} />
      <div className="star-zoom-flash" style={{ ["--star" as string]: color } as CSSProperties} />
    </div>
  );
}

// ─── System emerge: the scene resolves out of the star's colour ──────────────
// Rendered briefly on the solar-system page when arriving via a star zoom, in
// the same colour the star had, so the transition reads as continuous.
export function EmergeFlash({ color }: { color: string }) {
  return (
    <div
      className="emerge-flash"
      aria-hidden
      style={{ ["--star" as string]: color } as CSSProperties}
    />
  );
}
