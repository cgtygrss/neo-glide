import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const platform = process.argv[2];
if (!['ios', 'android'].includes(platform)) throw new Error('Specify ios or android.');
const live = platform === 'ios' || process.env.ANDROID_TRACK === 'production';
const keys = ['REWARDED', 'INTERSTITIAL', 'REWARDED_INTERSTITIAL'].map(format => `VITE_ADMOB_${format}_${platform.toUpperCase()}`);
writeFileSync('.env.release.local', [`VITE_ADMOB_LIVE_RELEASE=${live}`, ...keys.map(key => `${key}=${process.env[key] || ''}`)].join('\n') + '\n');
if (live) {
  const appId = process.env[`${platform.toUpperCase()}_ADMOB_APP_ID`];
  if (!appId || !/^ca-app-pub-\d+~\d+$/.test(appId)) throw new Error('Invalid native AdMob app ID.');
  if (platform === 'ios') execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :GADApplicationIdentifier ${appId}`, 'ios/App/App/Info.plist']);
  else {
    // The manifest's value can be overridden without changing the reviewed source.
    const { readFileSync } = await import('node:fs');
    const path = 'android/app/src/main/AndroidManifest.xml';
    const xml = readFileSync(path, 'utf8');
    const pattern = /(<meta-data\s+android:name="com.google.android.gms.ads.APPLICATION_ID"\s+android:value=")[^"]+("\s*\/?>)/;
    if (!pattern.test(xml)) throw new Error('Native AdMob manifest entry missing.');
    writeFileSync(path, xml.replace(pattern, `$1${appId}$2`));
  }
}
