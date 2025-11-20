import React, { useEffect, useRef, useState } from 'react';
import { GameLoop } from './game/GameLoop';
import { Renderer } from './game/Renderer';
import { SoundManager } from './game/SoundManager';
import { Player, Obstacle, Collectible, Fuel, Villain, Projectile } from './game/Entities';
import HUD from './components/HUD';
import Shop from './components/Shop';
import { Play, ShoppingCart, RotateCcw, Zap } from 'lucide-react';

export default function App() {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('MENU'); // MENU, PLAYING, GAMEOVER, SHOP
  const [distance, setDistance] = useState(0);
  const [currency, setCurrency] = useState(() => parseInt(localStorage.getItem('neon_glide_currency')) || 0);
  const [energy, setEnergy] = useState(100);
  const [ammo, setAmmo] = useState(10);
  const [upgrades, setUpgrades] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('neon_glide_upgrades')) || {};
    } catch (e) {
      console.error("Failed to parse upgrades", e);
      return {};
    }
  });
  const [ownedShips, setOwnedShips] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('neon_glide_owned_ships')) || ['default'];
    } catch (e) {
      return ['default'];
    }
  });
  const [equippedShip, setEquippedShip] = useState(() => localStorage.getItem('neon_glide_equipped_ship') || 'default');

  // Game refs to avoid closure staleness in loop
  const gameRef = useRef({
    player: new Player(),
    obstacles: [],
    collectibles: [],
    speed: 300,
    distance: 0,
    energy: 100,
    ammo: 10,
    maxAmmo: 10,
    gameOver: false,
    floatingTexts: []
  });

  const loopRef = useRef(null);
  const rendererRef = useRef(null);
  const soundRef = useRef(null);

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

    // Initialize Loop
    loopRef.current = new GameLoop(update, draw);

    return () => {
      loopRef.current.stop();
      window.removeEventListener('resize', handleResize);
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

  const upgradesRef = useRef(upgrades);
  const equippedShipRef = useRef(equippedShip);

  useEffect(() => {
    upgradesRef.current = upgrades;
    equippedShipRef.current = equippedShip;
    localStorage.setItem('neon_glide_upgrades', JSON.stringify(upgrades));
  }, [upgrades, equippedShip]);

  const startGame = () => {
    // Reset Game State
    const currentUpgrades = upgradesRef.current;
    const batteryLvl = currentUpgrades.battery || 1;
    const maxEnergy = 100 + (batteryLvl - 1) * 20;

    gameRef.current = {
      player: new Player(),
      shipType: equippedShipRef.current,
      obstacles: [],
      collectibles: [],
      fuels: [],
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
      gameOver: false
    };

    setDistance(0);
    setEnergy(100);
    setAmmo(10); // Reset ammo state
    setGameState('PLAYING');
    soundRef.current.ctx.resume(); // Ensure AudioContext is active
    soundRef.current.startMusic();
    loopRef.current.start();
  };

  const update = (deltaTime) => {
    const game = gameRef.current;
    if (game.gameOver) return;

    // Update Player
    game.player.update(deltaTime);

    // Update Speed & Distance
    game.speed += deltaTime * 10; // Accelerate over time
    game.distance += game.speed * deltaTime / 10; // 10x faster distance accumulation (approx 30m/s)
    setDistance(game.distance);

    // Ammo Regeneration
    game.ammoTimer += deltaTime;
    if (game.ammoTimer > 2.0) { // Regenerate 1 ammo every 2 seconds
      game.ammoTimer = 0;
      if (game.ammo < game.maxAmmo) {
        game.ammo++;
        setAmmo(game.ammo);
      }
    }

    // Spawn Obstacles
    if (Math.random() < 0.02) {
      const h = Math.random() * 100 + 50;
      const y = Math.random() > 0.5 ? 0 : window.innerHeight - h; // Top or Bottom
      game.obstacles.push(new Obstacle(window.innerWidth, y, 50, h));
    }

    // Spawn Collectibles
    if (Math.random() < 0.05) {
      const y = Math.random() * (window.innerHeight - 100) + 50;
      game.collectibles.push(new Collectible(window.innerWidth, y));
    }

    // Spawn Fuel (Common)
    if (Math.random() < 0.02) { // 2% chance per frame (~0.8s)
      const y = Math.random() * (window.innerHeight - 100) + 50;
      game.fuels.push(new Fuel(window.innerWidth, y));
    }

    // Spawn Villain
    if (!game.villain && game.distance > 500 && Math.random() < 0.005) {
      game.villain = new Villain(window.innerWidth, window.innerHeight / 2);
      if (soundRef.current) {
        soundRef.current.playBossMusic();
      }
    }

    // Update Entities
    game.obstacles.forEach(obs => obs.update(deltaTime, game.speed));
    game.collectibles.forEach(col => col.update(deltaTime, game.speed));
    game.fuels.forEach(fuel => fuel.update(deltaTime, game.speed));

    if (game.villain) {
      game.villain.update(deltaTime, game.player.y, game.playerProjectiles);

      if (game.villain.markedForDeletion) {
        game.villain = null;
        if (soundRef.current) {
          soundRef.current.playNormalMusic();
        }
      } else {
        // Attack Logic (Burst Fire)
        if (game.villain.state === 'ATTACKING') {
          if (game.villain.attackTimer > 2) { // Fire every 2 seconds
            game.villain.attackTimer = 0;
            // Fire 3 shots in quick succession
            for (let i = 0; i < 3; i++) {
              setTimeout(() => {
                if (game.villain && !game.gameOver) {
                  game.projectiles.push(new Projectile(game.villain.x, game.villain.y + 30));
                  soundRef.current.playShoot();
                }
              }, i * 200);
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

    // Collision Detection
    checkCollisions(game);

    // Energy Drain if boosting
    if (game.player.isBoosting) {
      game.energy -= deltaTime * 10; // Reduced from 20 to 10 for longer flight
      if (game.energy <= 0) {
        game.energy = 0;
        game.player.boost(false);
      }
      setEnergy((game.energy / game.maxEnergy) * 100);
    }
  };

  const checkCollisions = (game) => {
    const p = game.player;
    // Simple AABB Collision
    // Player is roughly 40x20
    const pRect = { x: p.x, y: p.y - 10, w: 40, h: 20 }; // Approximate

    // Obstacles
    for (let obs of game.obstacles) {
      if (
        pRect.x < obs.x + obs.width &&
        pRect.x + pRect.w > obs.x &&
        pRect.y < obs.y + obs.height &&
        pRect.y + pRect.h > obs.y
      ) {
        handleGameOver();
        return;
      }
    }

    // Floor/Ceiling (if out of bounds too much)
    if (p.y > window.innerHeight || p.y < -50) {
      handleGameOver();
      soundRef.current.playExplosion();
      return;
    }

    // Collectibles
    const currentUpgrades = upgradesRef.current;
    const magnetRange = 50 + ((currentUpgrades.magnet || 1) * 20);
    game.collectibles.forEach(col => {
      const dx = p.x - col.x;
      const dy = p.y - col.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Magnet Effect
      if (dist < magnetRange) {
        col.x += (p.x - col.x) * 0.1;
        col.y += (p.y - col.y) * 0.1;
      }

      // Collection
      if (dist < 30) {
        col.markedForDeletion = true;
        setCurrency(c => c + 1);
        soundRef.current.playCollect();
        game.floatingTexts.push({
          x: col.x,
          y: col.y,
          text: '+$1',
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
        setEnergy((game.energy / game.maxEnergy) * 100);
        soundRef.current.playCollect();
      }
    });

    // Projectiles (Villain)
    game.projectiles.forEach(proj => {
      if (
        pRect.x < proj.x + proj.radius &&
        pRect.x + pRect.w > proj.x - proj.radius &&
        pRect.y < proj.y + proj.radius &&
        pRect.y + pRect.h > proj.y - proj.radius
      ) {
        // Hull Strength Logic could go here (survive 1 hit)
        handleGameOver();
        soundRef.current.playExplosion();
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
          const died = v.takeDamage(10); // 10 damage per shot
          if (died) {
            soundRef.current.playExplosion();
            game.floatingTexts.push({
              x: v.x,
              y: v.y,
              text: 'BOSS DEFEATED!',
              color: '#ff0000',
              life: 2.0
            });
            setCurrency(c => c + 50); // Bonus for killing boss
          } else {
            soundRef.current.playShoot(); // Hit sound
          }
        }
      });
    }
  };

  const handleGameOver = () => {
    gameRef.current.gameOver = true;
    loopRef.current.stop();
    soundRef.current.stopMusic();
    setGameState('GAMEOVER');
  };

  const draw = (deltaTime) => {
    const renderer = rendererRef.current;
    const game = gameRef.current;
    if (!renderer) return;

    renderer.clear();
    renderer.drawBackground(game.speed, deltaTime);
    renderer.drawObstacles(game.obstacles);
    renderer.drawCollectibles(game.collectibles);
    renderer.drawFuels(game.fuels);
    renderer.drawVillain(game.villain);
    renderer.drawProjectiles(game.projectiles);
    renderer.drawPlayerProjectiles(game.playerProjectiles);
    renderer.drawPlayer(game.player, game.shipType);
    renderer.drawFloatingTexts(game.floatingTexts);
  };

  const handleInputStart = () => {
    if (gameState === 'PLAYING' && gameRef.current.energy > 0) {
      gameRef.current.player.boost(true);
    }
  };

  const handleInputEnd = () => {
    if (gameState === 'PLAYING') {
      gameRef.current.player.boost(false);
    }
  };

  const handleShoot = () => {
    if (gameState === 'PLAYING' && gameRef.current.ammo > 0) {
      gameRef.current.ammo--;
      setAmmo(gameRef.current.ammo);

      gameRef.current.playerProjectiles.push(new PlayerProjectile(
        gameRef.current.player.x + 50,
        gameRef.current.player.y + 25
      ));

      if (soundRef.current) {
        soundRef.current.playShoot();
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        handleInputStart();
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        setAmmo(gameRef.current.ammo);

        gameRef.current.playerProjectiles.push(new PlayerProjectile(
          gameRef.current.player.x + 50,
          gameRef.current.player.y + 25
        ));

        if (soundRef.current) {
          soundRef.current.playShoot();
        }
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
  }, [gameState]); // Re-bind when gameState changes to capture correct state closure

  const buyUpgrade = (id, cost, type = 'upgrade') => {
    console.log(`Attempting to buy ${id} for ${cost}. Current currency: ${currency}`);
    if (currency >= cost) {
      setCurrency(c => {
        const newCurrency = c - cost;
        console.log(`Purchase successful. New currency: ${newCurrency}`);
        return newCurrency;
      });

      if (type === 'ship') {
        setOwnedShips(ships => [...ships, id]);
        setEquippedShip(id);
      } else {
        setUpgrades(u => ({
          ...u,
          [id]: (u[id] || 1) + 1
        }));
      }
    } else {
      console.log("Not enough currency.");
    }
  };

  const equipShip = (id) => {
    setEquippedShip(id);
  };

  return (
    <div
      className="w-full h-screen overflow-hidden relative"
      onMouseDown={handleInputStart}
      onMouseUp={handleInputEnd}
      onTouchStart={handleInputStart}
      onTouchEnd={handleInputEnd}
    >
      <canvas ref={canvasRef} className="block" />

      {gameState === 'PLAYING' && (
        <HUD
          distance={distance}
          currency={currency}
          energy={energy}
          ammo={ammo}
          maxAmmo={10}
          onShoot={handleShoot}
        />
      )}

      {gameState === 'MENU' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
          <h1 className="text-6xl font-bold mb-8 neon-text-blue italic">NEON GLIDE</h1>
          <div className="flex gap-4">
            <button
              onClick={startGame}
              className="flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-full font-bold text-xl transition-all hover:scale-105 shadow-[0_0_20px_rgba(37,99,235,0.6)]"
            >
              <Play fill="white" /> START
            </button>
            <button
              onClick={() => setGameState('SHOP')}
              className="flex items-center gap-2 px-8 py-4 bg-pink-600 hover:bg-pink-500 rounded-full font-bold text-xl transition-all hover:scale-105 shadow-[0_0_20px_rgba(219,39,119,0.6)]"
            >
              <ShoppingCart /> SHOP
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
              SYSTEM FAILURE
            </h2>
            <div className="text-red-400 text-sm tracking-[0.5em] mb-8 opacity-80">MISSION TERMINATED</div>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center border-b border-red-900/50 pb-2">
                <span className="text-gray-400 font-mono text-sm">DISTANCE TRAVELED</span>
                <span className="text-2xl text-white font-bold font-mono">{Math.floor(distance)}m</span>
              </div>
              <div className="flex justify-between items-center border-b border-red-900/50 pb-2">
                <span className="text-gray-400 font-mono text-sm">DATA COLLECTED</span>
                <span className="text-xl text-neon-green font-bold font-mono">+${Math.floor(distance * 0.5)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={startGame}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold tracking-widest clip-angled-sm transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(255,0,0,0.6)]"
              >
                REBOOT SYSTEM
              </button>
              <button
                onClick={() => setGameState('MENU')}
                className="w-full py-3 bg-transparent border border-gray-600 hover:border-white text-gray-300 hover:text-white font-bold tracking-widest clip-angled-sm transition-all"
              >
                ACCESS TERMINAL
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
          onBuy={buyUpgrade}
          onEquip={equipShip}
          onClose={() => setGameState('MENU')}
        />
      )}
    </div>
  );
}
