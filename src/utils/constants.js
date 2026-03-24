// ============================================================
// Constants — game tuning
// ============================================================

export const ARENA_SIZE = 24;
export const WALL_HEIGHT = 6;
export const MOVE_SPEED = 7;          // units per second
export const MOVE_SMOOTH = 12;        // lerp factor for smooth movement
export const SPRINT_MULTIPLIER = 1.6; // speed multiplier while sprinting
export const BULLET_SPEED = 4.0;      // player bullet velocity
export const BOT_BULLET_SPEED = 7.0;  // enemy bullets are faster!
export const BULLET_RANGE = 40;
export const PLAYER_HEALTH = 100;
export const BOT_HEALTH = 300;
export const BOT_SHOOT_INTERVAL = 1200;
export const BOT_MOVE_SPEED = 2.5;
export const DAMAGE = 14;             // ~7 hits to win/lose
export const PLAYER_RADIUS = 0.5;
export const MAX_BULLETS = 10;        // max ammo (pistol)
export const MAX_BULLETS_SMG = 40;    // max ammo (SMG)
export const STARTING_BULLETS = 7;
export const BULLETS_PER_PICKUP = 3;

// Distances / thresholds
export const EYE_HEIGHT = 1.6;
export const ENTITY_BOUND = ARENA_SIZE / 2 - PLAYER_RADIUS;
export const PICKUP_COLLECT_DIST = 1.2;
export const SMG_COLLECT_DIST = 1.5;
export const BOT_FAR_DIST = 8;
export const BOT_MED_DIST = 4;
export const BOT_STRAFE_MULT = 0.4;
export const SMG_SPAWN_DELAY = 10000;
export const DROP_RESPAWN_DELAY = 3000;
export const MOUSE_SENSITIVITY = 0.002;
export const MAX_PITCH = Math.PI / 2 - 0.1;

// Reload
export const RELOAD_TIME = 1.5; // seconds
