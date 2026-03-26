const BABYLON = window.BABYLON;
import { state } from "./state.js";
import { c3 } from "../utils/colors.js";
import { ARENA_SIZE, WALL_HEIGHT } from "../utils/constants.js";

// ============================================================
// Arena — floor, walls, pillars, crates, lighting
// ============================================================

function mat(name, diffuseHex, opts = {}) {
  const m = new BABYLON.StandardMaterial(name, state.scene);
  m.diffuseColor = c3(diffuseHex);
  m.specularColor = new BABYLON.Color3(
    opts.metalness ?? 0.1,
    opts.metalness ?? 0.1,
    opts.metalness ?? 0.1,
  );
  m.specularPower = opts.specularPower ?? 32;
  if (opts.emissiveHex !== undefined) m.emissiveColor = c3(opts.emissiveHex);
  if (opts.backFaceCulling === false) m.backFaceCulling = false;
  return m;
}

export function createArena() {
  const { scene } = state;
  const half = ARENA_SIZE / 2;

  // ── Floor ─────────────────────────────────────────────────
  const floor = BABYLON.MeshBuilder.CreateGround(
    "floor",
    { width: ARENA_SIZE, height: ARENA_SIZE },
    scene,
  );
  floor.material = mat("floorMat", 0xe8e8f0, { metalness: 0.15, specularPower: 16 });
  floor.receiveShadows = true;

  // Floor grid lines
  const lines = [];
  const gridStep = 2;
  for (let x = -half; x <= half; x += gridStep) {
    lines.push([
      new BABYLON.Vector3(x, 0.01, -half),
      new BABYLON.Vector3(x, 0.01, half),
    ]);
  }
  for (let z = -half; z <= half; z += gridStep) {
    lines.push([
      new BABYLON.Vector3(-half, 0.01, z),
      new BABYLON.Vector3(half, 0.01, z),
    ]);
  }
  const grid = BABYLON.MeshBuilder.CreateLineSystem("grid", { lines }, scene);
  grid.color = new BABYLON.Color3(0.8, 0.8, 0.867); // 0xccccdd

  // ── Walls ─────────────────────────────────────────────────
  const wallMatInst = mat("wallMat", 0xd0d0e0, {
    metalness: 0.25,
    specularPower: 24,
    backFaceCulling: false,
  });
  const wallTrimMatInst = mat("wallTrimMat", 0xa0a0b8, {
    metalness: 0.3,
    specularPower: 32,
    backFaceCulling: false,
  });

  const wallConfigs = [
    { pos: [0, WALL_HEIGHT / 2, -half], rot: 0 },
    { pos: [0, WALL_HEIGHT / 2, half], rot: 0 },
    { pos: [-half, WALL_HEIGHT / 2, 0], rot: Math.PI / 2 },
    { pos: [half, WALL_HEIGHT / 2, 0], rot: Math.PI / 2 },
  ];

  wallConfigs.forEach(({ pos, rot }) => {
    const wall = BABYLON.MeshBuilder.CreateBox(
      "wall",
      { width: ARENA_SIZE + 1, height: WALL_HEIGHT, depth: 1 },
      scene,
    );
    wall.position.set(pos[0], pos[1], pos[2]);
    wall.rotation.y = rot;
    wall.material = wallMatInst;
    wall.receiveShadows = true;
    state.shadowGen.addShadowCaster(wall);

    const trim = BABYLON.MeshBuilder.CreateBox(
      "wallTrim",
      { width: ARENA_SIZE + 1.2, height: 0.3, depth: 1.2 },
      scene,
    );
    trim.position.set(pos[0], 0.15, pos[2]);
    trim.rotation.y = rot;
    trim.material = wallTrimMatInst;
  });

  // ── Corner pillars ────────────────────────────────────────
  const pillarMatInst = mat("pillarMat", 0xb0b0c8, { metalness: 0.3, specularPower: 32 });
  [
    [-half, half],
    [half, half],
    [half, -half],
    [-half, -half],
  ].forEach(([x, z]) => {
    const pillar = BABYLON.MeshBuilder.CreateCylinder(
      "pillar",
      { diameterTop: 1.0, diameterBottom: 1.2, height: WALL_HEIGHT, tessellation: 8 },
      scene,
    );
    pillar.position.set(x, WALL_HEIGHT / 2, z);
    pillar.material = pillarMatInst;
    state.shadowGen.addShadowCaster(pillar);
  });

  // ── Cover crates ──────────────────────────────────────────
  const crateMatInst = mat("crateMat", 0xc8a070, { metalness: 0.05, specularPower: 8 });
  [
    [-5, 0.6, -4],
    [6, 0.6, 5],
    [-6, 0.6, 6],
    [4, 0.6, -6],
  ].forEach(([x, y, z]) => {
    const crate = BABYLON.MeshBuilder.CreateBox(
      "crate",
      { width: 1.5, height: 1.2, depth: 1.2 },
      scene,
    );
    crate.position.set(x, y, z);
    crate.material = crateMatInst;
    crate.receiveShadows = true;
    state.shadowGen.addShadowCaster(crate);
    state.crates.push(crate);
  });

  // ── Wall light panels (NO shadow casting — saves draw calls) ──
  const lightPanelMatInst = mat("lightPanelMat", 0xffffcc, {
    emissiveHex: 0xffffaa,
    specularPower: 64,
  });
  const panelPositions = [
    [-half + 2, WALL_HEIGHT - 1.5, -half],
    [half - 2, WALL_HEIGHT - 1.5, -half],
    [-half + 2, WALL_HEIGHT - 1.5, half],
    [half - 2, WALL_HEIGHT - 1.5, half],
    [-half, WALL_HEIGHT - 1.5, 2],
    [-half, WALL_HEIGHT - 1.5, -2],
    [half, WALL_HEIGHT - 1.5, 2],
    [half, WALL_HEIGHT - 1.5, -2],
  ];

  panelPositions.forEach(([x, y, z]) => {
    const panel = BABYLON.MeshBuilder.CreateBox(
      "lightPanel",
      { width: 1.5, height: 0.4, depth: 0.15 },
      scene,
    );
    panel.position.set(x, y, z);
    panel.material = lightPanelMatInst;

    // Point lights — no shadow casting for performance
    const pt = new BABYLON.PointLight(
      "pointLight",
      new BABYLON.Vector3(x, y, z),
      scene,
    );
    pt.diffuse = c3(0xffffcc);
    pt.intensity = 1.2;
    pt.range = 12;
    // pt.castShadows intentionally omitted — shadow casting disabled for perf
  });
}
