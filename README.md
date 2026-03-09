# 🪖 War Shooter

A fast-paced 3D first-person shooter built with Three.js. Battle against an AI opponent in a confined arena with dynamic weapon upgrades and strategic gameplay.

![Three.js](https://img.shields.io/badge/Three.js-r160-blue)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow)
![License](https://img.shields.io/badge/license-MIT-green)

## 🎮 Features

### Core Gameplay

- **First-Person Combat**: Smooth FPS controls with mouse-look camera
- **AI Opponent**: Intelligent enemy that tracks, shoots, and adapts to your position
- **Health System**: Real-time health bars for both player and enemy
- **Minimap**: Top-down view showing player and enemy positions
- **3D Arena**: Enclosed combat space with walls and floor

### Weapon System

- **Starting Pistol**: 7-bullet magazine with manual reloads
- **Submachine Gun Upgrade**: Spawns randomly after 10 seconds
  - 3-bullet burst fire per shot
  - 40 bullets granted on pickup
  - Ammo pickups grant 10 bullets (instead of 7)
  - Enemy health restored and increased 3x
  - Enemy speed increased by 25%

### Audio & Visual Feedback

- **Procedural Sound Effects**:
  - Gun shots with high-intensity audio
  - Hit confirmation sounds (impact + grunt)
  - Damage taken feedback
  - SMG spawn notification
- **Hit Markers**: Visual confirmation on enemy hits with 3D positioning
- **Ammo Counter**: Live ammo display with shake animation
- **Status Messages**: Notifications for ammo shortages and pickups

### Polish

- **3D Character Models**: Detailed player gun and enemy model with weapon
- **Dynamic Lighting**: Ambient, directional, and spotlight for atmosphere
- **Custom UI**: Modern HUD with health bars, player name, and status indicators
- **Responsive Design**: Pointer lock API for immersive mouse control

## 🚀 Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Python 3 (for local server)

### Installation & Running

1. **Clone or download the repository**

   ```bash
   cd Instant
   ```

2. **Start a local HTTP server** (required for ES6 modules)

   ```bash
   python3 -m http.server 8080
   ```

3. **Open in browser**

   ```
   http://localhost:8080
   ```

4. **Enter your name and click "Start Game"**

## 🎯 Controls

| Input                  | Action                              |
| ---------------------- | ----------------------------------- |
| **W A S D**            | Move forward, left, backward, right |
| **Mouse**              | Look around / Aim                   |
| **Right Click**        | Shoot                               |
| **Click "Start Game"** | Begin game and lock pointer         |

## 🏗️ Technical Stack

- **Three.js r160**: 3D rendering engine
- **Web Audio API**: Procedural sound generation
- **Pointer Lock API**: Mouse capture for FPS controls
- **localStorage**: Player name persistence
- **Vanilla JavaScript**: No frameworks, pure ES6+
- **CSS3**: Modern UI styling with animations

## 📁 Project Structure

```
Instant/
├── index.html        # Main HTML structure
├── style.css         # UI and layout styles
├── game.js           # Game logic, rendering, physics
└── README.md         # Documentation
```

## 🎲 Gameplay Tips

1. **Manage Your Ammo**: Start with only 7 bullets - make each shot count
2. **Use Cover**: Move around walls to break enemy line of sight
3. **Watch the Minimap**: Track enemy position and plan your moves
4. **SMG Decision**: The SMG is powerful but makes the enemy stronger too
5. **Collect Ammo**: Pick up ammo drops from the floor to stay in the fight

## 🔧 Development

### Game Configuration

Key variables in `game.js` you can modify:

```js
let playerHealth = 100; // Player starting health
let botHealth = 100; // Enemy starting health
let ammo = 7; // Starting ammo
const maxAmmo = 7; // Maximum ammo without SMG
let botMoveSpeed = 2.5; // Enemy base movement speed
```

### Adding Features

The game uses a clean architecture:

- **3D Models**: \`createBot()\`, \`createGun()\`, \`createSMG()\`
- **Audio**: \`playShootSound()\`, \`playHitSound()\`, \`playPainSound()\`
- **Game Loop**: \`animate()\` function handles rendering and updates
- **UI Updates**: Direct DOM manipulation for real-time feedback

## 📝 License

MIT License - feel free to use and modify for your own projects.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page or submit a pull request.
