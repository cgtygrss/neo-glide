import { RequestError } from './shared/errors.js';
import { verify } from 'node:crypto';
export const isConsoleSsvValidation=query=>query.get('user_id')==='admob-console-validation'&&query.get('custom_data')==='admob-console-validation';
export function validateSsvEnvelope(raw) {
 if(typeof raw!=='string'||raw.length>8192||!/&signature=[^&]{1,1024}&key_id=\d{1,40}$/.test(raw))throw new RequestError('Invalid callback envelope.');
}
export function verifySsv(raw,keys,units) {
 validateSsvEnvelope(raw);
 const index=raw.indexOf('&signature=');if(index<0)throw new RequestError('Missing signature.');
 const query=new URLSearchParams(raw),key=keys.find(k=>String(k.keyId)===query.get('key_id'));
 if(new Set(query.keys()).size!==Array.from(query.keys()).length)throw new RequestError('Duplicate callback parameter.');
 const unit=query.get('ad_unit');
 // AdMob callbacks can use the numeric unit ID while configuration uses
 // the SDK's full ca-app-pub-.../unit identifier. Keep both forms allowlisted.
 // Google's verifier uses Java URI#getQuery, which decodes percent escapes
 // without changing parameter order or converting literal plus signs to spaces.
 const content=decodeURIComponent(raw.slice(0,index));
 if(!key||!verify('sha256',Buffer.from(content),key.pem,Buffer.from(query.get('signature')||'','base64url')))throw new RequestError('Invalid signature.');
 const timestamp=Number(query.get('timestamp'));if(!Number.isFinite(timestamp)||!query.get('transaction_id')||!query.get('custom_data')||!query.get('user_id'))throw new RequestError('Invalid reward data.');
 // Google's console transport test uses a sample unit. Only this signed,
 // explicitly marked test is acknowledged without entering the reward path.
 if(!isConsoleSsvValidation(query)&&!units.includes(unit)&&!(/^\d+$/.test(unit||'')&&units.some(allowed=>allowed.endsWith(`/${unit}`))))throw new RequestError('Unknown ad unit.');
 return query;
}

export function createVerifierKeyCache(fetchKeys = fetch, clock = Date.now) {
 let keys, refreshedAt = 0, pending, retryAt = 0;
 return async () => {
  if(keys && clock()-refreshedAt<3600000)return keys;
  if(pending)return pending;
  if(clock()<retryAt)throw new RequestError('Verification unavailable.',503,'verification-unavailable');
  pending=(async()=>{
   try {
    const response=await fetchKeys('https://www.gstatic.com/admob/reward/verifier-keys.json',{signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new Error('Key service unavailable.');
    const body=await response.json();
    if(!Array.isArray(body.keys)||!body.keys.length||body.keys.length>64||body.keys.some(key=>!/^\d{1,40}$/.test(String(key.keyId))||typeof key.pem!=='string'||key.pem.length>8192))throw new Error('Invalid key service response.');
    keys=body.keys;refreshedAt=clock();return keys;
   } catch {
    retryAt=clock()+10000;
    throw new RequestError('Verification unavailable.',503,'verification-unavailable');
   } finally {pending=null;}
  })();
  return pending;
 };
}
