const BABYLON = window.BABYLON;
import { state } from "./state.js";
import { shoot } from "./combat.js";
import {
  BOT_FAR_DIST,
  BOT_MED_DIST,
  BOT_STRAFE_MULT,
  BOT_SHOOT_INTERVAL,
  ENTITY_BOUND,
  BOT_BULLET_SPEED,
} from "../utils/constants.js";

// ============================================================
// Bot AI — targeting, movement, shooting
// ============================================================

export function updateBotAI(dt) {
  const { botGroup, playerGroup } = state;

  // 2D vector from bot to player (ignore Y)
  const toPlayer = playerGroup.position.subtract(botGroup.position);
  toPlayer.y = 0;
  const dist = toPlayer.length();

  if (dist > 0.01) {
    toPlayer.normalize();

    // Compute target yaw using same formula as Three.js (negations match the
    // movement sign below — the bot's "forward" is its -Z local axis)
    state.botTargetAngle = Math.atan2(-toPlayer.x, -toPlayer.z);
    const currentAngle = botGroup.rotation.y;
    let diff = state.botTargetAngle - currentAngle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    botGroup.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), 3 * dt);

    // Movement: negative-Z local forward convention (matches Three.js source)
    const sinY = Math.sin(botGroup.rotation.y);
    const cosY = Math.cos(botGroup.rotation.y);

    if (dist > BOT_FAR_DIST) {
      botGroup.position.x += sinY * -state.botMoveSpeed * dt;
      botGroup.position.z += cosY * -state.botMoveSpeed * dt;
    } else if (dist > BOT_MED_DIST) {
      botGroup.position.x += sinY * -state.botMoveSpeed * 0.6 * dt;
      botGroup.position.z += cosY * -state.botMoveSpeed * 0.6 * dt;
    } else {
      const strafeAngle = botGroup.rotation.y + Math.PI / 2;
      const strafeDir = Math.sin(Date.now() * 0.001) > 0 ? 1 : -1;
      botGroup.position.x +=
        Math.sin(strafeAngle) * state.botMoveSpeed * BOT_STRAFE_MULT * strafeDir * dt;
      botGroup.position.z +=
        Math.cos(strafeAngle) * state.botMoveSpeed * BOT_STRAFE_MULT * strafeDir * dt;
    }

    botGroup.position.x = BABYLON.Scalar.Clamp(botGroup.position.x, -ENTITY_BOUND, ENTITY_BOUND);
    botGroup.position.z = BABYLON.Scalar.Clamp(botGroup.position.z, -ENTITY_BOUND, ENTITY_BOUND);
  }

  state.botShootTimer += dt * 1000;
  if (state.botShootTimer >= BOT_SHOOT_INTERVAL) {
    state.botShootTimer = 0;

    const botPos = new BABYLON.Vector3();
    if (state.botGunRef) {
      // getAbsolutePosition() returns a read-only ref — clone it
      botPos.copyFrom(state.botGunRef.getAbsolutePosition());
      // Nudge forward along bot's facing direction
      const fwd = new BABYLON.Vector3(
        Math.sin(botGroup.rotation.y) * -0.3,
        0,
        Math.cos(botGroup.rotation.y) * -0.3,
      );
      botPos.addInPlace(fwd);
    } else {
      botPos.copyFrom(botGroup.getAbsolutePosition());
      botPos.y += 1;
    }

    // Fire direction: bot's forward (-Z local)
    const fireDir = new BABYLON.Vector3(
      Math.sin(botGroup.rotation.y) * -1,
      0,
      Math.cos(botGroup.rotation.y) * -1,
    );
    shoot(botPos, fireDir, false, BOT_BULLET_SPEED);
  }
}
