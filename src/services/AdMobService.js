import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  MaxAdContentRating,
  RewardAdPluginEvents,
  RewardInterstitialAdPluginEvents,
} from '@capacitor-community/admob';

const TEST_REWARDED_IDS = { android: 'ca-app-pub-3940256099942544/5224354917', ios: 'ca-app-pub-3940256099942544/1712485313' };
const TEST_INTERSTITIAL_IDS = { android: 'ca-app-pub-3940256099942544/1033173712', ios: 'ca-app-pub-3940256099942544/4411468910' };
const TEST_REWARDED_INTERSTITIAL_IDS = { android: 'ca-app-pub-3940256099942544/5354046379', ios: 'ca-app-pub-3940256099942544/6978759866' };
const PRIVACY_OPTIONS_REQUIRED = 'REQUIRED';

let privacyOptionsRequired = false;
const nativePrivacy = registerPlugin('NeoGlidePrivacy');

const platform = () => Capacitor.getPlatform();
const configuredRewardedId = () => platform() === 'ios' ? import.meta.env.VITE_ADMOB_REWARDED_IOS : import.meta.env.VITE_ADMOB_REWARDED_ANDROID;
const configuredInterstitialId = () => platform() === 'ios' ? import.meta.env.VITE_ADMOB_INTERSTITIAL_IOS : import.meta.env.VITE_ADMOB_INTERSTITIAL_ANDROID;
const configuredRewardedInterstitialId = () => platform() === 'ios' ? import.meta.env.VITE_ADMOB_REWARDED_INTERSTITIAL_IOS : import.meta.env.VITE_ADMOB_REWARDED_INTERSTITIAL_ANDROID;

// Live inventory is intentionally opt-in. `npm run build` always compiles test IDs,
// even if a local .env.production contains live unit IDs.
const isLiveNativeInventoryEnabled = () => import.meta.env.MODE === 'release' && import.meta.env.VITE_ADMOB_LIVE_RELEASE === 'true';
const isTestAdsEnabled = () => !isLiveNativeInventoryEnabled();

export const isNativeAdMobAvailable = () => Capacitor.isNativePlatform();
export const isAdPrivacyOptionsRequired = () => privacyOptionsRequired;

export function updatePrivacyState(consent) {
  privacyOptionsRequired = consent.privacyOptionsRequirementStatus === PRIVACY_OPTIONS_REQUIRED;
  return { ready: Boolean(consent.canRequestAds), privacyOptionsRequired };
}

export function createSingleFlightRunner(action) {
  let inFlight = null;
  return () => {
    if (inFlight) return inFlight;
    inFlight = Promise.resolve().then(action).finally(() => { inFlight = null; });
    return inFlight;
  };
}

const errorFromEvent = (event, fallback) => new Error(event?.message || event?.error?.message || fallback);

// The plugin's show promise is not a reliable reward signal on every native platform.
// Reward is recorded immediately, but callers only proceed once the ad is dismissed.
export async function presentRewardedAd({ adMob, events, show }) {
  const handles = [];
  let earned = false;
  let settled = false;
  let resolveResult;
  let rejectResult;
  const cleanup = async () => {
    await Promise.all(handles.map(handle => handle?.remove?.().catch(() => undefined)));
  };
  const settle = (callback, value) => {
    if (settled) return;
    settled = true;
    void cleanup().finally(() => callback(value));
  };
  const result = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  try {
    handles.push(await adMob.addListener(events.Rewarded, () => { earned = true; }));
    handles.push(await adMob.addListener(events.Dismissed, () => settle(resolveResult, earned)));
    handles.push(await adMob.addListener(events.FailedToShow, error => {
      settle(rejectResult, errorFromEvent(error, 'The rewarded ad could not be shown.'));
    }));
  } catch (error) {
    await cleanup();
    throw error;
  }

  // Do not await this promise: dismissal is the terminal lifecycle event. Catching it
  // prevents a native bridge rejection from becoming an unhandled rejection.
  Promise.resolve().then(show).catch(error => {
    settle(rejectResult, errorFromEvent(error, 'The rewarded ad could not be shown.'));
  });
  return result;
}

export function createAdConsentController({ adMob, consentApi, isIOS, getOptions, onState = () => {} }) {
  let initialization;
  let privacyRequest;
  let sdkStarted = false;
  let sdkStart;
  const refresh = async () => {
    const consent = await consentApi.requestConsentInfo();
    onState(consent);
    return consent;
  };
  const complete = async consent => {
    if (consent.canRequestAds && !sdkStarted) {
      if (isIOS()) {
        const tracking = await adMob.trackingAuthorizationStatus();
        if (tracking.status === 'notDetermined') await adMob.requestTrackingAuthorization();
      }
      if (!sdkStart) {
        sdkStart = Promise.resolve().then(() => adMob.initialize(getOptions())).then(() => { sdkStarted = true; })
          .catch(error => { sdkStart = undefined; throw error; });
      }
      await sdkStart;
    }
    return { ready: Boolean(consent.canRequestAds) && sdkStarted, privacyOptionsRequired: consent.privacyOptionsRequirementStatus === PRIVACY_OPTIONS_REQUIRED };
  };
  function initialize() {
    if (privacyRequest) return privacyRequest.then(() => initialize());
    if (initialization) return initialization;
    const request = Promise.resolve().then(async () => {
      let consent = await refresh();
      if (consent.status === AdmobConsentStatus.REQUIRED && consent.isConsentFormAvailable) {
        await consentApi.showConsentForm();
        consent = await refresh();
      }
      return complete(consent);
    });
    initialization = request;
    void request.then(status => {
      if (!status.ready && initialization === request) initialization = undefined;
    }, () => { if (initialization === request) initialization = undefined; });
    return request;
  }
  function showPrivacyOptions() {
    if (privacyRequest) return privacyRequest;
    const previous = initialization;
    privacyRequest = Promise.resolve().then(async () => {
      await previous?.catch(() => undefined);
      const consent = await refresh();
      if (consent.privacyOptionsRequirementStatus === PRIVACY_OPTIONS_REQUIRED) await consentApi.showPrivacyOptionsForm();
      const status = await complete(await refresh());
      initialization = status.ready ? Promise.resolve(status) : undefined;
      return status;
    }).catch(error => { initialization = undefined; throw error; })
      .finally(() => { privacyRequest = undefined; });
    return privacyRequest;
  }
  return { initialize, showPrivacyOptions };
}

// The iOS AdMob plugin wires its consent form presenter only in initialize(),
// which also starts MobileAds. Our UMP-only bridge can present consent first.
const privacyProvider = () => platform() === 'ios' ? nativePrivacy : AdMob;
const consentApi = {
  requestConsentInfo: () => privacyProvider().requestConsentInfo(),
  showConsentForm: () => privacyProvider().showConsentForm(),
  showPrivacyOptionsForm: () => privacyProvider().showPrivacyOptionsForm(),
};
const consentController = createAdConsentController({
  adMob: AdMob, consentApi, isIOS: () => platform() === 'ios', onState: updatePrivacyState,
  getOptions: () => ({ initializeForTesting: isTestAdsEnabled(), maxAdContentRating: MaxAdContentRating.Teen, tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: false }),
});

export async function initializeAdMob() {
  if (!isNativeAdMobAvailable()) return { ready: false, reason: 'web', privacyOptionsRequired: false };
  return { ...await consentController.initialize(), testMode: isTestAdsEnabled() };
}

async function showConfiguredRewardedAd({ prepare, show, adId, events }) {
  await prepare({ adId, isTesting: isTestAdsEnabled(), immersiveMode: true });
  return presentRewardedAd({ adMob: AdMob, events, show });
}

const runRewardedAd = createSingleFlightRunner(async () => {
    const status = await initializeAdMob();
    if (!status.ready) throw new Error('Advertising consent is required before loading an ad.');
    const adId = isTestAdsEnabled() ? TEST_REWARDED_IDS[platform()] : configuredRewardedId();
    if (!adId) throw new Error('The rewarded AdMob unit is not configured.');
    return showConfiguredRewardedAd({ prepare: options => AdMob.prepareRewardVideoAd(options), show: () => AdMob.showRewardVideoAd(), adId, events: RewardAdPluginEvents });
  });

export const showAdMobRewardedAd = () => runRewardedAd();

export async function showAdMobInterstitial() {
  const status = await initializeAdMob();
  if (!status.ready) throw new Error('Advertising consent is required before loading an ad.');
  const adId = isTestAdsEnabled() ? TEST_INTERSTITIAL_IDS[platform()] : configuredInterstitialId();
  if (!adId) throw new Error('The interstitial AdMob unit is not configured.');
  await AdMob.prepareInterstitial({ adId, isTesting: isTestAdsEnabled(), immersiveMode: true });
  await AdMob.showInterstitial();
}

const runRewardedInterstitialAd = createSingleFlightRunner(async () => {
    const status = await initializeAdMob();
    if (!status.ready) throw new Error('Advertising consent is required before loading an ad.');
    const adId = isTestAdsEnabled() ? TEST_REWARDED_INTERSTITIAL_IDS[platform()] : configuredRewardedInterstitialId();
    if (!adId) throw new Error('The rewarded AdMob unit is not configured.');
    return showConfiguredRewardedAd({ prepare: options => AdMob.prepareRewardInterstitialAd(options), show: () => AdMob.showRewardInterstitialAd(), adId, events: RewardInterstitialAdPluginEvents });
  });

export const showAdMobRewardedInterstitial = () => runRewardedInterstitialAd();

export async function showAdPrivacyOptions() {
  if (!isNativeAdMobAvailable()) return { required: false };
  const status = await consentController.showPrivacyOptions();
  return { required: status.privacyOptionsRequired };
}
