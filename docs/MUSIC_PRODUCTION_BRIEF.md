# Neo Glide — guitar, bass and drums

> Historical production notes. The Canva/Muzaic drafts described below have
> been replaced and are excluded from the runtime bundle. Current recordings,
> commercial-use license evidence and attribution are documented in
> [MUSIC_LICENSING.md](MUSIC_LICENSING.md).

Direction: a small, natural-sounding instrumental band. Simple, cheerful and
rhythmic during ordinary play; a distinct sense of danger when an enemy enters.
Use guitar melodies, bass guitar and an acoustic drum kit. Do not use synths,
electronic melodies, chiptune, electronic drums, vocals or dense ornamentation.

Both gameplay arrangements use **128 BPM, 4/4**. The enemy changes the harmony,
guitar articulation and register, while retaining the tempo. Prepare a roughly
60-second loop for each arrangement, with a clean loop boundary and space for
the game's effects. These are generation briefs, not completed audio assets.

## Normal flight — generation prompt

Create a cheerful, energetic but simple instrumental indie-pop / light funk-rock
game soundtrack at exactly 128 BPM in D major, 4/4. A small band: warm acoustic
rhythm guitar, a clean electric guitar playing one memorable short melody,
finger-played bass guitar, and an acoustic drum kit. Natural guitar pick attacks,
subtle fret noise, human drum dynamics, a dry intimate band mix. Keep the melody
to short two- or three-note phrases with generous rests. Steady kick and snare,
restrained closed hi-hat, a clear bass groove and very few drum fills. Sunny,
playful, confident and adventurous. About 60 seconds with a seamless loop.
Instrumental only. No synthesizers, electronic melodies, arpeggiators, pads,
chiptune, drum machines, EDM, claps, vocals, long solos or layered lead parts.

## Enemy encounter — generation prompt

Create a companion instrumental game soundtrack with the same small guitar,
bass and acoustic drum band at exactly 128 BPM, 4/4. Do not speed up or switch
to double-time. Change the mood to immediate danger using D minor harmony,
occasional E-flat tension, lower palm-muted guitar notes, a restrained low guitar
warning motif and a darker bass pulse. Use a clean-to-lightly-overdriven real
guitar sound, not a synth lead. Keep the acoustic drums sparse, steady and firm.
The threat should sound alert and suspenseful rather than sad or mournful.
About 60 seconds, seamlessly loopable, with room for game sound effects.
Instrumental only. No electronic instruments, synths, pads, electronic drums,
EDM, chiptune, vocals, faster tempo, frantic fills, shredding or dense layering.

## Delivery checks

- Listen for guitar and acoustic drum timbres rather than oscillator-like leads.
- Confirm the flight/encounter tempo remains the same.
- Keep a single clear melody and leave space around it.
- Check the loop boundary and export playable audio before changing the game.
- Retain the generated asset/source link alongside the exported files.

## Canva listening draft — 22 October 2026

Created in Canva's **AI Music / Muzaic AI** app and saved as the favourite
**Neo Glide — Guitar & Drums**. The composition contains two 60-second scenes:

1. **Live the World** — Rock, Acoustic, Happy, Energetic. Intensity 4/9,
   tempo 6/9, rhythm 7/9, brightness 8/9, variation 2/9.
2. **Rock Electric Road** — Rock, Acoustic, Dark, Tense. Intensity 5/9,
   tempo 6/9, rhythm 7/9, brightness 3/9, variation 2/9.

Both scenes use the same tempo setting; this app does not expose an exact BPM
field, so 128 BPM has not been verified for the generated audio. This is
AI-generated music in an acoustic-rock direction, not a verified human-recorded
performance or a note-for-note arrangement of the procedural game melody.

Canva design: https://www.canva.com/design/DAHYu7SOJZ4/RGvxciDqAI7GIv-0Uo0TRQ/edit

The app explicitly states that its **free-plan music is for personal use only**.
Keep this as a listening draft; do not add it to the published commercial game
without an appropriate licence. No upgrade or purchase was requested.

The two-minute listening design was exported successfully from Canva as MP4.
Its stereo audio was extracted locally and split at the 60-second scene boundary.
Listening copies were level-matched to -22 dBFS RMS (without clipping) and encoded
as AAC, retaining 60 seconds per scene:

- `/private/tmp/neo-glide-canva/main-theme.m4a`
- `/private/tmp/neo-glide-canva/danger-theme.m4a`

The full unadjusted extraction is `/private/tmp/neo-glide-canva/full-draft.wav`.
The Canva design is named **Neo Glide — Guitar & Drums — Listening Draft**.
These files were initially delivered as listening drafts.

## Local gameplay assignment — 22 October 2026

At the user's subsequent explicit request, the recordings are now used in the
local game: **Live the World** in menus and **Rock Electric Road** throughout
gameplay. The latter continues through encounters. A new 2.1-second warning
was composed by editing three unpitched guitar/drum attacks from that recording;
its source positions and timing are in `MUSIC_CUE_EDIT.json`.

The runtime recordings are in `public/audio/music/`. Each backing loop has a
120-ms blended boundary and plays for 59.88 seconds. The warning plays once,
briefly ducks the backing, then restores its level without restarting it.
Pausing, retrying, muting, leaving the flight, or a late audio download cannot
resurrect a stale warning. Paired arrivals get one warning; losing an enemy
does not trigger another. Menu audio also covers Garage, Pilot, Account and Events.

Playback uses decoded recordings, cached per audio context, rather than the
previous procedural melody scheduler. Effects retain their separate volume
control. The developer preview at `/dev/music.html` uses this same player.

The personal-use restriction still applies. This is local integration for
review, not confirmation of commercial publication rights; no licence was
purchased and no app-store build was published.
