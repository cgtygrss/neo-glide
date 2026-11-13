import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MUSIC_TRACKS, MUSIC_CREDITS } from '../src/game/MusicTracks.js';

const directory = new URL('../public/audio/music/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'));

test('every shipped recording has the reviewed commercial license and exact asset identity', () => {
  for (const [track, config] of Object.entries(MUSIC_TRACKS)) {
    const asset = manifest.assets[track];
    assert.ok(['CC-BY-4.0', 'CC0-1.0'].includes(asset.license));
    assert.ok(config.url.endsWith(`/audio/music/${asset.file}`));
    const bytes = readFileSync(new URL(asset.file, directory));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    if (config.loop) {
      assert.match(asset.source, /^https:\/\/incompetech.com\//);
      assert.match(asset.source_sha256, /^[0-9a-f]{64}$/);
      assert.ok(MUSIC_CREDITS.tracks.some(credit => credit.title === asset.title && credit.source === asset.source));
    }
  }
  const shippedAudio = readdirSync(directory).filter(name => /\.(m4a|mp3|wav|ogg)$/i.test(name)).sort();
  assert.deepEqual(shippedAudio, Object.values(manifest.assets).map(asset => asset.file).sort(),
    'Personal-use drafts or unreviewed audio must not ship via Vite public assets');
});

test('attribution and full music license ship with the recordings', () => {
  const credits = readFileSync(new URL('CREDITS.txt', directory), 'utf8');
  for (const track of MUSIC_CREDITS.tracks) {
    assert.ok(credits.includes(track.title));
    assert.ok(credits.includes(track.source));
  }
  assert.ok(credits.includes(MUSIC_CREDITS.artist));
  assert.ok(credits.includes(MUSIC_CREDITS.licenseUrl));
  assert.match(credits, /Changes:/);
  const license = readFileSync(new URL('CC-BY-4.0.txt', directory), 'utf8');
  assert.match(license, /Attribution 4.0 International/);
  assert.match(license, /Section 3/);
});
