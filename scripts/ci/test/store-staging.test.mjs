import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const cli=fileURLToPath(new URL('../store-state.mjs',import.meta.url));
const candidate={version:'1.3.0',build:'109',run:'123',commit:'source',sha256:'digest',mode:'publish',track:'alpha',stores:['ios'],iosSubmitForReview:false};

function fixture(t,{record=candidate,submitted=false}={}){
  const root=mkdtempSync(join(tmpdir(),'neo-store-staging-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  mkdirSync(join(root,'ci-output'));
  for(const file of ['identity.json','ios.json'])writeFileSync(join(root,'ci-output',file),JSON.stringify(candidate));
  writeFileSync(join(root,'fixture.json'),JSON.stringify({record,submitted}));
  writeFileSync(join(root,'mock.mjs'),`
    import {readFileSync,writeFileSync} from 'node:fs';
    const fixture=JSON.parse(readFileSync('fixture.json')),calls=[];
    process.on('exit',()=>writeFileSync('calls.json',JSON.stringify(calls)));
    globalThis.fetch=async(url,options={})=>{
      const parsed=new URL(url),method=options.method||'GET';
      if(parsed.origin!=='https://api.github.com')throw Error('Unexpected destination');
      const body=options.body?JSON.parse(options.body):undefined;
      calls.push({path:parsed.pathname,method,body});
      let response;
      if(method==='POST'&&parsed.pathname.endsWith('/deployments/77/statuses'))response={id:88,...body};
      else if(method==='GET'&&parsed.pathname.endsWith('/deployments'))response=parsed.searchParams.get('environment')==='ios-store'?[{id:77,payload:fixture.record}]:[];
      else if(method==='GET'&&parsed.pathname.endsWith('/deployments/77/statuses'))response=[{state:'in_progress',description:fixture.submitted?'Submitted; awaiting store review':'Uploaded; App Store review pending manual submission'}];
      else throw Error('Unexpected request: '+method+' '+parsed.pathname);
      return new Response(JSON.stringify(response),{status:200});
    };
  `);
  const run=command=>execFileSync(process.execPath,['--import',join(root,'mock.mjs'),cli,command,'ios'],{
    cwd:root,encoding:'utf8',timeout:5000,stdio:'pipe',env:{...process.env,GH_TOKEN:'fixture-only',GITHUB_REPOSITORY:'fixture/app',GITHUB_RUN_ID:'123',GITHUB_OUTPUT:join(root,'outputs'),DEPLOYMENT_ID:'77'}
  });
  return {run,calls:()=>JSON.parse(readFileSync(join(root,'calls.json'))),output:()=>readFileSync(join(root,'outputs'),'utf8')};
}

test('staged iOS upload records unresolved status without claiming review submission',t=>{
  const f=fixture(t);f.run('submitted');
  const [call]=f.calls();
  assert.equal(call.method,'POST');
  assert.equal(call.body.state,'in_progress');
  assert.equal(call.body.description,'Uploaded; App Store review pending manual submission');
});

test('an uploaded but unsubmitted build resumes, while an actual review submission skips upload',t=>{
  const staged=fixture(t);staged.run('begin');
  assert.match(staged.output(),/submitted=false/);
  assert.ok(staged.calls().every(c=>c.method==='GET'));
  const submitted=fixture(t,{submitted:true});submitted.run('begin');
  assert.match(submitted.output(),/submitted=true/);
  assert.ok(submitted.calls().every(c=>c.method==='GET'));
});

test('the real ledger rejects changing store targets on an existing artifact before any write',t=>{
  const f=fixture(t,{record:{...candidate,stores:['ios','android']}});
  assert.throws(()=>f.run('begin'),/selection does not match/);
  assert.ok(f.calls().every(c=>c.method==='GET'));
});
