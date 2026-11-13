import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function releaseIdentity(version, runNumber = 1, offset = 100) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Use a numeric major.minor.patch version in package.json.');
  const build = Number(runNumber) + Number(offset);
  if (!Number.isSafeInteger(build) || build <= 0 || build > 2100000000) throw new Error('Invalid build number.');
  return { version, build: String(build) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pkg = JSON.parse(readFileSync('package.json'));
  const config = JSON.parse(readFileSync('ci/release.json'));
  if (!['alpha', 'production'].includes(config.androidTrack)) throw new Error('Unsupported release track.');
  const identity = releaseIdentity(pkg.version, process.env.GITHUB_RUN_NUMBER || 1, config.buildNumberOffset);
  const publicVersion = JSON.parse(readFileSync('public/version.json'));
  publicVersion.version = identity.version;
  writeFileSync('public/version.json', JSON.stringify(publicVersion, null, 2) + '\n');
  const project = 'ios/App/App.xcodeproj/project.pbxproj';
  writeFileSync(project, readFileSync(project, 'utf8').replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${identity.version};`));
  mkdirSync('ci-output', { recursive: true });
  writeFileSync('ci-output/identity.json', JSON.stringify({ ...identity, commit: process.env.GITHUB_SHA || '', run: process.env.GITHUB_RUN_ID || '' }, null, 2) + '\n');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${identity.version}\nbuild=${identity.build}\n`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `track=${config.androidTrack}\n`);
  console.log(`Neo Glide ${identity.version} (${identity.build})`);
}
