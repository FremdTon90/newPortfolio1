import React, {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text3D, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import bricksWallTexture from "../../assets/images/textures/bricks.png";
import checkerFloorDiffuse from "../../assets/images/textures/checker_floor_diffuse.png";
import checkerFloorNormal from "../../assets/images/textures/checker_floor_normal.png";
import checkerFloorRoughness from "../../assets/images/textures/checker_floor_roughness.png";
import "./HeroSection.css";

const BRICKS_WALL_URL = bricksWallTexture;
const CHECKER_FLOOR_DIFFUSE_URL = checkerFloorDiffuse;
const CHECKER_FLOOR_NORMAL_URL = checkerFloorNormal;
const CHECKER_FLOOR_ROUGHNESS_URL = checkerFloorRoughness;
const FONT_URL = `${import.meta.env.BASE_URL}fonts/helvetiker_bold.typeface.json`;
const SIGN_URL = `${import.meta.env.BASE_URL}models/neon_open_sign.glb`;
const LAMP_WALL_URL = `${import.meta.env.BASE_URL}models/lampWall.glb`
const WALL_LAMP_CONFIG = {
  lampPosition: [-16.96, 1.78, -8.45],
  lampRotation: [0, Math.PI / 2, 0],
  lampScale: 2.5,

  modelOffset: [0, 0, 0],

  bounceOffsetFromBulb: [0.0, 0.06, -0.22],
  fillOffsetFromBulb: [0.42, -0.12, 0.06],

  bulbIntensity: 82,
  bounceIntensity: 14,
  fillIntensity: 5.5,

  bulbDistance: 20,
  bounceDistance: 18,
  fillDistance: 21,

  bulbDecay: 1.3,
  bounceDecay: 1.5,
  fillDecay: 1.65,

  glowInnerOpacity: 0.34,
  glowOuterOpacity: 0.16,

  showLightHelper: false,
  helperSize: 0.02,
};

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
   Texture helpers
----------------------------- */

function createColorTextureFromCanvas(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(1, 1);
  tex.anisotropy = 8;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createDataTextureFromCanvas(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(1, 1);
  tex.anisotropy = 8;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function drawSoftBlob(ctx, x, y, rx, ry, colorStops) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);

  const grad = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 1);
  colorStops.forEach(([stop, color]) => grad.addColorStop(stop, color));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function addSpeckleNoise(ctx, width, height, count, alphaMin, alphaMax, dark = false) {
  for (let i = 0; i < count; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = 0.7 + Math.random() * 1.5;
    const a = alphaMin + Math.random() * (alphaMax - alphaMin);

    ctx.fillStyle = dark
      ? `rgba(0,0,0,${a})`
      : `rgba(255,255,255,${a})`;

    ctx.fillRect(x, y, size, size);
  }
}

function drawFineScratches(ctx, areaX, areaY, areaW, areaH, count, alpha = 0.05) {
  ctx.save();
  for (let i = 0; i < count; i += 1) {
    const x = areaX + Math.random() * areaW;
    const y = areaY + Math.random() * areaH;
    const len = 6 + Math.random() * 18;
    const angle = (-0.6 + Math.random() * 1.2) * 0.35;
    const dx = Math.cos(angle) * len;
    const dy = Math.sin(angle) * len;

    ctx.strokeStyle = `rgba(255,255,255,${alpha * (0.65 + Math.random() * 0.7)})`;
    ctx.lineWidth = 0.4 + Math.random() * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
  }
  ctx.restore();
}

function createNormalMapFromHeightCanvas(heightCanvas, strength = 2.2) {
  const srcCtx = heightCanvas.getContext("2d");
  const { width, height } = heightCanvas;
  const src = srcCtx.getImageData(0, 0, width, height);
  const out = srcCtx.createImageData(width, height);

  const get = (x, y) => {
    const ix = Math.max(0, Math.min(width - 1, x));
    const iy = Math.max(0, Math.min(height - 1, y));
    const i = (iy * width + ix) * 4;
    return src.data[i] / 255;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const l = get(x - 1, y);
      const r = get(x + 1, y);
      const u = get(x, y - 1);
      const d = get(x, y + 1);

      const dx = (l - r) * strength;
      const dy = (u - d) * strength;
      const dz = 1.0;

      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const nx = dx / len;
      const ny = dy / len;
      const nz = dz / len;

      const i = (y * width + x) * 4;
      out.data[i] = (nx * 0.5 + 0.5) * 255;
      out.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      out.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(out, 0, 0);

  return createDataTextureFromCanvas(canvas);
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

  const heightCanvas = document.createElement("canvas");
  heightCanvas.width = width;
  heightCanvas.height = height;
  const htx = heightCanvas.getContext("2d");

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = width;
  roughCanvas.height = height;
  const rtx = roughCanvas.getContext("2d");

  const mortarColor = "#180c0c";

  ctx.fillStyle = mortarColor;
  ctx.fillRect(0, 0, width, height);

  htx.fillStyle = "#5d5d5d";
  htx.fillRect(0, 0, width, height);

  rtx.fillStyle = "#dfdfdf";
  rtx.fillRect(0, 0, width, height);

  const brickW = 128;
  const brickH = 52;
  const mortar = 8;
  const rowStep = brickH + mortar;

  for (let row = 0, y = 0; y < height + brickH; row += 1, y += rowStep) {
    const offset = row % 2 === 1 ? brickW / 2 : 0;

    for (let x = -brickW; x < width + brickW; x += brickW + mortar) {
      const px = x + offset;
      const py = y;

      const hue = 7 + Math.random() * 7;
      const sat = 22 + Math.random() * 16;
      const light = 18 + Math.random() * 9;

      const grad = ctx.createLinearGradient(px, py, px, py + brickH);
      grad.addColorStop(0, `hsl(${hue} ${sat}% ${light + 3}%)`);
      grad.addColorStop(0.5, `hsl(${hue + (Math.random() * 1.5 - 0.75)} ${sat}% ${light}%)`);
      grad.addColorStop(1, `hsl(${hue + 1} ${Math.max(12, sat - 2)}% ${Math.max(8, light - 4)}%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(px, py, brickW, brickH);

      const broadShade = ctx.createRadialGradient(
        px + brickW * 0.5,
        py + brickH * 0.5,
        brickW * 0.08,
        px + brickW * 0.5,
        py + brickH * 0.5,
        brickW * 0.75
      );
      broadShade.addColorStop(0, "rgba(0,0,0,0)");
      broadShade.addColorStop(1, "rgba(0,0,0,0.10)");
      ctx.fillStyle = broadShade;
      ctx.fillRect(px, py, brickW, brickH);

      ctx.fillStyle = "rgba(255,235,230,0.04)";
      ctx.fillRect(px + 1, py + 1, brickW - 2, 2);

      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.fillRect(px, py + brickH - 3, brickW, 3);

      for (let i = 0; i < 5; i += 1) {
        drawSoftBlob(
          ctx,
          px + 12 + Math.random() * (brickW - 24),
          py + 10 + Math.random() * (brickH - 20),
          8 + Math.random() * 18,
          5 + Math.random() * 10,
          [
            [0, `rgba(255,220,210,${0.018 + Math.random() * 0.018})`],
            [1, "rgba(255,220,210,0)"],
          ]
        );
      }

      for (let i = 0; i < 4; i += 1) {
        drawSoftBlob(
          ctx,
          px + 12 + Math.random() * (brickW - 24),
          py + 10 + Math.random() * (brickH - 20),
          8 + Math.random() * 18,
          5 + Math.random() * 10,
          [
            [0, `rgba(0,0,0,${0.018 + Math.random() * 0.02})`],
            [1, "rgba(0,0,0,0)"],
          ]
        );
      }

      for (let i = 0; i < 18; i += 1) {
        const nx = px + Math.random() * brickW;
        const ny = py + Math.random() * brickH;
        ctx.fillStyle = `rgba(255,240,235,${0.01 + Math.random() * 0.018})`;
        ctx.fillRect(nx, ny, 1.5, 1.5);
      }

      htx.fillStyle = "#cbcbcb";
      htx.fillRect(px, py, brickW, brickH);

      htx.fillStyle = "#dadada";
      htx.fillRect(px + 1, py + 1, brickW - 2, 2);

      htx.fillStyle = "#afafaf";
      htx.fillRect(px, py + brickH - 3, brickW, 3);

      for (let i = 0; i < 4; i += 1) {
        drawSoftBlob(
          htx,
          px + 12 + Math.random() * (brickW - 24),
          py + 10 + Math.random() * (brickH - 20),
          6 + Math.random() * 12,
          4 + Math.random() * 8,
          [
            [0, `rgba(220,220,220,${0.10 + Math.random() * 0.08})`],
            [1, "rgba(220,220,220,0)"],
          ]
        );
      }

      const roughBase = 160 + Math.floor(Math.random() * 18);
      rtx.fillStyle = `rgb(${roughBase},${roughBase},${roughBase})`;
      rtx.fillRect(px, py, brickW, brickH);

      for (let i = 0; i < 4; i += 1) {
        const value = 138 + Math.floor(Math.random() * 24);
        drawSoftBlob(
          rtx,
          px + 12 + Math.random() * (brickW - 24),
          py + 10 + Math.random() * (brickH - 20),
          8 + Math.random() * 20,
          5 + Math.random() * 10,
          [
            [0, `rgba(${value},${value},${value},0.32)`],
            [1, `rgba(${value},${value},${value},0)`],
          ]
        );
      }
    }
  }

  for (let y = brickH; y < height; y += rowStep) {
    htx.fillStyle = "#666666";
    htx.fillRect(0, y, width, mortar);

    rtx.fillStyle = "#eeeeee";
    rtx.fillRect(0, y, width, mortar);
  }

  addSpeckleNoise(ctx, width, height, 2200, 0.004, 0.014, false);
  addSpeckleNoise(ctx, width, height, 1800, 0.004, 0.012, true);

  addSpeckleNoise(rtx, width, height, 1600, 0.012, 0.032, true);

  const colorMap = createColorTextureFromCanvas(colorCanvas);
  const bumpMap = createDataTextureFromCanvas(heightCanvas);
  const roughnessMap = createDataTextureFromCanvas(roughCanvas);
  const normalMap = createNormalMapFromHeightCanvas(heightCanvas, 2.7);

  return {
    colorMap,
    bumpMap,
    roughnessMap,
    normalMap,
    mortarColor,
  };
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
    size * 0.015,
    size / 2,
    size / 2,
    size * 0.5
  );

  gradient.addColorStop(0, "rgba(255,255,255,0.16)");
  gradient.addColorStop(0.06, "rgba(255,255,255,0.145)");
  gradient.addColorStop(0.16, "rgba(255,255,255,0.12)");
  gradient.addColorStop(0.32, "rgba(255,255,255,0.082)");
  gradient.addColorStop(0.58, "rgba(255,255,255,0.034)");
  gradient.addColorStop(0.82, "rgba(255,255,255,0.012)");
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

function createGlowTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.04,
    size / 2,
    size / 2,
    size * 0.5
  );

  gradient.addColorStop(0, "rgba(255,120,100,1)");
  gradient.addColorStop(0.08, "rgba(255,105,90,0.95)");
  gradient.addColorStop(0.22, "rgba(255,82,72,0.68)");
  gradient.addColorStop(0.42, "rgba(255,66,60,0.3)");
  gradient.addColorStop(0.68, "rgba(255,54,48,0.1)");
  gradient.addColorStop(1, "rgba(255,44,40,0)");

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/* -----------------------------
   Geladene Wandtextur + prozedurale Detailmaps
----------------------------- */

function useWallBrickTextures(repeatX = 1, repeatY = 1) {
  const wallColorTexture = useTexture(BRICKS_WALL_URL);
  const detailTextures = useMemo(() => createBrickTextures(), []);

  return useMemo(() => {
    const setupTexture = (source, isColor = false) => {
      const tex = source.clone();
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
      tex.anisotropy = 8;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    };

    return {
      colorMap: setupTexture(wallColorTexture, true),
      bumpMap: setupTexture(detailTextures.bumpMap),
      roughnessMap: setupTexture(detailTextures.roughnessMap),
      normalMap: setupTexture(detailTextures.normalMap),
    };
  }, [wallColorTexture, detailTextures, repeatX, repeatY]);
}

function useCheckerFloorTextures(repeatX = 6, repeatY = 5) {
  const [colorMap, normalMap, roughnessMap] = useTexture([
    CHECKER_FLOOR_DIFFUSE_URL,
    CHECKER_FLOOR_NORMAL_URL,
    CHECKER_FLOOR_ROUGHNESS_URL,
  ]);

  return useMemo(() => {
    const setupTexture = (source, isColor = false) => {
      const tex = source.clone();
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
      tex.anisotropy = 8;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    };

    return {
      colorMap: setupTexture(colorMap, true),
      normalMap: setupTexture(normalMap, false),
      roughnessMap: setupTexture(roughnessMap, false),
    };
  }, [colorMap, normalMap, roughnessMap, repeatX, repeatY]);
}

/* -----------------------------
   Scene parts
----------------------------- */

function BrickMaterial({
  powerState,
  textures,
  materialRef,
  color = "#ffffff",
  emissive = "#2a0f10",
}) {
  useFrame((state) => {
    if (!materialRef.current) return;

    const t = state.clock.getElapsedTime();
    let emissiveIntensity = 0.08;

    if (powerState === "intro") emissiveIntensity = 0.11;

    if (powerState === "flicker") {
      emissiveIntensity =
        Math.sin(t * 34) > 0.35
          ? 0.1
          : Math.sin(t * 18) > -0.1
            ? 0.045
            : 0.018;
    }

    if (powerState === "lamp") emissiveIntensity = 0.025;

    materialRef.current.emissiveIntensity = emissiveIntensity;
  });

  return (
    <meshStandardMaterial
      ref={materialRef}
      map={textures.colorMap}
      bumpMap={textures.bumpMap}
      bumpScale={0.018}
      normalMap={textures.normalMap}
      normalScale={new THREE.Vector2(0.16, 0.16)}
      roughnessMap={textures.roughnessMap}
      color={color}
      roughness={0.88}
      metalness={0}
      emissive={emissive}
      emissiveIntensity={0.08}
    />
  );
}

function BackWall({ powerState }) {
  const wallMaterialRef = useRef(null);
  const textures = useWallBrickTextures(2.89, 1.42);

  return (
    <mesh position={[0, 0.15, -12.8]} receiveShadow>
      <planeGeometry args={[34, 18, 1, 1]} />
      <BrickMaterial
        powerState={powerState}
        textures={textures}
        materialRef={wallMaterialRef}
        color="#ffffff"
        emissive="#241011"
      />
    </mesh>
  );
}

function SideWalls({ powerState }) {
  const leftRef = useRef(null);
  const rightRef = useRef(null);

  const leftTextures = useWallBrickTextures(1.51, 1.42);
  const rightTextures = useWallBrickTextures(1.51, 1.42);

  useFrame((state) => {
    const refs = [leftRef.current, rightRef.current].filter(Boolean);
    const t = state.clock.getElapsedTime();

    refs.forEach((mat) => {
      let emissiveIntensity = 0.04;

      if (powerState === "intro") emissiveIntensity = 0.06;

      if (powerState === "flicker") {
        emissiveIntensity =
          Math.sin(t * 28) > 0.3
            ? 0.06
            : Math.sin(t * 16) > -0.05
              ? 0.028
              : 0.01;
      }

      if (powerState === "lamp") emissiveIntensity = 0.018;

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
        <planeGeometry args={[18.6, 18, 1, 1]} />
        <meshStandardMaterial
          ref={leftRef}
          map={leftTextures.colorMap}
          bumpMap={leftTextures.bumpMap}
          bumpScale={0.018}
          normalMap={leftTextures.normalMap}
          normalScale={new THREE.Vector2(0.16, 0.16)}
          roughnessMap={leftTextures.roughnessMap}
          color="#ffffff"
          roughness={0.96}
          metalness={0}
          emissive="#241011"
          emissiveIntensity={0.04}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh
        position={[17, 0.15, -4.6]}
        rotation={[0, -Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[18.6, 18, 1, 1]} />
        <meshStandardMaterial
          ref={rightRef}
          map={rightTextures.colorMap}
          bumpMap={rightTextures.bumpMap}
          bumpScale={0.018}
          normalMap={rightTextures.normalMap}
          normalScale={new THREE.Vector2(0.16, 0.16)}
          roughnessMap={rightTextures.roughnessMap}
          color="#ffffff"
          roughness={0.96}
          metalness={0}
          emissive="#241011"
          emissiveIntensity={0.04}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}

function Floor() {
  const tile = useCheckerFloorTextures(6, 5);

  return (
    <mesh
      position={[0, -6.1, -2.6]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[42, 34, 1, 1]} />
      <meshPhysicalMaterial
        map={tile.colorMap}
        normalMap={tile.normalMap}
        normalScale={new THREE.Vector2(1.18, 1.18)}
        roughnessMap={tile.roughnessMap}
        color="#ffffff"
        roughness={0.14}
        metalness={0}
        clearcoat={1}
        clearcoatRoughness={0.045}
        reflectivity={1}
        ior={1.52}
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
      5,
      delta
    );
    beamRef.current.position.y = THREE.MathUtils.damp(
      beamRef.current.position.y,
      targetY,
      5,
      delta
    );
    beamRef.current.position.z = -12.66;

    const targetOpacity = powerState === "lamp" ? 0.16 : 0;
    beamRef.current.material.opacity = THREE.MathUtils.damp(
      beamRef.current.material.opacity,
      targetOpacity,
      4.5,
      delta
    );
  });

  return (
    <mesh ref={beamRef} position={[0, 0, -12.66]} renderOrder={1}>
      <planeGeometry args={[12.6, 12.6]} />
      <meshBasicMaterial
        map={beamTexture}
        transparent
        opacity={0}
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        color="#fff4dc"
      />
    </mesh>
  );
}

function SoftBeamFloor({ pointer, powerState }) {
  const beamRef = useRef(null);
  const beamTexture = useMemo(() => createSoftBeamTexture(), []);

  useFrame((_, delta) => {
    if (!beamRef.current) return;

    const targetX = THREE.MathUtils.clamp(pointer.x * 5.5, -5.5, 5.5);
    const targetZ = THREE.MathUtils.clamp(pointer.y * 1.7, -3.1, 1.5);

    beamRef.current.position.x = THREE.MathUtils.damp(
      beamRef.current.position.x,
      targetX,
      5,
      delta
    );
    beamRef.current.position.z = THREE.MathUtils.damp(
      beamRef.current.position.z,
      -1.9 + targetZ,
      5,
      delta
    );

    const targetOpacity = powerState === "lamp" ? 0.035 : 0;
    beamRef.current.material.opacity = THREE.MathUtils.damp(
      beamRef.current.material.opacity,
      targetOpacity,
      4.5,
      delta
    );
  });

  return (
    <mesh
      ref={beamRef}
      position={[0, -6.02, -1.8]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={1}
    >
      <planeGeometry args={[12.2, 9.6]} />
      <meshBasicMaterial
        map={beamTexture}
        transparent
        opacity={0}
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        color="#fff1de"
      />
    </mesh>
  );
}

function createHorrorNeonFlickerController() {
  return {
    mode: "burst-off",
    timer: 0.035,
    burstRemaining: 4,
    currentLevel: 0.18,
    targetLevel: 0.02,
    hardDropChance: 0.12,
  };
}

function updateHorrorNeonFlicker(controller, delta, visible) {
  if (!visible) {
    controller.mode = "off";
    controller.timer = 0;
    controller.burstRemaining = 0;
    controller.currentLevel = 0;
    controller.targetLevel = 0;
    return 0;
  }

  controller.timer -= delta;

  if (controller.timer <= 0) {
    switch (controller.mode) {
      case "off":
        controller.mode = "burst-off";
        controller.burstRemaining = 3 + Math.floor(Math.random() * 3); // 3 - 5
        controller.targetLevel = 0.02 + Math.random() * 0.03;
        controller.timer = 0.02 + Math.random() * 0.03; // 20ms - 50ms
        break;

      case "stable": {
        const shouldHardDrop = Math.random() < controller.hardDropChance;

        if (shouldHardDrop) {
          controller.mode = "hard-off";
          controller.targetLevel = 0.015 + Math.random() * 0.025;
          controller.timer = 0.05 + Math.random() * 0.08; // 50ms - 130ms
        } else {
          controller.mode = "burst-off";
          controller.burstRemaining = 3 + Math.floor(Math.random() * 3); // 3 - 5
          controller.targetLevel = Math.random() < 0.84 ? 0.02 : 0.12;
          controller.timer = 0.018 + Math.random() * 0.03; // 18ms - 48ms
        }
        break;
      }

      case "hard-off":
        controller.mode = "reignite";
        controller.targetLevel = 0.55 + Math.random() * 0.2; // 0.55 - 0.75
        controller.timer = 0.03 + Math.random() * 0.045; // 30ms - 75ms
        break;

      case "reignite":
        controller.mode = "stable";
        controller.targetLevel = 0.95 + Math.random() * 0.05; // 0.95 - 1.00
        controller.timer = 1.8 + Math.random() * 2.8; // 1.8s - 4.6s
        break;

      case "burst-off":
        controller.mode = "burst-on";
        controller.targetLevel = 0.48 + Math.random() * 0.42; // 0.48 - 0.90
        controller.timer = 0.022 + Math.random() * 0.04; // 22ms - 62ms
        break;

      case "burst-on":
        controller.burstRemaining -= 1;

        if (controller.burstRemaining > 0) {
          controller.mode = "burst-off";
          controller.targetLevel = Math.random() < 0.86 ? 0.02 : 0.1;
          controller.timer = 0.016 + Math.random() * 0.035; // 16ms - 51ms
        } else {
          const shakyRecovery = Math.random() < 0.38;

          if (shakyRecovery) {
            controller.mode = "reignite";
            controller.targetLevel = 0.62 + Math.random() * 0.14;
            controller.timer = 0.028 + Math.random() * 0.04; // 28ms - 68ms
          } else {
            controller.mode = "stable";
            controller.targetLevel = 0.96 + Math.random() * 0.04;
            controller.timer = 2.0 + Math.random() * 3.4; // 2.0s - 5.4s
          }
        }
        break;

      default:
        controller.mode = "stable";
        controller.targetLevel = 1;
        controller.timer = 2.2 + Math.random() * 2.6;
        break;
    }
  }

  const dampSpeed =
    controller.targetLevel < controller.currentLevel ? 42 : 24;

  controller.currentLevel = THREE.MathUtils.damp(
    controller.currentLevel,
    controller.targetLevel,
    dampSpeed,
    delta
  );

  return controller.currentLevel;
}

function NeonArrowSign({ visible }) {
  const rootRef = useRef(null);
  const signRef = useRef(null);
  const wallGlowRef = useRef(null);
  const wallGlowOuterRef = useRef(null);
  const floorGlowRef = useRef(null);

  const redWallLightRef = useRef(null);
  const redFloorLightRef = useRef(null);
  const redFrontLightRef = useRef(null);
  const redTextSpillRef = useRef(null);
  const redRoomFillRef = useRef(null);
  const redUpperBounceRef = useRef(null);

  const flickerControllerRef = useRef(createHorrorNeonFlickerController());

  const { scene } = useGLTF(SIGN_URL);
  const glowTexture = useMemo(() => createGlowTexture(), []);

  const signScene = useMemo(() => {
    const cloned = scene.clone(true);

    cloned.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = false;
      child.receiveShadow = false;

      const sourceMaterial = Array.isArray(child.material)
        ? child.material[0]
        : child.material;

      if (!sourceMaterial) return;

      const hasMap = !!sourceMaterial.map;
      const baseColor = sourceMaterial.color
        ? sourceMaterial.color.clone()
        : new THREE.Color("#ffffff");

      const isRedish =
        baseColor.r > baseColor.g * 1.08 && baseColor.r > baseColor.b * 1.08;

      const isVeryDark =
        baseColor.r < 0.18 && baseColor.g < 0.18 && baseColor.b < 0.18;

      let nextMaterial;

      if (isRedish) {
        nextMaterial = new THREE.MeshStandardMaterial({
          map: hasMap ? sourceMaterial.map : null,
          color: hasMap ? "#ffffff" : baseColor,
          emissive: new THREE.Color("#ff5a47"),
          emissiveIntensity: 11.5,
          roughness: 0.08,
          metalness: 0.02,
          transparent: sourceMaterial.transparent ?? false,
          opacity: sourceMaterial.opacity ?? 1,
          side: THREE.DoubleSide,
        });
      } else if (isVeryDark) {
        nextMaterial = new THREE.MeshStandardMaterial({
          map: hasMap ? sourceMaterial.map : null,
          color: hasMap ? "#ffffff" : baseColor,
          emissive: new THREE.Color("#180808"),
          emissiveIntensity: 0.04,
          roughness: 0.92,
          metalness: 0,
          transparent: sourceMaterial.transparent ?? false,
          opacity: sourceMaterial.opacity ?? 1,
          side: THREE.DoubleSide,
        });
      } else {
        nextMaterial = new THREE.MeshStandardMaterial({
          map: hasMap ? sourceMaterial.map : null,
          color: hasMap ? "#ffffff" : baseColor,
          emissive: baseColor.clone().multiplyScalar(0.32),
          emissiveIntensity: 0.4,
          roughness: 0.32,
          metalness: 0.02,
          transparent: sourceMaterial.transparent ?? false,
          opacity: sourceMaterial.opacity ?? 1,
          side: THREE.DoubleSide,
        });
      }

      nextMaterial.depthWrite = true;
      nextMaterial.toneMapped = false;
      child.material = nextMaterial;
    });

    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());

    cloned.position.x -= center.x;
    cloned.position.y -= center.y;
    cloned.position.z -= center.z;

    return cloned;
  }, [scene]);

  const scaleFactor = useMemo(() => {
    const box = new THREE.Box3().setFromObject(signScene);
    const size = box.getSize(new THREE.Vector3());

    const targetWidth = 4.2;
    const safeWidth = Math.max(size.x, 0.001);

    return targetWidth / safeWidth;
  }, [signScene]);

  useFrame((state, delta) => {
    if (!rootRef.current) return;

    const t = state.clock.getElapsedTime();
    const flickerLevel = updateHorrorNeonFlicker(
      flickerControllerRef.current,
      delta,
      visible
    );

    // Minimales Micro-Jitter, damit es nicht digital-perfekt aussieht
    const microJitter =
      visible && flickerLevel > 0.75
        ? 0.97 + Math.sin(t * 19.7) * 0.015 + Math.sin(t * 33.1) * 0.01
        : 1;

    const finalLevel = flickerLevel * microJitter;

    rootRef.current.position.y = THREE.MathUtils.damp(
      rootRef.current.position.y,
      visible ? 1.08 : 0.9,
      8,
      delta
    );

    rootRef.current.scale.x = THREE.MathUtils.damp(
      rootRef.current.scale.x,
      visible ? 1 : 0.82,
      8,
      delta
    );
    rootRef.current.scale.y = THREE.MathUtils.damp(
      rootRef.current.scale.y,
      visible ? 1 : 0.82,
      8,
      delta
    );
    rootRef.current.scale.z = THREE.MathUtils.damp(
      rootRef.current.scale.z,
      visible ? 1 : 0.82,
      8,
      delta
    );

    if (signRef.current) {
      signRef.current.traverse((child) => {
        if (!child.isMesh) return;

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        materials.forEach((mat) => {
          if (!mat) return;

          if ("opacity" in mat) {
            mat.opacity = THREE.MathUtils.damp(
              mat.opacity ?? 0,
              visible ? 1 : 0,
              8,
              delta
            );
          }

          if ("emissiveIntensity" in mat && mat.emissive) {
            const isRedish =
              mat.emissive.r > mat.emissive.g * 1.08 &&
              mat.emissive.r > mat.emissive.b * 1.08;

            const baseTarget = isRedish
              ? 12.8 * finalLevel
              : 0.18 + 0.27 * finalLevel;

            mat.emissiveIntensity = THREE.MathUtils.damp(
              mat.emissiveIntensity ?? 0,
              visible ? baseTarget : 0,
              14,
              delta
            );
          }
        });
      });
    }

    if (wallGlowRef.current?.material) {
      wallGlowRef.current.material.opacity = THREE.MathUtils.damp(
        wallGlowRef.current.material.opacity,
        visible ? 0.62 * finalLevel : 0,
        14,
        delta
      );
    }

    if (wallGlowOuterRef.current?.material) {
      wallGlowOuterRef.current.material.opacity = THREE.MathUtils.damp(
        wallGlowOuterRef.current.material.opacity,
        visible ? 0.28 * finalLevel : 0,
        14,
        delta
      );
    }

    if (floorGlowRef.current?.material) {
      floorGlowRef.current.material.opacity = THREE.MathUtils.damp(
        floorGlowRef.current.material.opacity,
        visible ? 0.22 * finalLevel : 0,
        14,
        delta
      );
    }

    if (redWallLightRef.current) {
      redWallLightRef.current.intensity = THREE.MathUtils.damp(
        redWallLightRef.current.intensity,
        visible ? 8.8 * finalLevel : 0,
        14,
        delta
      );
    }

    if (redFloorLightRef.current) {
      redFloorLightRef.current.intensity = THREE.MathUtils.damp(
        redFloorLightRef.current.intensity,
        visible ? 6.6 * finalLevel : 0,
        14,
        delta
      );
    }

    if (redFrontLightRef.current) {
      redFrontLightRef.current.intensity = THREE.MathUtils.damp(
        redFrontLightRef.current.intensity,
        visible ? 3.8 * finalLevel : 0,
        14,
        delta
      );
    }

    if (redTextSpillRef.current) {
      redTextSpillRef.current.intensity = THREE.MathUtils.damp(
        redTextSpillRef.current.intensity,
        visible ? 2.75 * finalLevel : 0,
        14,
        delta
      );
    }

    if (redRoomFillRef.current) {
      redRoomFillRef.current.intensity = THREE.MathUtils.damp(
        redRoomFillRef.current.intensity,
        visible ? 2.6 * finalLevel : 0,
        14,
        delta
      );
    }

    if (redUpperBounceRef.current) {
      redUpperBounceRef.current.intensity = THREE.MathUtils.damp(
        redUpperBounceRef.current.intensity,
        visible ? 2.15 * finalLevel : 0,
        14,
        delta
      );
    }
  });

  return (
    <group
      ref={rootRef}
      position={[11.9, 1.08, -11.62]}
      rotation={[0, Math.PI + 0.22, 0]}
      scale={0.82}
    >
      <mesh ref={wallGlowOuterRef} position={[0, 0, -0.26]} renderOrder={1}>
        <planeGeometry args={[7.6, 4.8]} />
        <meshBasicMaterial
          map={glowTexture}
          color="#ff4338"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={wallGlowRef} position={[0, 0, -0.2]} renderOrder={2}>
        <planeGeometry args={[5.8, 3.6]} />
        <meshBasicMaterial
          map={glowTexture}
          color="#ff5a4d"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh
        ref={floorGlowRef}
        position={[0.05, -0.92, 0.45]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={2}
      >
        <planeGeometry args={[4.8, 3.1]} />
        <meshBasicMaterial
          map={glowTexture}
          color="#ff4a3d"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <group
        ref={signRef}
        scale={[scaleFactor, scaleFactor, scaleFactor]}
        position={[0, 0, 0]}
      >
        <primitive object={signScene} />
      </group>

      <pointLight
        ref={redWallLightRef}
        position={[0, 0, -0.5]}
        color="#ff5144"
        intensity={0}
        distance={20}
        decay={1.02}
      />

      <pointLight
        ref={redFloorLightRef}
        position={[0, -0.78, 0.42]}
        color="#ff4d42"
        intensity={0}
        distance={18}
        decay={1.06}
      />

      <pointLight
        ref={redFrontLightRef}
        position={[0, 0.04, 0.52]}
        color="#ff7d70"
        intensity={0}
        distance={13}
        decay={1.25}
      />

      <pointLight
        ref={redTextSpillRef}
        position={[-1.35, 0.05, -0.1]}
        color="#ff6155"
        intensity={0}
        distance={14}
        decay={1.1}
      />

      <pointLight
        ref={redRoomFillRef}
        position={[1.1, 0.25, -1.4]}
        color="#ff3e36"
        intensity={0}
        distance={26}
        decay={0.95}
      />

      <pointLight
        ref={redUpperBounceRef}
        position={[0.1, 1.1, -0.7]}
        color="#ff7062"
        intensity={0}
        distance={16}
        decay={1.05}
      />
    </group>
  );
}

function WallLamp() {
  const rootRef = useRef(null);
  const wallGlowRef = useRef(null);
  const wallGlowOuterRef = useRef(null);
  const innerGlowARef = useRef(null);
  const innerGlowBRef = useRef(null);
  const innerGlowCRef = useRef(null);

  const bulbLightRef = useRef(null);
  const bounceLightRef = useRef(null);
  const fillLightRef = useRef(null);
  const bulbCoreLightRef = useRef(null);

  const { scene: lampSceneSource } = useGLTF(LAMP_WALL_URL);
  const glowTexture = useMemo(() => createSoftBeamTexture(), []);

  const { lampScene, bulbCenter, glassCenter, bulbMaterials, glassMaterials } =
    useMemo(() => {
      const cloned = lampSceneSource.clone(true);

      let foundBulbCenter = new THREE.Vector3(0, 0.6739, 0.6136);
      let foundGlassCenter = new THREE.Vector3(0, 0.7332, 0.6135);

      const foundBulbMaterials = [];
      const foundGlassMaterials = [];

      cloned.updateMatrixWorld(true);

      cloned.traverse((child) => {
        if (!child.isMesh) return;

        const sourceMaterial = Array.isArray(child.material)
          ? child.material[0]
          : child.material;

        const meshName = (child.name || "").toLowerCase();
        const materialName = (sourceMaterial?.name || "").toLowerCase();

        const isGlass =
          meshName.includes("glass") ||
          meshName.includes("glas") ||
          meshName.includes("shade") ||
          meshName.includes("schirm") ||
          materialName.includes("glass") ||
          materialName.includes("glas") ||
          materialName.includes("shade") ||
          materialName.includes("schirm");

        const isBulb =
          meshName.includes("bulb") ||
          meshName.includes("birne") ||
          materialName.includes("bulb") ||
          materialName.includes("birne");

        if (isBulb) {
          const box = new THREE.Box3().setFromObject(child);
          foundBulbCenter = box.getCenter(new THREE.Vector3());

          child.castShadow = false;
          child.receiveShadow = false;

          const bulbMaterial = new THREE.MeshStandardMaterial({
            color: "#fffdf6",
            emissive: new THREE.Color("#ffe9b8"),
            emissiveIntensity: 0,
            roughness: 0.01,
            metalness: 0,
            transparent: false,
            side: THREE.DoubleSide,
            toneMapped: false,
          });

          child.material = bulbMaterial;
          foundBulbMaterials.push(bulbMaterial);
          return;
        }

        if (isGlass) {
          const box = new THREE.Box3().setFromObject(child);
          foundGlassCenter = box.getCenter(new THREE.Vector3());

          child.castShadow = false;
          child.receiveShadow = true;

          const glassMaterial = new THREE.MeshPhysicalMaterial({
            color: "#fffaf0",
            roughness: 0.03,
            metalness: 0,
            transmission: 1,
            thickness: 0.003,
            ior: 1.52,
            clearcoat: 1,
            clearcoatRoughness: 0.03,
            reflectivity: 1,
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide,
            emissive: new THREE.Color("#ffcf88"),
            emissiveIntensity: 0,
            toneMapped: true,
          });

          child.material = glassMaterial;
          foundGlassMaterials.push(glassMaterial);
          return;
        }

        child.castShadow = true;
        child.receiveShadow = true;

        child.material = new THREE.MeshStandardMaterial({
          color: "#1f1711",
          roughness: 0.72,
          metalness: 0.22,
          emissive: new THREE.Color("#080503"),
          emissiveIntensity: 0.01,
          side: THREE.DoubleSide,
          toneMapped: true,
        });
      });

      return {
        lampScene: cloned,
        bulbCenter: foundBulbCenter,
        glassCenter: foundGlassCenter,
        bulbMaterials: foundBulbMaterials,
        glassMaterials: foundGlassMaterials,
      };
    }, [lampSceneSource]);

  useFrame((_, delta) => {
    const cfg = WALL_LAMP_CONFIG;

    if (wallGlowRef.current?.material) {
      wallGlowRef.current.material.opacity = THREE.MathUtils.damp(
        wallGlowRef.current.material.opacity,
        0.42,
        6,
        delta
      );
    }

    if (wallGlowOuterRef.current?.material) {
      wallGlowOuterRef.current.material.opacity = THREE.MathUtils.damp(
        wallGlowOuterRef.current.material.opacity,
        0.22,
        6,
        delta
      );
    }

    if (innerGlowARef.current?.material) {
      innerGlowARef.current.material.opacity = THREE.MathUtils.damp(
        innerGlowARef.current.material.opacity,
        1.18,
        10,
        delta
      );
    }

    if (innerGlowBRef.current?.material) {
      innerGlowBRef.current.material.opacity = THREE.MathUtils.damp(
        innerGlowBRef.current.material.opacity,
        1.0,
        10,
        delta
      );
    }

    if (innerGlowCRef.current?.material) {
      innerGlowCRef.current.material.opacity = THREE.MathUtils.damp(
        innerGlowCRef.current.material.opacity,
        0.86,
        10,
        delta
      );
    }

    bulbMaterials.forEach((mat) => {
      mat.emissiveIntensity = THREE.MathUtils.damp(
        mat.emissiveIntensity,
        52,
        8,
        delta
      );
    });

    glassMaterials.forEach((mat) => {
      mat.emissiveIntensity = THREE.MathUtils.damp(
        mat.emissiveIntensity,
        0.32,
        7,
        delta
      );
    });

    if (bulbLightRef.current) {
      bulbLightRef.current.intensity = THREE.MathUtils.damp(
        bulbLightRef.current.intensity,
        cfg.bulbIntensity,
        5,
        delta
      );
    }

    if (bounceLightRef.current) {
      bounceLightRef.current.intensity = THREE.MathUtils.damp(
        bounceLightRef.current.intensity,
        cfg.bounceIntensity,
        5,
        delta
      );
    }

    if (fillLightRef.current) {
      fillLightRef.current.intensity = THREE.MathUtils.damp(
        fillLightRef.current.intensity,
        cfg.fillIntensity,
        5,
        delta
      );
    }

    if (bulbCoreLightRef.current) {
      bulbCoreLightRef.current.intensity = THREE.MathUtils.damp(
        bulbCoreLightRef.current.intensity,
        24,
        6,
        delta
      );
    }
  });

  const bulbPos = [bulbCenter.x, bulbCenter.y, bulbCenter.z];

  const bouncePos = [
    bulbCenter.x + WALL_LAMP_CONFIG.bounceOffsetFromBulb[0],
    bulbCenter.y + WALL_LAMP_CONFIG.bounceOffsetFromBulb[1],
    bulbCenter.z + WALL_LAMP_CONFIG.bounceOffsetFromBulb[2],
  ];

  const fillPos = [
    bulbCenter.x + WALL_LAMP_CONFIG.fillOffsetFromBulb[0],
    bulbCenter.y + WALL_LAMP_CONFIG.fillOffsetFromBulb[1],
    bulbCenter.z + WALL_LAMP_CONFIG.fillOffsetFromBulb[2],
  ];

  return (
    <group
      ref={rootRef}
      position={WALL_LAMP_CONFIG.lampPosition}
      rotation={WALL_LAMP_CONFIG.lampRotation}
      scale={WALL_LAMP_CONFIG.lampScale}
    >
      <mesh
        ref={wallGlowOuterRef}
        position={[glassCenter.x, glassCenter.y, glassCenter.z - 0.18]}
        renderOrder={1}
      >
        <planeGeometry args={[0.58, 0.76]} />
        <meshBasicMaterial
          map={glowTexture}
          color="#ffb45d"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh
        ref={wallGlowRef}
        position={[glassCenter.x, glassCenter.y, glassCenter.z - 0.13]}
        renderOrder={2}
      >
        <planeGeometry args={[0.32, 0.44]} />
        <meshBasicMaterial
          map={glowTexture}
          color="#ffd391"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <group position={WALL_LAMP_CONFIG.modelOffset}>
        <primitive object={lampScene} />
      </group>

      <mesh
        ref={innerGlowARef}
        position={bulbPos}
        rotation={[0, 0, 0]}
        renderOrder={4}
      >
        <planeGeometry args={[0.24, 0.34]} />
        <meshBasicMaterial
          map={glowTexture}
          color="#fff4d2"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh
        ref={innerGlowBRef}
        position={bulbPos}
        rotation={[0, Math.PI / 2, 0]}
        renderOrder={5}
      >
        <planeGeometry args={[0.2, 0.28]} />
        <meshBasicMaterial
          map={glowTexture}
          color="#ffebb8"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh
        ref={innerGlowCRef}
        position={bulbPos}
        rotation={[Math.PI / 2, 0, 0]}
        renderOrder={6}
      >
        <planeGeometry args={[0.16, 0.16]} />
        <meshBasicMaterial
          map={glowTexture}
          color="#fffef7"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <pointLight
        ref={bulbLightRef}
        position={bulbPos}
        color="#ffd89e"
        intensity={0}
        distance={WALL_LAMP_CONFIG.bulbDistance}
        decay={WALL_LAMP_CONFIG.bulbDecay}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.00004}
        shadow-normalBias={0.02}
        shadow-radius={34}
      />

      <pointLight
        ref={bounceLightRef}
        position={bouncePos}
        color="#ffc877"
        intensity={0}
        distance={WALL_LAMP_CONFIG.bounceDistance}
        decay={WALL_LAMP_CONFIG.bounceDecay}
      />

      <pointLight
        ref={fillLightRef}
        position={fillPos}
        color="#ffba64"
        intensity={0}
        distance={WALL_LAMP_CONFIG.fillDistance}
        decay={WALL_LAMP_CONFIG.fillDecay}
      />

      <pointLight
        ref={bulbCoreLightRef}
        position={bulbPos}
        color="#fff3d2"
        intensity={0}
        distance={4.2}
        decay={1.9}
      />

      {WALL_LAMP_CONFIG.showLightHelper && (
        <mesh position={bulbPos} renderOrder={10}>
          <sphereGeometry args={[WALL_LAMP_CONFIG.helperSize, 16, 16]} />
          <meshBasicMaterial color="#00ffff" toneMapped={false} />
        </mesh>
      )}
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
  const globalOffsetX = -1.8;

  const baseColor = powerState === "lamp" ? "#f1f1f1" : "#e2e8f4";
  const accentColor = powerState === "lamp" ? "#66dff0" : "#9bf6ff";
  const baseEmissive = powerState === "lamp" ? "#0a1320" : "#1b2d49";
  const baseEmissiveIntensity = powerState === "lamp" ? 0.038 : 0.08;
  const accentEmissiveIntensity = powerState === "lamp" ? 0.17 : 0.24;

  const sharedMaterial = useMemo(
    () => ({
      roughness: 0.38,
      metalness: 0.03,
      clearcoat: 1,
      clearcoatRoughness: 0.045,
      reflectivity: 1,
    }),
    []
  );

  useLayoutEffect(() => {
    const timer = window.setTimeout(() => {
      const buildsWidth = getMeshWidth(buildsRef);
      const digitalWidth = getMeshWidth(digitalRef);

      const digitalX = -digitalWidth / 2;
      const buildsX = digitalX - wordGap - buildsWidth;
      const leftAlignedX = buildsX + globalOffsetX;

      setPositions({
        dustinX: leftAlignedX,
        buildsX: buildsX + globalOffsetX,
        digitalX: digitalX + globalOffsetX,
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
          height={0.51}
          curveSegments={8}
          bevelEnabled
          bevelThickness={0.022}
          bevelSize={0.02}
          bevelOffset={0}
          bevelSegments={1}
          scale={[1.08, 1, 1]}
          castShadow
          receiveShadow
        >
          Dustin
          <meshPhysicalMaterial
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
          height={0.45}
          curveSegments={8}
          bevelEnabled
          bevelThickness={0.02}
          bevelSize={0.017}
          bevelOffset={0}
          bevelSegments={1}
          scale={[1.08, 1, 1]}
          castShadow
          receiveShadow
        >
          builds
          <meshPhysicalMaterial
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
          height={0.45}
          curveSegments={8}
          bevelEnabled
          bevelThickness={0.02}
          bevelSize={0.017}
          bevelOffset={0}
          bevelSegments={1}
          scale={[1.08, 1, 1]}
          castShadow
          receiveShadow
        >
          digital
          <meshPhysicalMaterial
            color={accentColor}
            emissive="#57e9ff"
            emissiveIntensity={accentEmissiveIntensity}
            roughness={0.3}
            metalness={0.03}
            clearcoat={1}
            clearcoatRoughness={0.04}
            reflectivity={1}
          />
        </Text3D>
      </group>

      <group position={[positions.expX, lineY3, 0]}>
        <Text3D
          ref={expRef}
          font={FONT_URL}
          size={1.18}
          height={0.51}
          curveSegments={8}
          bevelEnabled
          bevelThickness={0.022}
          bevelSize={0.02}
          bevelOffset={0}
          bevelSegments={1}
          scale={[1.08, 1, 1]}
          castShadow
          receiveShadow
        >
          Experiences.
          <meshPhysicalMaterial
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

function PowerLights({ powerState, pointer, showArrow, arrowFlickerLevel }) {
  const { scene, gl } = useThree();

  const ambientRef = useRef(null);
  const wallWashRef = useRef(null);
  const spotRef = useRef(null);
  const neonBounceRef = useRef(null);
  const neonEdgeRef = useRef(null);

  const spotTarget = useMemo(() => new THREE.Object3D(), []);
  const edgeTarget = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    scene.add(spotTarget);
    scene.add(edgeTarget);
    return () => {
      scene.remove(spotTarget);
      scene.remove(edgeTarget);
    };
  }, [scene, spotTarget, edgeTarget]);

  useEffect(() => {
    if (spotRef.current) spotRef.current.target = spotTarget;
    if (neonEdgeRef.current) neonEdgeRef.current.target = edgeTarget;
  }, [spotTarget, edgeTarget]);

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

      if (powerState === "lamp") ambient = 0.028;

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

      if (powerState === "lamp") fill = 0.055;

      wallWashRef.current.intensity = fill;
    }

    if (spotRef.current) {
      const targetX = THREE.MathUtils.clamp(pointer.x * 13.5, -13.5, 13.5);
      const targetY = THREE.MathUtils.clamp(pointer.y * 6.5, -6.5, 6.5);

      const lampX = THREE.MathUtils.clamp(pointer.x * 1.8, -1.8, 1.8);
      const lampY = THREE.MathUtils.clamp(pointer.y * 1.2, -1.2, 1.2) + 0.35;

      spotTarget.position.x = THREE.MathUtils.damp(
        spotTarget.position.x,
        targetX,
        10,
        delta
      );
      spotTarget.position.y = THREE.MathUtils.damp(
        spotTarget.position.y,
        targetY,
        10,
        delta
      );
      spotTarget.position.z = -12.75;
      spotTarget.updateMatrixWorld(true);

      spotRef.current.position.x = THREE.MathUtils.damp(
        spotRef.current.position.x,
        lampX,
        10,
        delta
      );
      spotRef.current.position.y = THREE.MathUtils.damp(
        spotRef.current.position.y,
        lampY,
        10,
        delta
      );
      spotRef.current.position.z = 11.8;

      spotRef.current.target = spotTarget;
      spotRef.current.intensity = powerState === "lamp" ? 980 : 0;
      spotRef.current.angle = 0.28;
      spotRef.current.penumbra = 1;
      spotRef.current.distance = 98;
      spotRef.current.decay = 1;

      spotRef.current.shadow.camera.near = 6;
      spotRef.current.shadow.camera.far = 42;
      spotRef.current.shadow.focus = 1;
      spotRef.current.shadow.bias = -0.00012;
      spotRef.current.shadow.normalBias = 0.02;
      spotRef.current.shadow.radius = 3.2;
      spotRef.current.shadow.needsUpdate = true;
      spotRef.current.shadow.camera.updateProjectionMatrix();

      gl.shadowMap.needsUpdate = true;
    }

    edgeTarget.position.set(-1.8, -0.35, -1.2);
    edgeTarget.updateMatrixWorld(true);

    if (neonBounceRef.current) {
      const target = showArrow ? 2.1 : 0;
      neonBounceRef.current.intensity = THREE.MathUtils.damp(
        neonBounceRef.current.intensity,
        target,
        8,
        delta
      );
    }

    if (neonEdgeRef.current) {
      const target = showArrow ? 180 : 0;
      neonEdgeRef.current.intensity = THREE.MathUtils.damp(
        neonEdgeRef.current.intensity,
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
        position={[11.45, 0.48, -10.85]}
        color="#ff3b3b"
        intensity={0}
        distance={18}
        decay={1.05}
      />

      <spotLight
        ref={neonEdgeRef}
        position={[9.8, 0.95, -10.6]}
        color="#ff4545"
        intensity={0}
        angle={0.18}
        penumbra={1}
        distance={24}
        decay={1.2}
      />

      <spotLight
        ref={spotRef}
        position={[0, 0.35, 11.8]}
        color="#fff6e8"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.00012}
        shadow-normalBias={0.02}
      />
    </>
  );
}

function Scene({
  powerState,
  pointer,
  introProgress,
  showArrow,
  arrowFlickerLevel,
}) {
  return (
    <>
      <fog attach="fog" args={["#02050b", 11, 44]} />
      <BackWall powerState={powerState} />
      <SideWalls powerState={powerState} />
      <Floor />
      <SoftBeamWall pointer={pointer} powerState={powerState} />
      <SoftBeamFloor pointer={pointer} powerState={powerState} />
      <NeonArrowSign visible={showArrow} />
      <WallLamp />
      <PowerLights
        powerState={powerState}
        pointer={pointer}
        showArrow={showArrow}
        arrowFlickerLevel={arrowFlickerLevel}
      />
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
              toneMappingExposure: 1.18,
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

useGLTF.preload(SIGN_URL);
useGLTF.preload(LAMP_WALL_URL);
useTexture.preload(BRICKS_WALL_URL);
useTexture.preload(CHECKER_FLOOR_DIFFUSE_URL);
useTexture.preload(CHECKER_FLOOR_NORMAL_URL);
useTexture.preload(CHECKER_FLOOR_ROUGHNESS_URL);