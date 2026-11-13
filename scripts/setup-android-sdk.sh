#!/usr/bin/env bash
set -euo pipefail

# Run only after the developer has reviewed and accepted Google's SDK agreement:
# https://developer.android.com/studio/terms (28 April 2026).
# sdkmanager presents any package license for an explicit interactive decision;
# this script never pipes `yes` or accepts unrelated/preview licenses.
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
sdk_dir="${NEO_GLIDE_ANDROID_SDK:-$HOME/Library/Android/sdk}"
sdk_archive="${TMPDIR:-/tmp}/neo-glide-commandlinetools-mac-arm64-15859902.zip"
if [[ "$(uname -sm)" != 'Darwin arm64' ]]; then
  printf 'This reviewed installer is for Apple Silicon macOS only.\n' >&2
  exit 1
fi
if [[ ! -x "$sdk_dir/cmdline-tools/latest/bin/sdkmanager" ]]; then
  curl --fail --location --retry 2 --output "$sdk_archive" \
    https://dl.google.com/android/repository/commandlinetools-mac_arm64-15859902_latest.zip
  printf '%s  %s\n' '835b62a26162b229b441d1f6d4680383815a270809eb33522c0d480fa5002c4e' "$sdk_archive" | shasum -a 256 --check
  extract_dir="$(mktemp -d "${TMPDIR:-/tmp}/neo-glide-sdk.XXXXXX")"
  unzip -q "$sdk_archive" -d "$extract_dir"
  mkdir -p "$sdk_dir/cmdline-tools"
  if [[ -e "$sdk_dir/cmdline-tools/latest" ]]; then
    printf 'Existing command-line tools directory needs inspection; refusing to replace it.\n' >&2
    exit 1
  fi
  mv "$extract_dir/cmdline-tools" "$sdk_dir/cmdline-tools/latest"
fi
if [[ -z "${JAVA_HOME:-}" && -x /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/java ]]; then
  export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
fi
"$sdk_dir/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$sdk_dir" \
  'platform-tools' 'platforms;android-36' 'build-tools;35.0.0'
printf 'sdk.dir=%s\n' "$sdk_dir" > "$repo_dir/android/local.properties"
printf 'SDK configured for Neo Glide: %s\n' "$sdk_dir"
