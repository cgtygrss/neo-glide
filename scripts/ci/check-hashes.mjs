import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
for (const platform of ['ios', 'android']) {
  const manifest = JSON.parse(readFileSync(`ci-output/${platform}.json`));
  if (manifest.commit !== process.env.GITHUB_SHA || manifest.run !== process.env.GITHUB_RUN_ID) throw new Error('Artifact belongs to a different commit or run.');
  const file = platform === 'ios' ? 'ci-output/NeoGlide.ipa' : 'ci-output/NeoGlide.aab';
  if (createHash('sha256').update(readFileSync(file)).digest('hex') !== manifest.sha256) throw new Error('Artifact hash mismatch.');
}
console.log('Both artifact hashes and source commit verified.');
