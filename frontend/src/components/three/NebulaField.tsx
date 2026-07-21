import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { makeNebulaTexture } from "./helpers";

// Multi-colour nebula band, evenly spread across a wide tilted swathe like the
// Milky Way reference — denser/brighter toward the core, softer at the edges.
// Deterministic layout so it is stable across reloads.

const HUES = [
  "#7a4ba8", // deep violet
  "#e05fb0", // magenta bloom
  "#d58be8", // lilac
  "#9d6fc8", // soft purple
  "#6ec9e8", // sky blue
  "#3fd6c0", // teal
  "#a3dcf0", // pale blue
  "#f6d48f", // warm gold wisp
  "#b96fd0", // rose-violet
];

// The luminous core spine deliberately laces pink + gold through the blues so
// the bright middle of the cloud isn't monochrome.
const CORE_HUES = [
  "#6ec9e8", // sky blue
  "#e05fb0", // hot pink
  "#a3dcf0", // pale blue
  "#f6d48f", // gold
  "#3fd6c0", // teal
  "#d58be8", // lilac pink
  "#6ec9e8", // sky blue
  "#f6b45f", // amber gold
];

// small deterministic PRNG so the field is identical every render
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Blob = {
  pos: [number, number, number];
  scale: [number, number, number];
  color: string;
  opacity: number;
  rot: number;
  seed: number;
};

export default function NebulaField({
  count = 30,
  width = 90,
  tilt = 0.28,
  depth = -30,
  opacity = 1,
  drift = true,
}: {
  count?: number;
  width?: number;
  tilt?: number;
  depth?: number;
  opacity?: number;
  drift?: boolean;
}) {
  const group = useRef<THREE.Group>(null);

  const blobs = useMemo<Blob[]>(() => {
    const rnd = mulberry32(1337);
    const out: Blob[] = [];

    // 1) even wide spread across the whole band — varied clouds
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const x = (t - 0.5) * width + (rnd() - 0.5) * (width / count) * 1.4;
      const bandY = x * tilt;
      const y = bandY + (rnd() - 0.5) * 16;
      const z = depth + (rnd() - 0.5) * 18;

      const edge = Math.abs(t - 0.5) * 2; // 0 centre → 1 edge
      const core = 1 - edge * 0.6;

      const big = rnd() > 0.5;
      const s = big ? 22 + rnd() * 24 : 11 + rnd() * 12;
      out.push({
        pos: [x, y, z],
        scale: [s, s * (0.55 + rnd() * 0.4), 1],
        color: HUES[i % HUES.length],
        // much richer than before so it reads as cloud, not a faded wash
        opacity: (big ? 0.32 : 0.5) * (0.5 + core) * opacity,
        rot: (rnd() - 0.5) * Math.PI,
        seed: i + 1,
      });
    }

    // 2) a brighter, denser core band down the middle — the luminous Milky-Way spine
    const coreCount = Math.round(count * 0.45);
    for (let i = 0; i < coreCount; i++) {
      const t = coreCount === 1 ? 0.5 : i / (coreCount - 1);
      const x = (t - 0.5) * width * 0.72 + (rnd() - 0.5) * 6;
      const y = x * tilt + (rnd() - 0.5) * 6;
      const z = depth + 3 + (rnd() - 0.5) * 8;
      const s = 14 + rnd() * 16;
      out.push({
        pos: [x, y, z],
        scale: [s, s * (0.5 + rnd() * 0.3), 1],
        color: CORE_HUES[i % CORE_HUES.length],
        opacity: (0.55 + rnd() * 0.35) * opacity,
        rot: (rnd() - 0.5) * Math.PI,
        seed: 100 + i,
      });
    }
    return out;
  }, [count, width, tilt, depth, opacity]);

  const textures = useMemo(
    () => blobs.map((b) => makeNebulaTexture(b.color, b.seed)),
    [blobs]
  );

  useFrame(({ clock }) => {
    if (drift && group.current) {
      group.current.rotation.z = Math.sin(clock.elapsedTime * 0.012) * 0.05;
      group.current.position.x = Math.sin(clock.elapsedTime * 0.02) * 1.4;
    }
  });

  return (
    <group ref={group}>
      {blobs.map((b, i) => (
        <sprite key={i} position={b.pos} scale={b.scale}>
          <spriteMaterial
            map={textures[i]}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            opacity={b.opacity}
            rotation={b.rot}
          />
        </sprite>
      ))}
    </group>
  );
}
