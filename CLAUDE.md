# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

No build step required. Serve locally via HTTP (ES6 modules require HTTP, not `file://`):

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

There are no tests, no npm scripts, and no dependencies to install. Three.js r160 is loaded from CDN via an importmap in `index.html`.

## Architecture

The entire game lives in three files:
- **`game.js`** — All game logic (~1800 lines), single-file intentional design
- **`index.html`** — HTML shell, HUD elements, Three.js importmap
- **`styles.css`** — UI styling and CSS animations

### Game Loop

`init()` sets up Three.js, event listeners, and the arena, then `update()` runs via `requestAnimationFrame`:

1. Input → player movement (WASD + Pointer Lock mouse)
2. SMG pickup spawn (triggers at 10s)
3. Pickup collection + animation
4. Bot AI (pathfinding, strafing, shooting)
5. Bullet updates + collision detection (AABB vs crates, distance vs entities)
6. Health checks → win/lose
7. Three.js render + 2D minimap canvas overlay

### Key Systems

**Rendering**: Procedurally generated geometry (no model files). All 3D objects are composed of Three.js primitives (BoxGeometry, CylinderGeometry, etc.).

**Audio**: Entirely procedural via Web Audio API — no audio files. `playShootSound()`, `playHitSound()`, `playPainSound()` synthesize sounds with oscillators, noise, and envelope shaping.

**Physics**: Simplified 2D collision on the XZ plane. `THREE.Box3` for crate AABB collisions, distance checks for entity collisions. No gravity.

**Bot AI**: Distance-based targeting, circle-strafing when close, line-of-sight checks, fixed `BOT_SHOOT_INTERVAL` firing rate.

**Weapon system**: Player starts with pistol (7 rounds). SMG pickup spawns at 10s into the game — collecting it switches weapon model, increases ammo to 40, and also boosts bot health (×3) and speed (×1.25).

### Tunable Constants (top of `game.js`)

```js
ARENA_SIZE, WALL_HEIGHT, MOVE_SPEED, BULLET_SPEED,
BOT_BULLET_SPEED, DAMAGE, BOT_SHOOT_INTERVAL, BOT_MOVE_SPEED,
MAX_BULLETS, MAX_BULLETS_SMG, BOT_HEALTH, PLAYER_HEALTH
```

### Controls

- **WASD / Arrow keys** — move
- **Mouse** — look (Pointer Lock)
- **Right-click** — shoot
- **Click game canvas** — lock pointer / start
