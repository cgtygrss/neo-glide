#!/usr/bin/env bash
# Run by the owner in Terminal. Passwords never enter chat, arguments or source files.
set -euo pipefail
umask 077
cd "$(dirname "$0")/../.."
repo=cgtygrss/neo-glide
if [ -z "${JAVA_HOME:-}" ] && [ -x /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/keytool ]; then
  export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
  export PATH="$JAVA_HOME/bin:$PATH"
fi
gh auth status >/dev/null
temporary="$(mktemp -d)"
trap 'rm -rf "$temporary"; unset NEO_UPLOAD_STORE_PASS NEO_UPLOAD_KEY_PASS NEO_EXPORT_PASS' EXIT
if [ ! -t 0 ]; then echo 'Run this script interactively in your own Terminal.' >&2; exit 1; fi
printf 'Existing Android upload keystore password: '
IFS= read -rs NEO_UPLOAD_STORE_PASS
printf '\nKey password (Enter = same password): '
IFS= read -rs NEO_UPLOAD_KEY_PASS
printf '\n'
NEO_UPLOAD_KEY_PASS="${NEO_UPLOAD_KEY_PASS:-$NEO_UPLOAD_STORE_PASS}"
export NEO_UPLOAD_STORE_PASS NEO_UPLOAD_KEY_PASS
keytool -list -alias upload -keystore android/signing/upload-key.jks -storepass:env NEO_UPLOAD_STORE_PASS >/dev/null
printf '%s' "$NEO_UPLOAD_STORE_PASS" | gh secret set ANDROID_KEYSTORE_PASSWORD --env store-release --repo "$repo"
printf '%s' "$NEO_UPLOAD_KEY_PASS" | gh secret set ANDROID_KEY_PASSWORD --env store-release --repo "$repo"
unset NEO_UPLOAD_STORE_PASS NEO_UPLOAD_KEY_PASS
NEO_EXPORT_PASS="$(openssl rand -hex 32)"
printf '\nExporting only Apple Distribution / team 5NA3743WWP. macOS may ask for Keychain access.\n'
swiftc scripts/ci/export-signing-identity.swift -o "$temporary/export-identity"
printf '%s\n' "$NEO_EXPORT_PASS" | "$temporary/export-identity" "$temporary/distribution.p12"
python3 -c 'import base64,sys,pathlib;sys.stdout.buffer.write(base64.b64encode(pathlib.Path(sys.argv[1]).read_bytes()))' "$temporary/distribution.p12" | gh secret set IOS_CERTIFICATE_BASE64 --env store-release --repo "$repo"
printf '%s' "$NEO_EXPORT_PASS" | gh secret set IOS_CERTIFICATE_PASSWORD --env store-release --repo "$repo"
unset NEO_EXPORT_PASS
printf '\nSigning secrets saved to GitHub store-release. Temporary signing material will now be removed.\n'
