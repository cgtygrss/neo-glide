import { readFileSync, writeFileSync } from 'node:fs';
import { createPrivateKey, sign } from 'node:crypto';
import { createRequire } from 'node:module';
import { APPLE_PENDING, validateCandidate } from './release-policy.mjs';
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const { GoogleAuth } = require('google-auth-library');
const config = JSON.parse(readFileSync('ci/release.json'));
const identity = JSON.parse(readFileSync('ci-output/identity.json'));
const ios = JSON.parse(readFileSync('ci-output/ios.json'));
const android = JSON.parse(readFileSync('ci-output/android.json'));
const now = Math.floor(Date.now() / 1000);
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const header = encode({ alg: 'ES256', kid: process.env.ASC_KEY_ID, typ: 'JWT' });
const payload = encode({ iss: process.env.ASC_ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' });
const message = `${header}.${payload}`;
const signature = sign('sha256', Buffer.from(message), { key: createPrivateKey(Buffer.from(process.env.ASC_PRIVATE_KEY_BASE64, 'base64')), dsaEncoding: 'ieee-p1363' }).toString('base64url');
async function apple(path) {
  const result = [];
  let url = `https://api.appstoreconnect.apple.com/v1/${path}`;
  while (url) {
    if (!url.startsWith('https://api.appstoreconnect.apple.com/')) throw new Error('Unexpected Apple pagination URL');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${message}.${signature}` } });
    if (!response.ok) throw new Error(`Apple preflight failed: ${response.status}`);
    const data = await response.json();
    result.push(...data.data);
    url = data.links?.next;
  }
  return result;
}
const versions = await apple(`apps/${config.appleAppId}/appStoreVersions?filter[platform]=IOS&limit=200`);
const builds = await apple(`builds?filter[app]=${config.appleAppId}&limit=200`);
const iosExists = builds.some(b => b.attributes.version === identity.build);
// Exact run/artifact equality is established by the ledger before this script runs.
const pending = versions.filter(v => APPLE_PENDING.has(v.attributes.appStoreState));
for (const version of pending) {
  const response = await fetch(`https://api.appstoreconnect.apple.com/v1/appStoreVersions/${version.id}/build`, { headers: { Authorization: `Bearer ${message}.${signature}` } });
  if (!response.ok) throw new Error('Unable to inspect the build currently in Apple review.');
  const linked = await response.json();
  if (linked.data?.attributes.version !== identity.build || version.attributes.versionString !== identity.version) throw new Error(`Previous Apple version is ${version.attributes.appStoreState}; current review will be preserved.`);
}
validateCandidate({ ...ios, maximumBuild: Math.max(0, ...builds.map(b => Number(b.attributes.version)).filter(Number.isFinite)), sameArtifact: iosExists && process.env.IOS_ARTIFACT_RESUME === 'true' });
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const client = await auth.getClient();
const root = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${config.androidPackage}/edits`;
const edit = (await client.request({ url: root, method: 'POST', data: {} })).data;
try {
  const bundles = (await client.request({ url: `${root}/${edit.id}/bundles` })).data.bundles || [];
  const tracks = (await client.request({ url: `${root}/${edit.id}/tracks` })).data.tracks || [];
  const bundle = bundles.find(b => String(b.versionCode) === identity.build);
  if (bundle && bundle.sha256 !== android.sha256) throw new Error('Google Play already has different bytes for this versionCode.');
  const maximum = Math.max(0, ...bundles.map(b => Number(b.versionCode)), ...tracks.flatMap(t => (t.releases || []).flatMap(r => (r.versionCodes || []).map(Number))));
  validateCandidate({ ...android, maximumBuild: maximum, sameArtifact: Boolean(bundle) && process.env.ANDROID_ARTIFACT_RESUME === 'true' });
  writeFileSync('ci-output/store-snapshot.json', JSON.stringify({ iosExists, androidExists: Boolean(bundle), version: identity.version, build: identity.build, checkedAt: new Date().toISOString() }, null, 2) + '\n');
} finally { await client.request({ url: `${root}/${edit.id}`, method: 'DELETE' }); }
console.log('Store versions, build numbers and Apple review state verified.');
