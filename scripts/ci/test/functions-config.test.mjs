import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFunctionsEnvironment,deploymentFunctionsEnvironment } from '../functions-config.mjs';
const valid='BOOTSTRAP_ADMIN_EMAIL=admin@example.test\nEVENT_AD_UNITS=unit\nANDROID_PACKAGE=com.cgtygrss.neoglide\nAPPLE_BUNDLE_ID=com.cgtygrssgame.neonglide\nAPPLE_APP_ID=6755588297\nAPPLE_ENVIRONMENT=Production\nAPP_CHECK_MODE=monitor';
test('live Functions configuration pins receipt realm and explicitly stages attestation',()=>{
  validateFunctionsEnvironment(valid);
  validateFunctionsEnvironment(valid.replace('monitor','enforce'));
  assert.throws(()=>validateFunctionsEnvironment(valid.replace('APP_CHECK_MODE=monitor','')),/APP_CHECK_MODE/);
  assert.throws(()=>validateFunctionsEnvironment(valid.replace('Production','Sandbox')),/test receipts/);
  assert.throws(()=>validateFunctionsEnvironment(valid+'\nFIRESTORE_EMULATOR_HOST=127.0.0.1:8080'),/Local-only/);
  assert.throws(()=>validateFunctionsEnvironment(valid+'\nAPP_CHECK_MODE=enforce'),/Duplicate/);
});

test('Sandbox always enforces proof; public deployment cannot accidentally ship monitor mode',()=>{
 assert.match(deploymentFunctionsEnvironment(valid,{sandboxOnly:true}),/^APP_CHECK_MODE=enforce$/m);
 assert.match(valid,/APP_CHECK_MODE=monitor/,'The stored staging source is unchanged.');
 assert.throws(()=>deploymentFunctionsEnvironment(valid),/enforced App Check/);
 assert.match(deploymentFunctionsEnvironment(valid.replace('monitor','enforce')),/^APP_CHECK_MODE=enforce$/m);
});
