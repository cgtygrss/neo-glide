import { RequestError } from './errors.js';
export const DAY = 86400000;
export const GRACE = DAY;
export const dayOf = now => Math.floor(now / DAY);
export const DEFAULT_TEMPLATES = [
  { id: 'daily', type: 'daily', title: 'Daily Pilot Missions', goals: [{stat:'seconds',target:300},{stat:'distance',target:3000},{stat:'coins',target:20000}], rewards:[5000,5000,5000,5000] },
  { id: 'weekly', type: 'weekly', title: 'Weekly Capsule Hunt', goals:[15,35,60,100].map(target=>({stat:'fragments',target})), rewards:[5000,10000,15000,25000], cosmetic:'nebula_circuit' },
  { id: 'expedition', type:'expedition', title:'Galaxy Expedition', goals:[{stat:'seconds',target:180},{stat:'distance',target:5000},{stat:'coins',target:30000},{stat:'capsules',target:3},{stat:'bosses',target:1},{stat:'seconds',target:300},{stat:'distance',target:5000,secondary:{stat:'capsules',target:2}}], rewards:Array(7).fill(5000), cosmetic:'aurora_pathfinder' }
];
export const STATS = ['seconds','distance','coins','capsules','bosses','eliteBosses'];
export const emptyStats = () => Object.fromEntries(STATS.map(key=>[key,0]));
export function windowFor(type, now) {
  const start = type === 'weekly' ? (dayOf(now) - ((new Date(now).getUTCDay()+6)%7))*DAY : dayOf(now)*DAY;
  return { start, end: start + (type === 'weekly' ? 7 : 1)*DAY };
}
export function createInstance(template, now) {
  const window = template.type === 'expedition' ? {start:now,end:now+14*DAY} : windowFor(template.type,now);
  return { ...structuredClone(template), ...window, instanceId:`${template.id}:${template.revision || 1}:${window.start}`, stats:emptyStats(), claims:{}, bonuses:{}, fragments:0, card:0, nextDay:dayOf(now), enrolledAt:now };
}
export function validateRun(value) {
  if (!value || typeof value.runId !== 'string' || !/^[\w-]{8,100}$/.test(value.runId)) throw new RequestError('Invalid flight ID.');
  const stats = emptyStats();
  for (const key of STATS) {
    if(key==='eliteBosses'&&value[key]===undefined){stats[key]=0;continue;}
    if (!Number.isFinite(value[key]) || value[key]<0) throw new RequestError('Invalid flight counters.');
    stats[key] = key==='seconds' ? value[key] : Math.floor(value[key]);
  }
  validateCounters(stats);
  return {...stats,runId:value.runId};
}
function validateCounters(stats) {
  if(stats.eliteBosses>stats.bosses)throw new RequestError('Flight counters exceed limits.');
  if ((stats.seconds === 0 && STATS.slice(1).some(key => stats[key] > 0)) || stats.seconds>86402 || stats.distance>stats.seconds*1000+100 || stats.coins>stats.seconds*200000+20000 || stats.capsules>stats.seconds/2+1 || stats.bosses>stats.seconds/2+1) throw new RequestError('Flight counters exceed limits.');
}
// Charge startup tolerances once per account/UTC day, not once per run/lease.
export function accumulateFlightUsage(usage = {}, delta, lease, now, accountStart) {
  const day = dayOf(lease.start), start = Math.max(day * DAY, accountStart || lease.start);
  const current = usage[day] || emptyStats();
  const total = Object.fromEntries(STATS.map(key => [key, current[key] + delta[key]]));
  if (total.seconds > Math.min(DAY, Math.max(0, (now - start) / 1000)) + 2) throw new RequestError('Offline flight time exceeds authorization.');
  validateCounters(total);
  return { ...Object.fromEntries(Object.entries(usage).filter(([key]) => Number(key) >= dayOf(now) - 2)), [day]: total };
}
export function chargeFlightClock(usedSeconds = 0, deltaSeconds, start, now) {
 const total=usedSeconds+deltaSeconds;
 if(total>Math.max(0,(now-start)/1000)+2)throw new RequestError('Offline flight time exceeds authorization.');
 return total;
}
export function deltaRun(current, previous=emptyStats()) {
  const delta=emptyStats();
  for(const key of STATS) delta[key]=Math.max(0,current[key]-(previous[key]||0));
  return delta;
}
export function contribute(instance, delta, now) {
  if(instance.type==='expedition' && (instance.card>=7 || dayOf(now)<instance.nextDay)) return instance;
  for(const key of STATS) instance.stats[key]=(instance.stats[key]||0)+delta[key];
  return instance;
}
export const meets = (stats,goal) => stats[goal.stat]>=goal.target && (!goal.secondary || meets(stats,goal.secondary));
export function ready(instance,index,now) {
  if(now>instance.end+GRACE || instance.claims[index] || !Number.isInteger(index) || index<0) return false;
  if(instance.type==='daily' && index===3) return [0,1,2].every(i=>meets(instance.stats,instance.goals[i]));
  if(index>=instance.goals.length) return false;
  if(instance.type==='expedition' && (index!==instance.card || dayOf(now)<instance.nextDay)) return false;
  const stats=instance.type==='weekly'?{fragments:instance.fragments}:instance.stats;
  return meets(stats,instance.goals[index]);
}
export function claim(instance,index,now,owned={}) {
  if(!ready(instance,index,now)) throw new RequestError('Reward is not ready.');
  instance.claims[index]=now;
  let credits=instance.rewards[index], cosmetic='';
  if(instance.cosmetic && index===instance.goals.length-1) {
    if(owned[instance.cosmetic]) credits+=25000;
    else cosmetic=instance.cosmetic;
  }
  if(instance.type==='expedition') { instance.card++; instance.nextDay=dayOf(now)+1; instance.stats=emptyStats(); }
  return {id:`${instance.instanceId}:${index}`,credits,cosmetic,baseCredits:instance.rewards[index],instanceId:instance.instanceId,index};
}
export function validateTemplate(input) {
  const base=DEFAULT_TEMPLATES.find(t=>t.type===input?.type);
  if(!base || typeof input.title!=='string' || input.title.length<1 || input.title.length>80) throw new RequestError('Invalid event title/type.');
  if(!Array.isArray(input.goals) || input.goals.length!==base.goals.length || !Array.isArray(input.rewards) || input.rewards.length!==base.rewards.length) throw new RequestError('Invalid event targets.');
  for(const [index,goal] of input.goals.entries()) {
    if(goal.stat!==base.goals[index].stat)throw new RequestError('Unsupported goal type for this event.');
    if(![...STATS,'fragments'].includes(goal.stat) || !Number.isSafeInteger(goal.target) || goal.target<1 || goal.target>10000000) throw new RequestError('Invalid goal.');
    if(goal.secondary && (!STATS.includes(goal.secondary.stat) || !Number.isSafeInteger(goal.secondary.target) || goal.secondary.target<1)) throw new RequestError('Invalid secondary goal.');
  }
  if(input.rewards.some(n=>!Number.isSafeInteger(n)||n<0||n>1000000)) throw new RequestError('Invalid credit reward.');
  if(input.cosmetic && !['nebula_circuit','aurora_pathfinder'].includes(input.cosmetic)) throw new RequestError('Unknown event cosmetic.');
  if(!Number.isFinite(input.startsAt)||!Number.isFinite(input.endsAt)||input.endsAt<=input.startsAt) throw new RequestError('Invalid schedule.');
  if(input.minVersion&&!/^\d+\.\d+\.\d+$/.test(input.minVersion))throw new RequestError('Invalid minimum client version.');
  return {id:base.id,type:base.type,title:input.title,goals:input.goals,rewards:input.rewards,cosmetic:input.cosmetic||'',startsAt:input.startsAt,endsAt:input.endsAt,minVersion:input.minVersion||'1.2.0'};
}
