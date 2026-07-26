// Rainbow "nebula" background. Three looks:
//   - "horizontal" (default): a wide band that drifts sideways (profile)
//   - "spiral": a slowly-rotating spiral galaxy, gold-cored (arcade)
//   - "vortex": same rotating-galaxy technique, blue-cored instead (tradecenter) -
//     same visual family as "spiral" so pages feel related, distinct colour
//     story so Tradecenter doesn't look like a copy of Arcade

function armPath(rot: number): string {
  const pts: string[] = [];
  const N = 62;
  for (let t = 0; t <= N; t++) {
    const th = t * 0.23 + rot;
    const r = Math.min(190, 6 * Math.exp(0.246 * (t * 0.23)));
    const x = 200 + Math.cos(th) * r;
    const y = 200 + Math.sin(th) * r;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}

export default function NebulaDrift({ variant = "horizontal" }: { variant?: "horizontal" | "spiral" | "vortex" }) {
  if (variant === "spiral" || variant === "vortex") {
    const isVortex = variant === "vortex";
    const gradId = isVortex ? "neb-arm-v" : "neb-arm";
    const coreId = isVortex ? "neb-core-v" : "neb-core";
    return (
      <div className={`nebula-drift spiral ${isVortex ? "vortex" : ""}`} aria-hidden>
        <svg className="neb-galaxy" viewBox="0 0 400 400">
          <defs>
            {isVortex ? (
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6ec9e8" />
                <stop offset="35%" stopColor="#a3dcf0" />
                <stop offset="60%" stopColor="#9d6fc8" />
                <stop offset="82%" stopColor="#7a4ba8" />
                <stop offset="100%" stopColor="#d58be8" />
              </linearGradient>
            ) : (
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e05fb0" />
                <stop offset="28%" stopColor="#f6d48f" />
                <stop offset="52%" stopColor="#3fd6c0" />
                <stop offset="76%" stopColor="#6ec9e8" />
                <stop offset="100%" stopColor="#9d6fc8" />
              </linearGradient>
            )}
            {isVortex ? (
              <radialGradient id={coreId} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="40%" stopColor="#6ec9e8" />
                <stop offset="100%" stopColor="rgba(110,201,232,0)" />
              </radialGradient>
            ) : (
              <radialGradient id={coreId} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="40%" stopColor="#f6d48f" />
                <stop offset="100%" stopColor="rgba(224,95,176,0)" />
              </radialGradient>
            )}
            <filter id="neb-blur" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
          </defs>
          <g className="neb-spin" filter="url(#neb-blur)">
            <path d={armPath(0)} stroke={`url(#${gradId})`} strokeWidth="26" fill="none" strokeLinecap="round" opacity="0.5" />
            <path d={armPath(Math.PI)} stroke={`url(#${gradId})`} strokeWidth="26" fill="none" strokeLinecap="round" opacity="0.42" />
            <path d={armPath(Math.PI * 0.66)} stroke={`url(#${gradId})`} strokeWidth="16" fill="none" strokeLinecap="round" opacity="0.3" />
            <circle cx="200" cy="200" r="46" fill={`url(#${coreId})`} />
          </g>
        </svg>
      </div>
    );
  }
  return <div className="nebula-drift horizontal" aria-hidden />;
}
