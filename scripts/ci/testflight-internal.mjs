import { readFileSync } from 'node:fs';
import { createPrivateKey,sign } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function validateInternalTarget(group,build,identity,config) {
 if(identity.mode!=='device-test')throw new Error('Device validation manifest required.');
 if(group.attributes.isInternalGroup!==true||group.relationships.app.data.id!==config.appleAppId)throw new Error('Only the existing internal group of this app is allowed.');
 if(build.attributes.version!==identity.build||build.marketingVersion!==identity.version||build.attributes.expired)throw new Error('Unexpected TestFlight build.');
 if(['INVALID','FAILED'].includes(build.attributes.processingState))throw new Error('Apple rejected build processing.');
 return build.attributes.processingState==='VALID';
}

async function main() {
 const identity=JSON.parse(readFileSync('ci-output/identity.json'));
 const config=JSON.parse(readFileSync('ci/release.json'));
 if(identity.mode!=='device-test')throw new Error('Device validation manifest required.');
 const key=createPrivateKey(Buffer.from(process.env.ASC_PRIVATE_KEY_BASE64,'base64'));
 const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const request=async(path,body)=>{
  const now=Math.floor(Date.now()/1000);
  const message=enc({alg:'ES256',kid:process.env.ASC_KEY_ID,typ:'JWT'})+'.'+enc({iss:process.env.ASC_ISSUER_ID,iat:now,exp:now+300,aud:'appstoreconnect-v1'});
  const token=message+'.'+sign('sha256',Buffer.from(message),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
  const response=await fetch('https://api.appstoreconnect.apple.com/v1/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`TestFlight API failed: ${response.status}`);
  return response.status===204?null:response.json();
 };
 const group=(await request(`betaGroups/${config.appleInternalBetaGroupId}?include=app`)).data;
 const deadline=Date.now()+25*60*1000;
 while(Date.now()<deadline){
  const data=await request(`builds?filter[app]=${config.appleAppId}&filter[version]=${identity.build}&include=preReleaseVersion&limit=50`);
  const build=data.data[0];
  if(build){
   build.marketingVersion=data.included?.find(x=>x.type==='preReleaseVersions'&&x.id===build.relationships.preReleaseVersion.data?.id)?.attributes.version;
   if(validateInternalTarget(group,build,identity,config)){
    if(!group.attributes.hasAccessToAllBuilds){
     const assigned=await request(`builds/${build.id}/relationships/betaGroups?limit=200`);
     if(!assigned.data.some(item=>item.id===group.id))await request(`betaGroups/${group.id}/relationships/builds`,{data:[{type:'builds',id:build.id}]});
    }
    console.log(`TestFlight ${identity.version} (${identity.build}) processed and assigned to existing internal group ${group.attributes.name}. No App Store review submission.`);
    return;
   }
  }
  console.log(`Waiting for TestFlight build ${identity.build} processing.`);
  await new Promise(resolve=>setTimeout(resolve,15000));
 }
 throw new Error('TestFlight processing timed out; retry the same run without uploading another binary.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
