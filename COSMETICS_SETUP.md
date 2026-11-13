# Cosmetics setup

Configure all 26 non-consumable skin products in App Store Connect and Google
Play using the [price table](release/1.2.0/metadata/store-prices.csv) and
[console manifest](release/1.2.0/metadata/store-catalog.json). USD base prices
are targets; native storefronts supply localized prices. Existing IDs are
preserved; the 16 new cash products need console registration before release.

Every skin also supports an earned-credit unlock. Prices use the best-value
credit pack (USD 7.99 for 1,500,000 credits), rounded to the nearest 10,000.
`backend/shared/store-catalog.js` holds the product IDs and pricing reference.
Run `npm run store:sync` to regenerate native lists, fixtures and metadata.
Both event skins remain earnable in Events as well as purchasable.

Credit, event and verified store ownership satisfy the same unlock check.
An existing unlock prevents another credit debit or new store purchase. Credit
ownership remains valid if a separate store entitlement is refunded or revoked.
Native receipt verification and account sync retain their existing protections.
Deploy the updated backend verifier and rebuild native apps before release.

The StoreKit sandbox fixture is `ios/StoreKitTests/NeoGlide.storekit`. Real
StoreKit or Play Billing verification requires external sandbox/test accounts
and the relevant console configuration; it is not verified merely by the local
fixture. Android release billing also requires a configured Play public key.
With no public key, the Android bridge must expose cosmetics as unavailable and
grant no purchase.

Ask-to-Buy can return `pending` without an entitlement. Neo Glide keeps a
durable local pending marker and blocks buying that same cosmetic with credits.
On iOS, **Check / retry purchase** sends a new request to StoreKit while keeping
that marker: cancelling or declining it never grants content or clears the
marker, and a verified delivery clears it. StoreKit has no authoritative query
for a declined request. Android pending payment stays blocked until a fresh
authoritative Play snapshot changes it.
