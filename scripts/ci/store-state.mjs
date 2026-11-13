import { readFileSync, appendFileSync } from 'node:fs';
import { guardOutstanding, resumeAction } from './release-policy.mjs';

const base = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}`;
async function github(path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(`GitHub release ledger ${method} failed: ${response.status}`);
  return response.status === 204 ? null : response.json();
}
async function records(store) {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await github(`/deployments?environment=${store}-store&per_page=100&page=${page}`);
    for (const deployment of batch) {
      const statuses = await github(`/deployments/${deployment.id}/statuses?per_page=100`);
      all.push({ ...deployment.payload, id: deployment.id, state: statuses[0]?.state || 'pending', submitted: statuses.some(s => s.description === 'Submitted; awaiting store review') });
    }
    if (batch.length < 100) break;
  }
  return all;
}
async function status(id, state, description) {
  return github(`/deployments/${id}/statuses`, 'POST', { state, description, auto_inactive: false, log_url: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` });
}
const command = process.argv[2], store = process.argv[3];
if (command === 'check') {
  for (const name of ['android', 'ios']) {
    const candidate = JSON.parse(readFileSync(`ci-output/${name}.json`));
    const outstanding = await records(name);
    if (name === 'android') guardOutstanding(outstanding, candidate);
    const own = outstanding.find(r => r.run === candidate.run && r.build === candidate.build);
    if (own) resumeAction(own, candidate);
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}_resume=${Boolean(own)}\n`);
    if (name === 'android' && !outstanding.some(r => r.build === '5' && ['success', 'failure', 'inactive'].includes(r.state))) throw new Error('Existing Play build 5 needs a Console review-result acknowledgement before the first CI submission.');
  }
} else if (command === 'begin') {
  const candidate = JSON.parse(readFileSync(`ci-output/${store}.json`));
  const all = await records(store);
  if (store === 'android') guardOutstanding(all, candidate);
  let record = all.find(r => r.run === candidate.run && r.commit === candidate.commit && r.build === candidate.build && r.sha256 === candidate.sha256);
  if (!record) {
    const deployment = await github('/deployments', 'POST', { ref: candidate.commit, task: 'deploy', auto_merge: false, required_contexts: [], environment: `${store}-store`, description: `Neo Glide ${candidate.version} (${candidate.build})`, production_environment: store === 'ios' || JSON.parse(readFileSync('ci/release.json')).androidTrack === 'production', payload: { ...candidate, store } });
    record = { ...candidate, id: deployment.id, submitted: false };
    await status(record.id, 'in_progress', 'Upload started; retry this run if interrupted');
  }
  appendFileSync(process.env.GITHUB_OUTPUT, `deployment=${record.id}\nsubmitted=${record.submitted}\n`);
} else if (command === 'submitted') {
  await status(process.env.DEPLOYMENT_ID, 'in_progress', 'Submitted; awaiting store review');
} else if (command === 'acknowledge') {
  if (process.env.GITHUB_REF !== 'refs/heads/main' || process.env.CONSOLE_CHECKED !== 'true') throw new Error('Only a manually confirmed main run may acknowledge review.');
  const build = process.env.REVIEWED_BUILD;
  if (!/^\d+$/.test(build)) throw new Error('Invalid reviewed build number.');
  const all = await records('android');
  let matching = all.filter(r => r.build === build);
  if (!matching.length) {
    if (build !== '5') throw new Error('No matching pipeline release exists.');
    const deployment = await github('/deployments', 'POST', { ref: process.env.GITHUB_SHA, auto_merge: false, required_contexts: [], environment: 'android-store', production_environment: false, payload: { store: 'android', build: '5', version: '1.3.0', baseline: true } });
    matching = [{ id: deployment.id }];
  }
  for (const record of matching) await status(record.id, process.env.REVIEW_RESULT === 'approved' ? 'success' : 'failure', `Play Console result confirmed: ${process.env.REVIEW_RESULT}`);
} else throw new Error('Unknown release ledger command.');
