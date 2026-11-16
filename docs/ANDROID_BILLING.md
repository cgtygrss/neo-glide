# Android cosmetic packs and Google Play Billing

Neo Glide's Android store offers 26 non-consumable cosmetic visual kits through
the native `NeoGlideStore` Capacitor plugin. Each is a permanent **one-time
product**. Use the individual USD base targets in the
[price table](../release/1.3.0/metadata/store-prices.csv), then configure localized
prices in Play Console. The [console manifest](../release/1.3.0/metadata/store-catalog.json)
lists all product IDs. Every skin also has an earned-credit unlock; both routes
share ownership. Credit packs and Starter remain outside the Android catalog.

In 1.3.0, real-money products, billing connections, purchase reconciliation and
restores are available only after an adult age selection. Under-18 and unknown-age
players can unlock cosmetics with earned credits in local family play.

## Release setup

1. Use the existing Play app `com.cgtygrss.neoglide`. Build numbers and track
   selection come from the [release pipeline](CI_CD.md). The app targets API 36
   with minimum API 24 for Play automatic protection.
2. Configure the 26 permanent cosmetic products using the current catalog and
   localized store prices. Preserve existing product IDs. Validate purchases and
   restores with Play license testers before activating new products.
3. Install the test build through Google Play. Sideloading is not a reliable
   billing test. Include purchased, pending, canceled, restored and revoked cases.
4. Use the app's Play licensing RSA public key for Android signature checks.
   It is separate from the upload keystore and server credentials. The backend
   purchase-verification account needs app-scoped purchase API read access;
   publishing uses the separate identity documented in CI/CD.

For the reviewed Apple Silicon SDK setup, first review and explicitly accept
[Google's SDK license](https://developer.android.com/studio/terms), then run
`scripts/setup-android-sdk.sh` interactively. It installs API 36 and build tools,
checks the vendor archive SHA-256 and writes ignored `android/local.properties`.
The script does not accept license prompts automatically. Use JDK 21. After
building, `scripts/sign-android-release.sh` prompts locally for the upload-key
password; compare the certificate with Play Console before upload. Native build,
signing and Play-installed billing tests are still release gates; see
[the current remediation record](COMMERCIAL_REMEDIATION_2026-11-12.md).

Provide that Play licensing public key only to the Android release build:

```sh
NEO_GLIDE_PLAY_BILLING_PUBLIC_KEY='MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...' \
  ./android/gradlew -p android bundleRelease
```

For local builds, set `NEO_GLIDE_PLAY_BILLING_PUBLIC_KEY` in the ignored
`android/billing.properties` file. A Gradle property or environment variable
takes precedence. CI reads the key from the protected `store-release` environment.

The key is parsed as an RSA key once when the plugin loads and written to
`BuildConfig.PLAY_BILLING_PUBLIC_KEY`. A blank or malformed key is a deliberate
fail-closed state: the plugin rejects catalog, purchase, restore, and
entitlement requests and grants nothing. Do not add a sample key to source or
enable a client-only bypass.

## Delivery behavior to test

The plugin verifies the Play RSA signature over the original purchase JSON,
requires the signed package name, one supported product ID, and `PURCHASED`
state, then creates a stable transaction ID from
`google:SHA-256(purchaseToken)`. It never uses the order ID as an entitlement
identifier.

After verification, the JavaScript wallet first writes its durable grant ledger
and only then calls `finishTransaction`. The Android bridge acknowledges the
non-consumable at that point; it never calls `consumeAsync`. Pending payment is
reported as `pending` and is neither granted nor acknowledged. Entitlement and
restore snapshots also return `pendingProductIds` so the UI can block a
conflicting purchase while payment completes. On every resume and restore it
queries Google Play again, emits unacknowledged valid purchases for replay, and
queries acknowledged owners for current entitlements.

Use Play license-test pending-payment instruments to check that pending becomes
either purchased or cancelled without a grant beforehand. Android remains
blocked while pending until an authoritative Play refresh reports the result.
Also test cancellation,
already-owned, app termination after purchase but before acknowledgement, restore
on another test device, and refund/revocation reconciliation. The account purchase service verifies completed purchases with the Play
Developer API before granting ownership. Deploy its updated product allowlist
alongside the native catalog; the signature check alone does not establish
server ownership. Real-time refund notifications remain separate release work.
