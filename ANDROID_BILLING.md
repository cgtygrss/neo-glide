# Android cosmetic packs and Google Play Billing

Neo Glide's Android store sells ten non-consumable cosmetic packs through the
native `NeoGlideStore` Capacitor plugin. Each pack should be created in Google
Play Console as a **one-time product** priced at **US$2.99** (then let Play
derive local prices). They are not consumables, credit packs, or starter packs.

| Product ID | Play Console product type | Base price |
| --- | --- | --- |
| `cosmetic_void_pilot` | One-time product / non-consumable | US$2.99 |
| `cosmetic_solar_forge` | One-time product / non-consumable | US$2.99 |
| `cosmetic_arctic_pulse` | One-time product / non-consumable | US$2.99 |
| `cosmetic_cyber_current` | One-time product / non-consumable | US$2.99 |
| `cosmetic_rose_circuit` | One-time product / non-consumable | US$2.99 |
| `cosmetic_jade_drift` | One-time product / non-consumable | US$2.99 |
| `cosmetic_pearl_comet` | One-time product / non-consumable | US$2.99 |
| `cosmetic_cobalt_storm` | One-time product / non-consumable | US$2.99 |
| `cosmetic_copper_horizon` | One-time product / non-consumable | US$2.99 |
| `cosmetic_prism_voyager` | One-time product / non-consumable | US$2.99 |

## Release setup

1. The existing Play app uses `com.cgtygrss.neoglide`. Google Play blocks
   one-time-product creation until an App Bundle declaring the Billing
   permission has been uploaded; upload the new internal-testing bundle first.
   The last uploaded bundle was version code 3, so this release is version code
   4 / version 1.2.0.
2. Create and activate all ten one-time products above. Give each its final
   title, description, tax/category information, and US$2.99 base price. Use a
   permanent buy option only: do not configure a rental or pre-order offer for
   these cosmetic packs.
3. Add the people/devices used for testing as license testers and install the
   build from the internal-testing track. A sideloaded release build is not a
   reliable billing test.
4. Copy **Monetization setup → Licensing**'s Base64-encoded RSA public key.
   This is a public verification key, never the app-signing keystore, upload
   key, service-account JSON, or a private key.

Provide that Play licensing public key only to the Android release build:

```sh
NEO_GLIDE_PLAY_BILLING_PUBLIC_KEY='MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...' \
  ./android/gradlew -p android bundleRelease
```

For a developer machine, copy `android/billing.properties.example` to the
ignored `android/billing.properties` and set the key there. Gradle reads its
property or environment variable first, then this project-local file:

```properties
# android/billing.properties (ignored) or an untracked CI-generated file
NEO_GLIDE_PLAY_BILLING_PUBLIC_KEY=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...
```

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
on another test device, and refund/revocation reconciliation. For production
fraud and refund handling, add a secure backend with Play Developer API and
real-time developer notifications; the native signature check is a client-side
defense, not a replacement for server verification.
