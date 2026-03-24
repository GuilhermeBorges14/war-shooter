import * as THREE from "three";
import {
  PLAYER_HEALTH,
  BOT_HEALTH,
  BOT_MOVE_SPEED,
  STARTING_BULLETS,
} from "./constants.js";

// ============================================================
// Centralised mutable game state
// All modules import and mutate this single object.
// ============================================================
export const state = {
  // Three.js core
  scene: null,
  camera: null,
  renderer: null,

  // Entities
  playerGroup: null,
  botGroup: null,
  playerMesh: null,
  botMesh: null,
  botGunRef: null,
  playerGun: null,

  // Game state
  playerHealth: PLAYER_HEALTH,
  botHealth: BOT_HEALTH,
  botMaxHealth: BOT_HEALTH,
  playerBullets: STARTING_BULLETS,
  bullets: [],
  botBullets: [],
  crates: [],
  bulletDrops: [],
  crateBounds: [],
  keys: {},
  pointerLocked: false,
  gameStarted: false,
  gameOver: false,
  botShootTimer: 0,
  botTargetAngle: 0,
  playerVelocity: new THREE.Vector3(),
  fullAmmoMessageTime: 0,
  hasSMG: false,
  smgPickup: null,
  gameStartTime: 0,
  smgSpawned: false,
  smgPopupShown: false,
  botMoveSpeed: BOT_MOVE_SPEED,
  yaw: 0,
  pitch: 0,
  clock: new THREE.Clock(),

  // New feature state
  isSprinting: false,
  screenShake: 0,
  killCount: 0,
  isReloading: false,
  reloadTimer: 0,

  // DOM element cache (populated by ui.cacheDOMElements)
  dom: {},

  // Scratch objects — reused each frame to reduce GC pressure
  _yAxis: new THREE.Vector3(0, 1, 0),
  _zeroVec: new THREE.Vector3(),
  _inputVec: new THREE.Vector3(),
  _scratchVec: new THREE.Vector3(),
  _scratchQuat: new THREE.Quaternion(),
};
