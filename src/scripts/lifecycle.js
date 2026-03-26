import { state } from "./state.js";
import { createGun, createSMG } from "./entities.js";
import { spawnBulletDrops } from "./pickups.js";
import {
  updateAmmoDisplay,
  updateBotHealthDisplay,
  updateKillCounter,
} from "./ui.js";
import {
  PLAYER_HEALTH,
  BOT_HEALTH,
  BOT_MOVE_SPEED,
  MAX_BULLETS_SMG,
  STARTING_BULLETS,
} from "../utils/constants.js";

// ============================================================
// Game lifecycle — start, restart, win/lose, SMG choice
// ============================================================

export function endGame(won) {
  state.gameOver = true;
  const { dom } = state;
  dom.message.style.display = "block";
  dom.message.textContent = won ? "You win! 🎉" : "You lose!";
  dom.message.className = won ? "win" : "lose";
  document.exitPointerLock();
  dom.restartBtn.style.display = "block";
}

export function restartGame() {
  const { dom } = state;

  state.gameStarted = true;
  state.gameOver = false;
  state.playerHealth = PLAYER_HEALTH;
  state.botHealth = BOT_HEALTH;
  state.botMaxHealth = BOT_HEALTH;
  state.botShootTimer = 0;
  state.playerBullets = STARTING_BULLETS;
  state.hasSMG = false;
  state.gameStartTime = Date.now();
  state.smgSpawned = false;
  state.smgPopupShown = false;
  state.botMoveSpeed = BOT_MOVE_SPEED;
  state.playerVelocity.set(0, 0, 0);
  state.isReloading = false;
  state.reloadTimer = 0;
  state.screenShake = 0;

  // Swap gun back to pistol
  if (state.playerGun) {
    state.playerGun.parent = null;
    state.playerGun.dispose();
  }
  state.playerGun = createGun();
  state.playerGun.parent = state.camera;

  // Remove old SMG pickup
  if (state.smgPickup) {
    state.smgPickup.dispose();
    state.smgPickup = null;
  }

  // Dispose all active bullets
  state.bullets.forEach((b) => b.mesh.dispose());
  state.botBullets.forEach((b) => b.mesh.dispose());
  state.bullets = [];
  state.botBullets = [];

  // Dispose old drops and spawn fresh set
  state.bulletDrops.forEach((drop) => drop.mesh.dispose());
  state.bulletDrops = [];
  spawnBulletDrops(5);

  // Reset positions and rotations
  state.playerGroup.position.set(0, 0, 0);
  state.botGroup.position.set(8, 0, 8);
  state.playerGroup.rotation.y = 0;
  state.botGroup.rotation.y = 0;
  state.yaw = 0;
  state.pitch = 0;

  // Reset health displays
  dom.healthFill.style.width = "100%";
  dom.botHealthFill.style.width = "100%";
  updateAmmoDisplay();

  const savedName = localStorage.getItem("playerName");
  if (dom.playerNameDisplay && savedName) dom.playerNameDisplay.textContent = savedName;
  if (dom.playerHealthLabel && savedName) dom.playerHealthLabel.textContent = savedName + "'s Health";

  dom.message.style.display = "none";
  dom.restartBtn.style.display = "none";

  state.engine.getRenderingCanvas().requestPointerLock();
}

export function handleStartGame() {
  const { dom } = state;
  const playerName = dom.nameInput?.value.trim() || "Player";
  localStorage.setItem("playerName", playerName);

  if (dom.playerNameDisplay) dom.playerNameDisplay.textContent = playerName;
  if (dom.playerHealthLabel) dom.playerHealthLabel.textContent = playerName + "'s Health";
  if (dom.startScreen) dom.startScreen.style.display = "none";

  state.gameStarted = true;
  state.gameStartTime = Date.now();
  state.smgSpawned = false;

  state.engine.getRenderingCanvas().requestPointerLock();
}

export function handleSMGConfirm() {
  const { dom } = state;

  state.hasSMG = true;
  state.playerBullets = MAX_BULLETS_SMG;
  updateAmmoDisplay();

  state.botMaxHealth = BOT_HEALTH * 3;
  state.botHealth = state.botMaxHealth;
  updateBotHealthDisplay();

  state.botMoveSpeed = BOT_MOVE_SPEED * 1.25;

  if (state.smgPickup) state.smgPickup.setEnabled(false);
  dom.smgPopup.style.display = "none";

  if (state.playerGun) {
    state.playerGun.parent = null;
    state.playerGun.dispose();
  }
  state.playerGun = createSMG();
  state.playerGun.parent = state.camera;

  state.engine.getRenderingCanvas().requestPointerLock();
}

export function handleSMGCancel() {
  state.dom.smgPopup.style.display = "none";
  state.smgPopupShown = false;
  state.engine.getRenderingCanvas().requestPointerLock();
}
