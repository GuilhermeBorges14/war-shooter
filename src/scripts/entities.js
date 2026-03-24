import * as THREE from "three";
import { state } from "./state.js";

// ============================================================
// Shared geometry — created once, reused by all humanoids
// ============================================================
const _humanBodyGeo = new THREE.BoxGeometry(0.7, 1.0, 0.4);
const _humanHeadGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const _humanArmGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
const _humanLegGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);

// ============================================================
// Entity factories
// ============================================================

export function createHumanoid({ bodyColor, headColor, legColor }) {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.7,
    metalness: 0.2,
  });
  const body = new THREE.Mesh(_humanBodyGeo, bodyMat);
  body.position.y = 1.0;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const headMat = new THREE.MeshStandardMaterial({
    color: headColor,
    roughness: 0.8,
    metalness: 0.1,
  });
  const head = new THREE.Mesh(_humanHeadGeo, headMat);
  head.position.y = 1.7;
  head.castShadow = true;
  group.add(head);

  const armMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.7,
    metalness: 0.2,
  });

  const armL = new THREE.Mesh(_humanArmGeo, armMat);
  armL.position.set(-0.5, 0.9, 0);
  armL.castShadow = true;
  group.add(armL);

  const armR = new THREE.Mesh(_humanArmGeo, armMat);
  armR.position.set(0.5, 0.9, 0);
  armR.castShadow = true;
  group.add(armR);

  const legMat = new THREE.MeshStandardMaterial({
    color: legColor,
    roughness: 0.8,
    metalness: 0.15,
  });

  const legL = new THREE.Mesh(_humanLegGeo, legMat);
  legL.position.set(-0.2, 0.4, 0);
  legL.castShadow = true;
  group.add(legL);

  const legR = new THREE.Mesh(_humanLegGeo, legMat);
  legR.position.set(0.2, 0.4, 0);
  legR.castShadow = true;
  group.add(legR);

  return { group, body };
}

export function createPlayer() {
  const { group, body } = createHumanoid({
    bodyColor: 0x2a5a8a,
    headColor: 0xffdbac,
    legColor: 0x1a3a5a,
  });

  state.playerMesh = body;
  group.position.set(0, 0, 0);
  state.scene.add(group);
  return group;
}

export function createBot() {
  const { group, body } = createHumanoid({
    bodyColor: 0x8a2a2a,
    headColor: 0x3a3a3a,
    legColor: 0x5a1a1a,
  });

  // Store bot materials for hit-flash effect
  state.botBodyMaterials = [];
  group.traverse((child) => {
    if (child.isMesh && child.material) {
      state.botBodyMaterials.push({
        mesh: child,
        mat: child.material,
        origColor: child.material.color.clone(),
      });
    }
  });

  // Glowing red eyes
  const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.8,
  });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.08, 1.75, 0.2);
  eyeR.position.set(0.08, 1.75, 0.2);
  group.add(eyeL, eyeR);

  // Gun in hand
  const botGun = createPistolModel({
    sightColor: 0xff0000,
    sightEmissive: 0xff0000,
    sightIntensity: 0.4,
  });
  botGun.position.set(0.5, 0.5, 0.3);
  group.add(botGun);

  state.botGunRef = botGun;
  state.botMesh = body;
  group.position.set(8, 0, 8);
  state.scene.add(group);
  return group;
}

export function createPistolModel({
  sightColor = 0xff4444,
  sightEmissive = 0xff0000,
  sightIntensity = 0.3,
} = {}) {
  const gunGroup = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(0.08, 0.12, 0.5);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.6,
    metalness: 0.5,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.z = -0.15;
  body.castShadow = true;
  gunGroup.add(body);

  const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.4,
    metalness: 0.7,
  });
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.position.set(0, 0.02, -0.45);
  barrel.rotation.x = Math.PI / 2;
  barrel.castShadow = true;
  gunGroup.add(barrel);

  const handleGeo = new THREE.BoxGeometry(0.06, 0.15, 0.08);
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0x3a2a1a,
    roughness: 0.8,
    metalness: 0.2,
  });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.set(0, -0.12, -0.05);
  handle.castShadow = true;
  gunGroup.add(handle);

  const sightGeo = new THREE.BoxGeometry(0.015, 0.03, 0.015);
  const sightMat = new THREE.MeshStandardMaterial({
    color: sightColor,
    emissive: sightEmissive,
    emissiveIntensity: sightIntensity,
  });
  const sight = new THREE.Mesh(sightGeo, sightMat);
  sight.position.set(0, 0.08, -0.35);
  gunGroup.add(sight);

  return gunGroup;
}

export function createGun() {
  const gunGroup = createPistolModel();
  gunGroup.position.set(0.25, -0.25, -0.4);
  gunGroup.rotation.y = -0.1;
  return gunGroup;
}

export function createSMG() {
  const gunGroup = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(0.1, 0.15, 0.7);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.5,
    metalness: 0.6,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.z = -0.2;
  body.castShadow = true;
  gunGroup.add(body);

  const barrelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8);
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    roughness: 0.3,
    metalness: 0.8,
  });
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.position.set(0, 0.03, -0.55);
  barrel.rotation.x = Math.PI / 2;
  barrel.castShadow = true;
  gunGroup.add(barrel);

  const magGeo = new THREE.BoxGeometry(0.08, 0.25, 0.12);
  const magMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.7,
    metalness: 0.4,
  });
  const mag = new THREE.Mesh(magGeo, magMat);
  mag.position.set(0, -0.15, -0.1);
  mag.castShadow = true;
  gunGroup.add(mag);

  const handleGeo = new THREE.BoxGeometry(0.07, 0.18, 0.1);
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0x3a2a1a,
    roughness: 0.8,
    metalness: 0.2,
  });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.set(0, -0.2, 0);
  handle.castShadow = true;
  gunGroup.add(handle);

  const sightGeo = new THREE.BoxGeometry(0.02, 0.04, 0.02);
  const sightMat = new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    emissive: 0xffaa00,
    emissiveIntensity: 0.4,
  });
  const sight = new THREE.Mesh(sightGeo, sightMat);
  sight.position.set(0, 0.1, -0.4);
  gunGroup.add(sight);

  gunGroup.position.set(0.25, -0.25, -0.4);
  gunGroup.rotation.y = -0.1;
  return gunGroup;
}

export function createSMGPickup() {
  const group = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(0.15, 0.2, 0.9);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.5,
    metalness: 0.6,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  group.add(body);

  const magGeo = new THREE.BoxGeometry(0.1, 0.3, 0.15);
  const magMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.7,
    metalness: 0.4,
  });
  const mag = new THREE.Mesh(magGeo, magMat);
  mag.position.set(0, -0.2, 0.1);
  mag.castShadow = true;
  group.add(mag);

  const glowGeo = new THREE.SphereGeometry(0.6, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.2,
  });
  group.add(new THREE.Mesh(glowGeo, glowMat));

  group.position.set(0, 1.2, 0);
  return group;
}
