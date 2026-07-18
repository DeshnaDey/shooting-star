import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Line, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { api, ApiTopic } from "../lib/api";
import { starColor, starPosition } from "../lib/visuals";
import { makeGlowTexture } from "../components/three/helpers";
import { HudButton, HudPanel, MonoLabel, useToast } from "../components/Hud";

// ─── A clickable topic star ─────────────────────────────────────────────────
function TopicStar({
  topic, position, onOpen,
}: { topic: ApiTopic; position: [number, number, number]; onOpen: (t: ApiTopic) => void }) {
  const [hovered, setHovered] = useState(false);
  const core = useRef<THREE.Mesh>(null);
  // Dim until learning is done: unlit stars smoulder, lit stars blaze.
  // Brightness scales further with topic progress (avg mastery).
  const lit = topic.lit;
  const color = lit ? starColor(topic.id) : "#8a7ab0";
  const glowTex = useMemo(() => makeGlowTexture(color), [color]);
  const baseIntensity = lit ? 1.9 + (topic.progress / 100) * 1.6 : 0.35;
  const haloScale = lit ? 2.0 : 1.0;
  const haloOpacity = lit ? 0.8 : 0.22;

  useFrame(({ clock }) => {
    if (!core.current) return;
    const breathe = 1 + Math.sin(clock.elapsedTime * 1.6 + position[0]) * (lit ? 0.06 : 0.02);
    const target = hovered ? 1.5 : breathe;
    core.current.scale.setScalar(THREE.MathUtils.lerp(core.current.scale.x, target, 0.12));
  });

  return (
    <group position={position}>
      <sprite scale={[hovered ? haloScale + 0.8 : haloScale, hovered ? haloScale + 0.8 : haloScale, 1]}>
        <spriteMaterial map={glowTex} transparent depthWrite={false}
          blending={THREE.AdditiveBlending} opacity={hovered ? Math.min(1, haloOpacity + 0.3) : haloOpacity} />
      </sprite>
      <mesh
        ref={core}
        onClick={(e) => { e.stopPropagation(); onOpen(topic); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
      >
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial
          color={lit ? "#fff8fd" : "#6f5c94"}
          emissive={color}
          emissiveIntensity={hovered ? baseIntensity + 1.4 : baseIntensity}
          toneMapped={false} />
      </mesh>
      <Html center distanceFactor={16} position={[0, -0.72, 0]} style={{ pointerEvents: "none" }}>
        <div style={{ textAlign: "center", width: 150, userSelect: "none" }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: "0.2em",
            color: hovered ? "var(--pink-soft)" : "var(--text-faint)", transition: "color 0.2s",
          }}>
            {topic.tag}{lit ? ` · ${topic.progress}%` : " · UNLIT"}
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 13,
            color: hovered ? "var(--white-core)" : lit ? "var(--text-main)" : "var(--text-faint)",
            textShadow: hovered || lit ? "0 0 12px var(--glow-pink)" : "none", transition: "all 0.2s",
          }}>
            {topic.name}
          </div>
        </div>
      </Html>
    </group>
  );
}

// ─── Faint plus — add a topic ───────────────────────────────────────────────
function PlusStar({ position, onClick }: { position: [number, number, number]; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.5) * 0.08;
  });
  const c = hovered ? "#f9bce2" : "#b79cfb";
  const glowTex = useMemo(() => makeGlowTexture("#b79cfb"), []);
  return (
    <group ref={ref} position={position}>
      {/* soft halo so the plus reads against the starfield */}
      <sprite scale={[1.6, 1.6, 1]}>
        <spriteMaterial map={glowTex} transparent depthWrite={false}
          blending={THREE.AdditiveBlending} opacity={hovered ? 0.7 : 0.35} />
      </sprite>
      <mesh
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
      >
        <sphereGeometry args={[0.65, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      {/* plus glyph */}
      <mesh>
        <boxGeometry args={[0.62, 0.09, 0.09]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={hovered ? 2.8 : 1.4}
          transparent opacity={hovered ? 1 : 0.85} toneMapped={false} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.09, 0.62, 0.09]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={hovered ? 2.8 : 1.4}
          transparent opacity={hovered ? 1 : 0.85} toneMapped={false} />
      </mesh>
      <Html center distanceFactor={16} position={[0, -0.85, 0]} style={{ pointerEvents: "none" }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em",
          color: hovered ? "var(--pink-soft)" : "var(--text-dim)",
          whiteSpace: "nowrap", userSelect: "none", transition: "color 0.2s",
        }}>
          ✛ ADD TOPIC
        </div>
      </Html>
    </group>
  );
}

// slow ambient drift
function DriftGroup({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.03) * 0.08;
  });
  return <group ref={ref}>{children}</group>;
}

// ─── Add-topic modal ────────────────────────────────────────────────────────
function AddTopicModal({
  onClose, onCreated,
}: { onClose: () => void; onCreated: (t: ApiTopic) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function create() {
    const trimmed = name.trim();
    if (trimmed.length < 2 || busy) return;
    setBusy(true);
    try {
      const topic = await api.createTopic(trimmed);
      onCreated(topic);
    } catch {
      toast("COULD NOT CREATE TOPIC — IS THE API RUNNING?");
      setBusy(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center",
      background: "rgba(11,8,23,0.75)", backdropFilter: "blur(6px)",
    }} onClick={busy ? undefined : onClose}>
      <div onClick={(e) => e.stopPropagation()} className="zoom-in" style={{ width: 380 }}>
        <HudPanel>
          <MonoLabel style={{ color: "var(--pink-soft)" }}>NEW STAR</MonoLabel>
          <h2 className="display-title" style={{ fontSize: 26, fontStyle: "italic", margin: "4px 0 10px" }}>
            Add a topic
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 14 }}>
            Name a topic you're struggling with. The AI will chart its subtopics as planets.
          </p>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="e.g. Sorting Algorithms"
            disabled={busy}
            style={{
              width: "100%", padding: "11px 14px", marginBottom: 14, boxSizing: "border-box",
              fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-bright)",
              background: "rgba(139,92,246,0.08)", border: "1px solid rgba(167,139,250,0.3)",
              outline: "none",
              clipPath: "polygon(8px 0%, 100% 0%, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0% 100%, 0% 8px)",
            }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <HudButton onClick={create} disabled={busy || name.trim().length < 2}>
              {busy ? "CHARTING SYSTEM…" : "▸ IGNITE STAR"}
            </HudButton>
            <HudButton variant="ghost" onClick={onClose} disabled={busy}>CANCEL</HudButton>
          </div>
        </HudPanel>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function ConstellationPage() {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<ApiTopic[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.topics()
      .then(setTopics)
      .catch(() => { setTopics([]); setOffline(true); });
  }, []);

  const positions = useMemo(
    () => (topics ?? []).map((_, i) => starPosition(i)),
    [topics]
  );
  const plusPos = starPosition(topics?.length ?? 0);

  // lines touching a dim (unlit) star render dotted; fully-lit links are solid
  const edges = useMemo(() => {
    const list: { pts: [THREE.Vector3Tuple, THREE.Vector3Tuple]; solid: boolean }[] = [];
    const ts = topics ?? [];
    for (let i = 1; i < positions.length; i++) {
      list.push({
        pts: [positions[i - 1], positions[i]],
        solid: Boolean(ts[i - 1]?.lit && ts[i]?.lit),
      });
    }
    return list;
  }, [positions, topics]);

  return (
    <>
      <div className="scene-root">
        <Canvas camera={{ position: [0, 2, 14], fov: 55 }} dpr={[1, 2]}>
          <color attach="background" args={["#191228"]} />
          <fog attach="fog" args={["#191228", 22, 46]} />
          <ambientLight intensity={0.5} />
          <pointLight position={[0, 6, 8]} intensity={40} color="#f2a8d8" />
          <pointLight position={[-8, -4, -6]} intensity={30} color="#8b5cf6" />

          <Stars radius={70} depth={40} count={4000} factor={3} saturation={0.4} fade speed={0.6} />
          <Sparkles count={110} scale={26} size={2.2} speed={0.25} color="#f2a8d8" opacity={0.5} />
          <Sparkles count={80} scale={30} size={1.6} speed={0.18} color="#a78bfa" opacity={0.4} />

          <DriftGroup>
            {edges.map((e, i) => (
              <Line
                key={i}
                points={e.pts}
                color={e.solid ? "#d4c6fd" : "#8a7ab0"}
                transparent
                opacity={e.solid ? 0.3 : 0.18}
                lineWidth={1}
                dashed={!e.solid}
                dashSize={0.16}
                gapSize={0.14}
              />
            ))}
            {(topics ?? []).map((t, i) => (
              <TopicStar key={t.id} topic={t} position={positions[i]}
                onOpen={(topic) => navigate(`/system/${topic.id}`)} />
            ))}
            {topics !== null && !offline && (
              <PlusStar position={plusPos} onClick={() => setAdding(true)} />
            )}
          </DriftGroup>

          <OrbitControls enablePan={false} minDistance={5} maxDistance={30}
            autoRotate autoRotateSpeed={0.3} />
        </Canvas>
      </div>

      <div className="overlay-ui">
        <div className="top-bar" style={{ paddingLeft: 160 }}>
          <div className="brand">
            <h1>Shooting Star</h1>
            <MonoLabel>LEARNING CONSTELLATION</MonoLabel>
          </div>
          <div className="hint-chip">
            {offline
              ? "API OFFLINE — START THE BACKEND TO CHART YOUR SKY"
              : "DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A STAR TO ENTER"}
          </div>
        </div>

        {topics !== null && topics.length === 0 && !offline && (
          <div style={{
            position: "absolute", bottom: 60, left: 0, right: 0,
            display: "grid", placeItems: "center", pointerEvents: "none",
          }}>
            <MonoLabel style={{ fontSize: 10, color: "var(--text-dim)" }}>
              THE SKY IS EMPTY — CLICK THE FAINT ✛ TO IGNITE YOUR FIRST STAR
            </MonoLabel>
          </div>
        )}
      </div>

      {adding && (
        <AddTopicModal
          onClose={() => setAdding(false)}
          onCreated={(t) => { setTopics((prev) => [...(prev ?? []), t]); setAdding(false); }}
        />
      )}
    </>
  );
}
