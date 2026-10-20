#!/usr/bin/env bash
set -euo pipefail
umask 077

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
key_path="$repo_dir/android/signing/upload-key.jks"
certificate_path="$repo_dir/android/signing/upload_certificate.pem"
properties_path="$repo_dir/android/keystore.properties"

for path in "$key_path" "$certificate_path" "$properties_path"; do
  if [[ -e "$path" || -L "$path" ]]; then
    printf 'Refusing to overwrite existing path: %s\n' "$path" >&2
    exit 1
  fi
done

if [[ ! -t 0 ]]; then
  printf 'Run this script interactively in a terminal so keytool can prompt for passwords.\n' >&2
  exit 1
fi

if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/keytool" ]]; then
  keytool_path="$JAVA_HOME/bin/keytool"
elif command -v keytool >/dev/null 2>&1; then
  keytool_path="$(command -v keytool)"
else
  printf 'JDK keytool not found. Set JAVA_HOME to an installed JDK or add keytool to PATH.\n' >&2
  exit 1
fi
if ! "$keytool_path" -help >/dev/null 2>&1; then
  printf 'JDK keytool could not run. Set JAVA_HOME to an installed JDK or add a working keytool to PATH.\n' >&2
  exit 1
fi

printf 'This creates a NEW Android upload key. It does not request a reset or publish the app.\n'
printf 'Enter passwords locally when keytool prompts; retain a secure backup of the key and passwords.\n'
mkdir -p "$repo_dir/android/signing"
"$keytool_path" -genkeypair -v -keystore "$key_path" -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000 -storetype JKS -dname 'CN=Neo Glide Upload'
"$keytool_path" -exportcert -rfc -alias upload -keystore "$key_path" -file "$certificate_path"

printf 'Upload key: %s\nPublic certificate: %s\n' "$key_path" "$certificate_path"
printf 'Next: submit the public certificate yourself through the Google Play lost upload key reset flow.\n'
