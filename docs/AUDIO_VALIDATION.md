# Audio validation — 23 October 2026

## iOS playback correction — 5 November 2026

The real simulator app reproduced a native-only loader failure: a fetch of
`/audio/music/beach-bum.m4a` returned `status: 0`, `ok: false` and **611,266
bytes**. The actual application's AudioContext was running, music was enabled
at 52%, and its menu failed with `Music recording unavailable: menu`.
Capacitor's iOS media handler delivers `URLResponse`, which has no HTTP status;
the old `response.ok` check rejected valid bundled media before decoding.

The corrected loader accepts status-zero responses only under the local
`capacitor:` protocol and rejects empty buffers. Browser status-zero and HTTP
error responses remain failures. No native dependency or media asset was
changed, and the user's saved sound levels are preserved.

An instrumented simulator build exercised the actual app's SoundManager and
recordings. All three decoded, looped and produced nonzero music-bus RMS:

| Theme | Decoded seconds | Sampled RMS | Error |
| --- | ---: | ---: | --- |
| Menu | 34.37425 | 0.03060 | none |
| Flight | 29.76744 | 0.01880 | none |
| Encounter | 15.73727 | 0.05269 | none |

The AudioContext remained running. Temporary native instrumentation was
removed before the final build. Probe logs: `/tmp/neo-glide-audio-probe-run.log`
and `/tmp/neo-glide-audio-fixed-probe-run.log`. These checks establish native
loading and signal output; they do not claim listening on physical hardware.

All 241 tests and ESLint passed. Credits now use a compact artist/license header,
three labeled track links and one edit notice. Browser checks at 844×390 and
375×667 confirmed no horizontal overflow and retained all source/license links.

The sections below record the earlier browser-only checks and original mix.

## Actual application checks

Checked the real `App` at `http://127.0.0.1:5174/`, using isolated browser
storage and the application's own SoundManager, UI controls and game loop.

- Garage, Pilot, Account and Events navigation reused the same menu source,
  with one active recording. Opening Settings and changing volume did not
  restart it.
- Play stopped the menu source after **0.100 seconds**, scheduled the different
  flight source **0.250 seconds after that stop**, and used a **0.150-second**
  fade-in. These values were observed from actual source scheduling.
- A controlled encounter fixture advanced the real enemy spawn timer; the
  game loop selected `boss`. Marking the enemy defeated returned to `flight`
  with a nonzero saved offset and one active recording after the crossfade.
- Actual pickups and incoming damage triggered collection and explosion
  effects; the Fire button triggered the weapon effect during flight.
- Pause left `desiredTrack = null` and zero active recordings. A controlled
  `visibilitychange` to hidden also paused the real application and stopped
  all recordings. Hardware/native background transitions were not exercised.
- Keyboard Tab/Shift+Tab reached both sliders; arrow keys updated the live
  gains and local storage. Pointer input on a slider also updated its value.
  Both native range controls have a 44-pixel-high interaction area.
- Music mute preserved the chosen level and unmute restored it. A custom 6%
  music setting survived page reload with effects still at 80%.
- All three music titles, source links and license credits remain in Settings.

Encounter timing and physics were controlled only inside the isolated QA
browser. No test hooks or debug globals were added to the shipped application.

## Rendered signal measurements

Used browser `OfflineAudioContext` at 44.1 kHz with the actual mixer,
compressor, recording buffers and SoundManager effect methods. Music gain was
**0.05**, effects gain **0.80**. Compared each effect's first 350 ms against
the recording's loudest non-overlapping stereo 350-ms window, after rendering
through the mixer. Values are RMS level differences, rounded to 0.1 dB.

| Backing | Collect above music | Shot above music | Explosion above music |
| --- | ---: | ---: | ---: |
| Menu / Happy Alley | 11.1 dB | 6.9 dB | 5.7 dB |
| Flight / Beach Bum | 11.4 dB | 7.3 dB | 6.0 dB |
| Villain / The Whip | 12.0 dB | 7.9 dB | 6.6 dB |

Explosion measurements vary slightly because the source is random noise.
The shot envelope peak is 0.22 and the filtered explosion envelope peak is
0.60; these compensate for short duration and filtering without increasing
music. These signal checks establish the relative levels; listening on the
target phone/headphones remains a separate hardware check.

## Automated coverage

Sound tests cover old boolean preference migration, malformed/zero/bounded
volume values, persistence, context recreation, independent muting, menu
preloading without playback, exact entry timing, failed/slow downloads,
gesture retry, rapid exit/retry, cancellation before a scheduled source
starts, encounter transitions and stopping outgoing crossfades.

After the full test suite and Vite production build, copy the web bundle with
`npx cap copy` and verify the three recording hashes and music license notices
in both native web-asset directories. This updates project assets, not an
already installed native application or an app-store release.
