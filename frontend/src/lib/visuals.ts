// Procedural visual attributes for API-driven topics/subtopics.
// Deterministic per id so layouts are stable across reloads.

// Star hues drawn straight from the palette (purple · lilac · sky · gold),
// with two palette-family bridges so neighbouring topics rarely repeat a colour.
export const STAR_COLORS = ["#7a4ba8", "#d58be8", "#6ec9e8", "#f6d48f", "#9d6fc8", "#a3dcf0"];
const PLANET_COLORS = ["#6ec9e8", "#d58be8", "#f6d48f", "#9d6fc8", "#a3dcf0", "#c9a7e6"];

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function starColor(id: string): string {
  return STAR_COLORS[hashStr(id) % STAR_COLORS.length];
}

/** Golden-angle spiral, slightly flattened — index n gives the nth star position. */
export function starPosition(n: number): [number, number, number] {
  if (n === 0) return [0, 0.4, 0];
  const ga = 2.39996323;
  const r = 3.4 + n * 1.05;
  const a = n * ga;
  return [
    Math.cos(a) * r * 0.95,
    Math.sin(a * 1.618) * 2.1,
    Math.sin(a) * r * 0.5 - 0.8,
  ];
}

export type PlanetVisual = { color: string; size: number; orbit: number; speed: number };

export function planetVisual(subtopicId: string, index: number): PlanetVisual {
  const h = hashStr(subtopicId);
  return {
    color: PLANET_COLORS[h % PLANET_COLORS.length],
    size: 0.3 + ((h >> 3) % 5) * 0.045,
    orbit: 3.2 + index * 1.3,
    speed: 0.42 * Math.pow(0.82, index),
  };
}
