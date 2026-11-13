import { SignedDataVerifier, Environment, VerificationStatus } from '@apple/app-store-server-library';
import { readFileSync } from 'node:fs';

export async function verifyAppleReceipt(input, options = {}) {
 const primary = options.environment || (process.env.APPLE_ENVIRONMENT === 'Sandbox' ? Environment.SANDBOX : Environment.PRODUCTION);
 const verify = options.verify || (async (environment, signed) => {
  const verifier = new SignedDataVerifier(
   [readFileSync(new URL('./certificates/AppleRootCA-G3.cer', import.meta.url))], true, environment,
   process.env.APPLE_BUNDLE_ID || 'com.cgtygrssgame.neonglide',
   environment === Environment.PRODUCTION ? Number(process.env.APPLE_APP_ID) : undefined
  );
  return verifier.verifyAndDecodeTransaction(signed);
 });
 let receipt;
 try { receipt = await verify(primary, input.signedTransaction); }
 catch (error) {
  // Apple review and TestFlight use signed Sandbox transactions. Retry only an
  // SDK-verified environment mismatch; certificate/signature failures stay fatal.
  if (primary !== Environment.PRODUCTION || error.status !== VerificationStatus.INVALID_ENVIRONMENT) throw error;
  receipt = await verify(Environment.SANDBOX, input.signedTransaction);
 }
 if (receipt.productId !== input.productId || receipt.transactionId !== input.transactionId || (receipt.revocationDate && !options.allowRevoked)) throw new Error('App Store transaction does not match.');
 return receipt;
}
