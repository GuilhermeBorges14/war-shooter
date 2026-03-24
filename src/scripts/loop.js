import { state } from "./state.js";
import {
  updatePlayerMovement,
  updateWeaponSway,
  updateScreenShake,
  handleReload,
} from "./player.js";
import { updatePickups, spawnSMGPickup } from "./pickups.js";
import { updateBotAI } from "./bot.js";
import {
  updateBulletList,
  showHitmarker,
  showDamageNumber,
  flashBotHit,
} from "./combat.js";
import { endGame } from "./lifecycle.js";
import { playHitSound, playPainSound } from "./audio.js";
import {
  updateBotHealthDisplay,
  drawMinimap,
  showDamageVignette,
  updateKillCounter,
} from "./ui.js";
import { DAMAGE, PLAYER_HEALTH, SMG_SPAWN_DELAY } from "../utils/constants.js";

// ============================================================
// Main game loop
// ============================================================

export function startLoop() {
  requestAnimationFrame(tick);
}

function tick() {
  requestAnimationFrame(tick);

  let dt = state.clock.getDelta();
  if (dt > 0.1) dt = 0.016; // clamp to avoid spiral of death on tab-out

  // Always render (start screen needs background)
  if (!state.gameStarted || state.gameOver) {
    state.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    state.renderer.setScissorTest(false);
    state.renderer.render(state.scene, state.camera);
    return;
  }

  handleReload(dt);
  updatePlayerMovement(dt);
  updateWeaponSway(dt);
  updateScreenShake(dt);

  // Spawn SMG after delay
  if (
    !state.smgSpawned &&
    !state.hasSMG &&
    Date.now() - state.gameStartTime >= SMG_SPAWN_DELAY
  ) {
    spawnSMGPickup();
  }

  updatePickups(dt);
  updateBotAI(dt);

  // Player bullets → hit bot
  updateBulletList(
    state.bullets,
    state.botGroup,
    1,
    (hitPos) => {
      state.botHealth -= DAMAGE;
      playHitSound();
      flashBotHit();
      showHitmarker(hitPos);
      showDamageNumber(hitPos, DAMAGE);
      updateBotHealthDisplay();
      if (state.botHealth <= 0) {
        state.killCount++;
        updateKillCounter();
        endGame(true);
      }
    },
    dt,
  );

  // Bot bullets → hit player
  updateBulletList(
    state.botBullets,
    state.playerGroup,
    1.2,
    () => {
      state.playerHealth -= DAMAGE;
      state.screenShake = 0.6;
      showDamageVignette();
      playPainSound();
      state.dom.healthFill.style.width =
        Math.max(0, (state.playerHealth / PLAYER_HEALTH) * 100) + "%";
      if (state.playerHealth <= 0) endGame(false);
    },
    dt,
  );

  state.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  state.renderer.setScissorTest(false);
  state.renderer.render(state.scene, state.camera);

  drawMinimap();
}
