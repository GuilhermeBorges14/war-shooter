import * as THREE from "three";
import { state } from "./state.js";
import { shoot } from "./combat.js";
import {
  BOT_FAR_DIST,
  BOT_MED_DIST,
  BOT_STRAFE_MULT,
  BOT_SHOOT_INTERVAL,
  ENTITY_BOUND,
  BOT_BULLET_SPEED,
} from "./constants.js";

// ============================================================
// Bot AI — targeting, movement, shooting
// ============================================================

export function updateBotAI(dt) {
  const { botGroup, playerGroup } = state;

  const toPlayer = new THREE.Vector3()
    .subVectors(playerGroup.position, botGroup.position)
    .setY(0);
  const dist = toPlayer.length();

  if (dist > 0.01) {
    toPlayer.normalize();
    state.botTargetAngle = Math.atan2(-toPlayer.x, -toPlayer.z);
    const currentAngle = botGroup.rotation.y;
    let diff = state.botTargetAngle - currentAngle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    botGroup.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), 3 * dt);

    if (dist > BOT_FAR_DIST) {
      botGroup.position.x += Math.sin(botGroup.rotation.y) * -state.botMoveSpeed * dt;
      botGroup.position.z += Math.cos(botGroup.rotation.y) * -state.botMoveSpeed * dt;
    } else if (dist > BOT_MED_DIST) {
      botGroup.position.x += Math.sin(botGroup.rotation.y) * -state.botMoveSpeed * 0.6 * dt;
      botGroup.position.z += Math.cos(botGroup.rotation.y) * -state.botMoveSpeed * 0.6 * dt;
    } else {
      const strafeAngle = botGroup.rotation.y + Math.PI / 2;
      const strafeDir = Math.sin(Date.now() * 0.001) > 0 ? 1 : -1;
      botGroup.position.x += Math.sin(strafeAngle) * state.botMoveSpeed * BOT_STRAFE_MULT * strafeDir * dt;
      botGroup.position.z += Math.cos(strafeAngle) * state.botMoveSpeed * BOT_STRAFE_MULT * strafeDir * dt;
    }

    botGroup.position.x = THREE.MathUtils.clamp(botGroup.position.x, -ENTITY_BOUND, ENTITY_BOUND);
    botGroup.position.z = THREE.MathUtils.clamp(botGroup.position.z, -ENTITY_BOUND, ENTITY_BOUND);
  }

  state.botShootTimer += dt * 1000;
  if (state.botShootTimer >= BOT_SHOOT_INTERVAL) {
    state.botShootTimer = 0;

    const botPos = new THREE.Vector3();
    if (state.botGunRef) {
      state.botGunRef.getWorldPosition(botPos);
      state._scratchVec.set(0, 0, -1).applyAxisAngle(state._yAxis, botGroup.rotation.y);
      botPos.add(state._scratchVec.multiplyScalar(0.3));
    } else {
      botGroup.getWorldPosition(botPos);
      botPos.y += 1;
    }

    state._scratchVec.set(0, 0, -1).applyAxisAngle(state._yAxis, botGroup.rotation.y);
    shoot(botPos, state._scratchVec, false, BOT_BULLET_SPEED);
  }
}
