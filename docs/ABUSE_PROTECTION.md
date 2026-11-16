# Abuse protection — implementation and activation

Staged on **2026-11-16** through Dev → main. Signed dry run **102** passed.
Device-validation run **43871744579** deployed only `apiSandbox` and
`appStoreSandboxNotifications`, with `APP_CHECK_MODE=enforce`; the refund index is
READY. The existing production API/SSV build revisions and update times were
unchanged. Real deployed checks reject missing/forged App Check tokens (401) and
unsigned Apple notifications (400). TestFlight and Play internal **1.3.0 (103)**
are available; this is not public availability or proof of real-device attestation.

App Attest and Play Integrity are registered in Firebase; Play Integrity is linked
to the correct Cloud project and the actual Play signing SHA-1/SHA-256 certificates
are registered. The replacement Apple profile signs production App Attest.
Apple's Sandbox V2 callback URL is configured. Signed callback delivery, physical
device tests and production activation remain pending. Public publishing stays
paused; the stored production Functions environment still selects `monitor`.

## Online economy and retained saves

The accepted policy is a server-controlled online economy and a separate offline
family/previous-save game. Ordinary save and conflict-resolution requests cannot
set online credits, ownership, upgrades, career statistics or receipt records.
The server calculates prices from the shared catalog, including UTC daily offers,
and checks funds and upgrade limits. A durable spend ID prevents duplicate charges;
reusing it with changed inputs fails. Already-owned/no-op purchases allocate no
financial operation document. Career claims and flight checkpoint deltas are
idempotent. Verified store delivery is committed before native acknowledgement;
it does not also grant a second local reward.

The first protocol-1 sync preserves the previous cloud save permanently at
`players/<uid>/backups/pre-economy-v1` and starts a validated online bank. Only
server-owned, nonrevoked receipts with the matching environment reconstruct money
and paid entitlements. Unverified balances, earned gear and progress are retained
in the archive, not imported. The previous local save is archived as well. Account
settings allow playing that save offline and returning to the online bank. Local
archive play has no authentication, ads, cloud writes or store purchases. Family
mode remains offline. Account deletion clears both online realms, merged accounts
and the corresponding local archives.

Older clients may read sync data, but economic writes return HTTP 426 with
`economy-update-required`. This is a deliberate update requirement, not transparent
compatibility. Do not deploy it alongside an unresolved old store review without
an explicit staged rollout decision. New clients never acknowledge a purchase
whose server verification/durable delivery failed.

## Trust boundaries and bounds

- All consumer API requests validate schema, field names, identifier shape,
  revisions, map depth/node counts and payload size. Firebase ID tokens are
  verified with revocation checks. Cross-account requests and client UID claims
  cannot select another player's bank. Raw receipts, tokens and provider errors
  are absent from public error responses.
- Direct Firestore client access is denied. The browser admin flow requires a
  verified bootstrap email or the admin claim before budget/DB access, followed
  by the existing admin-role/bootstrap checks. Consumer native attestation does
  not replace administrator authorization.
- A transactional shared UID budget allows 120 requests/minute and 12,000/day;
  resolve/merge each allow 12/day, reconciliation 100/day, purchases 500/day and
  ad intents 100/day. Production and Sandbox share this budget. Excess is 429.
  These per-account limits do not prevent an attacker creating many accounts and
  are not a project-wide cost ceiling.
- Online flight earnings use elapsed-time leases and monotonic counters.
  Cumulative startup allowances and total flight time are charged across runs,
  leases and merges. Replays and out-of-order checkpoints do not duplicate money.
  **Flight physics still run on the client.** Bounds reject implausible submissions;
  an attested modified client can still fabricate plausible counters. Strong
  competitive anti-cheat would require server simulation or verifiable replays.
- Sync reuses leases for the same UID/day/event set. Equivalent save/resolve
  operations allocate no backup or operation. Changed resolutions retain four
  recent slots and preserve the permanent pre-economy archive. Merge backups use
  four fixed slots. Financial spend/receipt ledgers remain durable for refunds.
- Leases/flights expire after three days, ordinary operations after 30 days,
  ordinary backups after seven days, intents one day after their expiry,
  inactive budgets after 30 days and notification deduplication after 90 days.
  TTL in `firestore.indexes.json` is asynchronous; fixed slots/live quotas enforce
  bounds beforehand. Historical documents without expiry are not purged.

## Native attestation and purchase realms

Android installs Firebase App Check's Play Integrity provider; iOS installs App
Attest before Firebase initialization. Neither uses a production debug bypass.
Tokens remain in memory and are sent as `X-Firebase-AppCheck`. Failed token reads
have a timeout, share pending work and back off. The backend accepts only the
registered app IDs. Valid web tokens cannot authorize native economic actions.
`monitor` permits a missing token during rollout but rejects supplied invalid
ones; `enforce` requires valid attestation. Only a demo project with both local
Auth and Firestore emulator addresses can bypass verification.

An authenticated token is not proof of every in-game action. App Check does not
replace the economic validations above. Do not enable Firebase Auth's global App
Check enforcement yet: the browser admin and secondary native sign-in flow need
separate provider work before that switch.

The iOS StoreKit app-transaction environment selects Production, Sandbox or local
Xcode testing. Android embeds the realm derived from the configured Play track.
Production uses `api`, Sandbox uses `apiSandbox` and
`testEnvironments/storeSandbox/...`; caches/profiles/queues are scoped separately.
Xcode StoreKit testing cannot call the live API. Signed receipt environment must
match the endpoint; Apple Production-to-Sandbox fallback is removed and Google
license-test receipts cannot fund Production. Sandbox ads, merges and admin
operations are disabled. A test-play banner makes this separation visible.

## Refunds and callbacks

Apple's separate Production/Sandbox V2 handlers verify both the notification JWS
and its nested transaction with the official verifier. Unknown receipts get a
revocation tombstone. Permanent goods are reconciled from server ledgers. For
refunded credit packs/Starter credits, the current bank loses the granted credit;
unspent funds are taken first, then credit-funded equipment/upgrades are reversed
newest first until the deficit is covered. Remaining debt is repaid by later
credits and blocks spending. Financial bank IDs prevent a refund against a
previously discarded merge bank from removing another bank's items. A reversal
restores money once without silently repurchasing cancelled equipment. Starter
gift gear is removed unless independently earned/purchased with valid credits.

Client-supplied signed revocations use the same financial reconciliation as the
webhook. Replays, stale notices, deleted owners, account aliases and reversal
ordering are handled transactionally. The composite `economyOperations` index
must be READY before function deployment.

AdMob validates the signed envelope before fetching verifier keys. Key refreshes
share a bounded request, timeout and failure backoff. Only a matching server
intent, UID, unit, timestamp and unique transaction can reward event ads. Google
purchase API HTTP requests also time out. Current Android commerce offers only
permanent cosmetic SKUs; their cancellation is checked on server reconciliation.
A Google RTDN/voided-purchase recovery hook is still needed for prompt revocation
when a buyer never opens the app again, and before adding Android consumables.

The controlled first-device rollout is documented in
[DEVICE_SECURITY_TEST.md](DEVICE_SECURITY_TEST.md). It deploys only Sandbox
functions and distributes only internal store builds while public publishing is
paused. Sandbox responses expose a bounded verification result; its test banner
shows Verified only when the server accepted the native token. Device-mode
deployment forces Sandbox enforcement; normal deployment refuses monitor mode.
Once enforcement is active, installed clients without native App Check must
update before cloud access, including the legacy read-only protocol.

## Required activation and limits

1. Complete a signed **dry run** with the replacement App Attest profile. Exercise
   real TestFlight and Play closed-test devices: sign-in, attestation, isolated
   purchase, restore, spend, offline archive and delete. A simulator does not
   prove App Attest/Play Integrity. Sandbox device-mode deployment enforces tokens
   from its first request; production activation follows successful device checks.
2. Review the old-client update requirement and pending store reviews. Stage the
   compatible rollout through Dev → main, do not bypass required checks or
   cancel a review. Source tests alone do not authorize claiming protection live.
3. Deploy rules/indexes first and wait for READY, then functions and both sites,
   using the existing pipeline. Verify the named `events` database and TTL.
4. Register Apple's Production and Sandbox HTTPS notification URLs in App Store
   Connect, send signed test notifications and check delivery/DB effects. Recover
   missed notices with Apple's notification history API; source handlers alone
   are not active subscriptions. Never expose the release API private key to the
   runtime merely to make this easier.
5. After device validation, switch `APP_CHECK_MODE` to `enforce` in the complete
   Functions environment and redeploy. Test missing/forged/wrong-app tokens are
   rejected. Monitor failures before wider rollout; no automatic downgrade.
6. Review project-wide traffic quotas, account creation abuse, billing alerts and
   provider incidents. A Firebase budget alert is not a hard spending cap.
   Authentication/attestation and instance limits do not eliminate all DoS costs.

## Verification

Run game/backend/CI tests, lint, the required Auth–Firestore emulator integration,
web/admin builds, Android unit tests/lint/release build, and the existing iOS
Release navigation/flight/pause/background smoke test. Integration covers migration
archive retention, separate banks, 426 legacy writes, concurrent spend/retry,
refund rollback/reversal, account merge/deletion, cross-account rejection,
request budgets, reward replay, stable leases, no-op allocation and direct DB denial.
Local verification on 2026-11-16: 393 game tests, 42 backend unit tests,
14 pipeline tests, and the separately required Auth–Firestore integration passed.
The backend unit command skips the emulator-only test; it passed in that separate
integration run. Lint, web/admin builds, Android unit/lint/release and iOS Release
simulator compilation passed. The eight-capture iOS UI scenario passed on the
installed **iOS 27.0 runtime with Xcode 27.2 SDK** and hosted **iOS 27.2** CI.
Root/backend npm audits reported no vulnerabilities; the Firebase CLI toolchain
has 14 moderate transitive advisories and no high/critical findings. A forced
breaking toolchain downgrade was not applied.

Real signing, device attestation, deployed indexes and store callback delivery
must be reported separately from local tests.

References: [custom-backend App Check](https://firebase.google.com/docs/app-check/custom-resource-backend),
[Firestore TTL](https://firebase.google.com/docs/firestore/ttl),
[Apple notifications](https://developer.apple.com/documentation/appstoreservernotifications/receiving-app-store-server-notifications).
