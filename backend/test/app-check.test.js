import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAppRequest, localEmulators, APP_IDS } from '../app-check.js';
const req=token=>({headers:token===undefined?{}:{'x-firebase-appcheck':token}});
test('attestation enforcement rejects missing, forged, oversized and foreign-app tokens',async()=>{
 const options={environment:{APP_CHECK_MODE:'enforce'}};
 let verified=0;
 const verify=async token=>{verified++;if(token==='forged')throw Error('private token details');return {appId:token==='foreign'?'other-app':APP_IDS[0]};};
 for(const token of [undefined,'',[], 'x'.repeat(8193)])await assert.rejects(verifyAppRequest(req(token),verify,options),error=>error.status===401);
 assert.equal(verified,0);
 await assert.rejects(verifyAppRequest(req('forged'),verify,options),error=>error.status===401&&!error.message.includes('private'));
 await assert.rejects(verifyAppRequest(req('foreign'),verify,options),error=>error.status===403);
 assert.equal(await verifyAppRequest(req('valid'),verify,options),'verified');
});
test('monitor mode permits missing legacy attestations but never accepts invalid supplied proofs',async()=>{
 const options={environment:{APP_CHECK_MODE:'monitor'}};
 assert.equal(await verifyAppRequest(req(),()=>{throw Error('must not run');},options),'missing');
 await assert.rejects(verifyAppRequest(req('forged'),async()=>{throw Error('forged');},options),error=>error.code==='invalid-app-check');
 await assert.rejects(verifyAppRequest(req(),async()=>({}),{environment:{APP_CHECK_MODE:'disabled'}}),error=>error.status===503);
});
test('emulator bypass needs a demo project and both local emulator endpoints',async()=>{
 const local={GCLOUD_PROJECT:'demo-neo-glide',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8188',FIREBASE_AUTH_EMULATOR_HOST:'localhost:9199',APP_CHECK_MODE:'enforce'};
 assert.equal(localEmulators(local),true);
 assert.equal(localEmulators({...local,GCLOUD_PROJECT:'neo-glide-live'}),false);
 assert.equal(localEmulators({...local,FIRESTORE_EMULATOR_HOST:'attacker.example:8188'}),false);
 assert.equal(await verifyAppRequest(req(),()=>{throw Error('must not run');},{environment:local}),'emulator');
});
test('a web attestation can operate the administrator page but cannot authorize native economic actions',async()=>{
 const verify=async()=>({appId:APP_IDS[2]}),environment={APP_CHECK_MODE:'enforce'};
 assert.equal(await verifyAppRequest(req('valid-web'),verify,{environment,action:'adminRead'}),'verified');
 for(const action of ['flight','purchase','spend','careerClaim','claim','merge'])await assert.rejects(verifyAppRequest(req('valid-web'),verify,{environment,action}),error=>error.code==='native-app-required');
});
