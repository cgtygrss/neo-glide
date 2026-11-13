import test from 'node:test';
import assert from 'node:assert/strict';
import { createStartupTimeline } from '../src/game/StartupTimeline.js';

function clock(reducedMotion=false) {
  let time=0,id=0;
  const tasks=new Map(),events=[];
  const timeline=createStartupTimeline({reducedMotion,now:()=>time,
    setTimer:(callback,delay)=>{const key=++id;tasks.set(key,{at:time+delay,callback});return key;},clearTimer:key=>tasks.delete(key)});
  const advance=ms=>{
    const target=time+ms;
    while(true) {
      const next=[...tasks.entries()].sort((a,b)=>a[1].at-b[1].at)[0];
      if(!next || next[1].at>target) break;
      tasks.delete(next[0]);time=next[1].at;next[1].callback();
    }
    time=target;
  };
  const subscribe=()=>timeline.subscribe(()=>events.push(timeline.getSnapshot()));
  return {timeline,events,tasks,advance,subscribe,jump:ms=>{time+=ms;}};
}

test('the opening has a 1550ms presentation followed by a 250ms exit and finishes once',()=>{
  const c=clock();c.subscribe();
  c.advance(1549);assert.equal(c.timeline.getSnapshot(),'intro');
  c.advance(1);assert.equal(c.timeline.getSnapshot(),'exit');
  c.advance(249);assert.equal(c.timeline.getSnapshot(),'exit');
  c.advance(1);assert.equal(c.timeline.getSnapshot(),'done');
  c.advance(10000);c.timeline.refresh();c.timeline.skip();
  assert.deepEqual(c.events,['exit','done']);assert.equal(c.tasks.size,0);
});

test('skip exits in 250ms and repeated skip gestures never extend the deadline',()=>{
  const c=clock();c.subscribe();c.advance(100);c.timeline.skip();
  assert.equal(c.timeline.getSnapshot(),'exit');
  c.advance(100);c.timeline.skip();c.advance(149);
  assert.equal(c.timeline.getSnapshot(),'exit');
  c.advance(1);assert.equal(c.timeline.getSnapshot(),'done');
  assert.deepEqual(c.events,['exit','done']);
});

test('a late skip preserves the already approaching completion time',()=>{
  const c=clock();c.subscribe();c.advance(1500);c.timeline.skip();
  c.advance(250);assert.equal(c.timeline.getSnapshot(),'done');
  const other=clock();other.subscribe();other.advance(1700);other.timeline.skip();
  other.advance(100);assert.equal(other.timeline.getSnapshot(),'done');
});

test('reduced motion uses a single 300ms fade without the cinematic hold',()=>{
  const c=clock(true);c.subscribe();
  assert.equal(c.timeline.getSnapshot(),'exit');c.advance(299);
  assert.equal(c.timeline.getSnapshot(),'exit');c.advance(1);
  assert.equal(c.timeline.getSnapshot(),'done');assert.deepEqual(c.events,['exit','done']);
});

test('StrictMode cleanup and resubscription retain the original clock and clear abandoned timers',()=>{
  const c=clock();const stop=c.subscribe();c.advance(500);stop();
  assert.equal(c.tasks.size,0);
  c.advance(500);const stopAgain=c.subscribe();
  assert.equal(c.tasks.size,1);c.advance(550);assert.equal(c.timeline.getSnapshot(),'exit');
  c.advance(250);assert.equal(c.timeline.getSnapshot(),'done');stopAgain();
  c.subscribe();assert.equal(c.timeline.getSnapshot(),'done');assert.equal(c.tasks.size,0);
});

test('foreground return catches up a suspended timer immediately without replaying the intro',()=>{
  const c=clock();c.subscribe();c.advance(100);c.jump(10000);c.timeline.refresh();
  assert.equal(c.timeline.getSnapshot(),'done');assert.equal(c.tasks.size,0);
  assert.deepEqual(c.events,['done']);
  c.timeline.refresh();c.timeline.skip();assert.deepEqual(c.events,['done']);
});

test('another subscriber cannot restart the opening or multiply scheduled work',()=>{
  const c=clock();const stop=c.subscribe();c.advance(500);
  let second=0;const stopSecond=c.timeline.subscribe(()=>second++);
  assert.equal(c.tasks.size,1);c.advance(1050);stop();
  assert.equal(c.tasks.size,1);c.advance(250);assert.equal(second,2);
  stopSecond();assert.equal(c.tasks.size,0);
});
