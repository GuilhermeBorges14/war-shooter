const BABYLON = window.BABYLON;
import { state } from "./state.js";
import { playShootSound } from "./audio.js";
import { BULLET_RANGE, ARENA_SIZE } from "../utils/constants.js";

// ============================================================
// Combat — bullets, hit detection, visual feedback
// ============================================================

// Reusable viewport for screen projection
const _viewport = new BABYLON.Viewport(0, 0, 1, 1);

export function shoot(fromPosition, direction, isPlayerBullet, bulletSpeed) {
  playShootSound();

  const dir = direction.clone().normalize();
  const color = isPlayerBullet ? new BABYLON.Color3(0.267, 1.0, 0.267) : new BABYLON.Color3(1.0, 0.267, 0.267);

  // Capsule body
  const bulletMesh = BABYLON.MeshBuilder.CreateCapsule(
    "bullet",
    { radius: 0.03, height: 0.18, tessellation: 4, subdivisions: 2 },
    state.scene,
  );
  const bulletMat = new BABYLON.StandardMaterial("bulletMat", state.scene);
  bulletMat.diffuseColor = color;
  bulletMat.emissiveColor = color;
  bulletMesh.material = bulletMat;
  bulletMesh.position.copyFrom(fromPosition);

  // Orient capsule along travel direction
  _orientAlongDir(bulletMesh, dir);

  // Glow sphere (child of capsule — disposed together)
  const glowMesh = BABYLON.MeshBuilder.CreateSphere(
    "bulletGlow",
    { diameter: 0.16, segments: 6 },
    state.scene,
  );
  const glowMat = new BABYLON.StandardMaterial("glowMat", state.scene);
  glowMat.diffuseColor = color;
  glowMat.alpha = 0.4;
  glowMesh.material = glowMat;
  glowMesh.parent = bulletMesh;

  const data = {
    mesh: bulletMesh,
    velocity: dir.scale(bulletSpeed),
    isPlayer: isPlayerBullet,
    life: BULLET_RANGE / bulletSpeed,
  };

  if (isPlayerBullet) state.bullets.push(data);
  else state.botBullets.push(data);
}

// Orient a mesh so its local +Y axis points along dir
function _orientAlongDir(mesh, dir) {
  const yaw = Math.atan2(dir.x, dir.z);
  const pitch = -Math.asin(BABYLON.Scalar.Clamp(dir.y, -1, 1));
  mesh.rotation.set(pitch, yaw, 0);
}

// AABB point-in-box test (Babylon.js replaces Box3.containsPoint)
function _aabbContains(bounds, p) {
  return (
    p.x >= bounds.min.x && p.x <= bounds.max.x &&
    p.y >= bounds.min.y && p.y <= bounds.max.y &&
    p.z >= bounds.min.z && p.z <= bounds.max.z
  );
}

export function updateBulletList(list, targetGroup, hitRadius, onHit, dt) {
  const wallBound = ARENA_SIZE / 2 - 0.5;

  // Target hit-centre: absolute position + 1 unit up
  const absPos = targetGroup.getAbsolutePosition();
  const targetCenter = new BABYLON.Vector3(absPos.x, absPos.y + 1, absPos.z);

  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];

    // Inline math — avoids a Vector3 allocation per bullet per frame
    b.mesh.position.x += b.velocity.x * dt;
    b.mesh.position.y += b.velocity.y * dt;
    b.mesh.position.z += b.velocity.z * dt;
    _orientAlongDir(b.mesh, b.velocity);
    b.life -= dt;

    const p = b.mesh.position;

    if (Math.abs(p.x) > wallBound || Math.abs(p.z) > wallBound) {
      b.mesh.dispose();
      list.splice(i, 1);
      continue;
    }

    if (b.life <= 0) {
      b.mesh.dispose();
      list.splice(i, 1);
      continue;
    }

    let hitCrate = false;
    for (let c = 0; c < state.crateBounds.length; c++) {
      if (_aabbContains(state.crateBounds[c], p)) {
        b.mesh.dispose();
        list.splice(i, 1);
        hitCrate = true;
        break;
      }
    }
    if (hitCrate) continue;

    if (BABYLON.Vector3.Distance(p, targetCenter) < hitRadius) {
      b.mesh.dispose();
      list.splice(i, 1);
      onHit(targetCenter.clone());
    }
  }
}

export function showHitmarker(worldPosition) {
  const screenPos = BABYLON.Vector3.Project(
    worldPosition,
    BABYLON.Matrix.Identity(),
    state.scene.getTransformMatrix(),
    _viewport.toGlobal(window.innerWidth, window.innerHeight),
  );

  const hitmarker = document.createElement("div");
  hitmarker.style.cssText = `
    position: absolute;
    left: ${screenPos.x}px;
    top: ${screenPos.y}px;
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
  const screenPos = BABYLON.Vector3.Project(
    worldPosition,
    BABYLON.Matrix.Identity(),
    state.scene.getTransformMatrix(),
    _viewport.toGlobal(window.innerWidth, window.innerHeight),
  );

  const el = document.createElement("div");
  el.className = "damage-number";
  el.textContent = `-${amount}`;
  el.style.left = `${screenPos.x + (Math.random() - 0.5) * 30}px`;
  el.style.top = `${screenPos.y - 20}px`;
  document.body.appendChild(el);
  setTimeout(() => el.parentNode?.removeChild(el), 900);
}

export function flashBotHit() {
  if (!state.botBodyMaterials) return;
  state.botBodyMaterials.forEach(({ mat, origColor }) => {
    mat.diffuseColor.set(1, 0.267, 0.267); // 0xff4444
    setTimeout(() => mat.diffuseColor.copyFrom(origColor), 80);
  });
}
