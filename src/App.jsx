import React, { useEffect, useRef, useState } from 'react';
import { GameLoop } from './game/GameLoop';
import { Renderer } from './game/Renderer';
import { SoundManager } from './game/SoundManager';
import { Player, Obstacle, Collectible, Fuel, Villain, Projectile, PlayerProjectile, SpeedsterVillain, JuggernautVillain, HomingProjectile, PowerUp } from './game/Entities';
import HUD from './components/HUD';
import Shop from './components/Shop';
import { Play, ShoppingCart } from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState('MENU'); // MENU, PLAYING, GAMEOVER, SHOP
  const [distance, setDistance] = useState(0);
  const [currency, setCurrency] = useState(() => parseInt(localStorage.getItem('neon_glide_currency')) || 0);
  const [energy, setEnergy] = useState(100);
  const [ammo, setAmmo] = useState(10);
  const [health, setHealth] = useState(1);
  const [maxHealth, setMaxHealth] = useState(1);
  const [sessionCurrency, setSessionCurrency] = useState(0);

  const [upgrades, setUpgrades] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('neon_glide_upgrades')) || {};
    } catch {
      return {};
    }
  });

  const [ownedShips, setOwnedShips] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('neon_glide_owned_ships')) || ['default'];
    } catch {
      return ['default'];
    }
  });

  const [equippedShip, setEquippedShip] = useState(() => {
    return localStorage.getItem('neon_glide_equipped_ship') || 'default';
  });

  const [ownedWeapons, setOwnedWeapons] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('neon_glide_owned_weapons')) || ['default'];
    } catch {
      return ['default'];
    }
  });

  const [equippedWeapon, setEquippedWeapon] = useState(() => {
    return localStorage.getItem('neon_glide_equipped_weapon') || 'default';
  });

  // Active power-ups state
  const [activePowerUps, setActivePowerUps] = useState([]);

  // Refs for Game Loop
  const canvasRef = useRef(null);
  const loopRef = useRef(null);
  const rendererRef = useRef(null);
  const soundRef = useRef(null);

  // Game refs to avoid closure staleness in loop
  const gameRef = useRef({
    player: new Player(),
    shipType: 'default', // Initialize shipType
    weaponType: 'default',
    obstacles: [],
    collectibles: [],
    powerUps: [],
    activePowerUps: [],
    speed: 300,
    distance: 0,
    energy: 100,
    ammo: 10,
    maxAmmo: 10,
    gameOver: false,
    floatingTexts: []
  });

  const upgradesRef = useRef(upgrades);
  const equippedShipRef = useRef(equippedShip);
  const equippedWeaponRef = useRef(equippedWeapon);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Sound Manager
    soundRef.current = new SoundManager();

    // Initialize Renderer
    rendererRef.current = new Renderer(canvasRef.current);

    // Handle Resize
    const handleResize = () => {
      rendererRef.current.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // Resume AudioContext on user interaction
    const handleUserInteraction = () => {
      if (soundRef.current) {
        if (!soundRef.current.initialized) {
          soundRef.current.init();
        }
        if (soundRef.current.ctx && soundRef.current.ctx.state === 'suspended') {
          soundRef.current.ctx.resume();
        }
      }
    };
    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);
    window.addEventListener('touchstart', handleUserInteraction);

    return () => {
      if (loopRef.current) loopRef.current.stop();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('neon_glide_currency', currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem('neon_glide_owned_ships', JSON.stringify(ownedShips));
  }, [ownedShips]);

  useEffect(() => {
    localStorage.setItem('neon_glide_equipped_ship', equippedShip);
  }, [equippedShip]);

  useEffect(() => {
    localStorage.setItem('neon_glide_owned_weapons', JSON.stringify(ownedWeapons));
  }, [ownedWeapons]);

  useEffect(() => {
    localStorage.setItem('neon_glide_equipped_weapon', equippedWeapon);
  }, [equippedWeapon]);

  useEffect(() => {
    upgradesRef.current = upgrades;
    equippedShipRef.current = equippedShip;
    equippedWeaponRef.current = equippedWeapon;
    if (gameRef.current) {
      gameRef.current.shipType = equippedShip;
      gameRef.current.weaponType = equippedWeapon;
    }
    localStorage.setItem('neon_glide_upgrades', JSON.stringify(upgrades));
  }, [upgrades, equippedShip, equippedWeapon]);

  // Menu Music Effect
  useEffect(() => {
    if ((gameState === 'MENU' || gameState === 'SHOP') && soundRef.current) {
      soundRef.current.startMenuMusic();
    } else if (gameState !== 'PLAYING' && soundRef.current) {
      // Only stop music if not playing (for GAMEOVER state)
      soundRef.current.stopMusic();
    }
  }, [gameState]);

  const startGame = () => {
    // Reset Game State
    const currentUpgrades = upgradesRef.current;
    const batteryLvl = currentUpgrades.battery || 1;
    const maxEnergy = 100 + (batteryLvl - 1) * 20;

    // New Upgrades Logic
    const hullLvl = currentUpgrades.hull || 1;
    const shieldGenLvl = currentUpgrades.shield_gen || 0;
    const multiplierLvl = currentUpgrades.multiplier || 1;

    // Ship Bonuses
    const ship = equippedShipRef.current;
    let bonusHealth = 0;
    let ammoRegenTime = 2.0;
    let villainChance = 0.005;

    if (ship === 'cruiser') bonusHealth = 2;
    if (ship === 'interceptor') ammoRegenTime = 1.5;
    if (ship === 'stealth') villainChance = 0.0025;

    const totalHealth = hullLvl + bonusHealth;

    gameRef.current = {
      player: new Player(currentUpgrades.thruster || 1),
      shipType: equippedShipRef.current,
      weaponType: equippedWeaponRef.current,
      obstacles: [],
      collectibles: [],
      fuels: [],
      powerUps: [],
      activePowerUps: [],
      villain: null,
      projectiles: [],
      playerProjectiles: [],
      floatingTexts: [],
      speed: 300 + ((currentUpgrades.thruster || 1) * 20), // Base speed increases with thruster
      distance: 0,
      energy: maxEnergy,
      ammo: 10,
      maxAmmo: 10,
      ammoTimer: 0,
      maxEnergy: maxEnergy,

      // New Stats
      health: totalHealth,
      maxHealth: totalHealth,
      regenRate: shieldGenLvl * 0.05, // Regenerate 0.05 HP per second per level
      currencyMultiplier: multiplierLvl,
      ammoRegenTime: ammoRegenTime,
      villainChance: villainChance,

      gameOver: false,
      sessionCurrency: 0 // Track coins collected in this run
    };

    setDistance(0);
    setEnergy(100); // Always start at 100% regardless of max energy
    setAmmo(10); // Reset ammo state
    setHealth(totalHealth);
    setMaxHealth(totalHealth);
    setGameState('PLAYING');
    if (soundRef.current) {
      soundRef.current.stopMusic(); // Stop menu music first
      soundRef.current.startMusic(); // Start gameplay music
    }
    loopRef.current.start();
  };

  const handleGameOver = React.useCallback(() => {
    gameRef.current.gameOver = true;
    if (loopRef.current) loopRef.current.stop();
    if (soundRef.current) soundRef.current.stopMusic();

    // No distance reward anymore, only collected coins matter
    setSessionCurrency(gameRef.current.sessionCurrency || 0);
    setGameState('GAMEOVER');
  }, []);

  const checkCollisions = React.useCallback((game) => {
    const p = game.player;
    // Simple AABB Collision
    // Player is roughly 40x20
    const pRect = { x: p.x, y: p.y - 10, w: 40, h: 20 }; // Approximate

    // Obstacles
    for (let obs of game.obstacles) {
      // Ghost Mode: Phase through all obstacles
      if (game.ghostMode) continue;
      
      // Void Runner: Phase through small obstacles
      if (game.shipType === 'void_runner' && obs.height < 80) continue;

      if (
        pRect.x < obs.x + obs.width &&
        pRect.x + pRect.w > obs.x &&
        pRect.y < obs.y + obs.height &&
        pRect.y + pRect.h > obs.y
      ) {
        obs.markedForDeletion = true;

        // Plasma Breaker: Destroy without damage
        if (game.shipType === 'plasma_breaker') {
          if (soundRef.current) soundRef.current.playExplosion();
          game.floatingTexts.push({
            x: p.x,
            y: p.y,
            text: 'SMASH!',
            color: '#00ff00',
            life: 1.0
          });
          continue;
        }

        game.health -= 1;
        if (soundRef.current) soundRef.current.playExplosion();
        game.floatingTexts.push({
          x: p.x,
          y: p.y,
          text: '-1 HP',
          color: '#ff0000',
          life: 1.0
        });

        if (game.health < 0) {
          handleGameOver();
          return;
        }
      }
    }

    // Floor/Ceiling (if out of bounds too much)
    if (p.y > window.innerHeight || p.y < -50) {
      handleGameOver();
      if (soundRef.current) soundRef.current.playExplosion();
      return;
    }

    // Collectibles
    const currentUpgrades = upgradesRef.current;
    const hasMagnetPowerUp = game.activePowerUps.some(p => p.type === 'MAGNET');
    
    game.collectibles.forEach(col => {
      const dx = p.x - col.x;
      const dy = p.y - col.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Magnet Effect
      if (hasMagnetPowerUp) {
        // Power-up active: Pull ALL coins on screen strongly
        col.x += (p.x - col.x) * 0.15; // Faster pull
        col.y += (p.y - col.y) * 0.15;
      } else {
        // Normal magnet upgrade: Only pull nearby coins
        const magnetRange = 50 + ((currentUpgrades.magnet || 1) * 20);
        if (dist < magnetRange) {
          col.x += (p.x - col.x) * 0.1;
          col.y += (p.y - col.y) * 0.1;
        }
      }

      // Collection
      if (dist < 30) {
        col.markedForDeletion = true;
        const amount = 1 * (game.currencyMultiplier || 1);
        setCurrency(c => c + amount);
        game.sessionCurrency = (game.sessionCurrency || 0) + amount; // Track session currency
        if (soundRef.current) soundRef.current.playCollect();
        game.floatingTexts.push({
          x: col.x,
          y: col.y,
          text: `+$${amount}`,
          color: '#00ff99',
          life: 1.0
        });
      }
    });

    // Fuel
    game.fuels.forEach(fuel => {
      if (
        pRect.x < fuel.x + fuel.width &&
        pRect.x + pRect.w > fuel.x &&
        pRect.y < fuel.y + fuel.height &&
        pRect.y + pRect.h > fuel.y
      ) {
        fuel.markedForDeletion = true;
        game.floatingTexts.push({
          x: fuel.x,
          y: fuel.y,
          text: fuel.type === 'LARGE' ? '+SUPER FUEL' : '+FUEL',
          color: fuel.color,
          life: 1.0
        });

        game.energy = Math.min(game.maxEnergy, game.energy + (game.maxEnergy * (fuel.value / 100)));
        setEnergy(Math.max(0, Math.min(100, (game.energy / game.maxEnergy) * 100)));
        if (soundRef.current) soundRef.current.playCollect();
      }
    });

    // Power-Up Collection
    game.powerUps.forEach(powerUp => {
      if (
        pRect.x < powerUp.x + powerUp.width &&
        pRect.x + pRect.w > powerUp.x &&
        pRect.y < powerUp.y + powerUp.height &&
        pRect.y + pRect.h > powerUp.y
      ) {
        powerUp.markedForDeletion = true;
        
        // Handle instant effect power-ups
        if (powerUp.type === 'COIN_RAIN') {
          // Spawn burst of coins around player
          const coinCount = Math.floor(Math.random() * 6) + 10; // 10-15 coins
          for (let i = 0; i < coinCount; i++) {
            const angle = (Math.PI * 2 * i) / coinCount;
            const distance = 100 + Math.random() * 100;
            const coinX = game.player.x + Math.cos(angle) * distance;
            const coinY = game.player.y + Math.sin(angle) * distance;
            
            game.collectibles.push(new Collectible(
              coinX,
              coinY,
              Math.random() < 0.3 ? 'RUBY' : (Math.random() < 0.5 ? 'COIN' : 'GOLD')
            ));
          }
          
          // Show floating text only (no timer)
          game.floatingTexts.push({
            x: powerUp.x,
            y: powerUp.y,
            text: '+COIN RAIN!',
            color: powerUp.color,
            life: 1.5
          });
          
          if (soundRef.current) soundRef.current.playCollect();
        } else {
          // Add to active power-ups (timed effects)
          const existingPowerUp = game.activePowerUps.find(p => p.type === powerUp.type);
          if (existingPowerUp) {
            // Refresh duration
            existingPowerUp.remainingTime = powerUp.duration;
            existingPowerUp.maxDuration = powerUp.duration;
          } else {
            // Add new power-up
            game.activePowerUps.push({
              type: powerUp.type,
              remainingTime: powerUp.duration,
              maxDuration: powerUp.duration,
              icon: powerUp.getIcon(),
              name: powerUp.getName(),
              color: powerUp.color
            });
          }

          // Update React state for HUD
          setActivePowerUps([...game.activePowerUps]);

          // Show floating text
          game.floatingTexts.push({
            x: powerUp.x,
            y: powerUp.y,
            text: `+${powerUp.getName()}!`,
            color: powerUp.color,
            life: 1.5
          });

          if (soundRef.current) soundRef.current.playCollect();
        }
      }
    });

    // Projectiles (Villain)
    game.projectiles.forEach(proj => {
      // Ghost Mode: Phase through projectiles
      if (game.ghostMode) return;
      
      if (
        pRect.x < proj.x + proj.radius &&
        pRect.x + pRect.w > proj.x - proj.radius &&
        pRect.y < proj.y + proj.radius &&
        pRect.y + pRect.h > proj.y - proj.radius
      ) {
        proj.markedForDeletion = true;
        game.health -= 1;
        if (soundRef.current) soundRef.current.playExplosion();
        game.floatingTexts.push({
          x: p.x,
          y: p.y,
          text: '-1 HP',
          color: '#ff0000',
          life: 1.0
        });

        if (game.health < 0) {
          handleGameOver();
        }
      }
    });

    // Player Projectiles vs Villain
    if (game.villain) {
      const v = game.villain;
      game.playerProjectiles.forEach(proj => {
        if (
          proj.x < v.x + v.width &&
          proj.x + 15 > v.x &&
          proj.y < v.y + v.height &&
          proj.y + 4 > v.y
        ) {
          proj.markedForDeletion = true;
          const died = v.takeDamage(proj.damage || 10); // Use weapon damage
          if (died) {
            if (soundRef.current) soundRef.current.playExplosion();
            game.floatingTexts.push({
              x: v.x,
              y: v.y,
              text: 'BOSS DEFEATED!',
              color: '#ff0000',
              life: 2.0
            });
            game.floatingTexts.push({
              x: v.x,
              y: v.y + 30,
              text: '+$50',
              color: '#ffd700', // Gold color
              life: 2.0
            });
            setCurrency(c => c + 50); // Bonus for killing boss
            game.sessionCurrency = (game.sessionCurrency || 0) + 50; // Add boss bonus to session currency
          } else {
            if (soundRef.current) soundRef.current.playShoot(); // Hit sound
          }
        }
      });
    }
  }, [handleGameOver]);

  const update = React.useCallback((deltaTime) => {
    const game = gameRef.current;
    if (game.gameOver) return;

    // Update Player
    game.player.update(deltaTime);

    // Update Speed & Distance
    game.speed += deltaTime * 10; // Accelerate over time
    game.distance += game.speed * deltaTime / 10; // 10x faster distance accumulation (approx 30m/s)
    setDistance(game.distance);
    setHealth(game.health);

    // Ammo Regeneration
    game.ammoTimer += deltaTime;
    const regenTime = game.ammoRegenTime || 2.0;
    if (game.ammoTimer > regenTime) {
      game.ammoTimer = 0;
      if (game.ammo < game.maxAmmo) {
        game.ammo++;
        setAmmo(game.ammo);
      }
    }

    // Health Regeneration (Shield Generator)
    if (game.health < game.maxHealth && game.regenRate > 0) {
      game.health += game.regenRate * deltaTime;
      if (game.health > game.maxHealth) game.health = game.maxHealth;
    }

    // Spawn Obstacles
    if (Math.random() < 0.02) {
      const h = Math.random() * 60 + 40; // Smaller obstacles (40-100 instead of 50-150)
      const y = Math.random() > 0.5 ? 0 : window.innerHeight - h; // Top or Bottom
      game.obstacles.push(new Obstacle(window.innerWidth, y, 50, h));
    }

    // Spawn Collectibles
    if (Math.random() < 0.05) {
      const y = Math.random() * (window.innerHeight - 100) + 50;
      game.collectibles.push(new Collectible(window.innerWidth, y));
    }

    // Spawn Fuel (Less common)
    if (Math.random() < 0.01) { // Reduced from 0.02 to 0.01 (50% less frequent)
      const y = Math.random() * (window.innerHeight - 100) + 50;
      game.fuels.push(new Fuel(window.innerWidth, y));
    }

    // Spawn Power-Ups (Rare)
    if (Math.random() < 0.003) { // Very rare - 0.3% chance per frame
      const y = Math.random() * (window.innerHeight - 100) + 50;
      game.powerUps.push(new PowerUp(window.innerWidth, y));
    }

    // Spawn Villain
    const villainChance = game.villainChance || 0.005;
    if (!game.villain && game.distance > 500 && Math.random() < villainChance) {
      const rand = Math.random();
      if (rand < 0.4) {
        game.villain = new Villain(window.innerWidth, window.innerHeight / 2);
      } else if (rand < 0.7) {
        game.villain = new SpeedsterVillain(window.innerWidth, window.innerHeight / 2);
      } else {
        game.villain = new JuggernautVillain(window.innerWidth, window.innerHeight / 2);
      }

      if (soundRef.current) {
        soundRef.current.playBossMusic();
      }
    }

    // Update Entities (apply time slow if active)
    const effectiveSpeed = game.speed * (game.timeSlowMultiplier || 1);
    game.obstacles.forEach(obs => obs.update(deltaTime, effectiveSpeed));
    game.collectibles.forEach(col => col.update(deltaTime, effectiveSpeed));
    game.fuels.forEach(fuel => fuel.update(deltaTime, effectiveSpeed));
    game.powerUps.forEach(powerUp => powerUp.update(deltaTime, effectiveSpeed));

    if (game.villain) {
      game.villain.update(deltaTime, game.player.y, game.playerProjectiles);

      if (game.villain.markedForDeletion) {
        game.villain = null;
        if (soundRef.current) {
          soundRef.current.playNormalMusic();
        }
      } else {
        // Villain Attack Logic
        if (game.villain && game.villain.state === 'ATTACKING') {
          if (game.villain.type === 'SPEEDSTER') {
            if (game.villain.attackTimer > 2.0) {
              game.villain.attackTimer = 0;
              // SPREAD SHOT (Shotgun style)
              game.projectiles.push(new Projectile(game.villain.x, game.villain.y + 20, -600, 0));      // Straight
              game.projectiles.push(new Projectile(game.villain.x, game.villain.y + 20, -550, -150));   // Up
              game.projectiles.push(new Projectile(game.villain.x, game.villain.y + 20, -550, 150));    // Down
              if (soundRef.current) soundRef.current.playShoot();
            }
          } else if (game.villain.type === 'JUGGERNAUT') {
            if (game.villain.attackTimer > 3.5) { // Slower fire rate (was 2.0, now 3.5 seconds)
              game.villain.attackTimer = 0;
              // HOMING MISSILE
              game.projectiles.push(new HomingProjectile(
                game.villain.x,
                game.villain.y,
                game.player
              ));
              if (soundRef.current) soundRef.current.playShoot();
            }
          } else {
            // NORMAL VILLAIN - Single shot
            if (game.villain.attackTimer > 1.5) {
              game.villain.attackTimer = 0;
              // SINGLE SHOT (fires one projectile at a time)
              game.projectiles.push(new Projectile(game.villain.x, game.villain.y, -500, 0));
              if (soundRef.current) soundRef.current.playShoot();
            }
          }
        }
      }
    }
    game.projectiles.forEach(proj => proj.update(deltaTime));
    game.playerProjectiles.forEach(proj => proj.update(deltaTime));

    // Update Floating Texts
    game.floatingTexts.forEach(ft => {
      ft.y -= 50 * deltaTime; // Float up
      ft.life -= deltaTime;
    });
    game.floatingTexts = game.floatingTexts.filter(ft => ft.life > 0);

    // Cleanup
    game.obstacles = game.obstacles.filter(obs => !obs.markedForDeletion);
    game.collectibles = game.collectibles.filter(col => !col.markedForDeletion);
    game.fuels = game.fuels.filter(col => !col.markedForDeletion);
    game.projectiles = game.projectiles.filter(proj => !proj.markedForDeletion);
    game.playerProjectiles = game.playerProjectiles.filter(proj => !proj.markedForDeletion);
    game.powerUps = game.powerUps.filter(powerUp => !powerUp.markedForDeletion);

    // Update Active Power-Ups timers
    game.activePowerUps.forEach(powerUp => {
      powerUp.remainingTime -= deltaTime;
    });
    game.activePowerUps = game.activePowerUps.filter(p => p.remainingTime > 0);
    setActivePowerUps([...game.activePowerUps]);

    // Apply Active Power-Up Effects
    game.currencyMultiplier = 1;
    game.hasShield = false;
    game.hasInvincibility = false;
    game.timeSlowMultiplier = 1;
    game.rapidFire = false;
    game.ghostMode = false;

    game.activePowerUps.forEach(powerUp => {
      switch (powerUp.type) {
        case 'SHIELD':
          game.hasShield = true;
          break;
        case 'TIME_SLOW':
          game.timeSlowMultiplier = 0.5; // Slow down game speed to 50%
          break;
        case 'MAGNET':
          // Magnet range already amplified by active power-up
          break;
        case 'RAPID_FIRE':
          game.rapidFire = true;
          break;
        case 'GHOST_MODE':
          game.ghostMode = true; // Can pass through obstacles
          break;
        case 'INVINCIBILITY':
          game.hasInvincibility = true;
          break;
      }
    });

    // Collision Detection
    checkCollisions(game);

    // Energy Drain if boosting
    if (game.player.isBoosting) {
      game.energy -= deltaTime * 10; // Reduced from 20 to 10 for longer flight
      if (game.energy <= 0) {
        game.energy = 0;
        game.player.boost(false);
      }
    }
    
    // Update energy display every frame
    setEnergy(Math.max(0, Math.min(100, (game.energy / game.maxEnergy) * 100)));
  }, [checkCollisions]);

  const draw = React.useCallback((deltaTime) => {
    const renderer = rendererRef.current;
    const game = gameRef.current;
    if (!renderer) return;

    renderer.clear();
    renderer.drawBackground(game.speed, deltaTime);
    renderer.drawObstacles(game.obstacles);
    renderer.drawCollectibles(game.collectibles);
    renderer.drawFuels(game.fuels);
    renderer.drawPowerUps(game.powerUps);
    renderer.drawVillain(game.villain);
    renderer.drawProjectiles(game.projectiles);
    renderer.drawPlayerProjectiles(game.playerProjectiles);
    renderer.drawPlayer(game.player, game.shipType, game.ghostMode);
    renderer.drawFloatingTexts(game.floatingTexts);
  }, []);

  // Initialize Loop
  useEffect(() => {
    loopRef.current = new GameLoop(update, draw);
    return () => {
      if (loopRef.current) loopRef.current.stop();
    };
  }, [update, draw]);

  const handleInputStart = React.useCallback(() => {
    if (gameState === 'PLAYING' && gameRef.current.energy > 0) {
      gameRef.current.player.boost(true);
    }
  }, [gameState]);

  const handleInputEnd = React.useCallback(() => {
    if (gameState === 'PLAYING') {
      gameRef.current.player.boost(false);
    }
  }, [gameState]);

  const handleShoot = React.useCallback(() => {
    const hasUnlimitedAmmo = gameRef.current.rapidFire;
    
    if (gameState === 'PLAYING' && (gameRef.current.ammo > 0 || hasUnlimitedAmmo)) {
      // Only decrease ammo if not in unlimited mode
      if (!hasUnlimitedAmmo) {
        gameRef.current.ammo--;
        setAmmo(gameRef.current.ammo);
      }

      gameRef.current.playerProjectiles.push(new PlayerProjectile(
        gameRef.current.player.x + 50,
        gameRef.current.player.y + 25,
        gameRef.current.weaponType
      ));

      if (soundRef.current) {
        soundRef.current.playShoot();
      }
    }
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        handleInputStart();
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        handleShoot();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        handleInputEnd();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, handleInputStart, handleInputEnd, handleShoot]); // Re-bind when gameState changes to capture correct state closure

  const buyUpgrade = (id, cost, type = 'upgrade') => {
    const currentBalance = parseInt(currency) || 0;
    const itemCost = parseInt(cost) || 0;



    if (currentBalance >= itemCost) {
      setCurrency(c => {
        const newCurrency = (parseInt(c) || 0) - itemCost;

        return newCurrency;
      });

      if (type === 'ship') {
        setOwnedShips(ships => {
          if (ships.includes(id)) return ships;
          return [...ships, id];
        });
        setEquippedShip(id);
      } else if (type === 'weapon') {
        setOwnedWeapons(weapons => {
          if (weapons.includes(id)) return weapons;
          return [...weapons, id];
        });
        setEquippedWeapon(id);
      } else {
        setUpgrades(u => {
          return {
            ...u,
            [id]: (u[id] || 1) + 1
          };
        });
      }
    }
  };

  const equipItem = (id, type = 'ship') => {
    if (type === 'ship') {
      setEquippedShip(id);
    } else if (type === 'weapon') {
      setEquippedWeapon(id);
    }
  };

  return (
    <div
      className="w-full h-full overflow-hidden relative"
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
      onMouseDown={handleInputStart}
      onMouseUp={handleInputEnd}
      onTouchStart={handleInputStart}
      onTouchEnd={handleInputEnd}
    >
      <canvas ref={canvasRef} className="block" style={{ width: '100%', height: '100%' }} />

      {gameState === 'PLAYING' && (
        <HUD
          distance={distance}
          currency={currency}
          energy={energy}
          ammo={ammo}
          maxAmmo={10}
          health={health}
          maxHealth={maxHealth}
          activePowerUps={activePowerUps}
          onShoot={handleShoot}
        />
      )}

      {gameState === 'MENU' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm">
          <h1 className="text-7xl font-bold mb-12 neon-text-blue italic tracking-wider drop-shadow-[0_0_30px_rgba(0,243,255,0.8)]">NEO GLIDE</h1>
          <div className="flex gap-6">
            <button
              onClick={startGame}
              className="group relative px-12 py-6 border-2 border-cyan-400 rounded-lg font-black text-3xl tracking-widest text-cyan-400 transition-all duration-300 hover:bg-cyan-400 hover:text-black"
            >
              <div className="flex items-center gap-4">
                <Play className="w-8 h-8 fill-current" />
                <span>START</span>
              </div>
            </button>
            <button
              onClick={() => setGameState('SHOP')}
              className="group relative px-12 py-6 border-2 border-pink-500 rounded-lg font-black text-3xl tracking-widest text-pink-500 transition-all duration-300 hover:bg-pink-500 hover:text-black"
            >
              <div className="flex items-center gap-4">
                <ShoppingCart className="w-8 h-8" />
                <span>SHOP</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {gameState === 'GAMEOVER' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-black/90 border-2 border-red-600 p-8 max-w-md w-full text-center clip-angled shadow-[0_0_50px_rgba(255,0,0,0.3)] relative overflow-hidden">

            {/* Glitch Effect Overlay */}
            <div className="absolute inset-0 bg-red-500/5 pointer-events-none animate-pulse"></div>

            <h2 className="text-5xl font-black text-red-600 mb-2 tracking-tighter animate-glitch drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]">
              GAME OVER
            </h2>
            <div className="text-red-400 text-sm tracking-[0.5em] mb-8 opacity-80">MISSION TERMINATED</div>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center border-b border-red-900/50 pb-2">
                <span className="text-gray-400 font-mono text-sm">DISTANCE TRAVELED</span>
                <span className="text-2xl text-white font-bold font-mono">{Math.floor(distance)}m</span>
              </div>
              <div className="flex justify-between items-center border-b border-red-900/50 pb-2">
                <span className="text-gray-400 font-mono text-sm">DATA COLLECTED</span>
                <span className="text-xl text-neon-green font-bold font-mono">+${sessionCurrency}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={startGame}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold tracking-widest clip-angled-sm transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(255,0,0,0.6)]"
              >
                RETRY
              </button>
              <button
                onClick={() => setGameState('MENU')}
                className="w-full py-3 bg-transparent border border-gray-600 hover:border-white text-gray-300 hover:text-white font-bold tracking-widest clip-angled-sm transition-all"
              >
                MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {gameState === 'SHOP' && (
        <Shop
          currency={currency}
          upgrades={upgrades}
          ownedShips={ownedShips}
          equippedShip={equippedShip}
          ownedWeapons={ownedWeapons}
          equippedWeapon={equippedWeapon}
          onBuy={buyUpgrade}
          onEquip={equipItem}
          onClose={() => setGameState('MENU')}
        />
      )}
    </div>
  );
}
