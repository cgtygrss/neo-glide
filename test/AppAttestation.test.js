import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttestationReader } from '../src/account/AppAttestation.js';
test('attestation failures share one request, expose no proof and recover after bounded backoff',async()=>{
 let now=1000,calls=0,fail=true;
 const read=createAttestationReader(async()=>{calls++;await Promise.resolve();if(fail)throw Error('secret token');return 'verified-token';},()=>now);
 assert.deepEqual(await Promise.all([read(),read(),read()]),[null,null,null]);assert.equal(calls,1);
 assert.equal(await read(),null);assert.equal(calls,1);
 now+=60001;fail=false;
 assert.equal(await read(),'verified-token');assert.equal(calls,2);
});
