import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { guardOutstanding, resumeAction } from './release-policy.mjs';

const base = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}`;
async function github(path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(`GitHub release ledger ${method} failed: ${response.status}`);
  return response.status === 204 ? null : response.json();
}
const identity=existsSync('ci-output/identity.json')?JSON.parse(readFileSync('ci-output/identity.json')):null;
const command = process.argv[2], store = process.argv[3];
if(command==='acknowledge'&&!['store','device-test'].includes(process.env.REVIEW_CHANNEL||'store'))throw new Error('Unknown review channel.');
const deviceTest=command==='acknowledge'?process.env.REVIEW_CHANNEL==='device-test':identity?.mode==='device-test';
const channel=deviceTest?'device-test':'store';
const submittedDescriptions=['Submitted; awaiting store review','Submitted to internal test; Console availability pending','Available to internal TestFlight group'];
async function records(store,kind=channel) {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await github(`/deployments?environment=${store}-${kind}&per_page=100&page=${page}`);
    for (const deployment of batch) {
      const statuses = await github(`/deployments/${deployment.id}/statuses?per_page=100`);
      all.push({ ...deployment.payload, id: deployment.id, state: statuses[0]?.state || 'pending', submitted: statuses.some(s => submittedDescriptions.includes(s.description)) });
    }
    if (batch.length < 100) break;
  }
  return all;
}
async function status(id, state, description) {
  return github(`/deployments/${id}/statuses`, 'POST', { state, description, auto_inactive: false, log_url: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` });
}
if (command === 'check') {
  for (const name of ['android', 'ios']) {
    const candidate = JSON.parse(readFileSync(`ci-output/${name}.json`));
    const storeRecords=await records(name,'store'),testRecords=await records(name,'device-test');
    const outstanding=[...storeRecords,...testRecords];
    guardOutstanding(name==='android'?outstanding:[...testRecords,...storeRecords.filter(r=>!r.submitted)],candidate);
    const own = outstanding.find(r => r.run === candidate.run && r.build === candidate.build);
    if (own) {resumeAction(own, candidate);if((own.channel||'store')!==channel)throw new Error('Cannot change the distribution channel of an existing release run.');}
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}_resume=${Boolean(own)}\n`);
    if (name === 'android' && !storeRecords.some(r => r.build === '5' && ['success', 'failure', 'inactive'].includes(r.state))) throw new Error('Existing Play build 5 needs a Console review-result acknowledgement before the first CI submission.');
  }
} else if (command === 'begin') {
  const candidate = JSON.parse(readFileSync(`ci-output/${store}.json`));
  const all = await records(store);
  const others=await records(store,deviceTest?'store':'device-test');
  const previousChannel=others.find(r=>r.run===candidate.run);
  if(previousChannel)throw new Error('Cannot change the distribution channel of an existing release run.');
  guardOutstanding(store==='android'?[...all,...others]:[...all.filter(r=>deviceTest||!r.submitted),...others.filter(r=>!deviceTest||!r.submitted)],candidate);
  let record = all.find(r => r.run === candidate.run && r.commit === candidate.commit && r.build === candidate.build && r.sha256 === candidate.sha256);
  if (!record) {
    const deployment = await github('/deployments', 'POST', { ref: candidate.commit, task: 'deploy', auto_merge: false, required_contexts: [], environment: `${store}-${channel}`, description: `Neo Glide ${candidate.version} (${candidate.build})`, production_environment: !deviceTest && (store === 'ios' || JSON.parse(readFileSync('ci/release.json')).androidTrack === 'production'), payload: { ...candidate, store, channel } });
    record = { ...candidate, id: deployment.id, submitted: false };
    await status(record.id, 'in_progress', 'Upload started; retry this run if interrupted');
  }
  resumeAction(record,candidate);
  appendFileSync(process.env.GITHUB_OUTPUT, `deployment=${record.id}\nsubmitted=${record.submitted}\n`);
} else if (command === 'submitted') {
  if(store==='ios'&&!deviceTest&&identity.iosSubmitForReview===false){
    await status(process.env.DEPLOYMENT_ID,'in_progress','Uploaded; App Store review pending manual submission');
  }else{
    await status(process.env.DEPLOYMENT_ID,deviceTest&&store==='ios'?'success':'in_progress',deviceTest?(store==='ios'?'Available to internal TestFlight group':'Submitted to internal test; Console availability pending'):'Submitted; awaiting store review');
  }
} else if (command === 'acknowledge') {
  if (process.env.GITHUB_REF !== 'refs/heads/main' || process.env.CONSOLE_CHECKED !== 'true') throw new Error('Only a manually confirmed main run may acknowledge review.');
  const build = process.env.REVIEWED_BUILD;
  if (!/^\d+$/.test(build)) throw new Error('Invalid reviewed build number.');
  const all = await records('android');
  let matching = all.filter(r => r.build === build);
  if (!matching.length) {
    if (build !== '5'||deviceTest) throw new Error('No matching pipeline release exists.');
    const deployment = await github('/deployments', 'POST', { ref: process.env.GITHUB_SHA, auto_merge: false, required_contexts: [], environment: 'android-store', production_environment: false, payload: { store: 'android', build: '5', version: '1.3.0', baseline: true } });
    matching = [{ id: deployment.id }];
  }
  for (const record of matching) await status(record.id, process.env.REVIEW_RESULT === 'approved' ? 'success' : 'failure', `Play Console result confirmed: ${process.env.REVIEW_RESULT}`);
} else throw new Error('Unknown release ledger command.');
