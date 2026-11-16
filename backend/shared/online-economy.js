import { RequestError } from './errors.js';
import { SHIP_PRICES, WEAPON_PRICES, UPGRADE_PRICES, LEVEL_REWARD, ENEMY_REWARD, BOSS_REWARD, runXp } from './economy-rules.js';
import { COSMETIC_PRICING, roundUpgradeCreditCost } from './store-catalog.js';
import { STAGES } from './stages.js';
import { skinCreditCost } from './skin-pricing.js';
import { cosmeticCreditOffer } from './garage-offers.js';

export const ECONOMY_VERSION=1;
export const CAREER_REWARDS=Object.freeze({distance_5k:{stat:'totalDistance',target:5000,reward:50000},coins_1k:{stat:'totalCoins',target:100000,reward:35000},bosses_10:{stat:'bosses',target:10,reward:100000},runs_25:{stat:'runs',target:25,reward:75000}});
const modules=new Set(['ammo_capacity','ammo_regen','boost_efficiency','energy_recovery','medical','armor','hit_guard','power_duration','tractor_speed','repair_amplifier']);
const read=(save,key,fallback)=>JSON.parse(save?.[key]||JSON.stringify(fallback));
export const walletOf=save=>read(save,'neon_glide_wallet_v3',{version:3,balance:0,debt:0,transactions:{},entitlements:{},legacyPurchases:{},cloudEntitlements:{},eventReceipts:{},eventCosmetics:{},creditCosmetics:{},creditStages:{},creditShips:{},creditWeapons:{},pendingCosmetics:{},equippedStage:'default'});
const profileOf=save=>read(save,'neon_glide_pilot_profile_v2',{displayName:'',level:1,xp:0,totalDistance:0,totalCoins:0,runs:0,bosses:0,bestDistance:0,claimedMissions:[]});
const replace=(save,key,value)=>({...save,[key]:JSON.stringify(value)});
export function creditWallet(wallet,amount) {
 if(!Number.isSafeInteger(amount)||amount<0)throw new RequestError('Invalid credit amount.');
 const repaid=Math.min(wallet.debt||0,amount);
 wallet.debt=(wallet.debt||0)-repaid;wallet.balance+=amount-repaid;
 if(!Number.isSafeInteger(wallet.balance))throw new RequestError('Wallet limit reached.');
 return wallet;
}
export function debitRefund(wallet,amount) {
 const deducted=Math.min(wallet.balance,amount);wallet.balance-=deducted;wallet.debt=(wallet.debt||0)+amount-deducted;
 if(!Number.isSafeInteger(wallet.debt))throw new RequestError('Wallet limit reached.');
 return wallet;
}
export function trustedReceipt(purchase,environment) {
 return !purchase.revoked&&!purchase.ownerDeleted&&purchase.environment===environment;
}
export function initialOnlineSave(legacy,purchases,environment) {
 let save={neon_glide_owned_ships:'["default"]',neon_glide_owned_weapons:'["default"]',neon_glide_upgrades:'{}',neon_glide_equipped_ship:'default',neon_glide_equipped_weapon:'default',neon_glide_equipped_cosmetic:''};
 const wallet=walletOf(null);
 for(const purchase of purchases.filter(p=>trustedReceipt(p,environment))) {
  if(!purchase.consumable)wallet.cloudEntitlements[purchase.productId]=true;
  creditWallet(wallet,purchase.credits||0);
 }
 if(wallet.cloudEntitlements.starter_pack){save.neon_glide_owned_ships='["default","interceptor"]';save.neon_glide_owned_weapons='["default","blaster"]';wallet.starterCreditsGranted=true;}
 const profile=profileOf(null);let old;
 try{old=profileOf(legacy)||{};}catch{old={};}
 if(typeof old.displayName==='string'&&old.displayName.length<=24)profile.displayName=old.displayName;
 save=replace(save,'neon_glide_pilot_profile_v2',profile);
 if(legacy?.neon_glide_learned_controls==='true')save.neon_glide_learned_controls='true';
 return replace(save,'neon_glide_wallet_v3',wallet);
}

// All economic fields come from the server. Save/resolve may select presentation
// preferences, but cannot import currency, progress or ownership from any bank.
export function protectEconomicSave(incoming,authoritative) {
 const result=structuredClone(authoritative),wallet=walletOf(authoritative),profile=profileOf(authoritative);
 const nextProfile=read(incoming,'neon_glide_pilot_profile_v2',{});
 if(typeof nextProfile.displayName==='string'&&nextProfile.displayName.length<=24)profile.displayName=nextProfile.displayName;
 for(const [key,owned] of [['neon_glide_equipped_ship',read(authoritative,'neon_glide_owned_ships',['default'])],['neon_glide_equipped_weapon',read(authoritative,'neon_glide_owned_weapons',['default'])]])if(owned.includes(incoming[key]))result[key]=incoming[key];
 const candidate=incoming.neon_glide_equipped_cosmetic;
 if(candidate===''||ownedCosmetics(wallet)[candidate])result.neon_glide_equipped_cosmetic=candidate;
 const incomingWallet=walletOf(incoming);
 if(incoming.neon_glide_wallet_v3&&(incomingWallet.equippedStage==='default'||wallet.creditStages[incomingWallet.equippedStage]))wallet.equippedStage=incomingWallet.equippedStage;
 if(incoming.neon_glide_learned_controls==='true')result.neon_glide_learned_controls='true';
 result.neon_glide_pilot_profile_v2=JSON.stringify(profile);result.neon_glide_wallet_v3=JSON.stringify(wallet);return result;
}
function ownedCosmetics(wallet) {
 const result={...wallet.creditCosmetics,...wallet.eventCosmetics};
 for(const id of Object.keys(COSMETIC_PRICING))if(wallet.cloudEntitlements[`cosmetic_${id}`])result[id]=true;
 for(const id of Object.keys(COSMETIC_PRICING))if(result[id])result[`skin_${id}`]=true;
 return result;
}
export function spendCredits(save,{kind,id,expectedPrice},now) {
 const wallet=walletOf(save),profile=profileOf(save),ownership=ownedCosmetics(wallet);
 let price,apply,previousValue;
 if(kind==='ship'||kind==='weapon') {
  const table=kind==='ship'?SHIP_PRICES:WEAPON_PRICES,key=kind==='ship'?'neon_glide_owned_ships':'neon_glide_owned_weapons';
  if(!Object.hasOwn(table,id))throw new RequestError('Unknown equipment.');
  const owned=read(save,key,['default']);if(owned.includes(id))return {save,charged:0};
  price=table[id];apply=data=>{wallet[kind==='ship'?'creditShips':'creditWeapons'][id]=true;return replace(data,key,[...owned,id]);};
 }else if(kind==='upgrade') {
  if(!Object.hasOwn(UPGRADE_PRICES,id))throw new RequestError('Unknown upgrade.');
  const upgrades=read(save,'neon_glide_upgrades',{}),base=modules.has(id)?0:1,level=upgrades[id]??base;
  previousValue=upgrades[id]??null;
  if(level>=50||(id==='multiplier'&&level>=5))throw new RequestError('Upgrade is already complete.');
  price=roundUpgradeCreditCost(Math.floor(UPGRADE_PRICES[id]*1.5**Math.max(0,level-base)));
  apply=data=>replace(data,'neon_glide_upgrades',{...upgrades,[id]:level+1});
 }else if(kind==='stage') {
  const stage=STAGES.find(stage=>stage.id===id);if(!stage)throw new RequestError('Unknown galaxy.');
  if(id==='default'||wallet.creditStages[id])return {save,charged:0};
  price=stage.price;apply=data=>{wallet.creditStages[id]=true;wallet.equippedStage=id;return data;};
 }else if(kind==='cosmetic') {
  const skin=id.startsWith('skin_'),setId=skin?id.slice(5):id;
  if(!Object.hasOwn(COSMETIC_PRICING,setId))throw new RequestError('Unknown cosmetic.');
  if(ownership[id])return {save,charged:0};
  const item=COSMETIC_PRICING[setId];
  price=skin?skinCreditCost(item.creditPrice):cosmeticCreditOffer({...item,kind:'set'},now,ownership).price;
  apply=data=>{wallet.creditCosmetics[id]=true;return data;};
 }else throw new RequestError('Unknown purchase type.');
 if(!Number.isSafeInteger(price)||price<0)throw new RequestError('Invalid price.');
 if(price!==expectedPrice)throw new RequestError('This offer has changed. Review the current price and try again.',409,'offer-changed');
 if(wallet.debt>0||wallet.balance<price)throw new RequestError('Not enough credits.');
 wallet.balance-=price;
 let result=apply(save);
 result=replace(result,'neon_glide_wallet_v3',wallet);
 return {save:result,charged:price,level:profile.level,previousValue:previousValue??null};
}

export function reverseSpend(save,operation) {
 let result=structuredClone(save);const wallet=walletOf(result);
 const {kind,id}=operation;
 if(kind==='ship'||kind==='weapon') {
  const key=kind==='ship'?'neon_glide_owned_ships':'neon_glide_owned_weapons';
  delete wallet[kind==='ship'?'creditShips':'creditWeapons'][id];
  const retained=wallet.cloudEntitlements.starter_pack&&id===(kind==='ship'?'interceptor':'blaster');
  if(!retained)result=replace(result,key,read(result,key,['default']).filter(value=>value!==id));
  const equipped=kind==='ship'?'neon_glide_equipped_ship':'neon_glide_equipped_weapon';if(!retained&&result[equipped]===id)result[equipped]='default';
 }else if(kind==='upgrade') {
  const upgrades=read(result,'neon_glide_upgrades',{});if(operation.previousValue===null)delete upgrades[id];else upgrades[id]=operation.previousValue;
  result=replace(result,'neon_glide_upgrades',upgrades);
 }else if(kind==='cosmetic') {
  delete wallet.creditCosmetics[id];
  if(result.neon_glide_equipped_cosmetic===id&&!ownedCosmetics(wallet)[id])result.neon_glide_equipped_cosmetic='';
 }else if(kind==='stage') {
  delete wallet.creditStages[id];if(wallet.equippedStage===id)wallet.equippedStage='default';
 }
 creditWallet(wallet,operation.charged);
 return replace(result,'neon_glide_wallet_v3',wallet);
}
export function reconcileGiftEquipment(save) {
 const wallet=walletOf(save),starter=wallet.cloudEntitlements.starter_pack;
 const ships=['default',...Object.keys(wallet.creditShips||{}).filter(id=>wallet.creditShips[id]),...(starter?['interceptor']:[])];
 const weapons=['default',...Object.keys(wallet.creditWeapons||{}).filter(id=>wallet.creditWeapons[id]),...(starter?['blaster']:[])];
 const next=replace(replace(save,'neon_glide_owned_ships',[...new Set(ships)]),'neon_glide_owned_weapons',[...new Set(weapons)]);
 if(!ships.includes(next.neon_glide_equipped_ship))next.neon_glide_equipped_ship='default';
 if(!weapons.includes(next.neon_glide_equipped_weapon))next.neon_glide_equipped_weapon='default';
 return next;
}

export function applyFlightEarnings(save,run,prior) {
 const wallet=walletOf(save),profile=profileOf(save),old=prior||{distance:0,coins:0,bosses:0,eliteBosses:0};
 const combat=value=>(value.bosses||0)*ENEMY_REWARD+(value.eliteBosses||0)*(BOSS_REWARD-ENEMY_REWARD);
 const earned=value=>value.coins+Math.floor(value.distance)*10+combat(value);
 const credits=Math.max(0,earned(run)-earned(old));
 const xpDelta=Math.max(0,runXp({...run,coins:run.coins+combat(run)})-runXp({...old,coins:old.coins+combat(old)}));
 profile.xp+=xpDelta;
 let levels=0;
 while(profile.level<10000&&profile.xp>=400+(profile.level-1)*175){profile.xp-=400+(profile.level-1)*175;profile.level++;levels++;}
 profile.totalDistance+=Math.max(0,Math.floor(run.distance)-Math.floor(old.distance));profile.totalCoins+=Math.max(0,run.coins+combat(run)-old.coins-combat(old));profile.bosses+=Math.max(0,run.bosses-old.bosses);profile.runs+=prior?0:1;profile.bestDistance=Math.max(profile.bestDistance,Math.floor(run.distance));
 creditWallet(wallet,credits+levels*LEVEL_REWARD);
 return replace(replace(save,'neon_glide_wallet_v3',wallet),'neon_glide_pilot_profile_v2',profile);
}
export function claimCareerReward(save,id) {
 const mission=Object.hasOwn(CAREER_REWARDS,id)?CAREER_REWARDS[id]:null,profile=profileOf(save);
 if(!mission)throw new RequestError('Unknown career mission.');
 if(profile.claimedMissions.includes(id))return {save,reward:0};
 if(profile[mission.stat]<mission.target)throw new RequestError('Reward is not ready.');
 profile.claimedMissions.push(id);const wallet=creditWallet(walletOf(save),mission.reward);
 return {save:replace(replace(save,'neon_glide_wallet_v3',wallet),'neon_glide_pilot_profile_v2',profile),reward:mission.reward};
}
