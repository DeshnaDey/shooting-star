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
