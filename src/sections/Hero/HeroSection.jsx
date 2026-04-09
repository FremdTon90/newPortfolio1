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

      btx.fillStyle = "#d7d7d7";
      btx.fillRect(px, y, brickW, brickH);
      btx.fillStyle = "#efefef";
      btx.fillRect(px + 1, y + 1, brickW - 2, 2);
      btx.fillStyle = "#939393";
      btx.fillRect(px, y + brickH - 3, brickW, 3);

      dtx.fillStyle = "#ececec";
      dtx.fillRect(px, y, brickW, brickH);
      dtx.fillStyle = "#fafafa";
      dtx.fillRect(px + 1, y + 1, brickW - 2, 2);
      dtx.fillStyle = "#9a9a9a";
      dtx.fillRect(px, y + brickH - 3, brickW, 3);
    }
  }

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

function createCheckerFloorTextures() {
  const width = 2400;
  const height = 1800;

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

  ctx.fillStyle = "#0a0d11";
  ctx.fillRect(0, 0, width, height);

  btx.fillStyle = "#7d7d7d";
  btx.fillRect(0, 0, width, height);

  dtx.fillStyle = "#626262";
  dtx.fillRect(0, 0, width, height);

  const tile = 140;
  const grout = 10;
  const cols = Math.ceil(width / tile);
  const rows = Math.ceil(height / tile);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = col * tile;
      const y = row * tile;

      const isLight = (row + col) % 2 === 0;
      const shade = isLight ? 72 + Math.random() * 3 : 18 + Math.random() * 3;

      ctx.fillStyle = `hsl(0 0% ${shade}%)`;
      ctx.fillRect(x + grout / 2, y + grout / 2, tile - grout, tile - grout);

      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(x + grout / 2, y + grout / 2, tile - grout, 2);

      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(x + grout / 2, y + tile - grout - 3, tile - grout, 3);
      ctx.fillRect(x + tile - grout - 3, y + grout / 2, 3, tile - grout);

      for (let i = 0; i < 18; i++) {
        const nx = x + grout / 2 + Math.random() * (tile - grout);
        const ny = y + grout / 2 + Math.random() * (tile - grout);
        const a = 0.008 + Math.random() * 0.016;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(nx, ny, 2, 2);
      }

      btx.fillStyle = "#e2e2e2";
      btx.fillRect(x + grout / 2, y + grout / 2, tile - grout, tile - grout);

      btx.fillStyle = "#505050";
      btx.fillRect(x, y, tile, grout);
      btx.fillRect(x, y, grout, tile);

      dtx.fillStyle = "#f6f6f6";
      dtx.fillRect(x + grout / 2, y + grout / 2, tile - grout, tile - grout);

      dtx.fillStyle = "#262626";
      dtx.fillRect(x, y, tile, grout);
      dtx.fillRect(x, y, grout, tile);
    }
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

function createSoftBeamTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.03,
    size / 2,
    size / 2,
    size * 0.5
  );

  gradient.addColorStop(0, "rgba(255,255,255,0.38)");
  gradient.addColorStop(0.16, "rgba(255,255,255,0.22)");
  gradient.addColorStop(0.36, "rgba(255,255,255,0.11)");
  gradient.addColorStop(0.66, "rgba(255,255,255,0.04)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createNeonArrowTextures() {
  const width = 1024;
  const height = 1024;

  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = width;
  colorCanvas.height = height;
  const ctx = colorCanvas.getContext("2d");

  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = width;
  glowCanvas.height = height;
  const gtx = glowCanvas.getContext("2d");

  const drawArrow = (context, stroke, lineWidth, shadowBlur = 0, shadowColor = "") => {
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate(Math.PI / 2); // 90° drehen => nach unten
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = stroke;
    context.lineWidth = lineWidth;
    if (shadowBlur > 0) {
      context.shadowBlur = shadowBlur;
      context.shadowColor = shadowColor;
    }

    context.beginPath();
    context.moveTo(-220, -40);
    context.lineTo(50, -40);
    context.lineTo(50, -120);
    context.lineTo(250, 0);
    context.lineTo(50, 120);
    context.lineTo(50, 40);
    context.lineTo(-220, 40);
    context.stroke();

    context.restore();
  };

  ctx.clearRect(0, 0, width, height);
  gtx.clearRect(0, 0, width, height);

  drawArrow(gtx, "rgba(255,50,50,0.78)", 110, 72, "rgba(255,20,20,0.98)");
  drawArrow(gtx, "rgba(255,80,80,0.52)", 64, 34, "rgba(255,40,40,0.85)");

  drawArrow(ctx, "#ff3a3a", 38);
  drawArrow(ctx, "#ffe0e0", 16);

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.wrapS = THREE.ClampToEdgeWrapping;
  colorMap.wrapT = THREE.ClampToEdgeWrapping;
  colorMap.needsUpdate = true;

  const glowMap = new THREE.CanvasTexture(glowCanvas);
  glowMap.wrapS = THREE.ClampToEdgeWrapping;
  glowMap.wrapT = THREE.ClampToEdgeWrapping;
  glowMap.needsUpdate = true;

  return { colorMap, glowMap };
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
    <mesh position={[0, 0.15, -12.8]} receiveShadow>
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
        position={[-17, 0.15, -4.6]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[18.6, 18, 180, 160]} />
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
        position={[17, 0.15, -4.6]}
        rotation={[0, -Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[18.6, 18, 180, 160]} />
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
  const tile = useMemo(() => createCheckerFloorTextures(), []);

  return (
    <mesh
      position={[0, -6.1, -2.6]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[42, 34, 340, 260]} />
      <meshStandardMaterial
        map={tile.colorMap}
        bumpMap={tile.bumpMap}
        bumpScale={0.32}
        displacementMap={tile.displacementMap}
        displacementScale={0.18}
        displacementBias={-0.026}
        color="#ffffff"
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

function SoftBeamWall({ pointer, powerState }) {
  const beamRef = useRef(null);
  const beamTexture = useMemo(() => createSoftBeamTexture(), []);

  useFrame((_, delta) => {
    if (!beamRef.current) return;

    const targetX = THREE.MathUtils.clamp(pointer.x * 13.5, -13.5, 13.5);
    const targetY = THREE.MathUtils.clamp(pointer.y * 6.5, -6.5, 6.5);

    beamRef.current.position.x = THREE.MathUtils.damp(
      beamRef.current.position.x,
      targetX,
      8,
      delta
    );
    beamRef.current.position.y = THREE.MathUtils.damp(
      beamRef.current.position.y,
      targetY,
      8,
      delta
    );
    beamRef.current.position.z = -12.68;

    const targetOpacity = powerState === "lamp" ? 0.16 : 0;
    beamRef.current.material.opacity = THREE.MathUtils.damp(
      beamRef.current.material.opacity,
      targetOpacity,
      7,
      delta
    );
  });

  return (
    <mesh ref={beamRef} position={[0, 0, -12.68]} renderOrder={2}>
      <planeGeometry args={[11.8, 11.8]} />
      <meshBasicMaterial
        map={beamTexture}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color="#eefaff"
      />
    </mesh>
  );
}

function SoftBeamFloor({ pointer, powerState }) {
  const beamRef = useRef(null);
  const beamTexture = useMemo(() => createSoftBeamTexture(), []);

  useFrame((_, delta) => {
    if (!beamRef.current) return;

    const targetX = THREE.MathUtils.clamp(pointer.x * 5.2, -5.2, 5.2);
    const targetZ = THREE.MathUtils.clamp(pointer.y * 1.6, -2.8, 1.2);

    beamRef.current.position.x = THREE.MathUtils.damp(
      beamRef.current.position.x,
      targetX,
      8,
      delta
    );
    beamRef.current.position.z = THREE.MathUtils.damp(
      beamRef.current.position.z,
      -1.8 + targetZ,
      8,
      delta
    );

    const targetOpacity = powerState === "lamp" ? 0.12 : 0;
    beamRef.current.material.opacity = THREE.MathUtils.damp(
      beamRef.current.material.opacity,
      targetOpacity,
      7,
      delta
    );
  });

  return (
    <mesh
      ref={beamRef}
      position={[0, -6.02, -1.8]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={2}
    >
      <planeGeometry args={[11, 8.4]} />
      <meshBasicMaterial
        map={beamTexture}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color="#f0f8ff"
      />
    </mesh>
  );
}

function NeonArrowSign({ visible }) {
  const groupRef = useRef(null);
  const frontRef = useRef(null);
  const glowRef = useRef(null);
  const lightRef = useRef(null);
  const textures = useMemo(() => createNeonArrowTextures(), []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const t = state.clock.getElapsedTime();
    const flicker =
      visible && t < 2.3 ? (Math.sin(t * 46) > 0.12 ? 1 : 0.76) : 1;

    groupRef.current.position.y = 1.28 + Math.sin(t * 2.1) * (visible ? 0.04 : 0);

    groupRef.current.scale.x = THREE.MathUtils.damp(
      groupRef.current.scale.x,
      visible ? 1.28 : 0.92,
      9,
      delta
    );
    groupRef.current.scale.y = THREE.MathUtils.damp(
      groupRef.current.scale.y,
      visible ? 1.28 : 0.92,
      9,
      delta
    );
    groupRef.current.scale.z = THREE.MathUtils.damp(
      groupRef.current.scale.z,
      visible ? 1.28 : 0.92,
      9,
      delta
    );

    if (frontRef.current?.material) {
      frontRef.current.material.opacity = THREE.MathUtils.damp(
        frontRef.current.material.opacity,
        visible ? 1 : 0,
        9,
        delta
      );
    }

    if (glowRef.current?.material) {
      glowRef.current.material.opacity = THREE.MathUtils.damp(
        glowRef.current.material.opacity,
        visible ? 0.88 * flicker : 0,
        8,
        delta
      );
    }

    if (lightRef.current) {
      lightRef.current.intensity = THREE.MathUtils.damp(
        lightRef.current.intensity,
        visible ? 4.2 * flicker : 0,
        10,
        delta
      );
    }
  });

  return (
    <group
      ref={groupRef}
      position={[11.9, 1.28, -12.18]}
      rotation={[0, -0.28, 0]}
      scale={0.92}
    >
      <mesh ref={glowRef} position={[0, 0, -0.14]} renderOrder={3}>
        <planeGeometry args={[4.6, 4.6]} />
        <meshBasicMaterial
          map={textures.glowMap}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          color="#ff3d3d"
        />
      </mesh>

      <mesh ref={frontRef} position={[0, 0, 0.02]} castShadow receiveShadow renderOrder={4}>
        <planeGeometry args={[2.35, 2.35]} />
        <meshBasicMaterial
          map={textures.colorMap}
          transparent
          opacity={0}
          depthWrite={false}
          color="#ffffff"
        />
      </mesh>

      <mesh position={[0, 0, 0.12]}>
        <boxGeometry args={[0.03, 0.36, 0.03]} />
        <meshStandardMaterial
          color="#9a9a9a"
          roughness={0.8}
          metalness={0.12}
        />
      </mesh>

      <pointLight
        ref={lightRef}
        position={[0, 0, 0.35]}
        color="#ff3a3a"
        intensity={0}
        distance={12}
        decay={1.8}
      />
    </group>
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
    <group ref={rootRef} position={[0, 0.12, -1.05]} visible={layoutReady}>
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

function PowerLights({ powerState, pointer, showArrow }) {
  const { scene, gl } = useThree();

  const ambientRef = useRef(null);
  const wallWashRef = useRef(null);
  const spotRef = useRef(null);
  const neonBounceRef = useRef(null);

  const spotTarget = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    scene.add(spotTarget);
    return () => scene.remove(spotTarget);
  }, [scene, spotTarget]);

  useEffect(() => {
    if (!spotRef.current) return;
    spotRef.current.target = spotTarget;
  }, [spotTarget]);

  useFrame((state, delta) => {
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

      spotTarget.position.x = THREE.MathUtils.damp(
        spotTarget.position.x,
        targetX,
        16,
        delta
      );
      spotTarget.position.y = THREE.MathUtils.damp(
        spotTarget.position.y,
        targetY,
        16,
        delta
      );
      spotTarget.position.z = -12.75;
      spotTarget.updateMatrixWorld(true);

      spotRef.current.position.x = THREE.MathUtils.damp(
        spotRef.current.position.x,
        lampX,
        16,
        delta
      );
      spotRef.current.position.y = THREE.MathUtils.damp(
        spotRef.current.position.y,
        lampY,
        16,
        delta
      );
      spotRef.current.position.z = 11.8;

      spotRef.current.target = spotTarget;
      spotRef.current.intensity = powerState === "lamp" ? 920 : 0;
      spotRef.current.angle = 0.24;
      spotRef.current.penumbra = 0.92;
      spotRef.current.distance = 92;
      spotRef.current.decay = 1.04;

      spotRef.current.shadow.camera.near = 6;
      spotRef.current.shadow.camera.far = 40;
      spotRef.current.shadow.focus = 1;
      spotRef.current.shadow.bias = -0.00012;
      spotRef.current.shadow.normalBias = 0.02;
      spotRef.current.shadow.radius = 1.1;
      spotRef.current.shadow.needsUpdate = true;
      spotRef.current.shadow.camera.updateProjectionMatrix();

      gl.shadowMap.needsUpdate = true;
    }

    if (neonBounceRef.current) {
      const target = showArrow ? 1.05 : 0;
      neonBounceRef.current.intensity = THREE.MathUtils.damp(
        neonBounceRef.current.intensity,
        target,
        8,
        delta
      );
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.14} color="#8ea0b8" />

      <pointLight
        ref={wallWashRef}
        position={[0, 1.2, -7.9]}
        color="#4f2523"
        intensity={0.7}
        distance={34}
        decay={1.8}
      />

      <pointLight
        ref={neonBounceRef}
        position={[11.55, 1.25, -11.25]}
        color="#ff3b3b"
        intensity={0}
        distance={13}
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

function Scene({ powerState, pointer, introProgress, showArrow }) {
  return (
    <>
      <fog attach="fog" args={["#02050b", 11, 44]} />
      <BackWall powerState={powerState} />
      <SideWalls powerState={powerState} />
      <Floor />
      <SoftBeamWall pointer={pointer} powerState={powerState} />
      <SoftBeamFloor pointer={pointer} powerState={powerState} />
      <NeonArrowSign visible={showArrow} />
      <PowerLights powerState={powerState} pointer={pointer} showArrow={showArrow} />
      <TextBlock powerState={powerState} introProgress={introProgress} />
    </>
  );
}

export default function HeroSection() {
  const sectionRef = useRef(null);
  const [powerState, setPowerState] = useState("intro");
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [introProgress, setIntroProgress] = useState(0);
  const [showArrow, setShowArrow] = useState(false);

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

    const arrowTimer = window.setTimeout(() => {
      setShowArrow(true);
    }, 1000);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(flickerTimer);
      window.clearTimeout(lampTimer);
      window.clearTimeout(arrowTimer);
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
      // letzte Position behalten
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
                showArrow={showArrow}
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