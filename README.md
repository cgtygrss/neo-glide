# 🚀 Neo Glide

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/platform-iOS-lightgrey.svg)](https://www.apple.com/ios/)
[![React](https://img.shields.io/badge/React-19.0.0-blue.svg)](https://reactjs.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-7.4.4-blue.svg)](https://capacitorjs.com/)

**Neo Glide** is a fast-paced neon arcade space shooter with stunning cyberpunk visuals and addictive roguelike progression. Pilot customizable ships through an endless neon void, battle fierce enemies, and see how far you can survive!

<p align="center">
  <img src="resources/icon.png" alt="Neo Glide Icon" width="200"/>
</p>

## ✨ Features

- 🎮 **Intense Arcade Action** - Fast-paced gameplay with smooth 60fps performance
- 🛸 **5 Unique Ships** - Each with special abilities (Cruiser, Interceptor, Stealth, Void Runner)
- ⚡ **4 Weapon Types** - Plasma Cannon, Burst Laser, Missile Launcher, Railgun
- 👾 **3 Enemy Types** - Speedster, Standard Fighter, and Juggernaut with unique behaviors
- 💎 **Roguelike Progression** - Permanent upgrades that carry between runs
- 🎨 **Stunning Neon Visuals** - Cyberpunk-inspired graphics with particle effects
- 🎵 **Dynamic Soundtrack** - Retro-style music that adapts to gameplay
- 📱 **Mobile-Optimized** - Portrait mode, one-handed controls, responsive UI
- 🏆 **Leaderboard System** - Compete globally and track your best scores

## 🎮 Gameplay

- **Tap and hold** to boost your ship through space
- **Dodge** obstacles and enemy projectiles
- **Tap the fire button** to unleash your weapons
- **Collect** fuel and currency to extend your run
- **Upgrade** your ship between runs to become unstoppable

## 🛠️ Tech Stack

### Frontend
- **React 19.0.0** - UI framework
- **Vite 7.2.2** - Build tool and dev server
- **Tailwind CSS 4.1.17** - Utility-first CSS framework
- **Lucide React** - Icon library

### Mobile
- **Capacitor 7.4.4** - Native iOS integration
- **CocoaPods** - iOS dependency management

### Game Engine
- **HTML5 Canvas** - Custom rendering engine
- **Web Audio API** - Procedural sound generation
- **RequestAnimationFrame** - Smooth game loop

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- Xcode 14+ (for iOS development)
- CocoaPods

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/cgtygrss/neon-glide.git
   cd neon-glide
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📱 iOS Build

### Build for iOS

1. **Build the web assets**
   ```bash
   npm run build
   ```

2. **Sync with iOS**
   ```bash
   npx cap sync ios
   ```

3. **Open in Xcode**
   ```bash
   npx cap open ios
   ```

4. **Run on simulator or device** from Xcode

### iOS Requirements
- iOS 13.0 or later
- Portrait orientation
- Safe area inset support

## 🎯 Project Structure

```
neon-glide/
├── src/
│   ├── components/
│   │   ├── HUD.jsx              # Game UI overlay
│   │   ├── Shop.jsx             # Upgrade shop
│   │   └── Leaderboard.jsx      # Score tracking
│   ├── game/
│   │   ├── Entities.js          # Game objects (Player, Enemies, etc.)
│   │   ├── GameLoop.js          # Main game loop
│   │   ├── Renderer.js          # Canvas rendering
│   │   └── SoundManager.js      # Audio system
│   ├── App.jsx                  # Main app component
│   ├── App.css                  # Global styles
│   └── main.jsx                 # Entry point
├── ios/                         # iOS native project
├── public/                      # Static assets
├── resources/                   # App icons and splash screens
├── capacitor.config.json        # Capacitor configuration
├── package.json                 # Dependencies
└── vite.config.js              # Vite configuration
```

## 🎨 Game Systems

### Ship Types
| Ship | Special Ability |
|------|----------------|
| Default | Balanced stats |
| Cruiser | +2 hull strength |
| Interceptor | 1.5x faster ammo regen |
| Stealth | 50% reduced enemy spawns |
| Void Runner | Phase through small obstacles |

### Weapon Types
| Weapon | Description |
|--------|-------------|
| Plasma Cannon | High damage shots |
| Burst Laser | 3-shot spread |
| Missile Launcher | Explosive projectiles |
| Railgun | Armor-piercing rounds |

### Enemy Types
- **Speedster (Purple)** - Fast, agile, dashes unpredictably (40 HP)
- **Standard Fighter (Red)** - Steady fire rate (40 HP)
- **Juggernaut (Orange)** - Heavy armor, homing missiles (100 HP)

### Upgrade System
- Hull Armor (+1 health per level)
- Shield Generator (0.05 HP/s regen per level)
- Thruster Boost (+1 movement per level)
- Battery Pack (+20 energy per level)
- Currency Multiplier (earn more per run)

## 🚀 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run host         # Dev server with network access

# iOS specific
npm run ios:build    # Build and open in Xcode
npm run cap:sync     # Sync web assets to native
npm run cap:open     # Open iOS project in Xcode
```

## 🎮 Controls

### Desktop (Development)
- **Mouse Click + Hold** - Boost ship
- **Spacebar** - Fire weapon

### Mobile (iOS)
- **Tap + Hold** - Boost ship
- **Tap Fire Button** - Shoot

## 🌟 Future Enhancements

- [ ] More ship types and weapons
- [ ] Boss battles
- [ ] Power-ups and special abilities
- [ ] Game Center integration
- [ ] iCloud save sync
- [ ] Additional game modes
- [ ] Sound effects customization
- [ ] Achievement system

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Cagatay Gurses**
- GitHub: [@cgtygrss](https://github.com/cgtygrss)

## 🙏 Acknowledgments

- Built with React and Capacitor
- Inspired by classic arcade shooters
- Neon aesthetic inspired by cyberpunk culture

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on [GitHub Issues](https://github.com/cgtygrss/neon-glide/issues)

---

<p align="center">
  Made with ❤️ and ⚡ by Cagatay Gurses
</p>

<p align="center">
  <a href="https://www.apple.com/app-store/">
    <img src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83&amp;releaseDate=1234567890" alt="Download on the App Store" height="50">
  </a>
</p>
