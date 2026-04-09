import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text3D } from "@react-three/drei";
import * as THREE from "three";
import "./HeroSection.css";

const FONT_URL = `${import.meta.env.BASE_URL}fonts/helvetiker_bold.typeface.json`;

class HeroCanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "3D scene failed to load.",
    };
  }

  componentDidCatch(error) {
    console.error("Hero Canvas Error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="hero-fallback">
          <div className="hero-fallback-title">3D Hero konnte nicht geladen werden</div>
          <div className="hero-fallback-text">
            Prüfe die Font-Datei unter <code>{FONT_URL}</code>.
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/* -----------------------------
   Procedural textures
----------------------------- */

function createBrickTextures() {
  const size = 1024;

  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext("2d");

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const btx = bumpCanvas.getContext("2d");

  // base
  ctx.fillStyle = "#0a1423";
  ctx.fillRect(0, 0, size, size);

  btx.fillStyle = "#9a9a9a";
  btx.fillRect(0, 0, size, size);

  const brickW = 170;
  const brickH = 72;
  const mortar = 8;

  for (let y = 0; y < size + brickH; y += brickH + mortar) {
    const oddRow = Math.floor(y / (brickH + mortar)) % 2 === 1;
    const offset = oddRow ? brickW / 2 : 0;

    for (let x = -brickW; x < size + brickW; x += brickW + mortar) {
      const px = x + offset;

      const hue = 210 + Math.random() * 12;
      const sat = 35 + Math.random() * 14;
      const light = 12 + Math.random() * 8;

      ctx.fillStyle = `hsl(${hue} ${sat}% ${light}%)`;
      ctx.fillRect(px, y, brickW, brickH);

      // brick shading
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(px, y, brickW, 6);

      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.fillRect(px, y + brickH - 8, brickW, 8);

      // subtle noise
      for (let i = 0; i < 24; i++) {
        const nx = px + Math.random() * brickW;
        const ny = y + Math.random() * brickH;
        const a = 0.03 + Math.random() * 0.05;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(nx, ny, 2, 2);
      }

      // bump brick higher than mortar
      btx.fillStyle = "#cfcfcf";
      btx.fillRect(px, y, brickW, brickH);

      btx.fillStyle = "#dddddd";
      btx.fillRect(px, y, brickW, 4);

      btx.fillStyle = "#a8a8a8";
      btx.fillRect(px, y + brickH - 5, brickW, 5);
    }
  }

  // mortar lines
  ctx.strokeStyle = "rgba(155,175,205,0.12)";
  ctx.lineWidth = mortar;
  for (let y = brickH; y < size; y += brickH + mortar) {
    ctx.beginPath();
    ctx.moveTo(0, y + mortar / 2);
    ctx.lineTo(size, y + mortar / 2);
    ctx.stroke();
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.repeat.set(2.4, 1.4);
  colorMap.anisotropy = 8;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2.4, 1.4);
  bumpMap.anisotropy = 8;

  return { colorMap, bumpMap };
}

function createTileTextures() {
  const size = 1024;

  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext("2d");

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const btx = bumpCanvas.getContext("2d");

  ctx.fillStyle = "#060b14";
  ctx.fillRect(0, 0, size, size);

  btx.fillStyle = "#cfcfcf";
  btx.fillRect(0, 0, size, size);

  const tile = 120;
  const grout = 7;

  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      const v = 7 + Math.random() * 4;
      ctx.fillStyle = `hsl(214 35% ${v}%)`;
      ctx.fillRect(x + grout / 2, y + grout / 2, tile - grout, tile - grout);

      ctx.fillStyle = "rgba(255,255,255,0.025)";
      ctx.fillRect(x + grout / 2, y + grout / 2, tile - grout, 5);

      ctx.fillStyle = "rgba(255,255,255,0.02)";
      ctx.fillRect(x + grout / 2, y + grout / 2, 5, tile - grout);

      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(x + grout / 2, y + tile - grout - 5, tile - grout, 5);

      btx.fillStyle = "#dfdfdf";
      btx.fillRect(x + grout / 2, y + grout / 2, tile - grout, tile - grout);

      btx.fillStyle = "#8f8f8f";
      btx.fillRect(x, y, tile, grout);
      btx.fillRect(x, y, grout, tile);
    }
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.repeat.set(4.5, 4.5);
  colorMap.anisotropy = 8;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(4.5, 4.5);
  bumpMap.anisotropy = 8;

  return { colorMap, bumpMap };
}

/* -----------------------------
   Scene parts
----------------------------- */

function Wall({ powerState }) {
  const wallMaterialRef = useRef(null);

  const brick = useMemo(() => createBrickTextures(), []);

  useFrame((state) => {
    if (!wallMaterialRef.current) return;

    const t = state.clock.getElapsedTime();

    let emissiveIntensity = 0.16;

    if (powerState === "intro") emissiveIntensity = 0.22;

    if (powerState === "flicker") {
      emissiveIntensity =
        Math.sin(t * 34) > 0.35
          ? 0.2
          : Math.sin(t * 18) > -0.1
            ? 0.09
            : 0.03;
    }

    if (powerState === "lamp") emissiveIntensity = 0.06;

    wallMaterialRef.current.emissiveIntensity = emissiveIntensity;
  });

  return (
    <mesh position={[0, 0.15, -8.8]} receiveShadow>
      <planeGeometry args={[34, 18, 1, 1]} />
      <meshStandardMaterial
        ref={wallMaterialRef}
        map={brick.colorMap}
        bumpMap={brick.bumpMap}
        bumpScale={0.24}
        color="#85a7d0"
        roughness={0.98}
        metalness={0.02}
        emissive="#0d1b31"
        emissiveIntensity={0.16}
      />
    </mesh>
  );
}

function Floor() {
  const tile = useMemo(() => createTileTextures(), []);

  return (
    <mesh
      position={[0, -6.1, -4.4]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[40, 24, 1, 1]} />
      <meshStandardMaterial
        map={tile.colorMap}
        bumpMap={tile.bumpMap}
        bumpScale={0.14}
        color="#8aa0bf"
        roughness={0.92}
        metalness={0.03}
      />
    </mesh>
  );
}

function TextBlock({ powerState, introProgress }) {
  const rootRef = useRef(null);

  const leftX = -10.2;
  const lineY1 = 2.15;
  const lineY2 = -0.15;
  const lineY3 = -2.6;

  const baseColor = powerState === "lamp" ? "#aab6ca" : "#dfe9ff";
  const accentColor = powerState === "lamp" ? "#79e8f8" : "#9bf6ff";
  const baseEmissive = powerState === "lamp" ? "#0d1525" : "#1b2d49";
  const baseEmissiveIntensity = powerState === "lamp" ? 0.03 : 0.1;
  const accentEmissiveIntensity = powerState === "lamp" ? 0.18 : 0.34;

  const sharedMaterial = useMemo(
    () => ({
      roughness: 0.84,
      metalness: 0.04,
    }),
    []
  );

  useFrame((_, delta) => {
    if (!rootRef.current) return;

    const introYOffset = THREE.MathUtils.lerp(0.7, 0, introProgress);
    rootRef.current.position.y = THREE.MathUtils.damp(
      rootRef.current.position.y,
      introYOffset,
      10,
      delta
    );
  });

  return (
    <group ref={rootRef} position={[0, 0.2, -0.45]}>
      <group position={[leftX, lineY1, 0]}>
        <Text3D
          font={FONT_URL}
          size={1.36}
          height={0.34}
          curveSegments={10}
          bevelEnabled
          bevelThickness={0.015}
          bevelSize={0.012}
          bevelOffset={0}
          bevelSegments={4}
          castShadow
          receiveShadow
        >
          Dustin
          <meshStandardMaterial
            color={baseColor}
            emissive={baseEmissive}
            emissiveIntensity={baseEmissiveIntensity}
            {...sharedMaterial}
          />
        </Text3D>
      </group>

      <group position={[leftX, lineY2, 0]}>
        <Text3D
          font={FONT_URL}
          size={0.96}
          height={0.28}
          curveSegments={10}
          bevelEnabled
          bevelThickness={0.013}
          bevelSize={0.01}
          bevelOffset={0}
          bevelSegments={4}
          castShadow
          receiveShadow
        >
          builds
          <meshStandardMaterial
            color={baseColor}
            emissive={baseEmissive}
            emissiveIntensity={baseEmissiveIntensity}
            {...sharedMaterial}
          />
        </Text3D>
      </group>

      <group position={[leftX + 5.15, lineY2, 0]}>
        <Text3D
          font={FONT_URL}
          size={0.96}
          height={0.28}
          curveSegments={10}
          bevelEnabled
          bevelThickness={0.013}
          bevelSize={0.01}
          bevelOffset={0}
          bevelSegments={4}
          castShadow
          receiveShadow
        >
          digital
          <meshStandardMaterial
            color={accentColor}
            emissive="#6af3ff"
            emissiveIntensity={accentEmissiveIntensity}
            roughness={0.8}
            metalness={0.04}
          />
        </Text3D>
      </group>

      <group position={[leftX, lineY3, 0]}>
        <Text3D
          font={FONT_URL}
          size={1.16}
          height={0.32}
          curveSegments={10}
          bevelEnabled
          bevelThickness={0.014}
          bevelSize={0.011}
          bevelOffset={0}
          bevelSegments={4}
          castShadow
          receiveShadow
        >
          Experiences.
          <meshStandardMaterial
            color={baseColor}
            emissive={baseEmissive}
            emissiveIntensity={baseEmissiveIntensity}
            {...sharedMaterial}
          />
        </Text3D>
      </group>
    </group>
  );
}

function PowerLights({ powerState, pointer }) {
  const ambientRef = useRef(null);
  const wallWashRef = useRef(null);
  const spotRef = useRef(null);
  const targetRef = useRef(null);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    if (ambientRef.current) {
      let ambient = 0.22;

      if (powerState === "intro") ambient = 0.28;

      if (powerState === "flicker") {
        ambient =
          Math.sin(t * 28) > 0.32
            ? 0.2
            : Math.sin(t * 16) > -0.1
              ? 0.08
              : 0.02;
      }

      if (powerState === "lamp") ambient = 0.035;

      ambientRef.current.intensity = ambient;
    }

    if (wallWashRef.current) {
      let fill = 1.45;

      if (powerState === "intro") fill = 1.8;

      if (powerState === "flicker") {
        fill =
          Math.sin(t * 22) > 0.28
            ? 1.15
            : Math.sin(t * 13) > -0.06
              ? 0.45
              : 0.06;
      }

      if (powerState === "lamp") fill = 0.14;

      wallWashRef.current.intensity = fill;
    }

    if (spotRef.current && targetRef.current) {
      // Wandbereich direkt aus Cursor ableiten
      const targetX = THREE.MathUtils.clamp(pointer.x * 14.2, -14.2, 14.2);
      const targetY = THREE.MathUtils.clamp(pointer.y * 7.2, -7.2, 7.2);

      // Target direkt auf Wand an Cursorposition
      targetRef.current.position.x = targetX;
      targetRef.current.position.y = targetY;
      targetRef.current.position.z = -8.75;

      // Spot direkt "über" dem Cursorpunkt, kaum Versatz
      spotRef.current.position.x = THREE.MathUtils.damp(
        spotRef.current.position.x,
        targetX,
        18,
        delta
      );
      spotRef.current.position.y = THREE.MathUtils.damp(
        spotRef.current.position.y,
        targetY + 0.2,
        18,
        delta
      );
      spotRef.current.position.z = THREE.MathUtils.damp(
        spotRef.current.position.z,
        11.8,
        14,
        delta
      );

      spotRef.current.target = targetRef.current;
      spotRef.current.intensity = powerState === "lamp" ? 720 : 0;
      spotRef.current.angle = 0.46;
      spotRef.current.penumbra = 0.32;
      spotRef.current.distance = 72;
      spotRef.current.decay = 1.05;
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.22} color="#9db8ff" />

      <pointLight
        ref={wallWashRef}
        position={[0, 1.4, -5.5]}
        color="#1f5f88"
        intensity={1.45}
        distance={30}
        decay={1.8}
      />

      <object3D ref={targetRef} position={[0, 0, -8.75]} />

      <spotLight
        ref={spotRef}
        position={[0, 0.2, 11.8]}
        color="#e9fdff"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-bias={-0.00008}
        shadow-normalBias={0.015}
      />
    </>
  );
}

function Scene({ powerState, pointer, introProgress }) {
  return (
    <>
      <fog attach="fog" args={["#02050b", 11, 32]} />
      <Wall powerState={powerState} />
      <Floor />
      <PowerLights powerState={powerState} pointer={pointer} />
      <TextBlock powerState={powerState} introProgress={introProgress} />
    </>
  );
}

export default function HeroSection() {
  const sectionRef = useRef(null);
  const [powerState, setPowerState] = useState("intro");
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [introProgress, setIntroProgress] = useState(0);

  useEffect(() => {
    let rafId = 0;
    const start = performance.now();
    const introDuration = 420;

    const animateIntro = (now) => {
      const progress = Math.min((now - start) / introDuration, 1);
      setIntroProgress(progress);

      if (progress < 1) {
        rafId = window.requestAnimationFrame(animateIntro);
      }
    };

    rafId = window.requestAnimationFrame(animateIntro);

    const flickerTimer = window.setTimeout(() => {
      setPowerState("flicker");
    }, 180);

    const lampTimer = window.setTimeout(() => {
      setPowerState("lamp");
    }, 900);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(flickerTimer);
      window.clearTimeout(lampTimer);
    };
  }, []);

  useEffect(() => {
    const handlePointerMove = (e) => {
      const el = sectionRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      setPointer({
        x: THREE.MathUtils.clamp(x, -1, 1),
        y: THREE.MathUtils.clamp(y, -1, 1),
      });
    };

    const handlePointerLeave = () => {
      setPointer({ x: 0, y: 0 });
    };

    const el = sectionRef.current;
    if (!el) return;

    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  return (
    <section
      className={`hero hero-3d hero-power-${powerState}`}
      id="hero"
      ref={sectionRef}
    >
      <div className="hero-canvas-wrap">
        <HeroCanvasErrorBoundary>
          <Canvas
            shadows
            camera={{ position: [0, 0, 18], fov: 36 }}
            dpr={[1, 1.8]}
            gl={{ antialias: true }}
          >
            <Suspense fallback={null}>
              <Scene
                powerState={powerState}
                pointer={pointer}
                introProgress={introProgress}
              />
            </Suspense>
          </Canvas>
        </HeroCanvasErrorBoundary>
      </div>

      <div className="hero-overlay-ui">
        <div className="hero-badge-row">
          <span className="hero-badge">Available for work</span>
          <span className="hero-badge">Frontend + Fullstack</span>
          <span className="hero-badge">CAD + Creative Tech</span>
        </div>

        <div className="hero-scroll">
          <span>Scroll to explore</span>
          <div className="hero-scroll-line" />
        </div>
      </div>
    </section>
  );
}