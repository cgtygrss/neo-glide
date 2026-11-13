import { APP_VERSION } from './version.js';
import { flightEquipment, getShipTraits, advanceEquipmentEnergy } from './game/FlightEquipment';
import { UPGRADES, WEAPONS, upgradeOffer } from './game/ShopCatalog';
import Events from './components/Events';
import { setAccountLocked, syncAccount, startAccount, accountSnapshot } from './account/AccountService';
import { beginEventFlight, queueEventFlight, refreshEvents } from './services/EventsService';
import { profileStorage } from './account/ProfileStorage.js';
import React, { useEffect, useRef, useState } from 'react';
import { GameLoop } from './game/GameLoop';
import { Renderer } from './game/Renderer';
import { SoundManager } from './game/SoundManager';
import { LEVEL_REWARD, claimDistanceCredits, loadWallet, updateWallet as setCurrency, subscribeWallet, getEquippedStage, getStageOwnership, equipStage, unlockCreditStage, distanceAdReward, claimDistanceAdBonus, coinMultiplier, MULTIPLIER_MAX_LEVEL, getCosmeticOwnership, getPendingCosmeticProducts, unlockCreditCosmetic } from './game/Economy';
import { SHIPS } from './game/ShipCatalog';
import { ALL_APPEARANCES, COSMETICS, getCosmetic } from './game/CosmeticsCatalog';
import { loadSoundPreferences, saveSoundPreferences } from './game/SoundPreferences';
import {
  Player, Fuel,
  PowerUp, HealthPickup
} from './game/Entities';
import HUD from './components/HUD';
import Shop from './components/Shop';
import Tutorial from './components/Tutorial';
import Career from './components/Career';
import { Home, Play } from 'lucide-react';
import HomeScreen from './components/HomeScreen';
import LegalPanel from './privacy/LegalPanel.jsx';
import { onlineServicesAllowed } from './privacy/AudiencePolicy.js';
import RunResults from './components/RunResults';
import AudioControls from './components/AudioControls';
import { createCoinTrailState, advanceCoinTrails, collectCoin } from './game/CoinTrails';
import { syncEncounterMusic } from './game/EncounterMusic';
import { BASE_HEALTH, maxHullHealth, advanceHitProtection, takeProjectileHit, collectHealth, advanceHealthPickupSpawn, obstacleImpact, touchesFlightBoundary } from './game/PlayerHealth';
import { FlightInput } from './game/FlightInput';
import { flightViewport, fitFlightViewport, flightScrollSpeed } from './game/FlightViewport.js';
import { constrainFlightPlayer } from './game/FlightBounds';
import { obstacleCollisionBounds, touchesObstacle } from './game/ObstacleCollision';
import { START_SPEED, advanceFlightPace, advanceHazardSpawns, flightEnemies, positionEnemyLanes, advanceEnemyAttacks, createEnemyVolley } from './game/FlightDifficulty';
import { prepareLaunch, advanceFlightStart, takeFlightControl, prepareFlightReady, pauseFlight, resumeFlight, refillFuel } from './game/FlightStart';
import { getPurchases, initializeMonetization, purchaseProduct, restorePurchases, refreshStorePurchases, subscribeStore, showRewardedAd, trackMonetizationEvent } from './services/MonetizationService';
import { subscribeAdAudio, recoverAdAudioOnForeground } from './services/AdAudioRecovery';
import { claimMission, loadProfile, recordRun, updatePilotName } from './services/ProgressionService';
import { isAdPrivacyOptionsRequired, showAdPrivacyOptions } from './services/AdMobService';
import './NavigationMotion.css';
import './components/ResponsiveFlight.css';
import { transformationProtected, absorbTransformationHit, transformationHitbox, advanceTransformation, advanceTransformationCapsule, resetTransformations, resizeTransformation, transformationPrimary, transformationSecondary, transformationHud } from './game/Transformations';

import { transformationWorldDelta } from './game/TransformationCatalog';
import { advanceSupportDrop } from './game/SupportDrops';
import { hostileShotTouchesRect, nearestBeamPoint, isScout } from './game/ScoutAttack';
import { prepareRewardedContinue } from './game/RunLifecycle.js';
import { createEncounterDirector, advanceBossEncounter, encounterRestrictsSpawns, drainEncounterEvents, bossHud, abandonBossEncounter } from './game/BossEncounters.js';
import { advanceAmmoRecharge, damageEnemy, resolveFriendlyHits, drainCombatEvents, fireNormalWeapon } from './game/Combat.js';
import BossStatus from './components/BossStatus.jsx';

const cosmeticIds = new Set(ALL_APPEARANCES.map(cosmetic => cosmetic.id));
const menuMusicStates = new Set(['MENU', 'SHOP', 'CAREER', 'ACCOUNT', 'EVENTS', 'LEGAL']);
const safeCosmeticOwnership = () => {
  try { return getCosmeticOwnership(); } catch { return {}; }
};

export default function App({ startupComplete = true }) {
  const [gameState, setGameState] = useState('MENU'); // MENU, TUTORIAL, COUNTDOWN, PLAYING, GAMEOVER, SHOP
  const [legalDocument, setLegalDocument] = useState('privacy');
  // Results still own this flight and its optional rewards. Defer a late initial
  // account activation until the player leaves, so it cannot remount the app here.
  useEffect(() => {
    const flightOwnsAccount = ['PLAYING', 'COUNTDOWN', 'PAUSED', 'GAMEOVER'].includes(gameState);
    setAccountLocked(flightOwnsAccount);
    if (!flightOwnsAccount) void syncAccount();
  }, [gameState]);
  const [audioPreferences, setAudioPreferences] = useState(loadSoundPreferences);
  const [showTutorialOnStart, setShowTutorialOnStart] = useState(() => {
    return profileStorage.getItem('neon_glide_learned_controls') !== 'true';
  });
  const [flightPhase, setFlightPhase] = useState('ENDED');
  const runTokenRef = useRef(0);
  const invalidateRun = React.useCallback(() => { runTokenRef.current++; }, []);
  const [countdown, setCountdown] = useState(3);
  const [distance, setDistance] = useState(0);
  const currency = React.useSyncExternalStore(subscribeWallet, loadWallet);
  const equippedStage = React.useSyncExternalStore(subscribeWallet, getEquippedStage);
  const [shopInitialTab, setShopInitialTab] = useState('featured');
  const [energy, setEnergy] = useState(100);
  const [ammo, setAmmo] = useState(10);
  const [maxAmmo, setMaxAmmo] = useState(10);
  const [health, setHealth] = useState(BASE_HEALTH);
  const [maxHealth, setMaxHealth] = useState(BASE_HEALTH);
  const [sessionCurrency, setSessionCurrency] = useState(0);
  const [distanceBonus, setDistanceBonus] = useState(0);
  const [purchases, setPurchases] = useState(getPurchases);
  const [ownedCosmetics, setOwnedCosmetics] = useState(safeCosmeticOwnership);
  const [equippedCosmetic, setEquippedCosmetic] = useState(() => {
    const id = profileStorage.getItem('neon_glide_equipped_cosmetic') || '';
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
      return JSON.parse(profileStorage.getItem('neon_glide_upgrades')) || {};
    } catch {
      return {};
    }
  });

  const [ownedShips, setOwnedShips] = useState(() => {
    try {
      const items = JSON.parse(profileStorage.getItem('neon_glide_owned_ships')) || ['default'];
      return getPurchases().starter_pack && !items.includes('interceptor') ? [...items, 'interceptor'] : items;
    } catch {
      return ['default'];
    }
  });

  const [equippedShip, setEquippedShip] = useState(() => {
    return profileStorage.getItem('neon_glide_equipped_ship') || 'default';
  });

  const [ownedWeapons, setOwnedWeapons] = useState(() => {
    try {
      const items = JSON.parse(profileStorage.getItem('neon_glide_owned_weapons')) || ['default'];
      return getPurchases().starter_pack && !items.includes('blaster') ? [...items, 'blaster'] : items;
    } catch {
      return ['default'];
    }
  });

  const [equippedWeapon, setEquippedWeapon] = useState(() => {
    return profileStorage.getItem('neon_glide_equipped_weapon') || 'default';
  });

  // Active power-ups state
  const [activePowerUps, setActivePowerUps] = useState([]);
  const [transformationView, setTransformationView] = useState(null);
  const [bossView, setBossView] = useState(null);

  // Refs for Game Loop
  const canvasRef = useRef(null);
  const flightStageRef = useRef(null);
  const viewportRef = useRef(flightViewport(window.innerWidth, window.innerHeight));
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
    speed: START_SPEED,
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
      if (active && ['LAUNCH', 'READY', 'FLYING'].includes(game.phase)
        && (game.transformation ? game.transformation.phase === 'ACTIVE' : game.energy > 0)) {
        soundRef.current?.playControlPress('boost');
      }
      if (game.transformation) {
        game.player.boost(false);
        if (active) transformationPrimary(game);
      } else game.player.boost(active && game.phase === 'FLYING' && game.energy > 0);
    });
    flightInputRef.current = input;
    return () => input.reset();
  }, []);

  useEffect(() => { const update = () => { setOwnedCosmetics(safeCosmeticOwnership()); setProfile(loadProfile()); };  window.addEventListener('neo-events-updated', update); return () => window.removeEventListener('neo-events-updated', update); }, []);

  useEffect(() => {
    const update = () => {
      const read = (key, fallback) => { try { return JSON.parse(profileStorage.getItem(key)) || fallback; } catch { return fallback; } };
      setProfile(loadProfile()); setOwnedCosmetics(safeCosmeticOwnership());
      setOwnedShips(read('neon_glide_owned_ships', ['default'])); setOwnedWeapons(read('neon_glide_owned_weapons', ['default']));
      setEquippedShip(profileStorage.getItem('neon_glide_equipped_ship') || 'default');
      setEquippedWeapon(profileStorage.getItem('neon_glide_equipped_weapon') || 'default');
      setEquippedCosmetic(profileStorage.getItem('neon_glide_equipped_cosmetic') || ''); setUpgrades(read('neon_glide_upgrades', {}));
    };
    window.addEventListener('neo-account-save-updated', update);
    return () => window.removeEventListener('neo-account-save-updated', update);
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
    const stopAdAudio = subscribeAdAudio(event => event.active
      ? soundRef.current?.beginAdAudio()
      : soundRef.current?.recoverAfterAd(event));
    const recoverForegroundAudio = () => { if (!document.hidden) recoverAdAudioOnForeground(); };
    window.addEventListener('focus', recoverForegroundAudio);
    document.addEventListener('visibilitychange', recoverForegroundAudio);

    // Initialize Renderer
    rendererRef.current = new Renderer(canvasRef.current);

    // Version Check
    const checkVersion = async () => {
      if (!onlineServicesAllowed()) return;
      try {
        const response = await fetch('https://raw.githubusercontent.com/cgtygrss/neo-glide/main/public/version.json');
        const data = await response.json();

        // Current app version (should match package.json)
        const currentVersion = APP_VERSION;

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

    // Handle Resize
    const handleResize = () => {
      const next = flightViewport(window.innerWidth, window.innerHeight);
      const game = gameRef.current;
      const aspectChanged = fitFlightViewport(game, next);
      viewportRef.current = next;
      const stage = flightStageRef.current;
      Object.assign(stage.style, { width: `${next.displayWidth}px`, height: `${next.displayHeight}px`, left: `${next.left}px`, top: `${next.top}px` });
      stage.dataset.worldWidth = next.width;
      stage.dataset.worldHeight = next.height;
      rendererRef.current.resize(next.width, next.height, { displayScale: next.scale });
      resizeTransformation(game, next.width, next.height);
      constrainFlightPlayer(game, next.width);
      // A changing aspect ratio must not turn a resize into an unseen collision.
      if (aspectChanged && pauseFlight(game)) {
        flightInputRef.current?.reset();
        loopRef.current?.stop();
        setGameState('PAUSED');
      }
      // Resizing clears the bitmap; repaint the frozen scene under pause/HUD.
      if (['LAUNCH', 'READY', 'FLYING', 'PAUSED', 'COUNTDOWN'].includes(game.phase)) rendererRef.current.drawScene(game, 0);
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // Resume AudioContext on user interaction
    const handleUserInteraction = () => {
      void soundRef.current?.unlock();
    };
    // Capture gestures before game controls can stop propagation.
    window.addEventListener('pointerdown', handleUserInteraction, true);
    window.addEventListener('click', handleUserInteraction, true);
    window.addEventListener('keydown', handleUserInteraction, true);
    window.addEventListener('touchstart', handleUserInteraction, true);

    return () => {
      invalidateRun();
      if (loopRef.current) loopRef.current.stop();
      stopAdAudio();
      window.removeEventListener('focus', recoverForegroundAudio);
      document.removeEventListener('visibilitychange', recoverForegroundAudio);
      if (soundRef.current) soundRef.current.cleanup();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointerdown', handleUserInteraction, true);
      window.removeEventListener('click', handleUserInteraction, true);
      window.removeEventListener('keydown', handleUserInteraction, true);
      window.removeEventListener('touchstart', handleUserInteraction, true);
    };
  }, [invalidateRun]);

  // User-facing store/privacy flows wait until the opening has revealed home.
  // Local account initialization and rendering continue underneath the intro.
  useEffect(() => {
    if (!startupComplete) return;
    let active = true, started = false;
    const initialize = () => {
      if (document.hidden || started) return;
      started = true;
      void startAccount().then(() => active ? initializeMonetization() : null).then(status => {
        if (active && status) setAdPrivacyAvailable(Boolean(status.privacyOptionsRequired || isAdPrivacyOptionsRequired()));
      }).catch(() => { /* Store/consent can retry through its existing entry points. */ });
    };
    initialize();
    document.addEventListener('visibilitychange', initialize);
    return () => { active = false; document.removeEventListener('visibilitychange', initialize); };
  }, [startupComplete]);

  useEffect(() => {
    soundRef.current?.setPreferences(audioPreferences);
    saveSoundPreferences(audioPreferences);
  }, [audioPreferences]);

  useEffect(() => {
    profileStorage.setItem('neon_glide_owned_ships', JSON.stringify(ownedShips));
  }, [ownedShips]);

  useEffect(() => {
    profileStorage.setItem('neon_glide_equipped_ship', equippedShip);
  }, [equippedShip]);

  useEffect(() => {
    profileStorage.setItem('neon_glide_owned_weapons', JSON.stringify(ownedWeapons));
  }, [ownedWeapons]);

  useEffect(() => {
    profileStorage.setItem('neon_glide_equipped_weapon', equippedWeapon);
  }, [equippedWeapon]);

  useEffect(() => {
    profileStorage.setItem('neon_glide_equipped_cosmetic', equippedCosmetic);
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
    profileStorage.setItem('neon_glide_upgrades', JSON.stringify(upgrades));
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
      constrainFlightPlayer(game, viewportRef.current.width);
      setFlightPhase(game.phase);
      setGameState('PLAYING');
      syncEncounterMusic(game, soundRef.current);
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
    if (!startupComplete || document.hidden) return;
    if (menuMusicStates.has(gameState) && soundRef.current) {
      soundRef.current.startMenuMusic();
    } else if (gameState !== 'PLAYING' && soundRef.current) {
      // Only stop music if not playing (for GAMEOVER state)
      soundRef.current.stopMusic();
    }
  }, [gameState, startupComplete]);

  const startGame = ({ forceTutorial = false } = {}) => {
    if(accountSnapshot().busy)return;
    abandonBossEncounter(gameRef.current);
    for (const event of drainEncounterEvents(gameRef.current)) trackMonetizationEvent(event.name, event.data);
    setBossView(null);
    setAccountLocked(true);
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
    const equipment = flightEquipment(currentUpgrades, equippedShipRef.current, pilotLevel);
    const maxEnergy = equipment.maxEnergy;

    // New Upgrades Logic
    const hullLvl = currentUpgrades.hull || 1;
    const multiplierLvl = currentUpgrades.multiplier || 1;

    // Ship Bonuses
    const ship = equippedShipRef.current;
    const encounterDelay = getShipTraits(ship).encounterDelay || 1;

    const totalHealth = maxHullHealth(hullLvl, ship, pilotLevel);

    gameRef.current = {
      viewport: viewportRef.current,
      eventFlight: beginEventFlight(),
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
      supportDropTimers: {},
      powerUps: [],
      activePowerUps: [],
      enemies: [],
      flightTime: 0,
      enemySpawnTimer: 20 * encounterDelay,
      obstacleSpawnTimer: 4,
      enemyShotCooldown: 0,
      enemyAttackWarning: null,
      enemyAttackWarnings: [],
      lastEnemyAttackLane: -1,
      projectiles: [],
      playerProjectiles: [],
      floatingTexts: [],
      speed: START_SPEED,
      distance: 0,
      energy: maxEnergy,
      ammo: equipment.maxAmmo,
      maxAmmo: equipment.maxAmmo,
      ammoTimer: 0,
      maxEnergy: maxEnergy,

      // New Stats
      health: totalHealth,
      maxHealth: totalHealth,
      hitProtection: 0,
      ...equipment,
      currencyMultiplier: coinMultiplier(multiplierLvl),

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

    gameRef.current.encounter = createEncounterDirector();
    gameRef.current.combatEvents = [];
    resetTransformations(gameRef.current, true);
    setTransformationView(null);
    prepareLaunch(gameRef.current, viewportRef.current.height, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setFlightPhase('LAUNCH');
    setDistance(0);
    setEnergy(100); // Always start at 100% regardless of max energy
    setAmmo(equipment.maxAmmo); // Match the equipped ammunition bay
    setMaxAmmo(equipment.maxAmmo);
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
    profileStorage.setItem('neon_glide_learned_controls', 'true');
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

    queueEventFlight(gameRef.current);
    void refreshEvents().catch(() => {});
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

  const consumeCombatEvents = React.useCallback((game) => {
    const events = drainCombatEvents(game);
    const credits = events.reduce((total, event) => total + event.reward, 0);
    if (credits) { setCurrency(value => value + credits); setSessionCurrency(game.sessionCurrency); }
    for (const event of events) {
      soundRef.current?.playExplosion();
      rendererRef.current?.emitBurst(event.x, event.y, event.enemy.isEliteBoss ? event.enemy.color : '#ff627d', event.enemy.isEliteBoss ? 42 : 20, 260);
      game.floatingTexts.push({ x: event.x, y: event.y, text: event.enemy.isEliteBoss ? 'BOSS DEFEATED!' : event.enemy.isBossDrone ? 'DRONE DOWN' : 'ENEMY DEFEATED', color: '#ffcf9a', life: 1.2 });
      if (event.reward) game.floatingTexts.push({ x: event.x, y: event.y + 24, text: `+${event.reward.toLocaleString()} credits`, color: '#ffd369', life: 1.2 });
    }
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

      if (touchesObstacle(game, obs)) {
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
    if (!game.transformation && touchesFlightBoundary(p, viewportRef.current.height)) {
      if (game.transformationSafety > 0) {
        p.y = viewportRef.current.height - 30;
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
        const magnetRange = game.magnetRange;
        if (dist < magnetRange) {
          col.x += (p.x - col.x) * (1 - Math.pow(.9, deltaTime * 60 * (game.tractorRate || 1)));
          col.y += (p.y - col.y) * (1 - Math.pow(.9, deltaTime * 60 * (game.tractorRate || 1)));
        }
      }

      // Collection
      if (dist < 30) {
        const amount = collectCoin(game, col, currentUpgrades.multiplier || 1);
        if (game.eventFlight) game.eventFlight.coins += amount;
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

        setEnergy((game.energy / game.maxEnergy) * 100);
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
          existingPowerUp.remainingTime = powerUp.duration * (game.powerDuration || 1);
          existingPowerUp.maxDuration = powerUp.duration * (game.powerDuration || 1);
        } else {
          // Add new power-up
          game.activePowerUps.push({
            type: powerUp.type,
            remainingTime: powerUp.duration * (game.powerDuration || 1),
            maxDuration: powerUp.duration * (game.powerDuration || 1),
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
      if (hostileShotTouchesRect(proj, pRect, game.previousProjectileBounds)) {
        if (!takeProjectileHit(game, proj)) continue;
        setHealth(game.health);
        rendererRef.current?.emitBurst(p.x + 20, p.y, '#ff1744', 20, 260);
        if (soundRef.current) soundRef.current.playExplosion();
        game.floatingTexts.push({
          x: p.x,
          y: p.y,
          text: `-${Number(game.projectileDamage.toFixed(1))} HP`,
          color: '#ffa1b1',
          life: 1.0
        });

        if (game.health <= 0) {
          handleGameOver();
          return;
        }
      }
    }

    resolveFriendlyHits(game);
    consumeCombatEvents(game);
  }, [handleGameOver, consumeCombatEvents]);

  const update = React.useCallback((deltaTime) => {
    const game = gameRef.current;
    if (game.gameOver) return;
    const previousPhase = game.phase;
    const simulate = advanceFlightStart(game, deltaTime, flightInputRef.current.sources.size > 0);
    constrainFlightPlayer(game, viewportRef.current.width);
    if (game.phase !== previousPhase) {
      setFlightPhase(game.phase);
      if (game.phase === 'FLYING') setTutorialBoosted(true);
    }
    if (!simulate) return;
    game.previousProjectileBounds = transformationHitbox(game);
    game.previousObstacleBounds = obstacleCollisionBounds(game);
    const previousTransformation = game.transformation;
    // Advance the capsule before the vehicle so pickup and protection start in this frame.
    if (advanceTransformationCapsule(game, transformationWorldDelta(game, deltaTime), viewportRef.current.width, viewportRef.current.height)) {
      soundRef.current?.playTransformationPickup(game.transformation.id);
      if (game.eventFlight) game.eventFlight.capsules++;
      setTransformationView(transformationHud(game));
    }
    const realDelta = deltaTime;
    const worldDelta = transformationWorldDelta(game, realDelta);
    game.worldTimeScale = realDelta > 0 ? worldDelta / realDelta : 1;
    if (game.transformation) {
      const previousTransformationPhase = game.transformation.phase;
      const result = advanceTransformation(game, realDelta, viewportRef.current.width, viewportRef.current.height,
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
    // Shape changes are not movement through the intervening space.
    if (previousTransformation !== game.transformation) {
      game.previousObstacleBounds = obstacleCollisionBounds(game);
      game.previousProjectileBounds = transformationHitbox(game);
    }
    // One world delta drives scenery, enemies, projectiles, spawns, rewards and resource clocks.
    deltaTime = worldDelta;
    if (game.eventFlight) { game.eventFlight.seconds += deltaTime; game.eventCheckpoint=(game.eventCheckpoint||0)+deltaTime; if(game.eventCheckpoint>=10){queueEventFlight(game);game.eventCheckpoint=0;} }
    game.transformationSafety = Math.max(0, (game.transformationSafety || 0) - deltaTime);
    advanceHitProtection(game, deltaTime);

    // Update Player
    if (!game.transformation) game.player.update(deltaTime);
    constrainFlightPlayer(game, viewportRef.current.width);

    // Update Speed & Distance
    advanceFlightPace(game, deltaTime);

    // Throttle UI updates to ~10fps (every 100ms) to prevent React render overload
    game.uiTimer = (game.uiTimer || 0) + deltaTime;
    if (game.uiTimer > 0.1) {
      setDistance(game.distance);
      setHealth(game.health);
      game.uiTimer = 0;
    }

    // Ammo Regeneration
    if (advanceAmmoRecharge(game, deltaTime)) setAmmo(game.ammo);

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

    // Edge hazards retain generous spacing; later pressure comes from encounters.
    advanceBossEncounter(game);
    for (const event of drainEncounterEvents(game)) {
      trackMonetizationEvent(event.name, event.data);
      if (event.name === 'boss_incoming') soundRef.current?.playBossCue(event.data.boss, 'incoming');
      if (event.name === 'boss_warning') soundRef.current?.playBossCue(event.data.boss, 'warning');
      if (event.name === 'boss_attack') soundRef.current?.playBossCue(event.data.boss, 'attack');
      if (event.name === 'boss_started') soundRef.current?.playBossCue(event.data.boss, 'arrival');
      if (event.name === 'boss_ended') {
        setBossView(null);
        game.floatingTexts.push({ x: viewportRef.current.width * .5, y: 120, text: event.data.outcome === 'defeated' ? 'SECTOR CLEAR' : 'BOSS RETREATED', color: '#b8e8d7', life: 2 });
      }
    }
    if (!encounterRestrictsSpawns(game)) advanceHazardSpawns(game, deltaTime, viewportRef.current.width, viewportRef.current.height);

    // Support pickups use bounded cooldowns that lengthen as the flight progresses.
    if (advanceSupportDrop(game, 'fuel', deltaTime)) {
      const y = Math.random() * (viewportRef.current.height - 100) + 50;
      game.fuels.push(new Fuel(viewportRef.current.width, y));
    }

    // Medical packs are also sparse and never stack on screen.
    if (advanceHealthPickupSpawn(game, deltaTime)) {
      const y = viewportRef.current.height * (.4 + Math.random() * .2) - 16;
      game.healthPickups.push(new HealthPickup(viewportRef.current.width, y));
    }

    if (advanceSupportDrop(game, 'power', deltaTime)) {
      const y = Math.random() * (viewportRef.current.height - 100) + 50;
      game.powerUps.push(new PowerUp(viewportRef.current.width, y));
    }

    // Update Entities (apply time slow if active)
    const effectiveSpeed = flightScrollSpeed(game);
    game.obstacles.forEach(obs => { obs.previousX = obs.x; obs.update(deltaTime, effectiveSpeed); });
    game.collectibles.forEach(col => col.update(deltaTime, effectiveSpeed));
    game.collectibles.push(...advanceCoinTrails(game.coinTrails, game.speed * deltaTime,
      viewportRef.current.width, viewportRef.current.height, game.obstacles, game.viewport.paceScale));
    game.fuels.forEach(fuel => fuel.update(deltaTime, effectiveSpeed));
    game.healthPickups.forEach(pickup => pickup.update(deltaTime, effectiveSpeed));
    game.powerUps.forEach(powerUp => powerUp.update(deltaTime, effectiveSpeed));

    positionEnemyLanes(game, viewportRef.current.height);
    for (const enemy of flightEnemies(game)) {
      if (enemy.markedForDeletion) continue;
      enemy.update(deltaTime, game.player.y, game.playerProjectiles, game.enemies, game.viewport);
    }
    const previousAims = new Map(flightEnemies(game).map(enemy => [enemy, { active: Boolean(enemy.scoutAim), locked: Boolean(enemy.scoutAim?.locked) }]));
    const firingEnemies = advanceEnemyAttacks(game, deltaTime);
    if (flightEnemies(game).some(enemy => enemy.scoutAim && (!previousAims.get(enemy)?.active
      || (!previousAims.get(enemy)?.locked && enemy.scoutAim.locked)))) soundRef.current?.playScoutLock();
    for (const enemy of firingEnemies) {
      game.projectiles.push(...createEnemyVolley(game, enemy));
      if (isScout(enemy)) soundRef.current?.playScoutBeam();
      else soundRef.current?.playShoot();
    }
    game.projectiles.forEach(proj => proj.update(deltaTime, game.viewport));
    game.playerProjectiles.forEach(proj => proj.update(deltaTime, game.viewport));

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

    advanceEquipmentEnergy(game, deltaTime);

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
        const point = proj.type === 'SCOUT_BEAM' ? nearestBeamPoint(proj, p.x, p.y) : proj;
        const dx = point.x - p.x;
        const dy = point.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < auraRadius) {
          proj.markedForDeletion = true;
          // Silent destruction for projectiles
        }
      });

      // Damage Villain
      for (const v of flightEnemies(game)) {
        if (v.markedForDeletion) continue;
        const dx = (v.x + v.width / 2) - p.x;
        const dy = (v.y + v.height / 2) - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < auraRadius) {
          damageEnemy(game, v, 30 * deltaTime);
        }
      }
    }

    consumeCombatEvents(game);
    syncEncounterMusic(game, soundRef.current);

    // Keep the HUD responsive without forcing a React render every animation frame.
    game.energyUiTimer = (game.energyUiTimer || 0) + deltaTime;
    if (game.energyUiTimer >= 0.1) {
      setEnergy(Math.max(0, Math.min(100, (game.energy / game.maxEnergy) * 100)));
      setBossView(bossHud(game));
      game.energyUiTimer = 0;
    }
  }, [checkCollisions, consumeCombatEvents]);

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
    if (gameState !== 'PLAYING' || !['LAUNCH', 'READY', 'FLYING'].includes(gameRef.current.phase)) return;
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
    constrainFlightPlayer(game, viewportRef.current.width);
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
    constrainFlightPlayer(game, viewportRef.current.width);
    setFlightPhase(game.phase);
    if (game.phase === 'COUNTDOWN') {
      setCountdown(3);
      setGameState('COUNTDOWN');
      return;
    }
    setGameState('PLAYING');
    syncEncounterMusic(game, soundRef.current);
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
    if (gameState !== 'PLAYING' || gameRef.current.phase !== 'FLYING' || gameRef.current.gameOver) return;
    if (gameRef.current.transformation) {
      if (transformationSecondary(gameRef.current)) {
        setTransformationView(transformationHud(gameRef.current));
        soundRef.current?.playControlPress('fire');
        soundRef.current?.playShoot();
      }
      return;
    }
    if (gameState === 'PLAYING' && fireNormalWeapon(gameRef.current)) {
      setAmmo(gameRef.current.ammo);
      setTutorialFired(true);
      soundRef.current?.playControlPress('fire');
      soundRef.current?.playShoot();
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
    const refreshPurchaseOwnership = () => {
      if (startupComplete && !document.hidden) {
        void refreshStorePurchases().catch(error => trackMonetizationEvent('store_delivery_retry_needed', { message: error.message }));
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        releaseInputs();
        pauseGame();
        soundRef.current?.stopMusic();
      } else {
        if (startupComplete) {
          refreshPurchaseOwnership();
          if (menuMusicStates.has(gameState)) void soundRef.current?.startMenuMusic();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', releaseInputs);
    window.addEventListener('online', refreshPurchaseOwnership);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', releaseInputs);
      window.removeEventListener('online', refreshPurchaseOwnership);
      document.removeEventListener('visibilitychange', onVisibility);
      releaseInputs();
    };
  }, [gameState, startupComplete, handleInputStart, handleInputEnd, handleShoot, pauseGame]);

  const buyUpgrade = (id, cost, type = 'upgrade') => {
    if (type === 'cosmetic') {
      const cosmetic = getCosmetic(id);
      const productId = cosmetic?.kind === 'skin' ? getCosmetic(cosmetic.setId).productId : cosmetic?.productId;
      if (pendingProducts.includes(productId)) return;
      try {
        unlockCreditCosmetic(id, { expectedPrice: cost });
        setOwnedCosmetics(safeCosmeticOwnership());
        setEquippedCosmetic(id);
      } catch (error) {
        setPurchaseMessage(error.message || 'Could not unlock this cosmetic.');
      }
      return;
    }
    if (!['upgrade', 'ship', 'weapon'].includes(type)) return;
    const catalogItem = (type === 'ship' ? SHIPS : type === 'weapon' ? WEAPONS : UPGRADES).find(item => item.id === id);
    if (!catalogItem) return;
    if (type === 'ship' && ownedShips.includes(id) || type === 'weapon' && ownedWeapons.includes(id)) return;
    if (type === 'upgrade' && id === 'multiplier' && (upgradesRef.current.multiplier || 1) >= MULTIPLIER_MAX_LEVEL) return;
    const currentBalance = loadWallet();
    const offer = type === 'upgrade' ? upgradeOffer(id, upgradesRef.current, equippedShipRef.current, profileRef.current.level || 1) : null;
    const itemCost = offer ? offer.cost : catalogItem.cost;



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
            [id]: offer.nextLevel
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
        if (!prepareRewardedContinue(game, viewportRef.current)) return;
        setTransformationView(null);
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
    if (rewardOperationRef.current || game.phase !== 'ENDED' || game.earningsBonusClaimed || distanceAdReward(game.distance) <= 0) return;
    const snapshotDistance = game.distance;
    const request = { token: runTokenRef.current, game };
    rewardOperationRef.current = request;
    setRewardBusy(true);
    setRewardAction('earnings');
    setRewardMessage('');
    const isCurrent = () => rewardOperationRef.current === request && request.token === runTokenRef.current && game === gameRef.current && game.phase === 'ENDED';
    try {
      const rewarded = await showRewardedAd('flight_distance_bonus');
      if (!isCurrent()) return;
      if (rewarded) {
        const bonus = claimDistanceAdBonus(game, snapshotDistance);
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
    abandonBossEncounter(gameRef.current);
    for (const event of drainEncounterEvents(gameRef.current)) trackMonetizationEvent(event.name, event.data);
    setBossView(null);
    gameRef.current.phase = 'ENDED';
    flightInputRef.current.reset();
    loopRef.current?.stop();
    resetTransformations(gameRef.current);
    setTransformationView(null);
    setGameState(screen);
  };

  return (
    <div className="game-shell">
      <div ref={flightStageRef} className="flight-stage">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Flight playfield — hold to boost" onPointerDown={handleInputStart} onPointerUp={handleInputEnd} onPointerCancel={handleInputEnd} onLostPointerCapture={handleInputEnd}/>
      {['PLAYING', 'COUNTDOWN', 'PAUSED'].includes(gameState) && (
        <HUD distance={distance} currency={sessionCurrency} energy={energy} ammo={ammo} maxAmmo={maxAmmo}
          activePowerUps={activePowerUps} health={health} maxHealth={maxHealth} combo={combo} transformation={transformationView}
          onShoot={handleShoot} onBoostStart={handleInputStart} onBoostEnd={handleInputEnd}
          onPause={pauseGame} flightPhase={flightPhase} paused={gameState === 'PAUSED'} countdown={gameState === 'COUNTDOWN' ? countdown : null}/>
      )}
      {['PLAYING', 'COUNTDOWN', 'PAUSED'].includes(gameState) && <BossStatus boss={bossView} transformed={Boolean(transformationView)} />}
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

      </div>
      {gameState === 'PAUSED' && <section className="screen-overlay pause-overlay" aria-label="Flight paused"><div className="pause-board"><span className="eyebrow">TAKE A BREATHER</span><h2>Flight paused</h2><p>Adjust your sound, then keep flying.</p><div className="pause-audio" role="group" aria-label="Flight audio preferences"><AudioControls preferences={audioPreferences} onChange={(key, value) => setAudioPreferences(current => ({ ...current, [key]: value }))}/></div><div className="pause-actions"><button className="arcade-button primary" onClick={resumeGame}><Play size={22} fill="currentColor"/>Keep flying</button><button className="arcade-button secondary" onClick={() => { handleGameOver(); leaveRun('MENU'); }}><Home size={20}/>Back to home</button></div></div></section>}


      {gameState === 'EVENTS' && <Events ownedCosmetics={ownedCosmetics} onEquip={id => setEquippedCosmetic(id)} onClose={() => setGameState('MENU')} onAccount={() => setGameState('ACCOUNT')}/>}
      {gameState === 'MENU' && <HomeScreen stageId={equippedStage} onGalaxies={() => { setShopInitialTab('stages'); setGameState('SHOP'); }} profile={profile} currency={currency} ship={equippedShip} cosmeticId={equippedCosmetic} upgrades={upgrades}
        audioPreferences={audioPreferences} onAudioPreferenceChange={(key, value) => setAudioPreferences(current => ({ ...current, [key]: value }))}
        onPlay={() => startGame()} onGarage={() => { setShopInitialTab('featured'); setGameState('SHOP'); }} onCareer={() => setGameState('CAREER')}
        onHelp={replayTutorial} adPrivacyAvailable={adPrivacyAvailable} adPrivacyBusy={adPrivacyBusy}
        adPrivacyMessage={adPrivacyMessage} onPrivacy={handleAdPrivacyChoices}
        onLegal={document => { setLegalDocument(document); setGameState('LEGAL'); }}/>}

      {gameState === 'LEGAL' && <LegalPanel document={legalDocument} onClose={() => setGameState('MENU')}/>}

      {gameState === 'GAMEOVER' && <RunResults onEvents={() => leaveRun('EVENTS')} eventProgress={gameRef.current.eventFlight?.instances?.length ? gameRef.current.eventFlight : null} distance={distance} bestDistance={profile.bestDistance} isNewBest={newBest}
        coins={sessionCurrency} distanceBonus={distanceBonus} xp={lastRunXp} onRetry={() => startGame()} onHome={() => leaveRun('MENU')}
        onGarage={() => leaveRun('SHOP')} onContinue={onlineServicesAllowed() ? handleRewardContinue : null} continueUsed={continueUsed}
        rewardBusy={rewardBusy} rewardAction={rewardAction} rewardMessage={rewardMessage}
        onBoostEarnings={onlineServicesAllowed() ? handleBoostEarnings : null} earningsBonus={earningsBonus} earningsBonusClaimed={earningsBonusClaimed}
        levelBonus={levelBonus} wallet={currency} nextShip={SHIPS.find(model => !ownedShips.includes(model.id))}
        fleetComplete={SHIPS.every(model => ownedShips.includes(model.id))}/>}

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

      {(gameState === 'CAREER' || gameState === 'ACCOUNT') && (
        <Career profile={profile} onRename={value => setProfile(updatePilotName(value))} onClaim={handleClaimMission} initialTab={gameState === 'ACCOUNT' ? 'account' : 'career'} onClose={() => setGameState('MENU')} />
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
