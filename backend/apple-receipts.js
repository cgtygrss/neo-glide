import { RequestError } from './shared/errors.js';
import { SignedDataVerifier, Environment } from '@apple/app-store-server-library';
import { readFileSync } from 'node:fs';
const verifiers = new Map();

export async function verifyAppleReceipt(input, options = {}) {
 const primary = options.environment || Environment.PRODUCTION;
 const verify = options.verify || (async (environment, signed) => {
  if(!verifiers.has(environment))verifiers.set(environment,new SignedDataVerifier(
   [readFileSync(new URL('./certificates/AppleRootCA-G3.cer', import.meta.url))], true, environment,
   process.env.APPLE_BUNDLE_ID || 'com.cgtygrssgame.neonglide',
   environment === Environment.PRODUCTION ? Number(process.env.APPLE_APP_ID) : undefined
  ));
  return verifiers.get(environment).verifyAndDecodeTransaction(signed);
 });
 const receipt = await verify(primary, input.signedTransaction);
 if(receipt.environment!==primary)throw new RequestError('App Store environment does not match.');
 if (receipt.productId !== input.productId || receipt.transactionId !== input.transactionId || (receipt.revocationDate && !options.allowRevoked)) throw new RequestError('App Store transaction does not match.');
 return receipt;
}
