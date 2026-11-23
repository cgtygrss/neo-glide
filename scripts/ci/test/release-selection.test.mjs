import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseSelection, sameReleaseSelection } from '../release-selection.mjs';
import { resumeAction } from '../release-policy.mjs';

test('automatic releases preserve both stores and automatic Apple review', () => {
  assert.deepEqual(releaseSelection({GITHUB_EVENT_NAME:'push'},'publish'), {stores:['ios','android'],iosSubmitForReview:true});
  assert.deepEqual(releaseSelection({GITHUB_EVENT_NAME:'workflow_dispatch',RELEASE_STORE:'ios'},'publish'), {stores:['ios'],iosSubmitForReview:true});
  assert.throws(()=>releaseSelection({GITHUB_EVENT_NAME:'push',RELEASE_STORE:'ios'},'publish'),/manual/);
  assert.throws(()=>releaseSelection({GITHUB_EVENT_NAME:'workflow_dispatch',RELEASE_STORE:'unknown'},'publish'),/Unknown/);
});

test('grouped Apple review staging is explicit, manual, iOS-only and public-mode only', () => {
  const env={GITHUB_EVENT_NAME:'workflow_dispatch',RELEASE_STORE:'ios',IOS_SUBMIT_FOR_REVIEW:'false'};
  assert.deepEqual(releaseSelection(env,'publish'),{stores:['ios'],iosSubmitForReview:false});
  for(const mode of ['dry-run','device-test']) assert.throws(()=>releaseSelection(env,mode),/Manual Apple review/);
  for(const store of ['both','android']) assert.throws(()=>releaseSelection({...env,RELEASE_STORE:store},'publish'),/Manual Apple review/);
  assert.throws(()=>releaseSelection({...env,GITHUB_EVENT_NAME:'push'},'publish'));
  assert.throws(()=>releaseSelection({...env,IOS_SUBMIT_FOR_REVIEW:'maybe'},'publish'),/Invalid/);
});

test('legacy manifests retain their behavior and retries cannot change distribution intent', () => {
  const legacy={version:'1.3.0',build:'107',commit:'source',sha256:'digest',mode:'publish',track:'alpha'};
  const explicit={...legacy,stores:['ios','android'],iosSubmitForReview:true};
  assert.equal(sameReleaseSelection(legacy,explicit),true);
  assert.equal(resumeAction(legacy,explicit),'resume');
  const staged={...legacy,stores:['ios'],iosSubmitForReview:false};
  assert.throws(()=>resumeAction(staged,{...staged,iosSubmitForReview:true}),/selection/);
  assert.throws(()=>resumeAction(staged,{...staged,stores:['ios','android']}),/selection/);
});
