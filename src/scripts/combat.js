const BABYLON = window.BABYLON;
import { state } from "./state.js";
import { playShootSound } from "./audio.js";
import { BULLET_RANGE, ARENA_SIZE } from "../utils/constants.js";

// ============================================================
// Combat — bullets, hit detection, visual feedback
// ============================================================

// Reusable viewport for screen projection
const _viewport = new BABYLON.Viewport(0, 0, 1, 1);
// Cached up-vector for quaternion orientation
const _yUp = new BABYLON.Vector3(0, 1, 0);

export function shoot(fromPosition, direction, isPlayerBullet, bulletSpeed) {
  playShootSound();

  const dir = direction.clone().normalize();

  // Dark steel — near-black body, slightly lighter nose
  const bodyColor = new BABYLON.Color3(0.16, 0.16, 0.16);
  const noseColor = new BABYLON.Color3(0.26, 0.26, 0.26);
  const specular  = new BABYLON.Color3(0.55, 0.55, 0.55);
  const emissive  = new BABYLON.Color3(0.05, 0.05, 0.05);

  // Cylindrical casing body
  const bulletMesh = BABYLON.MeshBuilder.CreateCylinder(
    "bullet",
    { height: 0.16, diameter: 0.052, tessellation: 10 },
    state.scene,
  );
  const bodyMat = new BABYLON.StandardMaterial("bulletMat", state.scene);
  bodyMat.diffuseColor  = bodyColor;
  bodyMat.emissiveColor = emissive;
  bodyMat.specularColor = specular;
  bodyMat.specularPower = 128;
  bulletMesh.material = bodyMat;
  bulletMesh.position.copyFrom(fromPosition);

  // Orient along travel direction (+Y → forward)
  _orientAlongDir(bulletMesh, dir);

  // Ogive nose cone — pointed tip at +Y (forward), base matches body diameter
  const noseMesh = BABYLON.MeshBuilder.CreateCylinder(
    "bulletNose",
    { height: 0.09, diameterTop: 0.0, diameterBottom: 0.052, tessellation: 10 },
    state.scene,
  );
  const noseMat = new BABYLON.StandardMaterial("noseMat", state.scene);
  noseMat.diffuseColor  = noseColor;
  noseMat.emissiveColor = emissive;
  noseMat.specularColor = specular;
  noseMat.specularPower = 96;
  noseMesh.material = noseMat;
  // Sit flush on top of the body (+Y face)
  noseMesh.position.y = 0.16 / 2 + 0.09 / 2;
  noseMesh.parent = bulletMesh;

  const data = {
    mesh: bulletMesh,
    velocity: dir.scale(bulletSpeed),
    isPlayer: isPlayerBullet,
    life: BULLET_RANGE / bulletSpeed,
  };

  if (isPlayerBullet) state.bullets.push(data);
  else state.botBullets.push(data);
}

// Orient a mesh so its local +Y axis points along dir (quaternion — works for all angles)
function _orientAlongDir(mesh, dir) {
  const dot = BABYLON.Vector3.Dot(_yUp, dir);
  if (dot > 0.9999) {
    mesh.rotationQuaternion = BABYLON.Quaternion.Identity();
  } else if (dot < -0.9999) {
    mesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(1, 0, 0), Math.PI);
  } else {
    const axis = BABYLON.Vector3.Cross(_yUp, dir).normalize();
    mesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, Math.acos(BABYLON.Scalar.Clamp(dot, -1, 1)));
  }
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
    <svg width="36" height="36" viewBox="0 0 36 36" style="filter: drop-shadow(0 0 5px rgba(158,221,32,0.9));">
      <line x1="6"  y1="6"  x2="30" y2="30" stroke="#9edd20" stroke-width="2.5" stroke-linecap="square"/>
      <line x1="30" y1="6"  x2="6"  y2="30" stroke="#9edd20" stroke-width="2.5" stroke-linecap="square"/>
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
