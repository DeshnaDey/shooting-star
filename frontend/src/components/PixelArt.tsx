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
    palette: { X: "#10182e", W: "#f4f8ff", V: "#0b1220", H: "#8fdcff", P: "#6ec9e8", D: "#aab8dd" },
    rows: [
      "    XXXXXX    ",
      "  XXWWWWWWXX  ",
      " XWWWWWWWWWWX ",
      " XWVHVVVVVVWX ",
      "XXWVVVVVVVVWX ",
      " XWVVVVVVVVWX ",
      " XWWVVVVVVWWX ",
      " XWWWWWWWWWWX ",
      "  XXWWWWWWXX  ",
      "  XWWWWWWWWX  ",
      " XWWWWWWWWWWX ",
      " XWWWPPPPWWWX ",
      " XWWWPPPPWWWX ",
      " XWWWWWWWWWWX ",
      " XWWX    XWWX ",
      " XWWX    XWWX ",
      "XWWWX    XWWWX",
      "XDDDX    XDDDX",
    ],
  },
  // just the helmet + visor - used for the profile avatar
  astronautFace: {
    palette: { X: "#10182e", W: "#f4f8ff", V: "#0b1220", H: "#8fdcff" },
    rows: [
      "   XXXXXX   ",
      " XXWWWWWWXX ",
      "XWWWWWWWWWWX",
      "XWVHVVVVVVWX",
      "XWVVVVVVVVWX",
      "XWVVVVVVVVWX",
      "XWWVVVVVVWWX",
      "XWWWWWWWWWWX",
      " XXWWWWWWXX ",
    ],
  },
  // ── Arcade game "hero" icons ──────────────────────────────────────────────
  // Wordle → a bold letter W (like a guess tile)
  letterW: {
    palette: { X: "#f4f8ff" },
    rows: [
      "X...X",
      "X...X",
      "X...X",
      "X...X",
      "X.X.X",
      "X.X.X",
      "XX.XX",
      "X...X",
    ],
  },
  // Spelling Bee → a striped pixel bee with wings
  bee: {
    palette: { K: "#241a08", Y: "#f6d48f", W: "#eaf6ff" },
    rows: [
      "...K...K...",
      "...WW.WW...",
      "..WWKKKWW..",
      ".WWKYYYKWW.",
      "..KYKYKYK..",
      "..YKYKYKY..",
      "..KYKYKYK..",
      "...KYYYK...",
      "....KKK....",
    ],
  },
  // Crossword → a mini black-and-white grid
  crossgrid: {
    palette: { W: "#eef4ff", K: "#0b1220" },
    rows: [
      "WWWKWWWWW",
      "WKWWWKWWW",
      "WWWWWWWKW",
      "KWWKWWWWW",
      "WWWWKWWWK",
      "WWWWWWKWW",
      "WKWWWWWWW",
      "WWWKWWWKW",
      "WWWWWKWWW",
    ],
  },
  // Sprangle (Strands) → a pink word-path snaking through a dot grid
  strandpath: {
    palette: { D: "#7a6aa0", P: "#f7c4dc" },
    rows: [
      "P.D.D.D.D",
      ".P.......",
      "D.P.D.D.D",
      "....P....",
      "D.D.P.D.D",
      "......P..",
      "D.D.D.P.D",
      ".......P.",
      "D.D.D.D.P",
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

// Faint floating sprites scattered behind the arcade content. Invaders come in
// a spread of colours; the other sprites keep their own palettes.
const DECOR: { name: keyof typeof SPRITES; top: string; left: string; px: number; delay: string; color?: string }[] = [
  { name: "invader", top: "14%", left: "6%",  px: 4, delay: "0s",   color: "#8be0b0" },
  { name: "star",    top: "26%", left: "88%", px: 4, delay: "0.6s" },
  { name: "ghost",   top: "62%", left: "4%",  px: 4, delay: "1.1s" },
  { name: "invader", top: "78%", left: "92%", px: 3, delay: "0.3s", color: "#f5b8d0" },
  { name: "star",    top: "84%", left: "48%", px: 3, delay: "1.4s" },
  { name: "coin",    top: "40%", left: "95%", px: 4, delay: "0.9s" },
  // extra invaders in assorted colours, spread around the edges
  { name: "invader", top: "8%",  left: "44%", px: 3, delay: "0.5s", color: "#f6d48f" },
  { name: "invader", top: "34%", left: "16%", px: 4, delay: "1.7s", color: "#6ec9e8" },
  { name: "invader", top: "52%", left: "80%", px: 3, delay: "0.2s", color: "#9d6fc8" },
  { name: "invader", top: "70%", left: "30%", px: 4, delay: "1.0s", color: "#3fd6c0" },
  { name: "invader", top: "20%", left: "70%", px: 3, delay: "2.1s", color: "#f5b8d0" },
  { name: "invader", top: "90%", left: "68%", px: 4, delay: "0.8s", color: "#f6d48f" },
  { name: "invader", top: "46%", left: "40%", px: 3, delay: "1.3s", color: "#6ec9e8" },
  { name: "invader", top: "60%", left: "58%", px: 3, delay: "2.4s", color: "#9d6fc8" },
];

export function PixelDecor() {
  return (
    <div className="pixel-decor" aria-hidden>
      {DECOR.map((d, i) => (
        <span key={i} className="pixel-float" style={{ top: d.top, left: d.left, animationDelay: d.delay }}>
          <PixelSprite name={d.name} px={d.px} color={d.color} />
        </span>
      ))}
    </div>
  );
}

// Small twinkling pixel stars scattered across the arcade background, in
// warm yellow + baby pink. Fixed hand-spread positions so there's no layout
// shift or hydration mismatch between reloads.
const STAR_FIELD = Array.from({ length: 44 }, (_, i) => ({
  top: `${(i * 47 + 11) % 100}%`,
  left: `${(i * 73 + 7) % 100}%`,
  size: 2 + (i % 3),                       // 2–4px pixel squares
  color: i % 2 ? "#f6d48f" : "#f5b8d0",    // yellow / baby pink
  delay: `${((i % 8) * 0.5).toFixed(1)}s`,
}));

export function ArcadeStars() {
  return (
    <div className="arc-stars" aria-hidden>
      {STAR_FIELD.map((s, i) => (
        <span
          key={i}
          className="arc-star"
          style={{
            top: s.top, left: s.left, width: s.size, height: s.size,
            background: s.color, boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
            animationDelay: s.delay,
          }}
        />
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
