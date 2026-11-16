import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseMode,sandboxFunctionTargets } from '../release-mode.mjs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);

test('device testing is manual, explicit and cannot accidentally select public distribution',()=>{
 assert.equal(releaseMode({GITHUB_EVENT_NAME:'push',ENABLED:'false'}),'dry-run');
 assert.equal(releaseMode({GITHUB_EVENT_NAME:'push',ENABLED:'true'}),'publish');
 assert.equal(releaseMode({GITHUB_EVENT_NAME:'workflow_dispatch',ENABLED:'true',MANUAL_DRY_RUN:'true'}),'dry-run');
 assert.equal(releaseMode({GITHUB_EVENT_NAME:'workflow_dispatch',DEVICE_TEST:'true',MANUAL_DRY_RUN:'false'}),'device-test');
 assert.throws(()=>releaseMode({GITHUB_EVENT_NAME:'push',DEVICE_TEST:'true',MANUAL_DRY_RUN:'false'}));
 assert.throws(()=>releaseMode({GITHUB_EVENT_NAME:'workflow_dispatch',DEVICE_TEST:'true',MANUAL_DRY_RUN:'true'}));
 assert.throws(()=>releaseMode({GITHUB_EVENT_NAME:'workflow_dispatch',ENABLED:'false',MANUAL_DRY_RUN:'false'}),/paused/);
 assert.equal(releaseMode({GITHUB_EVENT_NAME:'workflow_dispatch',ENABLED:'true',MANUAL_DRY_RUN:'false'}),'publish');
 const targets=sandboxFunctionTargets();
 assert.ok(targets.includes('functions:events:apiSandbox'));
 assert.ok(!targets.includes('functions:events:api'));
 assert.ok(targets.every(target=>target.endsWith('Sandbox')||target.endsWith('SandboxNotifications')));
});

test('the pinned Firebase CLI selects only the two Sandbox exports',()=>{
 const {getEndpointFilters,endpointMatchesAnyFilter}=require('../../../tools/ci/node_modules/firebase-tools/lib/deploy/functions/functionsDeployHelper.js');
 const filters=getEndpointFilters({only:sandboxFunctionTargets().join(',')},[{codebase:'events'}]);
 for(const id of ['api','admobSsv','appStoreNotifications'])assert.equal(endpointMatchesAnyFilter({id,codebase:'events'},filters),false,id);
 for(const id of ['apiSandbox','appStoreSandboxNotifications'])assert.equal(endpointMatchesAnyFilter({id,codebase:'events'},filters),true,id);
});
