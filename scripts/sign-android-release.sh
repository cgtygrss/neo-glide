#!/usr/bin/env bash
set -euo pipefail
umask 077

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
key_path="$repo_dir/android/signing/upload-key.jks"
unsigned_path="${1:-$repo_dir/android/app/build/outputs/bundle/release/app-release.aab}"
if [[ $# -ge 2 ]]; then
    signed_path="$2"
elif [[ "$unsigned_path" == *-unsigned.aab ]]; then
    signed_path="${unsigned_path%-unsigned.aab}.aab"
else
    signed_path="$repo_dir/release/1.3.0/NeoGlide-1.3.0-version5.aab"
fi

if [[ ! -t 0 ]]; then
  printf 'Run this script interactively in a terminal so jarsigner can prompt for passwords.\n' >&2
  exit 1
fi
if [[ ! -f "$key_path" || ! -f "$unsigned_path" ]]; then
  printf 'The upload keystore and unsigned AAB must both exist.\n' >&2
  exit 1
fi
if [[ -e "$signed_path" || -L "$signed_path" ]]; then
  printf 'Refusing to overwrite existing path: %s\n' "$signed_path" >&2
  exit 1
fi

if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/jarsigner" ]]; then
  jarsigner_path="$JAVA_HOME/bin/jarsigner"
elif [[ -x /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/jarsigner ]]; then
  jarsigner_path=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/jarsigner
elif command -v jarsigner >/dev/null 2>&1; then
  jarsigner_path="$(command -v jarsigner)"
else
  printf 'JDK jarsigner not found. Set JAVA_HOME to an installed JDK or add jarsigner to PATH.\n' >&2
  exit 1
fi
if ! "$jarsigner_path" -help >/dev/null 2>&1; then
  printf 'JDK jarsigner could not run. Set JAVA_HOME to an installed JDK or add a working jarsigner to PATH.\n' >&2
  exit 1
fi

printf 'Enter the keystore password and the separate key password locally when prompted.\n'
"$jarsigner_path" -keystore "$key_path" -sigalg SHA256withRSA -digestalg SHA-256 \
  -signedjar "$signed_path" "$unsigned_path" upload
"$jarsigner_path" -verify "$signed_path"
printf 'Signed AAB: %s\n' "$signed_path"
printf 'Compare the upload certificate with Play Console before uploading this bundle.\n'
