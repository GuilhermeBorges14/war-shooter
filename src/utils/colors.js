const BABYLON = window.BABYLON;

// Convert 0xRRGGBB hex integer to BABYLON.Color3
export function c3(hex) {
  return new BABYLON.Color3(
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  );
}
