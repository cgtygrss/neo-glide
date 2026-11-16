import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInternalTarget } from '../testflight-internal.mjs';
test('device builds are assigned only to the existing internal app group after valid processing',()=>{
 const config={appleAppId:'app'},identity={mode:'device-test',version:'1.3.0',build:'103'};
 const group={attributes:{isInternalGroup:true},relationships:{app:{data:{id:'app'}}}};
 const build={marketingVersion:'1.3.0',attributes:{version:'103',processingState:'VALID',expired:false}};
 assert.equal(validateInternalTarget(group,build,identity,config),true);
 assert.equal(validateInternalTarget(group,{...build,attributes:{...build.attributes,processingState:'PROCESSING'}},identity,config),false);
 for(const state of ['INVALID','FAILED'])assert.throws(()=>validateInternalTarget(group,{...build,attributes:{...build.attributes,processingState:state}},identity,config));
 assert.throws(()=>validateInternalTarget({...group,attributes:{isInternalGroup:false}},build,identity,config));
 assert.throws(()=>validateInternalTarget(group,build,{...identity,mode:'publish'},config));
 assert.throws(()=>validateInternalTarget(group,build,identity,{appleAppId:'another-app'}));
 assert.throws(()=>validateInternalTarget(group,{...build,marketingVersion:'1.2.2'},identity,config));
});
