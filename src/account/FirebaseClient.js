import { APP_VERSION } from '../version.js';
import { newId } from './Id.js';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously, signInWithPopup, GoogleAuthProvider, signInWithCredential, onAuthStateChanged, deleteUser } from 'firebase/auth';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { requireAdultServices } from '../privacy/AudiencePolicy.js';
export const emulated=import.meta.env?.DEV&&import.meta.env?.VITE_FIREBASE_EMULATORS==='true';
export const firebaseConfig={projectId:emulated?'demo-neo-glide':'neo-glide-live',appId:'1:288922991366:web:3ea00532b39a7a23a8bc87',apiKey:'AIzaSyDjkuNCmWAIiXZHp80IoZQ6aOqIzBECFGU',authDomain:'neo-glide-live.firebaseapp.com'};
const native=registerPlugin('NeoGlideAuth');
let webAuth;
function webSession() {
 requireAdultServices();
 if(!webAuth){webAuth=getAuth(initializeApp(firebaseConfig));if(emulated)connectAuthEmulator(webAuth,'http://127.0.0.1:9099',{disableWarnings:true});}
 return webAuth;
}
const nativePlatform=Capacitor.isNativePlatform();
const describe=user=>user?{uid:user.uid,name:user.displayName||'Guest pilot',anonymous:user.isAnonymous,providers:user.providerData.map(p=>p.providerId)}:null;
let webCandidate;
export const identity={
 async playerProfile() { requireAdultServices(); return nativePlatform ? native.getPlayerProfile() : {}; },
 async restore() {
  requireAdultServices();
  if(nativePlatform)return (await native.restoreSession()).user||null;
  const webAuth=webSession();
  await new Promise(resolve=>{const remove=onAuthStateChanged(webAuth,()=>{remove();resolve();});});
  return describe(webAuth.currentUser);
 },
 async guest() {requireAdultServices();if(nativePlatform)return (await native.signInGuest()).user;return describe((await signInAnonymously(webSession())).user);},
 async token() {requireAdultServices();if(nativePlatform)return (await native.getIdToken()).token;return webSession().currentUser?.getIdToken();},
 async begin(provider='google') {
  requireAdultServices();
  if(nativePlatform)return native.beginSignIn({provider});
  if(provider!=='google')throw new Error('Game Center is available in the iOS app.');
  const candidateAuth=getAuth(initializeApp(firebaseConfig,`candidate-${newId()}`));
  if(emulated)connectAuthEmulator(candidateAuth,'http://127.0.0.1:9099',{disableWarnings:true});
  const p=new GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});
  const result=await signInWithPopup(candidateAuth,p);webCandidate=GoogleAuthProvider.credentialFromResult(result);
  return {user:describe(result.user),token:await result.user.getIdToken()};
 },
 async commit() {requireAdultServices();if(nativePlatform)return (await native.commitSignIn()).user;if(!webCandidate)throw new Error('Sign in again.');const result=await signInWithCredential(webSession(),webCandidate);webCandidate=null;return describe(result.user);},
 async auto() {requireAdultServices();if(!nativePlatform)return null;return native.autoSignIn();},
 async clear() {requireAdultServices();if(nativePlatform)return native.signOut();return webAuth?.signOut();},
 async remove() {requireAdultServices();if(nativePlatform)return native.deleteAccount();const session=webSession();if(session.currentUser)await deleteUser(session.currentUser);},
 platform:Capacitor.getPlatform()
};
export async function callServer(action,body={},tokenOverride) {
 requireAdultServices();
 const token=tokenOverride||await identity.token();if(!token)throw new Error('Connect your account to sync.');
 const base=emulated?'http://127.0.0.1:5001/demo-neo-glide/europe-west3/api':(import.meta.env?.VITE_EVENTS_API_URL||'https://europe-west3-neo-glide-live.cloudfunctions.net/api');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
 let response;try{response=await fetch(`${base}/${action}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({...body,version:APP_VERSION}),signal:controller.signal});}finally{clearTimeout(timeout);}
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Cloud service is unavailable. Your local progress is safe.');
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Sync unavailable.');return data;
}
