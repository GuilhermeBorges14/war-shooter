const BABYLON = window.BABYLON;
import { state } from "./state.js";
import { c3 } from "../utils/colors.js";

// ============================================================
// Entity factories — humanoids, weapons
// ============================================================

// Helper: create a StandardMaterial
function stdMat(name, diffuseHex, opts = {}) {
  const m = new BABYLON.StandardMaterial(name, state.scene);
  m.diffuseColor = c3(diffuseHex);
  m.specularColor = new BABYLON.Color3(
    opts.spec ?? 0.1,
    opts.spec ?? 0.1,
    opts.spec ?? 0.1,
  );
  m.specularPower = opts.specPow ?? 32;
  if (opts.emissiveHex !== undefined) {
    m.emissiveColor = c3(opts.emissiveHex);
  }
  return m;
}

// Helper: box mesh parented to a node
function box(name, w, h, d, parent) {
  const m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, state.scene);
  if (parent) m.parent = parent;
  return m;
}

// ── Humanoid factory ──────────────────────────────────────

export function createHumanoid({ bodyColor, headColor, legColor }) {
  const group = new BABYLON.TransformNode("humanoid", state.scene);

  const bodyMat = stdMat("bodyMat", bodyColor, { spec: 0.2, specPow: 16 });
  const body = box("body", 0.7, 1.0, 0.4, group);
  body.position.y = 1.0;
  body.material = bodyMat;
  body.receiveShadows = true;
  state.shadowGen.addShadowCaster(body);

  const headMat = stdMat("headMat", headColor, { spec: 0.1, specPow: 8 });
  const head = box("head", 0.4, 0.4, 0.4, group);
  head.position.y = 1.7;
  head.material = headMat;
  state.shadowGen.addShadowCaster(head);

  const armMat = stdMat("armMat", bodyColor, { spec: 0.2, specPow: 16 });
  const armL = box("armL", 0.2, 0.8, 0.2, group);
  armL.position.set(-0.5, 0.9, 0);
  armL.material = armMat;
  state.shadowGen.addShadowCaster(armL);

  const armR = box("armR", 0.2, 0.8, 0.2, group);
  armR.position.set(0.5, 0.9, 0);
  armR.material = armMat;
  state.shadowGen.addShadowCaster(armR);

  const legMat = stdMat("legMat", legColor, { spec: 0.15, specPow: 8 });
  const legL = box("legL", 0.25, 0.8, 0.25, group);
  legL.position.set(-0.2, 0.4, 0);
  legL.material = legMat;
  state.shadowGen.addShadowCaster(legL);

  const legR = box("legR", 0.25, 0.8, 0.25, group);
  legR.position.set(0.2, 0.4, 0);
  legR.material = legMat;
  state.shadowGen.addShadowCaster(legR);

  return { group, body };
}

// ── Player ────────────────────────────────────────────────

export function createPlayer() {
  const { group, body } = createHumanoid({
    bodyColor: 0x2a5a8a,
    headColor: 0xffdbac,
    legColor: 0x1a3a5a,
  });
  state.playerMesh = body;
  group.position.set(0, 0, 0);
  return group;
}

// ── Bot ───────────────────────────────────────────────────

export function createBot() {
  const { group, body } = createHumanoid({
    bodyColor: 0x8a2a2a,
    headColor: 0x3a3a3a,
    legColor: 0x5a1a1a,
  });

  // Collect bot materials for hit-flash
  state.botBodyMaterials = [];
  group.getChildMeshes().forEach((child) => {
    if (child.material) {
      state.botBodyMaterials.push({
        mesh: child,
        mat: child.material,
        origColor: child.material.diffuseColor.clone(),
      });
    }
  });

  // Glowing red eyes
  const eyeMat = stdMat("eyeMat", 0xff0000, { emissiveHex: 0xff0000, spec: 0.0 });
  const eyeL = BABYLON.MeshBuilder.CreateSphere(
    "eyeL",
    { diameter: 0.1, segments: 8 },
    state.scene,
  );
  eyeL.position.set(-0.08, 1.75, 0.2);
  eyeL.material = eyeMat;
  eyeL.parent = group;

  const eyeR = BABYLON.MeshBuilder.CreateSphere(
    "eyeR",
    { diameter: 0.1, segments: 8 },
    state.scene,
  );
  eyeR.position.set(0.08, 1.75, 0.2);
  eyeR.material = eyeMat;
  eyeR.parent = group;

  // Gun in hand
  const botGun = createPistolModel({
    sightColor: 0xff0000,
    sightEmissiveHex: 0xff0000,
  });
  botGun.position.set(0.5, 0.5, 0.3);
  botGun.parent = group;

  state.botGunRef = botGun;
  state.botMesh = body;
  group.position.set(8, 0, 8);
  return group;
}

// ── Pistol model ──────────────────────────────────────────

export function createPistolModel({
  sightColor = 0xff4444,
  sightEmissiveHex = 0xff0000,
} = {}) {
  const gunGroup = new BABYLON.TransformNode("pistol", state.scene);

  // Body — Z is positive = forward in Babylon camera space
  const bodyMesh = box("gunBody", 0.08, 0.12, 0.5, gunGroup);
  bodyMesh.position.z = 0.15;
  bodyMesh.material = stdMat("gunBodyMat", 0x2a2a2a, { spec: 0.5, specPow: 64 });

  const barrel = BABYLON.MeshBuilder.CreateCylinder(
    "barrel",
    { diameterTop: 0.04, diameterBottom: 0.04, height: 0.3, tessellation: 8 },
    state.scene,
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, 0.45);
  barrel.parent = gunGroup;
  barrel.material = stdMat("barrelMat", 0x1a1a1a, { spec: 0.7, specPow: 128 });

  const handle = box("handle", 0.06, 0.15, 0.08, gunGroup);
  handle.position.set(0, -0.12, 0.05);
  handle.material = stdMat("handleMat", 0x3a2a1a, { spec: 0.2, specPow: 8 });

  const sight = box("sight", 0.015, 0.03, 0.015, gunGroup);
  sight.position.set(0, 0.08, 0.35);
  sight.material = stdMat("sightMat", sightColor, { emissiveHex: sightEmissiveHex, spec: 0.0 });

  // Muzzle marker at barrel tip (barrel z=0.45, half-height=0.15 → tip at z=0.60)
  const muzzle = new BABYLON.TransformNode("muzzle", state.scene);
  muzzle.position.set(0, 0.02, 0.60);
  muzzle.parent = gunGroup;

  return gunGroup;
}

// ── First-person gun ──────────────────────────────────────

export function createGun() {
  const gunGroup = createPistolModel();
  // Position in camera local space: +Z = forward, so 0.4 puts it in front
  gunGroup.position.set(0.25, -0.25, 0.4);
  gunGroup.rotation.y = -0.1;
  return gunGroup;
}

// ── SMG (first-person) ────────────────────────────────────

export function createSMG() {
  const gunGroup = new BABYLON.TransformNode("smg", state.scene);

  const body = box("smgBody", 0.1, 0.15, 0.7, gunGroup);
  body.position.z = 0.2;
  body.material = stdMat("smgBodyMat", 0x1a1a1a, { spec: 0.6, specPow: 64 });

  const barrel = BABYLON.MeshBuilder.CreateCylinder(
    "smgBarrel",
    { diameterTop: 0.05, diameterBottom: 0.05, height: 0.4, tessellation: 8 },
    state.scene,
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, 0.55);
  barrel.parent = gunGroup;
  barrel.material = stdMat("smgBarrelMat", 0x0a0a0a, { spec: 0.8, specPow: 128 });

  const mag = box("smgMag", 0.08, 0.25, 0.12, gunGroup);
  mag.position.set(0, -0.15, 0.1);
  mag.material = stdMat("smgMagMat", 0x2a2a2a, { spec: 0.4, specPow: 32 });

  const handle = box("smgHandle", 0.07, 0.18, 0.1, gunGroup);
  handle.position.set(0, -0.2, 0);
  handle.material = stdMat("smgHandleMat", 0x3a2a1a, { spec: 0.2, specPow: 8 });

  const sight = box("smgSight", 0.02, 0.04, 0.02, gunGroup);
  sight.position.set(0, 0.1, 0.4);
  sight.material = stdMat("smgSightMat", 0xffaa00, { emissiveHex: 0xffaa00, spec: 0.0 });

  // Muzzle marker at barrel tip (barrel z=0.55, half-height=0.20 → tip at z=0.75)
  const muzzle = new BABYLON.TransformNode("muzzle", state.scene);
  muzzle.position.set(0, 0.03, 0.75);
  muzzle.parent = gunGroup;

  gunGroup.position.set(0.25, -0.25, 0.4);
  gunGroup.rotation.y = -0.1;
  return gunGroup;
}

// ── SMG world pickup ──────────────────────────────────────

export function createSMGPickup() {
  const group = new BABYLON.TransformNode("smgPickup", state.scene);

  const body = box("smgPickupBody", 0.15, 0.2, 0.9, group);
  body.material = stdMat("smgPickupBodyMat", 0x1a1a1a, { spec: 0.6, specPow: 64 });
  state.shadowGen.addShadowCaster(body);

  const mag = box("smgPickupMag", 0.1, 0.3, 0.15, group);
  mag.position.set(0, -0.2, 0.1);
  mag.material = stdMat("smgPickupMagMat", 0x2a2a2a, { spec: 0.4, specPow: 32 });

  const glowMat = new BABYLON.StandardMaterial("smgGlowMat", state.scene);
  glowMat.diffuseColor = c3(0xffaa00);
  glowMat.alpha = 0.2;
  const glow = BABYLON.MeshBuilder.CreateSphere(
    "smgGlow",
    { diameter: 1.2, segments: 16 },
    state.scene,
  );
  glow.material = glowMat;
  glow.parent = group;

  group.position.set(0, 1.2, 0);
  return group;
}
