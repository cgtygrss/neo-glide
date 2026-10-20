# Payments release status — 2026-10-20

Payment code is implemented and verified. The release web build, Capacitor
copies, Android debug APK and unsigned release AAB, and iOS simulator build all
completed. Validation also passed: 98 JavaScript tests, lint, and four Android
JUnit tests.

## Android

- Application ID: `com.cgtygrss.neoglide`
- Release version: code `4`, name `1.2.0`
- The real Play licensing public key is configured in the ignored
  `android/billing.properties`; no key value is committed.
- Unsigned AAB: [NeoGlide-1.2.0-version4-UNSIGNED.aab](1.2.0/NeoGlide-1.2.0-version4-UNSIGNED.aab)
- Signed AAB: [NeoGlide-1.2.0-version4-payments.aab](1.2.0/NeoGlide-1.2.0-version4-payments.aab)
- The merged debug manifest includes `com.android.vending.BILLING`.

Google Play currently blocks one-time product creation until a bundle declaring
the Billing permission is uploaded. An existing upload key was not found in
Documents, Desktop, Downloads, iCloud, or `.android`; Trash was inaccessible.
On 2026-10-20 the user created a new upload key and public certificate locally
and submitted the reset request. The user reports Google's email says the new
key becomes effective on 22 October 2026; the Console still showed the request
as pending at the latest check. The user signed the AAB locally, and signature
verification and certificate matching passed. See the [upload-key recovery
guide](ANDROID_UPLOAD_KEY_RECOVERY.md) for hashes and details. Do not upload
before the effective date and Console confirmation; do not use the debug key.

## iOS

- Bundle ID: `com.cgtygrssgame.neonglide`
- App Store Connect app: `6755588297`
- The user accepted the new Apple Paid Apps Agreement and its UI status is
  active.

As observed on 2026-10-20, all ten non-consumable product IDs matched the catalog. Each had a US$2.99 base
price with automatically derived local prices, availability in all countries,
and an English (UK) display name and description. A per-pack screenshot from the
actual game was uploaded and accepted, with a source thumbnail shown. Review
notes are filled for all except Void Pilot, where they are optional.

Products remain **Prepare for Submission**, not live. Neither the app nor the
in-app purchases have been submitted for review or published. The device
inventory showed no connected physical device; real-device sandbox and
license-tester purchase flows have not yet been run.

The new App Store provisioning profile **Neo Glide App Store 2026** (UUID
`e479787b-6507-4164-8a5b-86a17f95236f`) was created using the existing Apple
Distribution certificate and private key; no new certificate or private key was
created. A manual-signing Release archive and App Store Connect IPA export
completed successfully:

- Archive: `/tmp/neo-glide-payments-release.xcarchive`
- Signed IPA: [NeoGlide-1.2.0-build3-payments.ipa](1.2.0/NeoGlide-1.2.0-build3-payments.ipa)

The exported IPA was verified with bundle ID `com.cgtygrssgame.neonglide`,
version `1.2.0` (build `3`), the same embedded profile, and the existing Apple
Distribution identity for team `5NA3743WWP`. On 2026-10-20, Xcode Organizer
reported that the archive's App Store Connect upload completed successfully.
App Store Connect's Build Uploads list confirms version 1.2.0 (build 3) is
**Processing** as of 2026-10-20. TestFlight readiness is not yet confirmed.

| Product SKU | Apple ID |
| --- | --- |
| `cosmetic_void_pilot` | `6824531841` |
| `cosmetic_solar_forge` | `6824532910` |
| `cosmetic_arctic_pulse` | `6824532851` |
| `cosmetic_cyber_current` | `6824532780` |
| `cosmetic_rose_circuit` | `6824532524` |
| `cosmetic_jade_drift` | `6824532930` |
| `cosmetic_pearl_comet` | `6824532939` |
| `cosmetic_cobalt_storm` | `6824532897` |
| `cosmetic_copper_horizon` | `6824532867` |
| `cosmetic_prism_voyager` | `6824532974` |


## Cosmetic VFX source update

The current cosmetic VFX source changes postdate the uploaded iOS 1.2.0 (3)
and signed Android v4 artifacts; those artifacts do not contain the updated
effects or the new credit and cash price tiers. To include these changes, the
next native candidate must be rebuilt from the updated source. No native rebuild has been performed for this update.

## Current cosmetic price targets and App Store Connect status

The earlier US$2.99 prices were observed before the tier changes. On
2026-10-20, the following changes were confirmed in App Store Connect. Native
storefronts provide localized prices; the Turkish amounts below are the values
observed in the console.

| Rank | Theme | Tier | Credits | Target USD base | SKU | App Store Connect verification |
| --- | --- | --- | ---: | ---: | --- | --- |
| 01 | Copper Horizon | Classic | 1,200,000 | $2.99 | `cosmetic_copper_horizon` | $2.99 previously confirmed; unchanged and not rechecked today |
| 02 | Arctic Pulse | Classic | 1,500,000 | $3.49 | `cosmetic_arctic_pulse` | Confirmed $3.49 / TRY 199.99 |
| 03 | Cyber Current | Signature | 1,800,000 | $3.99 | `cosmetic_cyber_current` | Confirmed $3.99 / TRY 199.99 |
| 04 | Jade Drift | Signature | 2,200,000 | $4.49 | `cosmetic_jade_drift` | Confirmed $4.49 / TRY 249.99 |
| 05 | Rose Circuit | Elite | 2,600,000 | $4.99 | `cosmetic_rose_circuit` | Change not completed |
| 06 | Solar Forge | Elite | 3,000,000 | $5.99 | `cosmetic_solar_forge` | Change not completed |
| 07 | Pearl Comet | Prestige | 3,600,000 | $6.99 | `cosmetic_pearl_comet` | Change not completed |
| 08 | Void Pilot | Prestige | 4,200,000 | $7.99 | `cosmetic_void_pilot` | Confirmed $7.99 / TRY 399.99 |
| 09 | Cobalt Storm | Legendary | 5,000,000 | $8.99 | `cosmetic_cobalt_storm` | Change not completed |
| 10 | Prism Voyager | Legendary | 6,000,000 | $9.99 | `cosmetic_prism_voyager` | Change not completed |

Pricing sections were loading or blank during the latest attempt. Rose showed
“Sorry, something went wrong”; reloading and opening a fresh in-app browser tab
produced the same failure, while Solar availability and pricing continued to
spin. The five outstanding changes remain incomplete.

Only Arctic and Cyber review notes were updated for the new themes and credit
prices (1,500,000 and 1,800,000). Arctic's earlier note incorrectly described
Cyber and 400,000 credits; the correction was verified after reload. The other
review notes and screenshots still need refreshing for the new effects and
prices before review. No app or in-app purchase has been submitted for review
or published.

The latest source checks passed 103 tests, and the ten StoreKit fixture cash
prices were independently checked against the catalog. No native rebuild was
performed for these changes.

## Flight earnings rebalance

The current source also includes the later flight earnings rebalance. The uploaded
iOS 1.2.0 (3) and signed Android v4 artifacts predate it, as well as the VFX and
price-tier updates. A future native candidate must be built from current source
to include these changes; no native rebuild was performed for this update.

## Galaxy destinations and title

The current source adds a new title treatment and credit-purchasable galaxy
backgrounds. The uploaded iOS 1.2.0 (3) and signed Android v4 artifacts predate
these changes. A future native candidate must be built from current source to
include them; no native rebuild or upload was performed for this update.

## Temporary vehicle update

Current source includes five free, temporary vehicle abilities during ordinary flight: Star Striker,
Comet Drill, Storm Sphere, Volt Ray and Aegis Orb. Capsules and ordinary flight rewards use the ordinary flight
economy; no store products or entitlements were added. This update is local
source only: the uploaded iOS 1.2.0 (3) and signed Android v4 artifacts do not
contain the vehicles. No native rebuild or upload was performed.
