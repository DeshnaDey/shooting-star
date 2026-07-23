// Retro pixel-art sprites (rendered as crisp SVG rects) + small arcade HUD
// pieces to gamify the Knowledge Arcade.

type SpriteDef = { rows: string[]; palette: Record<string, string> };

// ' ' = empty. X = main colour, W = white highlight, o = dark accent.
const SPRITES: Record<string, SpriteDef> = {
  invader: {
    palette: { X: "#8be0b0", o: "#0b1c3b" },
    rows: [
      "  X     X  ",
      "   X   X   ",
      "  XXXXXXX  ",
      " XX XXX XX ",
      "XXXXXXXXXXX",
      "X XXXXXXX X",
      "X X     X X",
      "   XX XX   ",
    ],
  },
  heart: {
    palette: { X: "#e05fb0", W: "#ffd0ea" },
    rows: [
      " XX XX ",
      "XWXXXWX",
      "XXXXXXX",
      "XXXXXXX",
      " XXXXX ",
      "  XXX  ",
      "   X   ",
    ],
  },
  coin: {
    palette: { X: "#f6d48f", W: "#fff6dc", o: "#c98b3a" },
    rows: [
      " XXX ",
      "XWWoX",
      "XWXoX",
      "XoooX",
      " XXX ",
    ],
  },
  star: {
    palette: { X: "#a3dcf0", W: "#ffffff" },
    rows: [
      "  W  ",
      "  X  ",
      "WXXXW",
      "  X  ",
      "  W  ",
    ],
  },
  ghost: {
    palette: { X: "#9d6fc8", W: "#ffffff", o: "#0b1c3b" },
    rows: [
      " XXXXX ",
      "XXXXXXX",
      "XWWXWWX",
      "XoWXoWX",
      "XXXXXXX",
      "XXXXXXX",
      "X X X X",
    ],
  },
  // excited astronaut, arms up ("yay, let's play!")
  astronaut: {
    palette: { X: "#0a1428", W: "#eef4ff", V: "#0b1c3b", H: "#6ec9e8", P: "#e05fb0" },
    rows: [
      "  XXXXXXX  ",
      " XWWWWWWWX ",
      " XWVVVVVWX ",
      " XWVHHVVWX ",
      " XWVVVVVWX ",
      " XWWWWWWWX ",
      "XX XWWWX XX",
      "XWX XWX XWX",
      "XWXXWWWXXWX",
      "XWWWWPWWWWX",
      " XWWWWWWWX ",
      " XWWXXXWWX ",
      "  XWX XWX  ",
      "  XWX XWX  ",
      "  XXX XXX  ",
    ],
  },
};

export function PixelSprite({
  name, px = 4, color, className = "", style,
}: {
  name: keyof typeof SPRITES;
  px?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const def = SPRITES[name];
  const w = def.rows[0].length;
  const h = def.rows.length;
  const palette = { ...def.palette, ...(color ? { X: color } : {}) };
  const rects: JSX.Element[] = [];
  def.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const fill = palette[ch as keyof typeof palette];
      if (ch !== " " && fill) {
        rects.push(<rect key={`${x}-${y}`} x={x * px} y={y * px} width={px} height={px} fill={fill} />);
      }
    });
  });
  return (
    <svg
      className={className}
      style={style}
      width={w * px}
      height={h * px}
      viewBox={`0 0 ${w * px} ${h * px}`}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {rects}
    </svg>
  );
}

// Lives + coins + level chip, arcade-HUD style.
export function PixelHud({ level = 30, coins = 12, lives = 4 }: { level?: number; coins?: number; lives?: number }) {
  return (
    <div className="pixel-hud" aria-hidden>
      <span className="pixel-chip">LV.{level}</span>
      <span className="pixel-lives">
        {Array.from({ length: lives }).map((_, i) => (
          <PixelSprite key={i} name="heart" px={3} />
        ))}
      </span>
      <span className="pixel-coins">
        <PixelSprite name="coin" px={3} />
        <span>×{coins}</span>
      </span>
    </div>
  );
}

// Faint floating sprites scattered behind the arcade content.
const DECOR: { name: keyof typeof SPRITES; top: string; left: string; px: number; delay: string }[] = [
  { name: "invader", top: "14%", left: "6%", px: 4, delay: "0s" },
  { name: "star", top: "26%", left: "88%", px: 4, delay: "0.6s" },
  { name: "ghost", top: "62%", left: "4%", px: 4, delay: "1.1s" },
  { name: "invader", top: "78%", left: "92%", px: 3, delay: "0.3s" },
  { name: "star", top: "84%", left: "48%", px: 3, delay: "1.4s" },
  { name: "coin", top: "40%", left: "95%", px: 4, delay: "0.9s" },
];

export function PixelDecor() {
  return (
    <div className="pixel-decor" aria-hidden>
      {DECOR.map((d, i) => (
        <span key={i} className="pixel-float" style={{ top: d.top, left: d.left, animationDelay: d.delay }}>
          <PixelSprite name={d.name} px={d.px} />
        </span>
      ))}
    </div>
  );
}

// Hero pixel astronaut in the bottom-right, hyped to play.
export function ArcadeAstronaut() {
  return (
    <div className="arcade-astronaut" aria-hidden>
      <PixelSprite name="astronaut" px={7} />
    </div>
  );
}
