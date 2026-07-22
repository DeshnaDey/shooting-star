import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Wispy nebula puff texture: many overlapping soft blobs + a radial edge mask,
// so the clouds read as structured wisps rather than flat blurred discs.
const texCache = new Map<string, THREE.Texture>();

export function makeNebulaTexture(color: string): THREE.Texture {
  const hit = texCache.get(color);
  if (hit) return hit;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = new THREE.Color(color);
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;

  let seed = 0;
  for (let i = 0; i < color.length; i++) seed = (seed * 31 + color.charCodeAt(i)) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff);

  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 28; i++) {
    const x = size / 2 + (rnd() - 0.5) * size * 0.72;
    const y = size / 2 + (rnd() - 0.5) * size * 0.6;
    const r = size * (0.07 + rnd() * 0.22);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${0.16 + rnd() * 0.16})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "destination-in";
  const mask = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size / 2);
  mask.addColorStop(0, "rgba(0,0,0,1)");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  texCache.set(color, tex);
  return tex;
}

type Puff = { pos: [number, number, number]; scale: number; color: string; opacity: number; rot: number };

// A broad palette so the field blends many hues (not just blue/purple).
const PALETTE = ["#6ec9e8", "#3fd6c0", "#9d6fc8", "#d58be8", "#f6d48f", "#e05fb0", "#a3dcf0", "#b96fd0"];

// Nebula clouds spread *evenly* across the whole backdrop (a jittered grid),
// each a different colour, so the sky reads like a colourful deep-field
// landscape rather than one diagonal band.
export default function NebulaField() {
  const group = useRef<THREE.Group>(null);
  const puffs = useMemo<Puff[]>(() => {
    const out: Puff[] = [];
    const cols = 6;
    const rows = 4;
    const spanX = 120;
    const spanY = 68;
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let cc = 0; cc < cols; cc++) {
        // even grid position + a deterministic jitter so it never looks tiled
        const jx = Math.sin(n * 12.9898) * 9;
        const jy = Math.cos(n * 4.1414) * 7;
        const x = -spanX / 2 + (cc + 0.5) * (spanX / cols) + jx;
        const y = -spanY / 2 + (r + 0.5) * (spanY / rows) + jy;
        const z = -30 - ((n * 7) % 18);
        const color = PALETTE[(n * 3 + r) % PALETTE.length];
        out.push({
          pos: [x, y, z],
          scale: 22 + ((n * 5) % 16),
          color,
          opacity: 0.08 + ((n % 3) * 0.02),
          rot: (n * 0.7) % Math.PI,
        });
        n++;
      }
    }
    return out;
  }, []);
  const textures = useMemo(() => puffs.map((p) => makeNebulaTexture(p.color)), [puffs]);

  useFrame(({ clock }) => {
    if (group.current) {
      group.current.rotation.z = Math.sin(clock.elapsedTime * 0.01) * 0.04;
      group.current.position.x = Math.sin(clock.elapsedTime * 0.02) * 2;
    }
  });

  return (
    <group ref={group}>
      {puffs.map((p, i) => (
        <sprite key={i} position={p.pos} scale={[p.scale, p.scale, 1]}>
          <spriteMaterial
            map={textures[i]}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            opacity={p.opacity}
            rotation={p.rot}
          />
        </sprite>
      ))}
    </group>
  );
}
