# Neo Glide Picomatch backport

This is an explicit local fork named `@neo-glide/picomatch`, based on the
published **picomatch 4.0.7** package. Its version remains 4.0.7 for peer
compatibility; it does not claim an upstream fixed release exists.

Only the `lib/parse.js` changes from upstream proposal
[PR 264](https://github.com/micromatch/picomatch/pull/264), pinned to commit
`8144a1a22a8fa1766951411f220cc8c6228cb041`, are backported. The published
4.0.7 constants and other matcher sources are retained, excluding unrelated
changes on upstream master. Original MIT copyright and license are retained.

The patch closes the repeated-wildcard boundary from
[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf): ordinary
repeats are flattened when equivalence can be established, and unsupported
unsafe forms use Picomatch's existing literal fallback. This is an unmerged
upstream proposal verified downstream, not an upstream-supported release.

Both the web build tools and the Firebase CLI resolve `picomatch` to this same
directory through npm overrides. `ci/picomatch-backport.json` records source
hashes and provenance. CI verifies all installed copies and runs adversarial
matching in deadline-limited subprocesses before running the normal npm audits.
Because npm does not audit local forks, the gate also queries advisories for
the **original** package/version. Any new high/critical advisory blocks CI;
only this exact, integrity-checked backport accounts for the advisory above.
Network errors and integrity mismatches also block the gate.

The matcher is a build-time dependency, not the game's backend or wallet.
This patch does not make arbitrary attacker-supplied regular expressions or
glob patterns safe: Picomatch's explicit `maxExtglobRecursion: false` opt-out,
nested fixed-text repeats, and sufficiently complex sequential wildcard globs
retain their existing risks. Neo Glide's build configuration must remain
trusted; no public endpoint should accept arbitrary glob patterns.

Replace this fork with a supported upstream release once one is available,
after rerunning these tests and the complete CI. Keep upstream advisory
monitoring until every local override has been removed.
