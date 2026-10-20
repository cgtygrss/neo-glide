# Android upload-key recovery

The existing upload key was not found. On 2026-10-20, the user created a new
upload key and public certificate locally using the interactive preparation
script, then submitted the reset request. The user reports that Google's email
says the new key becomes effective on 22 October 2026. Google Play Console
still showed the request as pending at the latest check.

The preparation command, retained for reference, was:

```sh
JAVA_HOME=/tmp/neoglide-jdk21/jdk-21.0.12.1+1/Contents/Home bash scripts/prepare-android-upload-key.sh
```

The key is `android/signing/upload-key.jks` and its public certificate is
`android/signing/upload_certificate.pem`. Securely back up the JKS and its
passwords. The script does not create `android/keystore.properties`, submit a
reset request, or publish anything, and stops if any of its output paths exists.

The request can be checked in [Google Play Console](https://play.google.com/console/),
under App integrity / Play app signing. See Google's [Play App Signing and
upload-key recovery guidance](https://support.google.com/googleplay/android-developer/answer/9842756).
Do not upload with the new key before its effective date and confirmation in
the Console.

The user ran the signing helper interactively. The executed command is retained
for reference; it refuses to overwrite the existing signed output:

```sh
JAVA_HOME=/tmp/neoglide-jdk21/jdk-21.0.12.1+1/Contents/Home bash scripts/sign-android-release.sh
```

The signed AAB is [NeoGlide-1.2.0-version4-payments.aab](1.2.0/NeoGlide-1.2.0-version4-payments.aab)
(18,617,165 bytes), with SHA-256
`33489989091ef0f7b9aa01d9fc130a442312e951259d8fb362e9958a4f5921ca`.
`jarsigner -verify` reported `jar verified`, and its certificate SHA-256 matched
the public PEM: `E3:4E:FD:9B:65:DB:31:F9:CE:EA:CC:5A:7C:7B:EC:FA:72:A4:B3:1F:3B:EC:04:38:F7:6D:4E:67:E3:F1:82:30`.
The unsigned AAB remains available. The helper does not submit the reset or
upload the bundle.
