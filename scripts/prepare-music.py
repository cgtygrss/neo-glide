#!/usr/bin/env python3
"""Rebuild licensed soundtrack assets on macOS (Python + NumPy + SciPy).

Download the three source MP3s listed in public/audio/music/manifest.json into
an input directory, then run: python3 scripts/prepare-music.py INPUT_DIRECTORY
No Canva/Muzaic samples are used. Source hashes must match the recorded sources.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

import numpy as np
from scipy.io import wavfile
from scipy.signal import correlate

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/audio/music'


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare_loop(source, decoded, start_seconds, bpm, bars):
    subprocess.run(['afconvert', str(source), str(decoded), '-f', 'WAVE', '-d', 'LEI16'], check=True)
    rate, samples = wavfile.read(decoded)
    samples = samples.astype(np.float64) / 32768
    start = round(start_seconds * rate)
    expected = round(bars * 4 * 60 / bpm * rate)
    # Match the repeated phrase near its nominal bar boundary. These older
    # recordings vary slightly from the catalog BPM; never time-stretch them.
    radius = round(.75 * rate)
    window = round(.25 * rate)
    reference = samples[start:start + window].mean(axis=1)
    search = samples[start + expected - radius:start + expected + radius + window].mean(axis=1)
    correlation = correlate(search, reference, mode='valid', method='fft')
    energy = np.convolve(search ** 2, np.ones(window) / window, mode='valid')
    match = int(np.argmax(correlation / np.sqrt(np.maximum(energy, 1e-12))))
    end = start + expected - radius + match
    loop = samples[start:end].copy()
    # Blend into the pre-roll before the opening attack, retaining the chosen
    # musical period. Do not shorten the loop by the crossfade duration.
    blend = round(.04 * rate)
    fade = np.linspace(0, 1, blend)[:, None]
    loop[-blend:] = loop[-blend:] * (1 - fade) + samples[start - blend:start] * fade
    rms = float(np.sqrt(np.mean(loop ** 2)))
    gain = min(.065 / rms, .60 / float(np.max(np.abs(loop))))
    loop *= gain
    wavfile.write(decoded, rate, np.round(loop * 32767).astype(np.int16))
    return {'start_seconds': start / rate, 'end_seconds': end / rate,
            'duration_seconds': len(loop) / rate, 'boundary_blend_seconds': .04,
            'gain': gain, 'pcm_rms_dbfs': float(20 * np.log10(np.sqrt(np.mean(loop ** 2)))),
            'pcm_peak_dbfs': float(20 * np.log10(np.max(np.abs(loop))))}


def main():
    source_directory = Path(sys.argv[1])
    manifest_path = OUTPUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    with tempfile.TemporaryDirectory(prefix='neo-glide-music-') as temporary:
        for track, start, bpm, bars in [('menu', 5.89, 112, 16), ('flight', 2.02, 128, 16), ('boss', 4.0, 126, 8)]:
            entry = manifest['assets'][track]
            source = source_directory / entry['source_file']
            if sha256(source) != entry['source_sha256']:
                raise ValueError(f'Unexpected source file: {source}')
            decoded = Path(temporary) / f'{track}.wav'
            entry['edit'] = prepare_loop(source, decoded, start, bpm, bars)
            destination = OUTPUT / entry['file']
            destination.unlink(missing_ok=True)
            subprocess.run(['afconvert', str(decoded), str(destination), '-f', 'm4af',
                            '-d', 'aac', '-b', '160000', '-q', '127'], check=True)
            entry['sha256'] = sha256(destination)

    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
