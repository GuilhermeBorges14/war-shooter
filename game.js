import * as THREE from "three";

// ============================================================
// Constants — game tuning
// ============================================================
const ARENA_SIZE = 24;
const WALL_HEIGHT = 6;
const MOVE_SPEED = 7; // units per second
const MOVE_SMOOTH = 12; // lerp factor for smooth movement
const BULLET_SPEED = 4.0; // player bullet velocity
const BOT_BULLET_SPEED = 7.0; // enemy bullets are faster!
const BULLET_RANGE = 40;
const PLAYER_HEALTH = 100;
const BOT_HEALTH = 300;
const BOT_SHOOT_INTERVAL = 1200;
const BOT_MOVE_SPEED = 2.5;
const DAMAGE = 14; // 7 hits to win/lose (100 / 14 ≈ 7.14)
const PLAYER_RADIUS = 0.5; // collision radius
const MAX_BULLETS = 10; // maximum ammo capacity (normal gun)
const MAX_BULLETS_SMG = 40; // maximum ammo capacity (SMG)
const STARTING_BULLETS = 7; // starting ammo
const BULLETS_PER_PICKUP = 3; // ammo per pickup

// Constants — distances / thresholds
const EYE_HEIGHT = 1.6;
const ENTITY_BOUND = ARENA_SIZE / 2 - PLAYER_RADIUS;
const PICKUP_COLLECT_DIST = 1.2;
const SMG_COLLECT_DIST = 1.5;
const BOT_FAR_DIST = 8;
const BOT_MED_DIST = 4;
const BOT_STRAFE_MULT = 0.4;
const SMG_SPAWN_DELAY = 10000;
const DROP_RESPAWN_DELAY = 3000;
const MOUSE_SENSITIVITY = 0.002;
const MAX_PITCH = Math.PI / 2 - 0.1;

// ============================================================
// State
// ============================================================
let scene, camera, renderer;
let playerGroup, botGroup;
let playerMesh, botMesh;
let botGunRef = null;
let playerHealth = PLAYER_HEALTH;
let botHealth = BOT_HEALTH;
let botMaxHealth = BOT_HEALTH;
let playerBullets = STARTING_BULLETS;
let bullets = [];
let botBullets = [];
let crates = [];
let bulletDrops = [];
let keys = {};
let pointerLocked = false;
let gameStarted = false;
let gameOver = false;
let botShootTimer = 0;
let botTargetAngle = 0;
let playerVelocity = new THREE.Vector3(0, 0, 0);
let fullAmmoMessageTime = 0;
let hasSMG = false;
let smgPickup = null;
let playerGun = null;
let gameStartTime = 0;
let smgSpawned = false;
let smgPopupShown = false;
let botMoveSpeed = BOT_MOVE_SPEED;
let yaw = 0;
let pitch = 0;
const clock = new THREE.Clock();

// ============================================================
// Scratch objects (reused each frame to avoid GC pressure)
// ============================================================
const _yAxis = new THREE.Vector3(0, 1, 0);
const _zeroVec = new THREE.Vector3(0, 0, 0);
const _inputVec = new THREE.Vector3();
const _scratchVec = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();
let crateBounds = [];

// ============================================================
// DOM cache
// ============================================================
const dom = {};

function cacheDOMElements() {
  dom.ammoCount = document.getElementById("ammo-count");
  dom.ammoCounter = document.getElementById("ammo-counter");
  dom.noAmmoMsg = document.getElementById("no-ammo-message");
  dom.fullAmmoMsg = document.getElementById("full-ammo-message");
  dom.healthFill = document.getElementById("health-fill");
  dom.botHealthFill = document.getElementById("bot-health-fill");
  dom.message = document.getElementById("message");
  dom.restartBtn = document.getElementById("restart-btn");
  dom.smgPopup = document.getElementById("smg-popup");
  dom.smgConfirm = document.getElementById("smg-confirm");
  dom.smgCancel = document.getElementById("smg-cancel");
  dom.startScreen = document.getElementById("start-screen");
  dom.startBtn = document.getElementById("start-btn");
  dom.nameInput = document.getElementById("player-name-input");
  dom.playerNameDisplay = document.getElementById("player-name-display");
  dom.playerHealthLabel = document.getElementById("player-health-label");
  dom.minimap = document.getElementById("minimap");
  dom.minimapCtx = dom.minimap ? dom.minimap.getContext("2d") : null;
}

// ============================================================
// Audio — procedural via Web Audio API
// ============================================================
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playShootSound() {
  const bufferSize = audioContext.sampleRate * 0.08;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = audioContext.createBufferSource();
  noise.buffer = buffer;
  const filter = audioContext.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 800;
  filter.Q.value = 1.5;
  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(3.0, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
  noise.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);
  noise.start(audioContext.currentTime);
  noise.stop(audioContext.currentTime + 0.08);
}

function playHitSound() {
  const impactBufferSize = audioContext.sampleRate * 0.05;
  const impactBuffer = audioContext.createBuffer(1, impactBufferSize, audioContext.sampleRate);
  const impactData = impactBuffer.getChannelData(0);
  for (let i = 0; i < impactBufferSize; i++) {
    const envelope = Math.exp(-i / (impactBufferSize * 0.15));
    impactData[i] = (Math.random() * 2 - 1) * envelope;
  }
  const impact = audioContext.createBufferSource();
  impact.buffer = impactBuffer;
  const impactFilter = audioContext.createBiquadFilter();
  impactFilter.type = "bandpass";
  impactFilter.frequency.value = 600;
  impactFilter.Q.value = 2;
  const impactGain = audioContext.createGain();
  impactGain.gain.setValueAtTime(0.7, audioContext.currentTime);
  impactGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
  impact.connect(impactFilter);
  impactFilter.connect(impactGain);
  impactGain.connect(audioContext.destination);
  impact.start(audioContext.currentTime);

  // Delayed grunt
  setTimeout(() => {
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);
    osc.frequency.setValueAtTime(170, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, audioContext.currentTime + 0.18);
    osc.type = "sawtooth";
    filter.type = "lowpass";
    filter.frequency.value = 700;
    filter.Q.value = 2.5;
    gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.18);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.18);
  }, 30);
}

function playPainSound() {
  const osc = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);
  osc.frequency.setValueAtTime(220, audioContext.currentTime);
  osc.frequency.linearRampToValueAtTime(250, audioContext.currentTime + 0.08);
  osc.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.25);
  osc.type = "triangle";
  filter.type = "lowpass";
  filter.frequency.value = 1000;
  filter.Q.value = 1.5;
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.6, audioContext.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + 0.25);
}

function playEmptyClickSound() {
  const osc = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);
  osc.frequency.setValueAtTime(1200, audioContext.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.05);
  osc.type = "square";
  filter.type = "highpass";
  filter.frequency.value = 600;
  filter.Q.value = 2;
  gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + 0.05);
}

function playSMGSpawnSound() {
  const osc = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);
  osc.frequency.setValueAtTime(200, audioContext.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);
  osc.type = "sine";
  filter.type = "bandpass";
  filter.frequency.value = 500;
  filter.Q.value = 1.5;
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.05);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + 0.3);
}

// ============================================================
// Shared geometry (created once, reused by all entities)
// ============================================================
const _humanBodyGeo = new THREE.BoxGeometry(0.7, 1.0, 0.4);
const _humanHeadGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const _humanArmGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
const _humanLegGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);

// ============================================================
// Entity factories
// ============================================================

function createHumanoid({ bodyColor, headColor, legColor }) {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.7,
    metalness: 0.2,
  });
  const body = new THREE.Mesh(_humanBodyGeo, bodyMat);
  body.position.y = 1.0;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const headMat = new THREE.MeshStandardMaterial({
    color: headColor,
    roughness: 0.8,
    metalness: 0.1,
  });
  const head = new THREE.Mesh(_humanHeadGeo, headMat);
  head.position.y = 1.7;
  head.castShadow = true;
  group.add(head);

  const armMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.7,
    metalness: 0.2,
  });
  const armL = new THREE.Mesh(_humanArmGeo, armMat);
  armL.position.set(-0.5, 0.9, 0);
  armL.castShadow = true;
  group.add(armL);

  const armR = new THREE.Mesh(_humanArmGeo, armMat);
  armR.position.set(0.5, 0.9, 0);
  armR.castShadow = true;
  group.add(armR);

  const legMat = new THREE.MeshStandardMaterial({
    color: legColor,
    roughness: 0.8,
    metalness: 0.15,
  });
  const legL = new THREE.Mesh(_humanLegGeo, legMat);
  legL.position.set(-0.2, 0.4, 0);
  legL.castShadow = true;
  group.add(legL);

  const legR = new THREE.Mesh(_humanLegGeo, legMat);
  legR.position.set(0.2, 0.4, 0);
  legR.castShadow = true;
  group.add(legR);

  return { group, body };
}

function createPlayer() {
  const { group, body } = createHumanoid({
    bodyColor: 0x2a5a8a,
    headColor: 0xffdbac,
    legColor: 0x1a3a5a,
  });

  playerMesh = body;
  group.position.set(0, 0, 0);
  scene.add(group);
  return group;
}

function createBot() {
  const { group, body } = createHumanoid({
    bodyColor: 0x8a2a2a,
    headColor: 0x3a3a3a,
    legColor: 0x5a1a1a,
  });

  // Eyes (glowing red)
  const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.8,
  });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.08, 1.75, 0.2);
  eyeR.position.set(0.08, 1.75, 0.2);
  group.add(eyeL, eyeR);

  // Gun in hand
  const botGun = createPistolModel({
    sightColor: 0xff0000,
    sightEmissive: 0xff0000,
    sightIntensity: 0.4,
  });
  botGun.position.set(0.5, 0.5, 0.3);
  botGun.rotation.x = 0;
  botGun.rotation.y = 0;
  group.add(botGun);

  botGunRef = botGun;
  botMesh = body;
  group.position.set(8, 0, 8);
  scene.add(group);
  return group;
}

function createPistolModel({
  sightColor = 0xff4444,
  sightEmissive = 0xff0000,
  sightIntensity = 0.3,
} = {}) {
  const gunGroup = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(0.08, 0.12, 0.5);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.6,
    metalness: 0.5,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.z = -0.15;
  body.castShadow = true;
  gunGroup.add(body);

  const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.4,
    metalness: 0.7,
  });
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.position.set(0, 0.02, -0.45);
  barrel.rotation.x = Math.PI / 2;
  barrel.castShadow = true;
  gunGroup.add(barrel);

  const handleGeo = new THREE.BoxGeometry(0.06, 0.15, 0.08);
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0x3a2a1a,
    roughness: 0.8,
    metalness: 0.2,
  });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.set(0, -0.12, -0.05);
  handle.castShadow = true;
  gunGroup.add(handle);

  const sightGeo = new THREE.BoxGeometry(0.015, 0.03, 0.015);
  const sightMat = new THREE.MeshStandardMaterial({
    color: sightColor,
    emissive: sightEmissive,
    emissiveIntensity: sightIntensity,
  });
  const sight = new THREE.Mesh(sightGeo, sightMat);
  sight.position.set(0, 0.08, -0.35);
  sight.castShadow = true;
  gunGroup.add(sight);

  return gunGroup;
}

function createGun() {
  const gunGroup = createPistolModel();
  gunGroup.position.set(0.25, -0.25, -0.4);
  gunGroup.rotation.y = -0.1;
  return gunGroup;
}

function createSMG() {
  const gunGroup = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(0.1, 0.15, 0.7);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.5,
    metalness: 0.6,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.z = -0.2;
  body.castShadow = true;
  gunGroup.add(body);

  const barrelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8);
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    roughness: 0.3,
    metalness: 0.8,
  });
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.position.set(0, 0.03, -0.55);
  barrel.rotation.x = Math.PI / 2;
  barrel.castShadow = true;
  gunGroup.add(barrel);

  const magGeo = new THREE.BoxGeometry(0.08, 0.25, 0.12);
  const magMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.7,
    metalness: 0.4,
  });
  const mag = new THREE.Mesh(magGeo, magMat);
  mag.position.set(0, -0.15, -0.1);
  mag.castShadow = true;
  gunGroup.add(mag);

  const handleGeo = new THREE.BoxGeometry(0.07, 0.18, 0.1);
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0x3a2a1a,
    roughness: 0.8,
    metalness: 0.2,
  });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.set(0, -0.2, 0);
  handle.castShadow = true;
  gunGroup.add(handle);

  const sightGeo = new THREE.BoxGeometry(0.02, 0.04, 0.02);
  const sightMat = new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    emissive: 0xffaa00,
    emissiveIntensity: 0.4,
  });
  const sight = new THREE.Mesh(sightGeo, sightMat);
  sight.position.set(0, 0.1, -0.4);
  gunGroup.add(sight);

  gunGroup.position.set(0.25, -0.25, -0.4);
  gunGroup.rotation.y = -0.1;

  return gunGroup;
}

function createSMGPickup() {
  const group = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(0.15, 0.2, 0.9);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.5,
    metalness: 0.6,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  group.add(body);

  const magGeo = new THREE.BoxGeometry(0.1, 0.3, 0.15);
  const magMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.7,
    metalness: 0.4,
  });
  const mag = new THREE.Mesh(magGeo, magMat);
  mag.position.set(0, -0.2, 0.1);
  mag.castShadow = true;
  group.add(mag);

  const glowGeo = new THREE.SphereGeometry(0.6, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.2,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  group.add(glow);

  group.position.set(0, 1.2, 0);
  return group;
}

// ============================================================
// Arena
// ============================================================

function createArena() {
  const half = ARENA_SIZE / 2;

  // Floor with tile grid
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
  const gridLines = [];
  for (let x = -half; x <= half; x += gridStep) {
    gridLines.push(
      new THREE.Vector3(x, 0.01, -half),
      new THREE.Vector3(x, 0.01, half),
    );
  }
  for (let z = -half; z <= half; z += gridStep) {
    gridLines.push(
      new THREE.Vector3(-half, 0.01, z),
      new THREE.Vector3(half, 0.01, z),
    );
  }
  const gridGeo = new THREE.BufferGeometry().setFromPoints(gridLines);
  const grid = new THREE.LineSegments(gridGeo, gridMat);
  scene.add(grid);

  // Walls with trim
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
  const walls = [
    [0, 0, -half],
    [0, 0, half],
    [-half, 0, 0],
    [half, 0, 0],
  ];
  const rotations = [0, 0, Math.PI / 2, Math.PI / 2];
  walls.forEach((pos, i) => {
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(pos[0], WALL_HEIGHT / 2, pos[2]);
    wall.rotation.y = rotations[i];
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    const trimGeo = new THREE.BoxGeometry(ARENA_SIZE + 1.2, 0.3, 1.2);
    const trim = new THREE.Mesh(trimGeo, wallTrimMat);
    trim.position.set(pos[0], 0.15, pos[2]);
    trim.rotation.y = rotations[i];
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

  // Crates / barriers as cover
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0xc8a070,
    roughness: 0.9,
    metalness: 0.05,
  });
  const crateGeo = new THREE.BoxGeometry(1.5, 1.2, 1.2);
  const cratePositions = [
    [-5, 0.6, -4],
    [6, 0.6, 5],
    [-6, 0.6, 6],
    [4, 0.6, -6],
  ];
  cratePositions.forEach(([x, y, z]) => {
    const crate = new THREE.Mesh(crateGeo, crateMat);
    crate.position.set(x, y, z);
    crate.castShadow = true;
    crate.receiveShadow = true;
    scene.add(crate);
    crates.push(crate);
  });

  // Wall lights
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffffcc,
    emissive: 0xffffaa,
    emissiveIntensity: 0.6,
  });
  const lightPanelGeo = new THREE.BoxGeometry(1.5, 0.4, 0.15);
  const wallLightPositions = [
    [-half + 2, WALL_HEIGHT - 1.5, -half],
    [half - 2, WALL_HEIGHT - 1.5, -half],
    [-half + 2, WALL_HEIGHT - 1.5, half],
    [half - 2, WALL_HEIGHT - 1.5, half],
    [-half, WALL_HEIGHT - 1.5, 2],
    [-half, WALL_HEIGHT - 1.5, -2],
    [half, WALL_HEIGHT - 1.5, 2],
    [half, WALL_HEIGHT - 1.5, -2],
  ];
  wallLightPositions.forEach(([x, y, z]) => {
    const panel = new THREE.Mesh(lightPanelGeo, lightMat);
    panel.position.set(x, y, z);
    scene.add(panel);
    const pointLight = new THREE.PointLight(0xffffcc, 1.2, 12);
    pointLight.position.set(x, y, z);
    pointLight.castShadow = true;
    scene.add(pointLight);
  });
}

// ============================================================
// Bullet / combat system
// ============================================================

function shoot(fromPosition, direction, isPlayerBullet, bulletSpeed) {
  playShootSound();

  const bulletGroup = new THREE.Group();

  const geo = new THREE.CapsuleGeometry(0.03, 0.15, 4, 8);
  const mat = new THREE.MeshStandardMaterial({
    color: isPlayerBullet ? 0x44ff44 : 0xff4444,
    emissive: isPlayerBullet ? 0x22ff22 : 0xff2222,
    emissiveIntensity: 0.6,
  });
  const bulletMesh = new THREE.Mesh(geo, mat);
  bulletGroup.add(bulletMesh);

  const glowGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: isPlayerBullet ? 0x44ff44 : 0xff4444,
    transparent: true,
    opacity: 0.4,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  bulletGroup.add(glow);

  bulletGroup.position.copy(fromPosition);
  const dir = direction.clone().normalize();

  const axis = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, dir);
  bulletGroup.quaternion.copy(quaternion);

  const data = {
    mesh: bulletGroup,
    velocity: dir.multiplyScalar(bulletSpeed),
    isPlayer: isPlayerBullet,
    life: BULLET_RANGE / bulletSpeed,
  };
  scene.add(bulletGroup);
  if (isPlayerBullet) bullets.push(data);
  else botBullets.push(data);
}

function updateBulletList(list, targetGroup, hitRadius, onHit, dt) {
  const wallBound = ARENA_SIZE / 2 - 0.5;
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    b.mesh.position.add(_scratchVec.copy(b.velocity).multiplyScalar(dt));
    b.mesh.quaternion.copy(
      _scratchQuat.setFromUnitVectors(
        _yAxis,
        _scratchVec.copy(b.velocity).normalize(),
      ),
    );
    b.life -= dt;

    if (
      Math.abs(b.mesh.position.x) > wallBound ||
      Math.abs(b.mesh.position.z) > wallBound
    ) {
      scene.remove(b.mesh);
      list.splice(i, 1);
      continue;
    }

    if (b.life <= 0) {
      scene.remove(b.mesh);
      list.splice(i, 1);
      continue;
    }

    let hitCrate = false;
    for (let c = 0; c < crateBounds.length; c++) {
      if (crateBounds[c].containsPoint(b.mesh.position)) {
        scene.remove(b.mesh);
        list.splice(i, 1);
        hitCrate = true;
        break;
      }
    }
    if (hitCrate) continue;

    _scratchVec.set(0, 1, 0).applyMatrix4(targetGroup.matrixWorld);
    if (b.mesh.position.distanceTo(_scratchVec) < hitRadius) {
      scene.remove(b.mesh);
      list.splice(i, 1);
      onHit(_scratchVec);
    }
  }
}

function showHitmarker(worldPosition) {
  const vector = worldPosition.clone();
  vector.project(camera);

  const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

  const hitmarker = document.createElement("div");
  hitmarker.style.position = "absolute";
  hitmarker.style.left = x + "px";
  hitmarker.style.top = y + "px";
  hitmarker.style.transform = "translate(-50%, -50%)";
  hitmarker.style.width = "40px";
  hitmarker.style.height = "40px";
  hitmarker.style.pointerEvents = "none";
  hitmarker.style.zIndex = "999";
  hitmarker.style.opacity = "1";
  hitmarker.style.transition = "opacity 0.3s ease";

  hitmarker.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 40 40" style="filter: drop-shadow(0 0 4px rgba(220, 38, 38, 0.8));">
      <line x1="8" y1="8" x2="32" y2="32" stroke="#dc2626" stroke-width="3" stroke-linecap="round"/>
      <line x1="32" y1="8" x2="8" y2="32" stroke="#dc2626" stroke-width="3" stroke-linecap="round"/>
      <circle cx="20" cy="20" r="3" fill="#dc2626" opacity="0.6"/>
    </svg>
  `;

  document.body.appendChild(hitmarker);

  setTimeout(() => {
    hitmarker.style.opacity = "0";
    setTimeout(() => {
      if (hitmarker.parentNode) {
        hitmarker.parentNode.removeChild(hitmarker);
      }
    }, 300);
  }, 100);
}

// ============================================================
// Pickup system
// ============================================================

function createBulletDrop(x, z) {
  const dropGroup = new THREE.Group();

  const crateGeo = new THREE.BoxGeometry(0.5, 0.35, 0.35);
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x5a6b3e,
    metalness: 0.3,
    roughness: 0.8,
  });
  const crate = new THREE.Mesh(crateGeo, crateMat);
  crate.castShadow = true;
  dropGroup.add(crate);

  const bandMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    metalness: 0.7,
    roughness: 0.4,
  });

  const bandGeoHorizontal = new THREE.BoxGeometry(0.52, 0.04, 0.37);
  const topBand = new THREE.Mesh(bandGeoHorizontal, bandMat);
  topBand.position.y = 0.12;
  dropGroup.add(topBand);

  const bottomBand = new THREE.Mesh(bandGeoHorizontal, bandMat);
  bottomBand.position.y = -0.12;
  dropGroup.add(bottomBand);

  const bandGeoVertical = new THREE.BoxGeometry(0.04, 0.37, 0.37);
  const verticalBand = new THREE.Mesh(bandGeoVertical, bandMat);
  dropGroup.add(verticalBand);

  const labelGeo = new THREE.BoxGeometry(0.15, 0.15, 0.02);
  const labelMat = new THREE.MeshStandardMaterial({
    color: 0xf5f5dc,
    emissive: 0xf5f5dc,
    emissiveIntensity: 0.3,
  });
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.position.set(0, 0, 0.18);
  dropGroup.add(label);

  const numberGeo = new THREE.BoxGeometry(0.08, 0.1, 0.01);
  const numberMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const number = new THREE.Mesh(numberGeo, numberMat);
  number.position.set(0, 0, 0.19);
  dropGroup.add(number);

  const glowGeo = new THREE.SphereGeometry(0.35, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.15,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  dropGroup.add(glow);

  dropGroup.position.set(x, 0.4, z);
  scene.add(dropGroup);

  return { mesh: dropGroup, spawnTime: Date.now() };
}

function spawnBulletDrops(count) {
  for (let i = 0; i < count; i++) {
    let x, z;
    do {
      x = (Math.random() - 0.5) * ARENA_SIZE * 0.8;
      z = (Math.random() - 0.5) * ARENA_SIZE * 0.8;
    } while (Math.abs(x) < 3 && Math.abs(z) < 3);

    const drop = createBulletDrop(x, z);
    bulletDrops.push(drop);
  }
}

function spawnSMGPickup() {
  const bound = ARENA_SIZE / 2 - 3;
  const x = (Math.random() * 2 - 1) * bound;
  const z = (Math.random() * 2 - 1) * bound;

  smgPickup = createSMGPickup();
  smgPickup.position.set(x, 1.2, z);
  scene.add(smgPickup);
  smgSpawned = true;

  playSMGSpawnSound();

  const notification = document.createElement("div");
  notification.className = "smg-notification";
  notification.textContent = "🔫 SUBMACHINE GUN SPAWNED!";
  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

// ============================================================
// UI / HUD
// ============================================================

function updateAmmoDisplay() {
  if (dom.ammoCount) {
    dom.ammoCount.textContent = playerBullets;
    if (playerBullets <= 3) {
      dom.ammoCount.style.color = "#ef4444";
    } else if (playerBullets <= 5) {
      dom.ammoCount.style.color = "#f59e0b";
    } else {
      dom.ammoCount.style.color = "#f1f5f9";
    }
  }
}

function updateBotHealthDisplay() {
  if (dom.botHealthFill)
    dom.botHealthFill.style.width =
      Math.max(0, (botHealth / botMaxHealth) * 100) + "%";
}

function drawMinimap() {
  if (!dom.minimapCtx) return;

  const ctx = dom.minimapCtx;
  const size = 180;
  const scale = size / ARENA_SIZE;

  ctx.fillStyle = "rgba(10, 15, 20, 0.95)";
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(100, 100, 120, 0.6)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(60, 60, 80, 0.3)";
  ctx.lineWidth = 0.5;
  const gridStep = 2 * scale;
  for (let i = gridStep; i < size; i += gridStep) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(150, 150, 160, 0.5)";
  for (const crate of crates) {
    const x = (crate.position.x + ARENA_SIZE / 2) * scale;
    const z = (crate.position.z + ARENA_SIZE / 2) * scale;
    const crateSize = 2 * scale;
    ctx.fillRect(x - crateSize / 2, z - crateSize / 2, crateSize, crateSize);
  }

  ctx.fillStyle = "#fbbf24";
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 1;
  for (const drop of bulletDrops) {
    const x = (drop.mesh.position.x + ARENA_SIZE / 2) * scale;
    const z = (drop.mesh.position.z + ARENA_SIZE / 2) * scale;
    ctx.beginPath();
    ctx.arc(x, z, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  const botX = (botGroup.position.x + ARENA_SIZE / 2) * scale;
  const botZ = (botGroup.position.z + ARENA_SIZE / 2) * scale;
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.arc(botX, botZ, 5, 0, Math.PI * 2);
  ctx.fill();

  const botAngle = botGroup.rotation.y;
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(botX, botZ);
  ctx.lineTo(
    botX - Math.sin(botAngle) * 10,
    botZ - Math.cos(botAngle) * 10,
  );
  ctx.stroke();

  const playerX = (playerGroup.position.x + ARENA_SIZE / 2) * scale;
  const playerZ = (playerGroup.position.z + ARENA_SIZE / 2) * scale;
  ctx.fillStyle = "#48bb78";
  ctx.beginPath();
  ctx.arc(playerX, playerZ, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#48bb78";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(playerX, playerZ);
  ctx.lineTo(
    playerX - Math.sin(yaw) * 12,
    playerZ - Math.cos(yaw) * 12,
  );
  ctx.stroke();
}

// ============================================================
// Bot AI
// ============================================================

function updateBotAI(dt) {
  const toPlayer = new THREE.Vector3()
    .subVectors(playerGroup.position, botGroup.position)
    .setY(0);
  const dist = toPlayer.length();
  if (dist > 0.01) {
    toPlayer.normalize();
    botTargetAngle = Math.atan2(-toPlayer.x, -toPlayer.z);
    const currentAngle = botGroup.rotation.y;
    let diff = botTargetAngle - currentAngle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    botGroup.rotation.y +=
      Math.sign(diff) * Math.min(Math.abs(diff), 3 * dt);

    if (dist > BOT_FAR_DIST) {
      botGroup.position.x +=
        Math.sin(botGroup.rotation.y) * -botMoveSpeed * dt;
      botGroup.position.z +=
        Math.cos(botGroup.rotation.y) * -botMoveSpeed * dt;
    } else if (dist > BOT_MED_DIST) {
      botGroup.position.x +=
        Math.sin(botGroup.rotation.y) * -botMoveSpeed * 0.6 * dt;
      botGroup.position.z +=
        Math.cos(botGroup.rotation.y) * -botMoveSpeed * 0.6 * dt;
    } else {
      const strafeAngle = botGroup.rotation.y + Math.PI / 2;
      const strafeDir = Math.sin(Date.now() * 0.001) > 0 ? 1 : -1;
      botGroup.position.x +=
        Math.sin(strafeAngle) * botMoveSpeed * BOT_STRAFE_MULT * strafeDir * dt;
      botGroup.position.z +=
        Math.cos(strafeAngle) * botMoveSpeed * BOT_STRAFE_MULT * strafeDir * dt;
    }

    botGroup.position.x = THREE.MathUtils.clamp(
      botGroup.position.x,
      -ENTITY_BOUND,
      ENTITY_BOUND,
    );
    botGroup.position.z = THREE.MathUtils.clamp(
      botGroup.position.z,
      -ENTITY_BOUND,
      ENTITY_BOUND,
    );
  }

  botShootTimer += dt * 1000;
  if (botShootTimer >= BOT_SHOOT_INTERVAL) {
    botShootTimer = 0;

    const botPos = new THREE.Vector3();
    if (botGunRef) {
      botGunRef.getWorldPosition(botPos);
      _scratchVec.set(0, 0, -1).applyAxisAngle(_yAxis, botGroup.rotation.y);
      botPos.add(_scratchVec.multiplyScalar(0.3));
    } else {
      botGroup.getWorldPosition(botPos);
      botPos.y += 1;
    }

    _scratchVec.set(0, 0, -1).applyAxisAngle(_yAxis, botGroup.rotation.y);
    shoot(botPos, _scratchVec, false, BOT_BULLET_SPEED);
  }
}

// ============================================================
// Player movement
// ============================================================

function updatePlayerMovement(dt) {
  _inputVec.set(0, 0, 0);
  if (keys["KeyW"] || keys["ArrowUp"]) _inputVec.z -= 1;
  if (keys["KeyS"] || keys["ArrowDown"]) _inputVec.z += 1;
  if (keys["KeyA"] || keys["ArrowLeft"]) _inputVec.x -= 1;
  if (keys["KeyD"] || keys["ArrowRight"]) _inputVec.x += 1;
  if (_inputVec.length() > 0) {
    _inputVec.normalize().multiplyScalar(MOVE_SPEED);
    _inputVec.applyAxisAngle(_yAxis, yaw);
    playerVelocity.lerp(_inputVec, MOVE_SMOOTH * dt);
  } else {
    playerVelocity.lerp(_zeroVec, MOVE_SMOOTH * dt);
  }

  const newX = playerGroup.position.x + playerVelocity.x * dt;
  const newZ = playerGroup.position.z + playerVelocity.z * dt;

  playerGroup.position.x = THREE.MathUtils.clamp(newX, -ENTITY_BOUND, ENTITY_BOUND);
  playerGroup.position.z = THREE.MathUtils.clamp(newZ, -ENTITY_BOUND, ENTITY_BOUND);

  camera.position.set(
    playerGroup.position.x,
    EYE_HEIGHT,
    playerGroup.position.z,
  );
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
  camera.rotation.z = 0;
}

// ============================================================
// Pickup updates (per-frame)
// ============================================================

function updatePickups(dt) {
  // Animate and check SMG pickup
  if (smgPickup && smgPickup.visible) {
    const time = Date.now() / 1000;
    smgPickup.position.y = 1.2 + Math.sin(time * 2) * 0.15;
    smgPickup.rotation.y += dt * 1.5;
  }

  if (smgPickup && smgPickup.visible && !smgPopupShown) {
    const playerPos2D = new THREE.Vector3(
      playerGroup.position.x,
      0,
      playerGroup.position.z,
    );
    const smgPos = new THREE.Vector3(
      smgPickup.position.x,
      0,
      smgPickup.position.z,
    );
    if (smgPos.distanceTo(playerPos2D) < SMG_COLLECT_DIST) {
      smgPopupShown = true;
      dom.smgPopup.style.display = "block";
      document.exitPointerLock();
    }
  }

  // Check for bullet drop pickups
  for (let i = bulletDrops.length - 1; i >= 0; i--) {
    const drop = bulletDrops[i];

    const elapsed = (Date.now() - drop.spawnTime) / 1000;
    drop.mesh.position.y = 0.4 + Math.sin(elapsed * 2) * 0.1;
    drop.mesh.rotation.y += dt * 2;

    const dropPos = new THREE.Vector3();
    drop.mesh.getWorldPosition(dropPos);
    const playerPos = new THREE.Vector3(
      playerGroup.position.x,
      0,
      playerGroup.position.z,
    );
    dropPos.y = 0;

    if (dropPos.distanceTo(playerPos) < PICKUP_COLLECT_DIST) {
      const currentMax = hasSMG ? MAX_BULLETS_SMG : MAX_BULLETS;
      if (playerBullets >= currentMax) {
        const now = Date.now();
        if (now - fullAmmoMessageTime > 1000) {
          fullAmmoMessageTime = now;
          if (dom.fullAmmoMsg) {
            dom.fullAmmoMsg.classList.add("show");
            setTimeout(() => dom.fullAmmoMsg.classList.remove("show"), 800);
          }
        }
        continue;
      }

      const bulletsToAdd = hasSMG ? 10 : BULLETS_PER_PICKUP;
      playerBullets = Math.min(playerBullets + bulletsToAdd, currentMax);
      updateAmmoDisplay();
      scene.remove(drop.mesh);
      bulletDrops.splice(i, 1);

      setTimeout(() => {
        if (!gameOver) {
          let x, z;
          do {
            x = (Math.random() - 0.5) * ARENA_SIZE * 0.8;
            z = (Math.random() - 0.5) * ARENA_SIZE * 0.8;
          } while (Math.abs(x) < 3 && Math.abs(z) < 3);

          const newDrop = createBulletDrop(x, z);
          bulletDrops.push(newDrop);
        }
      }, DROP_RESPAWN_DELAY);
    }
  }
}

// ============================================================
// Game lifecycle
// ============================================================

function endGame(won) {
  gameOver = true;
  dom.message.style.display = "block";
  dom.message.textContent = won ? "You win!" : "You lose!";
  dom.message.className = won ? "win" : "lose";
  document.exitPointerLock();
  dom.restartBtn.style.display = "block";
}

function restartGame() {
  gameStarted = true;
  gameOver = false;
  playerHealth = PLAYER_HEALTH;
  botHealth = BOT_HEALTH;
  botMaxHealth = BOT_HEALTH;
  botShootTimer = 0;
  playerBullets = STARTING_BULLETS;
  hasSMG = false;
  gameStartTime = Date.now();
  smgSpawned = false;
  smgPopupShown = false;
  botMoveSpeed = BOT_MOVE_SPEED;
  playerVelocity.set(0, 0, 0);

  // Reset gun to default
  camera.remove(playerGun);
  playerGun = createGun();
  camera.add(playerGun);

  // Remove old SMG pickup
  if (smgPickup) {
    scene.remove(smgPickup);
    smgPickup = null;
  }

  // Clear bullets
  bullets.forEach((b) => scene.remove(b.mesh));
  botBullets.forEach((b) => scene.remove(b.mesh));
  bullets = [];
  botBullets = [];

  // Clear old bullet drops and spawn new ones
  bulletDrops.forEach((drop) => scene.remove(drop.mesh));
  bulletDrops = [];
  spawnBulletDrops(5);

  // Reset positions
  playerGroup.position.set(0, 0, 0);
  botGroup.position.set(8, 0, 8);
  playerGroup.rotation.y = 0;
  botGroup.rotation.y = 0;
  yaw = 0;
  pitch = 0;

  // Reset health displays
  dom.healthFill.style.width = "100%";
  dom.botHealthFill.style.width = "100%";
  updateAmmoDisplay();

  // Keep player name displayed
  const savedName = localStorage.getItem("playerName");
  if (dom.playerNameDisplay && savedName) {
    dom.playerNameDisplay.textContent = savedName;
  }
  if (dom.playerHealthLabel && savedName) {
    dom.playerHealthLabel.textContent = savedName + "'s Health";
  }

  // Hide message and restart button
  dom.message.style.display = "none";
  dom.restartBtn.style.display = "none";

  renderer.domElement.requestPointerLock();
}

// ============================================================
// Event handlers
// ============================================================

function handleMouseDown(e) {
  if (e.button !== 2 || !pointerLocked || gameOver) return;

  if (playerBullets <= 0) {
    playEmptyClickSound();
    dom.ammoCounter.classList.add("shake");
    setTimeout(() => dom.ammoCounter.classList.remove("shake"), 300);
    dom.noAmmoMsg.classList.add("show");
    setTimeout(() => dom.noAmmoMsg.classList.remove("show"), 800);
    return;
  }

  const pos = new THREE.Vector3();
  const dir = new THREE.Vector3();
  camera.getWorldPosition(pos);
  camera.getWorldDirection(dir);
  pos.addScaledVector(dir, 0.6);

  if (hasSMG) {
    const bulletsToShoot = Math.min(3, playerBullets);
    for (let i = 0; i < bulletsToShoot; i++) {
      setTimeout(() => {
        const pos = new THREE.Vector3();
        const dir = new THREE.Vector3();
        camera.getWorldPosition(pos);
        camera.getWorldDirection(dir);
        pos.addScaledVector(dir, 0.6);
        shoot(pos, dir, true, BULLET_SPEED);
      }, i * 100);
    }
    playerBullets -= bulletsToShoot;
  } else {
    shoot(pos, dir, true, BULLET_SPEED);
    playerBullets--;
  }

  updateAmmoDisplay();
}

function handleKeyDown(e) {
  if (
    (dom.startScreen && dom.startScreen.style.display !== "none") ||
    document.activeElement === dom.nameInput
  )
    return;

  keys[e.code] = true;
  if (e.code === "Space") e.preventDefault();
}

function handleKeyUp(e) {
  if (
    (dom.startScreen && dom.startScreen.style.display !== "none") ||
    document.activeElement === dom.nameInput
  )
    return;

  keys[e.code] = false;
}

function handleMouseMove(e) {
  if (!pointerLocked || gameOver) return;

  yaw -= e.movementX * MOUSE_SENSITIVITY;
  pitch -= e.movementY * MOUSE_SENSITIVITY;
  pitch = THREE.MathUtils.clamp(pitch, -MAX_PITCH, MAX_PITCH);

  playerGroup.rotation.y = yaw;
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function handlePointerLockChange() {
  pointerLocked = document.pointerLockElement === renderer.domElement;
}

function handleStartGame() {
  const playerName = dom.nameInput?.value.trim() || "Player";
  localStorage.setItem("playerName", playerName);

  if (dom.playerNameDisplay) {
    dom.playerNameDisplay.textContent = playerName;
  }
  if (dom.playerHealthLabel) {
    dom.playerHealthLabel.textContent = playerName + "'s Health";
  }

  if (dom.startScreen) {
    dom.startScreen.style.display = "none";
  }
  gameStarted = true;
  gameStartTime = Date.now();
  smgSpawned = false;
  renderer.domElement.requestPointerLock();
}

function handleSMGConfirm() {
  hasSMG = true;
  playerBullets = MAX_BULLETS_SMG;
  updateAmmoDisplay();

  botMaxHealth = BOT_HEALTH * 3;
  botHealth = botMaxHealth;
  if (dom.botHealthFill) {
    dom.botHealthFill.style.width = "100%";
  }

  botMoveSpeed = BOT_MOVE_SPEED * 1.25;

  if (smgPickup) {
    smgPickup.visible = false;
  }
  dom.smgPopup.style.display = "none";

  camera.remove(playerGun);
  playerGun = createSMG();
  camera.add(playerGun);

  renderer.domElement.requestPointerLock();
}

function handleSMGCancel() {
  dom.smgPopup.style.display = "none";
  smgPopupShown = false;
  renderer.domElement.requestPointerLock();
}

// ============================================================
// Game loop
// ============================================================

function update() {
  requestAnimationFrame(update);

  let dt = clock.getDelta();
  if (dt > 0.1) dt = 0.016;

  // Always render (for start screen visibility)
  if (!gameStarted || gameOver) {
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(scene, camera);
    return;
  }

  updatePlayerMovement(dt);

  // Spawn SMG after configured delay
  if (!smgSpawned && !hasSMG && Date.now() - gameStartTime >= SMG_SPAWN_DELAY) {
    spawnSMGPickup();
  }

  updatePickups(dt);
  updateBotAI(dt);

  // Update bullets
  updateBulletList(
    bullets,
    botGroup,
    1,
    (hitPos) => {
      botHealth -= DAMAGE;
      playHitSound();
      showHitmarker(hitPos);
      updateBotHealthDisplay();
      if (botHealth <= 0) endGame(true);
    },
    dt,
  );

  updateBulletList(
    botBullets,
    playerGroup,
    1.2,
    () => {
      playerHealth -= DAMAGE;
      playPainSound();
      dom.healthFill.style.width =
        (playerHealth / PLAYER_HEALTH) * 100 + "%";
      if (playerHealth <= 0) endGame(false);
    },
    dt,
  );

  // Render scene
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.setScissorTest(false);
  renderer.render(scene, camera);

  drawMinimap();
}

// ============================================================
// Init & bootstrap
// ============================================================

function init() {
  cacheDOMElements();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd0e0f0);
  scene.fog = new THREE.Fog(0xd0e0f0, 15, 45);

  const light = new THREE.DirectionalLight(0xffffff, 1.5);
  light.position.set(5, 15, 5);
  light.castShadow = true;
  light.shadow.mapSize.width = 1024;
  light.shadow.mapSize.height = 1024;
  light.shadow.camera.near = 0.5;
  light.shadow.camera.far = 50;
  light.shadow.camera.left = -20;
  light.shadow.camera.right = 20;
  light.shadow.camera.top = 20;
  light.shadow.camera.bottom = -20;
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xaabbff, 0.6));

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.2,
    100,
  );
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas: dom.canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  createArena();

  // Precompute crate bounding boxes (static, computed once)
  for (const crate of crates) {
    crate.updateMatrixWorld(true);
    crateBounds.push(new THREE.Box3().setFromObject(crate));
  }

  playerGroup = createPlayer();
  botGroup = createBot();

  spawnBulletDrops(5);

  // Hide player model in first-person view
  playerGroup.visible = false;

  // Create and attach gun to camera for first-person view
  playerGun = createGun();
  camera.add(playerGun);
  scene.add(camera);

  // Load saved player name
  const savedName = localStorage.getItem("playerName");
  if (savedName && dom.nameInput) {
    dom.nameInput.value = savedName;
  }

  // Prevent game controls while typing in name input
  if (dom.nameInput) {
    dom.nameInput.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") dom.startBtn?.click();
    });
    dom.nameInput.addEventListener("keyup", (e) => e.stopPropagation());
  }

  // Bind event handlers
  if (dom.startBtn) dom.startBtn.addEventListener("click", handleStartGame);
  renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
  renderer.domElement.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("pointerlockchange", handlePointerLockChange);
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
  document.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("resize", handleResize);
  dom.restartBtn.onclick = restartGame;
  dom.smgConfirm.onclick = handleSMGConfirm;
  dom.smgCancel.onclick = handleSMGCancel;

  // Set initial health bar state
  dom.healthFill.style.width = "100%";
  dom.botHealthFill.style.width = "100%";

  update();
}

init();
