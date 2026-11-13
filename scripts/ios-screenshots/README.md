# Current-release native screenshots

`Capture.swift` is an external XCTest UI harness, not a production app target.
It navigates the installed app with normal accessibility controls, without
injecting game progress, purchasing items, or granting entitlements. Install the
same release build on each simulator before running it.

Create a disposable harness folder with `CaptureHost/App.swift` (from this
folder's App.swift) and `CaptureTests/Capture.swift`, then run `ruby generate.rb
<absolute-harness-folder>` with the xcodeproj gem available. Run its NativeCapture
scheme on the chosen simulator with xcodebuild and a distinct derived-data and
result-bundle path per device. The app bundle identifier is
`com.cgtygrssgame.neonglide`.

Avoid interacting with the simulator or sending desktop keyboard shortcuts
while the test is running. Capture uses XCUIScreen.main, because app.screenshot
incorrectly cropped landscape WebKit content in this Xcode/iOS simulator.

Export attachments with `xcrun xcresulttool export attachments --path
<result.xcresult> --output-path <attachments>`. Run `export-captures.py
<attachments> <output>` using Python with Pillow. It applies the screenshot's
EXIF orientation, removes opaque alpha and metadata, and writes native-size RGB
PNGs. It does not crop, resize, add artwork, or alter product/progress data.
Inspect each output before uploading; a failed navigation is not a valid store
asset. The generated manifest records device IDs, timestamps and hashes.

Build 6 was captured on iPhone 18 Pro Max and iPad Pro 13-inch (M5). The result
bundle and detailed logs for this release are in /tmp/neo-glide-build6-capture.
