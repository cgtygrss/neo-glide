# Native App Store screenshot capture

Captured on 2026-10-16 from the actual Neo Glide iOS application, bundle identifier `com.cgtygrssgame.neonglide`.

## Delivery files

Each device folder contains five full-resolution, landscape, opaque RGB PNGs:

1. `01-home.png` — the centered Standard Glider hangar.
2. `02-ships-plasma-breaker.png` — the real Garage with a locked Plasma Breaker selected and the fleet visible.
3. `03-weapons-tesla-arc.png` — the actual Tesla Arc weapon preview and stats.
4. `04-upgrades.png` — the Battery Capacity upgrade comparison.
5. `05-flight.png` — a live flight reached through Play and actual BOOST input, with coins/pickups visible.

| Folder | Device | Native pixel dimensions |
| --- | --- | --- |
| `iphone-6.9/` | iPhone 18 Pro Max | 2868×1320 |
| `ipad-13/` | iPad Pro 13-inch (M5) | 2752×2064 |

`review/contact-sheet.jpg` is a reduced review montage only. It is not an App Store upload image. File hashes, raw capture sources and decoded RGB hashes are recorded in `capture-manifest.json`.

## Method and verification

A separate temporary Xcode UI test project was generated under `/tmp/neo-glide-native-capture`; the production Xcode project was not changed by capture automation. XCTest launched the installed app by bundle identifier, tapped its accessibility-labelled controls, scrolled the Garage, selected locked previews and held BOOST. It did not inject game scenes, change application code, seed a fixture, unlock items or reset application data.

The UI test runner and host-side capture helper used a request/acknowledgement file in the runner's own temporary data container to synchronize each screenshot with the actual visible screen. Images came from `xcrun simctl io <device> screenshot`, not a browser rendering or reconstructed scene. The original raw RGBA PNGs remain under `/tmp/neo-glide-native-capture/raw/`.

For App Store delivery, the redundant alpha channel was removed only after verifying every alpha value was 255. Each output retains the native dimensions, and its decoded RGB bytes were checked for exact equality with its raw simulator capture. No cropping, resizing, painting, overlays or scene composition was applied to the device-folder PNGs.

Final capture routes passed on both simulators with one passed test and zero failures per device. Evidence is in:

- `/tmp/neo-glide-native-capture/results/iphone-6.9-v4.xcresult`
- `/tmp/neo-glide-native-capture/results/ipad-13-v4.xcresult`
- `/tmp/neo-glide-native-capture/results/ipad-13-v5.xcresult` — selected Tesla Arc accessibility region asserted before its replacement screenshot.

The temporary harness sources are `generate.rb`, `CaptureTests/NativeCapture.swift` and `run-capture-sync.py` under that same temporary directory. Earlier diagnostic runs were used to resolve WebKit accessibility element types and timing; they are not the delivered set.

## Installed snapshot and release candidate

The supplied, installed pre-release Debug snapshot identifies itself as `1.0.1 (2)` and includes the current non-Store UI used in these images. The release candidate is `1.2.0 (3)`. Premium Store screens were deliberately excluded while the final StoreKit build was being prepared. The screenshot package demonstrates the real captured features; it does not assert that the candidate binary has been uploaded or approved.

No purchase or rewarded ad was triggered during capture. Normal flight input can update progression in these isolated simulator installations; no existing application data was reset.
