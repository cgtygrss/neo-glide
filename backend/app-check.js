import { RequestError } from './shared/errors.js';

export const APP_IDS = Object.freeze([
  '1:288922991366:android:f41b2787846d636ca8bc87',
  '1:288922991366:ios:af9e51bd4c4715f4a8bc87',
  '1:288922991366:web:3ea00532b39a7a23a8bc87'
]);

export function appCheckMode(environment = process.env) {
  const mode=environment.APP_CHECK_MODE || 'monitor';
  if(!['monitor','enforce'].includes(mode))throw new RequestError('App verification configuration is unavailable.',503,'verification-unavailable');
  return mode;
}

// Only a local demo emulator may bypass attestation. Never trust a request flag,
// client version, platform header, UID or unverified decoded JWT as attestation.
export function localEmulators(environment = process.env) {
  return /^demo-/.test(environment.GCLOUD_PROJECT || '') &&
    ['FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST'].every(key=>/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(environment[key] || ''));
}

export async function verifyAppRequest(req, verify, options = {}) {
  const mode=appCheckMode(options.environment);
  if(localEmulators(options.environment))return 'emulator';
  const token=req.headers['x-firebase-appcheck'];
  if(token===undefined && mode==='monitor')return 'missing';
  if(typeof token!=='string'||token.length>8192||!token.length)throw new RequestError('App verification is required. Update the app and try again.',401,'app-check-required');
  let decoded;
  try {decoded=await verify(token);}
  catch {throw new RequestError('App verification failed. Try again later.',401,'invalid-app-check');}
  if(!APP_IDS.includes(decoded.appId))throw new RequestError('This app is not authorized.',403,'invalid-app-id');
  if(decoded.appId===APP_IDS[2]&&['flight','spend','careerClaim','purchase','reconcilePurchases','claim','adIntent','merge'].includes(options.action))throw new RequestError('Use the iOS or Android app for online progress and purchases.',403,'native-app-required');
  return 'verified';
}
