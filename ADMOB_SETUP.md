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

## Personal developer website — prepared 6 November 2026

The selected personal website is `https://cgtygrss.github.io/cagatay-gurses/`.
Its repository now contains `app-ads.txt`. Since AdMob discovers files from the
hostname rather than the project path, the same record is also published at
`https://cgtygrss.github.io/app-ads.txt` by `cgtygrss/cgtygrss.github.io`.
Both URLs return HTTP 200 and the exact publisher record as plain text.

App Store Connect version **1.2.1**, in **Prepare for Submission**, has the new
Marketing URL saved. Released **1.2.0** locks this field and still publicly links
the existing Firebase developer site. A compatible new build, App Review and
release are required before the public store link changes. The existing Firebase
site remains available during that transition. This preparation does not establish
successful AdMob verification.

See `release/1.2.0/admob-personal-website-2026-11-06.json` for deployed commits,
workflow results and public checks.

## Verify the compiled iOS app

The app target must inherit CocoaPods' `OTHER_LDFLAGS`. A target-level `-ObjC`
without `$(inherited)` can produce a successful archive with the AdMob class
missing. The native bridge also explicitly registers `AdMobPlugin()` from
`CapacitorCommunityAdmob` to keep the static framework linked.

After building or archiving, inspect the actual `.app` before uploading:

```sh
npm run verify:ios-ads -- /absolute/path/to/App.app
```

For simulator testing, verify the **actual bundled ad units** as well:

```sh
npm run build:ads-test
npx cap copy ios
# Build the simulator target, then:
npm run verify:ios-ads -- /absolute/path/to/App.app --ads=test
```

Xcode's Release configuration does not select Vite's inventory mode. The
simulator may use an optimized native Release build while its web assets use
Google demo ad units. Use `--ads=live` only to validate an intended live artifact.
Neither check establishes account approval or live inventory availability.

This checks the bundled plugin configuration, AdMob app ID and compiled native
class. It does not verify account approval, live inventory or device consent.
