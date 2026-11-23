export function releaseSelection(env, mode) {
  const store = env.RELEASE_STORE || 'both';
  if (!['both', 'ios', 'android'].includes(store)) throw new Error('Unknown release store.');
  const manual = env.GITHUB_EVENT_NAME === 'workflow_dispatch';
  if (!manual && store !== 'both') throw new Error('A single-store release requires a manual main run.');
  if (!['', 'true', 'false', undefined].includes(env.IOS_SUBMIT_FOR_REVIEW)) throw new Error('Invalid Apple review selection.');
  const iosSubmitForReview = env.IOS_SUBMIT_FOR_REVIEW !== 'false';
  if (!iosSubmitForReview && (!manual || mode !== 'publish' || store !== 'ios')) {
    throw new Error('Manual Apple review requires an explicit iOS-only public release.');
  }
  return { stores: store === 'both' ? ['ios', 'android'] : [store], iosSubmitForReview };
}

export function sameReleaseSelection(previous, candidate) {
  return JSON.stringify(previous.stores ?? ['ios', 'android']) === JSON.stringify(candidate.stores ?? ['ios', 'android'])
    && (previous.iosSubmitForReview ?? true) === (candidate.iosSubmitForReview ?? true);
}
