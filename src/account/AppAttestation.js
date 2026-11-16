// Share SDK refreshes and briefly back off after failure. Tokens stay in memory,
// never in localStorage, analytics, query strings or application error messages.
export function createAttestationReader(read,clock=Date.now,timeoutMs=8000) {
 let pending,retryAt=0;
 return async()=>{
  if(clock()<retryAt)return null;
  if(pending)return pending;
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('App verification timed out.')),timeoutMs);});
  pending=Promise.race([Promise.resolve().then(read),timeout]).catch(()=>{retryAt=clock()+60000;return null;}).finally(()=>{clearTimeout(timer);pending=null;});
  return pending;
 };
}
