import * as THREE from "three";
import { state } from "./state.js";
import { cacheDOMElements, updateAmmoDisplay } from "./ui.js";
import { createArena } from "./arena.js";
import { createPlayer, createBot, createGun } from "./entities.js";
import { spawnBulletDrops } from "./pickups.js";
import { setupEventListeners } from "./events.js";
import { startLoop } from "./loop.js";

// ============================================================
// Init — sets up Three.js, scene, entities, then starts loop
// ============================================================

export function init() {
  cacheDOMElements();

  // Scene
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0xd0e0f0);
  state.scene.fog = new THREE.Fog(0xd0e0f0, 15, 45);

  // Lighting
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(5, 15, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.camera.left = -20;
  dirLight.shadow.camera.right = 20;
  dirLight.shadow.camera.top = 20;
  dirLight.shadow.camera.bottom = -20;
  state.scene.add(dirLight);
  state.scene.add(new THREE.AmbientLight(0xaabbff, 0.6));

  // Camera
  state.camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.2,
    100,
  );

  // Renderer — uses the #canvas element from index.html
  state.renderer = new THREE.WebGLRenderer({
    antialias: true,
    canvas: state.dom.canvas,
  });
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  state.renderer.shadowMap.enabled = true;
  state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  createArena();

  // Precompute crate bounding boxes (static, only done once)
  for (const crate of state.crates) {
    crate.updateMatrixWorld(true);
    state.crateBounds.push(new THREE.Box3().setFromObject(crate));
  }

  state.playerGroup = createPlayer();
  state.botGroup = createBot();

  spawnBulletDrops(5);

  // Hide player model — first-person game
  state.playerGroup.visible = false;

  // Attach gun to camera for first-person view
  state.playerGun = createGun();
  state.camera.add(state.playerGun);
  state.scene.add(state.camera);

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
