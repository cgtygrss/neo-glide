import { Capacitor, registerPlugin } from '@capacitor/core';
import { configureRuntimeRealm, runtimeRealm } from './RuntimeRealm.js';
import { onlineServicesAllowed,readAudience } from '../privacy/AudiencePolicy.js';
import { localPlaySelection } from './LocalPlayMode.js';
import { enableOnlineEconomy } from './OnlineEconomyMode.js';
const native=registerPlugin('NeoGlideAuth');
let pending;
export function initializeRuntimeEnvironment() {
 const local=localPlaySelection();
 if(readAudience()==='adult'&&local){const environment=`Legacy-${local.environment}`;configureRuntimeRealm(environment);enableOnlineEconomy(false);return Promise.resolve(environment);}
 if(!onlineServicesAllowed())return Promise.resolve('Production');
 if(pending)return pending;
 pending=Promise.resolve().then(async()=>{
  const environment=Capacitor.isNativePlatform()?(await native.getRuntimeEnvironment()).environment:'Production';
  configureRuntimeRealm(environment);enableOnlineEconomy(environment!=='Xcode');return runtimeRealm();
 }).catch(error=>{pending=null;throw error;});
 return pending;
}
