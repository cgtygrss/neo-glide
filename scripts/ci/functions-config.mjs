import assert from 'node:assert/strict';

export function validateFunctionsEnvironment(source) {
  const values=new Map();
  for(const line of source.split(/\r?\n/)) {
    if(!line.trim()||line.trimStart().startsWith('#'))continue;
    const match=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    assert.ok(match,'Invalid Functions environment line (value omitted).');
    assert.ok(!values.has(match[1]),`Duplicate Functions environment key: ${match[1]}`);
    values.set(match[1],match[2].trim().replace(/^(['"])(.*)\1$/,'$2'));
  }
  for(const key of ['BOOTSTRAP_ADMIN_EMAIL','EVENT_AD_UNITS','ANDROID_PACKAGE','APPLE_BUNDLE_ID','APPLE_APP_ID','APPLE_ENVIRONMENT','APP_CHECK_MODE'])assert.ok(values.get(key),`Missing Functions environment value: ${key}`);
  assert.equal(values.get('ANDROID_PACKAGE'),'com.cgtygrss.neoglide','Unexpected Android package.');
  assert.equal(values.get('APPLE_BUNDLE_ID'),'com.cgtygrssgame.neonglide','Unexpected Apple bundle.');
  assert.equal(values.get('APPLE_APP_ID'),'6755588297','Unexpected Apple app ID.');
  assert.equal(values.get('APPLE_ENVIRONMENT'),'Production','Production API cannot use test receipts.');
  assert.ok(['monitor','enforce'].includes(values.get('APP_CHECK_MODE')),'APP_CHECK_MODE must be explicit: monitor or enforce.');
  for(const key of values.keys())assert.ok(!/EMULATOR|DEBUG_TOKEN/.test(key),`Local-only Functions configuration is forbidden: ${key}`);
}
