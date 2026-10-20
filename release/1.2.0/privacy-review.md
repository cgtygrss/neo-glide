# Privacy review draft — 1.2.0 (3)

Reviewed 2026-10-16. This is an evidence worksheet for the developer's App Store
Connect answers, not a published privacy policy or a completed submission.
No App Store Connect values were changed.

The archive snapshot below predates the subsequent consent-order source fix.
Regenerate and inspect the archive before treating that fix as shipped.

## Verified archive and code

- Archive: `/Users/cagataygurses/Library/Developer/Xcode/Archives/2026-10-16/NeoGlide-1.2.0-3.xcarchive`.
- App identity inside the archive: `com.cgtygrssgame.neonglide`, version `1.2.0`, build `3`.
- Four privacy manifests are present: `GoogleMobileAdsResources.bundle`,
  `UserMessagingPlatformResources.bundle`, `Frameworks/Capacitor.framework`, and
  `Frameworks/Cordova.framework`. There is no app-root `PrivacyInfo.xcprivacy`.
- Dependency lock: Google Mobile Ads 12.12.0, UMP 3.0.0, Capacitor/Cordova 7.6.8,
  Capacitor AdMob plugin 7.2.0. No additional mediation SDK appears in that lock.
- First-party `AppDelegate.swift`/`SceneDelegate.swift`, including the new StoreKit
  bridge, contain no direct `UserDefaults`, file-timestamp, disk-space, system-boot
  time or active-keyboard API use. The AdMob plugin's native source also contains
  no direct `UserDefaults` call. No speculative app API declaration was added.
- Wallet, transaction-ID ledger, purchases, progression, audio settings and the
  app's monetization event log use on-device WebView `localStorage`; no uploader
  for these records was found. The app also requests a public GitHub version JSON.
  StoreKit verifies/finishes transactions locally; no receipt or transaction
  upload to a developer backend was found.

## Packaged SDK declarations

The following rows reproduce the **archive's manifests**, not measured network
traffic. TPA = Third-Party Advertising; DA = Developer Advertising; AN = Analytics;
AF = App Functionality.

| Data type | GMA linked | GMA tracking | GMA purposes | UMP declaration |
| --- | --- | --- | --- | --- |
| Coarse Location | Yes | No | TPA, DA, AN | Unlinked, no tracking, AF |
| Device ID | Yes | **Yes** | TPA, DA, AN | None |
| Advertising Data | Yes | No | TPA, DA, AN | None |
| Product Interaction | Yes | No | TPA, DA, AN | Unlinked, no tracking, AF |
| Crash Data | No | No | AN | None |
| Performance Data | No | No | TPA, DA, AN | Unlinked, no tracking, AF |
| Other Diagnostic Data | No | No | TPA, DA, AN | None |

Capacitor/Cordova declare no collected data or accessed API categories in their
packaged manifests. GMA declares System Boot Time `35F9.1`, User Defaults `CA92.1`
and Disk Space `E174.1`; UMP declares User Defaults `CA92.1`. These are SDK entries,
not evidence of direct first-party API use. Neither Google manifest contains a
top-level tracking-domain list; that omission does not cancel its Device ID
tracking declaration.

Google's [iOS disclosure guide](https://developers.google.com/admob/ios/privacy/data-disclosure)
describes possible collection of IP-derived location, diagnostics, performance,
identifiers, advertising activity and interactions. The actual packaged
manifest above is the version-specific evidence used here.

## Disclosure implications

Apple's [App Privacy guidance](https://developer.apple.com/app-store/app-privacy-details/)
includes third-party SDK practices. On-device-only data is not collection for the
label; Apple's own payment processing does not automatically mean the developer
collects payment details. Conditional collection must still be considered across
users. Optional rewarded ads do not by themselves exempt advertising data from
disclosure. An existing “Data Not Collected” answer cannot be carried forward
without reconciling the seven SDK categories above.

An app manifest need not duplicate a linked SDK's collected-data declarations:
[Apple data-use manifest guidance](https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests).
Direct app use of a covered API requires its own accurate reason:
[Apple required-reason API guidance](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api).
This scoped source review found no basis for adding an app-level reason merely
because Google uses User Defaults. Recheck if native code changes.

## Pending developer confirmation / release checks

1. Review the current ASC privacy answers and public policy against these SDK
   categories, purposes, linkage and tracking flags. Confirm actual AdMob account
   settings, any server-configured mediation/additional reporting, and the version
   endpoint's provider/retention practices. Do not assert extra data categories
   without evidence.
2. Confirm intended audience and age settings. Current AdMob initialization uses
   Teen content rating and `false` child-directed/under-age flags; these are code
   settings, not proof of the audience or regulatory classification.
3. Verify ATT allowed/denied and regional UMP choices on a signed device, including
   the Settings privacy-options entry when UMP requires it. The code gates explicit
   ad preparation on `canRequestAds`.
4. **Consent-order source fix:** the reviewed archive originally invoked
   `AdMob.initialize()` before ATT/UMP; the upstream plugin calls
   `MobileAds.shared.start()`. Google warns that initialization can preload
   ads: [iOS initialization guidance](https://developers.google.com/admob/ios/quick-start).
   Source now refreshes/presents UMP first, awaits ATT when applicable, then starts
   Mobile Ads only when `canRequestAds` is true. A UMP-only `NeoGlidePrivacy`
   native bridge presents forms without starting the ads SDK. Unit checks cover
   false consent, cancelled forms, later grants, privacy-options revocation and
   retryable SDK startup. Rebuild/rearchive and verify on a signed device. No
   pre-consent packet capture or live-account confirmation was done.
   [UMP setup guidance](https://developers.google.com/admob/ios/privacy) describes
   consent refresh and privacy options.
5. Generate/review Xcode's aggregate privacy report and the signed archive's
   validation messages. Manifest presence and plist syntax alone are not Apple
   submission approval. This archive is unsigned.
6. StoreKit source/unit/contract checks passed separately; actual ASC Sandbox
   purchase, pending approval and restore remain required before distribution.

The follow-up fix changes `AdMobService.js`, the local privacy bridge in
`AppDelegate.swift`, and its regression tests. It does not change SDK manifests
or App Store Connect. No app-level manifest or SDK dependency was added.
