import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { api, ApiSubtopic, ApiTopic } from "../lib/api";
import { planetVisual, starColor } from "../lib/visuals";
import { makeGlowTexture } from "../components/three/helpers";
import { HudButton, HudPanel, MonoLabel, useToast } from "../components/Hud";

type TestMode = "mcq" | "long_answer" | "flashcard";
const MODES: { id: TestMode; label: string }[] = [
  { id: "mcq", label: "MCQ" },
  { id: "long_answer", label: "LONG ANSWER" },
  { id: "flashcard", label: "FLASHCARDS" },
];

// ─── Sun (the topic itself) ─────────────────────────────────────────────────
function Sun({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const glowTex = useMemo(() => makeGlowTexture(color), [color]);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.08;
      ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 1.2) * 0.03);
    }
  });
  return (
    <group>
      <sprite scale={[9, 9, 1]}>
        <spriteMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.9} />
      </sprite>
      <mesh ref={ref}>
        <sphereGeometry args={[1.5, 48, 48]} />
        <meshStandardMaterial color="#f4fbff" emissive={color} emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
      <pointLight intensity={120} distance={40} color={color} />
    </group>
  );
}

// ─── Orbit ring ─────────────────────────────────────────────────────────────
function OrbitRing({ radius }: { radius: number }) {
  const geom = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [radius]);
  return (
    <lineLoop geometry={geom}>
      <lineBasicMaterial color="#9d6fc8" transparent opacity={0.18} />
    </lineLoop>
  );
}

// ─── Planet (a subtopic) ────────────────────────────────────────────────────
function Planet({
  sub, index, selected, onSelect,
}: {
  sub: ApiSubtopic; index: number; selected: boolean; onSelect: (s: ApiSubtopic) => void;
}) {
  const vis = useMemo(() => planetVisual(sub.id, index), [sub.id, index]);
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const glowTex = useMemo(() => makeGlowTexture(vis.color), [vis.color]);
  const phase = useMemo(() => (index * 137.5) % (Math.PI * 2), [index]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * vis.speed + phase;
    if (group.current) {
      group.current.position.set(Math.cos(t) * vis.orbit, 0, Math.sin(t) * vis.orbit);
    }
    if (mesh.current) {
      mesh.current.rotation.y = clock.elapsedTime * 0.4;
      const target = hovered || selected ? 1.35 : 1;
      mesh.current.scale.setScalar(THREE.MathUtils.lerp(mesh.current.scale.x, target, 0.12));
    }
  });

  return (
    <group ref={group}>
      <sprite scale={[vis.size * 5, vis.size * 5, 1]}>
        <spriteMaterial map={glowTex} transparent depthWrite={false}
          blending={THREE.AdditiveBlending} opacity={hovered || selected ? 0.85 : 0.45} />
      </sprite>
      <mesh
        ref={mesh}
        onClick={(e) => { e.stopPropagation(); onSelect(sub); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
      >
        <sphereGeometry args={[vis.size, 32, 32]} />
        <meshStandardMaterial color={vis.color} emissive={vis.color}
          emissiveIntensity={hovered || selected ? 0.9 : 0.35} roughness={0.5} />
      </mesh>
      <Html center distanceFactor={14} position={[0, -vis.size - 0.55, 0]} style={{ pointerEvents: "none" }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", whiteSpace: "nowrap",
          color: hovered || selected ? "var(--white-core)" : "var(--text-dim)",
          textShadow: hovered || selected ? "0 0 10px var(--glow-pink)" : "none", userSelect: "none",
        }}>
          {sub.name.toUpperCase()}
        </div>
      </Html>
    </group>
  );
}

// ─── Intro camera — start tight on the star, pull back to reveal the system ──
function IntroCamera({ onDone }: { onDone: () => void }) {
  const { camera } = useThree();
  const t = useRef(0);
  const done = useRef(false);
  const start = useMemo(() => new THREE.Vector3(0, 1.8, 4.6), []);
  const end = useMemo(() => new THREE.Vector3(0, 9, 15), []);
  useFrame((_, delta) => {
    if (done.current) return;
    t.current = Math.min(1, t.current + delta / 1.15);
    const e = 1 - Math.pow(1 - t.current, 3); // easeOutCubic
    camera.position.lerpVectors(start, end, e);
    camera.lookAt(0, 0, 0);
    if (t.current >= 1) { done.current = true; onDone(); }
  });
  return null;
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function SolarSystemPage() {
  const { starId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [introDone, setIntroDone] = useState(false);
  const hue = starId ? starColor(starId) : "#9d6fc8";

  const [topic, setTopic] = useState<ApiTopic | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "missing" | "offline">("loading");
  const [selected, setSelected] = useState<ApiSubtopic | null>(null);

  const [portalOpen, setPortalOpen] = useState(false);
  const [mode, setMode] = useState<TestMode>("mcq");
  const [timed, setTimed] = useState(false);
  const [numQuestions, setNumQuestions] = useState(6);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    api.topics()
      .then((ts) => {
        const t = ts.find((x) => x.id === starId) ?? null;
        setTopic(t);
        setLoadState(t ? "ok" : "missing");
      })
      .catch(() => setLoadState("offline"));
  }, [starId]);

  async function launchTest() {
    if (!topic || launching) return;
    setLaunching(true);
    try {
      const attempt = await api.createAttempt({
        topic_id: topic.id,
        mode,
        timed,
        num_questions: numQuestions,
        focus_subtopic_id: selected?.id ?? null,
      });
      navigate(`/system/${topic.id}/test/${attempt.id}`, { state: { attempt } });
    } catch {
      toast("TEST PORTAL OFFLINE — IS THE API RUNNING?");
      setLaunching(false);
    }
  }

  // Only genuine errors interrupt with a panel. While the topic is still
  // loading we render the scene straight away, so the constellation→system
  // zoom itself IS the loading state (no separate "charting" screen).
  if (loadState === "missing" || loadState === "offline") {
    return (
      <div className="page-scroll" style={{ display: "grid", placeItems: "center" }}>
        <HudPanel>
          <MonoLabel>
            {loadState === "offline" ? "API OFFLINE — START THE BACKEND" : "UNKNOWN SYSTEM"}
          </MonoLabel>
          <div style={{ height: 12 }} />
          <HudButton onClick={() => navigate("/")}>RETURN TO CONSTELLATION</HudButton>
        </HudPanel>
      </div>
    );
  }

  return (
    <>
      <div className="scene-root">
        {/* transparent canvas so the route-hue backdrop shows through the scene */}
        <Canvas camera={{ position: [0, 9, 15], fov: 55 }} dpr={[1, 2]} gl={{ alpha: true }}>
          <fog attach="fog" args={["#0b1c3b", 26, 55]} />
          <ambientLight intensity={0.25} />

          <Stars radius={70} depth={40} count={3500} factor={3} saturation={0.4} fade speed={0.5} />
          <Sparkles count={90} scale={30} size={1.8} speed={0.2} color="#d58be8" opacity={0.4} />

          <Sun color={hue} />
          {topic?.subtopics.map((s, i) => (
            <OrbitRing key={`ring-${s.id}`} radius={planetVisual(s.id, i).orbit} />
          ))}
          {topic?.subtopics.map((s, i) => (
            <Planet key={s.id} sub={s} index={i} selected={selected?.id === s.id} onSelect={setSelected} />
          ))}

          {/* on entry: sit tight on the star, then pull back to reveal the system */}
          <IntroCamera onDone={() => setIntroDone(true)} />
          {introDone && <OrbitControls enablePan={false} minDistance={5} maxDistance={32} />}
        </Canvas>
      </div>

      {/* scene resolves out of the star's colour, matching the constellation dive */}
      <div className="system-emerge" style={{ ["--hue" as string]: hue } as CSSProperties} />

      {topic && (
      <div className="overlay-ui">
        {/* header */}
        <div className="top-bar" style={{ paddingLeft: 160 }}>
          <div>
            <button
              onClick={() => navigate("/")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em",
                color: "var(--text-dim)", marginBottom: 8, padding: 0,
              }}
            >
              ◄ CONSTELLATION
            </button>
            <div className="mono-label">{topic.tag} SYSTEM</div>
            <h1 className="display-title" style={{ fontSize: 40, fontStyle: "italic" }}>{topic.name}</h1>
            <p style={{ fontSize: 13, color: "var(--text-dim)", maxWidth: 340 }}>{topic.blurb}</p>
          </div>
          <div className="hint-chip">DRAG TO ORBIT 360° · CLICK A PLANET FOR ITS SUBTOPIC</div>
        </div>

        {/* ── TEST PORTAL — collapsed card, zooms open ── */}
        <div style={{ position: "absolute", left: 160, bottom: 30, width: portalOpen ? 360 : 230 }}>
          {!portalOpen ? (
            <HudPanel>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div className="portal-dot" />
                <MonoLabel style={{ color: "var(--pink-soft)" }}>TEST PORTAL</MonoLabel>
              </div>
              <HudButton onClick={() => setPortalOpen(true)}>▸ TAKE A TEST</HudButton>
              <div style={{ height: 8 }} />
              <HudButton variant="purple" onClick={() => navigate(`/system/${topic.id}/arcade`)}>
                ✦ KNOWLEDGE ARCADE
              </HudButton>
            </HudPanel>
          ) : (
            <div className="zoom-in" style={{ transformOrigin: "bottom left" }}>
              <HudPanel>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="portal-dot" />
                    <MonoLabel style={{ color: "var(--pink-soft)" }}>TEST PORTAL</MonoLabel>
                  </div>
                  <button
                    onClick={() => setPortalOpen(false)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12,
                    }}
                  >
                    ✕
                  </button>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
                  Assessment across this system{selected ? ` — focused on ${selected.name}` : ""}.
                </p>

                {/* mode select */}
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {MODES.map((m) => (
                    <button key={m.id} onClick={() => setMode(m.id)}
                      style={{
                        flex: 1, padding: "7px 4px", cursor: "pointer",
                        fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em",
                        color: mode === m.id ? "var(--white-core)" : "var(--text-dim)",
                        background: mode === m.id ? "rgba(213,139,232,0.18)" : "rgba(122,75,168,0.06)",
                        border: `1px solid ${mode === m.id ? "var(--pink)" : "rgba(122,75,168,0.2)"}`,
                        clipPath: "polygon(6px 0%, 100% 0%, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0% 100%, 0% 6px)",
                      }}>
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* count + timed */}
                <div style={{ display: "flex", gap: 6, marginBottom: 14, alignItems: "center" }}>
                  {[4, 6, 8].map((n) => (
                    <button key={n} onClick={() => setNumQuestions(n)}
                      style={{
                        padding: "6px 12px", cursor: "pointer",
                        fontFamily: "var(--font-mono)", fontSize: 9,
                        color: numQuestions === n ? "var(--white-core)" : "var(--text-dim)",
                        background: numQuestions === n ? "rgba(122,75,168,0.2)" : "rgba(122,75,168,0.06)",
                        border: `1px solid ${numQuestions === n ? "var(--purple-soft)" : "rgba(122,75,168,0.2)"}`,
                        clipPath: "polygon(5px 0%, 100% 0%, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0% 100%, 0% 5px)",
                      }}>
                      {n}Q
                    </button>
                  ))}
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setTimed((t) => !t)}
                    style={{
                      padding: "6px 12px", cursor: "pointer",
                      fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em",
                      color: timed ? "var(--white-core)" : "var(--text-dim)",
                      background: timed ? "rgba(213,139,232,0.2)" : "rgba(122,75,168,0.06)",
                      border: `1px solid ${timed ? "var(--pink)" : "rgba(122,75,168,0.2)"}`,
                      clipPath: "polygon(5px 0%, 100% 0%, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0% 100%, 0% 5px)",
                    }}>
                    ⏱ TIMED {timed ? "ON" : "OFF"}
                  </button>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <HudButton onClick={launchTest} disabled={launching}>
                    {launching ? "GENERATING…" : "▸ INITIATE TEST"}
                  </HudButton>
                  <HudButton variant="ghost" onClick={() => navigate(`/system/${topic.id}/analysis`)}>
                    LAST ANALYSIS
                  </HudButton>
                </div>
              </HudPanel>
            </div>
          )}
        </div>

        {/* ── Subtopic detail panel ── */}
        {selected && (
          <div style={{ position: "absolute", right: 30, bottom: 30, width: 320 }}>
            <HudPanel purple>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <MonoLabel>SUBTOPIC · PLANET</MonoLabel>
                  <h2 className="display-title" style={{ fontSize: 26, marginTop: 2 }}>{selected.name}</h2>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12,
                  }}
                >
                  ✕
                </button>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "8px 0 14px" }}>{selected.blurb}</p>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <MonoLabel>MASTERY</MonoLabel>
                <MonoLabel style={{ color: "var(--pink-soft)" }}>{selected.mastery}%</MonoLabel>
              </div>
              <div className="bar-track" style={{ marginBottom: 16 }}>
                <div className="bar-fill" style={{ width: `${selected.mastery}%` }} />
              </div>
              <HudButton variant="purple"
                onClick={() => navigate(`/system/${topic.id}/concept/${selected.id}`)}>
                ✦ VISUALISE CONCEPT
              </HudButton>
            </HudPanel>
          </div>
        )}
      </div>
      )}
    </>
  );
}
