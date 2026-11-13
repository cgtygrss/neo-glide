"""Preserve notices from the resolved native SDKs, without rewriting licenses.

Usage: python3 scripts/collect-native-notices.py /path/to/DerivedData/SourcePackages/checkouts
Run Android exportRuntimeLicenseInputs first. Re-run after native dependency updates.
"""
from pathlib import Path
import hashlib
import io
import json
import plistlib
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
rows = []


def add(component, version, source, text):
    if text.strip():
        rows.append(dict(component=component, version=version, source=source, text=text.strip()))


pods = ROOT / 'ios/App/Pods'
ack = plistlib.loads((pods / 'Target Support Files/Pods-App/Pods-App-acknowledgements.plist').read_bytes())
for item in ack['PreferenceSpecifiers']:
    title = item.get('Title')
    if title and title != 'Acknowledgements':
        add('iOS CocoaPods / ' + title, 'see Podfile.lock', 'CocoaPods acknowledgements', item.get('FooterText', ''))
for name in ['Google-Mobile-Ads-SDK', 'GoogleUserMessagingPlatform']:
    for path in (pods / name).rglob('*'):
        if path.is_file() and re.match(r'^(LICENSE|NOTICE|COPYING)(\..*)?$', path.name, re.I):
            add('iOS / ' + name, 'see Podfile.lock', str(path.relative_to(ROOT)), path.read_text(errors='replace'))

checkouts = Path(sys.argv[1])
resolved = json.loads((ROOT / 'ios/App/App.xcworkspace/xcshareddata/swiftpm/Package.resolved').read_text())
for pin in resolved['pins']:
    dirs = [p for p in checkouts.iterdir() if p.name.lower() == pin['identity'].lower()]
    if not dirs:
        raise RuntimeError('Missing SwiftPM checkout: ' + pin['identity'])
    paths = [p for p in dirs[0].iterdir() if p.is_file() and re.match(r'^(LICENSE|NOTICE|COPYING)(\..*)?$', p.name, re.I)]
    if not paths:
        raise RuntimeError('Missing SwiftPM license: ' + pin['identity'])
    for path in paths:
        add('iOS SwiftPM / ' + pin['identity'], pin['state'].get('version', pin['state']['revision']), pin['location'] + ' / ' + path.name, path.read_text(errors='replace'))

artifacts = json.loads((ROOT / 'android/build/legal-runtime-artifacts.json').read_text())
cache = Path.home() / '.gradle/caches/modules-2/files-2.1'
missing = []


def pom_licenses(path, seen=None):
    seen = set() if seen is None else seen
    if path in seen:
        return []
    seen.add(path)
    doc = ET.fromstring(path.read_bytes())
    for element in doc.iter():
        element.tag = element.tag.split('}')[-1]
    licenses = [{'name': x.findtext('name', ''), 'url': x.findtext('url', '')} for x in doc.findall('licenses/license')]
    parent = doc.find('parent')
    if not licenses and parent is not None:
        directory = cache / parent.findtext('groupId', '') / parent.findtext('artifactId', '') / parent.findtext('version', '')
        for pom in directory.rglob('*.pom'):
            licenses += pom_licenses(pom, seen)
    return licenses


for artifact in artifacts:
    group, name, version = [artifact[k] for k in ['group', 'name', 'version']]
    component = 'Android / ' + group + ':' + name
    root = cache / group / name / version
    poms = list(root.rglob('*.pom'))
    licenses = []
    for pom in poms:
        licenses += pom_licenses(pom)
    if licenses:
        add(component, version, 'Maven POM', '\n'.join(x['name'] + '\n' + x['url'] for x in licenses))
    found = False
    path = Path(artifact['file'])
    if path.suffix in ['.aar', '.jar'] and path.exists():
        archives = [zipfile.ZipFile(path)]
        if 'classes.jar' in archives[0].namelist():
            archives.append(zipfile.ZipFile(io.BytesIO(archives[0].read('classes.jar'))))
        for archive in archives:
            combined = archive.read('third_party_licenses.txt') if 'third_party_licenses.txt' in archive.namelist() else None
            indexed = combined is not None and 'third_party_licenses.json' in archive.namelist()
            if indexed:
                index = json.loads(archive.read('third_party_licenses.json'))
                indexed = all(span['start'] >= 0 and span['length'] > 0 and span['start'] + span['length'] <= len(combined) for span in index.values())
                if indexed:
                    try:
                        for span in index.values():
                            combined[span['start']:span['start'] + span['length']].decode('utf8')
                    except UnicodeDecodeError:
                        indexed = False
            if indexed:
                for title, span in index.items():
                    start, length = span['start'], span['length']
                    add(component + ' / ' + title, version, name + '-' + version + ' / third_party_licenses', combined[start:start + length].decode('utf8'))
                found = True
            for filename in archive.namelist():
                if re.search(r'(^|/)(LICENSE|NOTICE|COPYING)(\..*)?$|third_party_licenses\.txt$', filename, re.I):
                    if indexed and (filename == 'third_party_licenses.txt' or archive.read(filename) == combined):
                        continue
                    found = True
                    add(component, version, name + '-' + version + path.suffix + ' / ' + filename, archive.read(filename).decode('utf8', errors='replace'))
            archive.close()
    # POMs identify legal terms; common texts are also included verbatim below.
    if not licenses and not found and group != 'neo-glide':
        missing.append(component + ':' + version)

# The Android libraries' Apache license text is supplied by these exact resolved
# source distributions. Each AAR's own copyright/third-party notices remain above.
apache = (checkouts / 'firebase-ios-sdk/LICENSE').read_text()
add('Apache-licensed native components', '2.0', 'Apache License 2.0', apache)
output = ROOT / 'docs/legal/native-notices.json'
output.parent.mkdir(parents=True, exist_ok=True)
inputs = {str(path): hashlib.sha256((ROOT / path).read_bytes()).hexdigest() for path in [Path('ios/App/Podfile.lock'), Path('ios/App/App.xcworkspace/xcshareddata/swiftpm/Package.resolved'), Path('android/app/build.gradle'), Path('android/variables.gradle')]}
texts = {hashlib.sha256(row['text'].encode()).hexdigest(): row['text'] for row in rows}
compact = [{key: value for key, value in row.items() if key != 'text'} | {'textHash': hashlib.sha256(row['text'].encode()).hexdigest()} for row in rows]
output.write_text(json.dumps({'format': 2, 'inputs': inputs, 'entries': compact, 'texts': texts, 'manual_review': missing}, ensure_ascii=False, indent=2) + '\n')
print(f'Preserved {len(rows)} native notice entries. Manual review: {missing}')
print('Snapshot SHA-256: ' + hashlib.sha256(output.read_bytes()).hexdigest())
