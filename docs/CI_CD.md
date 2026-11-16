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
- **Device validation**: a manual main Release run with `dry_run=false` and
  `device_test=true` uses only internal TestFlight/Play and Sandbox functions.
  It works while automatic public publishing is paused. See
  [DEVICE_SECURITY_TEST.md](DEVICE_SECURITY_TEST.md).
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
| IOS_PROFILE_BASE64 | App Store profile for the app/team permitting production App Attest and Game Center |
| ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY_BASE64 | Existing App Store Connect API key with app release permission |
| FIREBASE_FUNCTIONS_ENV | Complete existing backend/.env.neo-glide-live configuration |

Run `bash scripts/ci/configure-signing.sh` **in your own Terminal** to configure
passwords and export only the Apple Distribution identity for team 5NA3743WWP.
Inspect and allow the macOS Keychain prompt yourself. The script uses random
temporary PKCS#12 encryption and deletes that file; passwords are read silently
and sent directly to GitHub encrypted secret storage.

Device mode pins `ci/release.json.appleInternalBetaGroupId` to the existing
internal Testing group, verifies its app/internal status through Apple, and never
submits an App Store version. A released internal TestFlight build is distinct
from an App Store release. Android device-mode review acknowledgements select
`channel=device-test`; public/alpha releases retain `channel=store`.

Environment variables: `ANDROID_KEY_ALIAS=upload`, `GCP_WORKLOAD_IDENTITY_PROVIDER`,
`PLAY_PUBLISH_SERVICE_ACCOUNT`, `FIREBASE_DEPLOY_SERVICE_ACCOUNT`,
`IOS_ADMOB_APP_ID` and `VITE_ADMOB_REWARDED_IOS`. Before Play production, also
configure `ANDROID_ADMOB_APP_ID` and `VITE_ADMOB_REWARDED_ANDROID`. Optional `NEO_GLIDE_PLAY_GAMES_APP_ID` defaults
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
  project. The custom `neoGlideFunctionAccessPublisher` role adds only
  `cloudfunctions.functions.setIamPolicy` and `run.services.setIamPolicy`,
  required to create public HTTPS functions. It permits changing access policies
  on this project's functions/Cloud Run services; no Cloud Functions Admin role
  is granted. Service Account User is bound separately to the existing compute
  runtime account and the App Engine default account required by the pinned
  Firebase CLI's preflight, never at project scope.
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

Store approval is asynchronous and either store may release first. The online
security migration deliberately changes compatibility: legacy sync is read-only
and economic writes return 426. The first protocol-1 sync preserves the previous
cloud save permanently, then starts a validated bank from server receipt records.
Do not merge this change into an automatic release until the owner has reviewed
that update requirement and outstanding store reviews. Keep automatic publishing
paused while merging for a signed dry run/device validation; complete real-device
checks before enabling a normal release.
See [ABUSE_PROTECTION.md](ABUSE_PROTECTION.md) for migration and activation gates.

`FIREBASE_FUNCTIONS_ENV` must explicitly contain `APP_CHECK_MODE=monitor` or
`enforce`. Deployment rejects emulator/debug-token settings and test receipt
configuration. Monitor allows missing tokens; it is a staging state, not enforced
attestation. Device-test deployment forces enforcement only on Sandbox functions.
Normal/public deployment requires `APP_CHECK_MODE=enforce`; switch the complete
production environment after real TestFlight/Play device proofs.
The signed iOS app must carry the production App Attest entitlement. A profile
may list both development and production; the signing preflight accepts that
Apple format but still rejects profiles that cannot sign production attestation.
The current replacement profile is **Neo Glide App Store App Attest 2026**.

Production/Sandbox notification functions and `apiSandbox` are additive endpoints.
The economy-operation refund index must be READY before deploying Functions.
Register Apple notification URLs and verify signed delivery separately; deploy
success does not configure App Store Connect's notification subscription.

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

Reruns use the original workflow commit. If delivery code itself is broken, fix
it through Dev → main. An owner can recover the missing store submission using
the exact retained signed artifact after matching its SHA-256, source/main
identity, passing checks and review gates. Preserve the successful other-store
submission. Check the exact Play build's Console availability before acknowledging
it on the correct channel; a manual recovery does not turn the failed Actions run
green. Build 103 used this path for Android after Fastlane rejected an unsupported
option before any upload. The lane contract test now validates options against
the installed locked Fastlane schemas as well as executing distribution guards.

First activation: obtain a passing signed dry run and resolve outstanding review
gates, then set repository variable `AUTO_PUBLISH_ENABLED=true`. Until then every
main merge validates packages without deployment. To pause future automatic
submissions set it back to false; this does not undo a submission already made.
