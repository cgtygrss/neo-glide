# Runtime soundtrack — updated 23 October 2026

The published web assets use these recordings by Kevin MacLeod
(incompetech.com), all offered by the artist under **CC BY 4.0**:

| Use | Title | ISRC | Source |
| --- | --- | --- | --- |
| Menu | Happy Alley | USUAN1100482 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100482 |
| Normal flight | Beach Bum | USUAN1100347 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100347 |
| Villain encounter | The Whip | USUAN1100543 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100543 |

CC BY 4.0 permits commercial redistribution and adaptation with attribution,
a license link and an indication of modifications. All three recordings use guitar,
bass and a drum kit. The catalog tempos are 112 (menu), 128 (flight) and 126 (encounter) BPM;
the audio is not time-stretched. The recordings have been excerpted, blended
at their loop boundaries, level adjusted and encoded as AAC. Exact source
and output hashes and edit measurements are in `public/audio/music/manifest.json`.

## Attribution and evidence

- **Settings → Music credits** displays all three titles, the artist, source links,
  license link, modifications and a non-endorsement statement inside the game.
- `public/audio/music/CREDITS.txt` ships with every web/native asset package.
- `public/audio/music/CC-BY-4.0.txt` contains the complete license. The source
  recordings remain available directly from the artist without game DRM.
- `music-licenses/incompetech-catalog-extract.json` preserves the artist's
  metadata retrieved from `https://incompetech.com/music/royalty-free/pieces.json`.
- `music-licenses/incompetech-track-page-template.html` preserves the artist's
  track-page template showing the CC BY 4.0 attribution applicable to its catalog.
- Artist's game-credit guidance:
  https://incompetech.com/music/royalty-free/faq.html
- License terms: https://creativecommons.org/licenses/by/4.0/

Keep these credits and license notices when distributing builds. The game's
own license does not replace the music's CC BY 4.0 license. This records the
verified license basis; it is not a guarantee against every possible third-party
claim. No paid license or subscription was purchased.

## Encounter behavior

Menu, normal flight and villain encounters each have a distinct looping
recording. Any live enemy selects the encounter theme; the last enemy leaving
returns to flight. Reinforcements never restart the encounter theme. Gameplay
playheads are retained across these transitions, and reset when a run stops or
returns to the menu. Pause/resume selects the theme for the current enemy state.

Default music gain is **0.30** and effect gain is **0.80**. Settings exposes
independent 0–100 sliders (initially 30% and 80%) and the existing mute switches.
Numeric preferences persist locally on the device and survive track/context
changes. Legacy boolean-only preferences retain mute choices and receive the
new defaults. Muting preserves the chosen slider value.

The November 2026 fix upgrades the previous automatically saved 5% music level
once to 30%. Mute switches, zero and other custom levels are preserved. Settings
saved with the new mix version retain any chosen value, including 5%. Gesture
handlers resume suspended audio before joining an outstanding track request,
so a pending autoplay promise cannot swallow the first touch on iOS.

The iOS media loader also accepts Capacitor's local `capacitor:` responses with
status 0. Its native asset handler uses `URLResponse` for media rather than an
HTTP response; WebKit sets `ok` to false even when the complete audio file is
present. Empty files, HTTP errors and status-zero browser failures still fail.
See the native verification in `AUDIO_VALIDATION.md`.

Menu navigation reuses one playing source. Starting a flight fades menu audio
out over **100 ms**, stops it before waiting for any download, leaves **250 ms
of silence**, and fades in the different flight recording over **150 ms**.
Gameplay recordings preload in menus. A failed flight download leaves music
silent and effects usable; a later gesture can retry. Encounter transitions
retain the **0.6-second crossfade** and gameplay playheads. Pause, game over,
backgrounding and navigation cancel obsolete and not-yet-started sources.

Shot/explosion envelopes have been balanced against the recordings, including
the energy loss through the explosion's low-pass filter. See
`AUDIO_VALIDATION.md` for the browser checks and rendered audio measurements.

The former short warning is retired. There are no extra arrival stingers, music
ducking or personal-use Canva/Muzaic recordings in the shipped asset directory.
Old review assets are retained outside the public bundle at
`/private/tmp/neo-glide-personal-use-drafts-20261022/`.

## Rebuild

Download each source MP3 using the `download` URL in the manifest and save it
using its `source_file` name. Run on macOS with Python, NumPy and SciPy:

```sh
python3 scripts/prepare-music.py /path/to/source-directory
npm test
npm run build
npx cap copy
```

The script verifies the source hashes before preparing assets. AAC encoder
versions may change output bytes; rebuilding refreshes the output hashes.
The music-asset tests verify hashes and prevent the removed personal-use assets
from returning to the public bundle. Preview the actual game player at
`/dev/music.html` during development.
