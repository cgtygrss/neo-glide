import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const platform = process.argv[2], file = process.argv[3];
const identity = JSON.parse(readFileSync('ci-output/identity.json'));
const config = JSON.parse(readFileSync('ci/release.json'));
if (platform === 'android') {
  const verified = execFileSync('jarsigner', ['-verify', file], { encoding: 'utf8' });
  assert.match(verified, /jar verified/);
  const cert = execFileSync('keytool', ['-printcert', '-jarfile', file], { encoding: 'utf8' });
  assert.ok(cert.replaceAll(':', '').includes(config.androidUploadCertificateSha256), 'Unexpected Android upload certificate');
  const manifest = execFileSync('java', ['-jar', 'ci-output/bundletool.jar', 'dump', 'manifest', `--bundle=${file}`], { encoding: 'utf8' });
  assert.ok(manifest.includes(`package="${config.androidPackage}"`));
  assert.ok(manifest.includes(`android:versionCode="${identity.build}"`));
  assert.ok(manifest.includes(`android:versionName="${identity.version}"`));
  assert.match(manifest, /android:minSdkVersion="24"/);
  assert.match(manifest, /android:targetSdkVersion="36"/);
  const names = execFileSync('unzip', ['-Z', '-1', file], { encoding: 'utf8' }).split('\n');
  const scripts = names.filter(name => /^base\/assets\/public\/assets\/[^/]+\.js$/.test(name));
  const units = new Set(scripts.flatMap(name => execFileSync('unzip', ['-p', file, name], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).match(/ca-app-pub-\d+\/\d+/g) || []));
  assert.ok(units.size, 'Compiled Android ad inventory is missing');
  if (config.androidTrack === 'production') {
    assert.ok(manifest.includes(process.env.ANDROID_ADMOB_APP_ID), 'Unexpected native Android AdMob app ID');
    for (const format of ['REWARDED', 'INTERSTITIAL', 'REWARDED_INTERSTITIAL']) assert.ok(units.has(process.env[`VITE_ADMOB_${format}_ANDROID`]), `Compiled Android ${format} ad unit is missing`);
    assert.ok([...units].every(unit => !unit.startsWith('ca-app-pub-3940256099942544/')), 'Demo ads in production Android package');
  } else {
    assert.ok(units.has('ca-app-pub-3940256099942544/5224354917'), 'Closed test rewarded demo ad unit missing');
    assert.ok([...units].every(unit => unit.startsWith('ca-app-pub-3940256099942544/')), 'Live ads in closed test Android package');
  }
  const dex = Buffer.concat(names.filter(name => /^base\/dex\/classes\d*\.dex$/.test(name)).map(name => execFileSync('unzip', ['-p', file, name], { maxBuffer: 64 * 1024 * 1024 })));
  assert.ok(dex.includes(Buffer.from('NeoGlideStorePlugin')), 'Native Play purchase bridge missing');
  assert.ok(process.env.NEO_GLIDE_PLAY_BILLING_PUBLIC_KEY && dex.includes(Buffer.from(process.env.NEO_GLIDE_PLAY_BILLING_PUBLIC_KEY)), 'Play billing public key was not compiled into the package');
  const notices = JSON.parse(execFileSync('unzip', ['-p', file, 'base/assets/public/legal/notices.json'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
  assert.ok(notices.entries?.length, 'Packaged legal inventory missing');
  const bundleConfig = JSON.parse(execFileSync('java', ['-jar', 'ci-output/bundletool.jar', 'dump', 'config', `--bundle=${file}`], { encoding: 'utf8' }));
  assert.equal(bundleConfig.optimizations.uncompressNativeLibraries.alignment, 'PAGE_ALIGNMENT_16K');
  execFileSync('python3', ['scripts/ci/verify-elf.py', file], { stdio: 'inherit' });
} else if (platform === 'ios') {
  const directory = 'ci-output/ipa-inspect';
  mkdirSync(directory, { recursive: true });
  execFileSync('unzip', ['-q', '-o', file, '-d', directory]);
  const app = `${directory}/Payload/App.app`;
  execFileSync('codesign', ['--verify', '--deep', '--strict', app]);
  const plist = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', `${app}/Info.plist`], { encoding: 'utf8' }));
  assert.equal(plist.CFBundleIdentifier, config.appleBundle);
  assert.equal(plist.CFBundleShortVersionString, identity.version);
  assert.equal(plist.CFBundleVersion, identity.build);
  const notices = JSON.parse(readFileSync(`${app}/public/legal/notices.json`));
  assert.ok(notices.entries?.length, 'Packaged iOS legal inventory missing');
  readFileSync(`${app}/PrivacyInfo.xcprivacy`);
  const signature = spawnSync('codesign', ['-dvv', app], { encoding: 'utf8' });
  assert.equal(signature.status, 0);
  assert.ok(signature.stderr.includes(`TeamIdentifier=${config.appleTeamId}`), 'Wrong Apple signing team');
  execFileSync('node', ['scripts/verify-ios-admob.mjs', app, '--ads=live'], { stdio: 'inherit' });
} else throw new Error('Invalid platform');
const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
writeFileSync(`ci-output/${platform}.json`, JSON.stringify({ ...identity, platform, file, sha256 }, null, 2) + '\n');
console.log(`${platform} ${identity.version} (${identity.build}) verified; SHA256 ${sha256}`);
