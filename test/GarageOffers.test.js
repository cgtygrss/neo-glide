import test from 'node:test';
import assert from 'node:assert/strict';
import { COSMETICS, getCosmetic } from '../src/game/CosmeticsCatalog.js';
import { DAILY_SET_DISCOUNT_PERCENT, dailySetOffer, cosmeticCreditOffer, garageSpotlights, garageCreditPack, garageRotationWindow, nextGarageRefresh } from '../src/game/GarageOffers.js';
import { loadWallet, saveWallet, unlockCreditCosmetic, getCosmeticOwnership, markCosmeticPending } from '../src/game/Economy.js';

const dayAt = offset => new Date(2026,10,10+offset,12).getTime();
function dayFor(id) {
  for(let day=0;day<COSMETICS.length;day++) if(dailySetOffer(dayAt(day)).cosmeticId===id)return dayAt(day);
  throw new Error('Every set must get a turn');
}
function storage() {
  const values = new Map();
  globalThis.localStorage = { getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,String(value)) };
  return values;
}

test('exactly one complete set has a real daily credit discount, matching the Featured hero', () => {
  const before=structuredClone(COSMETICS);
  const seen=new Set();
  assert.equal(DAILY_SET_DISCOUNT_PERCENT,20);
  for(let day=0;day<COSMETICS.length;day++) {
    const now=dayAt(day), daily=dailySetOffer(now), hero=garageSpotlights(COSMETICS,now)[0];
    assert.equal(hero.id,daily.cosmeticId); seen.add(hero.id);
    const discounted=COSMETICS.filter(c=>cosmeticCreditOffer(c,now).discountPercent>0);
    assert.deepEqual(discounted.map(c=>c.id),[hero.id]);
    for(const cosmetic of COSMETICS) {
      const offer=cosmeticCreditOffer(cosmetic,now);
      assert.equal(offer.originalPrice,cosmetic.creditPrice);
      if(cosmetic.id===hero.id) {
        assert.equal(offer.price,cosmetic.creditPrice*.8);
        assert.equal(offer.price%50000,0);
        assert.equal(offer.discountPercent,20);
        assert.equal(offer.savings,cosmetic.creditPrice-offer.price);
        assert.equal(offer.endsAt,daily.endsAt);
        assert.ok(offer.price>0 && offer.price<offer.originalPrice);
      } else {
        assert.equal(offer.price,cosmetic.creditPrice);
        assert.equal(offer.discountPercent,0); assert.equal(offer.endsAt,null);
      }
    }
  }
  assert.equal(seen.size,COSMETICS.length);
  assert.deepEqual(COSMETICS,before,'Offers never mutate regular prices, store prices or designs');
  for(const invalid of [NaN,Infinity,-Infinity]) {
    assert.equal(dailySetOffer(invalid),null);
    assert.equal(cosmeticCreditOffer(COSMETICS[0],invalid).price,COSMETICS[0].creditPrice);
  }
});

test('Pearl Comet daily price uses the raised tier and debits exactly the displayed amount', t => {
  t.mock.method(Date,'now',()=>dayFor('pearl_comet')); storage();
  const pearl=getCosmetic('pearl_comet'), offer=cosmeticCreditOffer(pearl);
  assert.equal(pearl.creditPrice,2750000);
  assert.equal(offer.price,2200000); assert.equal(offer.discountPercent,20);
  saveWallet(offer.price);
  assert.equal(unlockCreditCosmetic(pearl.id,{expectedPrice:offer.price}).unlocked,true);
  assert.equal(loadWallet(),0);
  assert.equal(unlockCreditCosmetic(pearl.id,{expectedPrice:offer.price}).unlocked,false);
  assert.equal(loadWallet(),0);
});

test('daily offer stays stable through reopen, refresh and the whole day, then changes at midnight', () => {
  const {startsAt,refreshesAt}=garageRotationWindow(dayAt(0));
  const today=dailySetOffer(startsAt);
  for(const now of [startsAt,startsAt+1,startsAt+3600000,refreshesAt-1]) {
    assert.deepEqual(dailySetOffer(now),today);
    const picks=garageSpotlights(COSMETICS,now);
    assert.deepEqual(garageSpotlights([...COSMETICS].reverse(),now),picks);
    assert.equal(picks[0].id,today.cosmeticId);
    assert.equal(new Set(picks.map(c=>c.id)).size,2);
  }
  const tomorrow=dailySetOffer(refreshesAt);
  assert.notEqual(tomorrow.cosmeticId,today.cosmeticId);
  assert.equal(cosmeticCreditOffer(getCosmetic(today.cosmeticId),refreshesAt).discountPercent,0);
  assert.equal(cosmeticCreditOffer(getCosmetic(tomorrow.cosmeticId),refreshesAt).discountPercent,20);
});

test('the entire cosmetic catalog gets featured and no day has duplicate cards', () => {
  const seen=new Set(),heroes=new Set();
  for(let day=0;day<COSMETICS.length;day++) {
    const picks=garageSpotlights(COSMETICS,dayAt(day));
    assert.equal(new Set(picks.map(c=>c.id)).size,2);
    heroes.add(picks[0].id);picks.forEach(c=>seen.add(c.id));
  }
  assert.equal(seen.size,COSMETICS.length);assert.equal(heroes.size,COSMETICS.length);
});

test('small and empty presentation catalogs never duplicate sets or change the canonical daily offer', () => {
  const now=dayAt(0),daily=dailySetOffer(now);
  for(let size=0;size<=6;size++) {
    const catalog=COSMETICS.slice(0,size),picks=garageSpotlights(catalog,now);
    assert.equal(picks.length,Math.min(size,2));
    assert.equal(new Set(picks.map(c=>c.id)).size,picks.length);
    assert.deepEqual(garageSpotlights([...catalog].reverse(),now),picks);
    assert.deepEqual(dailySetOffer(now),daily);
    if(catalog.some(c=>c.id===daily.cosmeticId))assert.equal(picks[0].id,daily.cosmeticId);
  }
});

test('credit picks rotate consumable packs and remain stable through missing native inventory', () => {
  const packs=[
    {id:'credits_1000',type:'consumable',credits:100000,price:'$0.79'},
    {id:'credits_5500',type:'consumable',credits:550000,price:'$2.99'},
    {id:'credits_15000',type:'consumable',credits:1500000,price:'$5.99'},
  ];
  const products=[...packs,{id:'starter_pack',type:'non_consumable',credits:200000},...COSMETICS],ids=new Set();
  for(let day=0;day<3;day++) {
    const now=dayAt(day),selected=garageCreditPack(products,now);ids.add(selected.id);
    assert.ok(packs.includes(selected));
    const refreshed=products.map(product=>({...product,available:false,price:''})).reverse();
    assert.equal(garageCreditPack(refreshed,now).id,selected.id);
    assert.equal(garageCreditPack(products,now+3600000).id,selected.id);
    assert.equal(dailySetOffer(now).cosmeticId,garageSpotlights(COSMETICS,now)[0].id);
  }
  assert.equal(ids.size,3);assert.equal(garageCreditPack(COSMETICS),undefined);
  assert.equal(garageCreditPack([packs[0]]),packs[0]);
});

test('next refresh is the real local midnight, including month and year boundaries', () => {
  for(const [year,month,day] of [[2026,10,30],[2026,11,31],[2028,1,29]]) {
    const now=new Date(year,month,day,23,59,59,999).getTime();
    assert.equal(nextGarageRefresh(now),now+1);
    assert.equal(garageRotationWindow(now+1).day,garageRotationWindow(now).day+1);
    assert.notEqual(dailySetOffer(now).cosmeticId,dailySetOffer(now+1).cosmeticId);
  }
});

test('the same local calendar date selects the same set across timezones and 23/25-hour days', t => {
  const previous=process.env.TZ;
  t.after(()=>{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;});
  const dayIds=[],setIds=[];
  for(const zone of ['UTC','Europe/Istanbul','America/New_York','Asia/Tokyo']) {
    process.env.TZ=zone;
    const now=new Date(2026,10,6,23,59,59,999).getTime(),{day,refreshesAt}=garageRotationWindow(now);
    assert.equal(refreshesAt,now+1);dayIds.push(day);setIds.push(dailySetOffer(now).cosmeticId);
  }
  assert.equal(new Set(dayIds).size,1);assert.equal(new Set(setIds).size,1);
  process.env.TZ='America/New_York';
  for(const [month,day,hours] of [[2,8,23],[10,1,25]]) {
    const now=new Date(2026,month,day).getTime(),next=garageRotationWindow(now).refreshesAt;
    assert.equal(next-now,hours*3600000);
    assert.equal(dailySetOffer(now).endsAt,next);
    assert.notEqual(dailySetOffer(now).cosmeticId,dailySetOffer(next).cosmeticId);
  }
});

test('credit purchase debits the displayed daily price once and rejects stale quotes before mutation', t => {
  const now=dayAt(0);t.mock.method(Date,'now',()=>now);storage();
  const cosmetic=getCosmetic(dailySetOffer(now).cosmeticId),offer=cosmeticCreditOffer(cosmetic);
  saveWallet(offer.price-1);
  assert.throws(()=>unlockCreditCosmetic(cosmetic.id,{expectedPrice:offer.price}),/Not enough/);
  assert.equal(loadWallet(),offer.price-1);
  saveWallet(offer.price+77);
  assert.throws(()=>unlockCreditCosmetic(cosmetic.id,{expectedPrice:cosmetic.creditPrice}),/offer has changed/);
  assert.equal(loadWallet(),offer.price+77);assert.equal(Boolean(getCosmeticOwnership()[cosmetic.id]),false);
  assert.equal(unlockCreditCosmetic(cosmetic.id,{expectedPrice:offer.price}).unlocked,true);
  assert.equal(loadWallet(),77);assert.equal(getCosmeticOwnership()[cosmetic.id],true);
  assert.equal(unlockCreditCosmetic(cosmetic.id,{expectedPrice:offer.price}).unlocked,false);assert.equal(loadWallet(),77);
});

test('midnight never silently charges a higher price and pending store approval blocks credit spending', t => {
  let now=dayAt(0);t.mock.method(Date,'now',()=>now);storage();
  const cosmetic=getCosmetic(dailySetOffer(now).cosmeticId),quote=cosmeticCreditOffer(cosmetic);
  saveWallet(cosmetic.creditPrice+100);
  now=quote.endsAt;
  assert.throws(()=>unlockCreditCosmetic(cosmetic.id,{expectedPrice:quote.price}),/offer has changed/);
  assert.equal(loadWallet(),cosmetic.creditPrice+100);assert.equal(Boolean(getCosmeticOwnership()[cosmetic.id]),false);
  now=dayAt(0);markCosmeticPending(cosmetic.productId);
  assert.throws(()=>unlockCreditCosmetic(cosmetic.id,{expectedPrice:quote.price}),/awaiting approval/);
  assert.equal(loadWallet(),cosmetic.creditPrice+100);
});
