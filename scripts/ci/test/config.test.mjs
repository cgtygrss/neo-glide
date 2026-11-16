import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReleaseConfig } from '../validate-config.mjs';
test('missing signing credentials blocks a release', () => {
  assert.throws(() => validateReleaseConfig('ios', {}), /IOS_CERTIFICATE_BASE64/);
  assert.throws(() => validateReleaseConfig('android', {}), /ANDROID_KEYSTORE_BASE64/);
});
test('production never falls back to demo ads', () => {
  assert.throws(() => validateReleaseConfig('android', { ANDROID_TRACK: 'production' }, { signed: false }), /Missing live ad/);
  validateReleaseConfig('android', { ANDROID_TRACK: 'alpha' }, { signed: false });
});

test('live builds need the rewarded placement used by the game, without unused interstitial settings', () => {
  for (const platform of ['ios', 'android']) {
    const suffix = platform.toUpperCase();
    const env = { ANDROID_TRACK: 'production', [`${suffix}_ADMOB_APP_ID`]: 'ca-app-pub-1234567890123456~1234567890', [`VITE_ADMOB_REWARDED_${suffix}`]: 'ca-app-pub-1234567890123456/1234567890' };
    validateReleaseConfig(platform, env, { signed: false });
    assert.throws(() => validateReleaseConfig(platform, { ...env, [`VITE_ADMOB_REWARDED_${suffix}`]: 'ca-app-pub-3940256099942544/1234567890' }, { signed: false }), /Demo ad unit/);
    assert.throws(() => validateReleaseConfig(platform, { ...env, [`VITE_ADMOB_REWARDED_${suffix}`]: '' }, { signed: false }), /Missing live ad unit/);
  }
});
