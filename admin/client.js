import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from '../src/account/FirebaseClient.js';
import { APP_VERSION } from '../src/version.js';

// This separate operator page initializes only its web session; family-player
// audience preferences are neither changed nor used to authorize administrators.
export function adminAuth() {
 const app=getApps().find(app=>app.name==='[DEFAULT]')||initializeApp(firebaseConfig);
 return getAuth(app);
}
export async function callAdmin(action,body={}) {
 if(!['adminRead','adminSave','adminPublish'].includes(action))throw new Error('Unsupported administrator action.');
 const user=adminAuth().currentUser;
 if(!user)throw new Error('Sign in as administrator.');
 const headers={'Content-Type':'application/json',Authorization:`Bearer ${await user.getIdToken()}`};
 const base=import.meta.env?.VITE_EVENTS_API_URL||'https://europe-west3-neo-glide-live.cloudfunctions.net/api';
 const response=await fetch(`${base}/${action}`,{method:'POST',headers,body:JSON.stringify({...body,version:APP_VERSION}),signal:AbortSignal.timeout(20000)});
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Cloud service is unavailable.');
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Administrator request failed.');
 return result;
}
