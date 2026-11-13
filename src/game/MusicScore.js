// A small, bright arcade groove. The encounter keeps the flight tempo and
// signals danger through minor harmony, a lower register and a darker voice.
const FLIGHT_BPM = 128;
const CHORDS = {
  D: { bass: 38, notes: [62, 66, 69] },
  G: { bass: 43, notes: [62, 67, 71] },
  A: { bass: 45, notes: [61, 64, 69] },
};
const MAIN = ['D', 'D', 'G', 'A', 'D', 'G', 'A', 'D'];
const HOOK = [
  [[0, 74, .6], [1.5, 78, .45], [3, 81, .45]],
  [[.5, 78, .5], [2.5, 74, .65]],
  [[0, 71, .6], [1.5, 74, .45], [3, 79, .45]],
  [[.5, 76, .5], [2.5, 73, .65]],
  [[0, 78, .6], [1.5, 81, .45], [3, 78, .45]],
  [[.5, 79, .5], [2.5, 74, .65]],
  [[0, 73, .6], [1.5, 76, .45], [3, 81, .45]],
  [[.5, 78, .5], [2.5, 74, .65]],
];
const THREAT_CHORDS = {
  Dm: { bass: 38, notes: [50, 53, 57], motif: [62, 65, 61] },
  Eb: { bass: 39, notes: [51, 55, 58], motif: [63, 62, 58] },
  Gm: { bass: 43, notes: [50, 55, 58], motif: [62, 58, 55] },
  A: { bass: 45, notes: [49, 52, 57], motif: [61, 64, 57] },
};
const THREAT = ['Dm', 'Dm', 'Eb', 'Eb', 'Gm', 'Gm', 'A', 'A'];

export function createMusicScore(track = 'flight') {
  const mode = ['menu', 'flight', 'boss'].includes(track) ? track : 'flight';
  const bpm = mode === 'menu' ? 120 : FLIGHT_BPM;
  const events = [];
  const add = (beat, duration, midi, instrument, velocity = 1) => events.push({ beat, duration, midi, instrument, velocity });
  for (let bar = 0; bar < 32; bar++) {
    const phrase = bar % 8, start = bar * 4;
    const encounter = mode === 'boss';
    const chord = encounter ? THREAT_CHORDS[THREAT[phrase]] : CHORDS[MAIN[phrase]];

    // Four quiet offbeat hats, one backbeat and no ornamental percussion layers.
    for (const beat of encounter ? [0, 1.5, 2.75] : [0, 1, 2, 3]) {
      add(start + beat, .3, 36, 'kick', beat === 0 ? .9 : .74);
    }
    for (const beat of [1, 3]) add(start + beat, .2, 0, 'clap', mode === 'menu' ? .42 : .62);
    for (const beat of [.5, 1.5, 2.5, 3.5]) add(start + beat, .08, 0, 'hat', .38);

    const bass = encounter
      ? [[0, 0, .48], [1.5, 0, .3], [2, 0, .48], [3.5, 7, .25]]
      : [[0, 0, .42], [1.5, 7, .3], [2, 0, .42], [3.5, 12, .25]];
    for (const [index, [beat, offset, duration]] of bass.entries()) {
      if (mode === 'menu' && index === 1) continue;
      add(start + beat, duration, chord.bass + offset, 'bass', offset === 0 ? .84 : .62);
    }
    // Just two soft chord stabs; the threat has one lower, minor-coloured stab.
    for (const beat of encounter ? [.5] : [.5, 2.5]) {
      for (const midi of chord.notes) add(start + beat, encounter ? .38 : .22, midi, 'chord', encounter ? .65 : .52);
    }

    if (encounter) {
      // Short low calls and a semitone tension replace the bright melody.
      for (const [index, beat] of [.25, 1.75, 3].entries()) {
        if (phrase % 2 && index === 1) continue;
        add(start + beat, index === 2 ? .55 : .35, chord.motif[index], 'danger', index === 0 ? .86 : .7);
      }
    } else {
      const melody = HOOK[phrase];
      for (const [index, [beat, midi, duration]] of melody.entries()) {
        if (mode === 'menu' && melody.length === 3 && index === 1) continue;
        // A small answer changes the third phrase without adding another part.
        const note = Math.floor(bar / 8) === 2 && index === 0 ? chord.notes[1] + 12 : midi;
        add(start + beat, duration, note, 'lead', mode === 'menu' ? .58 : .72);
      }
    }
  }
  events.sort((a, b) => a.beat - b.beat);
  return { track: mode, bpm, beats: 128, events };
}

export const midiFrequency = midi => 440 * 2 ** ((midi - 69) / 12);

// A low, tense warning identifies danger without a tempo increase or fanfare.
export const BOSS_ENTRANCE = [
  { beat: 0, duration: .3, midi: 62, instrument: 'danger', velocity: .9 },
  { beat: .4, duration: .3, midi: 63, instrument: 'danger', velocity: .8 },
  { beat: .8, duration: .55, midi: 57, instrument: 'danger', velocity: .9 },
];
