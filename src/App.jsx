import React, { useEffect, useRef, useState } from 'react';
import { GameLoop } from './game/GameLoop';
import { Renderer } from './game/Renderer';
import { SoundManager } from './game/SoundManager';
import { BOSS_REWARD, LEVEL_REWARD, claimDistanceCredits, loadWallet, updateWallet as setCurrency, subscribeWallet, getEquippedStage, getStageOwnership, equipStage, unlockCreditStage, claimEarningsBonus, coinMultiplier, MULTIPLIER_MAX_LEVEL, getCosmeticOwnership, getPendingCosmeticProducts, unlockCreditCosmetic } from './game/Economy';
import { SHIPS } from './game/ShipCatalog';
import { COSMETICS } from './game/CosmeticsCatalog';
import { loadSoundPreferences, saveSoundPreferences } from './game/SoundPreferences';
import {
  Player, Obstacle, Fuel, Villain, Projectile, PlayerProjectile, SpeedsterVillain, JuggernautVillain, HomingProjectile,
  PowerUp, HealthPickup,
  FuseProjectile,
  SonicBladeProjectile
} from './game/Entities';
import HUD from './components/HUD';
import Shop from './components/Shop';
import Tutorial from './components/Tutorial';
import Career from './components/Career';
import { Home, Play } from 'lucide-react';
import HomeScreen from './components/HomeScreen';
import RunResults from './components/RunResults';
import { createCoinTrailState, advanceCoinTrails, collectCoin } from './game/CoinTrails';
import { syncEncounterMusic } from './game/EncounterMusic';
import { BASE_HEALTH, ENEMY_HIT_DAMAGE, HIT_PROTECTION_SECONDS, maxHullHealth, hullRecoveryRate, advanceHitProtection, takeProjectileHit, collectHealth, advanceHealthPickupSpawn, obstacleImpact, touchesFlightBoundary } from './game/PlayerHealth';
import { FlightInput } from './game/FlightInput';
import { constrainFlightPlayer } from './game/FlightBounds';
import { prepareLaunch, advanceFlightStart, takeFlightControl, prepareFlightReady, pauseFlight, resumeFlight, refillFuel } from './game/FlightStart';
import { getPurchases, initializeMonetization, purchaseProduct, restorePurchases, refreshStorePurchases, subscribeStore, showRewardedAd, trackMonetizationEvent } from './services/MonetizationService';
import { claimMission, loadProfile, recordRun } from './services/ProgressionService';
import { isAdPrivacyOptionsRequired, showAdPrivacyOptions } from './services/AdMobService';
import './NavigationMotion.css';
import { transformationProtected, absorbTransformationHit, transformationHitbox, advanceTransformation, advanceTransformationCapsule, resetTransformations, resizeTransformation, transformationPrimary, transformationSecondary, transformationHud } from './game/Transformations';

import { transformationWorldDelta } from './game/TransformationCatalog';

const frameChance = (chanceAt60Fps, deltaTime) => 1 - Math.pow(1 - chanceAt60Fps, deltaTime * 60);
const cosmeticIds = new Set(COSMETICS.map(cosmetic => cosmetic.id));
const safeCosmeticOwnership = () => {
  try { return getCosmeticOwnership(); } catch { return {}; }
};

export default function App() {
  const [gameState, setGameState] = useState('MENU'); // MENU, TUTORIAL, COUNTDOWN, PLAYING, GAMEOVER, SHOP
  const [audioPreferences, setAudioPreferences] = useState(loadSoundPreferences);
  const [showTutorialOnStart, setShowTutorialOnStart] = useState(() => {
    return localStorage.getItem('neon_glide_learned_controls') !== 'true';
  });
  const [flightPhase, setFlightPhase] = useState('ENDED');
  const runTokenRef = useRef(0);
  const invalidateRun = React.useCallback(() => { runTokenRef.current++; }, []);
  const [countdown, setCountdown] = useState(3);
  const [distance, setDistance] = useState(0);
  const currency = React.useSyncExternalStore(subscribeWallet, loadWallet);
  const equippedStage = React.useSyncExternalStore(subscribeWallet, getEquippedStage);
  const [shopInitialTab, setShopInitialTab] = useState('upgrades');
  const [energy, setEnergy] = useState(100);
  const [ammo, setAmmo] = useState(10);
  const [health, setHealth] = useState(BASE_HEALTH);
  const [maxHealth, setMaxHealth] = useState(BASE_HEALTH);
  const [sessionCurrency, setSessionCurrency] = useState(0);
  const [distanceBonus, setDistanceBonus] = useState(0);
  const [purchases, setPurchases] = useState(getPurchases);
  const [ownedCosmetics, setOwnedCosmetics] = useState(safeCosmeticOwnership);
  const [equippedCosmetic, setEquippedCosmetic] = useState(() => {
    const id = localStorage.getItem('neon_glide_equipped_cosmetic') || '';
    return safeCosmeticOwnership()[id] && cosmeticIds.has(id) ? id : '';
  });
  const [pendingProducts, setPendingProducts] = useState(getPendingCosmeticProducts);
  const [busyProduct, setBusyProduct] = useState(null);
  const [purchaseMessage, setPurchaseMessage] = useState('');
  const [continueUsed, setContinueUsed] = useState(false);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [rewardMessage, setRewardMessage] = useState('');
  const [rewardAction, setRewardAction] = useState(null);
  const rewardOperationRef = useRef(null);
  const [earningsBonus, setEarningsBonus] = useState(0);
  const [earningsBonusClaimed, setEarningsBonusClaimed] = useState(false);
  const [levelBonus, setLevelBonus] = useState(0);
  const [adPrivacyAvailable, setAdPrivacyAvailable] = useState(false);
  const [adPrivacyBusy, setAdPrivacyBusy] = useState(false);
  const [adPrivacyMessage, setAdPrivacyMessage] = useState('');
  const [profile, setProfile] = useState(loadProfile);
  const [lastRunXp, setLastRunXp] = useState(0);
  const [combo, setCombo] = useState(0);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialBoosted, setTutorialBoosted] = useState(false);
  const [tutorialFired, setTutorialFired] = useState(false);
  const [newBest, setNewBest] = useState(false);

  const [upgrades, setUpgrades] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('neon_glide_upgrades')) || {};
    } catch {
      return {};
    }
  });

  const [ownedShips, setOwnedShips] = useState(() => {
    try {
      const items = JSON.parse(localStorage.getItem('neon_glide_owned_ships')) || ['default'];
      return getPurchases().starter_pack && !items.includes('interceptor') ? [...items, 'interceptor'] : items;
    } catch {
      return ['default'];
    }
  });

  const [equippedShip, setEquippedShip] = useState(() => {
    return localStorage.getItem('neon_glide_equipped_ship') || 'default';
  });

  const [ownedWeapons, setOwnedWeapons] = useState(() => {
    try {
      const items = JSON.parse(localStorage.getItem('neon_glide_owned_weapons')) || ['default'];
      return getPurchases().starter_pack && !items.includes('blaster') ? [...items, 'blaster'] : items;
    } catch {
      return ['default'];
    }
  });

  const [equippedWeapon, setEquippedWeapon] = useState(() => {
    return localStorage.getItem('neon_glide_equipped_weapon') || 'default';
  });

  // Active power-ups state
  const [activePowerUps, setActivePowerUps] = useState([]);
  const [transformationView, setTransformationView] = useState(null);

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
    cosmeticId: '',
    obstacles: [],
    collectibles: [],
    healthPickups: [],
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

  const flightInputRef = useRef(null);
  useEffect(() => {
    const input = new FlightInput(active => {
      const game = gameRef.current;
      if (game.transformation) {
        game.player.boost(false);
        if (active) transformationPrimary(game);
      } else game.player.boost(active && game.phase === 'FLYING' && game.energy > 0);
    });
    flightInputRef.current = input;
    return () => input.reset();
  }, []);

  const upgradesRef = useRef(upgrades);
  const equippedShipRef = useRef(equippedShip);
  const equippedWeaponRef = useRef(equippedWeapon);
  const equippedCosmeticRef = useRef(equippedCosmetic);
  const profileRef = useRef(profile);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Sound Manager
    soundRef.current = new SoundManager();

    // Initialize Renderer
    rendererRef.current = new Renderer(canvasRef.current);

    // Version Check
    const checkVersion = async () => {
      try {
        // Replace with your actual GitHub raw URL or hosted JSON URL
        const response = await fetch('https://raw.githubusercontent.com/cgtygrss/neon-glide/main/public/version.json');
        const data = await response.json();

        // Current app version (should match package.json)
        const currentVersion = '1.2.0';

        if (data.forceUpdate && data.version !== currentVersion) {
          // Simple semantic version check (assumes format x.y.z)
          const v1 = currentVersion.split('.').map(Number);
          const v2 = data.version.split('.').map(Number);

          let updateNeeded = false;
          for (let i = 0; i < 3; i++) {
            if (v2[i] > v1[i]) {
              updateNeeded = true;
              break;
            } else if (v2[i] < v1[i]) {
              break;
            }
          }

          if (updateNeeded) {
            setGameState('UPDATE_REQUIRED');
            // Store store URLs for the modal
            window.storeUrls = {
              ios: data.iosUrl,
              android: data.androidUrl
            };
          }
        }
      } catch (error) {
        console.error('Version check failed:', error);
      }
    };

    checkVersion();
    void initializeMonetization().then(status => {
      setAdPrivacyAvailable(Boolean(status?.privacyOptionsRequired || isAdPrivacyOptionsRequired()));
    });

    // Handle Resize
    const handleResize = () => {
      rendererRef.current.resize(window.innerWidth, window.innerHeight);
      resizeTransformation(gameRef.current, window.innerWidth, window.innerHeight);
      constrainFlightPlayer(gameRef.current, window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // Resume AudioContext on user interaction
    const handleUserInteraction = () => {
      void soundRef.current?.unlock();
    };
    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);
    window.addEventListener('touchstart', handleUserInteraction);

    return () => {
      invalidateRun();
      if (loopRef.current) loopRef.current.stop();
      if (soundRef.current) soundRef.current.cleanup();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [invalidateRun]);

  useEffect(() => {
    soundRef.current?.setPreferences(audioPreferences);
    saveSoundPreferences(audioPreferences);
  }, [audioPreferences]);

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
    localStorage.setItem('neon_glide_equipped_cosmetic', equippedCosmetic);
  }, [equippedCosmetic]);

  useEffect(() => {
    upgradesRef.current = upgrades;
    equippedShipRef.current = equippedShip;
    equippedWeaponRef.current = equippedWeapon;
    equippedCosmeticRef.current = equippedCosmetic;
    if (gameRef.current) {
      gameRef.current.shipType = equippedShip;
      gameRef.current.weaponType = equippedWeapon;
      gameRef.current.cosmeticId = equippedCosmetic;
    }
    localStorage.setItem('neon_glide_upgrades', JSON.stringify(upgrades));
  }, [upgrades, equippedShip, equippedWeapon, equippedCosmetic]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (gameState !== 'COUNTDOWN') return undefined;

    const game = gameRef.current;
    const token = runTokenRef.current;
    const isCurrent = () => token === runTokenRef.current && game.phase === 'COUNTDOWN';
    soundRef.current?.playTone(520, 'sine', 0.12);
    const secondTick = window.setTimeout(() => {
      if (!isCurrent()) return;
      setCountdown(2);
      soundRef.current?.playTone(620, 'sine', 0.12);
    }, 850);
    const finalTick = window.setTimeout(() => {
      if (!isCurrent()) return;
      setCountdown(1);
      soundRef.current?.playTone(760, 'sine', 0.15);
    }, 1700);
    const resume = window.setTimeout(() => {
      if (!isCurrent()) return;
      prepareFlightReady(game);
      constrainFlightPlayer(game, window.innerWidth);
      setFlightPhase(game.phase);
      setGameState('PLAYING');
      syncEncounterMusic(game, soundRef.current, { allowEntrance: false });
      loopRef.current?.start();
    }, 2550);

    return () => {
      window.clearTimeout(secondTick);
      window.clearTimeout(finalTick);
      window.clearTimeout(resume);
    };
  }, [gameState]);

  // Menu Music Effect
  useEffect(() => {
    if (['MENU', 'SHOP', 'CAREER'].includes(gameState) && soundRef.current) {
      soundRef.current.startMenuMusic();
    } else if (gameState !== 'PLAYING' && soundRef.current) {
      // Only stop music if not playing (for GAMEOVER state)
      soundRef.current.stopMusic();
    }
  }, [gameState]);

  const startGame = ({ forceTutorial = false } = {}) => {
    runTokenRef.current++;
    rewardOperationRef.current = null;
    const shouldRunTutorial = forceTutorial || showTutorialOnStart;
    flightInputRef.current.reset();
    setTutorialActive(shouldRunTutorial);
    setTutorialBoosted(false);
    setTutorialFired(false);
    setActivePowerUps([]);
    if (shouldRunTutorial) setShowTutorialOnStart(false);

    // Reset Game State
    const currentUpgrades = upgradesRef.current;
    const pilotLevel = profileRef.current.level || 1;
    const batteryLvl = currentUpgrades.battery || 1;
    const maxEnergy = 100 + (batteryLvl - 1) * 20 + (pilotLevel - 1) * 2;

    // New Upgrades Logic
    const hullLvl = currentUpgrades.hull || 1;
    const shieldGenLvl = currentUpgrades.shield_gen || 0;
    const multiplierLvl = currentUpgrades.multiplier || 1;

    // Ship Bonuses
    const ship = equippedShipRef.current;
    let ammoRegenTime = 2.0;
    let villainChance = 0.005;

    if (ship === 'interceptor') ammoRegenTime = 1.5;
    if (ship === 'stealth') villainChance = 0.0025;

    const totalHealth = maxHullHealth(hullLvl, ship, pilotLevel);

    gameRef.current = {
      player: new Player(currentUpgrades.thruster || 1),
      shipType: equippedShipRef.current,
      stageId: getEquippedStage(),
      weaponType: equippedWeaponRef.current,
      cosmeticId: equippedCosmeticRef.current,
      obstacles: [],
      collectibles: [],
      coinTrails: createCoinTrailState(),
      fuels: [],
      healthPickups: [],
      healthPickupTimer: 0,
      powerUps: [],
      activePowerUps: [],
      villain: null,
      projectiles: [],
      playerProjectiles: [],
      floatingTexts: [],
      speed: 300 + ((currentUpgrades.thruster || 1) * 20) + (pilotLevel - 1) * 3,
      distance: 0,
      energy: maxEnergy,
      ammo: 10,
      maxAmmo: 10,
      ammoTimer: 0,
      maxEnergy: maxEnergy,

      // New Stats
      health: totalHealth,
      maxHealth: totalHealth,
      hitProtection: 0,
      regenRate: hullRecoveryRate(shieldGenLvl),
      currencyMultiplier: coinMultiplier(multiplierLvl),
      ammoRegenTime: ammoRegenTime,
      villainChance: villainChance,

      gameOver: false,
      sessionCurrency: 0, // Flight credits, including earned distance rewards
      distanceBonus: 0,
      bossesDefeated: 0,
      combo: 0,
      comboTimer: 0,
      progressCommitted: null,
      runXpEarned: 0,
      levelBonus: 0,
      earningsBonus: 0,
      earningsBonusClaimed: false
    };

    resetTransformations(gameRef.current, true);
    setTransformationView(null);
    prepareLaunch(gameRef.current, window.innerHeight, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setFlightPhase('LAUNCH');
    setDistance(0);
    setEnergy(100); // Always start at 100% regardless of max energy
    setAmmo(10); // Reset ammo state
    setHealth(totalHealth);
    setMaxHealth(totalHealth);
    setSessionCurrency(0);
    setDistanceBonus(0);
    setContinueUsed(false);
    setRewardBusy(false);
    setRewardMessage('');
    setRewardAction(null);
    setEarningsBonus(0);
    setEarningsBonusClaimed(false);
    setLevelBonus(0);
    setLastRunXp(0);
    setCombo(0);
    trackMonetizationEvent('run_started', { ship: equippedShipRef.current, weapon: equippedWeaponRef.current });
    setGameState('PLAYING');
    if (soundRef.current) {
      soundRef.current.startMusic();
    }
    loopRef.current.start();
  };

  const handleTutorialComplete = React.useCallback(() => {
    setTutorialActive(false);
    setShowTutorialOnStart(false);
    localStorage.setItem('neon_glide_learned_controls', 'true');
  }, []);

  const handleTutorialSkip = () => {
    handleTutorialComplete();
  };

  const replayTutorial = () => {
    startGame({ forceTutorial: true });
  };

  const handleGameOver = React.useCallback(() => {
    if (gameRef.current.gameOver) return;
    gameRef.current.gameOver = true;
    gameRef.current.phase = 'ENDED';
    flightInputRef.current.reset();
    setTutorialActive(false);
    if (loopRef.current) loopRef.current.stop();
    if (soundRef.current) soundRef.current.stopMusic();

    const distanceDelta = claimDistanceCredits(gameRef.current);
    if (distanceDelta) setCurrency(value => value + distanceDelta);
    setDistanceBonus(gameRef.current.distanceBonus || 0);
    setDistance(gameRef.current.distance || 0);
    setSessionCurrency(gameRef.current.sessionCurrency || 0);
    {
      gameRef.current.newBest = gameRef.current.newBest || Math.floor(gameRef.current.distance || 0) > profileRef.current.bestDistance;
      setNewBest(gameRef.current.newBest);
      const result = recordRun(profileRef.current, {
        distance: gameRef.current.distance || 0,
        coins: (gameRef.current.sessionCurrency || 0) - (gameRef.current.distanceBonus || 0),
        bosses: gameRef.current.bossesDefeated || 0,
      }, gameRef.current.progressCommitted);
      gameRef.current.progressCommitted = result.committed;
      profileRef.current = result.profile;
      setProfile(result.profile);
      gameRef.current.runXpEarned += result.xpEarned;
      setLastRunXp(gameRef.current.runXpEarned);
      const levelReward = result.levelsGained * LEVEL_REWARD;
      gameRef.current.levelBonus += levelReward;
      setLevelBonus(gameRef.current.levelBonus);
      if (levelReward > 0) setCurrency(value => value + levelReward);
    }
    trackMonetizationEvent('run_ended', {
      distance: Math.floor(gameRef.current.distance || 0),
      credits: gameRef.current.sessionCurrency || 0,
    });
    setGameState('GAMEOVER');
  }, []);

  const checkCollisions = React.useCallback((game, deltaTime) => {
    const p = game.player;
    // Simple AABB Collision
    // Player is roughly 40x20
    const pRect = transformationHitbox(game);

    // Obstacles
    for (let obs of game.obstacles) {
      if (obs.markedForDeletion) continue;
      const impact = obstacleImpact(game, obs);
      if (impact === 'phase' && !transformationProtected(game)) continue;

      if (
        pRect.x < obs.x + obs.width &&
        pRect.x + pRect.w > obs.x &&
        pRect.y < obs.y + obs.height &&
        pRect.y + pRect.h > obs.y
      ) {
        obs.markedForDeletion = true;

        if (game.transformationSafety > 0 || transformationProtected(game)) continue;

        // Plasma Breaker: Destroy without damage
        if (impact === 'smash') {
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

        if (absorbTransformationHit(game)) {
          setTransformationView(transformationHud(game));
          if (game.transformation?.phase === 'EXITING' && game.transformation.transitionTime === 0) soundRef.current?.playExplosion();
          continue;
        }

        rendererRef.current?.emitBurst(p.x + 20, p.y, '#ff1744', 24, 280);
        if (soundRef.current) soundRef.current.playExplosion();
        handleGameOver();
        return;
      }
    }

    // Falling below the screen remains fatal, even during hit protection.
    if (!game.transformation && touchesFlightBoundary(p, window.innerHeight)) {
      if (game.transformationSafety > 0) {
        p.y = window.innerHeight - 30;
        p.velocity = 0;
        return;
      }
      handleGameOver();
      if (soundRef.current) soundRef.current.playExplosion();
      return;
    }

    // Collectibles
    const currentUpgrades = upgradesRef.current;
    const hasMagnetPowerUp = game.activePowerUps.some(p => p.type === 'MAGNET');

    game.collectibles.forEach(col => {
      if (col.markedForDeletion) return;
      const dx = p.x - col.x;
      const dy = p.y - col.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Magnet Effect
      if (hasMagnetPowerUp) {
        // Power-up active: Pull ALL coins on screen strongly
        col.x += (p.x - col.x) * (1 - Math.pow(.85, deltaTime * 60)); // Faster pull
        col.y += (p.y - col.y) * (1 - Math.pow(.85, deltaTime * 60));
      } else {
        // Normal magnet upgrade: Only pull nearby coins
        const magnetRange = 50 + ((currentUpgrades.magnet || 1) * 20);
        if (dist < magnetRange) {
          col.x += (p.x - col.x) * (1 - Math.pow(.9, deltaTime * 60));
          col.y += (p.y - col.y) * (1 - Math.pow(.9, deltaTime * 60));
        }
      }

      // Collection
      if (dist < 30) {
        const amount = collectCoin(game, col, currentUpgrades.multiplier || 1);
        setCombo(game.combo);
        setCurrency(c => c + amount);
        setSessionCurrency(game.sessionCurrency); // Sync with React state
        if (soundRef.current) soundRef.current.playCollect();
        game.floatingTexts.push({
          x: col.x,
          y: col.y,
          text: `+${amount.toLocaleString()}`,
          color: '#ffd369',
          life: 1.0
        });
      }
    });

    // Fuel
    game.fuels.forEach(fuel => {
      if (
        !fuel.markedForDeletion &&
        pRect.x < fuel.x + fuel.width &&
        pRect.x + pRect.w > fuel.x &&
        pRect.y < fuel.y + fuel.height &&
        pRect.y + pRect.h > fuel.y
      ) {
        refillFuel(game, fuel, flightInputRef.current.sources.size > 0);
        game.floatingTexts.push({
          x: fuel.x,
          y: fuel.y,
          text: 'FUEL FULL',
          color: fuel.color,
          life: 1.0
        });

        setEnergy(100);
        if (soundRef.current) soundRef.current.playCollect();
      }
    });

    // Medical packs restore health without affecting rewards or power-up timers.
    game.healthPickups.forEach(pickup => {
      if (
        pRect.x < pickup.x + pickup.width &&
        pRect.x + pRect.w > pickup.x &&
        pRect.y < pickup.y + pickup.height &&
        pRect.y + pRect.h > pickup.y
      ) {
        const restored = collectHealth(game, pickup);
        if (!restored) return;
        setHealth(game.health);
        if (soundRef.current) soundRef.current.playCollect();
        game.floatingTexts.push({
          x: pickup.x, y: pickup.y,
          text: `+${Number(restored.toFixed(1))} HP`,
          color: '#8ae6b0', life: 1.2
        });
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

        // Handle all power-ups as timed effects
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
        game.powerUpUiSignature = game.activePowerUps.map(item => `${item.type}:${Math.ceil(item.remainingTime)}`).join('|');

        // Show floating text
        game.floatingTexts.push({
          x: powerUp.x,
          y: powerUp.y,
          text: `+ ${powerUp.getName()} !`,
          color: powerUp.color,
          life: 1.5
        });

        if (soundRef.current) soundRef.current.playCollect();
      }
    });

    // Projectiles (Villain)
    for (const proj of game.projectiles) {
      if (
        pRect.x < proj.x + proj.radius &&
        pRect.x + pRect.w > proj.x - proj.radius &&
        pRect.y < proj.y + proj.radius &&
        pRect.y + pRect.h > proj.y - proj.radius
      ) {
        if (!takeProjectileHit(game, proj)) continue;
        setHealth(game.health);
        rendererRef.current?.emitBurst(p.x + 20, p.y, '#ff1744', 20, 260);
        if (soundRef.current) soundRef.current.playExplosion();
        game.floatingTexts.push({
          x: p.x,
          y: p.y,
          text: `-${ENEMY_HIT_DAMAGE} HP`,
          color: '#ffa1b1',
          life: 1.0
        });

        if (game.health <= 0) {
          handleGameOver();
          return;
        }
      }
    }

    // Player Projectiles vs Villain
    if (game.villain) {
      const v = game.villain;
      const hitEnemy = damage => {
        const died = v.takeDamage(damage); // Use weapon damage
        if (died) {
          if (soundRef.current) soundRef.current.playExplosion();
          game.floatingTexts.push({
            x: v.x,
            y: v.y,
            text: 'BOSS DEFEATED!',
            color: '#ffa1b1',
            life: 2.0
          });
          game.floatingTexts.push({
            x: v.x,
            y: v.y + 30,
            text: `+${BOSS_REWARD.toLocaleString()} credits`,
            color: '#ffd700', // Gold color
            life: 2.0
          });
          setCurrency(c => c + BOSS_REWARD); // Bonus for killing boss
          game.sessionCurrency = (game.sessionCurrency || 0) + BOSS_REWARD; // Add boss bonus to session currency
          game.bossesDefeated = (game.bossesDefeated || 0) + 1;
          rendererRef.current?.emitBurst(v.x + v.width / 2, v.y + v.height / 2, '#ff2d95', 42, 360);
          setSessionCurrency(game.sessionCurrency); // Sync with React state
        } else {
          if (soundRef.current) soundRef.current.playShoot(); // Hit sound
        }
      };
      game.playerProjectiles.forEach(proj => {
        if (v.markedForDeletion || proj.markedForDeletion) return;
        if (
          proj.x < v.x + v.width &&
          proj.x + 15 > v.x &&
          proj.y < v.y + v.height &&
          proj.y + 4 > v.y
        ) {
          proj.markedForDeletion = true;
          hitEnemy(proj.damage || 10);
        }
      });
    }
  }, [handleGameOver]);

  const update = React.useCallback((deltaTime) => {
    const game = gameRef.current;
    if (game.gameOver) return;
    const previousPhase = game.phase;
    const simulate = advanceFlightStart(game, deltaTime, flightInputRef.current.sources.size > 0);
    constrainFlightPlayer(game, window.innerWidth);
    if (game.phase !== previousPhase) {
      setFlightPhase(game.phase);
      if (game.phase === 'FLYING') setTutorialBoosted(true);
    }
    if (!simulate) return;
    // Advance the capsule before the vehicle so pickup and protection start in this frame.
    if (advanceTransformationCapsule(game, transformationWorldDelta(game, deltaTime), window.innerWidth, window.innerHeight)) {
      setTransformationView(transformationHud(game));
    }
    const realDelta = deltaTime;
    const worldDelta = transformationWorldDelta(game, realDelta);
    game.worldTimeScale = realDelta > 0 ? worldDelta / realDelta : 1;
    if (game.transformation) {
      const previousTransformationPhase = game.transformation.phase;
      const result = advanceTransformation(game, realDelta, window.innerWidth, window.innerHeight,
        flightInputRef.current.sources.size > 0);
      for (const cue of result.cues) soundRef.current?.playTransformationCue(game.transformation?.id, cue);
      game.transformationUiTimer = (game.transformationUiTimer || 0) + realDelta;
      if (result.exited || previousTransformationPhase !== game.transformation?.phase || game.transformationUiTimer >= .05) {
        setTransformationView(transformationHud(game));
        setDistance(game.distance);
        setCombo(game.combo);
        game.transformationUiTimer = 0;
      }
      if (previousTransformationPhase !== 'EXITING' && game.transformation?.phase === 'EXITING') {
        if (game.transformation.exitReason === 'collision') soundRef.current?.playExplosion();
        else soundRef.current?.playCollect();
      }
    }
    // One world delta drives scenery, enemies, projectiles, spawns, rewards and resource clocks.
    deltaTime = worldDelta;
    game.transformationSafety = Math.max(0, (game.transformationSafety || 0) - deltaTime);
    advanceHitProtection(game, deltaTime);

    // Update Player
    if (!game.transformation) game.player.update(deltaTime);
    constrainFlightPlayer(game, window.innerWidth);

    // Update Speed & Distance
    game.speed += deltaTime * 10; // Accelerate over time
    game.distance += game.speed * deltaTime / 10; // 10x faster distance accumulation (approx 30m/s)

    // Throttle UI updates to ~10fps (every 100ms) to prevent React render overload
    game.uiTimer = (game.uiTimer || 0) + deltaTime;
    if (game.uiTimer > 0.1) {
      setDistance(game.distance);
      setHealth(game.health);
      game.uiTimer = 0;
    }

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

    if (game.comboTimer > 0) {
      game.comboTimer -= deltaTime;
      if (game.comboTimer <= 0 && game.combo > 0) {
        game.combo = 0;
        setCombo(0);
      }
    }

    // Health Regeneration (Shield Generator)
    if (game.health < game.maxHealth && game.regenRate > 0) {
      game.health += game.regenRate * deltaTime;
      if (game.health > game.maxHealth) game.health = game.maxHealth;
    }

    // Spawn Obstacles
    if (Math.random() < frameChance(0.02, deltaTime)) {
      const h = Math.random() * 60 + 40; // Smaller obstacles (40-100 instead of 50-150)
      const y = Math.random() > 0.5 ? 0 : window.innerHeight - h; // Top or Bottom
      game.obstacles.push(new Obstacle(window.innerWidth, y, 50, h));
    }

    // Spawn Fuel (Less common)
    if (Math.random() < frameChance(0.01, deltaTime)) { // Calibrated to the original 60fps rate
      const y = Math.random() * (window.innerHeight - 100) + 50;
      game.fuels.push(new Fuel(window.innerWidth, y));
    }

    // A single medical pack can appear every 12 seconds of active flight.
    if (advanceHealthPickupSpawn(game, deltaTime)) {
      const y = window.innerHeight * (.4 + Math.random() * .2) - 16;
      game.healthPickups.push(new HealthPickup(window.innerWidth, y));
    }

    // Spawn Power-Ups (Rare)
    if (Math.random() < frameChance(0.003, deltaTime)) {
      const y = Math.random() * (window.innerHeight - 100) + 50;
      game.powerUps.push(new PowerUp(window.innerWidth, y));
    }

    // Spawn Villain
    const villainChance = game.villainChance || 0.005;
    if (!game.villain && game.distance > 500 && Math.random() < frameChance(villainChance, deltaTime)) {
      const rand = Math.random();
      if (rand < 0.4) {
        game.villain = new Villain(window.innerWidth, window.innerHeight / 2);
      } else if (rand < 0.7) {
        game.villain = new SpeedsterVillain(window.innerWidth, window.innerHeight / 2);
      } else {
        game.villain = new JuggernautVillain(window.innerWidth, window.innerHeight / 2);
      }

    }

    // Update Entities (apply time slow if active)
    const effectiveSpeed = game.speed;
    game.obstacles.forEach(obs => obs.update(deltaTime, effectiveSpeed));
    game.collectibles.forEach(col => col.update(deltaTime, effectiveSpeed));
    game.collectibles.push(...advanceCoinTrails(game.coinTrails, effectiveSpeed * deltaTime,
      window.innerWidth, window.innerHeight, game.obstacles));
    game.fuels.forEach(fuel => fuel.update(deltaTime, effectiveSpeed));
    game.healthPickups.forEach(pickup => pickup.update(deltaTime, effectiveSpeed));
    game.powerUps.forEach(powerUp => powerUp.update(deltaTime, effectiveSpeed));

    if (game.villain) {
      game.villain.update(deltaTime, game.player.y, game.playerProjectiles);

      if (game.villain.markedForDeletion) {
        game.villain = null;
      } else {
        // Villain Attack Logic
        if (game.villain && game.villain.state === 'ATTACKING') {
          if (game.villain.type === 'SPEEDSTER') {
            if (game.villain.attackTimer > 2.0) {
              game.villain.attackTimer = 0;
              // SONIC BLADE WAVE (Fast, crescent projectiles)
              game.projectiles.push(new SonicBladeProjectile(game.villain.x, game.villain.y + 20, -800, 0));      // Straight
              game.projectiles.push(new SonicBladeProjectile(game.villain.x, game.villain.y + 20, -750, -200));   // Up-Angled
              game.projectiles.push(new SonicBladeProjectile(game.villain.x, game.villain.y + 20, -750, 200));    // Down-Angled
              if (soundRef.current) soundRef.current.playShoot();
            }
          } else if (game.villain.type === 'JUGGERNAUT') {
            if (game.villain.attackTimer > 3.5) { // Slower fire rate (was 2.0, now 3.5 seconds)
              game.villain.attackTimer = 0;
              // FUSE BOMB (Straight shot, no homing)
              game.projectiles.push(new FuseProjectile(
                game.villain.x,
                game.villain.y
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
    game.healthPickups = game.healthPickups.filter(pickup => !pickup.markedForDeletion);
    game.projectiles = game.projectiles.filter(proj => !proj.markedForDeletion);
    game.playerProjectiles = game.playerProjectiles.filter(proj => !proj.markedForDeletion);
    game.powerUps = game.powerUps.filter(powerUp => !powerUp.markedForDeletion);

    // Update Active Power-Ups timers
    game.activePowerUps.forEach(powerUp => {
      powerUp.remainingTime -= deltaTime;
    });
    game.activePowerUps = game.activePowerUps.filter(p => p.remainingTime > 0);
    game.powerUpUiTimer = (game.powerUpUiTimer || 0) + deltaTime;
    if (game.powerUpUiTimer >= 0.1) {
      const signature = game.activePowerUps.map(item => `${item.type}:${Math.ceil(item.remainingTime)}`).join('|');
      if (signature !== game.powerUpUiSignature) {
        game.powerUpUiSignature = signature;
        setActivePowerUps([...game.activePowerUps]);
      }
      game.powerUpUiTimer = 0;
    }

    // Apply Active Power-Up Effects
    game.currencyMultiplier = coinMultiplier(upgradesRef.current.multiplier || 1);
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

    // Energy Drain if boosting
    if (!game.transformation && game.player.isBoosting) {
      game.energy -= deltaTime * 10; // Reduced from 20 to 10 for longer flight
      if (game.energy <= 0) {
        game.energy = 0;
        game.player.boost(false);
      }
    }

    // Refills happen after consumption, leaving the tank exactly full this frame.
    checkCollisions(game, deltaTime);
    if (game.gameOver) return;

    // Neon Blaze Aura Logic
    if (game.activePowerUps.some(p => p.type === 'NEON_BLAZE')) {
      const auraRadius = 150;
      const p = game.player;

      // Destroy Obstacles
      game.obstacles.forEach(obs => {
        if (obs.markedForDeletion) return;
        const dx = (obs.x + obs.width / 2) - p.x;
        const dy = (obs.y + obs.height / 2) - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < auraRadius) {
          obs.markedForDeletion = true;
          if (soundRef.current) soundRef.current.playExplosion();
          game.floatingTexts.push({
            x: obs.x,
            y: obs.y,
            text: 'BLAZED!',
            color: '#ff00ff',
            life: 0.5
          });
        }
      });

      // Destroy Enemy Projectiles
      game.projectiles.forEach(proj => {
        if (proj.markedForDeletion) return;
        const dx = proj.x - p.x;
        const dy = proj.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < auraRadius) {
          proj.markedForDeletion = true;
          // Silent destruction for projectiles
        }
      });

      // Damage Villain
      if (game.villain && !game.villain.markedForDeletion) {
        const v = game.villain;
        const dx = (v.x + v.width / 2) - p.x;
        const dy = (v.y + v.height / 2) - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < auraRadius) {
          // Apply damage over time (approx 30 DPS)
          const damage = 30 * deltaTime;
          const died = v.takeDamage(damage);
          if (died) {
            if (soundRef.current) soundRef.current.playExplosion();
            game.floatingTexts.push({
              x: v.x,
              y: v.y,
              text: 'BOSS DEFEATED!',
              color: '#ffa1b1',
              life: 2.0
            });
            game.floatingTexts.push({
              x: v.x,
              y: v.y + 30,
              text: `+${BOSS_REWARD.toLocaleString()} credits`,
              color: '#ffd700',
              life: 2.0
            });
            setCurrency(c => c + BOSS_REWARD);
            game.sessionCurrency = (game.sessionCurrency || 0) + BOSS_REWARD;
            setSessionCurrency(game.sessionCurrency);
            game.bossesDefeated = (game.bossesDefeated || 0) + 1;
            rendererRef.current?.emitBurst(v.x + v.width / 2, v.y + v.height / 2, '#ff2d95', 42, 360);
          }
        }
      }
    }

    syncEncounterMusic(game, soundRef.current);

    // Keep the HUD responsive without forcing a React render every animation frame.
    game.energyUiTimer = (game.energyUiTimer || 0) + deltaTime;
    if (game.energyUiTimer >= 0.1) {
      setEnergy(Math.max(0, Math.min(100, (game.energy / game.maxEnergy) * 100)));
      game.energyUiTimer = 0;
    }
  }, [checkCollisions]);

  const draw = React.useCallback((deltaTime) => {
    const renderer = rendererRef.current;
    const game = gameRef.current;
    if (!renderer) return;

    renderer.drawScene(game, deltaTime);
  }, []);

  // Initialize Loop
  useEffect(() => {
    loopRef.current = new GameLoop(update, draw);
    return () => {
      if (loopRef.current) loopRef.current.stop();
    };
  }, [update, draw]);

  const handleInputStart = React.useCallback((event) => {
    if (gameState !== 'PLAYING') return;
    if (event.pointerId !== undefined && event.button !== 0) return;
    event.preventDefault();
    const source = event.pointerId !== undefined ? `pointer:${event.pointerId}` : `key:${event.code}`;
    if (event.pointerId !== undefined) event.currentTarget.setPointerCapture(event.pointerId);
    const game = gameRef.current;
    flightInputRef.current.press(source);
    if (takeFlightControl(game, true)) {
      setFlightPhase('FLYING');
      if (game.transformation) transformationPrimary(game);
    }
    constrainFlightPlayer(game, window.innerWidth);
    if (game.phase === 'FLYING') setTutorialBoosted(true);
  }, [gameState]);

  const handleInputEnd = React.useCallback((event) => {
    const source = event.pointerId !== undefined ? `pointer:${event.pointerId}` : `key:${event.code}`;
    flightInputRef.current.release(source);
  }, []);

  const pauseGame = React.useCallback(() => {
    if (!pauseFlight(gameRef.current)) return;
    flightInputRef.current.reset();
    loopRef.current?.stop();
    setGameState('PAUSED');
  }, []);

  const resumeGame = () => {
    const game = gameRef.current;
    resumeFlight(game);
    constrainFlightPlayer(game, window.innerWidth);
    setFlightPhase(game.phase);
    if (game.phase === 'COUNTDOWN') {
      setCountdown(3);
      setGameState('COUNTDOWN');
      return;
    }
    setGameState('PLAYING');
    syncEncounterMusic(game, soundRef.current, { allowEntrance: false });
    loopRef.current?.start();
  };

  useEffect(() => {
    if (gameState !== 'PLAYING') flightInputRef.current.reset();
    if (!['PLAYING', 'PAUSED', 'COUNTDOWN'].includes(gameState)) {
      gameRef.current.phase = 'ENDED';
      loopRef.current?.stop();
    }
  }, [gameState]);

  const handleShoot = React.useCallback(() => {
    if (gameRef.current.transformation) {
      if (transformationSecondary(gameRef.current)) {
        setTransformationView(transformationHud(gameRef.current));
        soundRef.current?.playShoot();
      }
      return;
    }
    const hasUnlimitedAmmo = gameRef.current.rapidFire;

    if (gameState === 'PLAYING' && gameRef.current.phase === 'FLYING' && (gameRef.current.ammo > 0 || hasUnlimitedAmmo)) {
      // Only decrease ammo if not in unlimited mode
      if (!hasUnlimitedAmmo) {
        gameRef.current.ammo--;
        setAmmo(gameRef.current.ammo);
      }

      gameRef.current.playerProjectiles.push(new PlayerProjectile(
        gameRef.current.player.x + 50,
        gameRef.current.player.y + 25,
        gameRef.current.weaponType,
        gameRef.current.cosmeticId
      ));

      setTutorialFired(true);
      if (soundRef.current) {
        soundRef.current.playShoot();
      }
    }
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!['PLAYING', 'COUNTDOWN'].includes(gameState) || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (event.code === 'Space' && event.target.closest?.('button, a')) return;
      if (['Space', 'ArrowUp', 'ShiftLeft', 'ShiftRight', 'Escape'].includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (event.code === 'Space' || event.code === 'ArrowUp') handleInputStart(event);
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') handleShoot();
      if (event.code === 'Escape') pauseGame();
    };
    const handleKeyUp = event => handleInputEnd(event);
    const releaseInputs = () => flightInputRef.current.reset();
    const onVisibility = () => {
      if (document.hidden) {
        releaseInputs();
        pauseGame();
        soundRef.current?.stopMusic();
      } else {
        void refreshStorePurchases().catch(error => trackMonetizationEvent('store_delivery_retry_needed', { message: error.message }));
        if (['MENU', 'SHOP', 'CAREER'].includes(gameState)) void soundRef.current?.startMenuMusic();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', releaseInputs);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', releaseInputs);
      document.removeEventListener('visibilitychange', onVisibility);
      releaseInputs();
    };
  }, [gameState, handleInputStart, handleInputEnd, handleShoot, pauseGame]);

  const buyUpgrade = (id, cost, type = 'upgrade') => {
    if (type === 'cosmetic') {
      const productId = `cosmetic_${id}`;
      if (pendingProducts.includes(productId)) return;
      try {
        unlockCreditCosmetic(id);
        setOwnedCosmetics(safeCosmeticOwnership());
        setEquippedCosmetic(id);
      } catch (error) {
        setPurchaseMessage(error.message || 'Could not unlock this cosmetic.');
      }
      return;
    }
    if (type === 'upgrade' && id === 'multiplier' && (upgradesRef.current.multiplier || 1) >= MULTIPLIER_MAX_LEVEL) return;
    const currentBalance = loadWallet();
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
    } else if (type === 'cosmetic') {
      if (!id || ownedCosmetics[id]) setEquippedCosmetic(id);
    }
  };

  const syncPurchaseUnlocks = React.useCallback((change) => {
    const restored = getPurchases();
    if (restored.starter_pack) {
      setOwnedShips(items => items.includes('interceptor') ? items : [...items, 'interceptor']);
      setOwnedWeapons(items => items.includes('blaster') ? items : [...items, 'blaster']);
    }
    setPurchases(restored);
    const cosmetics = safeCosmeticOwnership();
    setOwnedCosmetics(cosmetics);
    if (equippedCosmetic && !cosmetics[equippedCosmetic]) setEquippedCosmetic('');
    setPendingProducts(getPendingCosmeticProducts());
    if (change?.type === 'delivery' && change.applied) setPurchaseMessage('Purchase delivered. Your items are ready!');
  }, [equippedCosmetic]);

  useEffect(() => subscribeStore(syncPurchaseUnlocks), [syncPurchaseUnlocks]);

  const handlePremiumPurchase = async (productId) => {
    setBusyProduct(productId);
    setPurchaseMessage('');
    try {
      const product = await purchaseProduct(productId);
      if (product.status === 'cancelled') { setPurchaseMessage('Purchase cancelled.'); return; }
      if (product.status === 'pending') {
        setPendingProducts(getPendingCosmeticProducts());
        setPurchaseMessage('Awaiting store approval. Keep the app installed; delivery will resume automatically when approved.');
        return;
      }
      setPendingProducts(getPendingCosmeticProducts());
      syncPurchaseUnlocks();
      if (product.id === 'starter_pack' && product.status === 'purchased') {
        setEquippedShip('interceptor');
        setEquippedWeapon('blaster');
      }
      setPurchaseMessage('Purchase complete. Thank you for supporting Neo Glide!');
    } catch (error) {
      setPurchaseMessage(error.message || 'Purchase failed. Please try again.');
    } finally {
      setBusyProduct(null);
    }
  };

  const handleRestorePurchases = async () => {
    setBusyProduct('restore');
    setPurchaseMessage('');
    try {
      const restored = await restorePurchases();
      setPurchases(restored);
      setOwnedCosmetics(safeCosmeticOwnership());
      if (restored.starter_pack) {
        setOwnedShips(items => items.includes('interceptor') ? items : [...items, 'interceptor']);
        setOwnedWeapons(items => items.includes('blaster') ? items : [...items, 'blaster']);
      }
      setPurchaseMessage('Purchases restored.');
    } catch (error) {
      setPurchaseMessage(error.message || 'Could not restore purchases.');
    } finally {
      setBusyProduct(null);
    }
  };

  const handleRewardContinue = async () => {
    const game = gameRef.current;
    if (continueUsed || rewardOperationRef.current || game.phase !== 'ENDED') return;
    const request = { token: runTokenRef.current, game };
    rewardOperationRef.current = request;
    setRewardBusy(true);
    setRewardAction('continue');
    setRewardMessage('');
    const isCurrent = () => rewardOperationRef.current === request && request.token === runTokenRef.current && game === gameRef.current && game.phase === 'ENDED';
    try {
      if (await showRewardedAd('game_over_continue')) {
        if (!isCurrent()) return;
        flightInputRef.current.reset();
        resetTransformations(game);
        setTransformationView(null);
        game.phase = 'COUNTDOWN';
        game.gameOver = false;
        game.health = Math.max(1, Math.ceil(game.maxHealth * 0.5));
        game.hitProtection = HIT_PROTECTION_SECONDS;
        game.energy = Math.max(game.energy, game.maxEnergy * 0.5);
        game.projectiles = [];
        game.obstacles = game.obstacles.filter(obs => obs.x > game.player.x + 160);
        game.player.y = window.innerHeight / 2;
        game.player.velocity = 0;
        constrainFlightPlayer(game, window.innerWidth);
        setHealth(game.health);
        setEnergy((game.energy / game.maxEnergy) * 100);
        setContinueUsed(true);
        setCountdown(3);
        setGameState('COUNTDOWN');
      } else if (isCurrent()) {
        setRewardMessage('Ad closed before the reward. You can try again.');
      }
    } catch (error) {
      if (isCurrent()) setRewardMessage(error.message || 'Rewarded ad is unavailable. Please try again.');
    } finally {
      if (rewardOperationRef.current === request) {
        rewardOperationRef.current = null;
        if (request.token === runTokenRef.current) { setRewardBusy(false); setRewardAction(null); }
      }
    }
  };

  const handleBoostEarnings = async () => {
    const game = gameRef.current;
    if (rewardOperationRef.current || game.phase !== 'ENDED' || game.earningsBonusClaimed || game.sessionCurrency <= 0) return;
    const snapshot = game.sessionCurrency;
    const request = { token: runTokenRef.current, game };
    rewardOperationRef.current = request;
    setRewardBusy(true);
    setRewardAction('earnings');
    setRewardMessage('');
    const isCurrent = () => rewardOperationRef.current === request && request.token === runTokenRef.current && game === gameRef.current && game.phase === 'ENDED';
    try {
      const rewarded = await showRewardedAd('double_flight_credits');
      if (!isCurrent()) return;
      if (rewarded) {
        const bonus = claimEarningsBonus(game, snapshot);
        if (bonus > 0) {
          setCurrency(value => value + bonus);
          setEarningsBonus(bonus);
          setEarningsBonusClaimed(true);
          setRewardMessage(`Bonus added: +${bonus.toLocaleString()} credits.`);
        }
      } else setRewardMessage('Ad closed before the reward. Your flight credits are safe; you can try again.');
    } catch (error) {
      if (isCurrent()) setRewardMessage(error.message || 'Rewarded ad is unavailable. Please try again.');
    } finally {
      if (rewardOperationRef.current === request) {
        rewardOperationRef.current = null;
        if (request.token === runTokenRef.current) { setRewardBusy(false); setRewardAction(null); }
      }
    }
  };

  const handleAdPrivacyChoices = async () => {
    if (adPrivacyBusy) return;
    setAdPrivacyBusy(true);
    setAdPrivacyMessage('');
    try {
      const result = await showAdPrivacyOptions();
      setAdPrivacyAvailable(result.required);
      if (!result.required) setAdPrivacyMessage('Privacy choices are not currently required.');
    } catch (error) {
      setAdPrivacyMessage(error.message || 'Could not open privacy choices. Please try again.');
    } finally {
      setAdPrivacyBusy(false);
    }
  };

  const handleClaimMission = (missionId) => {
    const result = claimMission(profileRef.current, missionId);
    if (!result) return;
    profileRef.current = result.profile;
    setProfile(result.profile);
    setCurrency(value => value + result.reward);
    trackMonetizationEvent('career_reward_claimed', { missionId, reward: result.reward });
  };

  const leaveRun = (screen) => {
    runTokenRef.current++;
    gameRef.current.phase = 'ENDED';
    flightInputRef.current.reset();
    loopRef.current?.stop();
    resetTransformations(gameRef.current);
    setTransformationView(null);
    setGameState(screen);
  };

  return (
    <div className="game-shell">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Flight playfield — hold to boost" onPointerDown={handleInputStart} onPointerUp={handleInputEnd} onPointerCancel={handleInputEnd} onLostPointerCapture={handleInputEnd}/>
      {['PLAYING', 'COUNTDOWN', 'PAUSED'].includes(gameState) && (
        <HUD distance={distance} currency={sessionCurrency} energy={energy} ammo={ammo} maxAmmo={10}
          activePowerUps={activePowerUps} health={health} maxHealth={maxHealth} combo={combo} transformation={transformationView}
          onShoot={handleShoot} onBoostStart={handleInputStart} onBoostEnd={handleInputEnd}
          onPause={pauseGame} flightPhase={flightPhase} paused={gameState === 'PAUSED'} countdown={gameState === 'COUNTDOWN' ? countdown : null}/>
      )}
      {gameState === 'PAUSED' && <section className="screen-overlay pause-overlay" aria-label="Flight paused"><div className="pause-board"><span className="eyebrow">TAKE A BREATHER</span><h2>Flight paused</h2><p>Your next adventure can wait a moment.</p><button className="arcade-button primary" onClick={resumeGame}><Play size={22} fill="currentColor"/>Keep flying</button><button className="arcade-button secondary" onClick={() => { handleGameOver(); leaveRun('MENU'); }}><Home size={20}/>Back to home</button></div></section>}

      {gameState === 'MENU' && <HomeScreen stageId={equippedStage} onGalaxies={() => { setShopInitialTab('stages'); setGameState('SHOP'); }} profile={profile} currency={currency} ship={equippedShip} cosmeticId={equippedCosmetic} upgrades={upgrades}
        audioPreferences={audioPreferences} onAudioPreferenceChange={(key, value) => setAudioPreferences(current => ({ ...current, [key]: value }))}
        onPlay={() => startGame()} onGarage={() => { setShopInitialTab('upgrades'); setGameState('SHOP'); }} onCareer={() => setGameState('CAREER')}
        onHelp={replayTutorial} adPrivacyAvailable={adPrivacyAvailable} adPrivacyBusy={adPrivacyBusy}
        adPrivacyMessage={adPrivacyMessage} onPrivacy={handleAdPrivacyChoices}/>}

      {gameState === 'GAMEOVER' && <RunResults distance={distance} bestDistance={profile.bestDistance} isNewBest={newBest}
        coins={sessionCurrency} distanceBonus={distanceBonus} xp={lastRunXp} onRetry={() => startGame()} onHome={() => leaveRun('MENU')}
        onGarage={() => leaveRun('SHOP')} onContinue={handleRewardContinue} continueUsed={continueUsed}
        rewardBusy={rewardBusy} rewardAction={rewardAction} rewardMessage={rewardMessage}
        onBoostEarnings={handleBoostEarnings} earningsBonus={earningsBonus} earningsBonusClaimed={earningsBonusClaimed}
        levelBonus={levelBonus} wallet={currency} nextShip={SHIPS.find(model => !ownedShips.includes(model.id))}
        fleetComplete={SHIPS.every(model => ownedShips.includes(model.id))}/>}

      {gameState === 'PLAYING' && ['LAUNCH', 'READY'].includes(flightPhase) && (
        <div className={`launch-caption ${flightPhase === 'READY' ? 'launch-ready' : ''}`} role="status" aria-live="polite">
          <span className="eyebrow">{transformationView ? 'VEHICLE READY' : flightPhase === 'LAUNCH' ? 'HANGAR 01 / DEPARTURE' : 'ALL SYSTEMS READY'}</span>
          <strong>{transformationView ? transformationView.name : flightPhase === 'LAUNCH' ? 'Let’s glide.' : 'You’re the pilot.'}</strong>
          <span>{transformationView ? `Tap ${transformationView.primary} or SPACE to continue.` : flightPhase === 'LAUNCH' ? 'Engines on. Adventure ahead.' : 'Hold BOOST or SPACE to take off.'}</span>
        </div>
      )}

      {tutorialActive && gameState === 'PLAYING' && flightPhase === 'FLYING' && (
        <Tutorial
          boosted={tutorialBoosted}
          fired={tutorialFired}
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialSkip}
        />
      )}

      {gameState === 'SHOP' && (
        <Shop
          initialTab={shopInitialTab}
          equippedStage={equippedStage}
          stageOwnership={getStageOwnership()}
          onStageUnlock={unlockCreditStage}
          onStageEquip={equipStage}
          currency={currency}
          upgrades={upgrades}
          pilotLevel={profile.level}
          ownedShips={ownedShips}
          equippedShip={equippedShip}
          ownedWeapons={ownedWeapons}
          equippedWeapon={equippedWeapon}
          cosmetics={COSMETICS}
          ownedCosmetics={ownedCosmetics}
          equippedCosmetic={equippedCosmetic}
          pendingProducts={pendingProducts}
          purchases={purchases}
          busyProduct={busyProduct}
          purchaseMessage={purchaseMessage}
          onBuy={buyUpgrade}
          onEquip={equipItem}
          onPurchase={handlePremiumPurchase}
          onRestore={handleRestorePurchases}
          onClose={() => setGameState('MENU')}
        />
      )}

      {gameState === 'CAREER' && (
        <Career profile={profile} onClaim={handleClaimMission} onClose={() => setGameState('MENU')} />
      )}

      {gameState === 'UPDATE_REQUIRED' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-6 text-center">
          <div className="max-w-md rounded-2xl border border-cyan-400/50 bg-gray-950 p-8 shadow-[0_0_40px_rgba(34,211,238,0.25)]">
            <h2 className="text-3xl font-black text-cyan-300">UPDATE REQUIRED</h2>
            <p className="mt-4 text-gray-300">A new Neo Glide version is required to continue.</p>
            <button
              onClick={() => {
                const url = /android/i.test(navigator.userAgent) ? window.storeUrls?.android : window.storeUrls?.ios;
                if (url && !url.includes('YOUR_APP_ID')) window.location.href = url;
              }}
              className="mt-6 w-full rounded-lg bg-cyan-400 px-5 py-4 font-black text-black"
            >
              OPEN STORE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
