// Only application-authored errors may be returned to an untrusted caller.
export class RequestError extends Error {
  constructor(message, status = 400, code = 'invalid-request') {
    super(message);
    this.name = 'RequestError';
    this.status = status;
    this.code = code;
  }
}

export function publicError(error) {
  if (error instanceof RequestError) return { status: error.status, body: { error: error.message, code: error.code } };
  if (typeof error?.code === 'string' && error.code.startsWith('auth/')) {
    return { status: 401, body: { error: 'Sign in again to continue.', code: 'unauthenticated' } };
  }
  return { status: 400, body: { error: 'Request could not be completed.', code: 'request-failed' } };
}
