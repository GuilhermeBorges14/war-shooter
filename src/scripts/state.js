const BABYLON = window.BABYLON;
import {
  PLAYER_HEALTH,
  BOT_HEALTH,
  BOT_MOVE_SPEED,
  STARTING_BULLETS,
} from "../utils/constants.js";

// ============================================================
// Centralised mutable game state
// All modules import and mutate this single object.
// ============================================================
export const state = {
  // Babylon.js core
  engine: null,
  scene: null,
  camera: null,

  // Entities (TransformNode groups + body mesh refs)
  playerGroup: null,
  botGroup: null,
  playerMesh: null,
  botMesh: null,
  botGunRef: null,
  playerGun: null,
  playerMuzzle: null,

  // Game state
  playerHealth: PLAYER_HEALTH,
  botHealth: BOT_HEALTH,
  botMaxHealth: BOT_HEALTH,
  playerBullets: STARTING_BULLETS,
  bullets: [],
  botBullets: [],
  crates: [],        // Babylon.js Mesh array
  bulletDrops: [],   // Array of {mesh: TransformNode, spawnTime}
  crateBounds: [],   // Array of {min: Vector3, max: Vector3} AABB
  keys: {},
  pointerLocked: false,
  gameStarted: false,
  gameOver: false,
  botShootTimer: 0,
  botTargetAngle: 0,
  playerVelocity: new BABYLON.Vector3(),
  fullAmmoMessageTime: 0,
  hasSMG: false,
  smgPickup: null,
  gameStartTime: 0,
  smgSpawned: false,
  smgPopupShown: false,
  botMoveSpeed: BOT_MOVE_SPEED,
  yaw: 0,
  pitch: 0,

  // New feature state
  isSprinting: false,
  screenShake: 0,
  killCount: 0,
  isReloading: false,
  reloadTimer: 0,

  // DOM element cache (populated by ui.cacheDOMElements)
  dom: {},

  // Scratch objects — reused each frame to reduce GC pressure
  _yAxis: new BABYLON.Vector3(0, 1, 0),
  _zeroVec: new BABYLON.Vector3(),
  _inputVec: new BABYLON.Vector3(),
  _scratchVec: new BABYLON.Vector3(),
  _scratchQuat: new BABYLON.Quaternion(),
};
