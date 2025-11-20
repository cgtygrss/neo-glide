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
    gameOver: false
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
      speed: 300 + ((currentUpgrades.thruster || 1) * 20), // Base speed increases with thruster
      distance: 0,
      energy: maxEnergy,
      maxEnergy: maxEnergy,
      gameOver: false
    };

    setDistance(0);
    setEnergy(100);
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

    // Spawn Fuel (Uncommon)
    if (Math.random() < 0.01) { // 1% chance per frame (~1.6s)
      const y = Math.random() * (window.innerHeight - 100) + 50;
      game.fuels.push(new Fuel(window.innerWidth, y));
    }

    // Spawn Villain (Every 500m if not active)
    if (!game.villain && game.distance > 500 && Math.random() < 0.005) {
      game.villain = new Villain(window.innerWidth - 100, window.innerHeight / 2);
    }

    // Update Entities
    game.obstacles.forEach(obs => obs.update(deltaTime, game.speed));
    game.collectibles.forEach(col => col.update(deltaTime, game.speed));
    game.fuels.forEach(fuel => fuel.update(deltaTime, game.speed));

    if (game.villain) {
      game.villain.update(deltaTime, game.player.y);
      // Attack
      if (game.villain.attackTimer > 2) {
        game.villain.attackTimer = 0;
        game.projectiles.push(new Projectile(game.villain.x, game.villain.y + 30));
        soundRef.current.playShoot();
      }
      // Despawn logic could go here (e.g. after 20s)
    }

    game.projectiles.forEach(proj => proj.update(deltaTime));

    // Cleanup
    game.obstacles = game.obstacles.filter(obs => !obs.markedForDeletion);
    game.collectibles = game.collectibles.filter(col => !col.markedForDeletion);
    game.fuels = game.fuels.filter(fuel => !fuel.markedForDeletion);
    game.projectiles = game.projectiles.filter(proj => !proj.markedForDeletion);

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
        game.energy = Math.min(game.maxEnergy, game.energy + (game.maxEnergy * 0.25));
        setEnergy((game.energy / game.maxEnergy) * 100);
        soundRef.current.playCollect();
      }
    });

    // Projectiles
    game.projectiles.forEach(proj => {
      const dx = p.x - proj.x;
      const dy = p.y - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 20) {
        handleGameOver();
        return;
      }
    });
  };

  const handleGameOver = () => {
    gameRef.current.gameOver = true;
    loopRef.current.stop();
    soundRef.current.stopMusic();
    setGameState('GAMEOVER');
  };

  const draw = () => {
    const renderer = rendererRef.current;
    const game = gameRef.current;
    if (!renderer) return;

    renderer.clear();
    renderer.drawBackground(game.speed);
    renderer.drawObstacles(game.obstacles);
    renderer.drawCollectibles(game.collectibles);
    renderer.drawFuels(game.fuels);
    renderer.drawVillain(game.villain);
    renderer.drawProjectiles(game.projectiles);
    renderer.drawPlayer(game.player, game.shipType);
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        handleInputStart();
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
    if (currency >= cost) {
      setCurrency(c => c - cost);

      if (type === 'ship') {
        setOwnedShips(ships => [...ships, id]);
        setEquippedShip(id);
      } else {
        setUpgrades(u => ({
          ...u,
          [id]: (u[id] || 1) + 1
        }));
      }
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
        <HUD distance={distance} currency={currency} energy={energy} />
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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <h2 className="text-5xl font-bold mb-4 text-red-500 neon-text-pink">CRASHED</h2>
          <p className="text-2xl mb-8 text-gray-300">Distance: {Math.floor(distance)}m</p>
          <div className="flex gap-4">
            <button
              onClick={startGame}
              className="flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-full font-bold text-xl transition-all hover:scale-105"
            >
              <RotateCcw /> RETRY
            </button>
            <button
              onClick={() => setGameState('SHOP')}
              className="flex items-center gap-2 px-8 py-4 bg-pink-600 hover:bg-pink-500 rounded-full font-bold text-xl transition-all hover:scale-105"
            >
              <ShoppingCart /> SHOP
            </button>
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
