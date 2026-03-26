const BABYLON = window.BABYLON;
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
} from "../utils/constants.js";

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

  // Camera world position = camera.position (camera is not a child of another node)
  const pos = state.camera.position.clone();

  // Camera forward in world space: transform local +Z by camera world matrix
  // (camera.rotation.y = -yaw, camera.rotation.x = -pitch — see player.js)
  const forward = BABYLON.Vector3.TransformNormal(
    new BABYLON.Vector3(0, 0, 1),
    state.camera.getWorldMatrix(),
  );
  forward.normalize();

  // Offset origin slightly forward so bullets start in front of player
  pos.x += forward.x * 0.6;
  pos.y += forward.y * 0.6;
  pos.z += forward.z * 0.6;

  if (state.hasSMG) {
    const bulletsToShoot = Math.min(3, state.playerBullets);
    for (let i = 0; i < bulletsToShoot; i++) {
      setTimeout(() => {
        if (!state.gameOver) {
          const p2 = state.camera.position.clone();
          const fwd2 = BABYLON.Vector3.TransformNormal(
            new BABYLON.Vector3(0, 0, 1),
            state.camera.getWorldMatrix(),
          );
          fwd2.normalize();
          p2.x += fwd2.x * 0.6;
          p2.y += fwd2.y * 0.6;
          p2.z += fwd2.z * 0.6;
          shoot(p2, fwd2, true, BULLET_SPEED);
        }
      }, i * 100);
    }
    state.playerBullets -= bulletsToShoot;
  } else {
    shoot(pos, forward, true, BULLET_SPEED);
    state.playerBullets--;
  }

  updateAmmoDisplay();
}

export function handleKeyDown(e) {
  const { dom } = state;
  if (
    (dom.startScreen && dom.startScreen.style.display !== "none") ||
    document.activeElement === dom.nameInput
  )
    return;

  state.keys[e.code] = true;
  if (e.code === "Space") e.preventDefault();

  if (e.code === "KeyR" && state.gameStarted && !state.gameOver) {
    startReload();
  }
}

export function handleKeyUp(e) {
  const { dom } = state;
  if (
    (dom.startScreen && dom.startScreen.style.display !== "none") ||
    document.activeElement === dom.nameInput
  )
    return;

  state.keys[e.code] = false;
}

export function handleMouseMove(e) {
  if (!state.pointerLocked || state.gameOver) return;
  // Same accumulation as Three.js; camera negation is applied in player.js
  state.yaw -= e.movementX * MOUSE_SENSITIVITY;
  state.pitch -= e.movementY * MOUSE_SENSITIVITY;
  state.pitch = BABYLON.Scalar.Clamp(state.pitch, -MAX_PITCH, MAX_PITCH);
  state.playerGroup.rotation.y = state.yaw;
}

export function handleResize() {
  state.engine.resize();
}

export function handlePointerLockChange() {
  const canvas = state.engine.getRenderingCanvas();
  state.pointerLocked = document.pointerLockElement === canvas;
}

export function setupEventListeners() {
  const { dom } = state;
  const canvas = state.engine.getRenderingCanvas();

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

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("pointerlockchange", handlePointerLockChange);
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
  document.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("resize", handleResize);
}
