# StoreKit verification before release

`NeoGlide.storekit` is local test data only. It is outside the app target and is
not selected in the shared production scheme. Its example prices are not App
Store Connect prices; the native storefront always displays `Product.displayPrice`.

For local testing, add the configuration to Xcode without app-target membership,
duplicate the App scheme for testing, and choose this file under Run > Options >
StoreKit Configuration. The app uses its production StoreKit 2 bridge; there are
no purchase simulation switches in the native release build.

Check these scenarios in Xcode's StoreKit transaction manager:

- Each credit pack delivers exactly 100000 / 550000 / 1500000 credits. Buy the same
  consumable twice and confirm two independent deliveries.
- Cancel and pending approval grant nothing. Approving a pending transaction
  delivers once, including after app restart.
- Terminate after StoreKit approval and relaunch. Unfinished transactions must
  arrive once; already committed credits must never be added again.
- Starter grants 200000 credits once, Interceptor and Solar Blaster. Restore
  repeated purchases without repeating Starter credits.
- The historical `remove_ads` fixture exists only to test old purchases and
  restores. It must not appear for sale or be accepted by a new purchase request.
  All ads are optional, including for players who never bought anything.
- Restore an existing permanent purchase on an empty local save. Its unlocks
  return, while spent consumable credits and Starter credits are not recreated.
- Test failed/unverified purchases, revoked permanent products, unavailable
  products and storefront currency changes. Missing products cannot be bought.
- Collect coins or receive an optional ad reward while a purchase is pending;
  the final balance includes each source once.

The JS regression tests cover atomic-write failure, replay, duplicate deliveries,
acknowledgement failure and concurrent wallet writers. A successful simulator
build and these tests do **not** establish App Store Sandbox purchase success.

Before distribution, disable local StoreKit configuration and verify the four
current App Store Connect products, historical restores and rewarded ads with
a Sandbox account on a signed device build. Keep the existing bundle identifier.

Apple documentation:
[StoreKit testing setup](https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode),
[unfinished transactions](https://developer.apple.com/documentation/storekit/transaction/unfinished),
[Sandbox testing](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox).
