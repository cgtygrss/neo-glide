import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function validateReleaseConfig(platform, env, { signed = true } = {}) {
  assert.ok(['ios', 'android'].includes(platform));
  const required = platform === 'ios'
    ? ['IOS_CERTIFICATE_BASE64', 'IOS_CERTIFICATE_PASSWORD', 'IOS_PROFILE_BASE64', 'ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_PRIVATE_KEY_BASE64']
    : ['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_PASSWORD', 'ANDROID_KEY_ALIAS', 'NEO_GLIDE_PLAY_BILLING_PUBLIC_KEY'];
  if (signed) for (const key of required) assert.ok(env[key]?.trim(), `Missing required setting: ${key}`);
  const live = platform === 'ios' || env.ANDROID_TRACK === 'production';
  if (live) {
    for (const format of ['REWARDED', 'INTERSTITIAL', 'REWARDED_INTERSTITIAL']) {
      const key = `VITE_ADMOB_${format}_${platform.toUpperCase()}`, value = env[key] || '';
      assert.match(value, /^ca-app-pub-\d+\/\d+$/, `Missing live ad unit: ${key}`);
      assert.ok(!value.startsWith('ca-app-pub-3940256099942544/'), `Demo ad unit in production: ${key}`);
    }
    const appId = env[`${platform.toUpperCase()}_ADMOB_APP_ID`] || '';
    assert.match(appId, /^ca-app-pub-\d+~\d+$/, 'Missing live native AdMob app ID');
    assert.ok(!appId.startsWith('ca-app-pub-3940256099942544~'), 'Demo native AdMob app ID in production');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validateReleaseConfig(process.argv[2], process.env);
  const version = JSON.parse(readFileSync('package.json')).version;
  assert.ok(existsSync(`ci/changes/${version}/en-GB.txt`), `Add release notes for ${version}.`);
  console.log('Release configuration validated (values omitted).');
}
