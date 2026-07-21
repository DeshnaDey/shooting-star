import { GlyphVariant } from "../lib/theme";

// A meaningful, animated space object per page. Rendered as the object that
// zooms in from the background during a route transition, and reusable as a
// page hero. Colour comes from the page theme so each sector reads distinctly.

export default function SpaceObject({
  variant,
  accent,
  accent2,
  size = 220,
  spin = true,
}: {
  variant: GlyphVariant;
  accent: string;
  accent2: string;
  size?: number;
  spin?: boolean;
}) {
  const gid = `so-${variant}-${accent.replace("#", "")}`;
  const common = { width: size, height: size, viewBox: "0 0 200 200", fill: "none" as const };

  const defs = (
    <defs>
      <radialGradient id={`${gid}-core`} cx="50%" cy="42%" r="65%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="35%" stopColor={accent} />
        <stop offset="100%" stopColor={accent2} />
      </radialGradient>
      <linearGradient id={`${gid}-lin`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={accent} />
        <stop offset="100%" stopColor={accent2} />
      </linearGradient>
      <filter id={`${gid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3.2" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );

  const glowStyle = { filter: `drop-shadow(0 0 18px ${accent}88)` } as const;

  if (variant === "planet") {
    return (
      <svg {...common} style={glowStyle}>
        {defs}
        <g className="so-spin-slow" style={{ transformOrigin: "100px 100px" }}>
          <ellipse cx="100" cy="100" rx="86" ry="26" stroke={accent} strokeWidth="1.4" opacity="0.35" />
        </g>
        <circle cx="100" cy="100" r="42" fill={`url(#${gid}-core)`} />
        <g className="so-spin" style={{ transformOrigin: "100px 100px" }}>
          <ellipse cx="100" cy="100" rx="70" ry="21" stroke={accent2} strokeWidth="3" opacity="0.85" />
          <circle className="so-pulse" cx="170" cy="100" r="4.5" fill="#fff" />
        </g>
        <circle cx="86" cy="86" r="10" fill="#ffffff" opacity="0.25" />
      </svg>
    );
  }

  if (variant === "constellation") {
    const stars: [number, number, number][] = [
      [40, 60, 4], [80, 40, 5.5], [120, 70, 4.5], [150, 50, 5], [95, 110, 6], [60, 140, 4], [135, 135, 5],
    ];
    return (
      <svg {...common} style={glowStyle}>
        {defs}
        <path d="M40 60 L80 40 L120 70 L150 50 M120 70 L95 110 L60 140 M95 110 L135 135"
          stroke={accent} strokeWidth="1.2" opacity="0.5" />
        {stars.map(([x, y, r], i) => (
          <circle key={i} className="so-twinkle" style={{ animationDelay: `${i * 0.3}s` }}
            cx={x} cy={y} r={r} fill={`url(#${gid}-core)`} />
        ))}
      </svg>
    );
  }

  if (variant === "portal") {
    return (
      <svg {...common} style={glowStyle}>
        {defs}
        <g className="so-spin" style={{ transformOrigin: "100px 100px" }}>
          <circle cx="100" cy="100" r="78" stroke={accent} strokeWidth="2" strokeDasharray="10 14" opacity="0.7" />
        </g>
        <g className="so-spin-rev" style={{ transformOrigin: "100px 100px" }}>
          <circle cx="100" cy="100" r="58" stroke={accent2} strokeWidth="2.4" strokeDasharray="4 12" opacity="0.8" />
        </g>
        <circle className="so-pulse" cx="100" cy="100" r="34" fill={`url(#${gid}-core)`} />
        <circle cx="100" cy="100" r="46" stroke="#fff" strokeWidth="1" opacity="0.3" />
      </svg>
    );
  }

  if (variant === "chart") {
    const bars = [30, 62, 44, 80, 55];
    return (
      <svg {...common} style={glowStyle}>
        {defs}
        <g className="so-spin-slow" style={{ transformOrigin: "100px 100px" }}>
          <circle cx="100" cy="100" r="82" stroke={accent} strokeWidth="1.2" opacity="0.3" strokeDasharray="3 9" />
        </g>
        <circle cx="100" cy="100" r="66" fill={`url(#${gid}-core)`} opacity="0.16" />
        {bars.map((h, i) => (
          <rect key={i} x={58 + i * 18} y={130 - h} width="11" height={h} rx="3"
            fill={`url(#${gid}-lin)`} className="so-rise" style={{ transformOrigin: `${63 + i * 18}px 130px`, animationDelay: `${i * 0.12}s` }} />
        ))}
        <circle className="so-pulse" cx="150" cy="52" r="7" fill="#fff" />
      </svg>
    );
  }

  if (variant === "crystal") {
    return (
      <svg {...common} style={glowStyle}>
        {defs}
        <g className="so-float" style={{ transformOrigin: "100px 100px" }}>
          <polygon points="100,26 148,80 100,174 52,80" fill={`url(#${gid}-core)`} opacity="0.92" />
          <polygon points="100,26 148,80 100,90 52,80" fill="#ffffff" opacity="0.28" />
          <line x1="100" y1="26" x2="100" y2="174" stroke="#fff" strokeWidth="1" opacity="0.4" />
          <line x1="52" y1="80" x2="148" y2="80" stroke="#fff" strokeWidth="1" opacity="0.4" />
          <line x1="52" y1="80" x2="100" y2="174" stroke={accent2} strokeWidth="1" opacity="0.5" />
          <line x1="148" y1="80" x2="100" y2="174" stroke={accent2} strokeWidth="1" opacity="0.5" />
        </g>
      </svg>
    );
  }

  if (variant === "arcade") {
    return (
      <svg {...common} style={glowStyle}>
        {defs}
        <g className="so-spin" style={{ transformOrigin: "100px 100px" }}>
          <circle cx="100" cy="100" r="76" stroke={accent} strokeWidth="1.2" opacity="0.35" />
          <circle cx="176" cy="100" r="8" fill={`url(#${gid}-core)`} />
          <circle cx="24" cy="100" r="6" fill={accent2} />
        </g>
        <rect x="66" y="66" width="68" height="68" rx="14" fill={`url(#${gid}-lin)`}
          className="so-float" style={{ transformOrigin: "100px 100px" }} />
        <circle cx="86" cy="86" r="6" fill="#fff" />
        <circle cx="114" cy="114" r="6" fill="#fff" />
        <circle cx="114" cy="86" r="6" fill="#fff" opacity="0.6" />
        <circle cx="86" cy="114" r="6" fill="#fff" opacity="0.6" />
      </svg>
    );
  }

  if (variant === "exchange") {
    return (
      <svg {...common} style={glowStyle}>
        {defs}
        <circle cx="100" cy="100" r="70" fill={`url(#${gid}-core)`} opacity="0.14" />
        <g className="so-spin-slow" style={{ transformOrigin: "100px 100px" }}>
          <path d="M52 84 H140 M124 66 L142 84 L124 102" stroke={accent} strokeWidth="4"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M148 116 H60 M76 98 L58 116 L76 134" stroke={accent2} strokeWidth="4"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
        <circle className="so-pulse" cx="100" cy="100" r="6" fill="#fff" />
      </svg>
    );
  }

  if (variant === "badge") {
    return (
      <svg {...common} style={glowStyle}>
        {defs}
        <g className="so-float" style={{ transformOrigin: "100px 100px" }}>
          <polygon points="100,28 158,62 158,130 100,168 42,130 42,62"
            fill={`url(#${gid}-core)`} stroke="#fff" strokeWidth="1" opacity="0.95" />
          <polygon points="100,64 111,90 139,92 117,110 124,138 100,122 76,138 83,110 61,92 89,90"
            fill="#ffffff" opacity="0.9" />
        </g>
      </svg>
    );
  }

  // comet (login / entry)
  return (
    <svg {...common} style={glowStyle}>
      {defs}
      <path d="M40 160 Q110 90 168 44" stroke={`url(#${gid}-lin)`} strokeWidth="10"
        strokeLinecap="round" opacity="0.55" />
      <path d="M64 138 Q120 92 160 52" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <circle className="so-pulse" cx="168" cy="44" r="18" fill={`url(#${gid}-core)`} />
    </svg>
  );
}
