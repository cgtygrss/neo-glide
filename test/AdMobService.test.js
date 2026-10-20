import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSingleFlightRunner,
  createAdConsentController,
  isAdPrivacyOptionsRequired,
  presentRewardedAd,
  updatePrivacyState,
} from '../src/services/AdMobService.js';

const events = { Rewarded: 'reward', Dismissed: 'dismissed', FailedToShow: 'failed' };
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
