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
