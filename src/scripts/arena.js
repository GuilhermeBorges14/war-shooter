import * as THREE from "three";
import { state } from "./state.js";
import { ARENA_SIZE, WALL_HEIGHT } from "../utils/constants.js";

// ============================================================
// Arena — floor, walls, pillars, crates, lighting
// ============================================================

export function createArena() {
  const { scene } = state;
  const half = ARENA_SIZE / 2;

  // Floor with tile-grid pattern
  const floorGeo = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xe8e8f0,
    roughness: 0.85,
    metalness: 0.15,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Floor grid lines
  const gridMat = new THREE.LineBasicMaterial({
    color: 0xccccdd,
    linewidth: 1,
  });
  const gridStep = 2;
  const gridPoints = [];
  for (let x = -half; x <= half; x += gridStep) {
    gridPoints.push(
      new THREE.Vector3(x, 0.01, -half),
      new THREE.Vector3(x, 0.01, half),
    );
  }
  for (let z = -half; z <= half; z += gridStep) {
    gridPoints.push(
      new THREE.Vector3(-half, 0.01, z),
      new THREE.Vector3(half, 0.01, z),
    );
  }
  scene.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(gridPoints),
      gridMat,
    ),
  );

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xd0d0e0,
    roughness: 0.75,
    metalness: 0.25,
    side: THREE.DoubleSide,
  });
  const wallTrimMat = new THREE.MeshStandardMaterial({
    color: 0xa0a0b8,
    roughness: 0.6,
    metalness: 0.3,
    side: THREE.DoubleSide,
  });
  const wallGeo = new THREE.BoxGeometry(ARENA_SIZE + 1, WALL_HEIGHT, 1);
  const wallConfigs = [
    { pos: [0, 0, -half], rot: 0 },
    { pos: [0, 0, half], rot: 0 },
    { pos: [-half, 0, 0], rot: Math.PI / 2 },
    { pos: [half, 0, 0], rot: Math.PI / 2 },
  ];
  wallConfigs.forEach(({ pos, rot }) => {
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(pos[0], WALL_HEIGHT / 2, pos[2]);
    wall.rotation.y = rot;
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(ARENA_SIZE + 1.2, 0.3, 1.2),
      wallTrimMat,
    );
    trim.position.set(pos[0], 0.15, pos[2]);
    trim.rotation.y = rot;
    scene.add(trim);
  });

  // Corner pillars
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0xb0b0c8,
    roughness: 0.7,
    metalness: 0.3,
  });
  const pillarGeo = new THREE.CylinderGeometry(0.5, 0.6, WALL_HEIGHT, 8);
  [
    [-half, half],
    [half, half],
    [half, -half],
    [-half, -half],
  ].forEach(([x, z]) => {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(x, WALL_HEIGHT / 2, z);
    pillar.castShadow = true;
    scene.add(pillar);
  });

  // Cover crates
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0xc8a070,
    roughness: 0.9,
    metalness: 0.05,
  });
  const crateGeo = new THREE.BoxGeometry(1.5, 1.2, 1.2);
  [
    [-5, 0.6, -4],
    [6, 0.6, 5],
    [-6, 0.6, 6],
    [4, 0.6, -6],
  ].forEach(([x, y, z]) => {
    const crate = new THREE.Mesh(crateGeo, crateMat);
    crate.position.set(x, y, z);
    crate.castShadow = true;
    crate.receiveShadow = true;
    scene.add(crate);
    state.crates.push(crate);
  });

  // Wall lights
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffffcc,
    emissive: 0xffffaa,
    emissiveIntensity: 0.6,
  });
  const lightPanelGeo = new THREE.BoxGeometry(1.5, 0.4, 0.15);
  [
    [-half + 2, WALL_HEIGHT - 1.5, -half],
    [half - 2, WALL_HEIGHT - 1.5, -half],
    [-half + 2, WALL_HEIGHT - 1.5, half],
    [half - 2, WALL_HEIGHT - 1.5, half],
    [-half, WALL_HEIGHT - 1.5, 2],
    [-half, WALL_HEIGHT - 1.5, -2],
    [half, WALL_HEIGHT - 1.5, 2],
    [half, WALL_HEIGHT - 1.5, -2],
  ].forEach(([x, y, z]) => {
    const panel = new THREE.Mesh(lightPanelGeo, lightMat);
    panel.position.set(x, y, z);
    scene.add(panel);

    const pointLight = new THREE.PointLight(0xffffcc, 1.2, 12);
    pointLight.position.set(x, y, z);
    pointLight.castShadow = true;
    scene.add(pointLight);
  });
}
