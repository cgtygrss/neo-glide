import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdAudioRecovery} from '../src/services/AdAudioRecovery.js';
import {presentRewardedAd} from '../src/services/AdMobService.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function fixture(t,{captureFails=false,restoreFails=false}={}) {
  const calls=[],events=[],timers=new Map();let hidden=false,id=0;
  const audio=createAdAudioRecovery({
    capture:async()=>{calls.push('capture');if(captureFails)throw new Error('capture unavailable');},
    restore:async()=>{calls.push('restore');if(restoreFails)throw new Error('session busy');return {restored:true};},
    isForeground:()=>!hidden,
    schedule:(fn,delay)=>{const key=++id;timers.set(key,{fn,delay});return key;},
    cancel:key=>timers.delete(key),
  });
  audio.subscribe(event=>events.push(event));t.after(()=>audio.dispose());
  return {audio,calls,events,timers,hidden:value=>{hidden=value;},tick:async()=>{for(const [key,{fn}]of [...timers]){timers.delete(key);fn();}await flush();}};
}

test('capture precedes the first ad; audio resumes only after dismissal, never at reward delivery',async t=>{
  const f=fixture(t),listeners=new Map(),events={Rewarded:'reward',Dismissed:'dismiss',FailedToShow:'fail'};
  const result=f.audio.run(()=>presentRewardedAd({events,adMob:{addListener:async(name,fn)=>{listeners.set(name,fn);return {remove:async()=>{}};}},show:async()=>f.calls.push('show')}));
  await flush();assert.deepEqual(f.calls,['capture','show']);assert.deepEqual(f.events,[{active:true}]);
  listeners.get('reward')();await flush();assert.deepEqual(f.calls,['capture','show']);
  listeners.get('dismiss')();assert.equal(await result,true);await flush();
  assert.deepEqual(f.calls,['capture','show','restore']);assert.deepEqual(f.events.at(-1),{active:false,reset:true});
  assert.deepEqual([...f.timers.values()].map(v=>v.delay),[250,1000]);
  await f.tick();assert.equal(f.calls.filter(c=>c==='restore').length,3);
  assert.equal(f.timers.size,0);assert.deepEqual(f.events.at(-1),{active:false,reset:false});
});

test('skipped, failed-to-load and failed-to-show ads all release game audio without altering outcomes',async t=>{
  const f=fixture(t);assert.equal(await f.audio.run(async()=>false),false);await flush();
  for(const message of ['load failed','show failed']) {
    const error=new Error(message);await assert.rejects(f.audio.run(async()=>{throw error;}),supplied=>supplied===error);await flush();
    assert.deepEqual(f.events.at(-1),{active:false,reset:true});
  }
  assert.equal(f.calls.filter(c=>c==='capture').length,3);
  assert.equal(f.calls.filter(c=>c==='restore').length,3);
});

test('native audio failure cannot lose an earned reward, and retries are bounded',async t=>{
  const f=fixture(t,{captureFails:true,restoreFails:true});
  f.audio.subscribe(()=>{throw new Error('bad listener');});
  assert.equal(await f.audio.run(async()=>true),true);await flush();await f.tick();
  assert.equal(f.calls.filter(c=>c==='restore').length,3);assert.equal(f.timers.size,0);
  assert.deepEqual(f.events.at(-1),{active:false,reset:false});
});

test('background dismissal stays quiet until foreground recovery; disposal cancels retries',async t=>{
  const f=fixture(t),ad=deferred();const result=f.audio.run(()=>ad.promise);await flush();
  f.hidden(true);ad.resolve(true);assert.equal(await result,true);await f.tick();
  assert.deepEqual(f.calls,['capture']);assert.deepEqual(f.events,[{active:true}]);
  f.hidden(false);f.audio.foreground();await flush();assert.deepEqual(f.events.at(-1),{active:false,reset:true});
  f.audio.dispose();assert.equal(f.timers.size,0);f.audio.foreground();await flush();
  assert.equal(f.calls.filter(c=>c==='restore').length,1);
});

test('overlapping requests share the original snapshot and a new ad cancels old late recovery',async t=>{
  const f=fixture(t),one=deferred(),two=deferred();
  const first=f.audio.run(()=>one.promise),second=f.audio.run(()=>two.promise);await flush();
  assert.deepEqual(f.calls,['capture']);assert.deepEqual(f.events,[{active:true}]);
  one.resolve(true);await first;assert.deepEqual(f.calls,['capture']);
  two.resolve(false);await second;await flush();assert.equal(f.timers.size,2);
  const third=deferred(),last=f.audio.run(()=>third.promise);await flush();
  assert.equal(f.timers.size,0);assert.deepEqual(f.events.at(-1),{active:true});
  third.resolve(true);await last;await flush();assert.deepEqual(f.events.at(-1),{active:false,reset:true});
});

test('a late native restore response cannot unmute a newer ad',async t=>{
  const restore=deferred(),ad=deferred(),events=[];
  const audio=createAdAudioRecovery({restore:()=>restore.promise,schedule:()=>1,cancel:()=>{}});
  t.after(()=>audio.dispose());audio.subscribe(event=>events.push(event));
  await audio.run(async()=>true);const next=audio.run(()=>ad.promise);await flush();
  restore.resolve({restored:true});await flush();assert.ok(events.every(event=>event.active));
  ad.resolve(false);await next;
});

test('dismissal before iOS becomes active waits for a late native session restore',async t=>{
  let active=false,id=0;const events=[],timers=new Map();
  const audio=createAdAudioRecovery({restore:async()=>({restored:active}),schedule:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},cancel:key=>timers.delete(key)});
  t.after(()=>audio.dispose());audio.subscribe(event=>events.push(event));
  assert.equal(await audio.run(async()=>true),true);await flush();
  assert.deepEqual(events,[{active:true}]);
  active=true;const retry=[...timers.values()].find(timer=>timer.delay===250);retry.fn();await flush();
  assert.deepEqual(events.at(-1),{active:false,reset:true});
});
