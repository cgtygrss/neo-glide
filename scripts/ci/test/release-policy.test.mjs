import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseIdentity } from '../version.mjs';
import { guardOutstanding, validateCandidate, resumeAction, compareVersions } from '../release-policy.mjs';

const candidate = { version: '1.3.0', build: '101', run: '123', commit: 'abc', sha256: 'digest' };
test('build allocation is stable on retry and never accepts invalid versions', () => {
  assert.deepEqual(releaseIdentity('1.3.0', 7, 100), { version: '1.3.0', build: '107' });
  assert.throws(() => releaseIdentity('1.3.0-beta', 1));
  assert.throws(() => releaseIdentity('1.3.0', -101));
});
test('outstanding reviews block other commits but permit the exact same artifact retry', () => {
  guardOutstanding([{ ...candidate, state: 'in_progress', store: 'play' }], candidate);
  assert.throws(() => guardOutstanding([{ ...candidate, run: 'old', state: 'in_progress', store: 'play' }], candidate), /unresolved/);
  guardOutstanding([{ ...candidate, run: 'old', state: 'success' }], candidate);
});
test('store build collision fails closed unless it belongs to this exact retry', () => {
  assert.throws(() => validateCandidate({ ...candidate, maximumBuild: 101 }), /collision/);
  validateCandidate({ ...candidate, maximumBuild: 101, sameArtifact: true });
  assert.throws(() => validateCandidate({ ...candidate, maximumBuild: 102, sameArtifact: true }), /collision/);
});
test('partial success skips submitted artifact and rejects different bytes', () => {
  assert.equal(resumeAction(null, candidate), 'upload');
  assert.equal(resumeAction({ ...candidate, submitted: true }, candidate), 'skip');
  assert.equal(resumeAction(candidate, candidate), 'resume');
  assert.throws(() => resumeAction({ ...candidate, sha256: 'other' }, candidate), /identity/);
});
test('marketing versions compare numerically across major and patch boundaries', () => {
  assert.equal(compareVersions('1.3.10', '1.3.9'), 1);
  assert.equal(compareVersions('2.0', '1.99.99'), 1);
  assert.equal(compareVersions('1.3', '1.3.0'), 0);
});
