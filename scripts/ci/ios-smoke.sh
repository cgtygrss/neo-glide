#!/usr/bin/env bash
set -euo pipefail
root="$(pwd)"
mkdir -p ci-output
runtime="$(python3 - <<'PY'
import json,subprocess,os
devices=json.loads(subprocess.check_output(['xcrun','simctl','list','devices','available','-j']))['devices']
wanted=os.environ.get('IOS_SIMULATOR_RUNTIME','iOS-27-2')
matches=[runtime for runtime in devices if wanted in runtime]
if not matches: raise SystemExit('Required iOS simulator runtime is unavailable: '+wanted)
print(matches[0])
PY
)"
device_id="$(xcrun simctl create 'Neo Glide CI' com.apple.CoreSimulator.SimDeviceType.iPhone-18-Pro "$runtime")"
trap 'xcrun simctl shutdown "$device_id" >/dev/null 2>&1 || true; xcrun simctl delete "$device_id" >/dev/null 2>&1 || true' EXIT
xcrun simctl boot "$device_id"
xcrun simctl bootstatus "$device_id" -b
xcrun simctl install "$device_id" ci-output/simulator/Build/Products/Release-iphonesimulator/App.app
harness="$root/ci-output/smoke-harness"
mkdir -p "$harness/CaptureHost" "$harness/CaptureTests"
cp scripts/ios-screenshots/App.swift "$harness/CaptureHost/App.swift"
python3 - <<'PY'
import pathlib,json
source=pathlib.Path('scripts/ios-screenshots/ReleaseSmoke130.swift').read_text()
source=source.replace('v1.3.0', 'v'+json.loads(pathlib.Path('package.json').read_text())['version'])
source=source.replace('app.launch()','''app.launch()
  let family = app.buttons.matching(NSPredicate(format: "label == %@", "Under 13")).firstMatch
  XCTAssertTrue(family.waitForExistence(timeout: 40), app.debugDescription)
  family.tap()''')
pathlib.Path('ci-output/smoke-harness/CaptureTests/Capture.swift').write_text(source)
PY
bundle exec ruby scripts/ios-screenshots/generate.rb "$harness"
xcodebuild -project "$harness/NativeCapture.xcodeproj" -scheme NativeCapture \
  -destination "platform=iOS Simulator,id=$device_id" -derivedDataPath ci-output/harness-build \
  -resultBundlePath "ci-output/smoke-$(date +%Y%m%d%H%M%S).xcresult" test CODE_SIGNING_ALLOWED=NO
