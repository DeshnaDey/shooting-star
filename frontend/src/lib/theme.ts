// ─── Per-page space theme ───────────────────────────────────────────────────
// Each route gets an accent colour + a *meaningful* space object ("glyph") that
// zooms in from the background during the page transition. Colours vary but all
// stay inside the navy · purple · lilac · sky · teal · gold galactic palette.

export type GlyphVariant =
  | "constellation" // home star map
  | "planet" // a solar system / topic
  | "portal" // test / assessment
  | "chart" // post-test analysis debrief
  | "crystal" // concept visualiser
  | "arcade" // knowledge arcade
  | "exchange" // tradecenter
  | "badge" // profile / dossier
  | "comet"; // login / entry

export type PageTheme = {
  key: string;
  name: string;
  accent: string; // primary bloom / glyph colour
  accent2: string; // gradient partner
  glow: string; // rgba glow for shadows
  glyph: GlyphVariant;
};

// Ordered most-specific → least-specific. First match wins.
const ROUTES: { test: (p: string) => boolean; theme: PageTheme }[] = [
  {
    test: (p) => /^\/system\/[^/]+\/test\b/.test(p),
    theme: { key: "test", name: "TEST PORTAL", accent: "#e05fb0", accent2: "#7a4ba8", glow: "rgba(224,95,176,0.55)", glyph: "portal" },
  },
  {
    test: (p) => /^\/system\/[^/]+\/analysis\b/.test(p),
    theme: { key: "analysis", name: "MISSION DEBRIEF", accent: "#6ec9e8", accent2: "#7a4ba8", glow: "rgba(110,201,232,0.5)", glyph: "chart" },
  },
  {
    test: (p) => /^\/system\/[^/]+\/concept\b/.test(p),
    theme: { key: "concept", name: "CONCEPT VISUALISER", accent: "#3fd6c0", accent2: "#6ec9e8", glow: "rgba(63,214,192,0.5)", glyph: "crystal" },
  },
  {
    test: (p) => /^\/system\/[^/]+/.test(p),
    theme: { key: "system", name: "SOLAR SYSTEM", accent: "#9d6fc8", accent2: "#d58be8", glow: "rgba(157,111,200,0.55)", glyph: "planet" },
  },
  {
    test: (p) => p.startsWith("/arcade"),
    theme: { key: "arcade", name: "KNOWLEDGE ARCADE", accent: "#f6d48f", accent2: "#e0a94b", glow: "rgba(246,212,143,0.5)", glyph: "arcade" },
  },
  {
    test: (p) => p.startsWith("/trade"),
    theme: { key: "trade", name: "TRADECENTER", accent: "#7ad0a8", accent2: "#6ec9e8", glow: "rgba(122,208,168,0.5)", glyph: "exchange" },
  },
  {
    test: (p) => p.startsWith("/profile"),
    theme: { key: "profile", name: "CADET DOSSIER", accent: "#c9a7e6", accent2: "#9d6fc8", glow: "rgba(201,167,230,0.5)", glyph: "badge" },
  },
  {
    test: (p) => p.startsWith("/login"),
    theme: { key: "login", name: "ENTER THE SKY", accent: "#c9a7e6", accent2: "#d58be8", glow: "rgba(201,167,230,0.5)", glyph: "comet" },
  },
];

const HOME: PageTheme = {
  key: "constellation", name: "CONSTELLATION",
  // landing leans purple + gold, kept soft and space-toned
  accent: "#9d6fc8", accent2: "#f6d48f", glow: "rgba(157,111,200,0.5)", glyph: "constellation",
};

export function pageThemeFor(pathname: string): PageTheme {
  if (pathname === "/") return HOME;
  return ROUTES.find((r) => r.test(pathname))?.theme ?? HOME;
}
