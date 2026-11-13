# Neo Glide CI/CD

Normal development uses **Dev** (case-sensitive). The repository default is Dev;
release pull requests target **main**. Main requires the GitHub Actions
`Required checks` check and a pull request, including for the administrator.
No second reviewer is required. Force-push and deletion are disabled.

## Workflows

- **CI**: Dev pushes, pull requests into main and calls from Release. Node 22,
  ESLint, game and pipeline tests, backend tests, required local Auth/Firestore
  emulator integration, Android tests/lint/release compilation, and an iOS
  Release simulator build plus a fresh-device navigation/flight UI test.
- **Release**: main pushes and manual main runs. Both platform checks and signed
  builds must pass before any deployment. `AUTO_PUBLISH_ENABLED=false` makes
  main pushes dry runs. Manual `dry_run=true` always prevents deployment.
- **Confirm Play review result**: an owner checks the exact build in Play Console
  and records its final outcome. Run on main, initially for existing build **5**,
  only once that build is actually approved/available or rejected. Approval must
  not be inferred from a successful API upload or a `completed` track status.

Release jobs use a queued concurrency group. Do not cancel a release after an
upload starts. Use **Re-run failed jobs**, preserving its original run number,
artifacts and manifests. A full rerun that changes signed bytes fails the
artifact-identity check instead of silently reusing an occupied build number.

## Versions and release notes

`package.json.version` is the marketing-version source. Run `npm run version:sync`
after editing it; this updates the public version file and Xcode marketing
version. Android reads package.json directly. Commit release notes at
`ci/changes/<version>/en-GB.txt`. Do not reuse an already released Apple version.

Both store build numbers are **100 + Release workflow run_number**, excluding
run_attempt. Store preflight rejects occupied or lower numbers unless a matching
ledger entry proves this is the same run, commit and artifact. If an out-of-band
upload overtakes the counter, increase `buildNumberOffset` in `ci/release.json`.

App identifiers differ intentionally:

| Platform | Identifier |
| --- | --- |
| Android | com.cgtygrss.neoglide |
| Apple | com.cgtygrssgame.neonglide |
| Apple team / app | 5NA3743WWP / 6755588297 |

Android starts on existing closed track **alpha**. After Google approves
production access, change `androidTrack` to `production` through Dev → main.
Production Android then requires real native and web ad IDs. Closed testing
uses demo inventory. iOS store packages require the existing live iOS inventory.
Family-mode tests select Under 13 and keep online services unavailable.

## Protected publishing configuration

Environment **store-release** accepts only the **main branch**. Neither Dev nor
pull-request jobs receive signing secrets. Actions are pinned to commit SHAs;
npm, Ruby and CI-tool dependency locks are committed. Signing material is created
in temporary runner storage, never uploaded as a diagnostic artifact, and removed
in cleanup steps. Signed AAB/IPA files and their source/hash manifests are retained
for 30 days; test reports for 14 days. This is a public source repository, so
never store credentials in source, release notes or workflow logs.

Environment secrets:

| Secret | Purpose |
| --- | --- |
| ANDROID_KEYSTORE_BASE64 | Existing upload-key.jks; never generate a replacement |
| ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_PASSWORD | Existing upload key passwords |
| NEO_GLIDE_PLAY_BILLING_PUBLIC_KEY | App's Play licensing public key |
| IOS_CERTIFICATE_BASE64 / IOS_CERTIFICATE_PASSWORD | Encrypted Apple Distribution PKCS#12 |
| IOS_PROFILE_BASE64 | App Store provisioning profile for the app and team |
| ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY_BASE64 | Existing App Store Connect API key with app release permission |
| FIREBASE_FUNCTIONS_ENV | Complete existing backend/.env.neo-glide-live configuration |

Run `bash scripts/ci/configure-signing.sh` **in your own Terminal** to configure
passwords and export only the Apple Distribution identity for team 5NA3743WWP.
Inspect and allow the macOS Keychain prompt yourself. The script uses random
temporary PKCS#12 encryption and deletes that file; passwords are read silently
and sent directly to GitHub encrypted secret storage.

Environment variables: `ANDROID_KEY_ALIAS=upload`, `GCP_WORKLOAD_IDENTITY_PROVIDER`,
`PLAY_PUBLISH_SERVICE_ACCOUNT`, `FIREBASE_DEPLOY_SERVICE_ACCOUNT`,
`IOS_ADMOB_APP_ID`, `VITE_ADMOB_REWARDED_IOS`, `VITE_ADMOB_INTERSTITIAL_IOS`,
`VITE_ADMOB_REWARDED_INTERSTITIAL_IOS`. Before Play production, also configure the
equivalent Android ad variables. Optional `NEO_GLIDE_PLAY_GAMES_APP_ID` defaults
to disabled; do not put an empty value into the Gradle property.

## Cloud identities and store access

`node scripts/ci/bootstrap-cloud.mjs` prints a read-only setup plan using the
owner's existing Firebase CLI login. `--apply` creates the dedicated accounts,
OIDC provider and additive IAM bindings, preserving existing policies/etags:

- `neo-glide-play-publisher@neo-glide-live.iam.gserviceaccount.com` has no project
  role. Play Console must give it app-only read, test release and production
  release access. Google's release permission also carries policy/deep-link
  capabilities. Do not grant administrator, financial, refund or pricing access.
- `neo-glide-firebase-deployer@neo-glide-live.iam.gserviceaccount.com` receives
  Cloud Functions Developer, Firebase Hosting Admin, Firebase Rules Admin,
  Datastore Index Admin, Service Usage Consumer and Firebase Viewer in this
  project. Service Account User applies only to the existing runtime account.
  As expected, ability to deploy server code also allows acting through that
  server's runtime identity; this account is restricted to trusted main jobs.
- Trust is bound to immutable GitHub repository/owner IDs, refs/heads/main and
  this repository's exact release.yml workflow. No downloadable Google key or
  long-lived FIREBASE_TOKEN is used. Runtime purchase-validation permissions
  remain on the existing compute account and are not expanded by this setup.

Apple must already have complete store metadata, screenshots, privacy/content
declarations and required agreements. The pipeline preserves existing review
submissions; it never rejects or cancels them. It only changes version/release
notes and sends the exact selected build for review with automatic release.
Google Managed publishing must be off for automatic availability after approval.
The workflow does not invent legal declarations or purchase-review information.

## Deployment, review and recovery

The order is checks → both signed artifacts → store/review preflight → changed
Firebase components → iOS/Android submissions (one at a time). Firebase component
hashes are compared against the last successful deployment, including on retries;
partial failure cannot cause a missed backend change on the next main merge.
Rules/indexes deploy before functions, indexes must become READY, then both
Hosting sites deploy. The workflow does not use `--force` to delete functions.

Keep server/rule changes compatible with all installed application versions;
store approval is asynchronous and either store may release first. Emulator
tests include the existing 1.2.0 client protocol. Do not combine an incompatible
server migration with a mobile release. Deploy additive compatibility first.
No destructive database migration is part of this pipeline.

GitHub deployment records retain run/commit/build/hash and submission state.
Apple's actual review state is queried. Play's API cannot reliably establish
final review completion; the owner acknowledgement closes that release record.
An interrupted upload keeps an unresolved record, so another commit cannot pass
it. The same run refreshes store state, verifies any existing Play bundle hash,
and resumes without re-uploading a successful submission.

Reports distinguish **submitted for review** from **confirmed live**. Build
success is not a legal-compliance or error-free-game guarantee. A partial store
submission cannot be rolled back atomically: preserve its successful submission,
fix the failing step and rerun failed jobs. For a released defect, prepare a new
version on Dev; do not reuse an old build number or automatically withdraw an app.

First activation: obtain a passing signed dry run and resolve outstanding review
gates, then set repository variable `AUTO_PUBLISH_ENABLED=true`. Until then every
main merge validates packages without deployment. To pause future automatic
submissions set it back to false; this does not undo a submission already made.
