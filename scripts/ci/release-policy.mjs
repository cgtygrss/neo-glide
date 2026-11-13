export const APPLE_PENDING = new Set(['WAITING_FOR_REVIEW', 'IN_REVIEW', 'PENDING_APPLE_RELEASE', 'PENDING_DEVELOPER_RELEASE', 'PROCESSING_FOR_APP_STORE', 'WAITING_FOR_EXPORT_COMPLIANCE', 'ACCEPTED']);

export function validateCandidate({ version, build, maximumBuild, sameArtifact = false }) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !Number.isSafeInteger(Number(build))) throw new Error('Invalid candidate identity.');
  if (Number(build) < Number(maximumBuild) || (Number(build) === Number(maximumBuild) && !sameArtifact)) throw new Error('Build number collision. Increase buildNumberOffset in ci/release.json.');
}

export function guardOutstanding(records, candidate) {
  for (const record of records) {
    if (['success', 'failure', 'inactive'].includes(record.state)) continue;
    if (record.run === candidate.run && record.commit === candidate.commit && record.build === candidate.build && record.sha256 === candidate.sha256) continue;
    throw new Error(`Previous ${record.store} release ${record.version} (${record.build}) is unresolved. Confirm its review result first.`);
  }
}

export function resumeAction(record, candidate) {
  if (!record) return 'upload';
  for (const field of ['commit', 'build', 'version', 'sha256']) if (record[field] !== candidate[field]) throw new Error('Stored artifact identity does not match this retry.');
  return record.submitted ? 'skip' : 'resume';
}

export function compareVersions(a, b) {
  const left = a.split('.').map(Number), right = b.split('.').map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}
