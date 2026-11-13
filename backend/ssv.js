import { verify } from 'node:crypto';
export const isConsoleSsvValidation=query=>query.get('user_id')==='admob-console-validation'&&query.get('custom_data')==='admob-console-validation';
export function verifySsv(raw,keys,units) {
 const index=raw.indexOf('&signature=');if(index<0)throw new Error('Missing signature.');
 const query=new URLSearchParams(raw),key=keys.find(k=>String(k.keyId)===query.get('key_id'));
 if(new Set(query.keys()).size!==Array.from(query.keys()).length)throw new Error('Duplicate callback parameter.');
 const unit=query.get('ad_unit');
 // AdMob callbacks can use the numeric unit ID while configuration uses
 // the SDK's full ca-app-pub-.../unit identifier. Keep both forms allowlisted.
 // Google's verifier uses Java URI#getQuery, which decodes percent escapes
 // without changing parameter order or converting literal plus signs to spaces.
 const content=decodeURIComponent(raw.slice(0,index));
 if(!key||!verify('sha256',Buffer.from(content),key.pem,Buffer.from(query.get('signature')||'','base64url')))throw new Error('Invalid signature.');
 const timestamp=Number(query.get('timestamp'));if(!Number.isFinite(timestamp)||!query.get('transaction_id')||!query.get('custom_data')||!query.get('user_id'))throw new Error('Invalid reward data.');
 // Google's console transport test uses a sample unit. Only this signed,
 // explicitly marked test is acknowledged without entering the reward path.
 if(!isConsoleSsvValidation(query)&&!units.includes(unit)&&!(/^\d+$/.test(unit||'')&&units.some(allowed=>allowed.endsWith(`/${unit}`))))throw new Error('Unknown ad unit.');
 return query;
}
