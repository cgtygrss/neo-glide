# Accounts, cloud saves and events

The application restores its Firebase session without a login screen. Android uses Credential Manager / Google as the game identity and Play Games v2 as the platform identity. iOS uses Game Center by default and can link Google for Android/iOS continuity. A cancelled initial sign-in is remembered; Settings → Account retries it. Offline first launch uses a device guest.

## Implemented infrastructure

Project: `neo-glide-live`, Firestore Enterprise Native database: `events`, region: `europe-west3`. Registered Android package: `com.cgtygrss.neoglide`. The existing App Store bundle is **`com.cgtygrssgame.neonglide`** and is intentionally preserved. Google, Game Center and anonymous Firebase providers are enabled. Android uses Firebase BoM 34.19.0 to preserve Android 6 / API 23 support; BoM 35 requires API 24. Play Games v2 21.0.0 similarly preserves the existing minimum SDK; 22.1.0 requires API 24. Client configs are public Firebase application configuration, not service-account credentials.

All player/admin reads and writes go through the authenticated `api` Cloud Function. Firestore client rules deny everything. Point reads/transactions maintain per-player consistency; the admin dashboard uses a server aggregation. No client Firestore queries or realtime listeners are used. The admin's bootstrap Google email is fixed in `backend/.env.neo-glide-live`; a verified login is required. Subsequent admin access uses the custom `admin` claim.

## Live release prerequisites

1. Link a billing account / enable Blaze at https://console.firebase.google.com/project/neo-glide-live/usage/details. Function deployment is blocked on Spark. No live events are published by default.
2. In Play Console, configure Play Games for this app, register debug/upload/**Play App Signing** SHA fingerprints in Firebase, and set `NEO_GLIDE_PLAY_GAMES_APP_ID` as a Gradle property to the numeric Games service project ID. The SDK is not initialized with a dummy project ID. Refresh Android config with `npx -y firebase-tools@latest apps:sdkconfig ANDROID <app-id> --project neo-glide-live --out <temporary-file>` and replace `android/app/google-services.json`.
3. Enable Game Center for the existing App Store Connect app and signing profile. `App.entitlements` and the Xcode capability are included. The Google URL scheme is registered. GoogleSignIn is pinned to upstream commit `56d4ddc4aea182bd89a78b18f38c7512bf137cc0`, whose AppCheck range supports Firebase 13; the 10.0.0 release conflicts with Firebase 13.0.1. Replace the pin when a compatible stable release appears.
4. `APPLE_APP_ID=6755588297` is configured from the existing App Store release metadata. `APPLE_ENVIRONMENT=Production` is intentional; use a separate sandbox environment for StoreKit test receipts. Apple signed transactions are checked with the official server library and Apple's G3 root certificate. Give the deployed service account Android Publisher access to this application's purchases. Native signed receipts/tokens are required; web simulations cannot mint server purchase rewards.
5. After tests, deploy with `npx -y firebase-tools@latest deploy --only functions,firestore,hosting --project neo-glide-live`. `npm run build:admin` must run before Hosting deployment. The Hosting site contains the admin panel, not the game build.
6. Configure the existing rewarded iOS AdMob unit's server verification URL as `https://europe-west3-neo-glide-live.cloudfunctions.net/admobSsv`. Add an Android rewarded unit to `EVENT_AD_UNITS` when configured. No client callback grants event credits. Only a signed Google callback with the matching UID, nonce, unit, timestamp and unique transaction does so. Production test-unit callbacks are not accepted. Use `npm run build:release` for native live ad configuration after a real device SSV test.
7. Sign into the admin panel with the bootstrap owner, save drafts and publish the desired future schedule. First successful admin authentication sets its admin claim. Daily and weekly edits take effect on a future UTC period; enrolled instances keep their promises.

## Local development

Use Node 22 or newer and JDK 21 for the Firebase emulator. Install root and backend dependencies separately (`npm ci`, `npm ci --prefix backend`).

```sh
npx -y firebase-tools@latest emulators:start --project demo-neo-glide --only auth,firestore,functions
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed-events.js
VITE_FIREBASE_EMULATORS=true npm run dev -- --host 127.0.0.1
VITE_FIREBASE_EMULATORS=true npm run dev:admin -- --host 127.0.0.1
```

The seed script refuses to operate without a Firestore emulator. Emulated clients use `demo-neo-glide`; production cannot enable emulation through a query string. Google sign-in in the Auth emulator uses its test login dialog. Live native identity, store approval and signed AdMob callbacks still need physical-device checks.

## Persistence and recovery

`neo_glide_accounts_v1` points at `neo_glide_profile:<owner>`. The original player keys are backed up before the first migration and never imported into a second account. Audio/privacy preferences remain device-wide. Whole profiles are saved atomically; wallet balances and receipt IDs remain in one record. All pending flight and purchase operations capture their owner. Native purchase acknowledgement follows durable delivery.

Cloud writes include a base revision and operation ID. Divergent profiles require an explicit save choice rather than adding balances. The server preserves its reward receipt and ownership history across that choice. Account linking requires both independently verified identities; email equality is never sufficient. Linking backs up both records, keeps claim history and successful ad quota, and journals provider transfer so it can resume. A failed account-selection dialog leaves the original session intact. Recently authenticated credentials are required for account merge/delete; reconnect the current provider if reauthentication is requested.

Cloud saves and events sync automatically on startup, every 60 seconds while the app is visible and online, when connectivity returns, and when the app becomes visible again. Local profile edits also trigger a debounced sync after two seconds. One scheduler lives above the account-keyed game and is cleaned up on unmount; requests are shared while in flight. Failed session restoration retries automatically. Account changes and unresolved save choices pause scheduled work. The Events and Account screens show automatic sync status without manual sync buttons.

Each account sync first uploads its queued event checkpoints, then fetches fresh events and reconciles the player save. During a flight and its results/reward screen, checkpoints and matching-revision player progress can upload. Applying another device's profile, presenting a divergent save choice, and account activation wait until the flight releases ownership; returning to the menu immediately syncs both. Failed uploads stay queued for retry, and acknowledgement of an older checkpoint cannot delete a newer checkpoint recorded during the request. Background suspension pauses polling; returning to the app catches up immediately.

Event flights use per-run cumulative high-water counters and a server lease. Replays, revived flights and older checkpoints cannot recount progress. Pickup credits exclude distance, mission, boss and ad awards. Offline event authorization lasts 24 hours; event collection has a 24-hour grace period. Ordinary offline play continues when authorization expires. A lease also bounds cumulative flight duration. This is a client-simulated game with plausibility checks, not a server-authoritative competitive simulation.

## Checks

```sh
npm test
npm run test:backend
npm run test:emulators
npm run lint
npm run build
npm run build:admin
```

The emulator integration covers identity isolation, default-deny rules, revisions, idempotent save/flight/claim, out-of-order checkpoints, shared ad reservations, signed SSV replay/tampering, admin-only publishing and future-period revision behavior. Unit tests cover UTC boundaries, expedition progression, deterministic rewards, legacy migration, receipt preservation and late purchase delivery after switching accounts.

Development artwork preview: `/dev/events.html`. It renders the production Events component with isolated sample data and never submits claims. It is a Vite development entry point, not included in the game release bundle.
