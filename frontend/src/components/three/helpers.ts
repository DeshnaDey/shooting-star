import * as THREE from "three";

// Radial-gradient glow sprite texture, tinted per star/planet color.
const cache = new Map<string, THREE.Texture>();

export function makeGlowTexture(color: string): THREE.Texture {
  const hit = cache.get(color);
  if (hit) return hit;

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const c = new THREE.Color(color);
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  g.addColorStop(0, `rgba(255,255,255,0.95)`);
  g.addColorStop(0.25, `rgba(${rgb},0.55)`);
  g.addColorStop(0.6, `rgba(${rgb},0.14)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  cache.set(color, tex);
  return tex;
}

// ─── Wispy nebula cloud texture ──────────────────────────────────────────────
// Instead of one smooth radial glow (which reads as a flat blob), we stamp many
// overlapping soft puffs of the tint to build filament-like internal structure,
// then mask the whole thing with a radial falloff so the edges dissolve into
// space. Result looks like a cloud, not a circle.
const nebCache = new Map<string, THREE.Texture>();

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeNebulaTexture(color: string, seed = 1): THREE.Texture {
  const key = `${color}|${seed}`;
  const hit = nebCache.get(key);
  if (hit) return hit;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = new THREE.Color(color);
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  const rnd = mulberry32(seed * 2654435761);

  // stamp overlapping puffs — denser near centre so a bright core forms
  const puffs = 26;
  for (let i = 0; i < puffs; i++) {
    const ang = rnd() * Math.PI * 2;
    const dist = Math.pow(rnd(), 1.7) * size * 0.42; // bias toward centre
    const x = size / 2 + Math.cos(ang) * dist;
    const y = size / 2 + Math.sin(ang) * dist;
    const r = size * (0.06 + rnd() * 0.26);
    const a = 0.10 + rnd() * 0.22;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // a few brighter knots near the core
  for (let i = 0; i < 5; i++) {
    const x = size / 2 + (rnd() - 0.5) * size * 0.28;
    const y = size / 2 + (rnd() - 0.5) * size * 0.28;
    const r = size * (0.02 + rnd() * 0.05);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,0.5)`);
    g.addColorStop(0.5, `rgba(${rgb},0.35)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // radial mask so the cloud dissolves at the edges
  ctx.globalCompositeOperation = "destination-in";
  const mask = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  mask.addColorStop(0, "rgba(255,255,255,1)");
  mask.addColorStop(0.55, "rgba(255,255,255,0.85)");
  mask.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";

  const tex = new THREE.CanvasTexture(canvas);
  nebCache.set(key, tex);
  return tex;
}
