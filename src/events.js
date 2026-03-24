import * as THREE from "three";
import { state } from "./state.js";
import { playEmptyClickSound } from "./audio.js";
import { shoot } from "./combat.js";
import { startReload } from "./player.js";
import { updateAmmoDisplay } from "./ui.js";
import {
  handleSMGConfirm,
  handleSMGCancel,
  handleStartGame,
  restartGame,
} from "./lifecycle.js";
import {
  BULLET_SPEED,
  MOUSE_SENSITIVITY,
  MAX_PITCH,
} from "./constants.js";

// ============================================================
// Event handlers
// ============================================================

export function handleMouseDown(e) {
  if (e.button !== 2 || !state.pointerLocked || state.gameOver) return;
  if (state.isReloading) return;

  if (state.playerBullets <= 0) {
    playEmptyClickSound();
    state.dom.ammoCounter.classList.add("shake");
    setTimeout(() => state.dom.ammoCounter.classList.remove("shake"), 300);
    state.dom.noAmmoMsg.classList.add("show");
    setTimeout(() => state.dom.noAmmoMsg.classList.remove("show"), 800);
    return;
  }

  const pos = new THREE.Vector3();
  const dir = new THREE.Vector3();
  state.camera.getWorldPosition(pos);
  state.camera.getWorldDirection(dir);
  pos.addScaledVector(dir, 0.6);

  if (state.hasSMG) {
    const bulletsToShoot = Math.min(3, state.playerBullets);
    for (let i = 0; i < bulletsToShoot; i++) {
      setTimeout(() => {
        const p2 = new THREE.Vector3();
        const d2 = new THREE.Vector3();
        state.camera.getWorldPosition(p2);
        state.camera.getWorldDirection(d2);
        p2.addScaledVector(d2, 0.6);
        shoot(p2, d2, true, BULLET_SPEED);
      }, i * 100);
    }
    state.playerBullets -= bulletsToShoot;
  } else {
    shoot(pos, dir, true, BULLET_SPEED);
    state.playerBullets--;
  }

  updateAmmoDisplay();
}

export function handleKeyDown(e) {
  const { dom } = state;
  if (
    (dom.startScreen && dom.startScreen.style.display !== "none") ||
    document.activeElement === dom.nameInput
  ) return;

  state.keys[e.code] = true;
  if (e.code === "Space") e.preventDefault();

  // Reload on R key
  if (e.code === "KeyR" && state.gameStarted && !state.gameOver) {
    startReload();
  }
}

export function handleKeyUp(e) {
  const { dom } = state;
  if (
    (dom.startScreen && dom.startScreen.style.display !== "none") ||
    document.activeElement === dom.nameInput
  ) return;

  state.keys[e.code] = false;
}

export function handleMouseMove(e) {
  if (!state.pointerLocked || state.gameOver) return;
  state.yaw -= e.movementX * MOUSE_SENSITIVITY;
  state.pitch -= e.movementY * MOUSE_SENSITIVITY;
  state.pitch = THREE.MathUtils.clamp(state.pitch, -MAX_PITCH, MAX_PITCH);
  state.playerGroup.rotation.y = state.yaw;
}

export function handleResize() {
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
}

export function handlePointerLockChange() {
  state.pointerLocked = document.pointerLockElement === state.renderer.domElement;
}

export function setupEventListeners() {
  const { dom, renderer } = state;

  // Name input — stop game controls from firing while typing
  if (dom.nameInput) {
    dom.nameInput.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") dom.startBtn?.click();
    });
    dom.nameInput.addEventListener("keyup", (e) => e.stopPropagation());
  }

  if (dom.startBtn) dom.startBtn.addEventListener("click", handleStartGame);
  dom.restartBtn.onclick = restartGame;
  dom.smgConfirm.onclick = handleSMGConfirm;
  dom.smgCancel.onclick = handleSMGCancel;

  renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
  renderer.domElement.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("pointerlockchange", handlePointerLockChange);
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
  document.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("resize", handleResize);
}
