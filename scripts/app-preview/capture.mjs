import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const device = process.argv[2];
if (!device) throw new Error('Pass the dedicated capture simulator UUID.');
const toolsDir = process.env.PREVIEW_TOOLS_DIRECTORY || '/tmp/neo-app-preview-tools';
const { RemoteDebugger } = await import(pathToFileURL(path.join(toolsDir, 'node_modules/appium-remote-debugger/build/lib/index.js')));
const launch = execFileSync('xcrun', ['simctl','spawn',device,'launchctl','print','system/com.apple.webinspectord'], {encoding:'utf8'});
const socketPath = launch.match(/path = (\S+webinspectord_sim.socket)/)[1];
const quiet = Object.fromEntries(['debug','info','warn','error','errorAndThrow'].map(name=>[name,()=>{}]));
const d = new RemoteDebugger({bundleId:'com.cgtygrssgame.neonglide',additionalBundleIds:['process-App'],isSafari:false,platformVersion:'27.0',socketPath,log:quiet});
const wait = ms=>new Promise(resolve=>setTimeout(resolve,ms));
await d.connect(); await wait(1000);
const pages = await d.selectApp(null,3);
const page = pages.find(p=>p.url?.startsWith('capacitor:'));
if (!page) throw new Error('No inspectable Neo Glide view found.');
const [appId,pageId]=page.id.split('.'); await d.selectPage(appId,pageId,true);
const js = expression=>d.execute(expression,false,{emulateUserGesture:true});
const click = label=>js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')===${JSON.stringify(label)}||b.innerText.trim()===${JSON.stringify(label)})&&b.getBoundingClientRect().width);if(!b)throw new Error('Missing visible button: '+${JSON.stringify(label)});b.click();return b.innerText})()`);
const out=path.resolve('release/1.2.1/app-preview/source');fs.mkdirSync(out,{recursive:true});
const manifest={device,capturedAt:new Date().toISOString(),source:'Submitted build 8 web assets in native iOS simulator; normal game controls only',shots:[]};
async function record(name,action) {
 const file=path.join(out,name+'.mov'); const video=spawn('xcrun',['simctl','io',device,'recordVideo','--codec=h264','--mask=ignored','--force',file]);
 let ready=false;video.stderr.on('data',data=>{if(String(data).includes('Recording started'))ready=true;});
 for(let i=0;i<100&&!ready;i++)await wait(100);
 if(!ready)throw new Error('Native recording did not start');
 const started=Date.now(); console.log('Recording',name);
 let details;
 try{details=await action();}finally{video.kill('SIGINT');await new Promise(resolve=>video.once('exit',resolve));}
 manifest.shots.push({file:path.basename(file),durationWall:(Date.now()-started)/1000,...details});
 fs.writeFileSync(path.join(out,'capture-manifest.json'),JSON.stringify(manifest,null,2));console.log('Saved',name);
}
try {
 await js('window.previewPilot?.stop()');
 const ui=await js('document.body.innerText');
 if(ui.includes('FLIGHT EARNINGS'))await click('Back to home');
 else if(!ui.includes('YOUR SHIP')) {await js("window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape',bubbles:true}));'paused'");await wait(300);await click('Back to home');}
 await wait(1200);
 for(let take=5;take<=5;take++) {
  await click('Play');await wait(1800);
  await record('iphone-flight-take'+take, async()=>{
   await js(fs.readFileSync(new URL('./pilot.js',import.meta.url),'utf8'));
   await wait(35000);
   const observations=await js('window.previewPilot.observations');
   await js("window.previewPilot.stop();window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape',bubbles:true}));'paused'");
   return {observations};
  });
  const text=await js('document.body.innerText');
  if(text.includes('FLIGHT EARNINGS'))await click('Back to home');else await click('Back to home');
  await wait(800);
 }
 await click('Garage');await wait(900);
 await click('Ships');await wait(900);
 await record('iphone-ships',async()=>{
  await wait(1800);await click('Next ship');await wait(2000);await click('Next ship');await wait(2000);await click('Next ship');await wait(2200);
  return {finalUI:await js('document.body.innerText')};
 });
 await click('Galaxies');await wait(1000);
 await record('iphone-galaxies',async()=>{
  await wait(1800);await click('Next galaxy');await wait(2000);await click('Next galaxy');await wait(2200);
  return {finalUI:await js('document.body.innerText')};
 });
 await click('Back to home');
} finally {await d.disconnect();}
