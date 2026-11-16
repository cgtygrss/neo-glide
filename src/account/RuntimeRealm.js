let realm='Production',configured=false;
export const runtimeRealm=()=>realm;
export const isTestRealm=()=>['Sandbox','Xcode'].includes(realm);
export function configureRuntimeRealm(value) {
 if(!['Production','Sandbox','Xcode','Legacy-Production','Legacy-Sandbox','Legacy-Xcode'].includes(value))throw new Error('App environment could not be verified.');
 if(configured&&realm!==value)throw new Error('Restart the app to change its environment.');
 realm=value;configured=true;
}
export function scopedStorage(storage,environment) {
 const prefix=environment==='Production'?'':`neo_glide_test:${environment}:`;
 const keys=()=>Array.from({length:storage.length},(_,index)=>storage.key(index)).filter(key=>key?.startsWith(prefix));
 return {
  getItem:key=>storage.getItem(prefix+key),setItem:(key,value)=>storage.setItem(prefix+key,value),removeItem:key=>storage.removeItem(prefix+key),
  get length(){return keys().length;},key:index=>keys()[index]?.slice(prefix.length)??null
 };
}
export const accountStorage={
 getItem:key=>scopedStorage(localStorage,realm).getItem(key),setItem:(key,value)=>scopedStorage(localStorage,realm).setItem(key,value),removeItem:key=>scopedStorage(localStorage,realm).removeItem(key),
 get length(){return scopedStorage(localStorage,realm).length;},key:index=>scopedStorage(localStorage,realm).key(index)
};
