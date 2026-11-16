# Android upload signing

The existing upload key is `android/signing/upload-key.jks`; its public
certificate is `android/signing/upload_certificate.pem`. Both remain local.
Back up the key and passwords securely. The expected upload certificate
fingerprint is recorded in `ci/release.json`.

The [release pipeline](../docs/CI_CD.md) signs with this existing key.
For local recovery builds, `scripts/sign-android-release.sh` prompts for the
password in Terminal and refuses to overwrite an existing signed output.

`scripts/prepare-android-upload-key.sh` creates a key only when its outputs do
not already exist. It does not submit a reset request or upload an app. Do not
replace the active key as part of an ordinary release.

If upload-key recovery is needed, check App integrity / Play app signing in
[Play Console](https://play.google.com/console/) and follow Google's
[upload-key recovery guidance](https://support.google.com/googleplay/android-developer/answer/9842756).
