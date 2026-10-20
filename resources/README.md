# Neo Glide release artwork

The approved identity uses the cream-and-teal Standard Glider, amber exhaust and a midnight navy (`#0b1725`) background. Exporting assets does not change game artwork, controls or the economy.

## Sources and delivery masters

| File | Purpose |
| --- | --- |
| `branding/1.2.0/icon-source.png` | Unmodified, opaque 1254×1254 ImageGen output |
| `branding/1.2.0/splash-source.png` | Unmodified, opaque 1254×1254 ImageGen output |
| `icon.png` | Opaque sRGB PNG icon master, 1024×1024; no pre-rounded corners |
| `splash.png` | Opaque sRGB PNG splash master, 2732×2732 |
| `branding/1.2.0/imagegen-prompts.txt` | Exact prompts used for both images |
| `branding/1.2.0/provenance.json` | Source locations, SHA-256 hashes and permitted export operations |
| `branding/1.2.0/asset-validation.json` | Dimensions, alpha checks, hashes and crop review results |
| `branding/legacy/` | Previous masters, retained for recovery |

The asset directory was first prepared as `1.0.2`, then renamed to `1.2.0` after App Store Connect confirmed that `1.1.1` was already published. Source artwork did not change. Legacy filenames ending in `before-1.0.2` identify that original backup point; they are not a claim about the published release.

## Reproduce native and web assets

Use the repository's installed development dependencies, including `@capacitor/assets` 3.0.5 and its `sharp` dependency. No global installation or image-generation credentials are needed to reproduce delivery files.

From the repository root:

```sh
node resources/branding/1.2.0/export-assets.cjs
```

The script resizes the preserved sources, normalizes opaque sRGB PNG masters, prepares `branding/1.2.0/native-input/`, and runs Capacitor Assets in **custom mode** for iOS and Android. This preserves the authored splash instead of generating one from the icon. Light and dark splash variants use the same image. The adaptive-icon background is solid navy; foreground and legacy icons use the unchanged icon illustration. Platform launcher masks are delivery formatting.

Outputs include:

- iOS `AppIcon.appiconset` and six light/dark `Splash.imageset` PNGs.
- Android launcher, round/adaptive icon layers and portrait/landscape light/dark splash densities.
- Web `public/favicon.png` (64×64), `public/apple-touch-icon.png` (180×180), and PNG icons at 192×192 and 512×512, referenced by `public/manifest.webmanifest`.
- Aspect-fill crop checks under `branding/1.2.0/qa/`.

If `sharp` reports a missing native binary, enable/re-run its native installation script with the active package manager before rerunning the exporter. The local missing-binary issue was repaired without changing dependency versions.

After building the intended web configuration, copy/sync the web bundle into the native project using the repository's normal Capacitor workflow. Asset generation itself does not build or upload the application.

## Launch framing and validation

`LaunchScreen.storyboard` keeps `scaleAspectFill`. Navy launch, Capacitor iOS/SplashScreen settings, Android launch background and initial web-page background use `#0b1725`.

The generated iPhone landscape (2868×1320) and iPad landscape (2752×2064) crops were visually reviewed: the spacecraft body, fins and complete “NEO GLIDE” title remain visible. A 1320×2868 portrait diagnostic also retains the title and ship; the outer exhaust glow approaches the left edge. iOS gameplay remains landscape.

Validation checked unchanged source hashes, opaque 1024/2732 masters, all seven referenced iOS images, 50 Android PNG exports, four web icons and manifest references. The iOS launch storyboard compiled with no errors, warnings or notices. These checks cover the artwork package, not application signing, store submission or purchase behavior.

## App Store screenshots

Capture the actual running game in landscape, using:

| Device group | Landscape dimensions |
| --- | --- |
| Large iPhone / 6.9-inch delivery target | **2868×1320** |
| 13-inch iPad | **2752×2064** |

Use opaque PNG or JPEG images. The files in `branding/1.2.0/qa/` are splash crop diagnostics, **not App Store gameplay screenshots**. Capture the hangar, a readable live flight and the Garage/results from the real app.

Dimensions were checked against [Apple's screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications) on 2026-10-16. Confirm the selected screenshot slots in App Store Connect when preparing the submission.

## Candidate versus published version

The confirmed local iOS candidate is **1.2.0 / build 3**. App Store Connect was checked on 2026-10-16: the latest existing TestFlight version/build is **1.1.1 / 1**, so the candidate version and build are suitable for the next upload. This confirmation does not mean the candidate has been uploaded or approved. Package metadata, the app's current-version constant and both Xcode marketing-version configurations use `1.2.0`. The existing iOS identity remains `com.cgtygrssgame.neonglide`; Android identity remains `com.cgtygrss.neoglide`, with its native release version unchanged by this iOS preparation.

App Store Connect identified the published version as **1.1.1**, app ID **6755588297**. Therefore `public/version.json` describes `1.1.1`, links to [the real App Store listing](https://apps.apple.com/app/id6755588297), and keeps `forceUpdate: false`. Do not advertise a pending candidate as a published remote update. Verify the final upload/build number and release status before changing published-version metadata or enabling forced updates.
