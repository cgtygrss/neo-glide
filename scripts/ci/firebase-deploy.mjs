import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const { GoogleAuth } = require('google-auth-library');
const config = JSON.parse(readFileSync('ci/release.json'));
const base = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}`;
async function github(path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(`Firebase deployment ledger failed: ${response.status}`);
  return response.json();
}
function files(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', 'test', '.firebase'].includes(entry.name) || entry.name.startsWith('.env')) return [];
    const full = `${path}/${entry.name}`;
    return entry.isDirectory() ? files(full) : [full];
  });
}
const groups = {
  functions: [...files('backend'), 'firebase.json'],
  firestore: ['firestore.rules', 'firestore.indexes.json', 'firebase.json'],
  admin: [...files('dist-admin'), 'firebase.json'],
  developer: [...files('developer-site/public'), 'developer-site/firebase.json', 'developer-site/.firebaserc']
};
const hashes = Object.fromEntries(Object.entries(groups).map(([name, paths]) => {
  const hash = createHash('sha256');
  for (const path of paths.sort()) hash.update(path).update(readFileSync(path));
  if (name === 'functions') hash.update(process.env.FIREBASE_FUNCTIONS_ENV || '');
  return [name, hash.digest('hex')];
}));
let previous;
for (let page = 1; !previous; page++) {
  const deployments = await github(`/deployments?environment=firebase-live&per_page=100&page=${page}`);
  for (const deployment of deployments) {
    const statuses = await github(`/deployments/${deployment.id}/statuses`);
    if (statuses[0]?.state === 'success') { previous = deployment.payload.hashes; break; }
  }
  if (deployments.length < 100) break;
}
const changed = Object.keys(groups).filter(name => hashes[name] !== previous?.[name]);
if (!changed.length) { console.log('Firebase content matches the last verified deployment.'); process.exit(0); }
console.log(`Changed Firebase components: ${changed.join(', ')}`);
const deployment = await github('/deployments', 'POST', { ref: process.env.GITHUB_SHA, auto_merge: false, required_contexts: [], environment: 'firebase-live', production_environment: true, payload: { hashes }, description: 'Neo Glide Firebase deployment' });
const status = (state, description) => github(`/deployments/${deployment.id}/statuses`, 'POST', { state, description, auto_inactive: false });
const cli = `${process.cwd()}/tools/ci/node_modules/.bin/firebase`;
const envFile = `backend/.env.${config.firebaseProject}`;
if (existsSync(envFile)) throw new Error('Refusing to overwrite an existing Functions environment file.');
try {
  await status('in_progress', 'Deploying changed components');
  if (changed.includes('functions')) {
    const environment = process.env.FIREBASE_FUNCTIONS_ENV || '';
    for (const key of ['BOOTSTRAP_ADMIN_EMAIL', 'EVENT_AD_UNITS', 'ANDROID_PACKAGE', 'APPLE_BUNDLE_ID', 'APPLE_APP_ID', 'APPLE_ENVIRONMENT']) {
      if (!new RegExp(`^${key}=.+$`, 'm').test(environment)) throw new Error(`Missing Functions environment value: ${key}`);
    }
    writeFileSync(envFile, environment + '\n', { mode: 0o600 });
  }
  const only = [];
  if (changed.includes('firestore')) only.push('firestore:rules', 'firestore:indexes');
  if (only.length) execFileSync(cli, ['deploy', '--only', only.join(','), '--project', config.firebaseProject, '--non-interactive'], { stdio: 'inherit' });
  if (changed.includes('firestore')) {
    const client = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/datastore'] }).getClient();
    const url = `https://firestore.googleapis.com/v1/projects/${config.firebaseProject}/databases/${config.firestoreDatabase}/collectionGroups/-/indexes`;
    const deadline = Date.now() + 20 * 60 * 1000;
    for (;;) {
      let next = url, indexes = [];
      while (next) {
        const data = (await client.request({ url: next })).data;
        indexes.push(...(data.indexes || []));
        next = data.nextPageToken ? `${url}?pageToken=${encodeURIComponent(data.nextPageToken)}` : null;
      }
      if (indexes.some(index => index.state === 'NEEDS_REPAIR')) throw new Error('A Firestore index needs repair.');
      if (indexes.every(index => index.state === 'READY')) break;
      if (Date.now() > deadline) throw new Error('Firestore index readiness timed out; store submission blocked.');
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }
  if (changed.includes('functions')) execFileSync(cli, ['deploy', '--only', 'functions:events', '--project', config.firebaseProject, '--non-interactive'], { stdio: 'inherit' });
  if (changed.includes('admin')) execFileSync(cli, ['deploy', '--only', 'hosting', '--project', config.firebaseProject, '--non-interactive'], { stdio: 'inherit' });
  if (changed.includes('developer')) execFileSync(cli, ['deploy', '--only', 'hosting:developer', '--project', config.firebaseProject, '--non-interactive'], { cwd: 'developer-site', stdio: 'inherit' });
  for (const path of ['/privacy.html', '/support.html', '/delete-account.html', '/notices.html', '/app-ads.txt']) {
    const response = await fetch(`https://neo-glide-live-developer.web.app${path}`, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Developer website check failed: ${path}`);
    const text = await response.text();
    if (path.endsWith('.txt') ? !text.includes('google.com,') : !text.includes('Neo Glide')) throw new Error(`Unexpected website content: ${path}`);
  }
  const api = await fetch('https://europe-west3-neo-glide-live.cloudfunctions.net/api', { signal: AbortSignal.timeout(30000) });
  if (api.status !== 405 || !(await api.text()).includes('POST required')) throw new Error('Functions route check failed.');
  const dashboard = await fetch('https://neo-glide-live.web.app/', { signal: AbortSignal.timeout(30000) });
  if (!dashboard.ok || !(await dashboard.text()).includes('<html')) throw new Error('Admin hosting check failed.');
  await status('success', 'Deployment and route checks passed');
} catch (error) {
  await status('failure', 'Deployment failed; store submission blocked');
  throw error;
} finally { if (existsSync(envFile)) unlinkSync(envFile); }
