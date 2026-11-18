import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const metadata = JSON.parse(readFileSync(resolve(root, 'ci/picomatch-backport.json')));
const patchedAdvisory = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';

export function verifyPackage(directory, record = metadata) {
  const info = JSON.parse(readFileSync(resolve(directory, 'package.json')));
  assert.equal(info.name, '@neo-glide/picomatch', 'Unpatched registry Picomatch installed');
  assert.equal(info.version, record.upstream.version);
  assert.equal(info.neoGlideBackport.patchCommit, record.patch.commit);
  for (const [file, expected] of Object.entries(record.files)) {
    const digest = createHash('sha256').update(readFileSync(resolve(directory, file))).digest('hex');
    assert.equal(digest, expected, `Backport integrity mismatch: ${file}`);
  }
}

export function verifyInstalledCopies() {
  const fork = realpathSync(resolve(root, 'vendor/picomatch'));
  verifyPackage(fork);
  for (const location of ['', 'tools/ci']) {
    const directory = resolve(root, location);
    const manifest = JSON.parse(readFileSync(resolve(directory, 'package.json')));
    const expected = location ? 'file:../../vendor/picomatch' : 'file:./vendor/picomatch';
    assert.equal(manifest.overrides.picomatch, '$picomatch', 'All Picomatch consumers must use the backport');
    assert.equal((manifest.devDependencies || manifest.dependencies).picomatch, expected);
    const lock = JSON.parse(readFileSync(resolve(directory, 'package-lock.json')));
    const copies = Object.keys(lock.packages).filter(key => /(^|\/)node_modules\/picomatch$/.test(key));
    assert.ok(copies.length > 0, `Missing Picomatch lock entry: ${location || 'root'}`);
    for (const copy of copies) {
      const installed = realpathSync(resolve(directory, copy));
      assert.equal(installed, fork, `Unexpected Picomatch copy: ${copy}`);
      verifyPackage(installed);
    }
  }
}

export function verifyUpstreamAdvisories(response) {
  assert.ok(response && typeof response === 'object' && !Array.isArray(response), 'Invalid npm advisory response');
  const advisories = response.picomatch ?? [];
  assert.ok(Array.isArray(advisories), 'Invalid Picomatch advisory response');
  for (const advisory of advisories) {
    assert.ok(typeof advisory.url === 'string' && ['info', 'low', 'moderate', 'high', 'critical'].includes(advisory.severity), 'Invalid advisory entry');
    if (['high', 'critical'].includes(advisory.severity) && advisory.url !== patchedAdvisory) {
      throw new Error(`Unpatched upstream Picomatch advisory: ${advisory.url}`);
    }
  }
  return advisories.length;
}

export async function verifyBackport() {
  verifyInstalledCopies();
  // Local forks are not covered by npm audit. Keep watching the original
  // package and fail closed for any new high/critical advisory. The one
  // backported advisory is accepted only after exact source hashes match;
  // the adjacent required regression tests exercise its original boundary.
  const response = await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ picomatch: [metadata.upstream.version] }),
    signal: AbortSignal.timeout(30_000),
  });
  assert.ok(response.ok, `Upstream advisory check failed: HTTP ${response.status}`);
  const count = verifyUpstreamAdvisories(await response.json());
  console.log(`Picomatch backport integrity verified in both dependency trees; ${count} upstream advisory record(s) checked.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await verifyBackport();
