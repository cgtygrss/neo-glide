import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

// Inspect the compiled app, not just Pod installation or capacitor.config.json.
// Usage: node scripts/verify-ios-admob.mjs /absolute/path/to/App.app [--ads=test|live]
const app = process.argv[2];
const adsMode = process.argv[3];
assert.ok(!adsMode || ['--ads=test', '--ads=live'].includes(adsMode), 'Use --ads=test or --ads=live.');
assert.ok(app?.endsWith('.app'), 'Pass the compiled App.app directory.');
const directory = resolve(app);
const plist = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', join(directory, 'Info.plist')], { encoding: 'utf8' }));
const config = JSON.parse(readFileSync(join(directory, 'capacitor.config.json'), 'utf8'));
assert.ok(config.packageClassList?.includes('AdMobPlugin'), 'AdMob is missing from the native plugin configuration.');
assert.match(plist.GADApplicationIdentifier || '', /^ca-app-pub-\d+~\d+$/, 'The native AdMob app ID is missing.');
if (process.env.IOS_ADMOB_APP_ID) assert.equal(plist.GADApplicationIdentifier, process.env.IOS_ADMOB_APP_ID, 'Unexpected native AdMob app ID.');
const symbols = execFileSync('xcrun', ['nm', '-gj', join(directory, plist.CFBundleExecutable)], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
// App Store archives strip global/local symbol tables. The runtime class
// metadata must still exist for Capacitor's plugin discovery to work.
const exportedPlugin = symbols.split('\n').includes('_OBJC_CLASS_$_AdMobPlugin');
const runtimeMetadata = exportedPlugin ? '' : execFileSync('xcrun', ['otool', '-ov', join(directory, plist.CFBundleExecutable)], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
assert.ok(exportedPlugin || /^\s*name\s+0x[0-9a-f]+\s+AdMobPlugin\s*$/m.test(runtimeMetadata),
  'AdMobPlugin is absent from the compiled app. Check inherited linker flags and native registration.');
if (adsMode) {
  const assets = join(directory, 'public', 'assets');
  const scripts = readdirSync(assets).filter(file => file.endsWith('.js'));
  const units = new Set(scripts.flatMap(file => readFileSync(join(assets, file), 'utf8').match(/ca-app-pub-\d+\/\d+/g) || []));
  assert.ok(units.size, 'No native ad unit is present in the compiled web assets.');
  if (adsMode === '--ads=test') {
    assert.ok(units.has('ca-app-pub-3940256099942544/1712485313'), 'The Google iOS rewarded demo unit is missing.');
    assert.ok([...units].every(unit => unit.startsWith('ca-app-pub-3940256099942544/')), 'A live ad unit leaked into the simulator test build.');
  } else {
    const expectedRewarded = process.env.VITE_ADMOB_REWARDED_IOS || 'ca-app-pub-8003289282406955/7613356581';
    assert.ok(units.has(expectedRewarded), 'The configured live iOS rewarded unit is missing.');
    assert.ok([...units].every(unit => !unit.startsWith('ca-app-pub-3940256099942544/')), 'A Google demo ad unit leaked into the live build.');
  }
}
console.log(`${basename(directory)}: AdMob configuration, app ID and compiled plugin class verified.`);
if (adsMode) console.log(`Compiled web inventory verified: ${adsMode.slice(6)} ads.`);
