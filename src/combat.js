import * as THREE from "three";
import { state } from "./state.js";
import { playShootSound } from "./audio.js";
import { BULLET_RANGE, ARENA_SIZE } from "./constants.js";

// ============================================================
// Combat — bullets, hit detection, visual feedback
// ============================================================

export function shoot(fromPosition, direction, isPlayerBullet, bulletSpeed) {
  playShootSound();

  const bulletGroup = new THREE.Group();

  const geo = new THREE.CapsuleGeometry(0.03, 0.15, 4, 8);
  const mat = new THREE.MeshStandardMaterial({
    color: isPlayerBullet ? 0x44ff44 : 0xff4444,
    emissive: isPlayerBullet ? 0x22ff22 : 0xff2222,
    emissiveIntensity: 0.6,
  });
  bulletGroup.add(new THREE.Mesh(geo, mat));

  const glowGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: isPlayerBullet ? 0x44ff44 : 0xff4444,
    transparent: true,
    opacity: 0.4,
  });
  bulletGroup.add(new THREE.Mesh(glowGeo, glowMat));

  bulletGroup.position.copy(fromPosition);
  const dir = direction.clone().normalize();

  bulletGroup.quaternion.copy(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir),
  );

  const data = {
    mesh: bulletGroup,
    velocity: dir.multiplyScalar(bulletSpeed),
    isPlayer: isPlayerBullet,
    life: BULLET_RANGE / bulletSpeed,
  };
  state.scene.add(bulletGroup);
  if (isPlayerBullet) state.bullets.push(data);
  else state.botBullets.push(data);
}

export function updateBulletList(list, targetGroup, hitRadius, onHit, dt) {
  const wallBound = ARENA_SIZE / 2 - 0.5;
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    b.mesh.position.add(state._scratchVec.copy(b.velocity).multiplyScalar(dt));
    b.mesh.quaternion.copy(
      state._scratchQuat.setFromUnitVectors(
        state._yAxis,
        state._scratchVec.copy(b.velocity).normalize(),
      ),
    );
    b.life -= dt;

    if (
      Math.abs(b.mesh.position.x) > wallBound ||
      Math.abs(b.mesh.position.z) > wallBound
    ) {
      state.scene.remove(b.mesh);
      list.splice(i, 1);
      continue;
    }

    if (b.life <= 0) {
      state.scene.remove(b.mesh);
      list.splice(i, 1);
      continue;
    }

    let hitCrate = false;
    for (let c = 0; c < state.crateBounds.length; c++) {
      if (state.crateBounds[c].containsPoint(b.mesh.position)) {
        state.scene.remove(b.mesh);
        list.splice(i, 1);
        hitCrate = true;
        break;
      }
    }
    if (hitCrate) continue;

    state._scratchVec.set(0, 1, 0).applyMatrix4(targetGroup.matrixWorld);
    if (b.mesh.position.distanceTo(state._scratchVec) < hitRadius) {
      state.scene.remove(b.mesh);
      list.splice(i, 1);
      onHit(state._scratchVec.clone());
    }
  }
}

export function showHitmarker(worldPosition) {
  const vector = worldPosition.clone();
  vector.project(state.camera);

  const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

  const hitmarker = document.createElement("div");
  hitmarker.style.cssText = `
    position: absolute;
    left: ${x}px;
    top: ${y}px;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 40px;
    pointer-events: none;
    z-index: 999;
    opacity: 1;
    transition: opacity 0.3s ease;
  `;
  hitmarker.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 40 40" style="filter: drop-shadow(0 0 4px rgba(220,38,38,0.8));">
      <line x1="8"  y1="8"  x2="32" y2="32" stroke="#dc2626" stroke-width="3" stroke-linecap="round"/>
      <line x1="32" y1="8"  x2="8"  y2="32" stroke="#dc2626" stroke-width="3" stroke-linecap="round"/>
      <circle cx="20" cy="20" r="3" fill="#dc2626" opacity="0.6"/>
    </svg>
  `;
  document.body.appendChild(hitmarker);
  setTimeout(() => {
    hitmarker.style.opacity = "0";
    setTimeout(() => hitmarker.parentNode?.removeChild(hitmarker), 300);
  }, 100);
}

export function showDamageNumber(worldPosition, amount) {
  const vector = worldPosition.clone();
  vector.project(state.camera);

  const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

  const el = document.createElement("div");
  el.className = "damage-number";
  el.textContent = `-${amount}`;
  el.style.left = `${x + (Math.random() - 0.5) * 30}px`;
  el.style.top = `${y - 20}px`;
  document.body.appendChild(el);
  setTimeout(() => el.parentNode?.removeChild(el), 900);
}

export function flashBotHit() {
  if (!state.botBodyMaterials) return;
  state.botBodyMaterials.forEach(({ mat, origColor }) => {
    mat.color.set(0xff4444);
    setTimeout(() => mat.color.copy(origColor), 80);
  });
}
