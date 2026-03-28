const BABYLON = window.BABYLON;
import { state } from "./state.js";
import { cacheDOMElements, updateAmmoDisplay } from "./ui.js";
import { createArena } from "./arena.js";
import { createPlayer, createBot, createGun } from "./entities.js";
import { spawnBulletDrops } from "./pickups.js";
import { setupEventListeners } from "./events.js";
import { startLoop } from "./loop.js";
import { c3 } from "../utils/colors.js";

// ============================================================
// Init — sets up Babylon.js engine, scene, entities, then starts loop
// ============================================================

export function init() {
  cacheDOMElements();

  // Engine — takes over the #canvas element
  state.engine = new BABYLON.Engine(state.dom.canvas, true /* antialias */);
  // Do not override hardware scaling — let Babylon handle DPI natively

  // Scene
  state.scene = new BABYLON.Scene(state.engine);
  state.scene.clearColor = new BABYLON.Color4(0.816, 0.878, 0.941, 1.0); // 0xd0e0f0
  state.scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
  state.scene.fogColor = new BABYLON.Color3(0.816, 0.878, 0.941);
  state.scene.fogStart = 15;
  state.scene.fogEnd = 45;

  // Lighting
  // Directional (sun) — only light that casts shadows for performance
  const dirLight = new BABYLON.DirectionalLight(
    "dirLight",
    new BABYLON.Vector3(-5, -15, -5),
    state.scene,
  );
  dirLight.intensity = 1.5;
  dirLight.position = new BABYLON.Vector3(5, 15, 5);

  // Shadow generator — 1024 map, PCF soft for quality/performance balance
  state.shadowGen = new BABYLON.ShadowGenerator(1024, dirLight);
  state.shadowGen.useBlurExponentialShadowMap = true;

  // Hemisphere ambient (replaces AmbientLight, more realistic fill light)
  const hemiLight = new BABYLON.HemisphericLight(
    "hemiLight",
    new BABYLON.Vector3(0, 1, 0),
    state.scene,
  );
  hemiLight.diffuse = c3(0xaabbff);
  hemiLight.groundColor = c3(0x334455);
  hemiLight.intensity = 0.6;

  // First-person camera — manual rotation, no built-in input
  state.camera = new BABYLON.UniversalCamera(
    "camera",
    new BABYLON.Vector3(0, 1.6, 0),
    state.scene,
  );
  state.camera.fov = 75 * (Math.PI / 180);
  state.camera.minZ = 0.2;
  state.camera.maxZ = 100;
  // Detach all built-in controls — we drive it manually
  state.camera.inputs.clear();

  // Build the arena
  createArena();

  // Pre-compute crate AABB bounds (static geometry, computed once)
  for (const crate of state.crates) {
    crate.computeWorldMatrix(true);
    const bi = crate.getBoundingInfo();
    state.crateBounds.push({
      min: bi.boundingBox.minimumWorld.clone(),
      max: bi.boundingBox.maximumWorld.clone(),
    });
  }

  state.playerGroup = createPlayer();
  state.botGroup = createBot();

  spawnBulletDrops(5);

  // Player model hidden — first-person game
  state.playerGroup.setEnabled(false);

  // Attach first-person gun to camera
  state.playerGun = createGun();
  state.playerGun.parent = state.camera;
  state.playerMuzzle = state.playerGun.getChildTransformNodes().find(n => n.name === "muzzle");

  // Load saved player name
  const savedName = localStorage.getItem("playerName");
  if (savedName && state.dom.nameInput) {
    state.dom.nameInput.value = savedName;
  }

  // Init health displays
  state.dom.healthFill.style.width = "100%";
  state.dom.botHealthFill.style.width = "100%";
  updateAmmoDisplay();

  setupEventListeners();
  startLoop();
}
