# Cosmetics setup

Configure these ten non-consumable products in App Store Connect and Google Play. USD base prices are targets; native storefronts supply localized prices.

| Rank | Theme | Tier | Credits | USD base | SKU |
| --- | --- | --- | ---: | ---: | --- |
| 01 | Copper Horizon | Classic | 1,200,000 | $2.99 | `cosmetic_copper_horizon` |
| 02 | Arctic Pulse | Classic | 1,500,000 | $3.49 | `cosmetic_arctic_pulse` |
| 03 | Cyber Current | Signature | 1,800,000 | $3.99 | `cosmetic_cyber_current` |
| 04 | Jade Drift | Signature | 2,200,000 | $4.49 | `cosmetic_jade_drift` |
| 05 | Rose Circuit | Elite | 2,600,000 | $4.99 | `cosmetic_rose_circuit` |
| 06 | Solar Forge | Elite | 3,000,000 | $5.99 | `cosmetic_solar_forge` |
| 07 | Pearl Comet | Prestige | 3,600,000 | $6.99 | `cosmetic_pearl_comet` |
| 08 | Void Pilot | Prestige | 4,200,000 | $7.99 | `cosmetic_void_pilot` |
| 09 | Cobalt Storm | Legendary | 5,000,000 | $8.99 | `cosmetic_cobalt_storm` |
| 10 | Prism Voyager | Legendary | 6,000,000 | $9.99 | `cosmetic_prism_voyager` |

The local wallet records only the small entitlement and transaction ledger
needed by this device. It is not an account, cloud save, or cross-device
ownership service. Themes may also be unlocked for 1,200,000 to 6,000,000 earned credits, depending on the theme;
that credit record remains valid if a separate store entitlement is refunded or
revoked.

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
