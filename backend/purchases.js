import { RequestError } from './shared/errors.js';
import { COSMETIC_PRODUCT_IDS, CREDIT_PACKS, STARTER_CREDITS } from './shared/store-catalog.js';
import { GoogleAuth } from 'google-auth-library';
import { verifyAppleReceipt } from './apple-receipts.js';
const products={starter_pack:{credits:STARTER_CREDITS,consumable:false},...Object.fromEntries(Object.entries(CREDIT_PACKS).map(([id,credits])=>[id,{credits,consumable:true}])),remove_ads:{credits:0,consumable:false}};
const cosmetics=new Set(COSMETIC_PRODUCT_IDS);
const googleAuth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/androidpublisher']});
export async function verifyStorePurchase(input, options = {}) {
 const product=Object.hasOwn(products,input.productId)?products[input.productId]:(cosmetics.has(input.productId)?{credits:0,consumable:false}:null);
 if(!product||typeof input.transactionId!=='string')throw new RequestError('Unknown store product.');
 if(input.platform==='android') {
  if(!cosmetics.has(input.productId)||typeof input.purchaseToken!=='string')throw new RequestError('Product unavailable on Android.');
  const receipt=await googleReceipt(input,options);
  if(receipt.purchaseState!==0)throw new RequestError('Purchase is not completed.');
  if(receipt.purchaseType===0 && options.environment!=='Sandbox')throw new RequestError('Test purchases cannot be delivered to the live game.');
  return {id:`google:${input.purchaseToken}`,environment:options.environment||'Production',productId:input.productId,...product};
 }
 if(input.platform==='ios') {
  if(typeof input.signedTransaction!=='string')throw new RequestError('Missing App Store signed transaction.');
  const receipt=await verifyAppleReceipt(input,options);
  return {id:`apple:${receipt.environment}:${receipt.transactionId}`,environment:receipt.environment,productId:input.productId,...product};
 }
 throw new RequestError('A native store receipt is required.');
}

// Only Google's explicit canceled state revokes ownership. Pending purchases,
// unavailable APIs and missing responses never erase an existing entitlement.
export async function googlePurchaseRevoked(input, options = {}) {
 const receipt=await googleReceipt(input,options);
 if(receipt.purchaseState===1)return true;
 if(receipt.purchaseState!==0)throw new RequestError('Purchase is not completed.');
 return false;
}
async function googleReceipt(input, options = {}) {
 const token=await (options.accessToken || (()=>googleAuth.getAccessToken()))();
 const pkg=process.env.ANDROID_PACKAGE||'com.cgtygrss.neoglide';
 const response=await (options.fetch || fetch)(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases/products/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.purchaseToken)}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw new RequestError('Google Play could not verify this purchase.');
 return response.json();
}
