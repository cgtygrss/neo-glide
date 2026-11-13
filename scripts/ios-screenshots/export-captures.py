"""Normalize XCTest full-screen captures without resizing or adding artwork.
Usage: python export-captures.py <exported-attachments-dir> <output-dir>
Requires Pillow. Export attachments with xcrun xcresulttool export attachments.
"""
import hashlib
import json
import re
import sys
from pathlib import Path
from PIL import Image, ImageOps

source, destination = map(Path, sys.argv[1:3])
destination.mkdir(parents=True, exist_ok=True)
records = []
for test in json.loads((source / 'manifest.json').read_text()):
    for attachment in test['attachments']:
        name = attachment['suggestedHumanReadableName']
        if not name.startswith('app-capture-'):
            continue
        name = re.sub(r'_0_.*$', '', name.removeprefix('app-capture-'))
        raw = source / attachment['exportedFileName']
        with Image.open(raw) as image:
            # XCTest full-screen pixels use the physical device orientation.
            # Apply its orientation metadata, then drop metadata and opaque alpha.
            image = ImageOps.exif_transpose(image)
            if 'A' in image.getbands():
                assert image.getchannel('A').getextrema() == (255, 255)
            image = image.convert('RGB')
            output = destination / f'{name}.png'
            image.save(output, exif=b'')
            records.append(dict(name=name, file=output.name, width=image.width,
                                height=image.height, device=attachment['deviceName'],
                                deviceId=attachment['deviceId'], timestamp=attachment['timestamp'],
                                rawSha256=hashlib.sha256(raw.read_bytes()).hexdigest(),
                                sha256=hashlib.sha256(output.read_bytes()).hexdigest()))
(destination / 'capture-manifest.json').write_text(json.dumps(records, indent=2)+'\n')
print(f'Exported {len(records)} full-screen captures to {destination}')
