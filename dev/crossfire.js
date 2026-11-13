import { Player, Villain, SpeedsterVillain, JuggernautVillain } from '../src/game/Entities.js';
import { Renderer } from '../src/game/Renderer.js';
import { advanceEnemyAttacks, createEnemyVolley, enemyAttackPace, flightDifficulty } from '../src/game/FlightDifficulty.js';
import { drawScoutAim } from '../src/game/ScoutAttack.js';

const canvas=document.querySelector('canvas'), renderer=new Renderer(canvas), ctx=renderer.ctx;
const stage=document.querySelector('select'), pause=document.querySelector('#pause'), status=document.querySelector('output');
let game,elapsed=0,emitted=0,peakWarnings=0,peakShots=0,paused=false,pausedOnMixed=false,frame,last=performance.now();
function reset() {
  const count=flightDifficulty(Number(stage.value),390).maxEnemies;
  const types=[Villain,SpeedsterVillain,JuggernautVillain,SpeedsterVillain];
  const enemies=types.slice(0,count).map((Enemy,lane)=>Object.assign(new Enemy(690,0),{state:'ATTACKING',attackTimer:10,encounterLane:lane}));
  const total=enemies.reduce((height,enemy)=>height+enemy.height,0)+32*(count-1);
  let cursor=(390-total)/2;
  for (const enemy of enemies) { enemy.y=cursor+enemy.height/2; cursor+=enemy.height+32; }
  const player=new Player(); player.y=195;
  game={phase:'FLYING',flightTime:Number(stage.value),player,enemies,projectiles:[]};
  elapsed=0;emitted=0;peakWarnings=0;peakShots=0;paused=false;pausedOnMixed=false;pause.textContent='Pause simulation';
}
stage.addEventListener('change',reset); document.querySelector('#restart').addEventListener('click',reset);
pause.addEventListener('click',()=>{paused=!paused;game.phase=paused?'PAUSED':'FLYING';pause.textContent=paused?'Resume simulation':'Pause simulation';});
function tick(now) {
  const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  if (!paused) {
    elapsed+=dt; game.flightTime=Number(stage.value)+elapsed;
    game.player.y=195+Math.sin(elapsed*1.7)*90;
    for (const enemy of game.enemies) { enemy.attackTimer+=dt;enemy.oscillation+=dt*2; }
    const firing=advanceEnemyAttacks(game,dt);
    emitted+=firing.length;
    for (const enemy of firing) game.projectiles.push(...createEnemyVolley(game,enemy));
    for (const shot of game.projectiles) shot.update(dt);
    game.projectiles=game.projectiles.filter(shot=>!shot.markedForDeletion);
    peakWarnings=Math.max(peakWarnings,game.enemyAttackWarnings.length);peakShots=Math.max(peakShots,game.projectiles.length);
    const mixed=['SCOUT_BEAM','SONIC_BLADE','FUSE'].every(type=>game.projectiles.some(shot=>shot.type===type));
    if (mixed && !pausedOnMixed && document.querySelector('#auto-pause').checked) { paused=true;pausedOnMixed=true;game.phase='PAUSED';pause.textContent='Resume simulation'; }
  }
  renderer.drawBackground(650,paused?0:dt);
  for (const enemy of game.enemies) renderer.drawVillain(enemy);
  renderer.drawPlayer(game.player);
  for (const enemy of game.enemies) drawScoutAim(ctx,enemy);
  renderer.drawProjectiles(game.projectiles);
  const pace=enemyAttackPace(game.flightTime);
  status.textContent=`${paused?'Paused':'Running'} · ${game.enemies.length} enemies · ${emitted} volleys emitted · ${game.projectiles.length} live shots · Peak ${peakWarnings} parallel charges / ${peakShots} live shots · ${elapsed.toFixed(2)}s · Shot cap ${pace.maxProjectiles}`;
  frame=requestAnimationFrame(tick);
}
reset();frame=requestAnimationFrame(tick);
window.addEventListener('pagehide',()=>cancelAnimationFrame(frame),{once:true});
