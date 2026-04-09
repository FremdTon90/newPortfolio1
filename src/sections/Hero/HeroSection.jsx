import React, {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text3D, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import "./HeroSection.css";

const FONT_URL = `${import.meta.env.BASE_URL}fonts/helvetiker_bold.typeface.json`;
const SIGN_URL = `${import.meta.env.BASE_URL}models/neon_open_sign.glb`;

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

  const mortarColor = "#140809";

  ctx.fillStyle = mortarColor;
  ctx.fillRect(0, 0, width, height);

  btx.fillStyle = "#707070";
  btx.fillRect(0, 0, width, height);

  dtx.fillStyle = "#575757";
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

      ctx.fillStyle = "rgba(0,0,0,0.24)";
      ctx.fillRect(px, y + brickH - 6, brickW, 6);

      for (let i = 0; i < 18; i++) {
        const nx = px + Math.random() * brickW;
        const ny = y + Math.random() * brickH;
        const a = 0.012 + Math.random() * 0.03;
        ctx.fillStyle = `rgba(255,235,230,${a})`;
        ctx.fillRect(nx, ny, 2, 2);
      }

      btx.fillStyle = "#e2e2e2";
      btx.fillRect(px, y, brickW, brickH);
      btx.fillStyle = "#f4f4f4";
      btx.fillRect(px + 1, y + 1, brickW - 2, 2);
      btx.fillStyle = "#999999";
      btx.fillRect(px, y + brickH - 3, brickW, 3);

      dtx.fillStyle = "#f3f3f3";
      dtx.fillRect(px, y, brickW, brickH);
      dtx.fillStyle = "#fbfbfb";
      dtx.fillRect(px + 1, y + 1, brickW - 2, 2);
      dtx.fillStyle = "#a0a0a0";
      dtx.fillRect(px, y + brickH - 3, brickW, 3);
    }
  }

  for (let y = brickH; y < height; y += rowStep) {
    btx.fillStyle = "#3f3f3f";
    btx.fillRect(0, y, width, mortar);

    dtx.fillStyle = "#161616";
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

  return { colorMap, bumpMap, displacementMap, mortarColor };
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

  const groutColor = "#140809";

  ctx.fillStyle = groutColor;
  ctx.fillRect(0, 0, width, height);

  btx.fillStyle = "#9d9d9d";
  btx.fillRect(0, 0, width, height);

  dtx.fillStyle = "#909090";
  dtx.fillRect(0, 0, width, height);

  const tile = 105;
  const grout = 5;
  const cols = Math.ceil(width / tile);
  const rows = Math.ceil(height / tile);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = col * tile;
      const y = row * tile;

      const isLight = (row + col) % 2 === 0;
      const shade = isLight ? 76 + Math.random() * 4 : 16 + Math.random() * 3.5;

      const tileX = x + grout / 2;
      const tileY = y + grout / 2;
      const tileW = tile - grout;
      const tileH = tile - grout;

      ctx.fillStyle = `hsl(0 0% ${shade}%)`;
      ctx.fillRect(tileX, tileY, tileW, tileH);

      const topGrad = ctx.createLinearGradient(tileX, tileY, tileX, tileY + 18);
      topGrad.addColorStop(0, "rgba(255,255,255,0.12)");
      topGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = topGrad;
      ctx.fillRect(tileX, tileY, tileW, 18);

      const diagGrad = ctx.createLinearGradient(
        tileX,
        tileY,
        tileX + tileW,
        tileY + tileH
      );
      diagGrad.addColorStop(0.16, "rgba(255,255,255,0)");
      diagGrad.addColorStop(0.44, "rgba(255,255,255,0.075)");
      diagGrad.addColorStop(0.56, "rgba(255,255,255,0.03)");
      diagGrad.addColorStop(0.78, "rgba(255,255,255,0)");
      ctx.fillStyle = diagGrad;
      ctx.fillRect(tileX, tileY, tileW, tileH);

      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(tileX, tileY, tileW, 2);

      ctx.fillStyle = "rgba(0,0,0,0.14)";
      ctx.fillRect(tileX, tileY + tileH - 2, tileW, 2);
      ctx.fillRect(tileX + tileW - 2, tileY, 2, tileH);

      for (let i = 0; i < 16; i++) {
        const nx = tileX + Math.random() * tileW;
        const ny = tileY + Math.random() * tileH;
        const a = 0.007 + Math.random() * 0.014;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(nx, ny, 2, 2);
      }

      btx.fillStyle = "#d8d8d8";
      btx.fillRect(tileX, tileY, tileW, tileH);

      btx.fillStyle = "#8b8b8b";
      btx.fillRect(x, y, tile, grout);
      btx.fillRect(x, y, grout, tile);

      dtx.fillStyle = "#e8e8e8";
      dtx.fillRect(tileX, tileY, tileW, tileH);

      dtx.fillStyle = "#7c7c7c";
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

    if (powerState === "lamp") emissiveIntensity = 0.04;

    materialRef.current.emissiveIntensity = emissiveIntensity;
  });

  return (
    <meshStandardMaterial
      ref={materialRef}
      map={textures.colorMap}
      bumpMap={textures.bumpMap}
      bumpScale={0.36}
      displacementMap={textures.displacementMap}
      displacementScale={0.52}
      displacementBias={-0.03}
      color={color}
      roughness={0.96}
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

      if (powerState === "lamp") emissiveIntensity = 0.024;

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
          bumpScale={0.34}
          displacementMap={textures.displacementMap}
          displacementScale={0.48}
          displacementBias={-0.03}
          color="#9f625c"
          roughness={0.97}
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
          bumpScale={0.34}
          displacementMap={textures.displacementMap}
          displacementScale={0.48}
          displacementBias={-0.03}
          color="#9f625c"
          roughness={0.97}
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
      <meshPhysicalMaterial
        map={tile.colorMap}
        bumpMap={tile.bumpMap}
        bumpScale={0.17}
        displacementMap={tile.displacementMap}
        displacementScale={0.06}
        displacementBias={-0.008}
        color="#ffffff"
        roughness={0.04}
        metalness={0}
        clearcoat={1}
        clearcoatRoughness={0.02}
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

    const targetOpacity = powerState === "lamp" ? 0.115 : 0;
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
        color="#f0f8ff"
      />
    </mesh>
  );
}

function NeonArrowSign({ visible }) {
  const rootRef = useRef(null);
  const signRef = useRef(null);
  const wallGlowRef = useRef(null);
  const redWallLightRef = useRef(null);
  const redFloorLightRef = useRef(null);
  const redFrontLightRef = useRef(null);
  const redTextSpillRef = useRef(null);

  const { scene } = useGLTF(SIGN_URL);

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
          emissive: new THREE.Color("#ff6a5a"),
          emissiveIntensity: 6.8,
          roughness: 0.14,
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
    const flicker =
      visible && t < 2.2 ? (Math.sin(t * 40) > 0.08 ? 1 : 0.9) : 1;

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

            const baseTarget = isRedish ? 7.2 * flicker : 0.45;
            mat.emissiveIntensity = THREE.MathUtils.damp(
              mat.emissiveIntensity ?? 0,
              visible ? baseTarget : 0,
              8,
              delta
            );
          }
        });
      });
    }

    if (wallGlowRef.current?.material) {
      wallGlowRef.current.material.opacity = THREE.MathUtils.damp(
        wallGlowRef.current.material.opacity,
        visible ? 0.28 * flicker : 0,
        8,
        delta
      );
    }

    if (redWallLightRef.current) {
      redWallLightRef.current.intensity = THREE.MathUtils.damp(
        redWallLightRef.current.intensity,
        visible ? 4.2 * flicker : 0,
        8,
        delta
      );
    }

    if (redFloorLightRef.current) {
      redFloorLightRef.current.intensity = THREE.MathUtils.damp(
        redFloorLightRef.current.intensity,
        visible ? 3.1 * flicker : 0,
        8,
        delta
      );
    }

    if (redFrontLightRef.current) {
      redFrontLightRef.current.intensity = THREE.MathUtils.damp(
        redFrontLightRef.current.intensity,
        visible ? 2.1 * flicker : 0,
        8,
        delta
      );
    }

    if (redTextSpillRef.current) {
      redTextSpillRef.current.intensity = THREE.MathUtils.damp(
        redTextSpillRef.current.intensity,
        visible ? 1.55 * flicker : 0,
        8,
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
      <mesh ref={wallGlowRef} position={[0, 0, -0.18]} renderOrder={2}>
        <planeGeometry args={[4.8, 2.8]} />
        <meshBasicMaterial
          color="#ff5448"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
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
        position={[0, 0, -0.55]}
        color="#ff4d4d"
        intensity={0}
        distance={14}
        decay={1.18}
      />

      <pointLight
        ref={redFloorLightRef}
        position={[0, -0.78, 0.42]}
        color="#ff4d4d"
        intensity={0}
        distance={13}
        decay={1.18}
      />

      <pointLight
        ref={redFrontLightRef}
        position={[0, 0.02, 0.46]}
        color="#ff7a68"
        intensity={0}
        distance={10}
        decay={1.5}
      />

      <pointLight
        ref={redTextSpillRef}
        position={[-1.35, 0.05, -0.1]}
        color="#ff6155"
        intensity={0}
        distance={10}
        decay={1.3}
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
          height={0.51}
          curveSegments={10}
          bevelEnabled
          bevelThickness={0.022}
          bevelSize={0.02}
          bevelOffset={0}
          bevelSegments={5}
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
          curveSegments={10}
          bevelEnabled
          bevelThickness={0.02}
          bevelSize={0.017}
          bevelOffset={0}
          bevelSegments={5}
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
          curveSegments={10}
          bevelEnabled
          bevelThickness={0.02}
          bevelSize={0.017}
          bevelOffset={0}
          bevelSegments={5}
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
          curveSegments={10}
          bevelEnabled
          bevelThickness={0.022}
          bevelSize={0.02}
          bevelOffset={0}
          bevelSegments={5}
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

function PowerLights({ powerState, pointer, showArrow }) {
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
      const target = showArrow ? 1.18 : 0;
      neonBounceRef.current.intensity = THREE.MathUtils.damp(
        neonBounceRef.current.intensity,
        target,
        8,
        delta
      );
    }

    if (neonEdgeRef.current) {
      const target = showArrow ? 118 : 0;
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
        distance={15}
        decay={1.38}
      />

      <spotLight
        ref={neonEdgeRef}
        position={[9.8, 0.95, -10.6]}
        color="#ff4545"
        intensity={0}
        angle={0.12}
        penumbra={1}
        distance={18}
        decay={1.55}
      />

      <spotLight
        ref={spotRef}
        position={[0, 0.35, 11.8]}
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
      <PowerLights
        powerState={powerState}
        pointer={pointer}
        showArrow={showArrow}
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