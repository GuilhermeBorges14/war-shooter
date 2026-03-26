const BABYLON = window.BABYLON;
import { state } from "./state.js";
import { c3 } from "../utils/colors.js";
import { playSMGSpawnSound } from "./audio.js";
import { createSMGPickup } from "./entities.js";
import { updateAmmoDisplay, showFullAmmoMessage } from "./ui.js";
import {
  ARENA_SIZE,
  MAX_BULLETS,
  MAX_BULLETS_SMG,
  BULLETS_PER_PICKUP,
  SMG_COLLECT_DIST,
  PICKUP_COLLECT_DIST,
  DROP_RESPAWN_DELAY,
} from "../utils/constants.js";

// ============================================================
// Pickup system — bullet drops, SMG pickup
// ============================================================

export function createBulletDrop(x, z) {
  const dropGroup = new BABYLON.TransformNode("bulletDrop", state.scene);

  const crateMat = new BABYLON.StandardMaterial("dropCrateMat", state.scene);
  crateMat.diffuseColor = c3(0x5a6b3e);
  crateMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);

  const crateBox = BABYLON.MeshBuilder.CreateBox(
    "dropCrate",
    { width: 0.5, height: 0.35, depth: 0.35 },
    state.scene,
  );
  crateBox.material = crateMat;
  crateBox.parent = dropGroup;

  const bandMat = new BABYLON.StandardMaterial("bandMat", state.scene);
  bandMat.diffuseColor = c3(0x3a3a3a);
  bandMat.specularColor = new BABYLON.Color3(0.7, 0.7, 0.7);
  bandMat.specularPower = 64;

  const topBand = BABYLON.MeshBuilder.CreateBox(
    "topBand",
    { width: 0.52, height: 0.04, depth: 0.37 },
    state.scene,
  );
  topBand.position.y = 0.12;
  topBand.material = bandMat;
  topBand.parent = dropGroup;

  const bottomBand = BABYLON.MeshBuilder.CreateBox(
    "bottomBand",
    { width: 0.52, height: 0.04, depth: 0.37 },
    state.scene,
  );
  bottomBand.position.y = -0.12;
  bottomBand.material = bandMat;
  bottomBand.parent = dropGroup;

  const sideBand = BABYLON.MeshBuilder.CreateBox(
    "sideBand",
    { width: 0.04, height: 0.37, depth: 0.37 },
    state.scene,
  );
  sideBand.material = bandMat;
  sideBand.parent = dropGroup;

  const labelMat = new BABYLON.StandardMaterial("labelMat", state.scene);
  labelMat.diffuseColor = c3(0xf5f5dc);
  labelMat.emissiveColor = c3(0xf5f5dc).scale(0.3);
  const label = BABYLON.MeshBuilder.CreateBox(
    "label",
    { width: 0.15, height: 0.15, depth: 0.02 },
    state.scene,
  );
  label.position.set(0, 0, 0.18);
  label.material = labelMat;
  label.parent = dropGroup;

  const glowMat = new BABYLON.StandardMaterial("dropGlowMat", state.scene);
  glowMat.diffuseColor = c3(0xffd700);
  glowMat.alpha = 0.15;
  const glow = BABYLON.MeshBuilder.CreateSphere(
    "dropGlow",
    { diameter: 0.7, segments: 12 },
    state.scene,
  );
  glow.material = glowMat;
  glow.parent = dropGroup;

  dropGroup.position.set(x, 0.4, z);
  return { mesh: dropGroup, spawnTime: Date.now() };
}

export function spawnBulletDrops(count) {
  for (let i = 0; i < count; i++) {
    let x, z;
    do {
      x = (Math.random() - 0.5) * ARENA_SIZE * 0.8;
      z = (Math.random() - 0.5) * ARENA_SIZE * 0.8;
    } while (Math.abs(x) < 3 && Math.abs(z) < 3);
    state.bulletDrops.push(createBulletDrop(x, z));
  }
}

export function spawnSMGPickup() {
  const bound = ARENA_SIZE / 2 - 3;
  const x = (Math.random() * 2 - 1) * bound;
  const z = (Math.random() * 2 - 1) * bound;

  state.smgPickup = createSMGPickup();
  state.smgPickup.position.set(x, 1.2, z);
  state.smgSpawned = true;

  playSMGSpawnSound();

  const notification = document.createElement("div");
  notification.className = "smg-notification";
  notification.textContent = "🔫 SUBMACHINE GUN SPAWNED!";
  document.body.appendChild(notification);
  setTimeout(() => notification.parentNode?.removeChild(notification), 3000);
}

export function updatePickups(dt) {
  const { smgPickup, smgPopupShown } = state;

  // Animate and collect SMG pickup
  if (smgPickup && smgPickup.isEnabled()) {
    const time = Date.now() / 1000;
    smgPickup.position.y = 1.2 + Math.sin(time * 2) * 0.15;
    smgPickup.rotation.y += dt * 1.5;

    if (!smgPopupShown) {
      const dx = smgPickup.position.x - state.playerGroup.position.x;
      const dz = smgPickup.position.z - state.playerGroup.position.z;
      const dist2d = Math.sqrt(dx * dx + dz * dz);
      if (dist2d < SMG_COLLECT_DIST) {
        state.smgPopupShown = true;
        state.dom.smgPopup.style.display = "block";
        document.exitPointerLock();
      }
    }
  }

  // Animate and collect bullet drops
  for (let i = state.bulletDrops.length - 1; i >= 0; i--) {
    const drop = state.bulletDrops[i];
    const elapsed = (Date.now() - drop.spawnTime) / 1000;
    drop.mesh.position.y = 0.4 + Math.sin(elapsed * 2) * 0.1;
    drop.mesh.rotation.y += dt * 2;

    const dropPos = drop.mesh.getAbsolutePosition();
    const dx = dropPos.x - state.playerGroup.position.x;
    const dz = dropPos.z - state.playerGroup.position.z;
    const dist2d = Math.sqrt(dx * dx + dz * dz);

    if (dist2d < PICKUP_COLLECT_DIST) {
      const currentMax = state.hasSMG ? MAX_BULLETS_SMG : MAX_BULLETS;
      if (state.playerBullets >= currentMax) {
        showFullAmmoMessage();
        continue;
      }

      const toAdd = state.hasSMG ? 10 : BULLETS_PER_PICKUP;
      state.playerBullets = Math.min(state.playerBullets + toAdd, currentMax);
      updateAmmoDisplay();
      drop.mesh.dispose();
      state.bulletDrops.splice(i, 1);

      setTimeout(() => {
        if (!state.gameOver) {
          let nx, nz;
          do {
            nx = (Math.random() - 0.5) * ARENA_SIZE * 0.8;
            nz = (Math.random() - 0.5) * ARENA_SIZE * 0.8;
          } while (Math.abs(nx) < 3 && Math.abs(nz) < 3);
          state.bulletDrops.push(createBulletDrop(nx, nz));
        }
      }, DROP_RESPAWN_DELAY);
    }
  }
}
