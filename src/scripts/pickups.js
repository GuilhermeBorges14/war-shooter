import * as THREE from "three";
import { state } from "./state.js";
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
  const dropGroup = new THREE.Group();

  const crateGeo = new THREE.BoxGeometry(0.5, 0.35, 0.35);
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x5a6b3e,
    metalness: 0.3,
    roughness: 0.8,
  });
  dropGroup.add(new THREE.Mesh(crateGeo, crateMat));

  const bandMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    metalness: 0.7,
    roughness: 0.4,
  });
  const topBand = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.04, 0.37),
    bandMat,
  );
  topBand.position.y = 0.12;
  dropGroup.add(topBand);

  const bottomBand = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.04, 0.37),
    bandMat,
  );
  bottomBand.position.y = -0.12;
  dropGroup.add(bottomBand);

  dropGroup.add(
    new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.37, 0.37), bandMat),
  );

  const labelMat = new THREE.MeshStandardMaterial({
    color: 0xf5f5dc,
    emissive: 0xf5f5dc,
    emissiveIntensity: 0.3,
  });
  const label = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.15, 0.02),
    labelMat,
  );
  label.position.set(0, 0, 0.18);
  dropGroup.add(label);

  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.15,
  });
  dropGroup.add(
    new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), glowMat),
  );

  dropGroup.position.set(x, 0.4, z);
  state.scene.add(dropGroup);

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
  state.scene.add(state.smgPickup);
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

  // Animate SMG pickup
  if (smgPickup && smgPickup.visible) {
    const time = Date.now() / 1000;
    smgPickup.position.y = 1.2 + Math.sin(time * 2) * 0.15;
    smgPickup.rotation.y += dt * 1.5;
  }

  // Check SMG proximity
  if (smgPickup && smgPickup.visible && !smgPopupShown) {
    const playerPos2D = new THREE.Vector3(
      state.playerGroup.position.x,
      0,
      state.playerGroup.position.z,
    );
    const smgPos = new THREE.Vector3(
      smgPickup.position.x,
      0,
      smgPickup.position.z,
    );
    if (smgPos.distanceTo(playerPos2D) < SMG_COLLECT_DIST) {
      state.smgPopupShown = true;
      state.dom.smgPopup.style.display = "block";
      document.exitPointerLock();
    }
  }

  // Check bullet drop pickups
  for (let i = state.bulletDrops.length - 1; i >= 0; i--) {
    const drop = state.bulletDrops[i];
    const elapsed = (Date.now() - drop.spawnTime) / 1000;
    drop.mesh.position.y = 0.4 + Math.sin(elapsed * 2) * 0.1;
    drop.mesh.rotation.y += dt * 2;

    const dropPos = new THREE.Vector3();
    drop.mesh.getWorldPosition(dropPos);
    dropPos.y = 0;
    const playerPos = new THREE.Vector3(
      state.playerGroup.position.x,
      0,
      state.playerGroup.position.z,
    );

    if (dropPos.distanceTo(playerPos) < PICKUP_COLLECT_DIST) {
      const currentMax = state.hasSMG ? MAX_BULLETS_SMG : MAX_BULLETS;
      if (state.playerBullets >= currentMax) {
        showFullAmmoMessage();
        continue;
      }

      const toAdd = state.hasSMG ? 10 : BULLETS_PER_PICKUP;
      state.playerBullets = Math.min(state.playerBullets + toAdd, currentMax);
      updateAmmoDisplay();
      state.scene.remove(drop.mesh);
      state.bulletDrops.splice(i, 1);

      setTimeout(() => {
        if (!state.gameOver) {
          let x, z;
          do {
            x = (Math.random() - 0.5) * ARENA_SIZE * 0.8;
            z = (Math.random() - 0.5) * ARENA_SIZE * 0.8;
          } while (Math.abs(x) < 3 && Math.abs(z) < 3);
          state.bulletDrops.push(createBulletDrop(x, z));
        }
      }, DROP_RESPAWN_DELAY);
    }
  }
}
