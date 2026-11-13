#!/usr/bin/env bash
set -euo pipefail
umask 077
signing_dir="$RUNNER_TEMP/neo-glide-signing"
mkdir -p "$signing_dir" "$HOME/Library/MobileDevice/Provisioning Profiles"
python3 - <<'PY'
import os,base64,pathlib
root=pathlib.Path(os.environ['RUNNER_TEMP'])/'neo-glide-signing'
for variable,name in [('IOS_CERTIFICATE_BASE64','distribution.p12'),('IOS_PROFILE_BASE64','app.mobileprovision')]:
 (root/name).write_bytes(base64.b64decode(os.environ[variable],validate=True))
PY
keychain="$signing_dir/build.keychain-db"
keychain_password="$(openssl rand -hex 32)"
security create-keychain -p "$keychain_password" "$keychain"
security set-keychain-settings -lut 21600 "$keychain"
security unlock-keychain -p "$keychain_password" "$keychain"
security import "$signing_dir/distribution.p12" -P "$IOS_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k "$keychain" >/dev/null
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$keychain_password" "$keychain" >/dev/null
security list-keychains -d user -s "$keychain" login.keychain-db
security cms -D -i "$signing_dir/app.mobileprovision" > "$signing_dir/profile.plist"
python3 - <<'PY'
import plistlib,pathlib,os,json,datetime,shutil
root=pathlib.Path(os.environ['RUNNER_TEMP'])/'neo-glide-signing'
p=plistlib.loads((root/'profile.plist').read_bytes());c=json.loads(pathlib.Path('ci/release.json').read_text())
assert p['Entitlements']['application-identifier']==c['appleTeamId']+'.'+c['appleBundle'], 'Wrong provisioning profile'
assert not p['Entitlements'].get('get-task-allow',False), 'Development profile cannot sign an App Store release'
assert 'ProvisionedDevices' not in p and not p.get('ProvisionsAllDevices'), 'Use an App Store profile'
assert p['ExpirationDate']>datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None), 'Expired provisioning profile'
shutil.copy(root/'app.mobileprovision',pathlib.Path.home()/'Library/MobileDevice/Provisioning Profiles'/f"{p['UUID']}.mobileprovision")
options={'method':'app-store-connect','teamID':c['appleTeamId'],'signingStyle':'manual','uploadSymbols':True,'provisioningProfiles':{c['appleBundle']:p['Name']}}
(root/'ExportOptions.plist').write_bytes(plistlib.dumps(options))
with open(os.environ['GITHUB_ENV'],'a') as f:f.write('IOS_PROFILE_NAME='+p['Name']+'\n')
PY
