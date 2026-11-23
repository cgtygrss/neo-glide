import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { sameReleaseSelection } from './release-selection.mjs';
const identity=JSON.parse(readFileSync('ci-output/identity.json'));
for (const platform of ['ios', 'android']) {
  const manifest = JSON.parse(readFileSync(`ci-output/${platform}.json`));
  if (manifest.commit !== process.env.GITHUB_SHA || manifest.run !== process.env.GITHUB_RUN_ID) throw new Error('Artifact belongs to a different commit or run.');
  for(const field of ['version','build','commit','run','mode','track'])if(manifest[field]!==identity[field])throw new Error(`Artifact ${field} does not match the run identity.`);
  if (!sameReleaseSelection(manifest, identity)) throw new Error('Artifact store/review selection does not match the run identity.');
  const file = platform === 'ios' ? 'ci-output/NeoGlide.ipa' : 'ci-output/NeoGlide.aab';
  if (createHash('sha256').update(readFileSync(file)).digest('hex') !== manifest.sha256) throw new Error('Artifact hash mismatch.');
}
console.log('Both artifact hashes and source commit verified.');
