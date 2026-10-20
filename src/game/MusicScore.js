// Rhythm-led arcade backing: bouncing bass, drums and short offbeat chords.
const CHORDS = {
  D: [50, 57, 61, 64, 66], A: [45, 52, 59, 61, 64],
  Bm: [47, 54, 57, 62, 66], G: [43, 50, 54, 59, 62],
  Em: [40, 47, 50, 55, 59], Fs: [42, 49, 57, 61, 64],
};
const MAIN = ['D', 'D', 'A', 'A', 'Bm', 'Bm', 'G', 'G'];
const BRIDGE_CHORDS = ['Em', 'Em', 'G', 'G', 'D', 'D', 'A', 'A'];
const BOSS = ['Bm', 'Bm', 'G', 'G', 'D', 'D', 'Fs', 'Fs'];

export function createMusicScore(track = 'flight') {
  const mode = ['menu', 'flight', 'boss'].includes(track) ? track : 'flight';
  const bpm = mode === 'menu' ? 116 : mode === 'boss' ? 144 : 128;
  const events = [];
  const add = (beat, duration, midi, instrument, velocity = 1) => events.push({ beat, duration, midi, instrument, velocity });
  for (let bar = 0; bar < 32; bar++) {
    const section = Math.floor(bar / 8);
    const local = bar % 8;
    const start = bar * 4;
    const chordName = (mode === 'boss' ? BOSS : section === 2 ? BRIDGE_CHORDS : MAIN)[local];
    const chord = CHORDS[chordName];
    if (mode === 'boss') {
      // A broken-beat encounter groove contrasts with the steady flight pulse.
      for (const [beat, offset] of [[0, 0], [.5, 0], [.75, 12], [1.5, 7], [2, 0], [2.5, 0], [2.75, 12], [3.5, 7]]) {
        add(start + beat, .2, chord[0] + offset, 'bass', beat % 2 === 0 ? .95 : .65);
      }
      for (const beat of [0, .75, 1.5, 2.75, 3.5]) add(start + beat, .26, 36, 'kick', beat === 0 ? .95 : .72);
      for (const beat of [1, 3]) add(start + beat, .18, 0, 'tap', .95);
      for (const beat of [2.5, 3.75]) add(start + beat, .09, 0, 'tap', .32);
      for (const beat of [0, .5, 1, 1.5, 2, 2.5, 3, 3.5]) add(start + beat, .08, 0, 'tick', beat % 1 ? .4 : .18);
      for (const beat of [.75, 2.75]) for (const midi of chord.slice(1, 3)) add(start + beat, .16, midi, 'pluck', .55);
      if (local % 4 === 0) add(start, 1.5, chord[1], 'pad', .35);
      if (local % 4 === 3) for (const beat of [3.25, 3.75]) add(start + beat, .18, 0, 'tom', .65);
      continue;
    }
    // Quiet sustained harmony supports short offbeat stabs rather than dominating.
    if (local % 2 === 0) for (const midi of chord.slice(1, 3)) add(start, 3.4, midi, 'pad', .5);
    const offbeats = mode === 'menu' ? [.5, 2.5] : [.5, 1.5, 2.5, 3.5];
    for (const beat of offbeats) {
      for (const midi of [chord[2], chord[3]]) add(start + beat, .24, midi, 'pluck', section === 2 ? .48 : .65);
    }
    const bassPattern = [[0, 0, .4], [.75, 12, .24], [1.5, 7, .3], [2, 0, .4], [2.75, 12, .24], [3.5, 7, .3]];
    for (const [i, [beat, offset, duration]] of bassPattern.entries()) {
      if (mode === 'menu' && (i === 1 || i === 4)) continue;
      add(start + beat, duration, chord[0] + offset, 'bass', i % 3 === 0 ? .95 : .7);
    }
    // Every section keeps its pulse, including the lighter bridge.
    for (const beat of [0, 1, 2, 3]) {
      if (mode === 'menu' && beat % 2) continue;
      add(start + beat, .32, 36, 'kick', beat % 2 ? .68 : .9);
    }
    for (const beat of [1, 3]) add(start + beat, .2, 0, 'tap', mode === 'menu' ? .5 : .85);
    for (const beat of offbeats) add(start + beat, .1, 0, 'tick', beat === 3.5 ? .58 : .42);
    if (local === 7 && mode !== 'menu') {
      add(start + 3.5, .1, 0, 'tap', .5);
      add(start + 3.75, .08, 0, 'tap', .35);
    }
  }
  events.sort((a, b) => a.beat - b.beat);
  return { track: mode, bpm, beats: 128, events };
}

export const midiFrequency = midi => 440 * 2 ** ((midi - 69) / 12);

export const BOSS_ENTRANCE = [
  { beat: 0, duration: .35, midi: 0, instrument: 'tom', velocity: .8 },
  { beat: .3, duration: .25, midi: 0, instrument: 'tom', velocity: .65 },
  { beat: .6, duration: .4, midi: 0, instrument: 'tom', velocity: .95 },
];
