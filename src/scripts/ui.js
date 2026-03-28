import { state } from "./state.js";
import { ARENA_SIZE } from "../utils/constants.js";

// ============================================================
// UI / HUD — DOM element cache and update functions
// ============================================================

export function cacheDOMElements() {
  const d = state.dom;
  d.canvas = document.getElementById("canvas");
  d.ammoCount = document.getElementById("ammo-count");
  d.ammoCounter = document.getElementById("ammo-counter");
  d.noAmmoMsg = document.getElementById("no-ammo-message");
  d.fullAmmoMsg = document.getElementById("full-ammo-message");
  d.healthFill = document.getElementById("health-fill");
  d.botHealthFill = document.getElementById("bot-health-fill");
  d.message = document.getElementById("message");
  d.restartBtn = document.getElementById("restart-btn");
  d.smgPopup = document.getElementById("smg-popup");
  d.smgConfirm = document.getElementById("smg-confirm");
  d.smgCancel = document.getElementById("smg-cancel");
  d.startScreen = document.getElementById("start-screen");
  d.startBtn = document.getElementById("start-btn");
  d.nameInput = document.getElementById("player-name-input");
  d.playerNameDisplay = document.getElementById("player-name-display");
  d.playerHealthLabel = document.getElementById("player-health-label");
  d.minimap = document.getElementById("minimap");
  d.minimapCtx = d.minimap ? d.minimap.getContext("2d") : null;
  d.killCount = document.getElementById("kill-count");
  d.crosshair = document.getElementById("crosshair");
  d.reloadBar = document.getElementById("reload-bar");
  d.reloadBarFill = document.getElementById("reload-bar-fill");
  d.reloadText = document.getElementById("reload-text");
  d.damageVignette = document.getElementById("damage-vignette");
}

export function updateAmmoDisplay() {
  const { dom } = state;
  if (!dom.ammoCount) return;
  dom.ammoCount.textContent = state.playerBullets;
  if (state.playerBullets <= 3) {
    dom.ammoCount.style.color = "#ef4444";
  } else if (state.playerBullets <= 5) {
    dom.ammoCount.style.color = "#f59e0b";
  } else {
    dom.ammoCount.style.color = "#ccee90";
  }
}

export function updateBotHealthDisplay() {
  if (state.dom.botHealthFill)
    state.dom.botHealthFill.style.width =
      Math.max(0, (state.botHealth / state.botMaxHealth) * 100) + "%";
}

export function updateKillCounter() {
  if (state.dom.killCount) {
    state.dom.killCount.textContent = state.killCount;
  }
}

export function showFullAmmoMessage() {
  const { dom } = state;
  const now = Date.now();
  if (now - state.fullAmmoMessageTime > 1000) {
    state.fullAmmoMessageTime = now;
    if (dom.fullAmmoMsg) {
      dom.fullAmmoMsg.classList.add("show");
      setTimeout(() => dom.fullAmmoMsg.classList.remove("show"), 800);
    }
  }
}

export function updateReloadBar(progress) {
  const { dom } = state;
  if (dom.reloadBar) dom.reloadBar.classList.add("show");
  if (dom.reloadText) dom.reloadText.classList.add("show");
  if (dom.reloadBarFill) dom.reloadBarFill.style.width = progress * 100 + "%";
}

export function hideReloadBar() {
  const { dom } = state;
  if (dom.reloadBar) dom.reloadBar.classList.remove("show");
  if (dom.reloadText) dom.reloadText.classList.remove("show");
  if (dom.reloadBarFill) dom.reloadBarFill.style.width = "0%";
}

export function showDamageVignette() {
  const { dom } = state;
  if (!dom.damageVignette) return;
  dom.damageVignette.classList.add("flash");
  setTimeout(() => dom.damageVignette.classList.remove("flash"), 200);
}

export function drawMinimap() {
  const { dom } = state;
  if (!dom.minimapCtx) return;

  const ctx = dom.minimapCtx;
  const size = 180;
  const scale = size / ARENA_SIZE;

  ctx.fillStyle = "rgba(2, 6, 2, 0.96)";
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(82, 122, 58, 0.7)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(46, 70, 40, 0.4)";
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

  // Crates
  ctx.fillStyle = "rgba(90, 110, 70, 0.55)";
  for (const crate of state.crates) {
    const x = (crate.position.x + ARENA_SIZE / 2) * scale;
    const z = (crate.position.z + ARENA_SIZE / 2) * scale;
    const s = 2 * scale;
    ctx.fillRect(x - s / 2, z - s / 2, s, s);
  }

  // Bullet drops
  ctx.fillStyle = "#e89000";
  ctx.strokeStyle = "#c87800";
  ctx.lineWidth = 1;
  for (const drop of state.bulletDrops) {
    const x = (drop.mesh.position.x + ARENA_SIZE / 2) * scale;
    const z = (drop.mesh.position.z + ARENA_SIZE / 2) * scale;
    ctx.beginPath();
    ctx.arc(x, z, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Bot
  const botX = (state.botGroup.position.x + ARENA_SIZE / 2) * scale;
  const botZ = (state.botGroup.position.z + ARENA_SIZE / 2) * scale;
  ctx.fillStyle = "#e01810";
  ctx.beginPath();
  ctx.arc(botX, botZ, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e01810";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(botX, botZ);
  ctx.lineTo(
    botX - Math.sin(state.botGroup.rotation.y) * 10,
    botZ - Math.cos(state.botGroup.rotation.y) * 10,
  );
  ctx.stroke();

  // Player
  const px = (state.playerGroup.position.x + ARENA_SIZE / 2) * scale;
  const pz = (state.playerGroup.position.z + ARENA_SIZE / 2) * scale;
  ctx.fillStyle = "#9edd20";
  ctx.beginPath();
  ctx.arc(px, pz, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#9edd20";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, pz);
  ctx.lineTo(px - Math.sin(state.yaw) * 12, pz - Math.cos(state.yaw) * 12);
  ctx.stroke();
}
