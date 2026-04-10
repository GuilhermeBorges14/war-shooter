# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Copilot, Cursor, etc.) when working with code in this repository.

## Running the Game

No build step, no dependencies to install. Serve locally via HTTP (ES6 modules require HTTP, not `file://`):

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

There are no tests, no npm scripts, and no package.json. Babylon.js is loaded from CDN as a global (`window.BABYLON`) via a `<script>` tag in `index.html`.

## Project Structure

```
war-shooter/
├── index.html                  # HTML shell, HUD elements, Babylon.js CDN script tag
├── game.js                     # Entry point — imports and calls init()
├── src/
│   ├── scripts/
│   │   ├── init.js             # Engine/scene/camera setup, arena + entity creation, starts loop
│   │   ├── state.js            # Centralised mutable game state (single shared object)
│   │   ├── loop.js             # Main game loop (engine.runRenderLoop tick function)
│   │   ├── player.js           # Player movement, sprinting, weapon sway, screen shake, reload
│   │   ├── bot.js              # Bot AI — targeting, movement, strafing, shooting
│   │   ├── combat.js           # Bullet creation, AABB/distance hit detection, hitmarkers, damage numbers
│   │   ├── entities.js         # Entity factories — humanoid models, pistol, SMG, pickup meshes
│   │   ├── arena.js            # Arena geometry — floor, walls, pillars, crates, light panels
│   │   ├── pickups.js          # Bullet drop + SMG pickup spawning, collection, respawn
│   │   ├── audio.js            # Procedural audio via Web Audio API (all sound functions)
│   │   ├── events.js           # Input handlers — mouse, keyboard, pointer lock, resize
│   │   ├── lifecycle.js        # Game lifecycle — start, restart, win/lose, SMG accept/decline
│   │   └── ui.js               # HUD updates — ammo display, health bars, minimap, reload bar, vignette
│   ├── utils/
│   │   ├── constants.js        # All tunable game constants
│   │   └── colors.js           # Hex-to-BABYLON.Color3 helper
│   └── styles/
│       ├── base.css            # Body/canvas reset, layout
│       ├── hud.css             # Health bars, ammo counter, crosshair, minimap, kill counter
│       ├── screens.css         # Start screen, win/lose overlay
│       ├── popups.css          # SMG upgrade popup, notifications, damage numbers
│       └── animations.css      # CSS keyframes — shake, fade, pulse, float
├── AGENTS.md                   # This file
├── CLAUDE.md                   # References AGENTS.md
└── README.md                   # User-facing documentation
```

## Architecture

### Rendering Engine

**Babylon.js** (loaded from CDN as `window.BABYLON`). All source modules access it via `const BABYLON = window.BABYLON;` at the top of each file. There is no import map — Babylon is a global.

### State Management

All mutable game state lives in a single exported object in `src/scripts/state.js`. Every module imports and directly mutates `state`. This includes:

- Babylon.js core references (`engine`, `scene`, `camera`)
- Entity references (`playerGroup`, `botGroup`, `playerGun`, `botGunRef`, etc.)
- Game variables (`playerHealth`, `botHealth`, `playerBullets`, `hasSMG`, etc.)
- Input state (`keys`, `pointerLocked`, `yaw`, `pitch`)
- DOM element cache (`state.dom.*` — populated by `ui.cacheDOMElements()`)
- Scratch/reuse objects (`_yAxis`, `_zeroVec`, `_inputVec`, etc.) to reduce GC pressure

### Game Loop

`init()` in `init.js` sets up the Babylon engine, scene, lighting, camera, arena, entities, event listeners, then calls `startLoop()`. The loop runs via `engine.runRenderLoop(tick)`:

1. Delta time calculation (clamped to prevent spiral of death on tab-out)
2. Reload handling
3. Player movement (WASD + pointer lock mouse) with smooth lerp
4. Weapon sway + screen shake
5. SMG pickup spawn check (triggers at 10s into the game)
6. Pickup collection + bobbing animation
7. Bot AI (targeting, movement, shooting)
8. Player bullets vs bot — hit detection, damage, kill check
9. Bot bullets vs player — hit detection, damage, death check
10. `scene.render()` + 2D minimap canvas overlay

### Key Systems

**Rendering**: Procedurally generated geometry (no model files, no GLTF). All 3D objects are composed of Babylon.js primitives (`CreateBox`, `CreateCylinder`, `CreateSphere`, `CreateGround`). Shadow mapping uses a `ShadowGenerator` with blur exponential shadow maps on a single directional light.

**Audio** (`audio.js`): Entirely procedural via Web Audio API — zero audio files. Functions: `playShootSound()` (3-layer: transient click + gas crack + LF thump), `playHitSound()` (surface impact + body resonance), `playPainSound()` (breath + voiced grunt with formants), `playEmptyClickSound()` (double-click trigger mechanism), `playSMGSpawnSound()` (harmonic sweep + shimmer), `playReloadSound()` (latch + slide + seat events), `playReloadCompleteSound()` (impact transient + metal ring-down).

**Physics**: Simplified 2D collision on the XZ plane. Pre-computed AABB bounds (`state.crateBounds`) for crate collisions, distance checks for entity hit detection. Entities are clamped to arena bounds. No gravity system.

**Bot AI** (`bot.js`): Tracks player with yaw rotation smoothing. Three movement modes based on distance: far (>8 units) = direct approach, medium (4-8) = slower approach, close (<4) = circle-strafing with oscillating direction. Fires at fixed `BOT_SHOOT_INTERVAL` (1200ms). Bot bullets originate from the bot's gun mesh position.

**Weapon System**: Player starts with a pistol (7 rounds, single-shot). SMG pickup spawns at 10s — collecting it shows a confirmation popup. Accepting grants 40 rounds, 3-round burst fire, +10 ammo per pickup, but also boosts bot health (x3) and speed (x1.25). Player can decline and keep the pistol. Manual reload via `R` key (1.5s reload time with progress bar).

**Entity Models** (`entities.js`): `createHumanoid()` factory builds box-primitive characters (body, head, arms, legs). Player is blue-themed, bot is red-themed with glowing red emissive eyes. Both have shadow casting enabled. The first-person gun (`createGun()` / `createSMG()`) is parented to the camera. Bot holds a pistol model with a red sight.

**Pickups** (`pickups.js`): 5 bullet drops spawn at game start in random positions (avoiding center). Collected drops respawn after 3s. Drops are styled as ammo crates with glow spheres. SMG pickup is a floating, rotating weapon model with glow.

**Minimap** (`ui.js:drawMinimap()`): 180x180px 2D canvas overlay rendered each frame. Shows player (green), bot (red) with facing direction lines, crates, and ammo drops on a dark green military-style grid.

**HUD** (`index.html` + `ui.js`): Health bars (player + bot), ammo counter with color coding (green/amber/red), kill counter, crosshair (expands when sprinting), reload progress bar, damage vignette flash, no-ammo/full-ammo status messages.

### Tunable Constants (`src/utils/constants.js`)

| Constant | Value | Description |
|---|---|---|
| `ARENA_SIZE` | 24 | Arena width/depth in units |
| `WALL_HEIGHT` | 6 | Wall height |
| `MOVE_SPEED` | 7 | Player base move speed (units/s) |
| `MOVE_SMOOTH` | 12 | Movement lerp factor |
| `SPRINT_MULTIPLIER` | 1.6 | Speed multiplier when sprinting |
| `BULLET_SPEED` | 20.0 | Player bullet velocity |
| `BOT_BULLET_SPEED` | 20.0 | Bot bullet velocity |
| `BULLET_RANGE` | 40 | Max bullet travel distance |
| `PLAYER_HEALTH` | 100 | Player starting HP |
| `BOT_HEALTH` | 300 | Bot starting HP |
| `BOT_SHOOT_INTERVAL` | 1200 | Bot fire rate (ms) |
| `BOT_MOVE_SPEED` | 2.5 | Bot base move speed |
| `DAMAGE` | 14 | Damage per hit (both player and bot) |
| `PLAYER_RADIUS` | 0.5 | Player collision radius |
| `MAX_BULLETS` | 10 | Max ammo (pistol) |
| `MAX_BULLETS_SMG` | 40 | Max ammo (SMG) |
| `STARTING_BULLETS` | 7 | Initial ammo count |
| `BULLETS_PER_PICKUP` | 3 | Ammo per pickup (pistol) |
| `SMG_SPAWN_DELAY` | 10000 | SMG appears after 10s |
| `DROP_RESPAWN_DELAY` | 3000 | Ammo drop respawn delay (ms) |
| `RELOAD_TIME` | 1.5 | Reload duration (seconds) |
| `MOUSE_SENSITIVITY` | 0.002 | Mouse look sensitivity |
| `EYE_HEIGHT` | 1.6 | Camera Y position |

### Controls

| Input | Action |
|---|---|
| **WASD / Arrow keys** | Move |
| **Shift** | Sprint (1.6x speed) |
| **Mouse** | Look (Pointer Lock) |
| **Right-click** | Shoot |
| **R** | Reload |
| **Click canvas / "DEPLOY"** | Lock pointer / start game |

## Development Guidelines

- **No build tools**: All code is vanilla ES6 modules served directly. No transpilation, no bundling.
- **No external assets**: All geometry is procedural Babylon.js primitives. All audio is synthesized via Web Audio API. No images, models, or audio files.
- **Babylon.js is a global**: Do NOT add an import map or try to `import` Babylon. Access it via `window.BABYLON`.
- **State is centralised**: All game state goes through `state.js`. Do not create module-level mutable state elsewhere.
- **DOM caching**: All DOM elements are cached in `state.dom` at startup via `cacheDOMElements()`. Use `state.dom.elementName` instead of repeated `getElementById` calls.
- **GC-conscious patterns**: Reuse scratch vectors (`state._inputVec`, `state._scratchVec`, etc.) in hot paths. Avoid allocations inside the game loop where possible.
- **Shadow performance**: Only the directional light casts shadows. Point lights on wall panels intentionally do not cast shadows for performance.
- **Single bot**: The game currently supports exactly one bot opponent. The bot respawn/kill logic in `loop.js` calls `endGame(true)` on bot death.
