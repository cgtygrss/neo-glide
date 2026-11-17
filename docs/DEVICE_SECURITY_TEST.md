# iPhone and Android security validation

This is the activation checklist for the server-owned economy. The existing
TestFlight build 10 and Play build 5 do not contain this code. Do not use them as
proof that the new native attestation/economy works.

As of 2026-11-16, install **1.3.0 (103)** from the existing TestFlight **Testing**
group or [Play internal testing](https://play.google.com/apps/internaltest/4701538221984940887).
Both are available to their existing internal testers. Signed dry run **102**
passed first. Run **43871744579** deployed enforced Sandbox functions and the READY
refund index. Missing/forged App Check and unsigned Apple callback checks passed.
Apple's Sandbox V2 URL is registered; signed delivery and real-device results
remain pending. The Android upload was recovered with the exact retained AAB in
Console after a Fastlane parameter error; the workflow's failure is retained.

## Controlled distribution

`AUTO_PUBLISH_ENABLED=false` pauses public publishing during this validation.
After required checks, merge Dev → main without bypassing protection. The push
creates a signed dry run. Then manually run **Release** on main with
`dry_run=false` and `device_test=true`:

```sh
gh workflow run release.yml --ref main -f dry_run=false -f device_test=true
```

This keeps the existing main-only environment/OIDC trust and the same test,
signing, artifact hash, build collision and pending-review gates. It deploys
rules/indexes first, waits for READY, and deploys only `apiSandbox` and
`appStoreSandboxNotifications`. It does not deploy `api`, `admobSsv`, production
notifications or Hosting. No production player migration runs in this step. The deployed Sandbox API
requires valid App Check from its first request, independent of the staging
secret’s monitor setting. A missing/failed device proof must fail the test; there
is no automatic downgrade.

The IPA is uploaded without App Store review submission, waits for valid Apple
processing and is attached only to the existing internal **Testing** group. No
external testers or public beta group are added. Android is uploaded only to
**internal**, with a Sandbox realm and demo ad inventory even if the normal
release track later becomes production. No test is skipped. The manifest stores
the mode/track; retries cannot change them or replace a successful upload.

The two beta submissions have separate `ios-device-test` and
`android-device-test` deployment records. Play upload status is not proof of
availability. Check the exact new versionCode in Console, then acknowledge its
result with **Confirm Play review result**, selecting `channel=device-test`.
This does not acknowledge another build or a production submission.

## Installation and test identity

1. Record the exact version/build from the workflow report, and install **that**
   build using TestFlight on iPhone and Google Play internal testing on Android.
   Do not sideload the APK to test Play Integrity/licensing.
2. Keep any family/previous saves. Use a dedicated adult test account/guest for
   account deletion and refund tests, with no production progress attached.
   Deleting an online account intentionally deletes both realms and its merged
   identities; it is not a harmless Sandbox reset.
3. Use only store test purchases. Stop if a real-charge purchase sheet appears.
   Do not enter passwords, store credentials, codes or purchase tokens in chat.
4. Test mode must show the separate-bank banner. Select an adult age group on a
   test installation; never change a child's actual age choice to enable testing.

## Tests on each device

| Action | Required result |
| --- | --- |
| Launch and connect online | Test banner eventually says **Device verification: Verified**, based on the server's verified App Check token |
| Stay online for another sync | Verification remains Verified; no duplicate login/purchase prompts |
| Fly, pause, return from background | Flight remains consistent; one accepted checkpoint earns once |
| Buy a credit-priced item twice | Catalog price charged once for the same operation; already-owned item does not charge again |
| Test purchase + app restart + restore | Server wallet/ownership survives; no duplicate credit grant; pending acknowledgement is retried |
| Switch/link test accounts | No balance summing; approved receipts remain owned; late delivery stays with its buyer/verified merge |
| Go offline, then reconnect | No unapproved online credit/unlock; queued authorized flight is validated on reconnect |
| Select previous save offline | Separate local progress, no cloud/store/ads; returning online restores the online bank |
| Fresh family installation | Age choice, garage, flight and pause work without an online account, ads or purchases |

Record iPhone/Android model, OS, app build, verification result and any visible
error. Screenshots may include personal account details; keep diagnostics outside
the repository and redact them before public sharing. Never include tokens.

## Store notifications and enforcement

Configure the Sandbox V2 notification URL in App Store Connect after deployment:

`https://europe-west3-neo-glide-live.cloudfunctions.net/appStoreSandboxNotifications`

Verify a signed test notification, then a Sandbox refund/reversal. Confirm the
server ledger changes without opening the buyer app, only in the Sandbox bank.
Test refunding spent credits: remaining money is removed, credit-funded purchases
are reversed if needed, and any remaining debt blocks spending until repaid.
Production notification configuration and missed-notification recovery are a
separate activation gate; do not replace an existing endpoint blindly.

Sandbox already enforces App Check. After both devices pass, set the complete
production Functions environment to `APP_CHECK_MODE=enforce`; normal deployment
rejects monitor mode. Recheck missing/forged/wrong-app proofs are rejected,
while family play stays offline. Preserve the installed old-client read-only
policy and existing store reviews. Review the production migration timing before
running a normal release. Re-enable `AUTO_PUBLISH_ENABLED=true` only when ready
for the normal main → public-review/alpha release behavior.

Flight statistics still use bounded client counters, not server simulation.
Google notification recovery/project-wide abuse and billing controls remain in
[ABUSE_PROTECTION.md](ABUSE_PROTECTION.md); this checklist is not a claim of zero
cheating or unlimited cost protection.

Implementation references: [Fastlane TestFlight upload options](https://docs.fastlane.tools/actions/upload_to_testflight/),
[selective Firebase deployment](https://firebase.google.com/docs/functions/manage-functions#deploy_functions).
