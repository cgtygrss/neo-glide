const base = import.meta.env?.BASE_URL || '/';

// Commercial-use recordings, CC BY 4.0; credits are visible in Settings.
// Asset identities and edit details are retained in public/audio/music/manifest.json.
export const MUSIC_TRACKS = {
  menu: { url: `${base}audio/music/happy-alley.m4a`, level: 1, loop: true },
  flight: { url: `${base}audio/music/beach-bum.m4a`, level: 1, loop: true },
  boss: { url: `${base}audio/music/the-whip.m4a`, level: 1, loop: true },
};

// Keep the soundtrack behind pickups, weapons and explosions in every mode.
export const MUSIC_VOLUME = .30;
export const SFX_VOLUME = .80;
export const MUSIC_CROSSFADE_SECONDS = .6;
export const MENU_EXIT_SECONDS = .1;
export const FLIGHT_SILENCE_SECONDS = .25;
export const FLIGHT_FADE_IN_SECONDS = .15;

export const MUSIC_CREDITS = {
  artist: 'Kevin MacLeod',
  artistUrl: 'https://incompetech.com/',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  tracks: [
    { title: 'Happy Alley', source: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100482' },
    { title: 'Beach Bum', source: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100347' },
    { title: 'The Whip', source: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100543' },
  ],
  changes: 'Edited into loops, level adjusted and AAC encoded for the game.',
};
