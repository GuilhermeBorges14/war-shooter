import * as THREE from "three";

// --- Constants ---
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
const BOT_MOVE_SPEED = 2.5; // increased bot movement speed
const DAMAGE = 14; // 7 hits to win/lose (100 / 14 ≈ 7.14)
const PLAYER_RADIUS = 0.5; // collision radius
const MAX_BULLETS = 10; // maximum ammo capacity (normal gun)
const MAX_BULLETS_SMG = 40; // maximum ammo capacity (SMG)
const STARTING_BULLETS = 7; // starting ammo
const BULLETS_PER_PICKUP = 3; // ammo per pickup

// --- State ---
let scene, camera, renderer;
let playerMesh, botMesh;
let botGun = null; // Reference to bot's gun for bullet spawning
let playerHealth = PLAYER_HEALTH;
let botHealth = BOT_HEALTH;
let botMaxHealth = BOT_HEALTH; // Track current max health for bot (increases with SMG)
let playerBullets = STARTING_BULLETS; // current ammo count
let bullets = [];
let botBullets = [];
let crates = []; // Store crates for collision detection
let bulletDrops = []; // Ammo pickups in the arena
let keys = {};
let pointerLocked = false;
let gameStarted = false;
let gameOver = false;
let botShootTimer = 0;
let botTargetAngle = 0;
let playerVelocity = new THREE.Vector3(0, 0, 0);
let fullAmmoMessageTime = 0; // Cooldown for full ammo message
let hasSMG = false; // Track if player has submachine gun
let smgPickup = null; // SMG pickup object
let playerGun = null; // Reference to player's gun model
let gameStartTime = 0; // Time when game started
let smgSpawned = false; // Track if SMG has been spawned
let botMoveSpeed = BOT_MOVE_SPEED; // Current bot movement speed
const clock = new THREE.Clock();

// --- Arena ---
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

  // Floor grid lines (detail)
  const gridMat = new THREE.LineBasicMaterial({
    color: 0xccccdd,
    linewidth: 1,
  });
  const gridStep = 2;
  const gridLines = [];
  for (let x = -half; x <= half; x += gridStep) {
    const points = [
      new THREE.Vector3(x, 0.01, -half),
      new THREE.Vector3(x, 0.01, half),
    ];
    gridLines.push(...points);
  }
  for (let z = -half; z <= half; z += gridStep) {
    const points = [
      new THREE.Vector3(-half, 0.01, z),
      new THREE.Vector3(half, 0.01, z),
    ];
    gridLines.push(...points);
  }
  const gridGeo = new THREE.BufferGeometry().setFromPoints(gridLines);
  const grid = new THREE.LineSegments(gridGeo, gridMat);
  scene.add(grid);

  // Walls with panels and trim
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
    // Wall trim (bottom strip)
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
    crates.push(crate); // Store for collision detection
  });

  // Wall lights (point lights + emissive panels)
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
  wallLightPositions.forEach(([x, y, z], i) => {
    const panel = new THREE.Mesh(lightPanelGeo, lightMat);
    panel.position.set(x, y, z);
    scene.add(panel);
    const pointLight = new THREE.PointLight(0xffffcc, 1.2, 12);
    pointLight.position.set(x, y, z);
    pointLight.castShadow = true;
    scene.add(pointLight);
  });
}

// --- Player (human) ---
function createPlayer() {
  const group = new THREE.Group();

  // Body
  const bodyGeo = new THREE.BoxGeometry(0.7, 1.0, 0.4);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2a5a8a,
    roughness: 0.7,
    metalness: 0.2,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.0;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Head
  const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xffdbac,
    roughness: 0.8,
    metalness: 0.1,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.7;
  head.castShadow = true;
  group.add(head);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
  const armMat = new THREE.MeshStandardMaterial({
    color: 0x2a5a8a,
    roughness: 0.7,
    metalness: 0.2,
  });
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-0.5, 0.9, 0);
  armL.castShadow = true;
  group.add(armL);

  const armR = new THREE.Mesh(armGeo, armMat);
  armR.position.set(0.5, 0.9, 0);
  armR.castShadow = true;
  group.add(armR);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
  const legMat = new THREE.MeshStandardMaterial({
    color: 0x1a3a5a,
    roughness: 0.8,
    metalness: 0.15,
  });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.2, 0.4, 0);
  legL.castShadow = true;
  group.add(legL);

  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.2, 0.4, 0);
  legR.castShadow = true;
  group.add(legR);

  playerMesh = body;
  group.position.set(0, 0, 0);
  scene.add(group);
  return group;
}

// --- Bot (enemy human) ---
function createBot() {
  const group = new THREE.Group();

  // Body
  const bodyGeo = new THREE.BoxGeometry(0.7, 1.0, 0.4);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x8a2a2a,
    roughness: 0.7,
    metalness: 0.2,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.0;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Head
  const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    roughness: 0.8,
    metalness: 0.1,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.7;
  head.castShadow = true;
  group.add(head);

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

  // Arms
  const armGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
  const armMat = new THREE.MeshStandardMaterial({
    color: 0x8a2a2a,
    roughness: 0.7,
    metalness: 0.2,
  });
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-0.5, 0.9, 0);
  armL.castShadow = true;
  group.add(armL);

  const armR = new THREE.Mesh(armGeo, armMat);
  armR.position.set(0.5, 0.9, 0);
  armR.castShadow = true;
  group.add(armR);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
  const legMat = new THREE.MeshStandardMaterial({
    color: 0x5a1a1a,
    roughness: 0.8,
    metalness: 0.15,
  });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.2, 0.4, 0);
  legL.castShadow = true;
  group.add(legL);

  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.2, 0.4, 0);
  legR.castShadow = true;
  group.add(legR);

  // Gun in hand (detailed enemy gun like player's)
  const botGun = new THREE.Group();

  // Main gun body
  const gunBodyGeo = new THREE.BoxGeometry(0.08, 0.12, 0.5);
  const gunBodyMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.6,
    metalness: 0.5,
  });
  const gunBody = new THREE.Mesh(gunBodyGeo, gunBodyMat);
  gunBody.position.z = -0.15;
  gunBody.castShadow = true;
  botGun.add(gunBody);

  // Gun barrel
  const gunBarrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
  const gunBarrelMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.4,
    metalness: 0.7,
  });
  const gunBarrel = new THREE.Mesh(gunBarrelGeo, gunBarrelMat);
  gunBarrel.position.set(0, 0.02, -0.45);
  gunBarrel.rotation.x = Math.PI / 2;
  gunBarrel.castShadow = true;
  botGun.add(gunBarrel);

  // Gun handle
  const gunHandleGeo = new THREE.BoxGeometry(0.06, 0.15, 0.08);
  const gunHandleMat = new THREE.MeshStandardMaterial({
    color: 0x3a2a1a,
    roughness: 0.8,
    metalness: 0.2,
  });
  const gunHandle = new THREE.Mesh(gunHandleGeo, gunHandleMat);
  gunHandle.position.set(0, -0.12, -0.05);
  gunHandle.castShadow = true;
  botGun.add(gunHandle);

  // Gun sight
  const gunSightGeo = new THREE.BoxGeometry(0.015, 0.03, 0.015);
  const gunSightMat = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.4,
  });
  const gunSight = new THREE.Mesh(gunSightGeo, gunSightMat);
  gunSight.position.set(0, 0.08, -0.35);
  gunSight.castShadow = true;
  botGun.add(gunSight);

  // Position gun at the end of right arm (hand position), pointing forward
  botGun.position.set(0.5, 0.5, 0.3);
  botGun.rotation.x = 0;
  botGun.rotation.y = 0;
  group.add(botGun);

  // Store reference to bot gun for bullet spawning
  window.botGunRef = botGun;

  botMesh = body;
  group.position.set(8, 0, 8);
  scene.add(group);
  return group;
}

// --- Gun Model ---
function createSMG() {
  const gunGroup = new THREE.Group();

  // Main body (longer for SMG)
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

  // Barrel (thicker for SMG)
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

  // Magazine (distinctive SMG feature)
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

  // Handle
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

  // Sight (yellow for SMG)
  const sightGeo = new THREE.BoxGeometry(0.02, 0.04, 0.02);
  const sightMat = new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    emissive: 0xffaa00,
    emissiveIntensity: 0.4,
  });
  const sight = new THREE.Mesh(sightGeo, sightMat);
  sight.position.set(0, 0.1, -0.4);
  gunGroup.add(sight);

  // Position gun in player's view
  gunGroup.position.set(0.25, -0.25, -0.4);
  gunGroup.rotation.y = -0.1;

  return gunGroup;
}

function createSMGPickup() {
  const group = new THREE.Group();

  // SMG body (same style as createSMG but slightly larger for visibility)
  const bodyGeo = new THREE.BoxGeometry(0.15, 0.2, 0.9);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.5,
    metalness: 0.6,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  group.add(body);

  // Magazine
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

  // Glow effect
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

function spawnSMGPickup() {
  // Random position in arena avoiding edges
  const bound = ARENA_SIZE / 2 - 3;
  const x = (Math.random() * 2 - 1) * bound;
  const z = (Math.random() * 2 - 1) * bound;

  smgPickup = createSMGPickup();
  smgPickup.position.set(x, 1.2, z);
  scene.add(smgPickup);
  smgSpawned = true;
  console.log("🔫 SMG spawned at:", x.toFixed(2), z.toFixed(2));

  // Play spawn sound
  playSMGSpawnSound();

  // Show visual notification
  const notification = document.createElement("div");
  notification.style.position = "absolute";
  notification.style.top = "30%";
  notification.style.left = "50%";
  notification.style.transform = "translate(-50%, -50%)";
  notification.style.fontSize = "2rem";
  notification.style.fontWeight = "700";
  notification.style.color = "#fbbf24";
  notification.style.textShadow =
    "0 0 20px rgba(251, 191, 36, 0.8), 0 4px 12px rgba(0, 0, 0, 0.8)";
  notification.style.background = "rgba(0, 0, 0, 0.85)";
  notification.style.padding = "1rem 2rem";
  notification.style.borderRadius = "12px";
  notification.style.border = "2px solid rgba(251, 191, 36, 0.6)";
  notification.style.pointerEvents = "none";
  notification.style.zIndex = "999";
  notification.style.animation = "fadeOut 3s forwards";
  notification.textContent = "🔫 SUBMACHINE GUN SPAWNED!";
  document.body.appendChild(notification);

  // Remove notification after animation
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

function createGun() {
  const gunGroup = new THREE.Group();

  // Main body
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

  // Barrel
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

  // Handle
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

  // Sight
  const sightGeo = new THREE.BoxGeometry(0.015, 0.03, 0.015);
  const sightMat = new THREE.MeshStandardMaterial({
    color: 0xff4444,
    emissive: 0xff0000,
    emissiveIntensity: 0.3,
  });
  const sight = new THREE.Mesh(sightGeo, sightMat);
  sight.position.set(0, 0.08, -0.35);
  gunGroup.add(sight);

  // Position gun in player's view (bottom right)
  gunGroup.position.set(0.25, -0.25, -0.4);
  gunGroup.rotation.y = -0.1;

  return gunGroup;
}

// --- Bullets ---
function shoot(fromPosition, direction, isPlayerBullet, bulletSpeed) {
  // Play shoot sound
  playShootSound();

  // Create a tracer bullet with a capsule/cylinder shape
  const bulletGroup = new THREE.Group();

  // Main projectile body (elongated)
  const geo = new THREE.CapsuleGeometry(0.03, 0.15, 4, 8);
  const mat = new THREE.MeshStandardMaterial({
    color: isPlayerBullet ? 0x44ff44 : 0xff4444,
    emissive: isPlayerBullet ? 0x22ff22 : 0xff2222,
    emissiveIntensity: 0.6,
  });
  const bulletMesh = new THREE.Mesh(geo, mat);
  bulletGroup.add(bulletMesh);

  // Glow trail
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

  // Orient bullet in direction of travel
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

// --- Bullet Drop System ---
function createBulletDrop(x, z) {
  const dropGroup = new THREE.Group();

  // Main ammo crate body (military style)
  const crateGeo = new THREE.BoxGeometry(0.5, 0.35, 0.35);
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x5a6b3e, // Olive drab military green
    metalness: 0.3,
    roughness: 0.8,
  });
  const crate = new THREE.Mesh(crateGeo, crateMat);
  crate.castShadow = true;
  dropGroup.add(crate);

  // Metal bands/straps (realistic ammo crate detail)
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    metalness: 0.7,
    roughness: 0.4,
  });

  // Top and bottom bands
  const bandGeoHorizontal = new THREE.BoxGeometry(0.52, 0.04, 0.37);
  const topBand = new THREE.Mesh(bandGeoHorizontal, bandMat);
  topBand.position.y = 0.12;
  dropGroup.add(topBand);

  const bottomBand = new THREE.Mesh(bandGeoHorizontal, bandMat);
  bottomBand.position.y = -0.12;
  dropGroup.add(bottomBand);

  // Vertical stripe
  const bandGeoVertical = new THREE.BoxGeometry(0.04, 0.37, 0.37);
  const verticalBand = new THREE.Mesh(bandGeoVertical, bandMat);
  dropGroup.add(verticalBand);

  // Ammo count label (white text on crate)
  const labelGeo = new THREE.BoxGeometry(0.15, 0.15, 0.02);
  const labelMat = new THREE.MeshStandardMaterial({
    color: 0xf5f5dc, // Beige label
    emissive: 0xf5f5dc,
    emissiveIntensity: 0.3,
  });
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.position.set(0, 0, 0.18);
  dropGroup.add(label);

  // Number "3" marking on label
  const numberGeo = new THREE.BoxGeometry(0.08, 0.1, 0.01);
  const numberMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
  });
  const number = new THREE.Mesh(numberGeo, numberMat);
  number.position.set(0, 0, 0.19);
  dropGroup.add(number);

  // Subtle glow effect (less prominent)
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
  const bound = ARENA_SIZE / 2 - 2;
  for (let i = 0; i < count; i++) {
    // Random position avoiding center spawn areas
    let x, z;
    do {
      x = (Math.random() - 0.5) * ARENA_SIZE * 0.8;
      z = (Math.random() - 0.5) * ARENA_SIZE * 0.8;
    } while (Math.abs(x) < 3 && Math.abs(z) < 3); // Avoid spawn near player

    const drop = createBulletDrop(x, z);
    bulletDrops.push(drop);
  }
}

function updateAmmoDisplay() {
  const ammoCount = document.getElementById("ammo-count");
  if (ammoCount) {
    ammoCount.textContent = playerBullets;
    // Change color when low on ammo
    if (playerBullets <= 3) {
      ammoCount.style.color = "#ef4444";
    } else if (playerBullets <= 5) {
      ammoCount.style.color = "#f59e0b";
    } else {
      ammoCount.style.color = "#f1f5f9";
    }
  }
}

// --- Hitmarker ---
function showHitmarker(worldPosition) {
  // Convert 3D world position to 2D screen coordinates
  const vector = worldPosition.clone();
  vector.project(camera);

  // Convert from normalized device coordinates (-1 to 1) to pixels
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

  // Create X-shaped hitmarker with blood effect
  hitmarker.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 40 40" style="filter: drop-shadow(0 0 4px rgba(220, 38, 38, 0.8));">
      <line x1="8" y1="8" x2="32" y2="32" stroke="#dc2626" stroke-width="3" stroke-linecap="round"/>
      <line x1="32" y1="8" x2="8" y2="32" stroke="#dc2626" stroke-width="3" stroke-linecap="round"/>
      <circle cx="20" cy="20" r="3" fill="#dc2626" opacity="0.6"/>
    </svg>
  `;

  document.body.appendChild(hitmarker);

  // Fade out and remove
  setTimeout(() => {
    hitmarker.style.opacity = "0";
    setTimeout(() => {
      if (hitmarker.parentNode) {
        hitmarker.parentNode.removeChild(hitmarker);
      }
    }, 300);
  }, 100);
}

// --- Init ---
function init() {
  let yaw = 0; // Horizontal camera rotation
  let pitch = 0; // Vertical camera rotation

  // Create audio context for sound effects
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // Function to play shoot sound (realistic gunshot)
  window.playShootSound = function () {
    const bufferSize = audioContext.sampleRate * 0.08;
    const buffer = audioContext.createBuffer(
      1,
      bufferSize,
      audioContext.sampleRate,
    );
    const data = buffer.getChannelData(0);

    // Generate white noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = audioContext.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value = 1.5;

    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(3.0, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.08,
    );

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);

    noise.start(audioContext.currentTime);
    noise.stop(audioContext.currentTime + 0.08);
  };

  // Function to play hit sound (when player hits enemy) - Realistic bullet impact + grunt
  window.playHitSound = function () {
    // Impact sound (sharp thwack)
    const impactBufferSize = audioContext.sampleRate * 0.05;
    const impactBuffer = audioContext.createBuffer(
      1,
      impactBufferSize,
      audioContext.sampleRate,
    );
    const impactData = impactBuffer.getChannelData(0);

    // Generate impact noise with envelope
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
    impactGain.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.05,
    );

    impact.connect(impactFilter);
    impactFilter.connect(impactGain);
    impactGain.connect(audioContext.destination);

    impact.start(audioContext.currentTime);

    // Delayed grunt (starts slightly after impact)
    setTimeout(() => {
      const osc = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Male grunt/pain sound
      osc.frequency.setValueAtTime(170, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        110,
        audioContext.currentTime + 0.18,
      );
      osc.type = "sawtooth";

      filter.type = "lowpass";
      filter.frequency.value = 700;
      filter.Q.value = 2.5;

      gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.18,
      );

      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.18);
    }, 30);
  };

  // Function to play pain sound (when player gets hit) - Human pain groan
  window.playPainSound = function () {
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Pained groan with vocal inflection
    osc.frequency.setValueAtTime(220, audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(250, audioContext.currentTime + 0.08);
    osc.frequency.exponentialRampToValueAtTime(
      150,
      audioContext.currentTime + 0.25,
    );
    osc.type = "triangle";

    // Low-pass filter for vocal warmth
    filter.type = "lowpass";
    filter.frequency.value = 1000;
    filter.Q.value = 1.5;

    // Natural pain vocalization envelope
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.6, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.25,
    );

    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.25);
  };

  // Empty clip sound - dry mechanical click
  window.playEmptyClickSound = function () {
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Short metallic click
    osc.frequency.setValueAtTime(1200, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      800,
      audioContext.currentTime + 0.05,
    );
    osc.type = "square";

    // High-pass filter for metallic sound
    filter.type = "highpass";
    filter.frequency.value = 600;
    filter.Q.value = 2;

    // Sharp, quick click
    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.05,
    );

    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.05);
  };

  // Function to play SMG spawn sound (power-up notification)
  window.playSMGSpawnSound = function () {
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Rising power-up sound
    osc.frequency.setValueAtTime(200, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      800,
      audioContext.currentTime + 0.3,
    );
    osc.type = "sine";

    // Band-pass filter for clarity
    filter.type = "bandpass";
    filter.frequency.value = 500;
    filter.Q.value = 1.5;

    // Moderate volume with fade in/out
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.3,
    );

    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.3);
  };

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
  const canvasEl = document.getElementById("canvas");
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvasEl });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  createArena();
  const playerGroup = createPlayer();
  const botGroup = createBot();

  // Spawn initial bullet drops
  spawnBulletDrops(5);

  // Hide player model in first-person view
  playerGroup.visible = false;

  // Create and attach gun to camera for first-person view
  playerGun = createGun();
  camera.add(playerGun);
  scene.add(camera);

  // Load player name from localStorage
  const savedName = localStorage.getItem("playerName");
  const nameInput = document.getElementById("player-name-input");
  const startScreen = document.getElementById("start-screen");
  const startBtn = document.getElementById("start-btn");

  console.log("🔍 Debug - Elements:", {
    nameInput: !!nameInput,
    startScreen: !!startScreen,
    startBtn: !!startBtn,
    startBtnType: typeof startBtn,
  });

  if (savedName && nameInput) {
    nameInput.value = savedName;
  }

  // Prevent game controls from triggering while typing in name input
  if (nameInput) {
    nameInput.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        document.getElementById("start-btn")?.click();
      }
    });

    nameInput.addEventListener("keyup", (e) => {
      e.stopPropagation();
    });
  }

  // Start button click handler
  if (startBtn) {
    console.log("✅ Attaching click handler to start button");
    startBtn.addEventListener("click", (event) => {
      console.log("🎮 START BUTTON CLICKED!", {
        event,
        gameStarted,
        pointerLocked,
      });

      // Get player name or default to "Player"
      const playerName = nameInput?.value.trim() || "Player";

      // Save player name to localStorage
      localStorage.setItem("playerName", playerName);

      // Display player name in game UI
      const playerNameDisplay = document.getElementById("player-name-display");
      const playerHealthLabel = document.getElementById("player-health-label");
      if (playerNameDisplay) {
        playerNameDisplay.textContent = playerName;
      }
      if (playerHealthLabel) {
        playerHealthLabel.textContent = playerName + "'s Health";
      }

      if (startScreen) {
        startScreen.style.display = "none";
      }
      gameStarted = true;
      gameStartTime = Date.now();
      smgSpawned = false;
      console.log("✅ Game started, requesting pointer lock");
      renderer.domElement.requestPointerLock();
    });
  } else {
    console.error("❌ Start button not found!");
  }

  renderer.domElement.addEventListener("contextmenu", (e) =>
    e.preventDefault(),
  );
  renderer.domElement.addEventListener("mousedown", (e) => {
    if (e.button !== 2 || !pointerLocked || gameOver) return;

    if (playerBullets <= 0) {
      // No ammo feedback
      playEmptyClickSound();

      // Shake ammo counter
      const ammoCounter = document.getElementById("ammo-counter");
      ammoCounter.classList.add("shake");
      setTimeout(() => ammoCounter.classList.remove("shake"), 300);

      // Show no ammo message
      const noAmmoMsg = document.getElementById("no-ammo-message");
      noAmmoMsg.classList.add("show");
      setTimeout(() => noAmmoMsg.classList.remove("show"), 800);

      return;
    }

    const pos = new THREE.Vector3();
    const dir = new THREE.Vector3();
    camera.getWorldPosition(pos);
    camera.getWorldDirection(dir);
    pos.addScaledVector(dir, 0.6);

    // SMG shoots 3 bullets sequentially
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
        }, i * 100); // 100ms delay between each bullet
      }
      playerBullets -= bulletsToShoot;
    } else {
      shoot(pos, dir, true, BULLET_SPEED);
      playerBullets--;
    }

    updateAmmoDisplay();
  });

  document.addEventListener("pointerlockchange", () => {
    pointerLocked = document.pointerLockElement === renderer.domElement;
  });

  document.addEventListener("keydown", (e) => {
    // Don't capture keys when start screen is visible or typing in name input
    if (
      startScreen.style.display !== "none" ||
      document.activeElement === nameInput
    )
      return;

    keys[e.code] = true;
    if (e.code === "Space") e.preventDefault();
  });
  document.addEventListener("keyup", (e) => {
    // Don't capture keys when start screen is visible or typing in name input
    if (
      startScreen.style.display !== "none" ||
      document.activeElement === nameInput
    )
      return;

    keys[e.code] = false;
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function update() {
    requestAnimationFrame(update);

    let dt = clock.getDelta();
    if (dt > 0.1) dt = 0.016; // cap delta to avoid jumps when tab was backgrounded

    // Always render the scene (for start screen visibility)
    if (!gameStarted || gameOver) {
      renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
      renderer.setScissorTest(false);
      renderer.render(scene, camera);
      return;
    }

    // Player movement (WASD + arrows) — smooth, frame-rate independent
    const input = new THREE.Vector3(0, 0, 0);
    if (keys["KeyW"] || keys["ArrowUp"]) input.z -= 1;
    if (keys["KeyS"] || keys["ArrowDown"]) input.z += 1;
    if (keys["KeyA"] || keys["ArrowLeft"]) input.x -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) input.x += 1;
    if (input.length() > 0) {
      input.normalize().multiplyScalar(MOVE_SPEED);
      input.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      playerVelocity.lerp(input, MOVE_SMOOTH * dt);
    } else {
      playerVelocity.lerp(new THREE.Vector3(0, 0, 0), MOVE_SMOOTH * dt);
    }
    // Apply movement with better boundary checking
    const newX = playerGroup.position.x + playerVelocity.x * dt;
    const newZ = playerGroup.position.z + playerVelocity.z * dt;
    const bound = ARENA_SIZE / 2 - PLAYER_RADIUS;

    // Clamp to boundaries
    playerGroup.position.x = THREE.MathUtils.clamp(newX, -bound, bound);
    playerGroup.position.z = THREE.MathUtils.clamp(newZ, -bound, bound);

    // First-person camera: position at player's eye level
    const eyeHeight = 1.6;
    camera.position.set(
      playerGroup.position.x,
      eyeHeight,
      playerGroup.position.z,
    );
    // Set rotation order to YXZ (yaw first, then pitch) to prevent diagonal movement
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.rotation.z = 0;

    // Spawn SMG after 10 seconds
    if (!smgSpawned && !hasSMG && Date.now() - gameStartTime >= 10000) {
      spawnSMGPickup();
    }

    // Animate SMG pickup
    if (smgPickup && smgPickup.visible) {
      const time = Date.now() / 1000;
      smgPickup.position.y = 1.2 + Math.sin(time * 2) * 0.15;
      smgPickup.rotation.y += dt * 1.5;
    }

    // Check for bullet drop pickups
    for (let i = bulletDrops.length - 1; i >= 0; i--) {
      const drop = bulletDrops[i];

      // Animate drop (bobbing and rotation)
      const elapsed = (Date.now() - drop.spawnTime) / 1000;
      drop.mesh.position.y = 0.4 + Math.sin(elapsed * 2) * 0.1;
      drop.mesh.rotation.y += dt * 2;

      // Check distance to player
      const dropPos = new THREE.Vector3();
      drop.mesh.getWorldPosition(dropPos);
      const playerPos = new THREE.Vector3(
        playerGroup.position.x,
        0,
        playerGroup.position.z,
      );
      dropPos.y = 0;

      // Check for SMG pickup
      if (smgPickup && smgPickup.visible) {
        const smgPos = new THREE.Vector3(
          smgPickup.position.x,
          0,
          smgPickup.position.z,
        );
        if (smgPos.distanceTo(playerPos) < 1.5) {
          // Show SMG confirmation popup
          const popup = document.getElementById("smg-popup");
          popup.style.display = "block";
          document.exitPointerLock();
        }
      }

      if (dropPos.distanceTo(playerPos) < 1.2) {
        // Check if already at max capacity
        const currentMax = hasSMG ? MAX_BULLETS_SMG : MAX_BULLETS;
        if (playerBullets >= currentMax) {
          // Show full ammo message with cooldown to prevent spam
          const now = Date.now();
          if (now - fullAmmoMessageTime > 1000) {
            // Only show once per second
            fullAmmoMessageTime = now;
            const fullAmmoMsg = document.getElementById("full-ammo-message");
            if (fullAmmoMsg) {
              fullAmmoMsg.classList.add("show");
              setTimeout(() => fullAmmoMsg.classList.remove("show"), 800);
            }
          }
          continue; // Skip this drop but continue checking others
        }

        // Pickup!
        const bulletsToAdd = hasSMG ? 10 : BULLETS_PER_PICKUP;
        playerBullets = Math.min(playerBullets + bulletsToAdd, currentMax);
        updateAmmoDisplay();
        scene.remove(drop.mesh);
        bulletDrops.splice(i, 1);

        // Spawn a new drop elsewhere after pickup
        setTimeout(() => {
          if (!gameOver) {
            const bound = ARENA_SIZE / 2 - 2;
            let x, z;
            do {
              x = (Math.random() - 0.5) * ARENA_SIZE * 0.8;
              z = (Math.random() - 0.5) * ARENA_SIZE * 0.8;
            } while (Math.abs(x) < 3 && Math.abs(z) < 3);

            const newDrop = createBulletDrop(x, z);
            bulletDrops.push(newDrop);
          }
        }, 3000); // Spawn new drop after 3 seconds
      }
    }

    // Bot AI - more active movement
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
      botGroup.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), 3 * dt);

      // Bot moves around more actively - approaches when far, strafes when close
      if (dist > 8) {
        // Far away: move straight towards player
        botGroup.position.x +=
          Math.sin(botGroup.rotation.y) * -botMoveSpeed * dt;
        botGroup.position.z +=
          Math.cos(botGroup.rotation.y) * -botMoveSpeed * dt;
      } else if (dist > 4) {
        // Medium distance: move towards player but slower
        botGroup.position.x +=
          Math.sin(botGroup.rotation.y) * -botMoveSpeed * 0.6 * dt;
        botGroup.position.z +=
          Math.cos(botGroup.rotation.y) * -botMoveSpeed * 0.6 * dt;
      } else {
        // Close: strafe around player
        const strafeAngle = botGroup.rotation.y + Math.PI / 2;
        const strafeDir = Math.sin(Date.now() * 0.001) > 0 ? 1 : -1;
        botGroup.position.x +=
          Math.sin(strafeAngle) * botMoveSpeed * 0.4 * strafeDir * dt;
        botGroup.position.z +=
          Math.cos(strafeAngle) * botMoveSpeed * 0.4 * strafeDir * dt;
      }

      const bound = ARENA_SIZE / 2 - PLAYER_RADIUS;
      botGroup.position.x = THREE.MathUtils.clamp(
        botGroup.position.x,
        -bound,
        bound,
      );
      botGroup.position.z = THREE.MathUtils.clamp(
        botGroup.position.z,
        -bound,
        bound,
      );
    }

    botShootTimer += dt * 1000;
    if (botShootTimer >= BOT_SHOOT_INTERVAL) {
      botShootTimer = 0;

      // Get bullet spawn position from gun barrel
      const botPos = new THREE.Vector3();
      if (window.botGunRef) {
        window.botGunRef.getWorldPosition(botPos);
        // Offset forward from gun barrel
        const gunDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          botGroup.rotation.y,
        );
        botPos.add(gunDir.multiplyScalar(0.3));
      } else {
        // Fallback if gun not available
        botGroup.getWorldPosition(botPos);
        botPos.y += 1;
      }

      const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        botGroup.rotation.y,
      );
      shoot(botPos, dir, false, BOT_BULLET_SPEED);
    }

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.mesh.position.add(b.velocity.clone().multiplyScalar(dt));
      // Keep bullet oriented in direction of travel
      const axis = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(
        axis,
        b.velocity.clone().normalize(),
      );
      b.mesh.quaternion.copy(quaternion);
      b.life -= dt;

      // Check wall collision
      const wallBound = ARENA_SIZE / 2 - 0.5;
      if (
        Math.abs(b.mesh.position.x) > wallBound ||
        Math.abs(b.mesh.position.z) > wallBound
      ) {
        scene.remove(b.mesh);
        bullets.splice(i, 1);
        continue;
      }

      if (b.life <= 0) {
        scene.remove(b.mesh);
        bullets.splice(i, 1);
        continue;
      }

      // Check crate collision
      let hitCrate = false;
      for (const crate of crates) {
        const crateBox = new THREE.Box3().setFromObject(crate);
        const bulletPos = b.mesh.position;
        if (crateBox.containsPoint(bulletPos)) {
          scene.remove(b.mesh);
          bullets.splice(i, 1);
          hitCrate = true;
          break;
        }
      }
      if (hitCrate) continue;

      const botCenter = new THREE.Vector3(0, 1, 0).applyMatrix4(
        botGroup.matrixWorld,
      );
      const d = b.mesh.position.distanceTo(botCenter);
      if (d < 1) {
        botHealth -= DAMAGE;
        playHitSound();
        showHitmarker(botCenter);
        updateBotHealthDisplay();
        scene.remove(b.mesh);
        bullets.splice(i, 1);
        if (botHealth <= 0) endGame(true);
      }
    }

    for (let i = botBullets.length - 1; i >= 0; i--) {
      const b = botBullets[i];
      b.mesh.position.add(b.velocity.clone().multiplyScalar(dt));
      // Keep bullet oriented in direction of travel
      const axis = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(
        axis,
        b.velocity.clone().normalize(),
      );
      b.mesh.quaternion.copy(quaternion);
      b.life -= dt;

      // Check wall collision
      const wallBound = ARENA_SIZE / 2 - 0.5;
      if (
        Math.abs(b.mesh.position.x) > wallBound ||
        Math.abs(b.mesh.position.z) > wallBound
      ) {
        scene.remove(b.mesh);
        botBullets.splice(i, 1);
        continue;
      }

      if (b.life <= 0) {
        scene.remove(b.mesh);
        botBullets.splice(i, 1);
        continue;
      }

      // Check crate collision
      let hitCrate = false;
      for (const crate of crates) {
        const crateBox = new THREE.Box3().setFromObject(crate);
        const bulletPos = b.mesh.position;
        if (crateBox.containsPoint(bulletPos)) {
          scene.remove(b.mesh);
          botBullets.splice(i, 1);
          hitCrate = true;
          break;
        }
      }
      if (hitCrate) continue;

      const playerCenter = new THREE.Vector3(0, 1, 0).applyMatrix4(
        playerGroup.matrixWorld,
      );
      const d = b.mesh.position.distanceTo(playerCenter);
      if (d < 1.2) {
        playerHealth -= DAMAGE;
        playPainSound();
        document.getElementById("health-fill").style.width =
          (playerHealth / PLAYER_HEALTH) * 100 + "%";
        scene.remove(b.mesh);
        botBullets.splice(i, 1);
        if (playerHealth <= 0) endGame(false);
      }
    }

    // Render scene
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(scene, camera);

    // Draw minimap
    drawMinimap();
  }

  function drawMinimap() {
    const minimap = document.getElementById("minimap");
    if (!minimap) return;

    const ctx = minimap.getContext("2d");
    const size = 180;
    const scale = size / ARENA_SIZE;

    // Clear
    ctx.fillStyle = "rgba(10, 15, 20, 0.95)";
    ctx.fillRect(0, 0, size, size);

    // Draw arena bounds
    ctx.strokeStyle = "rgba(100, 100, 120, 0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);

    // Draw grid
    ctx.strokeStyle = "rgba(60, 60, 80, 0.3)";
    ctx.lineWidth = 0.5;
    const gridStep = 2 * scale; // 2 units in world space
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

    // Draw crates
    ctx.fillStyle = "rgba(150, 150, 160, 0.5)";
    for (const crate of crates) {
      const x = (crate.position.x + ARENA_SIZE / 2) * scale;
      const z = (crate.position.z + ARENA_SIZE / 2) * scale;
      const crateSize = 2 * scale; // crates are about 2 units
      ctx.fillRect(x - crateSize / 2, z - crateSize / 2, crateSize, crateSize);
    }

    // Draw bullet drops (yellow)
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

    // Draw enemy (red)
    const botX = (botGroup.position.x + ARENA_SIZE / 2) * scale;
    const botZ = (botGroup.position.z + ARENA_SIZE / 2) * scale;
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(botX, botZ, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw enemy direction indicator
    const botAngle = botGroup.rotation.y;
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(botX, botZ);
    ctx.lineTo(botX - Math.sin(botAngle) * 10, botZ - Math.cos(botAngle) * 10);
    ctx.stroke();

    // Draw player (green)
    const playerX = (playerGroup.position.x + ARENA_SIZE / 2) * scale;
    const playerZ = (playerGroup.position.z + ARENA_SIZE / 2) * scale;
    ctx.fillStyle = "#48bb78";
    ctx.beginPath();
    ctx.arc(playerX, playerZ, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw player view direction
    ctx.strokeStyle = "#48bb78";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playerX, playerZ);
    ctx.lineTo(playerX - Math.sin(yaw) * 12, playerZ - Math.cos(yaw) * 12);
    ctx.stroke();
  }

  function updateBotHealthDisplay() {
    const fill = document.getElementById("bot-health-fill");
    if (fill)
      fill.style.width = Math.max(0, (botHealth / botMaxHealth) * 100) + "%";
  }

  function endGame(won) {
    gameOver = true;
    const msg = document.getElementById("message");
    msg.style.display = "block";
    msg.textContent = won ? "You win!" : "You lose!";
    msg.className = won ? "win" : "lose";
    document.exitPointerLock();

    // Show restart button
    const restartBtn = document.getElementById("restart-btn");
    restartBtn.style.display = "block";
  }

  function restartGame() {
    // Reset game state
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
    botMoveSpeed = BOT_MOVE_SPEED;

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
    document.getElementById("health-fill").style.width = "100%";
    document.getElementById("bot-health-fill").style.width = "100%";
    updateAmmoDisplay();

    // Keep player name displayed
    const savedName = localStorage.getItem("playerName");
    const playerNameDisplay = document.getElementById("player-name-display");
    const playerHealthLabel = document.getElementById("player-health-label");
    if (playerNameDisplay && savedName) {
      playerNameDisplay.textContent = savedName;
    }
    if (playerHealthLabel && savedName) {
      playerHealthLabel.textContent = savedName + "'s Health";
    }

    // Hide message and restart button
    document.getElementById("message").style.display = "none";
    document.getElementById("restart-btn").style.display = "none";

    // Request pointer lock again
    renderer.domElement.requestPointerLock();
  }

  // Add restart button click handler
  document.getElementById("restart-btn").onclick = restartGame;

  // SMG popup handlers
  document.getElementById("smg-confirm").onclick = () => {
    hasSMG = true;
    playerBullets = 40;
    updateAmmoDisplay();

    // Restore and increase enemy health 3x
    botMaxHealth = BOT_HEALTH * 3;
    botHealth = botMaxHealth;
    const fill = document.getElementById("bot-health-fill");
    if (fill) {
      fill.style.width = "100%";
    }

    // Increase bot speed by 25%
    botMoveSpeed = BOT_MOVE_SPEED * 1.25;

    // Hide pickup and popup
    if (smgPickup) {
      smgPickup.visible = false;
    }
    document.getElementById("smg-popup").style.display = "none";

    // Switch gun model
    camera.remove(playerGun);
    playerGun = createSMG();
    camera.add(playerGun);

    // Resume game
    renderer.domElement.requestPointerLock();
  };

  document.getElementById("smg-cancel").onclick = () => {
    document.getElementById("smg-popup").style.display = "none";
    renderer.domElement.requestPointerLock();
  };

  // Mouse look (yaw and pitch control for first-person)
  document.addEventListener("mousemove", (e) => {
    if (!pointerLocked || gameOver) return;

    // Horizontal rotation (yaw)
    yaw -= e.movementX * 0.002;

    // Vertical rotation (pitch)
    pitch -= e.movementY * 0.002;
    // Clamp pitch to prevent over-rotation
    const maxPitch = Math.PI / 2 - 0.1; // ~89 degrees
    pitch = THREE.MathUtils.clamp(pitch, -maxPitch, maxPitch);

    // Rotate player body to match camera direction
    playerGroup.rotation.y = yaw;
  });

  document.getElementById("health-fill").style.width = "100%";
  document.getElementById("bot-health-fill").style.width = "100%";
  update();
}

init();
