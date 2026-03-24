import { state } from "./state.js";
import { createGun, createSMG } from "./entities.js";
import { spawnBulletDrops } from "./pickups.js";
import { updateAmmoDisplay, updateBotHealthDisplay, updateKillCounter } from "./ui.js";
import {
  PLAYER_HEALTH,
  BOT_HEALTH,
  BOT_MOVE_SPEED,
  MAX_BULLETS_SMG,
  STARTING_BULLETS,
} from "./constants.js";

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

  // Reset gun to default
  state.camera.remove(state.playerGun);
  state.playerGun = createGun();
  state.camera.add(state.playerGun);

  // Remove old SMG pickup
  if (state.smgPickup) {
    state.scene.remove(state.smgPickup);
    state.smgPickup = null;
  }

  // Clear bullets
  state.bullets.forEach((b) => state.scene.remove(b.mesh));
  state.botBullets.forEach((b) => state.scene.remove(b.mesh));
  state.bullets = [];
  state.botBullets = [];

  // Clear old bullet drops and spawn fresh ones
  state.bulletDrops.forEach((drop) => state.scene.remove(drop.mesh));
  state.bulletDrops = [];
  spawnBulletDrops(5);

  // Reset positions
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

  // Keep player name
  const savedName = localStorage.getItem("playerName");
  if (dom.playerNameDisplay && savedName) {
    dom.playerNameDisplay.textContent = savedName;
  }
  if (dom.playerHealthLabel && savedName) {
    dom.playerHealthLabel.textContent = savedName + "'s Health";
  }

  dom.message.style.display = "none";
  dom.restartBtn.style.display = "none";

  state.renderer.domElement.requestPointerLock();
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

  state.renderer.domElement.requestPointerLock();
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

  if (state.smgPickup) state.smgPickup.visible = false;
  dom.smgPopup.style.display = "none";

  state.camera.remove(state.playerGun);
  state.playerGun = createSMG();
  state.camera.add(state.playerGun);

  state.renderer.domElement.requestPointerLock();
}

export function handleSMGCancel() {
  state.dom.smgPopup.style.display = "none";
  state.smgPopupShown = false;
  state.renderer.domElement.requestPointerLock();
}
