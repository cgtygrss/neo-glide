import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, cpSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyInstalledCopies, verifyPackage, verifyUpstreamAdvisories } from '../verify-picomatch-backport.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(import.meta.url);
const picomatch = require('../../../vendor/picomatch');

test('both installed dependency trees resolve to the integrity-checked backport', verifyInstalledCopies);

test('changing even one byte of the installed parser blocks the gate', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'neo-picomatch-integrity-'));
  try {
    cpSync(resolve(root, 'vendor/picomatch'), directory, { recursive: true });
    appendFileSync(resolve(directory, 'lib/parse.js'), '\n');
    assert.throws(() => verifyPackage(directory), /integrity mismatch: lib\/parse.js/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('a new upstream high/critical advisory is blocked rather than hidden by the fork', () => {
  const known = { url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf', severity: 'high' };
  assert.equal(verifyUpstreamAdvisories({ picomatch: [known] }), 1);
  for (const severity of ['high', 'critical']) {
    assert.throws(() => verifyUpstreamAdvisories({ picomatch: [known, { url: 'https://github.com/advisories/GHSA-new-test-only', severity }] }), /Unpatched upstream/);
  }
  assert.throws(() => verifyUpstreamAdvisories({ picomatch: {} }), /Invalid/);
  assert.throws(() => verifyUpstreamAdvisories(null), /Invalid/);
});

test('ordinary build globs preserve exclusions, extension matching and scanning', () => {
  assert.equal(picomatch.isMatch('src/App.jsx', '**/*.{js,jsx}'), true);
  assert.equal(picomatch.isMatch('src/App.css', '**/*.{js,jsx}'), false);
  assert.equal(picomatch('**/*.js', { ignore: '**/node_modules/**' })('node_modules/a/index.js'), false);
  assert.equal(picomatch.isMatch('.env.release', '**/.env*', { dot: true }), true);
  assert.equal(picomatch.isMatch('vendor/picomatch/lib/parse.js', '**/vendor/**'), true);
  assert.equal(picomatch.isMatch('src/foo.test.js', '**/!(*.test).js'), false);
  assert.equal(picomatch.scan('src/**/*.jsx').base, 'src');
  assert.equal(picomatch.isMatch('abab', '+(ab)'), true);
});

test('reported and alternate repeated-wildcard inputs finish under an external deadline', () => {
  const patterns = ['+(*)', '*(*)', '+(*a)', '*(*a)', '+(a*b)', '+(*a|b)', '*(b|*a)',
    '+(@(*a))', '+(!(a))', '+([*a)', '+(*[ab])', '@(*a)+', '(*a)+', '{*a,b}+', '(*|+((""))'];
  const script = `const p=require(process.argv[1]); const [patterns,opts]=JSON.parse(process.argv[2]);
    for(const pattern of patterns) for(const input of ['a'.repeat(60000)+'/', 'a'.repeat(60000)+'!']) {
      p(pattern,opts)(input); p.makeRe(pattern,opts).test(input); p.compileRe(p.parse(pattern,opts),opts).test(input);
    }`;
  for (const options of [{}, { windows: true }, { bash: true }, { capture: true }, { nobracket: true }, { flags: 'i' }]) {
    const child = spawnSync(process.execPath, ['--max-old-space-size=128', '-e', script,
      resolve(root, 'vendor/picomatch'), JSON.stringify([patterns, options])], {
      timeout: 5000, killSignal: 'SIGKILL', encoding: 'utf8', maxBuffer: 8192, env: { PATH: process.env.PATH },
    });
    assert.equal(child.error, undefined, `Deadline/child failure: ${JSON.stringify(options)} ${child.error?.code}`);
    assert.equal(child.status, 0, child.stderr);
  }
});
