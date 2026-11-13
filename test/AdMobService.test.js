import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSingleFlightRunner,
  createAdConsentController,
  isAdPrivacyOptionsRequired,
  presentRewardedAd,
  prepareRewardedAd,
  updatePrivacyState,
} from '../src/services/AdMobService.js';

const events = { Rewarded: 'reward', Dismissed: 'dismissed', FailedToShow: 'failed', FailedToLoad: 'loadFailed' };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function mockAdMob() {
  const listeners = new Map();
  const removed = [];
  return {
    adMob: {
      addListener: async (event, callback) => {
        listeners.set(event, callback);
        return { remove: async () => removed.push(event) };
      },
    },
    emit: (event, value) => listeners.get(event)?.(value),
    removed,
  };
}

test('reward is recorded but settles only after dismissal', async () => {
  const mock = mockAdMob();
  let showCalled = false;
  const result = presentRewardedAd({ adMob: mock.adMob, events, show: async () => { showCalled = true; } });
  await flush();
  assert.equal(showCalled, true);
  mock.emit(events.Rewarded);
  let settled = false;
  void result.then(() => { settled = true; });
  await flush();
  assert.equal(settled, false);
  mock.emit(events.Dismissed);
  assert.equal(await result, true);
  assert.deepEqual(mock.removed.sort(), ['dismissed', 'failed', 'reward']);
});

test('skipping a rewarded ad resolves false after dismissal', async () => {
  const mock = mockAdMob();
  const result = presentRewardedAd({ adMob: mock.adMob, events, show: async () => {} });
  await flush();
  mock.emit(events.Dismissed);
  assert.equal(await result, false);
});

test('a non-rewarded interstitial also waits for dismissal instead of the show promise', async () => {
  const mock=mockAdMob(),plainEvents={Dismissed:'dismissed',FailedToShow:'failed'};
  const result=presentRewardedAd({adMob:mock.adMob,events:plainEvents,show:async()=>{}});
  let completed=false;void result.then(()=>{completed=true;});await flush();
  assert.equal(completed,false);mock.emit(plainEvents.Dismissed);
  assert.equal(await result,false);assert.deepEqual(mock.removed.sort(),['dismissed','failed']);
});

test('load diagnostics preserve the real SDK error instead of the generic iOS rejection and clean up', async () => {
  const mock = mockAdMob(), original = new Error('Loading failed');
  await assert.rejects(prepareRewardedAd({ adMob:mock.adMob, events, options:{ adId:'demo', isTesting:true },
    prepare: async () => { mock.emit(events.FailedToLoad,{ code:0, message:'Publisher data not found.' }); throw original; },
  }), error => error.message === 'Publisher data not found.' && error.nativeCode === 0 && error.cause === original);
  assert.deepEqual(mock.removed,['loadFailed']);
});

test('successful preparation passes options unchanged and removes its load listener without granting a reward', async () => {
  const mock = mockAdMob(), options = { adId:'demo', isTesting:true, ssv:{ customData:'nonce' } };
  const result = await prepareRewardedAd({ adMob:mock.adMob, events, options,
    prepare: async supplied => { assert.equal(supplied,options); return { adUnitId:'demo' }; },
  });
  assert.deepEqual(result,{ adUnitId:'demo' }); assert.deepEqual(mock.removed,['loadFailed']);
});

test('prepare bridge errors retain their identity when no native load event arrives', async () => {
  const mock = mockAdMob(), error = new Error('Plugin unavailable');
  await assert.rejects(prepareRewardedAd({ adMob:mock.adMob, events, options:{}, prepare:async()=>{throw error;} }), supplied=>supplied===error);
  assert.deepEqual(mock.removed,['loadFailed']);
});

test('a native show rejection rejects and cleans up listeners', async () => {
  const mock = mockAdMob();
  const result = presentRewardedAd({ adMob: mock.adMob, events, show: async () => { throw new Error('bridge failed'); } });
  await assert.rejects(result, /bridge failed/);
  assert.deepEqual(mock.removed.sort(), ['dismissed', 'failed', 'reward']);
});

test('a failed-to-show event rejects and cleans up while the show promise remains pending', async () => {
  const mock = mockAdMob();
  const result = presentRewardedAd({ adMob: mock.adMob, events, show: () => new Promise(() => {}) });
  await flush();
  mock.emit(events.FailedToShow, { message: 'no fill' });
  await assert.rejects(result, /no fill/);
  assert.deepEqual(mock.removed.sort(), ['dismissed', 'failed', 'reward']);
});

test('single-flight runner shares rapid requests and resets after completion', async () => {
  let calls = 0;
  let finish;
  const run = createSingleFlightRunner(() => {
    calls += 1;
    if (calls > 1) return true;
    return new Promise(resolve => { finish = resolve; });
  });
  const first = run();
  const second = run();
  assert.equal(first, second);
  await flush();
  assert.equal(calls, 1);
  finish(true);
  await first;
  await run();
  assert.equal(calls, 2);
});

test('privacy requirement state refreshes from the latest UMP consent info', () => {
  updatePrivacyState({ canRequestAds: true, privacyOptionsRequirementStatus: 'REQUIRED' });
  assert.equal(isAdPrivacyOptionsRequired(), true);
  updatePrivacyState({ canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' });
  assert.equal(isAdPrivacyOptionsRequired(), false);
});

function consentFixture() {
  const calls = [];
  const state = {
    consent: { status: 'REQUIRED', canRequestAds: false, isConsentFormAvailable: true, privacyOptionsRequirementStatus: 'REQUIRED' },
    afterForm: true, cancel: false, tracking: 'notDetermined', startFailure: false,
  };
  const adMob = {
    trackingAuthorizationStatus: async () => { calls.push('trackingStatus'); return { status: state.tracking }; },
    requestTrackingAuthorization: async () => { calls.push('trackingPrompt'); state.tracking = 'denied'; },
    initialize: async () => { calls.push('sdkStart'); if (state.startFailure) throw new Error('SDK start failed'); },
  };
  const consentApi = {
    requestConsentInfo: async () => { calls.push('consentInfo'); return { ...state.consent }; },
    showConsentForm: async () => {
      calls.push('consentForm');
      if (state.cancel) throw new Error('Consent form cancelled');
      state.consent.canRequestAds = state.afterForm;
      state.consent.status = 'OBTAINED';
    },
    showPrivacyOptionsForm: async () => {
      calls.push('privacyOptions');
      state.consent.canRequestAds = state.afterForm;
      state.consent.status = 'OBTAINED';
    },
  };
  const controller = createAdConsentController({ adMob, consentApi, isIOS: () => true, getOptions: () => ({ initializeForTesting: true }) });
  return { controller, state, calls };
}

test('consent and ATT resolve before the ads SDK starts, including concurrent initialization', async () => {
  const { controller, calls } = consentFixture();
  const first = controller.initialize();
  assert.equal(controller.initialize(), first);
  assert.equal((await first).ready, true);
  assert.deepEqual(calls, ['consentInfo', 'consentForm', 'consentInfo', 'trackingStatus', 'trackingPrompt', 'sdkStart']);
  await controller.initialize();
  assert.equal(calls.filter(call => call === 'sdkStart').length, 1);
});

test('no consent, unavailable forms and cancelled forms never start ads or prompt ATT', async () => {
  const { controller, state, calls } = consentFixture();
  state.consent.isConsentFormAvailable = false;
  assert.equal((await controller.initialize()).ready, false);
  assert.deepEqual(calls, ['consentInfo']);
  state.consent.isConsentFormAvailable = true;
  state.cancel = true;
  await assert.rejects(controller.initialize(), /cancelled/);
  assert.equal(calls.includes('sdkStart'), false);
  assert.equal(calls.includes('trackingPrompt'), false);
  state.cancel = false; state.afterForm = false;
  assert.equal((await controller.initialize()).ready, false);
  assert.equal(calls.includes('sdkStart'), false);
});

test('privacy options work before SDK start, permit a later grant and block requests after revocation', async () => {
  const { controller, state, calls } = consentFixture();
  state.afterForm = false;
  assert.equal((await controller.initialize()).ready, false);
  const first = controller.showPrivacyOptions();
  assert.equal(controller.showPrivacyOptions(), first);
  assert.equal((await first).ready, false);
  assert.equal(calls.includes('privacyOptions'), true);
  assert.equal(calls.includes('sdkStart'), false);
  state.afterForm = true;
  assert.equal((await controller.showPrivacyOptions()).ready, true);
  assert.equal((await controller.initialize()).ready, true);
  state.afterForm = false;
  assert.equal((await controller.showPrivacyOptions()).ready, false);
  assert.equal((await controller.initialize()).ready, false);
  assert.equal(calls.filter(call => call === 'sdkStart').length, 1);
});

test('an SDK initialization failure remains retryable after successful consent', async () => {
  const { controller, state, calls } = consentFixture();
  state.startFailure = true;
  await assert.rejects(controller.initialize(), /SDK start failed/);
  state.startFailure = false;
  assert.equal((await controller.initialize()).ready, true);
  assert.equal(calls.filter(call => call === 'sdkStart').length, 2);
});
