# Neo Glide

A React and Canvas arcade game packaged for iOS and Android with Capacitor.
Firebase provides adult account sync, events and server-side purchase verification.
Players under 18 or with an unknown age use local family play without accounts,
online events, ads or real-money purchases.

## Development

Work on **Dev**. Pull requests from Dev target **main**; main merges run the
release pipeline. The repository pins Node and Ruby in `.node-version` and
`.ruby-version`. Android and emulator tooling use JDK 21. Native iOS builds use
Xcode 27.2.

```sh
npm ci
npm ci --prefix backend
npm ci --prefix tools/ci
bundle install
npm run dev
```

The game opens at `http://localhost:5173`. The admin app uses `npm run dev:admin`.
Local environment files contain machine-specific configuration and remain ignored
by Git. The regular web build uses demo ad inventory.

## Checks and builds

```sh
npm run lint
npm test
npm run test:ci
npm run test:backend
npm run test:emulators
npm run build
npm run build:admin
```

The emulator check needs free Auth/Firestore ports and JDK 21. To run the game in
Xcode or Android Studio, build the web assets and sync the selected platform:

```sh
npm run build
npx cap sync ios
npx cap open ios
# Android: npx cap sync android && npx cap open android
```

## Releases

[CI/CD](docs/CI_CD.md) documents signing, protected environment settings, versioning,
store review gates and recovery. `package.json` is the marketing-version source.
Prepare release notes in `ci/changes/<version>/en-GB.txt` on Dev before merging.
iOS submissions release automatically after approval. Android currently targets
the closed alpha track.

The CI simulator test covers startup, garage navigation, flight, pause and return
from the background. [Screenshot tooling](scripts/ios-screenshots/README.md) captures
store assets without changing progress or entitlements.

## Project layout

- `src/`: game, UI, audience policy and account client.
- `backend/`: authenticated Functions and shared event/store rules.
- `admin/`: event administration app.
- `ios/` and `android/`: native projects and purchase/auth bridges.
- `scripts/ci/` and `fastlane/`: build, signing and distribution automation.
- `public/`: bundled artwork, music and offline legal pages.
- `resources/`: master icon/splash artwork and provenance.
- `developer-site/`: public support, privacy and developer website.
- `docs/` and `release/`: setup, rights records and store metadata.

## Services and assets

- [Accounts and events](docs/ACCOUNTS_AND_EVENTS.md)
- [Android billing](docs/ANDROID_BILLING.md)
- [Cosmetic products](docs/COSMETICS_SETUP.md)
- [Ads and consent](docs/ADMOB_SETUP.md)
- [Music licensing](docs/MUSIC_LICENSING.md)
- [Commercial remediation](docs/COMMERCIAL_REMEDIATION_2026-11-12.md)
- [Privacy support](docs/PRIVACY_SUPPORT_RUNBOOK.md)

`backend/shared/store-catalog.js` owns product IDs and reference pricing.
`npm run store:sync` regenerates the native catalogs, StoreKit fixtures and release
metadata. Store ownership, credit unlocks and event unlocks are tracked separately.

`npm run legal:build` generates offline privacy/support/deletion pages and full
third-party notices before production builds. Their sources are in `docs/legal/`.
Native dependency changes also require a refreshed `docs/legal/native-notices.json`;
use `scripts/export-android-licenses.gradle` and `scripts/collect-native-notices.py`.
The build rejects a stale native license inventory.

See [abuse protection status](docs/ABUSE_PROTECTION.md) for the server controls,
verification and remaining launch requirements.
