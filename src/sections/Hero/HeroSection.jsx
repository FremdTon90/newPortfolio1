import React, {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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
  const width = 2048;
  const height = 1024;

  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = width;
  colorCanvas.height = height;
  const ctx = colorCanvas.getContext("2d");

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const btx = bumpCanvas.getContext("2d");

  const dispCanvas = document.createElement("canvas");
  dispCanvas.width = width;
  dispCanvas.height = height;
  const dtx = dispCanvas.getContext("2d");

  // dunkles Ziegelrot als Grundwelt
  ctx.fillStyle = "#140809";
  ctx.fillRect(0, 0, width, height);

  btx.fillStyle = "#6c6c6c";
  btx.fillRect(0, 0, width, height);

  dtx.fillStyle = "#4a4a4a";
  dtx.fillRect(0, 0, width, height);

  const brickW = 128;
  const brickH = 52;
  const mortar = 8;
  const rowStep = brickH + mortar;

  for (let row = 0, y = 0; y < height + brickH; row += 1, y += rowStep) {
    const offset = row % 2 === 1 ? brickW / 2 : 0;

    for (let x = -brickW; x < width + brickW; x += brickW + mortar) {
      const px = x + offset;

      // brick red / burgundy / burnt red
      const hue = 4 + Math.random() * 10;
      const sat = 34 + Math.random() * 18;
      const light = 14 + Math.random() * 7;

      ctx.fillStyle = `hsl(${hue} ${sat}% ${light}%)`;
      ctx.fillRect(px, y, brickW, brickH);

      ctx.fillStyle = "rgba(255,220,210,0.035)";
      ctx.fillRect(px, y, brickW, 4);

      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(px, y + brickH - 6, brickW, 6);

      for (let i = 0; i < 18; i++) {
        const nx = px + Math.random() * brickW;
        const ny = y + Math.random() * brickH;
        const a = 0.012 + Math.random() * 0.03;
        ctx.fillStyle = `rgba(255,235,230,${a})`;
        ctx.fillRect(nx, ny, 2, 2);
      }

      // bump
      btx.fillStyle = "#d7d7d7";
      btx.fillRect(px, y, brickW, brickH);
      btx.fillStyle = "#efefef";
      btx.fillRect(px + 1, y + 1, brickW - 2, 2);
      btx.fillStyle = "#939393";
      btx.fillRect(px, y + brickH - 3, brickW, 3);

      // displacement
      dtx.fillStyle = "#ececec";
      dtx.fillRect(px, y, brickW, brickH);
      dtx.fillStyle = "#fafafa";
      dtx.fillRect(px + 1, y + 1, brickW - 2, 2);
      dtx.fillStyle = "#9a9a9a";
      dtx.fillRect(px, y + brickH - 3, brickW, 3);
    }
  }

  // Mörtel dunkler und tiefer
  for (let y = brickH; y < height; y += rowStep) {
    btx.fillStyle = "#5e5e5e";
    btx.fillRect(0, y, width, mortar);

    dtx.fillStyle = "#343434";
    dtx.fillRect(0, y, width, mortar);
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.wrapS = THREE.ClampToEdgeWrapping;
  colorMap.wrapT = THREE.ClampToEdgeWrapping;
  colorMap.repeat.set(1, 1);
  colorMap.anisotropy = 8;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.ClampToEdgeWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;
  bumpMap.repeat.set(1, 1);
  bumpMap.anisotropy = 8;

  const displacementMap = new THREE.CanvasTexture(dispCanvas);
  displacementMap.wrapS = THREE.ClampToEdgeWrapping;
  displacementMap.wrapT = THREE.ClampToEdgeWrapping;
  displacementMap.repeat.set(1, 1);
  displacementMap.anisotropy = 8;

  return { colorMap, bumpMap, displacementMap };
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

  const dispCanvas = document.createElement("canvas");
  dispCanvas.width = size;
  dispCanvas.height = size;
  const dtx = dispCanvas.getContext("2d");

  // viel dunklerer Boden
  ctx.fillStyle = "#02050a";
  ctx.fillRect(0, 0, size, size);

  btx.fillStyle = "#7f7f7f";
  btx.fillRect(0, 0, size, size);

  dtx.fillStyle = "#606060";
  dtx.fillRect(0, 0, size, size);

  const tile = 184;
  const grout = 12;

  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      const v = 2.8 + Math.random() * 1.3;
      ctx.fillStyle = `hsl(215 18% ${v}%)`;
      ctx.fillRect(x + grout / 2, y + grout / 2, tile - grout, tile - grout);

      ctx.fillStyle = "rgba(255,255,255,0.005)";
      ctx.fillRect(x + grout / 2, y + grout / 2, tile - grout, 2);

      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(x + grout / 2, y + tile - grout - 2, tile - grout, 2);

      // Fliese hoch
      btx.fillStyle = "#d3d3d3";
      btx.fillRect(x + grout / 2, y + grout / 2, tile - grout, tile - grout);

      // Fuge deutlich tiefer
      btx.fillStyle = "#575757";
      btx.fillRect(x, y, tile, grout);
      btx.fillRect(x, y, grout, tile);

      dtx.fillStyle = "#e7e7e7";
      dtx.fillRect(x + grout / 2, y + grout / 2, tile - grout, tile - grout);

      dtx.fillStyle = "#3e3e3e";
      dtx.fillRect(x, y, tile, grout);
      dtx.fillRect(x, y, grout, tile);
    }
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.repeat.set(3.25, 3.25);
  colorMap.anisotropy = 8;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3.25, 3.25);
  bumpMap.anisotropy = 8;

  const displacementMap = new THREE.CanvasTexture(dispCanvas);
  displacementMap.wrapS = THREE.RepeatWrapping;
  displacementMap.wrapT = THREE.RepeatWrapping;
  displacementMap.repeat.set(3.25, 3.25);
  displacementMap.anisotropy = 8;

  return { colorMap, bumpMap, displacementMap };
}

/* -----------------------------
   Scene parts
----------------------------- */

function BrickMaterial({
  powerState,
  textures,
  materialRef,
  color = "#c97d72",
  emissive = "#2a0f10",
}) {
  useFrame((state) => {
    if (!materialRef.current) return;

    const t = state.clock.getElapsedTime();
    let emissiveIntensity = 0.12;

    if (powerState === "intro") emissiveIntensity = 0.16;

    if (powerState === "flicker") {
      emissiveIntensity =
        Math.sin(t * 34) > 0.35
          ? 0.15
          : Math.sin(t * 18) > -0.1
            ? 0.06
            : 0.02;
    }

    if (powerState === "lamp") emissiveIntensity = 0.035;

    materialRef.current.emissiveIntensity = emissiveIntensity;
  });

  return (
    <meshStandardMaterial
      ref={materialRef}
      map={textures.colorMap}
      bumpMap={textures.bumpMap}
      bumpScale={0.16}
      displacementMap={textures.displacementMap}
      displacementScale={0.22}
      displacementBias={-0.008}
      color={color}
      roughness={1}
      metalness={0}
      emissive={emissive}
      emissiveIntensity={0.12}
    />
  );
}

function BackWall({ powerState }) {
  const wallMaterialRef = useRef(null);
  const textures = useMemo(() => createBrickTextures(), []);

  return (
    <mesh position={[0, 0.15, -8.8]} receiveShadow>
      <planeGeometry args={[34, 18, 280, 170]} />
      <BrickMaterial
        powerState={powerState}
        textures={textures}
        materialRef={wallMaterialRef}
        color="#b97770"
        emissive="#2a1112"
      />
    </mesh>
  );
}

function SideWalls({ powerState }) {
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const textures = useMemo(() => createBrickTextures(), []);

  useFrame((state) => {
    const refs = [leftRef.current, rightRef.current].filter(Boolean);
    const t = state.clock.getElapsedTime();

    refs.forEach((mat) => {
      let emissiveIntensity = 0.06;

      if (powerState === "intro") emissiveIntensity = 0.09;

      if (powerState === "flicker") {
        emissiveIntensity =
          Math.sin(t * 28) > 0.3
            ? 0.085
            : Math.sin(t * 16) > -0.05
              ? 0.04
              : 0.012;
      }

      if (powerState === "lamp") emissiveIntensity = 0.02;

      mat.emissiveIntensity = emissiveIntensity;
    });
  });

  return (
    <>
      <mesh
        position={[-17, 0.15, -0.3]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[17.2, 18, 180, 160]} />
        <meshStandardMaterial
          ref={leftRef}
          map={textures.colorMap}
          bumpMap={textures.bumpMap}
          bumpScale={0.14}
          displacementMap={textures.displacementMap}
          displacementScale={0.18}
          displacementBias={-0.008}
          color="#9f625c"
          roughness={1}
          metalness={0}
          emissive="#241011"
          emissiveIntensity={0.06}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh
        position={[17, 0.15, -0.3]}
        rotation={[0, -Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[17.2, 18, 180, 160]} />
        <meshStandardMaterial
          ref={rightRef}
          map={textures.colorMap}
          bumpMap={textures.bumpMap}
          bumpScale={0.14}
          displacementMap={textures.displacementMap}
          displacementScale={0.18}
          displacementBias={-0.008}
          color="#9f625c"
          roughness={1}
          metalness={0}
          emissive="#241011"
          emissiveIntensity={0.06}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}

function Floor() {
  const tile = useMemo(() => createTileTextures(), []);

  return (
    <mesh
      position={[0, -6.1, -0.2]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[40, 24, 260, 180]} />
      <meshStandardMaterial
        map={tile.colorMap}
        bumpMap={tile.bumpMap}
        bumpScale={0.16}
        displacementMap={tile.displacementMap}
        displacementScale={0.085}
        displacementBias={-0.01}
        color="#374252"
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

function getMeshWidth(ref) {
  if (!ref.current) return 0;
  ref.current.geometry.computeBoundingBox();
  const box = ref.current.geometry.boundingBox;
  return box ? box.max.x - box.min.x : 0;
}

function TextBlock({ powerState, introProgress }) {
  const rootRef = useRef(null);

  const dustinRef = useRef(null);
  const buildsRef = useRef(null);
  const digitalRef = useRef(null);
  const expRef = useRef(null);

  const [layoutReady, setLayoutReady] = useState(false);
  const [positions, setPositions] = useState({
    dustinX: -10,
    buildsX: -10,
    digitalX: -4,
    expX: -10,
  });

  const lineY1 = 1.72;
  const lineY2 = -0.18;
  const lineY3 = -1.95;
  const wordGap = 0.46;

  const baseColor = powerState === "lamp" ? "#d7d5d1" : "#e2e8f4";
  const accentColor = powerState === "lamp" ? "#7ce6f5" : "#9bf6ff";
  const baseEmissive = powerState === "lamp" ? "#0b1220" : "#1b2d49";
  const baseEmissiveIntensity = powerState === "lamp" ? 0.018 : 0.07;
  const accentEmissiveIntensity = powerState === "lamp" ? 0.11 : 0.22;

  const sharedMaterial = useMemo(
    () => ({
      roughness: 0.94,
      metalness: 0,
    }),
    []
  );

  useLayoutEffect(() => {
    const timer = window.setTimeout(() => {
      const buildsWidth = getMeshWidth(buildsRef);
      const digitalWidth = getMeshWidth(digitalRef);

      const digitalX = -digitalWidth / 2;
      const buildsX = digitalX - wordGap - buildsWidth;
      const leftAlignedX = buildsX;

      setPositions({
        dustinX: leftAlignedX,
        buildsX,
        digitalX,
        expX: leftAlignedX,
      });

      setLayoutReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useFrame((_, delta) => {
    if (!rootRef.current) return;

    const introYOffset = THREE.MathUtils.lerp(0.65, 0, introProgress);
    rootRef.current.position.y = THREE.MathUtils.damp(
      rootRef.current.position.y,
      introYOffset,
      10,
      delta
    );
  });

  return (
    <group ref={rootRef} position={[0, 0.12, -0.45]} visible={layoutReady}>
      <group position={[positions.dustinX, lineY1, 0]}>
        <Text3D
          ref={dustinRef}
          font={FONT_URL}
          size={1.18}
          height={0.34}
          curveSegments={10}
          bevelEnabled
          bevelThickness={0.02}
          bevelSize={0.018}
          bevelOffset={0}
          bevelSegments={5}
          scale={[1.08, 1, 1]}
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

      <group position={[positions.buildsX, lineY2, 0]}>
        <Text3D
          ref={buildsRef}
          font={FONT_URL}
          size={1.02}
          height={0.3}
          curveSegments={10}
          bevelEnabled
          bevelThickness={0.018}
          bevelSize={0.016}
          bevelOffset={0}
          bevelSegments={5}
          scale={[1.08, 1, 1]}
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

      <group position={[positions.digitalX, lineY2, 0]}>
        <Text3D
          ref={digitalRef}
          font={FONT_URL}
          size={1.02}
          height={0.3}
          curveSegments={10}
          bevelEnabled
          bevelThickness={0.018}
          bevelSize={0.016}
          bevelOffset={0}
          bevelSegments={5}
          scale={[1.08, 1, 1]}
          castShadow
          receiveShadow
        >
          digital
          <meshStandardMaterial
            color={accentColor}
            emissive="#57e9ff"
            emissiveIntensity={accentEmissiveIntensity}
            roughness={0.9}
            metalness={0}
          />
        </Text3D>
      </group>

      <group position={[positions.expX, lineY3, 0]}>
        <Text3D
          ref={expRef}
          font={FONT_URL}
          size={1.18}
          height={0.34}
          curveSegments={10}
          bevelEnabled
          bevelThickness={0.02}
          bevelSize={0.018}
          bevelOffset={0}
          bevelSegments={5}
          scale={[1.08, 1, 1]}
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
  const { scene, gl } = useThree();

  const ambientRef = useRef(null);
  const wallWashRef = useRef(null);
  const spotRef = useRef(null);

  const spotTarget = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    scene.add(spotTarget);
    return () => scene.remove(spotTarget);
  }, [scene, spotTarget]);

  useEffect(() => {
    if (!spotRef.current) return;
    spotRef.current.target = spotTarget;
  }, [spotTarget]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (ambientRef.current) {
      let ambient = 0.14;

      if (powerState === "intro") ambient = 0.2;

      if (powerState === "flicker") {
        ambient =
          Math.sin(t * 28) > 0.32
            ? 0.13
            : Math.sin(t * 16) > -0.1
              ? 0.05
              : 0.015;
      }

      if (powerState === "lamp") ambient = 0.022;

      ambientRef.current.intensity = ambient;
    }

    if (wallWashRef.current) {
      let fill = 0.7;

      if (powerState === "intro") fill = 0.95;

      if (powerState === "flicker") {
        fill =
          Math.sin(t * 22) > 0.28
            ? 0.62
            : Math.sin(t * 13) > -0.06
              ? 0.22
              : 0.04;
      }

      if (powerState === "lamp") fill = 0.045;

      wallWashRef.current.intensity = fill;
    }

    if (spotRef.current) {
      const targetX = THREE.MathUtils.clamp(pointer.x * 13.5, -13.5, 13.5);
      const targetY = THREE.MathUtils.clamp(pointer.y * 6.5, -6.5, 6.5);

      const lampX = THREE.MathUtils.clamp(pointer.x * 1.8, -1.8, 1.8);
      const lampY = THREE.MathUtils.clamp(pointer.y * 1.2, -1.2, 1.2) + 0.3;

      spotTarget.position.set(targetX, targetY, -8.75);
      spotTarget.updateMatrixWorld(true);

      spotRef.current.position.set(lampX, lampY, 11.8);
      spotRef.current.target = spotTarget;
      spotRef.current.intensity = powerState === "lamp" ? 980 : 0;

      // kleinerer Lichtkegel
      spotRef.current.angle = 0.22;
      spotRef.current.penumbra = 0.2;
      spotRef.current.distance = 78;
      spotRef.current.decay = 1.08;

      spotRef.current.shadow.camera.near = 6;
      spotRef.current.shadow.camera.far = 34;
      spotRef.current.shadow.focus = 1;
      spotRef.current.shadow.bias = -0.00012;
      spotRef.current.shadow.normalBias = 0.02;
      spotRef.current.shadow.radius = 1.1;
      spotRef.current.shadow.needsUpdate = true;
      spotRef.current.shadow.camera.updateProjectionMatrix();

      gl.shadowMap.needsUpdate = true;
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.14} color="#8ea0b8" />

      <pointLight
        ref={wallWashRef}
        position={[0, 1.2, -5.7]}
        color="#4f2523"
        intensity={0.7}
        distance={28}
        decay={1.8}
      />

      <spotLight
        ref={spotRef}
        position={[0, 0.3, 11.8]}
        color="#f4fcff"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-bias={-0.00012}
        shadow-normalBias={0.02}
      />
    </>
  );
}

function Scene({ powerState, pointer, introProgress }) {
  return (
    <>
      <fog attach="fog" args={["#02050b", 11, 32]} />
      <BackWall powerState={powerState} />
      <SideWalls powerState={powerState} />
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
            gl={{
              antialias: true,
              physicallyCorrectLights: true,
            }}
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