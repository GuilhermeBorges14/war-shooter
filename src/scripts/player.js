import * as THREE from "three";
import { state } from "./state.js";
import {
  MOVE_SPEED,
  MOVE_SMOOTH,
  SPRINT_MULTIPLIER,
  EYE_HEIGHT,
  ENTITY_BOUND,
  RELOAD_TIME,
  MAX_BULLETS,
  MAX_BULLETS_SMG,
} from "../utils/constants.js";
import { updateAmmoDisplay, updateReloadBar, hideReloadBar } from "./ui.js";
import { playReloadSound, playReloadCompleteSound } from "./audio.js";

// ============================================================
// Player — movement, sprinting, weapon sway, screen shake
// ============================================================

// Base gun positions (restored after sway)
const GUN_BASE_POS = { x: 0.25, y: -0.25, z: -0.4 };

export function updatePlayerMovement(dt) {
  const isSprinting = state.keys["ShiftLeft"] || state.keys["ShiftRight"];
  state.isSprinting = isSprinting;

  // Update sprint crosshair indicator
  if (state.dom.crosshair) {
    if (isSprinting) state.dom.crosshair.classList.add("sprinting");
    else state.dom.crosshair.classList.remove("sprinting");
  }

  const speed = isSprinting ? MOVE_SPEED * SPRINT_MULTIPLIER : MOVE_SPEED;

  state._inputVec.set(0, 0, 0);
  if (state.keys["KeyW"] || state.keys["ArrowUp"]) state._inputVec.z -= 1;
  if (state.keys["KeyS"] || state.keys["ArrowDown"]) state._inputVec.z += 1;
  if (state.keys["KeyA"] || state.keys["ArrowLeft"]) state._inputVec.x -= 1;
  if (state.keys["KeyD"] || state.keys["ArrowRight"]) state._inputVec.x += 1;

  if (state._inputVec.length() > 0) {
    state._inputVec.normalize().multiplyScalar(speed);
    state._inputVec.applyAxisAngle(state._yAxis, state.yaw);
    state.playerVelocity.lerp(state._inputVec, MOVE_SMOOTH * dt);
  } else {
    state.playerVelocity.lerp(state._zeroVec, MOVE_SMOOTH * dt);
  }

  const newX = state.playerGroup.position.x + state.playerVelocity.x * dt;
  const newZ = state.playerGroup.position.z + state.playerVelocity.z * dt;

  state.playerGroup.position.x = THREE.MathUtils.clamp(
    newX,
    -ENTITY_BOUND,
    ENTITY_BOUND,
  );
  state.playerGroup.position.z = THREE.MathUtils.clamp(
    newZ,
    -ENTITY_BOUND,
    ENTITY_BOUND,
  );

  state.camera.position.set(
    state.playerGroup.position.x,
    EYE_HEIGHT,
    state.playerGroup.position.z,
  );
  state.camera.rotation.order = "YXZ";
  state.camera.rotation.y = state.yaw;
  state.camera.rotation.x = state.pitch;
  state.camera.rotation.z = 0;
}

// Weapon bob and sway based on movement velocity
export function updateWeaponSway(dt) {
  if (!state.playerGun) return;

  const speed = state.playerVelocity.length();
  const t = Date.now() * 0.001;

  const bobX = Math.sin(t * 9) * speed * 0.004;
  const bobY = Math.abs(Math.sin(t * 9)) * speed * 0.004;

  const targetX = GUN_BASE_POS.x + bobX;
  const targetY = GUN_BASE_POS.y - bobY;

  state.playerGun.position.x += (targetX - state.playerGun.position.x) * 8 * dt;
  state.playerGun.position.y += (targetY - state.playerGun.position.y) * 8 * dt;
}

// Brief random camera offset when hit
export function updateScreenShake(dt) {
  if (state.screenShake <= 0) return;

  const shakeX = (Math.random() - 0.5) * state.screenShake * 0.08;
  const shakeY = (Math.random() - 0.5) * state.screenShake * 0.04;
  state.camera.position.x += shakeX;
  state.camera.position.y += shakeY;

  state.screenShake *= 0.75;
  if (state.screenShake < 0.01) state.screenShake = 0;
}

// Reload system
export function startReload() {
  if (state.isReloading) return;
  const maxAmmo = state.hasSMG ? MAX_BULLETS_SMG : MAX_BULLETS;
  if (state.playerBullets >= maxAmmo) return;
  state.isReloading = true;
  state.reloadTimer = 0;
  playReloadSound();
}

export function handleReload(dt) {
  if (!state.isReloading) return;
  state.reloadTimer += dt;
  const progress = state.reloadTimer / RELOAD_TIME;
  updateReloadBar(Math.min(progress, 1));

  if (state.reloadTimer >= RELOAD_TIME) {
    state.isReloading = false;
    state.playerBullets = state.hasSMG ? MAX_BULLETS_SMG : MAX_BULLETS;
    hideReloadBar();
    updateAmmoDisplay();
    playReloadCompleteSound();
  }
}
