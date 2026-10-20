import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWallet, saveWallet, WALLET_KEY, ACCOUNT_KEY, runXp, claimEarningsBonus, claimDistanceCredits, flightEarningsBreakdown, SHIP_PRICES, UPGRADE_PRICES, CREDIT_PACKS, STARTER_CREDITS, coinMultiplier, BOSS_REWARD, LEVEL_REWARD } from '../src/game/Economy.js';
import { loadProfile, saveProfile, recordRun, defaultProfile, claimMission, CAREER_MISSIONS } from '../src/services/ProgressionService.js';

function storage() {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  return values;
}

test('versioned records convert legacy balances once, even after interrupted or partial saves', () => {
  const data = storage();
  const legacy = { ...defaultProfile, level:7, xp:321, totalCoins:1500, claimedMissions:['coins_1k'] };
  data.set('neon_glide_currency','822');
  data.set('neon_glide_pilot_profile',JSON.stringify(legacy));
  data.set('neon_glide_owned_ships','["default","cruiser"]');
  data.set('neon_glide_upgrades','{"hull":3}');
  for(let i=0;i<3;i++) { assert.equal(loadWallet(),82200); assert.equal(loadProfile().totalCoins,150000); }
  const setItem = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('Interrupted'); };
  assert.throws(()=>saveWallet(loadWallet()));
  assert.throws(()=>saveProfile(loadProfile()));
  localStorage.setItem = setItem;
  saveWallet(loadWallet());
  assert.equal(loadWallet(),82200);
  assert.equal(loadProfile().totalCoins,150000,'Wallet migration cannot mark profile migration as done');
  saveProfile(loadProfile());
  for(let i=0;i<3;i++) { assert.equal(loadWallet(),82200); assert.equal(loadProfile().totalCoins,150000); }
  assert.equal(loadProfile().level,7);assert.equal(loadProfile().xp,321);
  assert.deepEqual(loadProfile().claimedMissions,['coins_1k']);
  assert.equal(claimMission(loadProfile(),'coins_1k'),null);
  assert.equal(data.get('neon_glide_currency'),'822');
  assert.equal(data.get('neon_glide_pilot_profile'),JSON.stringify(legacy));
  assert.equal(data.get('neon_glide_owned_ships'),'["default","cruiser"]');
  assert.equal(data.get('neon_glide_upgrades'),'{"hull":3}');
  saveWallet(80000); assert.equal(loadWallet(),80000);
  data.set(WALLET_KEY,'Infinity');assert.equal(loadWallet(),80000,'The committed v3 wallet is authoritative');
  data.delete(ACCOUNT_KEY);assert.equal(loadWallet(),0);
});

test('revived runs commit only new progress and normalized XP without counting the run twice', () => {
  storage();
  const initial={...defaultProfile};
  const first=recordRun(initial,{distance:503.4,coins:12000,bosses:1});
  const finalStats={distance:1007.8,coins:27500,bosses:2};
  const continued=recordRun(first.profile,finalStats,first.committed);
  const single=recordRun(initial,finalStats);
  assert.deepEqual(continued.profile,single.profile);
  assert.equal(first.xpEarned+continued.xpEarned,runXp(finalStats));
  assert.equal(continued.profile.runs,1);
  assert.equal(continued.profile.totalCoins,27500);
  assert.equal(continued.profile.totalDistance,1007);
  const repeated=recordRun(continued.profile,finalStats,continued.committed);
  assert.deepEqual(repeated.profile,continued.profile);
  assert.equal(repeated.xpEarned,0);
  assert.equal(runXp({coins:10000}),20);
});

test('an optional ad credits base earnings once, excluding level rewards and future revive earnings', () => {
  const game={phase:'ENDED',gameOver:true,sessionCurrency:12000,levelBonus:12500};
  assert.equal(claimEarningsBonus(game,12000),12000);
  assert.equal(game.sessionCurrency,12000);
  assert.equal(claimEarningsBonus(game,12000),0);
  game.phase='FLYING';game.gameOver=false;
  assert.equal(claimEarningsBonus(game,12000),0);
  game.sessionCurrency=18000;game.phase='ENDED';game.gameOver=true;
  assert.equal(claimEarningsBonus(game,18000),0);
  assert.equal(game.earningsBonus,12000);
  assert.equal(claimEarningsBonus({phase:'ENDED',gameOver:true,sessionCurrency:0},0),0);
});

test('entry upgrades and ship goals use the same high-credit economy as packs', () => {
  assert.equal(UPGRADE_PRICES.battery,5000);
  assert.deepEqual(Object.values(SHIP_PRICES),[0,60000,180000,400000,900000,1800000]);
  assert.deepEqual(Object.values(CREDIT_PACKS),[100000,550000,1500000]);
  assert.equal(STARTER_CREDITS,200000);
});


test('saved high multiplier levels cannot inflate coin payouts beyond 2x', () => {
  assert.deepEqual([1,2,3,4,5,20,1000].map(coinMultiplier), [1,1.25,1.5,1.75,2,2,2]);
  assert.equal(coinMultiplier(0),1);
  assert.equal(BOSS_REWARD,10000);
  assert.equal(LEVEL_REWARD,10000);
});


test('distance rewards pay completed meters once and preserve their high-water mark across revive', () => {
  for (const distance of [NaN, Infinity, -1]) {
    const game = { phase: 'ENDED', gameOver: true, distance, distanceBonus: 100, sessionCurrency: 200 };
    assert.equal(claimDistanceCredits(game), 0); assert.equal(game.sessionCurrency, 200);
  }
  for (const game of [null, {}, { phase: 'PAUSED', gameOver: true, distance: 100 }, { phase: 'ENDED', gameOver: false, distance: 100 }]) assert.equal(claimDistanceCredits(game), 0);
  const game = { phase: 'ENDED', gameOver: true, distance: 123.9, sessionCurrency: 500, distanceBonus: 0 };
  assert.equal(claimDistanceCredits(game), 1230); assert.equal(game.sessionCurrency, 1730);
  assert.equal(claimDistanceCredits(game), 0);
  game.phase = 'FLYING'; game.gameOver = false; game.distance = 200.8;
  assert.equal(claimDistanceCredits(game), 0);
  game.phase = 'ENDED'; game.gameOver = true;
  assert.equal(claimDistanceCredits(game), 770); assert.equal(game.distanceBonus, 2000); assert.equal(game.sessionCurrency, 2500);
  game.distance = 100; assert.equal(claimDistanceCredits(game), 0); assert.equal(game.distanceBonus, 2000);
  game.distance = 210; assert.equal(claimDistanceCredits(game), 100);
});

test('missions pay updated rewards once without changing existing claims', () => {
  storage();
  assert.deepEqual(CAREER_MISSIONS.map(({ id, reward }) => [id, reward]), [['distance_5k',50000],['coins_1k',35000],['bosses_10',100000],['runs_25',75000]]);
  let profile = { ...defaultProfile, totalDistance: 5000, totalCoins: 100000, bosses: 10, runs: 25, claimedMissions: ['distance_5k'] };
  assert.equal(claimMission(profile, 'distance_5k'), null);
  for (const mission of CAREER_MISSIONS.slice(1)) {
    const result = claimMission(profile, mission.id); assert.equal(result.reward, mission.reward); profile = result.profile;
    assert.equal(claimMission(profile, mission.id), null);
  }
});

test('distance earnings enter an ad snapshot once and do not become collected-credit progression', () => {
  storage();
  const game = { phase: 'ENDED', gameOver: true, distance: 500.9, distanceBonus: 0, sessionCurrency: 10000, levelBonus: 10000 };
  assert.equal(claimDistanceCredits(game), 5000);
  const result = recordRun({ ...defaultProfile }, { distance: game.distance, coins: game.sessionCurrency - game.distanceBonus, bosses: 0 });
  assert.equal(result.profile.totalCoins, 10000); assert.equal(result.xpEarned, 82);
  assert.equal(claimEarningsBonus(game, game.sessionCurrency), 15000);
  game.phase = 'FLYING'; game.gameOver = false; game.distance = 600;
  game.phase = 'ENDED'; game.gameOver = true;
  assert.equal(claimDistanceCredits(game), 1000);
  assert.equal(claimEarningsBonus(game, game.sessionCurrency), 0);
  assert.equal(game.earningsBonus, 15000);
});

 test('flight results split distance out of flight credits without adding it twice', () => {
  assert.deepEqual(flightEarningsBreakdown(15000, 5000, 10000, 15000), { collected: 10000, distance: 5000, total: 40000 });
});
