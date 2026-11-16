import { RequestError } from './shared/errors.js';

const fields = {
  sync: [], save: ['data', 'revision', 'operationId'], resolve: ['data', 'revision', 'operationId'], join: [],
  flight: ['runId', 'owner', 'lease', 'instances', 'seconds', 'distance', 'coins', 'capsules', 'bosses','eliteBosses'],
  claim: ['instanceId', 'index'], adIntent: ['instanceId', 'index', 'kind'], adStatus: ['id'], cancelAd: ['id'],
  purchase: ['platform', 'productId', 'transactionId', 'verified', 'signedTransaction', 'purchaseToken', 'restore'],
  reconcilePurchases: ['revocations'], merge: ['sourceToken', 'sourceRevision', 'targetRevision', 'choice'],
  deleteAccount: [], adminRead: [], adminSave: ['template'], adminPublish: ['id', 'pause']
  ,spend:['kind','id','expectedPrice','operationId'],careerClaim:['id'],legacySave:[]
};
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9:_-]{1,200}$/.test(value);
const revision = value => Number.isSafeInteger(value) && value >= 0;
const text = (value, limit) => typeof value === 'string' && value.length > 0 && value.length <= limit;
export function requireUid(uid) {
 if(typeof uid!=='string'||!/^[A-Za-z0-9:_-]{1,128}$/.test(uid))throw new RequestError('Invalid account reference.',401,'unauthenticated');
 return uid;
}

export function validateRequest(req) {
  const match = /^\/(?:api\/)?([A-Za-z]+)\/?$/.exec(req.path || '');
  const action = match?.[1];
  if (!Object.hasOwn(fields, action)) throw new RequestError('Unknown action.', 404, 'not-found');
  const body = req.body;
  if (!record(body)) throw new RequestError('Invalid request body.');
  const bytes = Buffer.byteLength(JSON.stringify(body));
  const large = ['save', 'resolve', 'reconcilePurchases'].includes(action);
  if (bytes > (large ? 512 * 1024 : 48 * 1024)) throw new RequestError('Request is too large.', 413, 'request-too-large');
  const allowed = new Set([...fields[action], 'version','economyProtocol']);
  if (Object.keys(body).some(key => !allowed.has(key))) throw new RequestError('Unsupported request field.');
  if (body.version !== undefined && !/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(body.version)) throw new RequestError('Invalid client version.');
  if(body.economyProtocol!==undefined&&body.economyProtocol!==1)throw new RequestError('Update the app to use online progress.',426,'economy-update-required');
  if(action==='spend'&&(!['ship','weapon','upgrade','cosmetic','stage'].includes(body.kind)||!id(body.id)||!id(body.operationId)||!Number.isSafeInteger(body.expectedPrice)||body.expectedPrice<0))throw new RequestError('Invalid credit purchase.');
  if(action==='careerClaim'&&!id(body.id))throw new RequestError('Invalid career mission.');
  if (['save', 'resolve'].includes(action) && (!record(body.data) || !revision(body.revision))) throw new RequestError('Invalid save revision.');
  if (action === 'save' && !id(body.operationId)) throw new RequestError('Invalid operation ID.');
  if (action === 'resolve' && body.operationId !== undefined && !id(body.operationId)) throw new RequestError('Invalid operation ID.');
  if (action === 'flight' && (!id(body.lease) || !Array.isArray(body.instances) || body.instances.length > 16 || new Set(body.instances).size !== body.instances.length || body.instances.some(value => !id(value)))) throw new RequestError('Invalid event period.');
  if (['claim', 'adIntent'].includes(action) && !id(body.instanceId)) throw new RequestError('Invalid event ID.');
  if ((action === 'claim' || body.index !== undefined) && (!Number.isInteger(body.index) || body.index < 0 || body.index > 6)) throw new RequestError('Invalid reward index.');
  if (action === 'adIntent' && !['credits', 'fragments'].includes(body.kind)) throw new RequestError('Unknown reward.');
  if (['adStatus', 'cancelAd', 'adminPublish'].includes(action) && !id(body.id)) throw new RequestError('Invalid ID.');
  if (action === 'purchase') {
    if (!['ios', 'android'].includes(body.platform) || !text(body.productId, 80) || !text(body.transactionId, 200)) throw new RequestError('Invalid purchase data.');
    if (body.platform === 'ios' ? !text(body.signedTransaction, 32768) : !text(body.purchaseToken, 8192)) throw new RequestError('Invalid purchase proof.');
    if (body.restore !== undefined && typeof body.restore !== 'boolean') throw new RequestError('Invalid restore flag.');
  }
  if (action === 'reconcilePurchases' && (!Array.isArray(body.revocations) || body.revocations.length > 200 || body.revocations.some(proof => !record(proof) || !text(proof.productId, 80) || !text(proof.transactionId, 200) || !text(proof.signedTransaction, 32768)))) throw new RequestError('Invalid revocation records.');
  if (action === 'merge' && (!text(body.sourceToken, 16384) || !revision(body.sourceRevision) || !revision(body.targetRevision) || !['source', 'target'].includes(body.choice))) throw new RequestError('Invalid account merge.');
  if (action === 'adminSave' && !record(body.template)) throw new RequestError('Invalid event template.');
  if (action === 'adminPublish' && body.pause !== undefined && typeof body.pause !== 'boolean') throw new RequestError('Invalid publication flag.');
  return { action, body };
}

// One rolling record per UID, not a new document for every request. These limits
// constrain a valid account; App Check/edge quotas are also needed against Sybils.
export function chargeRequest(prior, action, now) {
  const minute = Math.floor(now / 60000), day = Math.floor(now / 86400000);
  const next = {
    minute, day,
    minuteCount: prior?.minute === minute ? prior.minuteCount : 0,
    dayCount: prior?.day === day ? prior.dayCount : 0,
    actions: prior?.day === day ? { ...prior.actions } : {}
  };
  const daily = { resolve: 12, merge: 12, reconcilePurchases: 100, purchase: 500, adIntent: 100 };
  if (next.minuteCount >= 120 || next.dayCount >= 12000 || (daily[action] && (next.actions[action] || 0) >= daily[action])) {
    throw new RequestError('Too many requests. Try again later.', 429, 'rate-limited');
  }
  next.minuteCount++; next.dayCount++; next.actions[action] = (next.actions[action] || 0) + 1;
  return next;
}

export async function enforceRequestBudget(db, uid, action, now) {
  const ref = db.doc(`requestBudgets/${uid}`);
  await db.runTransaction(async tx => {
    const prior = (await tx.get(ref)).data();
    tx.set(ref, { ...chargeRequest(prior, action, now), expiresAt: new Date(now + 30 * 86400000) });
  });
}
