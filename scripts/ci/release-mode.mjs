import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function releaseMode(env) {
  if (env.DEVICE_TEST === 'true') {
    if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.MANUAL_DRY_RUN !== 'false') throw new Error('Device distribution requires an explicit manual run with dry_run=false.');
    return 'device-test';
  }
  if (env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    if(env.MANUAL_DRY_RUN!=='false')return 'dry-run';
    if(env.ENABLED!=='true')throw new Error('Public publishing is paused. Use device_test for internal validation.');
    return 'publish';
  }
  return env.ENABLED === 'true' ? 'publish' : 'dry-run';
}

export function sandboxFunctionTargets() {
  return ['functions:events:apiSandbox', 'functions:events:appStoreSandboxNotifications'];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode=releaseMode(process.env);
  appendFileSync(process.env.GITHUB_OUTPUT, `mode=${mode}\ndry_run=${mode==='dry-run'}\n`);
}
