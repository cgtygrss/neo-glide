import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, chargeRequest,requireUid } from '../request-security.js';
import { publicError } from '../shared/errors.js';
import { validateSave, equivalentSave } from '../shared/save.js';
import { initialOnlineSave,protectEconomicSave } from '../shared/online-economy.js';
import { validateRun, emptyStats, accumulateFlightUsage, chargeFlightClock, DAY } from '../shared/events.js';

const request=(action,body)=>validateRequest({path:`/api/${action}`,body});
test('authenticated identifiers cannot address other database paths',()=>{
 for(const uid of ['../victim','one/two','',null,'x'.repeat(129)])assert.throws(()=>requireUid(uid));
 assert.equal(requireUid('firebase-UID_123'),'firebase-UID_123');
});
test('request schema bounds paths, proofs, IDs and unexpected fields before database access',()=>{
 assert.equal(request('sync',{version:'1.3.0'}).action,'sync');
 assert.equal(request('resolve',{data:{},revision:0,operationId:'older-client-operation'}).action,'resolve');
 for(const [action,body] of [['sync',{uid:'victim'}],['save',{data:{},revision:-1,operationId:'x'}],['save',{data:{},revision:0,operationId:'../x'}],['purchase',{platform:'ios',productId:'starter_pack',transactionId:'1',signedTransaction:'a'.repeat(32769)}],['reconcilePurchases',{revocations:Array(201).fill({})}],['flight',{lease:'x',instances:['x','x']}]])assert.throws(()=>request(action,body));
 assert.throws(()=>validateRequest({path:'/api/deleteAccount/extra',body:{}}));
 assert.throws(()=>request('resolve',{revision:0,data:{huge:'a'.repeat(524288)}}),error=>error.status===413);
});
test('account budgets survive new operation IDs, enforce independent windows and recover next day',()=>{
 const now=DAY*100+60000;
 let budget;
 for(let i=0;i<12;i++)budget=chargeRequest(budget,'resolve',now+i*60000);
 assert.throws(()=>chargeRequest(budget,'resolve',now+13*60000),error=>error.status===429);
 assert.equal(chargeRequest(budget,'sync',now+13*60000).actions.sync,1);
 assert.equal(chargeRequest(budget,'resolve',now+DAY).actions.resolve,1);
 budget=undefined;
 for(let i=0;i<120;i++)budget=chargeRequest(budget,'sync',now);
 assert.throws(()=>chargeRequest(budget,'sync',now),error=>error.status===429);
 assert.equal(chargeRequest(budget,'sync',now+60000).minuteCount,1);
});
test('opaque provider errors never disclose tokens, receipt URLs or database internals',()=>{
 const failure=publicError(new Error('https://provider.test/tokens/private-receipt?secret=abc'));
 assert.deepEqual(failure,{status:400,body:{error:'Request could not be completed.',code:'request-failed'}});
 assert.equal(publicError({code:'auth/id-token-revoked'}).status,401);
});
test('save rejects oversized ledgers, prototype keys and deeply nested JSON',()=>{
 const save=wallet=>({neon_glide_wallet_v3:JSON.stringify({version:3,balance:0,...wallet})});
 assert.throws(()=>validateSave(save({transactions:Object.fromEntries(Array.from({length:2049},(_,i)=>[i,'credits_small']))})));
 assert.throws(()=>validateSave(save({transactions:{x:{large:'payload'}}})));
 assert.throws(()=>validateSave({neon_glide_upgrades:'{"__proto__":{"polluted":true}}'}));
 assert.throws(()=>validateSave({neon_glide_upgrades:'['.repeat(30)+'0'+']'.repeat(30)}));
 assert.throws(()=>validateSave(save({starterCreditsGranted:'yes'})));
 const fresh=initialOnlineSave(null,[],'Production');
 const before={...fresh,...save({...JSON.parse(fresh.neon_glide_wallet_v3),transactions:{real:'starter_pack'}})},incoming=save({transactions:{forged:'starter_pack'}});
 assert.doesNotThrow(()=>validateSave(save({transactions:{'GPA.1234-5678-9012-34567':'cosmetic_void_pilot'}})));
 assert.deepEqual(JSON.parse(protectEconomicSave(incoming,before).neon_glide_wallet_v3).transactions,{real:'starter_pack'});
 assert.equal(equivalentSave({neon_glide_upgrades:'{"a":1,"b":2}'},{neon_glide_upgrades:'{ "b":2,"a":1 }'}),true);
});
test('zero-time flight rewards and per-run startup-tolerance farming are rejected',()=>{
 const start=DAY*100+3600000,lease={start};
 for(const stat of ['distance','coins','capsules','bosses'])assert.throws(()=>validateRun({runId:'zero-flight',...emptyStats(),[stat]:1}));
 const delta={...emptyStats(),seconds:0.01,distance:100,capsules:1,bosses:1};
 const usage=accumulateFlightUsage({},delta,lease,start+1000,start);
 assert.throws(()=>accumulateFlightUsage(usage,delta,lease,start+1000,start));
 assert.equal(chargeFlightClock(10,0,start,start+10000),10);
 assert.throws(()=>chargeFlightClock(10,3,start,start+10000));
 // Starting a new lease/day cannot reset the lifetime elapsed-time allowance.
 assert.throws(()=>chargeFlightClock(86400,86400,start,start+DAY+1000));
});
