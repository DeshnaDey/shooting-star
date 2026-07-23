// A slowly-rotating rainbow spiral galaxy in the page background
// (arcade, tradecenter, profile).

// log-spiral arm as an SVG polyline path, rotated by `rot` radians
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

export default function NebulaDrift() {
  return (
    <div className="nebula-drift" aria-hidden>
      <svg className="neb-galaxy" viewBox="0 0 400 400">
        <defs>
          <linearGradient id="neb-arm" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e05fb0" />
            <stop offset="28%" stopColor="#f6d48f" />
            <stop offset="52%" stopColor="#3fd6c0" />
            <stop offset="76%" stopColor="#6ec9e8" />
            <stop offset="100%" stopColor="#9d6fc8" />
          </linearGradient>
          <radialGradient id="neb-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#f6d48f" />
            <stop offset="100%" stopColor="rgba(224,95,176,0)" />
          </radialGradient>
          <filter id="neb-blur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>
        <g className="neb-spin" filter="url(#neb-blur)">
          <path d={armPath(0)} stroke="url(#neb-arm)" strokeWidth="26" fill="none" strokeLinecap="round" opacity="0.5" />
          <path d={armPath(Math.PI)} stroke="url(#neb-arm)" strokeWidth="26" fill="none" strokeLinecap="round" opacity="0.42" />
          <path d={armPath(Math.PI * 0.66)} stroke="url(#neb-arm)" strokeWidth="16" fill="none" strokeLinecap="round" opacity="0.3" />
          <circle cx="200" cy="200" r="46" fill="url(#neb-core)" />
        </g>
      </svg>
    </div>
  );
}
