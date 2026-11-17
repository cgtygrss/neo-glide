// Owner-run setup only. Uses the existing Firebase CLI login; never exports its token.
// Default is a read-only plan. --apply creates the explicitly scoped CI identities.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const require = createRequire(new URL('../../tools/ci/package.json', import.meta.url));
const auth = require('firebase-tools/lib/auth.js');
const account = auth.getGlobalDefaultAccount();
if (!account) throw new Error('Run tools/ci/node_modules/.bin/firebase login first.');
const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const config = JSON.parse(readFileSync('ci/release.json'));
const project = config.firebaseProject;
async function api(url, method = 'GET', body, allowMissing = false) {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (allowMissing && response.status === 404) return null;
  if (!response.ok) throw new Error(`Cloud setup ${method} ${new URL(url).pathname}: ${response.status} ${(await response.text()).slice(0,600)}`);
  return response.status === 204 ? {} : response.json();
}
const metadata = await api(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}`);
const number = metadata.projectNumber;
const pool = `projects/${number}/locations/global/workloadIdentityPools/neo-glide-github`;
const provider = `${pool}/providers/neo-glide-main`;
const publisher = `neo-glide-play-publisher@${project}.iam.gserviceaccount.com`;
const deployer = `neo-glide-firebase-deployer@${project}.iam.gserviceaccount.com`;
const functionAccessRole = `projects/${project}/roles/neoGlideFunctionAccessPublisher`;
const functionAccessPermissions = ['cloudfunctions.functions.setIamPolicy', 'run.services.setIamPolicy'];
const roles = ['roles/cloudfunctions.developer', functionAccessRole, 'roles/firebasehosting.admin', 'roles/firebaserules.admin', 'roles/datastore.indexAdmin', 'roles/serviceusage.serviceUsageConsumer', 'roles/firebase.viewer'];
// The pinned Firebase CLI checks App Engine actAs even for V2 deployments.
// Bind each account separately; never grant project-wide Service Account User.
const actAsAccounts = [`${number}-compute@developer.gserviceaccount.com`, `${project}@appspot.gserviceaccount.com`];
const condition = "assertion.repository_id == '1100314457' && assertion.repository_owner_id == '100800979' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == 'cgtygrss/neo-glide/.github/workflows/release.yml@refs/heads/main'";
console.log(JSON.stringify({ project, provider, publisher, deployer, firebaseRoles: roles, functionAccessPermissions, trustCondition: condition, runtimeActAs: actAsAccounts, apply: process.argv.includes('--apply') }, null, 2));
if (!process.argv.includes('--apply')) process.exit(0);
for (const service of ['iam.googleapis.com', 'iamcredentials.googleapis.com', 'sts.googleapis.com']) {
  await api(`https://serviceusage.googleapis.com/v1/projects/${number}/services/${service}:enable`, 'POST', {});
}
for (const [email, displayName] of [[publisher, 'Neo Glide CI Play publisher'], [deployer, 'Neo Glide CI Firebase deployer']]) {
  const url = `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${email}`;
  if (!await api(url, 'GET', undefined, true)) await api(`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`, 'POST', { accountId: email.split('@')[0], serviceAccount: { displayName } });
}
const existingFunctionRole = await api(`https://iam.googleapis.com/v1/${functionAccessRole}`, 'GET', undefined, true);
if (existingFunctionRole) {
  if (existingFunctionRole.deleted || JSON.stringify([...existingFunctionRole.includedPermissions].sort()) !== JSON.stringify([...functionAccessPermissions].sort())) throw new Error('Existing function access role differs; refusing to overwrite it.');
} else {
  await api(`https://iam.googleapis.com/v1/projects/${project}/roles`, 'POST', { roleId: 'neoGlideFunctionAccessPublisher', role: { title: 'Neo Glide Function Access Publisher', description: 'HTTPS function deployment policy writes for the trusted main release workflow.', includedPermissions: functionAccessPermissions, stage: 'GA' } });
}
const poolUrl = `https://iam.googleapis.com/v1/${pool}`;
if (!await api(poolUrl, 'GET', undefined, true)) await api(`https://iam.googleapis.com/v1/projects/${number}/locations/global/workloadIdentityPools?workloadIdentityPoolId=neo-glide-github`, 'POST', { displayName: 'Neo Glide GitHub Actions' });
const providerUrl = `https://iam.googleapis.com/v1/${provider}`;
const existingProvider = await api(providerUrl, 'GET', undefined, true);
if (existingProvider && existingProvider.attributeCondition !== condition) throw new Error('Existing provider has a different trust policy; refusing to overwrite it.');
if (!existingProvider) await api(`https://iam.googleapis.com/v1/${pool}/providers?workloadIdentityPoolProviderId=neo-glide-main`, 'POST', { displayName: 'Neo Glide main release', attributeMapping: { 'google.subject': 'assertion.sub', 'attribute.repository_id': 'assertion.repository_id' }, attributeCondition: condition, oidc: { issuerUri: 'https://token.actions.githubusercontent.com' } });
async function addBindings(getUrl, setUrl, additions, method = 'POST') {
  const policy = await api(getUrl, method, method === 'POST' ? {} : undefined);
  policy.bindings ||= [];
  for (const { role, member } of additions) {
    let binding = policy.bindings.find(b => b.role === role && !b.condition);
    if (!binding) { binding = { role, members: [] }; policy.bindings.push(binding); }
    if (!binding.members.includes(member)) binding.members.push(member);
  }
  await api(setUrl, 'POST', { policy });
}
for (const email of [publisher, deployer]) {
  const base = `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${email}`;
  await addBindings(`${base}:getIamPolicy`, `${base}:setIamPolicy`, [{ role: 'roles/iam.workloadIdentityUser', member: `principalSet://iam.googleapis.com/${pool}/attribute.repository_id/1100314457` }]);
}
await addBindings(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}:getIamPolicy`, `https://cloudresourcemanager.googleapis.com/v1/projects/${project}:setIamPolicy`, roles.map(role => ({ role, member: `serviceAccount:${deployer}` })));
for (const email of actAsAccounts) {
  const runtime = `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${email}`;
  await addBindings(`${runtime}:getIamPolicy`, `${runtime}:setIamPolicy`, [{ role: 'roles/iam.serviceAccountUser', member: `serviceAccount:${deployer}` }]);
}
for (const [name, value] of Object.entries({ GCP_WORKLOAD_IDENTITY_PROVIDER: provider, PLAY_PUBLISH_SERVICE_ACCOUNT: publisher, FIREBASE_DEPLOY_SERVICE_ACCOUNT: deployer })) execFileSync('gh', ['variable', 'set', name, '--env', 'store-release', '--repo', 'cgtygrss/neo-glide', '--body', value]);
console.log('Cloud trust and CI service accounts configured. Play Console app-scoped release permission must be granted separately.');
