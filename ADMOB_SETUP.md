# Neo Glide AdMob setup

Neo Glide has one optional rewarded-ad placement: the one-time game-over revive. It does not wire forced interstitials. A reward is granted only when AdMob emits its reward event, and the game resumes only after the ad is dismissed.

## Build modes

- `npm run build` and `npm run build:ads-test` are safe defaults: they always use Google's sample native ad unit IDs.
- `npm run build:release` is the only mode that can use live native inventory. The repository's `.env.release` contains the known iOS units and explicit opt-in; add the Android units there after that AdMob app is created. Do not use this mode for development or store-review builds.

Keep live IDs only in `.env.release`; the explicit `release` mode and opt-in flag are both required.

## Before a live release

1. Sign into the AdMob account that owns publisher `ca-app-pub-8003289282406955`, create/confirm the Android and iOS apps, and complete its payments profile.
2. Replace the Android sample app ID in `android/app/src/main/res/values/strings.xml` after the Android app is created. The existing iOS app ID is `ca-app-pub-8003289282406955~3027228409`; its App Store ID is `6755588297`.
3. Confirm the verified live ad unit IDs in `.env.release` and add Android IDs there (rewarded is required for the revive; interstitial helpers are not automatically shown):

   ```env
   VITE_ADMOB_LIVE_RELEASE=true
   VITE_ADMOB_REWARDED_ANDROID=ca-app-pub-.../...
   VITE_ADMOB_REWARDED_IOS=ca-app-pub-8003289282406955/7613356581
   VITE_ADMOB_INTERSTITIAL_IOS=ca-app-pub-8003289282406955/1790060555
   VITE_ADMOB_REWARDED_INTERSTITIAL_IOS=ca-app-pub-8003289282406955/1626532735
   ```

4. Configure GDPR/UK consent and privacy options messages in AdMob. The app refreshes UMP state after choices and shows the menu’s **Ad privacy choices** control only when UMP marks it required.
5. Complete App Tracking Transparency and privacy disclosures in App Store Connect and the Play Console Data safety form. Set the iOS AdMob app's required Marketing URL to the developer site; a privacy-policy link alone does not satisfy that AdMob field.
6. Host `public/app-ads.txt` at `https://YOUR-DOMAIN/app-ads.txt`, on the exact developer website associated with the store listing.
7. Run a test build on real devices before the signed live build. Do not click live ads on your own devices.

Native sync/device verification is not performed here because this machine has Command Line Tools rather than full Xcode and does not have CocoaPods installed.
