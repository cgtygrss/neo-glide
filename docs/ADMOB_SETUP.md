# AdMob configuration

Adult online play uses optional rewarded ads for revival, flight bonuses and
verified event bonuses. There are no forced interstitials. Family play does not
initialize ads. Rewards require the native reward event and ad dismissal; event
credits additionally require the server-verified callback.

## Build configuration

`npm run build` uses Google demo inventory. Live inventory requires both
`npm run build:release` and `VITE_ADMOB_LIVE_RELEASE=true`.

Local release values belong in the ignored `.env.release` file. The only ad
unit settings used by the app are `VITE_ADMOB_REWARDED_IOS` and
`VITE_ADMOB_REWARDED_ANDROID`. CI supplies these and the native app IDs through
its protected environment; see [CI/CD](CI_CD.md).

The native app ID belongs in the iOS Info.plist or Android manifest. CI prepares
it for the selected platform. An iOS release requires live inventory; Android
closed testing uses demo inventory until the production track is selected.

## Consent and verification

The app completes UMP consent before starting MobileAds and checks the iOS
tracking permission when applicable. Ad privacy choices appear when UMP requires
them. Configure the corresponding consent messages and store disclosures in the
provider consoles. Keep the developer website's `app-ads.txt` publisher record
consistent with the AdMob account.

For event rewards, the server verification URL is
`https://europe-west3-neo-glide-live.cloudfunctions.net/admobSsv`.
`EVENT_AD_UNITS` in the backend configuration controls eligible rewarded units.
Client callbacks cannot mint event credits.

After compiling, inspect the actual iOS app:

```sh
npm run verify:ios-ads -- /absolute/path/to/App.app --ads=test
```

Use `--ads=live` for a live artifact. This verifies compiled plugin registration,
the app ID and bundled inventory. It does not establish provider account approval
or real-device delivery. Native linkage must retain inherited CocoaPods linker
flags and register `AdMobPlugin()`.
