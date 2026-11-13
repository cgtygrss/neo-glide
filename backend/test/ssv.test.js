import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync,sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { verifySsv } from '../ssv.js';
test('the actual Google console callback verifies with its public key and escaped reward item',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/admob-console-signed.json',import.meta.url),'utf8'));
 assert.equal(verifySsv(fixture.raw,[fixture.key],['live-unit']).get('reward_item'),'$');
 assert.throws(()=>verifySsv(fixture.raw.replace('reward_amount=100','reward_amount=200'),[fixture.key],['live-unit']),/Invalid signature/);
 assert.throws(()=>verifySsv(fixture.raw.replace('&user_id=','&user_id=forged&user_id='),[fixture.key],['live-unit']),/Duplicate callback/);
});
test('SSV signatures bind the callback account, unit and reward intent',()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),keys=[{keyId:1,pem:publicKey.export({type:'spki',format:'pem'})}];
 const query='ad_unit=test&custom_data=intent&timestamp=123456&transaction_id=tx&user_id=pilot',sig=sign('sha256',Buffer.from(query),privateKey).toString('base64url'),raw=`${query}&signature=${sig}&key_id=1`;
 assert.equal(verifySsv(raw,keys,['test']).get('user_id'),'pilot');
 assert.throws(()=>verifySsv(raw.replace('pilot','attacker'),keys,['test']));assert.throws(()=>verifySsv(raw,keys,['other']));assert.throws(()=>verifySsv(raw,[],['test']));assert.throws(()=>verifySsv(query,keys,['test']));
});
test('signed console samples can only enter the no-reward validation path',()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),keys=[{keyId:1,pem:publicKey.export({type:'spki',format:'pem'})}];
 const signed=(user,custom)=>{
  const query=new URLSearchParams({ad_unit:'console-sample-unit',custom_data:custom,timestamp:'123456',transaction_id:'tx',user_id:user}).toString();
  return `${query}&signature=${sign('sha256',Buffer.from(decodeURIComponent(query)),privateKey).toString('base64url')}&key_id=1`;
 };
 const marker='admob-console-validation';
 assert.equal(verifySsv(signed(marker,marker),keys,['live-unit']).get('ad_unit'),'console-sample-unit');
 assert.throws(()=>verifySsv(signed('pilot',marker),keys,['live-unit']),/Unknown ad unit/);
 assert.throws(()=>verifySsv(signed(marker,'intent'),keys,['live-unit']),/Unknown ad unit/);
 assert.throws(()=>verifySsv(signed(marker,marker).replace('console-sample-unit','tampered'),keys,['live-unit']),/Invalid signature/);
});
test('AdMob numeric unit IDs match only the configured full SDK unit',()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),keys=[{keyId:1,pem:publicKey.export({type:'spki',format:'pem'})}];
 const unit='ca-app-pub-8003289282406955/7613356581';
 const signed=adUnit=>{
  const query=new URLSearchParams({ad_unit:adUnit,custom_data:'intent',timestamp:'123456',transaction_id:'tx',user_id:'pilot'}).toString();
  return `${query}&signature=${sign('sha256',Buffer.from(decodeURIComponent(query)),privateKey).toString('base64url')}&key_id=1`;
 };
 assert.equal(verifySsv(signed('7613356581'),keys,[unit]).get('ad_unit'),'7613356581');
 assert.equal(verifySsv(signed(unit),keys,[unit]).get('ad_unit'),unit);
 assert.throws(()=>verifySsv(signed('7613356582'),keys,[unit]),/Unknown ad unit/);
 assert.throws(()=>verifySsv(signed('ca-app-pub-9999999999999999/7613356581'),keys,[unit]),/Unknown ad unit/);
 assert.throws(()=>verifySsv(signed('7613356581').replace('pilot','attacker'),keys,[unit]),/Invalid signature/);
});
